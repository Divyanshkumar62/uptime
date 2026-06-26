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
