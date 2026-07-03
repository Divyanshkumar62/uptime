use crate::api::AppState;
use crate::api::auth::ApiKeyAuth;
use crate::db::models::Endpoint;
use crate::db::repository;
use axum::{
    Json,
    extract::{Path, Query, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Clone, Default)]
pub struct CreateEndpointDto {
    pub url: String,
    pub headers: Option<String>,
    pub interval_seconds: Option<i32>,
    pub timeout_seconds: Option<i32>,
    pub retry_interval_seconds: Option<i32>,
    pub consecutive_failure_threshold: Option<i32>,
    pub jitter_ratio: Option<f64>,
    pub json_validation_keys: Option<Vec<String>>,
    pub http_method: Option<String>,
    pub request_body: Option<String>,
    pub accepted_status_codes: Option<String>,
    pub ignore_tls_errors: Option<bool>,
    pub tags: Option<Vec<String>>,
    pub throttle_seconds: Option<i32>,
    pub monitor_type: Option<String>,
    pub port: Option<i32>,
    pub dns_record_type: Option<String>,
    pub dns_resolve_server: Option<String>,
    pub dns_expected_result: Option<String>,
    pub db_connection_string: Option<String>,
    pub docker_container_id: Option<String>,
}

#[derive(Deserialize, Serialize, Clone, Default)]
pub struct UpdateEndpointDto {
    pub url: String,
    pub headers: Option<String>,
    pub interval_seconds: Option<i32>,
    pub timeout_seconds: Option<i32>,
    pub retry_interval_seconds: Option<i32>,
    pub consecutive_failure_threshold: Option<i32>,
    pub jitter_ratio: Option<f64>,
    pub json_validation_keys: Option<Vec<String>>,
    pub is_active: bool,
    pub http_method: Option<String>,
    pub request_body: Option<String>,
    pub accepted_status_codes: Option<String>,
    pub ignore_tls_errors: Option<bool>,
    pub tags: Option<Vec<String>>,
    pub throttle_seconds: Option<i32>,
    pub monitor_type: Option<String>,
    pub port: Option<i32>,
    pub dns_record_type: Option<String>,
    pub dns_resolve_server: Option<String>,
    pub dns_expected_result: Option<String>,
    pub db_connection_string: Option<String>,
    pub docker_container_id: Option<String>,
}

#[derive(Deserialize)]
pub struct LatencyQuery {
    pub since_hours: Option<i64>,
}

#[derive(Serialize, Deserialize)]
pub struct LatencyResponse {
    pub p99_latency_ms: i64,
    pub history: Vec<crate::db::models::PingMetric>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct IntegrationsSettingsDto {
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
    pub webhook_method: Option<String>,
    pub webhook_headers: Option<String>,
    pub webhook_body_template: Option<String>,
}

#[derive(Deserialize)]
pub struct IncidentsQuery {
    pub limit: Option<i64>,
}

fn validate_http_method(method: &str) -> Result<(), String> {
    let m = method.to_uppercase();
    match m.as_str() {
        "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" => Ok(()),
        _ => Err(format!("Unsupported HTTP method: {}", method)),
    }
}

fn validate_request_body(body: &str) -> Result<(), String> {
    if body.len() > 102400 {
        return Err("Request body size exceeds 100KB limit".to_string());
    }
    if serde_json::from_str::<serde_json::Value>(body).is_err() {
        return Err("Request body must be a valid JSON representation".to_string());
    }
    Ok(())
}

fn validate_accepted_status_codes(codes: &str) -> Result<(), String> {
    for entry in codes.split(',') {
        let entry = entry.trim();
        if entry.is_empty() {
            return Err("Empty entry in accepted status codes".to_string());
        }
        if entry.contains('-') {
            let parts: Vec<&str> = entry.split('-').collect();
            if parts.len() != 2 {
                return Err("Invalid status code range format".to_string());
            }
            let start = parts[0]
                .trim()
                .parse::<u16>()
                .map_err(|_| "Invalid status code in range".to_string())?;
            let end = parts[1]
                .trim()
                .parse::<u16>()
                .map_err(|_| "Invalid status code in range".to_string())?;
            if start > end || start < 100 || end > 599 {
                return Err("Invalid status code range values".to_string());
            }
        } else {
            let val = entry
                .parse::<u16>()
                .map_err(|_| format!("Invalid status code: {}", entry))?;
            if !(100..=599).contains(&val) {
                return Err("Status code out of range (100-599)".to_string());
            }
        }
    }
    Ok(())
}

fn validate_dto_by_type(
    monitor_type: &str,
    port: Option<i32>,
    dns_record_type: Option<&str>,
    dns_resolve_server: Option<&str>,
    dns_expected_result: Option<&str>,
    db_connection_string: Option<&str>,
    docker_container_id: Option<&str>,
) -> Result<(), String> {
    match monitor_type {
        "TCP" => {
            let p = port.ok_or_else(|| "Port is required for TCP monitors".to_string())?;
            if !(1..=65535).contains(&p) {
                return Err("Port must be between 1 and 65535".to_string());
            }
        }
        "DNS" => {
            let r_type = dns_record_type
                .ok_or_else(|| "DNS record type is required".to_string())?
                .to_uppercase();
            if !["A", "AAAA", "CNAME", "MX", "TXT"].contains(&r_type.as_str()) {
                return Err("Unsupported DNS record type".to_string());
            }
            if dns_resolve_server
                .ok_or_else(|| "DNS resolver nameserver is required".to_string())?
                .is_empty()
            {
                return Err("DNS resolve nameserver cannot be empty".to_string());
            }
            if dns_expected_result
                .ok_or_else(|| "DNS expected result is required".to_string())?
                .is_empty()
            {
                return Err("DNS expected result cannot be empty".to_string());
            }
        }
        "POSTGRES" | "MYSQL" | "REDIS" => {
            let db_conn = db_connection_string
                .ok_or_else(|| "Database connection string is required".to_string())?;
            if db_conn.trim().is_empty() {
                return Err("Database connection string cannot be empty".to_string());
            }
        }
        "DOCKER" => {
            let container_id =
                docker_container_id.ok_or_else(|| "Docker container ID is required".to_string())?;
            if container_id.trim().is_empty() {
                return Err("Docker container ID cannot be empty".to_string());
            }
        }
        "HTTP" => {}
        _ => {
            return Err("Unsupported monitor type".to_string());
        }
    }
    Ok(())
}

fn mask_endpoint_secrets(endpoint: &mut Endpoint) {
    if endpoint.db_connection_string.is_some() {
        endpoint.db_connection_string = Some("********".to_string());
    }
}

fn validate_endpoint_config(
    url: &str,
    headers: &str,
    interval: i32,
    timeout: i32,
    threshold: i32,
    jitter: f64,
    monitor_type: &str,
) -> Result<(), String> {
    if monitor_type == "HTTP" && !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("URL must start with http:// or https://".to_string());
    }
    if url.trim().is_empty() {
        return Err("URL/Target cannot be empty".to_string());
    }
    if serde_json::from_str::<serde_json::Value>(headers).is_err() {
        return Err("Headers must be a valid JSON representation".to_string());
    }
    if !(15..=3600).contains(&interval) {
        return Err("Interval seconds must be between 15 and 3600".to_string());
    }
    if timeout <= 0 || timeout > 10 {
        return Err("Timeout seconds must be between 1 and 10".to_string());
    }
    if threshold <= 0 {
        return Err("Consecutive failure threshold must be greater than 0".to_string());
    }
    if !(0.0..=1.0).contains(&jitter) {
        return Err("Jitter ratio must be between 0.0 and 1.0".to_string());
    }
    Ok(())
}

