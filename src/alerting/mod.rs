pub mod twilio;
pub mod whatsapp;

use crate::api::sse::StatusEvent;
use crate::db::DbPool;

pub async fn start_alert_listener(
    pool: DbPool,
    mut rx: tokio::sync::broadcast::Receiver<StatusEvent>,
) {
    loop {
        match rx.recv().await {
            Ok(event) => {
                // Trigger alerts when endpoint transitions to DOWN
                if event.new_status == "DOWN" {
                    let event_whatsapp = event.clone();
                    tokio::spawn(async move {
                        if let Err(e) = whatsapp::send_whatsapp_alert(&event_whatsapp).await {
                            eprintln!("Error sending WhatsApp alert: {}", e);
                        }
                    });

                    let event_twilio = event.clone();
                    let pool_clone = pool.clone();
                    tokio::spawn(async move {
                        if let Err(e) = twilio::trigger_twilio_call(&event_twilio).await {
                            eprintln!("Error triggering Twilio call: {}", e);
                        } else {
                            // Update alert log record in database once alerts are successfully triggered
                            if let Err(err) = sqlx::query(
                                "UPDATE status_alert_logs 
                                 SET alert_dispatched = 1 
                                 WHERE endpoint_id = ? AND alerted_at = ?",
                            )
                            .bind(event_twilio.endpoint_id)
                            .bind(event_twilio.alerted_at)
                            .execute(&pool_clone)
                            .await
                            {
                                eprintln!(
                                    "Failed to update status_alert_logs alert_dispatched: {}",
                                    err
                                );
                            }
                        }
                    });
                }
            }
            Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                eprintln!("Alert listener lagged by {} messages", n);
            }
            Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db;
    use chrono::Utc;
    use tokio::sync::broadcast;

    #[tokio::test]
    async fn test_alert_listener_lag_recovery() {
        // Initialize db in memory
        let pool = init_db("sqlite::memory:").await.unwrap();

        // Setup channel with capacity 1
        let (tx, rx) = broadcast::channel::<StatusEvent>(1);

        // Create an endpoint first to avoid Foreign Key constraints
        let endpoint = crate::db::repository::create_endpoint(
            &pool,
            "http://example.com",
            "{}",
            60,
            10,
            15,
            3,
            0.20,
            None,
        )
        .await
        .unwrap();

        // Insert a status alert log record
        let alerted_at = Utc::now();
        sqlx::query(
            "INSERT INTO status_alert_logs (
                endpoint_id, previous_status, new_status, consecutive_failures, alert_dispatched, alerted_at
            ) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(endpoint.id)
        .bind("UP")
        .bind("DOWN")
        .bind(3)
        .bind(0) // alert_dispatched = false
        .bind(alerted_at)
        .execute(&pool)
        .await
        .unwrap();

        // Start listener
        let pool_clone = pool.clone();
        let listener_handle = tokio::spawn(async move {
            start_alert_listener(pool_clone, rx).await;
        });

        // Publish multiple events to trigger lag.
        // Channel capacity is 1.
        let dummy_event = StatusEvent {
            endpoint_id: endpoint.id,
            url: "http://example.com".to_string(),
            previous_status: "UP".to_string(),
            new_status: "DOWN".to_string(),
            consecutive_failures: 3,
            alerted_at: Utc::now(),
        };

        // Send 3 events without yielding to guarantee lag
        let _ = tx.send(dummy_event.clone());
        let _ = tx.send(dummy_event.clone());
        let _ = tx.send(dummy_event.clone());

        // Now send the actual target event that we want processed after lag recovery
        let target_event = StatusEvent {
            endpoint_id: endpoint.id,
            url: "http://example.com".to_string(),
            previous_status: "UP".to_string(),
            new_status: "DOWN".to_string(),
            consecutive_failures: 3,
            alerted_at,
        };

        let _ = tx.send(target_event);

        // Sleep to let the listener catch up and process the target event
        tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;

        // Check if the status alert log was updated to alert_dispatched = 1 (true)
        let row: (i64,) =
            sqlx::query_as("SELECT alert_dispatched FROM status_alert_logs WHERE endpoint_id = ?")
                .bind(endpoint.id)
                .fetch_one(&pool)
                .await
                .unwrap();

        assert_eq!(
            row.0, 1,
            "Status alert log should be updated even after lag"
        );

        // Clean shutdown: drop tx to close channel and let listener exit
        drop(tx);
        let _ = listener_handle.await;
    }
}
