pub mod discord;
pub mod slack;
pub mod smtp;
pub mod twilio;
pub mod webhook;
pub mod whatsapp;

use crate::api::sse::StatusEvent;
use crate::db::DbPool;
use crate::db::repository;

async fn is_alert_throttled(
    pool: &DbPool,
    endpoint_id: i64,
    new_status: &str,
    throttle_seconds: i32,
) -> bool {
    // Cooldown is bypassed for UP resolution events
    if new_status == "UP" {
        return false;
    }

    // Find the last dispatched failure alert
    let last_alert_time: Option<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
        "SELECT alerted_at FROM status_alert_logs 
         WHERE endpoint_id = ? AND new_status = 'DOWN' AND alert_dispatched = 1 
         ORDER BY alerted_at DESC LIMIT 1",
    )
    .bind(endpoint_id)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    if let Some(alerted_at) = last_alert_time {
        let elapsed = chrono::Utc::now() - alerted_at;
        if elapsed.num_seconds() < throttle_seconds as i64 {
            return true; // Cooldown active, throttle alert
        }
    }
    false
}

pub async fn start_alert_listener(
    pool: DbPool,
    mut rx: tokio::sync::broadcast::Receiver<StatusEvent>,
) {
    loop {
        match rx.recv().await {
            Ok(event) => {
                // Trigger alerts when endpoint transitions to DOWN, UP, or SSL is expiring
                if event.new_status == "DOWN"
                    || event.new_status == "UP"
                    || event.new_status.starts_with("SSL_EXPIRING_")
                {
                    let pool_clone = pool.clone();
                    let event_clone = event.clone();
                    tokio::spawn(async move {
                        let settings =
                            match repository::get_integrations_settings(&pool_clone).await {
                                Ok(s) => s,
                                Err(e) => {
                                    eprintln!("Failed to retrieve integrations settings: {}", e);
                                    return;
                                }
                            };

                        let endpoint =
                            match repository::get_endpoint(&pool_clone, event_clone.endpoint_id)
                                .await
                            {
                                Ok(Some(ep)) => ep,
                                _ => {
                                    eprintln!(
                                        "Failed to retrieve endpoint config for ID {}",
                                        event_clone.endpoint_id
                                    );
                                    return;
                                }
                            };

                        // Check anti-flapping throttling cooldown
                        if is_alert_throttled(
                            &pool_clone,
                            event_clone.endpoint_id,
                            &event_clone.new_status,
                            endpoint.throttle_seconds,
                        )
                        .await
                        {
                            println!(
                                "[INFO] Skipping throttled alert for endpoint {} ({}) under cooldown.",
                                event_clone.endpoint_id, event_clone.url
                            );
                            return;
                        }

                        // WhatsApp dispatch
                        if settings.whatsapp_enabled {
                            let token = settings.whatsapp_token.unwrap_or_default();
                            let phone_id = settings.whatsapp_phone_number_id.unwrap_or_default();
                            let to = settings.whatsapp_to_number.unwrap_or_default();
                            let temp = settings.whatsapp_template_name.unwrap_or_default();

                            if token.is_empty()
                                || phone_id.is_empty()
                                || to.is_empty()
                                || temp.is_empty()
                            {
                                println!(
                                    "[INFO] Skipping WhatsApp alert for endpoint {} ({}): credentials not configured.",
                                    event_clone.endpoint_id, event_clone.url
                                );
                            } else if let Err(e) = whatsapp::send_whatsapp_alert(
                                &event_clone,
                                &token,
                                &phone_id,
                                &to,
                                &temp,
                            )
                            .await
                            {
                                eprintln!("Error sending WhatsApp alert: {}", e);
                            }
                        }

                        // Twilio dispatch
                        if settings.twilio_enabled {
                            let sid = settings.twilio_account_sid.unwrap_or_default();
                            let token = settings.twilio_auth_token.unwrap_or_default();
                            let from = settings.twilio_from_number.unwrap_or_default();
                            let to = settings.twilio_to_number.unwrap_or_default();
                            let callback = settings.twilio_callback_url.unwrap_or_default();

                            if sid.is_empty()
                                || token.is_empty()
                                || from.is_empty()
                                || to.is_empty()
                                || callback.is_empty()
                            {
                                println!(
                                    "[INFO] Skipping Twilio alert for endpoint {} ({}): credentials not configured.",
                                    event_clone.endpoint_id, event_clone.url
                                );
                            } else if let Err(e) = twilio::trigger_twilio_call(
                                &event_clone,
                                &sid,
                                &token,
                                &from,
                                &to,
                                &callback,
                            )
                            .await
                            {
                                eprintln!("Error triggering Twilio call: {}", e);
                            }
                        }

                        // Webhook dispatch
                        if settings.webhook_enabled {
                            let url = settings.webhook_url.unwrap_or_default();
                            if url.is_empty() {
                                println!(
                                    "[INFO] Skipping Webhook alert for endpoint {} ({}): URL not configured.",
                                    event_clone.endpoint_id, event_clone.url
                                );
                            } else if let Err(e) = webhook::send_webhook_alert(
                                &event_clone,
                                &url,
                                &settings.webhook_method,
                                settings.webhook_headers.as_deref(),
                                settings.webhook_body_template.as_deref(),
                            )
                            .await
                            {
                                eprintln!("Error sending Webhook alert: {}", e);
                            }
                        }

                        // Slack dispatch
                        if settings.slack_enabled {
                            let url = settings.slack_url.unwrap_or_default();
                            if url.is_empty() {
                                println!(
                                    "[INFO] Skipping Slack alert for endpoint {} ({}): URL not configured.",
                                    event_clone.endpoint_id, event_clone.url
                                );
                            } else if let Err(e) = slack::send_slack_alert(&event_clone, &url).await
                            {
                                eprintln!("Error sending Slack alert: {}", e);
                            }
                        }

                        // Discord dispatch
                        if settings.discord_enabled {
                            let url = settings.discord_url.unwrap_or_default();
                            if url.is_empty() {
                                println!(
                                    "[INFO] Skipping Discord alert for endpoint {} ({}): URL not configured.",
                                    event_clone.endpoint_id, event_clone.url
                                );
                            } else if let Err(e) =
                                discord::send_discord_alert(&event_clone, &url).await
                            {
                                eprintln!("Error sending Discord alert: {}", e);
                            }
                        }

                        // SMTP dispatch
                        if settings.smtp_enabled {
                            let host = settings.smtp_host.unwrap_or_default();
                            let port = settings.smtp_port.unwrap_or(587) as u16;
                            let username = settings.smtp_username.unwrap_or_default();
                            let password = settings.smtp_password.unwrap_or_default();
                            let from = settings.smtp_from.unwrap_or_default();
                            let to = settings.smtp_to.unwrap_or_default();

                            if host.is_empty()
                                || username.is_empty()
                                || password.is_empty()
                                || from.is_empty()
                                || to.is_empty()
                            {
                                println!(
                                    "[INFO] Skipping SMTP alert for endpoint {} ({}): settings not configured.",
                                    event_clone.endpoint_id, event_clone.url
                                );
                            } else if let Err(e) = smtp::send_smtp_alert(
                                &event_clone,
                                &host,
                                port,
                                &username,
                                &password,
                                &from,
                                &to,
                            )
                            .await
                            {
                                eprintln!("Error sending SMTP alert: {}", e);
                            }
                        }

                        // Update alert log record in database once alert flow executes
                        if let Err(err) = sqlx::query(
                            "UPDATE status_alert_logs 
                             SET alert_dispatched = 1 
                             WHERE endpoint_id = ? AND alerted_at = ?",
                        )
                        .bind(event_clone.endpoint_id)
                        .bind(event_clone.alerted_at)
                        .execute(&pool_clone)
                        .await
                        {
                            eprintln!(
                                "Failed to update status_alert_logs alert_dispatched: {}",
                                err
                            );
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
            "GET",
            None,
            "200-299",
            false,
            900,
            "HTTP",
            None,
            None,
            None,
            None,
            None,
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
            error_message: None,
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
            error_message: None,
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

    #[tokio::test]
    async fn test_alert_listener_graceful_skipping() {
        let pool = init_db("sqlite::memory:").await.unwrap();
        let (tx, rx) = broadcast::channel::<StatusEvent>(10);

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
            "GET",
            None,
            "200-299",
            false,
            900,
            "HTTP",
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .unwrap();

        // Update integrations settings to enable WhatsApp, Twilio, and Webhook but leave them empty
        sqlx::query(
            "UPDATE integrations_settings 
             SET whatsapp_enabled = 1, twilio_enabled = 1, webhook_enabled = 1 
             WHERE id = 1",
        )
        .execute(&pool)
        .await
        .unwrap();

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
        .bind(0)
        .bind(alerted_at)
        .execute(&pool)
        .await
        .unwrap();

        let pool_clone = pool.clone();
        let listener_handle = tokio::spawn(async move {
            start_alert_listener(pool_clone, rx).await;
        });

        let event = StatusEvent {
            endpoint_id: endpoint.id,
            url: "http://example.com".to_string(),
            previous_status: "UP".to_string(),
            new_status: "DOWN".to_string(),
            consecutive_failures: 3,
            alerted_at,
            error_message: None,
        };

        tx.send(event).unwrap();

        tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;

        // Verify alert_dispatched was updated to 1
        let row: (i64,) =
            sqlx::query_as("SELECT alert_dispatched FROM status_alert_logs WHERE endpoint_id = ?")
                .bind(endpoint.id)
                .fetch_one(&pool)
                .await
                .unwrap();

        assert_eq!(row.0, 1);

        drop(tx);
        let _ = listener_handle.await;
    }

    #[tokio::test]
    async fn test_alert_listener_ssl_expiry_warning() {
        let pool = init_db("sqlite::memory:").await.unwrap();
        let (tx, rx) = broadcast::channel::<StatusEvent>(10);

        let endpoint = crate::db::repository::create_endpoint(
            &pool,
            "https://ssl-test.com",
            "{}",
            60,
            10,
            15,
            3,
            0.20,
            None,
            "GET",
            None,
            "200-299",
            false,
            900,
            "HTTP",
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .unwrap();

        // Enable webhook setting to test dispatch routing without actual endpoint calls
        sqlx::query(
            "UPDATE integrations_settings 
             SET webhook_enabled = 1, webhook_url = '' 
             WHERE id = 1",
        )
        .execute(&pool)
        .await
        .unwrap();

        let alerted_at = chrono::Utc::now();
        sqlx::query(
            "INSERT INTO status_alert_logs (
                endpoint_id, previous_status, new_status, consecutive_failures, alert_dispatched, alerted_at
            ) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(endpoint.id)
        .bind("UP")
        .bind("SSL_EXPIRING_14")
        .bind(0)
        .bind(0)
        .bind(alerted_at)
        .execute(&pool)
        .await
        .unwrap();

        let pool_clone = pool.clone();
        let listener_handle = tokio::spawn(async move {
            start_alert_listener(pool_clone, rx).await;
        });

        let event = StatusEvent {
            endpoint_id: endpoint.id,
            url: "https://ssl-test.com".to_string(),
            previous_status: "UP".to_string(),
            new_status: "SSL_EXPIRING_14".to_string(),
            consecutive_failures: 0,
            alerted_at,
            error_message: Some("SSL certificate warning".to_string()),
        };

        tx.send(event).unwrap();

        tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;

        // Verify alert_dispatched was updated to 1
        let row: (i64,) =
            sqlx::query_as("SELECT alert_dispatched FROM status_alert_logs WHERE endpoint_id = ? AND new_status = 'SSL_EXPIRING_14'")
                .bind(endpoint.id)
                .fetch_one(&pool)
                .await
                .unwrap();

        assert_eq!(row.0, 1);

        drop(tx);
        let _ = listener_handle.await;
    }

    #[tokio::test]
    async fn test_cooldown_throttling_evaluation() {
        let pool = init_db("sqlite::memory:").await.unwrap();

        // Create an endpoint to satisfy foreign key constraints
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
            "GET",
            None,
            "200-299",
            false,
            900,
            "HTTP",
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .unwrap();

        // 1. Check throttling for UP event - should be bypassed (always false)
        let throttled_up = is_alert_throttled(&pool, endpoint.id, "UP", 900).await;
        assert!(!throttled_up);

        // 2. Check throttling with no previous status log - should be false
        let throttled_initial = is_alert_throttled(&pool, endpoint.id, "DOWN", 900).await;
        assert!(!throttled_initial);

        // 3. Log a failure alert log
        let now = Utc::now();
        sqlx::query(
            "INSERT INTO status_alert_logs (
                endpoint_id, previous_status, new_status, consecutive_failures, alert_dispatched, alerted_at
            ) VALUES (?, 'UP', 'DOWN', 3, 1, ?)",
        )
        .bind(endpoint.id)
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        // 4. Try again within the 900s window - should be throttled (true)
        let throttled_within = is_alert_throttled(&pool, endpoint.id, "DOWN", 900).await;
        assert!(throttled_within);

        // 5. Try with a smaller window of 0s - should not be throttled (false)
        let throttled_zero_cooldown = is_alert_throttled(&pool, endpoint.id, "DOWN", 0).await;
        assert!(!throttled_zero_cooldown);

        // 6. Try with a log from 1000 seconds ago - should not be throttled (false)
        sqlx::query("DELETE FROM status_alert_logs")
            .execute(&pool)
            .await
            .unwrap();
        let past = Utc::now() - chrono::Duration::seconds(1000);
        sqlx::query(
            "INSERT INTO status_alert_logs (
                endpoint_id, previous_status, new_status, consecutive_failures, alert_dispatched, alerted_at
            ) VALUES (?, 'UP', 'DOWN', 3, 1, ?)",
        )
        .bind(endpoint.id)
        .bind(past)
        .execute(&pool)
        .await
        .unwrap();

        let throttled_past = is_alert_throttled(&pool, endpoint.id, "DOWN", 900).await;
        assert!(!throttled_past);
    }

    #[tokio::test]
    async fn test_webhook_template_interpolation() {
        use axum::Router;
        use axum::routing::post;
        use std::sync::Arc;
        use tokio::sync::Mutex;

        let received_body = Arc::new(Mutex::new(None));
        let received_header = Arc::new(Mutex::new(None));

        let body_clone = received_body.clone();
        let header_clone = received_header.clone();

        let app = Router::new().route(
            "/test-webhook",
            post(
                move |headers: axum::http::HeaderMap, body: String| async move {
                    *body_clone.lock().await = Some(body);
                    *header_clone.lock().await = headers
                        .get("X-Test-Header")
                        .map(|v| v.to_str().unwrap().to_string());
                    axum::http::StatusCode::OK
                },
            ),
        );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });

        let event = StatusEvent {
            endpoint_id: 42,
            url: "http://my-monitor.com".to_string(),
            previous_status: "UP".to_string(),
            new_status: "DOWN".to_string(),
            consecutive_failures: 3,
            alerted_at: Utc::now(),
            error_message: Some("Connection timed out".to_string()),
        };

        let webhook_url = format!("http://127.0.0.1:{}/test-webhook", port);
        let headers_str = Some("{\"X-Test-Header\":\"MyValue\"}");
        let body_template = Some(
            "{\"status\":\"{status}\",\"url\":\"{monitorUrl}\",\"name\":\"{monitorName}\",\"error\":\"{errorMessage}\"}",
        );

        let res =
            webhook::send_webhook_alert(&event, &webhook_url, "POST", headers_str, body_template)
                .await;

        assert!(res.is_ok());

        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

        let final_body = received_body.lock().await.clone().unwrap();
        let final_header = received_header.lock().await.clone().unwrap();

        assert_eq!(final_header, "MyValue");
        assert!(final_body.contains("\"status\":\"DOWN\""));
        assert!(final_body.contains("\"url\":\"http://my-monitor.com\""));
        assert!(final_body.contains("\"error\":\"Connection timed out\""));
    }

    #[tokio::test]
    async fn test_slack_discord_and_smtp_helpers() {
        let event = StatusEvent {
            endpoint_id: 1,
            url: "https://example.com".to_string(),
            previous_status: "UP".to_string(),
            new_status: "DOWN".to_string(),
            consecutive_failures: 3,
            alerted_at: Utc::now(),
            error_message: Some("SSL cert expired".to_string()),
        };

        // Testing direct function calls with invalid URLs returns error types
        let res_slack = slack::send_slack_alert(&event, "http://invalid-dns-name/webhook").await;
        assert!(res_slack.is_err());

        let res_discord =
            discord::send_discord_alert(&event, "http://invalid-dns-name/webhook").await;
        assert!(res_discord.is_err());

        let res_smtp = smtp::send_smtp_alert(
            &event,
            "127.0.0.1",
            2525,
            "user",
            "pass",
            "from@example.com",
            "to@example.com",
        )
        .await;
        // SMTP will fail to connect immediately since no local mail prober runs on port 2525
        assert!(res_smtp.is_err());
    }
}