pub async fn create_endpoint_handler(
    _auth: ApiKeyAuth,
    State(state): State<AppState>,
    Json(payload): Json<CreateEndpointDto>,
) -> Result<Json<Endpoint>, (StatusCode, String)> {
    let headers = payload.headers.unwrap_or_else(|| "{}".to_string());
    let interval = payload.interval_seconds.unwrap_or(60);
    let timeout = payload.timeout_seconds.unwrap_or(10);
    let retry_interval = payload.retry_interval_seconds.unwrap_or(15);
    let threshold = payload.consecutive_failure_threshold.unwrap_or(3);
    let jitter = payload.jitter_ratio.unwrap_or(0.20);

    let monitor_type = payload
        .monitor_type
        .clone()
        .unwrap_or_else(|| "HTTP".to_string())
        .to_uppercase();

    if let Err(err) = validate_endpoint_config(
        &payload.url,
        &headers,
        interval,
        timeout,
        threshold,
        jitter,
        &monitor_type,
    ) {
        return Err((StatusCode::BAD_REQUEST, err));
    }

    let http_method = payload
        .http_method
        .clone()
        .unwrap_or_else(|| "GET".to_string())
        .to_uppercase();
    if let Err(err) = validate_http_method(&http_method) {
        return Err((StatusCode::BAD_REQUEST, err));
    }

    let accepted_status_codes = payload
        .accepted_status_codes
        .clone()
        .unwrap_or_else(|| "200-299".to_string());
    if let Err(err) = validate_accepted_status_codes(&accepted_status_codes) {
        return Err((StatusCode::BAD_REQUEST, err));
    }

    if let Some(body) = &payload.request_body {
        validate_request_body(body).map_err(|err| (StatusCode::BAD_REQUEST, err))?;
    }

    let json_keys_str = payload
        .json_validation_keys
        .and_then(|keys| serde_json::to_string(&keys).ok());

    let throttle_seconds = payload.throttle_seconds.unwrap_or(900);
    if throttle_seconds < 0 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Throttle seconds must be non-negative".to_string(),
        ));
    }

    if let Err(err) = validate_dto_by_type(
        &monitor_type,
        payload.port,
        payload.dns_record_type.as_deref(),
        payload.dns_resolve_server.as_deref(),
        payload.dns_expected_result.as_deref(),
        payload.db_connection_string.as_deref(),
        payload.docker_container_id.as_deref(),
    ) {
        return Err((StatusCode::BAD_REQUEST, err));
    }

    let encrypted_db_conn = match payload.db_connection_string.as_deref() {
        Some(conn) if !conn.is_empty() => {
            let enc = crate::db::crypto::encrypt_secret(conn).map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Encryption failed: {}", e),
                )
            })?;
            Some(enc)
        }
        _ => None,
    };

    let mut endpoint = repository::create_endpoint(
        &state.pool,
        &payload.url,
        &headers,
        interval,
        timeout,
        retry_interval,
        threshold,
        jitter,
        json_keys_str.as_deref(),
        &http_method,
        payload.request_body.as_deref(),
        &accepted_status_codes,
        payload.ignore_tls_errors.unwrap_or(false),
        throttle_seconds,
        &monitor_type,
        payload.port,
        payload.dns_record_type.as_deref(),
        payload.dns_resolve_server.as_deref(),
        payload.dns_expected_result.as_deref(),
        encrypted_db_conn.as_deref(),
        payload.docker_container_id.as_deref(),
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(tags) = &payload.tags {
        repository::set_endpoint_tags(&state.pool, endpoint.id, tags)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        endpoint.tags = Some(tags.clone());
    } else {
        endpoint.tags = Some(Vec::new());
    }

    mask_endpoint_secrets(&mut endpoint);
    Ok(Json(endpoint))
}

