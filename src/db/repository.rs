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
    http_method: &str,
    request_body: Option<&str>,
    accepted_status_codes: &str,
    ignore_tls_errors: bool,
    throttle_seconds: i32,
    monitor_type: &str,
    port: Option<i32>,
    dns_record_type: Option<&str>,
    dns_resolve_server: Option<&str>,
    dns_expected_result: Option<&str>,
    db_connection_string: Option<&str>,
    docker_container_id: Option<&str>,
) -> Result<Endpoint, Error> {
    let now = Utc::now();
    let row_id = sqlx::query(
        "INSERT INTO endpoints (
            url, headers, interval_seconds, timeout_seconds, retry_interval_seconds,
            consecutive_failure_threshold, jitter_ratio, json_validation_keys,
            status, consecutive_failures, is_active, http_method, request_body,
            accepted_status_codes, ignore_tls_errors, throttle_seconds,
            monitor_type, port, dns_record_type, dns_resolve_server, dns_expected_result,
            db_connection_string, docker_container_id,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UP', 0, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(url)
    .bind(headers)
    .bind(interval_seconds)
    .bind(timeout_seconds)
    .bind(retry_interval_seconds)
    .bind(consecutive_failure_threshold)
    .bind(jitter_ratio)
    .bind(json_validation_keys)
    .bind(http_method)
    .bind(request_body)
    .bind(accepted_status_codes)
    .bind(ignore_tls_errors)
    .bind(throttle_seconds)
    .bind(monitor_type)
    .bind(port)
    .bind(dns_record_type)
    .bind(dns_resolve_server)
    .bind(dns_expected_result)
    .bind(db_connection_string)
    .bind(docker_container_id)
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
    http_method: &str,
    request_body: Option<&str>,
    accepted_status_codes: &str,
    ignore_tls_errors: bool,
    throttle_seconds: i32,
    monitor_type: &str,
    port: Option<i32>,
    dns_record_type: Option<&str>,
    dns_resolve_server: Option<&str>,
    dns_expected_result: Option<&str>,
    db_connection_string: Option<&str>,
    docker_container_id: Option<&str>,
) -> Result<Endpoint, Error> {
    let now = chrono::Utc::now();
    sqlx::query(
        "UPDATE endpoints 
         SET url = ?, headers = ?, interval_seconds = ?, timeout_seconds = ?, 
             retry_interval_seconds = ?, consecutive_failure_threshold = ?, 
             jitter_ratio = ?, json_validation_keys = ?, is_active = ?, 
             http_method = ?, request_body = ?, accepted_status_codes = ?, 
             ignore_tls_errors = ?, throttle_seconds = ?, monitor_type = ?,
             port = ?, dns_record_type = ?, dns_resolve_server = ?,
             dns_expected_result = ?, db_connection_string = ?, docker_container_id = ?,
             updated_at = ? 
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
    .bind(http_method)
    .bind(request_body)
    .bind(accepted_status_codes)
    .bind(ignore_tls_errors)
    .bind(throttle_seconds)
    .bind(monitor_type)
    .bind(port)
    .bind(dns_record_type)
    .bind(dns_resolve_server)
    .bind(dns_expected_result)
    .bind(db_connection_string)
    .bind(docker_container_id)
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

pub async fn get_integrations_settings(
    pool: &DbPool,
) -> Result<crate::db::models::IntegrationsSettings, Error> {
    sqlx::query_as::<_, crate::db::models::IntegrationsSettings>(
        "SELECT * FROM integrations_settings WHERE id = 1",
    )
    .fetch_one(pool)
    .await
}

#[allow(clippy::too_many_arguments)]
pub async fn update_integrations_settings(
    pool: &DbPool,
    whatsapp_token: Option<&str>,
    whatsapp_phone_number_id: Option<&str>,
    whatsapp_to_number: Option<&str>,
    whatsapp_template_name: Option<&str>,
    whatsapp_enabled: bool,
    twilio_account_sid: Option<&str>,
    twilio_auth_token: Option<&str>,
    twilio_from_number: Option<&str>,
    twilio_to_number: Option<&str>,
    twilio_callback_url: Option<&str>,
    twilio_enabled: bool,
    webhook_url: Option<&str>,
    webhook_enabled: bool,
    slack_url: Option<&str>,
    slack_enabled: bool,
    discord_url: Option<&str>,
    discord_enabled: bool,
    smtp_host: Option<&str>,
    smtp_port: Option<i32>,
    smtp_username: Option<&str>,
    smtp_password: Option<&str>,
    smtp_from: Option<&str>,
    smtp_to: Option<&str>,
    smtp_enabled: bool,
    webhook_method: &str,
    webhook_headers: Option<&str>,
    webhook_body_template: Option<&str>,
) -> Result<crate::db::models::IntegrationsSettings, Error> {
    let now = chrono::Utc::now();
    sqlx::query(
        "UPDATE integrations_settings 
         SET whatsapp_token = ?, whatsapp_phone_number_id = ?, whatsapp_to_number = ?, 
             whatsapp_template_name = ?, whatsapp_enabled = ?, twilio_account_sid = ?, 
             twilio_auth_token = ?, twilio_from_number = ?, twilio_to_number = ?, 
             twilio_callback_url = ?, twilio_enabled = ?, webhook_url = ?, 
             webhook_enabled = ?, slack_url = ?, slack_enabled = ?, 
             discord_url = ?, discord_enabled = ?, smtp_host = ?, 
             smtp_port = ?, smtp_username = ?, smtp_password = ?, 
             smtp_from = ?, smtp_to = ?, smtp_enabled = ?, 
             webhook_method = ?, webhook_headers = ?, webhook_body_template = ?,
             updated_at = ? 
         WHERE id = 1",
    )
    .bind(whatsapp_token)
    .bind(whatsapp_phone_number_id)
    .bind(whatsapp_to_number)
    .bind(whatsapp_template_name)
    .bind(whatsapp_enabled)
    .bind(twilio_account_sid)
    .bind(twilio_auth_token)
    .bind(twilio_from_number)
    .bind(twilio_to_number)
    .bind(twilio_callback_url)
    .bind(twilio_enabled)
    .bind(webhook_url)
    .bind(webhook_enabled)
    .bind(slack_url)
    .bind(slack_enabled)
    .bind(discord_url)
    .bind(discord_enabled)
    .bind(smtp_host)
    .bind(smtp_port)
    .bind(smtp_username)
    .bind(smtp_password)
    .bind(smtp_from)
    .bind(smtp_to)
    .bind(smtp_enabled)
    .bind(webhook_method)
    .bind(webhook_headers)
    .bind(webhook_body_template)
    .bind(now)
    .execute(pool)
    .await?;

    get_integrations_settings(pool).await
}

pub async fn get_recent_incidents(pool: &DbPool, limit: i64) -> Result<Vec<PingMetric>, Error> {
    sqlx::query_as::<_, PingMetric>(
        "SELECT * FROM ping_metrics 
         WHERE is_success = 0 
         ORDER BY checked_at DESC 
         LIMIT ?",
    )
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn set_endpoint_tags(
    pool: &DbPool,
    endpoint_id: i64,
    tags: &[String],
) -> Result<(), Error> {
    sqlx::query("DELETE FROM endpoint_tags WHERE endpoint_id = ?")
        .bind(endpoint_id)
        .execute(pool)
        .await?;

    for tag in tags {
        sqlx::query("INSERT INTO endpoint_tags (endpoint_id, tag) VALUES (?, ?)")
            .bind(endpoint_id)
            .bind(tag)
            .execute(pool)
            .await?;
    }
    Ok(())
}

pub async fn get_endpoint_tags(pool: &DbPool, endpoint_id: i64) -> Result<Vec<String>, Error> {
    let rows =
        sqlx::query_as::<_, (String,)>("SELECT tag FROM endpoint_tags WHERE endpoint_id = ?")
            .bind(endpoint_id)
            .fetch_all(pool)
            .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

pub async fn list_endpoints(pool: &DbPool, tag: Option<&str>) -> Result<Vec<Endpoint>, Error> {
    if let Some(t) = tag {
        sqlx::query_as::<_, Endpoint>(
            "SELECT e.* FROM endpoints e 
             JOIN endpoint_tags t ON e.id = t.endpoint_id 
             WHERE t.tag = ?",
        )
        .bind(t)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query_as::<_, Endpoint>("SELECT * FROM endpoints")
            .fetch_all(pool)
            .await
    }
}

pub async fn update_ssl_expiry(
    pool: &DbPool,
    id: i64,
    expiry: Option<chrono::DateTime<chrono::Utc>>,
) -> Result<(), Error> {
    sqlx::query("UPDATE endpoints SET ssl_expires_at = ?, updated_at = ? WHERE id = ?")
        .bind(expiry)
        .bind(chrono::Utc::now())
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
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
