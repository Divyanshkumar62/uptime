use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Endpoint {
    pub id: i64,
    pub url: String,
    pub headers: String, // Serialized JSON object of headers
    pub interval_seconds: i32,
    pub timeout_seconds: i32,
    pub retry_interval_seconds: i32,
    pub consecutive_failure_threshold: i32,
    pub jitter_ratio: f64,
    pub json_validation_keys: Option<String>, // Serialized JSON array of key paths
    pub status: String,                       // "UP", "DOWN"
    pub consecutive_failures: i32,
    pub is_active: bool,
    pub http_method: String,
    pub request_body: Option<String>,
    pub accepted_status_codes: String,
    pub ignore_tls_errors: bool,
    pub ssl_expires_at: Option<DateTime<Utc>>,
    pub throttle_seconds: i32,
    pub monitor_type: String,
    pub port: Option<i32>,
    pub dns_record_type: Option<String>,
    pub dns_resolve_server: Option<String>,
    pub dns_expected_result: Option<String>,
    pub db_connection_string: Option<String>,
    pub docker_container_id: Option<String>,
    #[sqlx(skip)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PingMetric {
    pub id: i64,
    pub endpoint_id: i64,
    pub status_code: Option<i32>,
    pub response_time_ms: i64,
    pub is_success: bool,
    pub checked_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StatusAlertLog {
    pub id: i64,
    pub endpoint_id: i64,
    pub previous_status: String,
    pub new_status: String,
    pub consecutive_failures: i32,
    pub alert_dispatched: bool,
    pub alerted_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, Default)]
pub struct IntegrationsSettings {
    pub id: i64,
    pub whatsapp_token: Option<String>,
    pub whatsapp_phone_number_id: Option<String>,
    pub whatsapp_to_number: Option<String>,
    pub whatsapp_template_name: Option<String>,
    pub whatsapp_enabled: bool,
    pub twilio_account_sid: Option<String>,
    pub twilio_auth_token: Option<String>,
    pub twilio_from_number: Option<String>,
    pub twilio_to_number: Option<String>,
    pub twilio_callback_url: Option<String>,
    pub twilio_enabled: bool,
    pub webhook_url: Option<String>,
    pub webhook_enabled: bool,
    pub slack_url: Option<String>,
    pub slack_enabled: bool,
    pub discord_url: Option<String>,
    pub discord_enabled: bool,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<i32>,
    pub smtp_username: Option<String>,
    pub smtp_password: Option<String>,
    pub smtp_from: Option<String>,
    pub smtp_to: Option<String>,
    pub smtp_enabled: bool,
    pub webhook_method: String,
    pub webhook_headers: Option<String>,
    pub webhook_body_template: Option<String>,
    pub updated_at: DateTime<Utc>,
}