#[derive(Deserialize)]
pub struct ListEndpointsQuery {
    pub tag: Option<String>,
}

pub async fn list_endpoints_handler(
    _auth: ApiKeyAuth,
    Query(query): Query<ListEndpointsQuery>,
    State(state): State<AppState>,
) -> Result<Json<Vec<Endpoint>>, (StatusCode, String)> {
    let mut endpoints = repository::list_endpoints(&state.pool, query.tag.as_deref())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    for ep in &mut endpoints {
        let tags = repository::get_endpoint_tags(&state.pool, ep.id)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        ep.tags = Some(tags);
        mask_endpoint_secrets(ep);
    }

    Ok(Json(endpoints))
}

pub async fn get_endpoint_handler(
    _auth: ApiKeyAuth,
    Path(id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<Endpoint>, (StatusCode, String)> {
    let mut endpoint = repository::get_endpoint(&state.pool, id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Endpoint not found".to_string()))?;

    let tags = repository::get_endpoint_tags(&state.pool, id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    endpoint.tags = Some(tags);

    mask_endpoint_secrets(&mut endpoint);
    Ok(Json(endpoint))
}

pub async fn update_endpoint_handler(
    _auth: ApiKeyAuth,
    Path(id): Path<i64>,
    State(state): State<AppState>,
    Json(payload): Json<UpdateEndpointDto>,
) -> Result<Json<Endpoint>, (StatusCode, String)> {
    let headers = payload.headers.unwrap_or_else(|| "{}".to_string());
    let interval = payload.interval_seconds.unwrap_or(60);
    let timeout = payload.timeout_seconds.unwrap_or(10);
    let retry_interval = payload.retry_interval_seconds.unwrap_or(15);
    let threshold = payload.consecutive_failure_threshold.unwrap_or(3);
    let jitter = payload.jitter_ratio.unwrap_or(0.20);

    let monitor_type = payload
        .monitor_type
        .clone()
        .unwrap_or_else(|| "HTTP".to_string())
        .to_uppercase();

    if let Err(err) = validate_endpoint_config(
        &payload.url,
        &headers,
        interval,
        timeout,
        threshold,
        jitter,
        &monitor_type,
    ) {
        return Err((StatusCode::BAD_REQUEST, err));
    }

    let http_method = payload
        .http_method
        .clone()
        .unwrap_or_else(|| "GET".to_string())
        .to_uppercase();
    if let Err(err) = validate_http_method(&http_method) {
        return Err((StatusCode::BAD_REQUEST, err));
    }

    let accepted_status_codes = payload
        .accepted_status_codes
        .clone()
        .unwrap_or_else(|| "200-299".to_string());
    if let Err(err) = validate_accepted_status_codes(&accepted_status_codes) {
        return Err((StatusCode::BAD_REQUEST, err));
    }

    if let Some(body) = &payload.request_body {
        validate_request_body(body).map_err(|err| (StatusCode::BAD_REQUEST, err))?;
    }

    let json_keys_str = payload
        .json_validation_keys
        .and_then(|keys| serde_json::to_string(&keys).ok());

    let current_endpoint = repository::get_endpoint(&state.pool, id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Endpoint not found".to_string()))?;

    let throttle_seconds = payload.throttle_seconds.unwrap_or(900);
    if throttle_seconds < 0 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Throttle seconds must be non-negative".to_string(),
        ));
    }

    if let Err(err) = validate_dto_by_type(
        &monitor_type,
        payload.port,
        payload.dns_record_type.as_deref(),
        payload.dns_resolve_server.as_deref(),
        payload.dns_expected_result.as_deref(),
        payload.db_connection_string.as_deref(),
        payload.docker_container_id.as_deref(),
    ) {
        return Err((StatusCode::BAD_REQUEST, err));
    }

    let encrypted_db_conn = match payload.db_connection_string.as_deref() {
        Some("********") => current_endpoint.db_connection_string,
        Some(conn) if !conn.is_empty() => {
            let enc = crate::db::crypto::encrypt_secret(conn).map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Encryption failed: {}", e),
                )
            })?;
            Some(enc)
        }
        _ => None,
    };

    let mut endpoint = repository::update_endpoint(
        &state.pool,
        id,
        &payload.url,
        &headers,
        interval,
        timeout,
        retry_interval,
        threshold,
        jitter,
        json_keys_str.as_deref(),
        payload.is_active,
        &http_method,
        payload.request_body.as_deref(),
        &accepted_status_codes,
        payload.ignore_tls_errors.unwrap_or(false),
        throttle_seconds,
        &monitor_type,
        payload.port,
        payload.dns_record_type.as_deref(),
        payload.dns_resolve_server.as_deref(),
        payload.dns_expected_result.as_deref(),
        encrypted_db_conn.as_deref(),
        payload.docker_container_id.as_deref(),
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(tags) = &payload.tags {
        repository::set_endpoint_tags(&state.pool, id, tags)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        endpoint.tags = Some(tags.clone());
    } else {
        let tags = repository::get_endpoint_tags(&state.pool, id)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        endpoint.tags = Some(tags);
    }

    mask_endpoint_secrets(&mut endpoint);
    Ok(Json(endpoint))
}

