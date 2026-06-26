use crate::db::DbPool;
use crate::db::models::{Endpoint, PingMetric, StatusAlertLog};
use chrono::Utc;
use sqlx::Error;

#[allow(clippy::too_many_arguments)]
pub async fn create_endpoint(
    pool: &DbPool,
    url: &str,
    headers: &str,
    interval_seconds: i32,
    timeout_seconds: i32,
    retry_interval_seconds: i32,
    consecutive_failure_threshold: i32,
    jitter_ratio: f64,
    json_validation_keys: Option<&str>,
) -> Result<Endpoint, Error> {
    let now = Utc::now();
    let row_id = sqlx::query(
        "INSERT INTO endpoints (
            url, headers, interval_seconds, timeout_seconds, retry_interval_seconds,
            consecutive_failure_threshold, jitter_ratio, json_validation_keys,
            status, consecutive_failures, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UP', 0, 1, ?, ?)",
    )
    .bind(url)
    .bind(headers)
    .bind(interval_seconds)
    .bind(timeout_seconds)
    .bind(retry_interval_seconds)
    .bind(consecutive_failure_threshold)
    .bind(jitter_ratio)
    .bind(json_validation_keys)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?
    .last_insert_rowid();

    let endpoint = sqlx::query_as::<_, Endpoint>("SELECT * FROM endpoints WHERE id = ?")
        .bind(row_id)
        .fetch_one(pool)
        .await?;

    Ok(endpoint)
}

