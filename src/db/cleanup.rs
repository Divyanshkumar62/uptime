use crate::db::DbPool;
use chrono::Utc;
use std::time::Duration as StdDuration;
use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CleanupResult {
    pub metrics_deleted: u64,
    pub logs_deleted: u64,
}

pub async fn prune_stale_data(
    pool: &DbPool,
    retention_days: i64,
) -> Result<CleanupResult, sqlx::Error> {
    let boundary = Utc::now() - chrono::Duration::days(retention_days);

    // Delete metrics older than retention period
    let metrics_res = sqlx::query("DELETE FROM ping_metrics WHERE checked_at < ?")
        .bind(boundary)
        .execute(pool)
        .await?;
    let metrics_deleted = metrics_res.rows_affected();

    // Delete alert logs older than retention period
    let logs_res = sqlx::query("DELETE FROM status_alert_logs WHERE alerted_at < ?")
        .bind(boundary)
        .execute(pool)
        .await?;
    let logs_deleted = logs_res.rows_affected();

    Ok(CleanupResult {
        metrics_deleted,
        logs_deleted,
    })
}

pub async fn start_cleanup_worker(
    pool: DbPool,
    interval_duration: StdDuration,
    retention_days: i64,
    cancel_token: CancellationToken,
) {
    let mut interval = tokio::time::interval(interval_duration);
    loop {
        tokio::select! {
            _ = interval.tick() => {
                println!("Running scheduled database cleanup...");
                match prune_stale_data(&pool, retention_days).await {
                    Ok(res) => {
                        println!(
                            "Database cleanup completed: deleted {} metrics, {} logs.",
                            res.metrics_deleted, res.logs_deleted
                        );
                    }
                    Err(e) => {
                        eprintln!("Database cleanup job encountered error: {}", e);
                    }
                }
            }
            _ = cancel_token.cancelled() => {
                println!("Cleanup worker shutting down gracefully.");
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db;
    use crate::db::repository::create_endpoint;
    use chrono::{Duration, Utc};
    use std::time::Duration as StdDuration;
    use tokio_util::sync::CancellationToken;

    async fn setup_test_data(pool: &DbPool) -> i64 {
        let endpoint = create_endpoint(
            pool,
            "https://test-cleanup.com/health",
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
        endpoint.id
    }

    #[tokio::test]
    async fn test_retention_boundary_and_deletion_safety() {
        let pool = init_db("sqlite::memory:").await.unwrap();
        let endpoint_id = setup_test_data(&pool).await;

        let now = Utc::now();
        // Stale data (31 days ago)
        let stale_time = now - Duration::days(31);
        // Stale boundary (exactly 30 days and 1 minute ago)
        let stale_boundary_time = now - Duration::days(30) - Duration::minutes(1);
        // Fresh data (29 days ago)
        let fresh_time = now - Duration::days(29);
        // Fresh boundary (exactly 29 days, 23 hours, 59 minutes ago)
        let fresh_boundary_time = now - Duration::days(30) + Duration::minutes(1);

        // Insert ping metrics
        sqlx::query("INSERT INTO ping_metrics (endpoint_id, status_code, response_time_ms, is_success, checked_at) VALUES (?, ?, ?, ?, ?)")
            .bind(endpoint_id).bind(200).bind(120).bind(true).bind(stale_time)
            .execute(&pool).await.unwrap();

        sqlx::query("INSERT INTO ping_metrics (endpoint_id, status_code, response_time_ms, is_success, checked_at) VALUES (?, ?, ?, ?, ?)")
            .bind(endpoint_id).bind(200).bind(130).bind(true).bind(stale_boundary_time)
            .execute(&pool).await.unwrap();

        sqlx::query("INSERT INTO ping_metrics (endpoint_id, status_code, response_time_ms, is_success, checked_at) VALUES (?, ?, ?, ?, ?)")
            .bind(endpoint_id).bind(200).bind(140).bind(true).bind(fresh_time)
            .execute(&pool).await.unwrap();

        sqlx::query("INSERT INTO ping_metrics (endpoint_id, status_code, response_time_ms, is_success, checked_at) VALUES (?, ?, ?, ?, ?)")
            .bind(endpoint_id).bind(200).bind(150).bind(true).bind(fresh_boundary_time)
            .execute(&pool).await.unwrap();

        // Insert status alert logs
        sqlx::query("INSERT INTO status_alert_logs (endpoint_id, previous_status, new_status, consecutive_failures, alert_dispatched, alerted_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(endpoint_id).bind("UP").bind("DOWN").bind(3).bind(true).bind(stale_time)
            .execute(&pool).await.unwrap();

        sqlx::query("INSERT INTO status_alert_logs (endpoint_id, previous_status, new_status, consecutive_failures, alert_dispatched, alerted_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(endpoint_id).bind("UP").bind("DOWN").bind(3).bind(true).bind(stale_boundary_time)
            .execute(&pool).await.unwrap();

        sqlx::query("INSERT INTO status_alert_logs (endpoint_id, previous_status, new_status, consecutive_failures, alert_dispatched, alerted_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(endpoint_id).bind("UP").bind("DOWN").bind(3).bind(true).bind(fresh_time)
            .execute(&pool).await.unwrap();

        sqlx::query("INSERT INTO status_alert_logs (endpoint_id, previous_status, new_status, consecutive_failures, alert_dispatched, alerted_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(endpoint_id).bind("UP").bind("DOWN").bind(3).bind(true).bind(fresh_boundary_time)
            .execute(&pool).await.unwrap();

        // Execute prune with 30-day retention
        let result = prune_stale_data(&pool, 30).await.unwrap();
        assert_eq!(result.metrics_deleted, 2);
        assert_eq!(result.logs_deleted, 2);

        // Deletion Safety: Verify that the endpoint itself is not deleted
        let endpoint_exists: (i64,) = sqlx::query_as("SELECT count(*) FROM endpoints WHERE id = ?")
            .bind(endpoint_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(
            endpoint_exists.0, 1,
            "The endpoint itself must never be deleted by the retention purger."
        );

        // Boundary verification: verify that fresh metrics & logs remain
        let remaining_metrics: Vec<(i64,)> =
            sqlx::query_as("SELECT response_time_ms FROM ping_metrics ORDER BY checked_at ASC")
                .fetch_all(&pool)
                .await
                .unwrap();
        assert_eq!(remaining_metrics.len(), 2);
        assert_eq!(remaining_metrics[0].0, 150);
        assert_eq!(remaining_metrics[1].0, 140);

        let remaining_logs: Vec<(i64,)> = sqlx::query_as("SELECT id FROM status_alert_logs")
            .fetch_all(&pool)
            .await
            .unwrap();
        assert_eq!(remaining_logs.len(), 2);
    }

    #[tokio::test]
    async fn test_idempotent_repeated_executions() {
        let pool = init_db("sqlite::memory:").await.unwrap();
        let endpoint_id = setup_test_data(&pool).await;

        let stale_time = Utc::now() - Duration::days(31);

        // Insert stale data
        sqlx::query("INSERT INTO ping_metrics (endpoint_id, status_code, response_time_ms, is_success, checked_at) VALUES (?, ?, ?, ?, ?)")
            .bind(endpoint_id).bind(200).bind(120).bind(true).bind(stale_time)
            .execute(&pool).await.unwrap();

        sqlx::query("INSERT INTO status_alert_logs (endpoint_id, previous_status, new_status, consecutive_failures, alert_dispatched, alerted_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(endpoint_id).bind("UP").bind("DOWN").bind(3).bind(true).bind(stale_time)
            .execute(&pool).await.unwrap();

        // First execution deletes the stale data
        let res1 = prune_stale_data(&pool, 30).await.unwrap();
        assert_eq!(res1.metrics_deleted, 1);
        assert_eq!(res1.logs_deleted, 1);

        // Second execution should do nothing (idempotence)
        let res2 = prune_stale_data(&pool, 30).await.unwrap();
        assert_eq!(res2.metrics_deleted, 0);
        assert_eq!(res2.logs_deleted, 0);

        // Third execution should do nothing
        let res3 = prune_stale_data(&pool, 30).await.unwrap();
        assert_eq!(res3.metrics_deleted, 0);
        assert_eq!(res3.logs_deleted, 0);
    }

    #[tokio::test]
    async fn test_scheduled_cleanup_worker_execution() {
        let pool = init_db("sqlite::memory:").await.unwrap();
        let endpoint_id = setup_test_data(&pool).await;

        let stale_time = Utc::now() - Duration::days(32);

        // Insert stale data
        sqlx::query("INSERT INTO ping_metrics (endpoint_id, status_code, response_time_ms, is_success, checked_at) VALUES (?, ?, ?, ?, ?)")
            .bind(endpoint_id).bind(200).bind(120).bind(true).bind(stale_time)
            .execute(&pool).await.unwrap();

        let cancel_token = CancellationToken::new();

        // Start worker with a very short interval (10ms)
        let pool_clone = pool.clone();
        let cancel_clone = cancel_token.clone();
        let handle = tokio::spawn(async move {
            start_cleanup_worker(pool_clone, StdDuration::from_millis(10), 30, cancel_clone).await;
        });

        // Sleep to let the worker tick and prune data
        tokio::time::sleep(StdDuration::from_millis(50)).await;

        // Verify data was pruned
        let metrics_count: (i64,) = sqlx::query_as("SELECT count(*) FROM ping_metrics")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(metrics_count.0, 0);

        // Cancel worker cleanly
        cancel_token.cancel();
        let _ = handle.await;
    }
}