pub async fn delete_endpoint_handler(
    _auth: ApiKeyAuth,
    Path(id): Path<i64>,
    State(state): State<AppState>,
) -> Result<StatusCode, (StatusCode, String)> {
    repository::delete_endpoint(&state.pool, id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_latency_handler(
    _auth: ApiKeyAuth,
    Path(id): Path<i64>,
    Query(query): Query<LatencyQuery>,
    State(state): State<AppState>,
) -> Result<Json<LatencyResponse>, (StatusCode, String)> {
    // Default to 30 days history (720 hours)
    let hours = query.since_hours.unwrap_or(720);
    let since = chrono::Utc::now() - chrono::Duration::hours(hours);

    // Retrieve ping metrics detailed history sorted DESC
    let history = repository::get_ping_metrics(&state.pool, id, since)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Extract response times and sort ASC in memory for p99 calculation
    let mut response_times: Vec<i64> = history.iter().map(|m| m.response_time_ms).collect();
    response_times.sort_unstable();

    let p99_latency_ms = crate::monitoring::latency::calculate_p99_latency(&response_times);

    Ok(Json(LatencyResponse {
        p99_latency_ms,
        history,
    }))
}

pub async fn twilio_twiml_handler() -> impl IntoResponse {
    let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Alert: One of your monitored microservices has gone down. Please check the dashboard immediately.</Say>
</Response>"#;

    Response::builder()
        .header(header::CONTENT_TYPE, "text/xml")
        .body(xml.to_string())
        .unwrap()
}

pub async fn get_integrations_settings_handler(
    _auth: ApiKeyAuth,
    State(state): State<AppState>,
) -> Result<Json<IntegrationsSettingsDto>, (StatusCode, String)> {
    let settings = repository::get_integrations_settings(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Mask sensitive fields
    let whatsapp_token = settings.whatsapp_token.map(|t| {
        if t.is_empty() {
            t
        } else {
            "********".to_string()
        }
    });
    let twilio_auth_token = settings.twilio_auth_token.map(|t| {
        if t.is_empty() {
            t
        } else {
            "********".to_string()
        }
    });
    let webhook_url = settings.webhook_url.map(|t| {
        if t.is_empty() {
            t
        } else {
            "********".to_string()
        }
    });
    let slack_url = settings.slack_url.map(|t| {
        if t.is_empty() {
            t
        } else {
            "********".to_string()
        }
    });
    let discord_url = settings.discord_url.map(|t| {
        if t.is_empty() {
            t
        } else {
            "********".to_string()
        }
    });
    let smtp_password = settings.smtp_password.map(|t| {
        if t.is_empty() {
            t
        } else {
            "********".to_string()
        }
    });

    Ok(Json(IntegrationsSettingsDto {
        whatsapp_token,
        whatsapp_phone_number_id: settings.whatsapp_phone_number_id,
        whatsapp_to_number: settings.whatsapp_to_number,
        whatsapp_template_name: settings.whatsapp_template_name,
        whatsapp_enabled: settings.whatsapp_enabled,
        twilio_account_sid: settings.twilio_account_sid,
        twilio_auth_token,
        twilio_from_number: settings.twilio_from_number,
        twilio_to_number: settings.twilio_to_number,
        twilio_callback_url: settings.twilio_callback_url,
        twilio_enabled: settings.twilio_enabled,
        webhook_url,
        webhook_enabled: settings.webhook_enabled,
        slack_url,
        slack_enabled: settings.slack_enabled,
        discord_url,
        discord_enabled: settings.discord_enabled,
        smtp_host: settings.smtp_host,
        smtp_port: settings.smtp_port,
        smtp_username: settings.smtp_username,
        smtp_password,
        smtp_from: settings.smtp_from,
        smtp_to: settings.smtp_to,
        smtp_enabled: settings.smtp_enabled,
        webhook_method: Some(settings.webhook_method),
        webhook_headers: settings.webhook_headers,
        webhook_body_template: settings.webhook_body_template,
    }))
}

pub async fn update_integrations_settings_handler(
    _auth: ApiKeyAuth,
    State(state): State<AppState>,
    Json(payload): Json<IntegrationsSettingsDto>,
) -> Result<Json<IntegrationsSettingsDto>, (StatusCode, String)> {
    let current = repository::get_integrations_settings(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let final_whatsapp_token = match payload.whatsapp_token {
        Some(ref t) if t == "********" => current.whatsapp_token,
        other => other,
    };

    let final_twilio_auth_token = match payload.twilio_auth_token {
        Some(ref t) if t == "********" => current.twilio_auth_token,
        other => other,
    };

    let final_webhook_url = match payload.webhook_url {
        Some(ref t) if t == "********" => current.webhook_url,
        other => other,
    };

    let final_slack_url = match payload.slack_url {
        Some(ref t) if t == "********" => current.slack_url,
        other => other,
    };

    let final_discord_url = match payload.discord_url {
        Some(ref t) if t == "********" => current.discord_url,
        other => other,
    };

    let final_smtp_password = match payload.smtp_password {
        Some(ref t) if t == "********" => current.smtp_password,
        other => other,
    };

    let webhook_method = payload.webhook_method.unwrap_or_else(|| "POST".to_string());

    let updated = repository::update_integrations_settings(
        &state.pool,
        final_whatsapp_token.as_deref(),
        payload.whatsapp_phone_number_id.as_deref(),
        payload.whatsapp_to_number.as_deref(),
        payload.whatsapp_template_name.as_deref(),
        payload.whatsapp_enabled,
        payload.twilio_account_sid.as_deref(),
        final_twilio_auth_token.as_deref(),
        payload.twilio_from_number.as_deref(),
        payload.twilio_to_number.as_deref(),
        payload.twilio_callback_url.as_deref(),
        payload.twilio_enabled,
        final_webhook_url.as_deref(),
        payload.webhook_enabled,
        final_slack_url.as_deref(),
        payload.slack_enabled,
        final_discord_url.as_deref(),
        payload.discord_enabled,
        payload.smtp_host.as_deref(),
        payload.smtp_port,
        payload.smtp_username.as_deref(),
        final_smtp_password.as_deref(),
        payload.smtp_from.as_deref(),
        payload.smtp_to.as_deref(),
        payload.smtp_enabled,
        &webhook_method,
        payload.webhook_headers.as_deref(),
        payload.webhook_body_template.as_deref(),
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let whatsapp_token_masked = updated.whatsapp_token.map(|t| {
        if t.is_empty() {
            t
        } else {
            "********".to_string()
        }
    });
    let twilio_auth_token_masked = updated.twilio_auth_token.map(|t| {
        if t.is_empty() {
            t
        } else {
            "********".to_string()
        }
    });
    let webhook_url_masked = updated.webhook_url.map(|t| {
        if t.is_empty() {
            t
        } else {
            "********".to_string()
        }
    });
    let slack_url_masked = updated.slack_url.map(|t| {
        if t.is_empty() {
            t
        } else {
            "********".to_string()
        }
    });
    let discord_url_masked = updated.discord_url.map(|t| {
        if t.is_empty() {
            t
        } else {
            "********".to_string()
        }
    });
    let smtp_password_masked = updated.smtp_password.map(|t| {
        if t.is_empty() {
            t
        } else {
            "********".to_string()
        }
    });

    Ok(Json(IntegrationsSettingsDto {
        whatsapp_token: whatsapp_token_masked,
        whatsapp_phone_number_id: updated.whatsapp_phone_number_id,
        whatsapp_to_number: updated.whatsapp_to_number,
        whatsapp_template_name: updated.whatsapp_template_name,
        whatsapp_enabled: updated.whatsapp_enabled,
        twilio_account_sid: updated.twilio_account_sid,
        twilio_auth_token: twilio_auth_token_masked,
        twilio_from_number: updated.twilio_from_number,
        twilio_to_number: updated.twilio_to_number,
        twilio_callback_url: updated.twilio_callback_url,
        twilio_enabled: updated.twilio_enabled,
        webhook_url: webhook_url_masked,
        webhook_enabled: updated.webhook_enabled,
        slack_url: slack_url_masked,
        slack_enabled: updated.slack_enabled,
        discord_url: discord_url_masked,
        discord_enabled: updated.discord_enabled,
        smtp_host: updated.smtp_host,
        smtp_port: updated.smtp_port,
        smtp_username: updated.smtp_username,
        smtp_password: smtp_password_masked,
        smtp_from: updated.smtp_from,
        smtp_to: updated.smtp_to,
        smtp_enabled: updated.smtp_enabled,
        webhook_method: Some(updated.webhook_method),
        webhook_headers: updated.webhook_headers,
        webhook_body_template: updated.webhook_body_template,
    }))
}

pub async fn get_incidents_handler(
    _auth: ApiKeyAuth,
    Query(query): Query<IncidentsQuery>,
    State(state): State<AppState>,
) -> Result<Json<Vec<crate::db::models::PingMetric>>, (StatusCode, String)> {
    let limit = query.limit.unwrap_or(50);
    let clamped_limit = if limit > 100 {
        100
    } else if limit <= 0 {
        50
    } else {
        limit
    };

    let incidents = repository::get_recent_incidents(&state.pool, clamped_limit)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(incidents))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::AppState;
    use crate::db::init_db;
    use axum::Router;
    use axum::http::{Request, StatusCode};
    use axum::routing::{get, post};
    use tower::util::ServiceExt;

    async fn setup_test_app() -> (Router, crate::db::DbPool) {
        unsafe {
            std::env::set_var("ADMIN_API_KEY", "test-secret-key");
            std::env::set_var(
                "ENCRYPTION_KEY_SECRET",
                "deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567",
            );
        }
        let pool = init_db("sqlite::memory:").await.unwrap();
        let (tx, _rx) = tokio::sync::broadcast::channel(100);
        let state = AppState {
            pool: pool.clone(),
            tx,
        };

        let app = Router::new()
            .route(
                "/api/endpoints",
                post(create_endpoint_handler).get(list_endpoints_handler),
            )
            .route(
                "/api/endpoints/:id",
                get(get_endpoint_handler)
                    .put(update_endpoint_handler)
                    .delete(delete_endpoint_handler),
            )
            .route("/api/endpoints/:id/latency", get(get_latency_handler))
            .route("/api/incidents", get(get_incidents_handler))
            .route(
                "/api/settings/integrations",
                get(get_integrations_settings_handler).put(update_integrations_settings_handler),
            )
            .route(
                "/api/alerts/twilio-twiml",
                get(twilio_twiml_handler).post(twilio_twiml_handler),
            )
            .with_state(state);

        (app, pool)
    }

    #[tokio::test]
    async fn test_create_endpoint_route_success() {
        let (app, _) = setup_test_app().await;

        let payload = CreateEndpointDto {
            url: "https://api.test.com/health".to_string(),
            headers: Some("{\"X-Test\":\"Val\"}".to_string()),
            interval_seconds: Some(30),
            timeout_seconds: Some(5),
            retry_interval_seconds: Some(10),
            consecutive_failure_threshold: Some(3),
            jitter_ratio: Some(0.15),
            json_validation_keys: Some(vec!["status".to_string()]),
            http_method: Some("GET".to_string()),
            request_body: None,
            accepted_status_codes: Some("200-299".to_string()),
            ignore_tls_errors: Some(false),
            tags: Some(vec!["test".to_string()]),
            throttle_seconds: Some(900),
            ..Default::default()
        };

        let req = Request::builder()
            .method("POST")
            .uri("/api/endpoints")
            .header("X-API-Key", "test-secret-key")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_string(&payload).unwrap(),
            ))
            .unwrap();

        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_create_endpoint_route_invalid_url() {
        let (app, _) = setup_test_app().await;

        let payload = CreateEndpointDto {
            url: "invalid-url-no-http".to_string(),
            headers: None,
            interval_seconds: None,
            timeout_seconds: None,
            retry_interval_seconds: None,
            consecutive_failure_threshold: None,
            jitter_ratio: None,
            json_validation_keys: None,
            http_method: None,
            request_body: None,
            accepted_status_codes: None,
            ignore_tls_errors: None,
            tags: None,
            throttle_seconds: None,
            ..Default::default()
        };

        let req = Request::builder()
            .method("POST")
            .uri("/api/endpoints")
            .header("X-API-Key", "test-secret-key")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_string(&payload).unwrap(),
            ))
            .unwrap();

        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_crud_lifecycle() {
        let (app, pool) = setup_test_app().await;

        // 1. Create an endpoint
        let endpoint = repository::create_endpoint(
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

        // 2. GET the list
        let req = Request::builder()
            .uri("/api/endpoints")
            .header("X-API-Key", "test-secret-key")
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        // 3. GET single endpoint
        let req = Request::builder()
            .uri(format!("/api/endpoints/{}", endpoint.id))
            .header("X-API-Key", "test-secret-key")
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        // 4. PUT update endpoint
        let payload = UpdateEndpointDto {
            url: "http://newexample.com".to_string(),
            headers: Some("{}".to_string()),
            interval_seconds: Some(45),
            timeout_seconds: Some(8),
            retry_interval_seconds: Some(12),
            consecutive_failure_threshold: Some(4),
            jitter_ratio: Some(0.10),
            json_validation_keys: None,
            is_active: false,
            http_method: Some("GET".to_string()),
            request_body: None,
            accepted_status_codes: Some("200-299".to_string()),
            ignore_tls_errors: Some(false),
            tags: Some(vec!["test".to_string()]),
            throttle_seconds: Some(900),
            ..Default::default()
        };
        let req = Request::builder()
            .method("PUT")
            .uri(format!("/api/endpoints/{}", endpoint.id))
            .header("X-API-Key", "test-secret-key")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_string(&payload).unwrap(),
            ))
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        // 5. DELETE endpoint
        let req = Request::builder()
            .method("DELETE")
            .uri(format!("/api/endpoints/{}", endpoint.id))
            .header("X-API-Key", "test-secret-key")
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::NO_CONTENT);
    }

    #[tokio::test]
    async fn test_twilio_twiml_webhook_route() {
        let (app, _) = setup_test_app().await;

        let req = Request::builder()
            .uri("/api/alerts/twilio-twiml")
            .body(axum::body::Body::empty())
            .unwrap();

        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        assert_eq!(
            res.headers().get("Content-Type").unwrap().to_str().unwrap(),
            "text/xml"
        );
    }

    #[tokio::test]
    async fn test_get_latency_route() {
        let (app, pool) = setup_test_app().await;

        // Create an endpoint
        let endpoint = repository::create_endpoint(
            &pool,
            "http://example.com/latency",
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

        // Insert some ping metrics
        repository::log_ping_metric(&pool, endpoint.id, Some(200), 50, true)
            .await
            .unwrap();
        repository::log_ping_metric(&pool, endpoint.id, Some(200), 100, true)
            .await
            .unwrap();
        repository::log_ping_metric(&pool, endpoint.id, Some(200), 150, true)
            .await
            .unwrap();

        // GET latency stats
        let req = Request::builder()
            .uri(format!("/api/endpoints/{}/latency", endpoint.id))
            .header("X-API-Key", "test-secret-key")
            .body(axum::body::Body::empty())
            .unwrap();

        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        let body = axum::body::to_bytes(res.into_body(), 10000).await.unwrap();
        let resp: LatencyResponse = serde_json::from_slice(&body).unwrap();

        assert_eq!(resp.p99_latency_ms, 150);
        assert_eq!(resp.history.len(), 3);
        assert_eq!(resp.history[0].response_time_ms, 150);
        assert_eq!(resp.history[1].response_time_ms, 100);
        assert_eq!(resp.history[2].response_time_ms, 50);
    }

    #[tokio::test]
    async fn test_integrations_settings_route() {
        let (app, _) = setup_test_app().await;

        // 1. GET settings returns the default seed
        let req = Request::builder()
            .uri("/api/settings/integrations")
            .header("X-API-Key", "test-secret-key")
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        let body = axum::body::to_bytes(res.into_body(), 10000).await.unwrap();
        let resp: IntegrationsSettingsDto = serde_json::from_slice(&body).unwrap();
        assert!(!resp.whatsapp_enabled);
        assert!(!resp.twilio_enabled);
        assert!(!resp.webhook_enabled);
        assert_eq!(resp.whatsapp_token, None);

        // 2. PUT updates settings
        let payload = IntegrationsSettingsDto {
            whatsapp_token: Some("secret_whatsapp_token".to_string()),
            whatsapp_phone_number_id: Some("12345".to_string()),
            whatsapp_to_number: Some("67890".to_string()),
            whatsapp_template_name: Some("test_template".to_string()),
            whatsapp_enabled: true,
            twilio_account_sid: Some("twilio_sid".to_string()),
            twilio_auth_token: Some("secret_twilio_token".to_string()),
            twilio_from_number: Some("111".to_string()),
            twilio_to_number: Some("222".to_string()),
            twilio_callback_url: Some("http://callback".to_string()),
            twilio_enabled: true,
            webhook_url: Some("http://webhook".to_string()),
            webhook_enabled: true,
            slack_url: Some("http://slack".to_string()),
            slack_enabled: true,
            discord_url: Some("http://discord".to_string()),
            discord_enabled: true,
            smtp_host: Some("smtp.test.com".to_string()),
            smtp_port: Some(587),
            smtp_username: Some("user".to_string()),
            smtp_password: Some("secret_smtp_password".to_string()),
            smtp_from: Some("from@test.com".to_string()),
            smtp_to: Some("to@test.com".to_string()),
            smtp_enabled: true,
            webhook_method: Some("POST".to_string()),
            webhook_headers: Some("{}".to_string()),
            webhook_body_template: Some("{}".to_string()),
        };

        let req = Request::builder()
            .method("PUT")
            .uri("/api/settings/integrations")
            .header("X-API-Key", "test-secret-key")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_string(&payload).unwrap(),
            ))
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        let body = axum::body::to_bytes(res.into_body(), 10000).await.unwrap();
        let resp: IntegrationsSettingsDto = serde_json::from_slice(&body).unwrap();
        assert!(resp.whatsapp_enabled);
        assert_eq!(resp.whatsapp_token, Some("********".to_string()));
        assert_eq!(resp.twilio_auth_token, Some("********".to_string()));
        assert_eq!(resp.webhook_url, Some("********".to_string()));
        assert_eq!(resp.slack_url, Some("********".to_string()));
        assert_eq!(resp.discord_url, Some("********".to_string()));
        assert_eq!(resp.smtp_password, Some("********".to_string()));
        assert_eq!(resp.whatsapp_phone_number_id, Some("12345".to_string()));

        // 3. PUT with masked value preserves secret in DB
        let payload_masked = IntegrationsSettingsDto {
            whatsapp_token: Some("********".to_string()),
            whatsapp_phone_number_id: Some("12345-updated".to_string()),
            whatsapp_to_number: Some("67890".to_string()),
            whatsapp_template_name: Some("test_template".to_string()),
            whatsapp_enabled: true,
            twilio_account_sid: Some("twilio_sid".to_string()),
            twilio_auth_token: Some("********".to_string()),
            twilio_from_number: Some("111".to_string()),
            twilio_to_number: Some("222".to_string()),
            twilio_callback_url: Some("http://callback".to_string()),
            twilio_enabled: true,
            webhook_url: Some("********".to_string()),
            webhook_enabled: true,
            slack_url: Some("********".to_string()),
            slack_enabled: true,
            discord_url: Some("********".to_string()),
            discord_enabled: true,
            smtp_host: Some("smtp.test.com".to_string()),
            smtp_port: Some(587),
            smtp_username: Some("user".to_string()),
            smtp_password: Some("********".to_string()),
            smtp_from: Some("from@test.com".to_string()),
            smtp_to: Some("to@test.com".to_string()),
            smtp_enabled: true,
            webhook_method: Some("POST".to_string()),
            webhook_headers: Some("{}".to_string()),
            webhook_body_template: Some("{}".to_string()),
        };

        let req = Request::builder()
            .method("PUT")
            .uri("/api/settings/integrations")
            .header("X-API-Key", "test-secret-key")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_string(&payload_masked).unwrap(),
            ))
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        let body = axum::body::to_bytes(res.into_body(), 10000).await.unwrap();
        let resp: IntegrationsSettingsDto = serde_json::from_slice(&body).unwrap();
        assert_eq!(
            resp.whatsapp_phone_number_id,
            Some("12345-updated".to_string())
        );
        assert_eq!(resp.whatsapp_token, Some("********".to_string()));
    }

    #[tokio::test]
    async fn test_get_incidents_route() {
        let (app, pool) = setup_test_app().await;

        // Create an endpoint
        let endpoint = repository::create_endpoint(
            &pool,
            "http://example.com/incidents",
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

        // Log success check
        repository::log_ping_metric(&pool, endpoint.id, Some(200), 50, true)
            .await
            .unwrap();
        // Log failure check
        repository::log_ping_metric(&pool, endpoint.id, Some(500), 100, false)
            .await
            .unwrap();
        // Log another failure check
        repository::log_ping_metric(&pool, endpoint.id, Some(503), 150, false)
            .await
            .unwrap();

        // GET recent incidents (default limit = 50)
        let req = Request::builder()
            .uri("/api/incidents")
            .header("X-API-Key", "test-secret-key")
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        let body = axum::body::to_bytes(res.into_body(), 10000).await.unwrap();
        let resp: Vec<crate::db::models::PingMetric> = serde_json::from_slice(&body).unwrap();
        assert_eq!(resp.len(), 2);
        assert_eq!(resp[0].status_code, Some(503));
        assert_eq!(resp[1].status_code, Some(500));

        // GET recent incidents with limit=1
        let req = Request::builder()
            .uri("/api/incidents?limit=1")
            .header("X-API-Key", "test-secret-key")
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        let body = axum::body::to_bytes(res.into_body(), 10000).await.unwrap();
        let resp: Vec<crate::db::models::PingMetric> = serde_json::from_slice(&body).unwrap();
        assert_eq!(resp.len(), 1);
        assert_eq!(resp[0].status_code, Some(503));
    }

    #[tokio::test]
    async fn test_auth_enforcement_middleware() {
        let (app, _) = setup_test_app().await;

        // Call protected endpoint without auth header
        let req = Request::builder()
            .uri("/api/endpoints")
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

        let body = axum::body::to_bytes(res.into_body(), 10000).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["error"], "Unauthorized");
        assert_eq!(
            json["message"],
            "Missing, invalid, or expired session credentials."
        );
    }

    #[tokio::test]
    async fn test_create_endpoint_tcp_validation_success() {
        let (app, _) = setup_test_app().await;

        let payload = CreateEndpointDto {
            url: "127.0.0.1".to_string(),
            monitor_type: Some("TCP".to_string()),
            port: Some(8080),
            ..Default::default()
        };

        let req = Request::builder()
            .method("POST")
            .uri("/api/endpoints")
            .header("X-API-Key", "test-secret-key")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_string(&payload).unwrap(),
            ))
            .unwrap();

        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_create_endpoint_tcp_validation_missing_port() {
        let (app, _) = setup_test_app().await;

        let payload = CreateEndpointDto {
            url: "127.0.0.1".to_string(),
            monitor_type: Some("TCP".to_string()),
            port: None,
            ..Default::default()
        };

        let req = Request::builder()
            .method("POST")
            .uri("/api/endpoints")
            .header("X-API-Key", "test-secret-key")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_string(&payload).unwrap(),
            ))
            .unwrap();

        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_create_endpoint_dns_validation_missing_resolver() {
        let (app, _) = setup_test_app().await;

        let payload = CreateEndpointDto {
            url: "example.com".to_string(),
            monitor_type: Some("DNS".to_string()),
            dns_record_type: Some("A".to_string()),
            dns_resolve_server: None,
            dns_expected_result: Some("127.0.0.1".to_string()),
            ..Default::default()
        };

        let req = Request::builder()
            .method("POST")
            .uri("/api/endpoints")
            .header("X-API-Key", "test-secret-key")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_string(&payload).unwrap(),
            ))
            .unwrap();

        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_create_endpoint_postgres_validation_missing_conn_string() {
        let (app, _) = setup_test_app().await;

        let payload = CreateEndpointDto {
            url: "127.0.0.1".to_string(),
            monitor_type: Some("POSTGRES".to_string()),
            db_connection_string: None,
            ..Default::default()
        };

        let req = Request::builder()
            .method("POST")
            .uri("/api/endpoints")
            .header("X-API-Key", "test-secret-key")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_string(&payload).unwrap(),
            ))
            .unwrap();

        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_create_endpoint_docker_validation_missing_container_id() {
        let (app, _) = setup_test_app().await;

        let payload = CreateEndpointDto {
            url: "http://localhost:2375".to_string(),
            monitor_type: Some("DOCKER".to_string()),
            docker_container_id: None,
            ..Default::default()
        };

        let req = Request::builder()
            .method("POST")
            .uri("/api/endpoints")
            .header("X-API-Key", "test-secret-key")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_string(&payload).unwrap(),
            ))
            .unwrap();

        let res = app.oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_create_endpoint_postgres_masking_lifecycle() {
        let (app, pool) = setup_test_app().await;

        let payload = CreateEndpointDto {
            url: "127.0.0.1".to_string(),
            monitor_type: Some("POSTGRES".to_string()),
            db_connection_string: Some("postgres://user:pass@localhost:5432/db".to_string()),
            ..Default::default()
        };

        let req = Request::builder()
            .method("POST")
            .uri("/api/endpoints")
            .header("X-API-Key", "test-secret-key")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_string(&payload).unwrap(),
            ))
            .unwrap();

        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        let body_bytes = axum::body::to_bytes(res.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let created_ep: Endpoint = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(
            created_ep.db_connection_string,
            Some("********".to_string())
        );

        // Verify it is encrypted in database
        let db_row = sqlx::query_as::<_, Endpoint>("SELECT * FROM endpoints WHERE id = ?")
            .bind(created_ep.id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_ne!(
            db_row.db_connection_string,
            Some("postgres://user:pass@localhost:5432/db".to_string())
        );
        assert_ne!(db_row.db_connection_string, Some("********".to_string()));

        // Update with masked value, verify secret is preserved
        let update_payload = UpdateEndpointDto {
            url: "127.0.0.1".to_string(),
            monitor_type: Some("POSTGRES".to_string()),
            db_connection_string: Some("********".to_string()),
            is_active: true,
            ..Default::default()
        };

        let update_req = Request::builder()
            .method("PUT")
            .uri(format!("/api/endpoints/{}", created_ep.id))
            .header("X-API-Key", "test-secret-key")
            .header("Content-Type", "application/json")
            .body(axum::body::Body::from(
                serde_json::to_string(&update_payload).unwrap(),
            ))
            .unwrap();

        let update_res = app.oneshot(update_req).await.unwrap();
        assert_eq!(update_res.status(), StatusCode::OK);

        let updated_row = sqlx::query_as::<_, Endpoint>("SELECT * FROM endpoints WHERE id = ?")
            .bind(created_ep.id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(
            updated_row.db_connection_string,
            db_row.db_connection_string
        );
    }
}