pub async fn get_endpoint(pool: &DbPool, id: i64) -> Result<Option<Endpoint>, Error> {
    sqlx::query_as::<_, Endpoint>("SELECT * FROM endpoints WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn list_active_endpoints(pool: &DbPool) -> Result<Vec<Endpoint>, Error> {
    sqlx::query_as::<_, Endpoint>("SELECT * FROM endpoints WHERE is_active = 1")
        .fetch_all(pool)
        .await
}

pub async fn update_endpoint_status(
    pool: &DbPool,
    id: i64,
    status: &str,
    consecutive_failures: i32,
) -> Result<(), Error> {
    let now = Utc::now();
    sqlx::query(
        "UPDATE endpoints 
         SET status = ?, consecutive_failures = ?, updated_at = ? 
         WHERE id = ?",
    )
    .bind(status)
    .bind(consecutive_failures)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn log_ping_metric(
    pool: &DbPool,
    endpoint_id: i64,
    status_code: Option<i32>,
    response_time_ms: i64,
    is_success: bool,
) -> Result<PingMetric, Error> {
    let now = Utc::now();
    let row_id = sqlx::query(
        "INSERT INTO ping_metrics (
            endpoint_id, status_code, response_time_ms, is_success, checked_at
        ) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(endpoint_id)
    .bind(status_code)
    .bind(response_time_ms)
    .bind(is_success)
    .bind(now)
    .execute(pool)
    .await?
    .last_insert_rowid();

    let metric = sqlx::query_as::<_, PingMetric>("SELECT * FROM ping_metrics WHERE id = ?")
        .bind(row_id)
        .fetch_one(pool)
        .await?;

    Ok(metric)
}

pub async fn log_status_alert(
    pool: &DbPool,
    endpoint_id: i64,
    previous_status: &str,
    new_status: &str,
    consecutive_failures: i32,
    alert_dispatched: bool,
) -> Result<StatusAlertLog, Error> {
    let now = Utc::now();
    let row_id = sqlx::query(
        "INSERT INTO status_alert_logs (
            endpoint_id, previous_status, new_status, consecutive_failures, alert_dispatched, alerted_at
        ) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(endpoint_id)
    .bind(previous_status)
    .bind(new_status)
    .bind(consecutive_failures)
    .bind(alert_dispatched)
    .bind(now)
    .execute(pool)
    .await?
    .last_insert_rowid();

    let log = sqlx::query_as::<_, StatusAlertLog>("SELECT * FROM status_alert_logs WHERE id = ?")
        .bind(row_id)
        .fetch_one(pool)
        .await?;

    Ok(log)
}

pub async fn get_response_times(
    pool: &DbPool,
    endpoint_id: i64,
    since: chrono::DateTime<chrono::Utc>,
) -> Result<Vec<i64>, Error> {
    sqlx::query_scalar::<_, i64>(
        "SELECT response_time_ms FROM ping_metrics 
         WHERE endpoint_id = ? AND checked_at >= ? 
         ORDER BY response_time_ms ASC",
    )
    .bind(endpoint_id)
    .bind(since)
    .fetch_all(pool)
    .await
}

#[allow(clippy::too_many_arguments)]
pub async fn update_endpoint(
    pool: &DbPool,
    id: i64,
    url: &str,
    headers: &str,
    interval_seconds: i32,
    timeout_seconds: i32,
    retry_interval_seconds: i32,
    consecutive_failure_threshold: i32,
    jitter_ratio: f64,
    json_validation_keys: Option<&str>,
    is_active: bool,
) -> Result<Endpoint, Error> {
    let now = chrono::Utc::now();
    sqlx::query(
        "UPDATE endpoints 
         SET url = ?, headers = ?, interval_seconds = ?, timeout_seconds = ?, 
             retry_interval_seconds = ?, consecutive_failure_threshold = ?, 
             jitter_ratio = ?, json_validation_keys = ?, is_active = ?, updated_at = ? 
         WHERE id = ?",
    )
    .bind(url)
    .bind(headers)
    .bind(interval_seconds)
    .bind(timeout_seconds)
    .bind(retry_interval_seconds)
    .bind(consecutive_failure_threshold)
    .bind(jitter_ratio)
    .bind(json_validation_keys)
    .bind(is_active)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await?;

    let endpoint = sqlx::query_as::<_, Endpoint>("SELECT * FROM endpoints WHERE id = ?")
        .bind(id)
        .fetch_one(pool)
        .await?;

    Ok(endpoint)
}

pub async fn delete_endpoint(pool: &DbPool, id: i64) -> Result<(), Error> {
    sqlx::query("DELETE FROM endpoints WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_ping_metrics(
    pool: &DbPool,
    endpoint_id: i64,
    since: chrono::DateTime<chrono::Utc>,
) -> Result<Vec<PingMetric>, Error> {
    sqlx::query_as::<_, PingMetric>(
        "SELECT * FROM ping_metrics 
         WHERE endpoint_id = ? AND checked_at >= ? 
         ORDER BY checked_at DESC",
    )
    .bind(endpoint_id)
    .bind(since)
    .fetch_all(pool)
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db;

    #[tokio::test]
    async fn test_db_operations() {
        // Initialize db in memory
        let pool = init_db("sqlite::memory:").await.unwrap();

        // Create an endpoint
        let endpoint = create_endpoint(
            &pool,
            "https://api.example.com/health",
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

        assert_eq!(endpoint.url, "https://api.example.com/health");
        assert_eq!(endpoint.status, "UP");
        assert_eq!(endpoint.consecutive_failures, 0);

        // Fetch the endpoint
        let fetched = get_endpoint(&pool, endpoint.id).await.unwrap().unwrap();
        assert_eq!(fetched.id, endpoint.id);

        // List active endpoints
        let active = list_active_endpoints(&pool).await.unwrap();
        assert_eq!(active.len(), 1);

        // Update status
        update_endpoint_status(&pool, endpoint.id, "DOWN", 1)
            .await
            .unwrap();
        let updated = get_endpoint(&pool, endpoint.id).await.unwrap().unwrap();
        assert_eq!(updated.status, "DOWN");
        assert_eq!(updated.consecutive_failures, 1);

        // Log metric
        let metric = log_ping_metric(&pool, endpoint.id, Some(200), 120, true)
            .await
            .unwrap();
        assert_eq!(metric.endpoint_id, endpoint.id);
        assert_eq!(metric.response_time_ms, 120);
        assert!(metric.is_success);

        // Log status alert
        let alert = log_status_alert(&pool, endpoint.id, "UP", "DOWN", 3, true)
            .await
            .unwrap();
        assert_eq!(alert.endpoint_id, endpoint.id);
        assert_eq!(alert.new_status, "DOWN");
        assert!(alert.alert_dispatched);

        // Add multiple metrics to test latency queries
        log_ping_metric(&pool, endpoint.id, Some(200), 50, true)
            .await
            .unwrap();
        log_ping_metric(&pool, endpoint.id, Some(200), 150, true)
            .await
            .unwrap();
        log_ping_metric(&pool, endpoint.id, Some(200), 80, true)
            .await
            .unwrap();

        let since = chrono::Utc::now() - chrono::Duration::days(1);
        let times = get_response_times(&pool, endpoint.id, since).await.unwrap();

        // Output from get_response_times is sorted ASC
        assert_eq!(times.len(), 4); // 120 (from previous check) + 50 + 150 + 80
        assert_eq!(times[0], 50);
        assert_eq!(times[1], 80);
        assert_eq!(times[2], 120);
        assert_eq!(times[3], 150);

        // Test p99 latency integration
        let p99 = crate::monitoring::latency::calculate_p99_latency(&times);
        assert_eq!(p99, 150);

        // Test SQLite foreign key enforcement (ON DELETE CASCADE deletes cascade metrics)
        sqlx::query("DELETE FROM endpoints WHERE id = ?")
            .bind(endpoint.id)
            .execute(&pool)
            .await
            .unwrap();

        let times_after_delete = get_response_times(&pool, endpoint.id, since).await.unwrap();
        assert_eq!(times_after_delete.len(), 0);
    }
}
