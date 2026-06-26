use crate::db::DbPool;
use crate::db::models::Endpoint;
use crate::db::repository::{log_status_alert, update_endpoint_status};

pub async fn evaluate_probe_result(
    pool: &DbPool,
    endpoint: &Endpoint,
    is_probe_success: bool,
    broadcast_tx: Option<&tokio::sync::broadcast::Sender<crate::api::sse::StatusEvent>>,
) -> Result<(), sqlx::Error> {
    let prev_status = &endpoint.status;
    let mut new_failures = endpoint.consecutive_failures;
    let mut new_status = prev_status.clone();

    if is_probe_success {
        // BR-002: Reset consecutive failures to 0 immediately upon success
        new_failures = 0;
        new_status = "UP".to_string();
    } else {
        new_failures += 1;
        // BR-001: Suppress DOWN transition until failure threshold N (consecutive_failure_threshold) is met
        if new_failures >= endpoint.consecutive_failure_threshold {
            new_status = "DOWN".to_string();
        }
    }

    let status_changed = new_status != *prev_status;

    // Persist status updates to database
    update_endpoint_status(pool, endpoint.id, &new_status, new_failures).await?;

    if status_changed {
        // Log the status transition alert
        let log = log_status_alert(
            pool,
            endpoint.id,
            prev_status,
            &new_status,
            new_failures,
            false, // false indicates alert has not been processed or dispatched yet
        )
        .await?;

        // Broadcast to SSE streams and alerting module
        if let Some(tx) = broadcast_tx {
            let event = crate::api::sse::StatusEvent {
                endpoint_id: endpoint.id,
                url: endpoint.url.clone(),
                previous_status: prev_status.clone(),
                new_status: new_status.clone(),
                consecutive_failures: new_failures,
                alerted_at: log.alerted_at,
            };
            let _ = tx.send(event);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db;
    use crate::db::repository::{create_endpoint, get_endpoint};

    #[tokio::test]
    async fn test_evaluate_probe_success_flow() {
        let pool = init_db("sqlite::memory:").await.unwrap();
        let endpoint = create_endpoint(
            &pool,
            "http://127.0.0.1/health",
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

        // 1. Success check: status remains UP, consecutive failures stays 0
        evaluate_probe_result(&pool, &endpoint, true, None)
            .await
            .unwrap();
        let ep = get_endpoint(&pool, endpoint.id).await.unwrap().unwrap();
        assert_eq!(ep.status, "UP");
        assert_eq!(ep.consecutive_failures, 0);
    }

    #[tokio::test]
    async fn test_evaluate_probe_suppression_and_failure_flow() {
        let pool = init_db("sqlite::memory:").await.unwrap();
        let endpoint = create_endpoint(
            &pool,
            "http://127.0.0.1/health",
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

        // 1. First failure: stays UP (BR-001 alert suppression)
        evaluate_probe_result(&pool, &endpoint, false, None)
            .await
            .unwrap();
        let ep1 = get_endpoint(&pool, endpoint.id).await.unwrap().unwrap();
        assert_eq!(ep1.status, "UP");
        assert_eq!(ep1.consecutive_failures, 1);

        // 2. Second failure: stays UP
        evaluate_probe_result(&pool, &ep1, false, None)
            .await
            .unwrap();
        let ep2 = get_endpoint(&pool, endpoint.id).await.unwrap().unwrap();
        assert_eq!(ep2.status, "UP");
        assert_eq!(ep2.consecutive_failures, 2);

        // 3. Third failure: transitions to DOWN
        evaluate_probe_result(&pool, &ep2, false, None)
            .await
            .unwrap();
        let ep3 = get_endpoint(&pool, endpoint.id).await.unwrap().unwrap();
        assert_eq!(ep3.status, "DOWN");
        assert_eq!(ep3.consecutive_failures, 3);

        // 4. Success recovery: resets failures to 0 immediately (BR-002) and transitions back to UP
        evaluate_probe_result(&pool, &ep3, true, None)
            .await
            .unwrap();
        let ep4 = get_endpoint(&pool, endpoint.id).await.unwrap().unwrap();
        assert_eq!(ep4.status, "UP");
        assert_eq!(ep4.consecutive_failures, 0);
    }
}
