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

#[derive(Deserialize, Serialize)]
pub struct CreateEndpointDto {
    pub url: String,
    pub headers: Option<String>,
    pub interval_seconds: Option<i32>,
    pub timeout_seconds: Option<i32>,
    pub retry_interval_seconds: Option<i32>,
    pub consecutive_failure_threshold: Option<i32>,
    pub jitter_ratio: Option<f64>,
    pub json_validation_keys: Option<Vec<String>>,
}

#[derive(Deserialize, Serialize)]
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

fn validate_endpoint_config(
    url: &str,
    headers: &str,
    interval: i32,
    timeout: i32,
    threshold: i32,
    jitter: f64,
) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("URL must start with http:// or https://".to_string());
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

    if let Err(err) =
        validate_endpoint_config(&payload.url, &headers, interval, timeout, threshold, jitter)
    {
        return Err((StatusCode::BAD_REQUEST, err));
    }

    let json_keys_str = payload
        .json_validation_keys
        .and_then(|keys| serde_json::to_string(&keys).ok());

    let endpoint = repository::create_endpoint(
        &state.pool,
        &payload.url,
        &headers,
        interval,
        timeout,
        retry_interval,
        threshold,
        jitter,
        json_keys_str.as_deref(),
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(endpoint))
}

pub async fn list_endpoints_handler(
    _auth: ApiKeyAuth,
    State(state): State<AppState>,
) -> Result<Json<Vec<Endpoint>>, (StatusCode, String)> {
    // List all endpoints (both active and inactive)
    let endpoints = sqlx::query_as::<_, Endpoint>("SELECT * FROM endpoints")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(endpoints))
}

pub async fn get_endpoint_handler(
    _auth: ApiKeyAuth,
    Path(id): Path<i64>,
    State(state): State<AppState>,
) -> Result<Json<Endpoint>, (StatusCode, String)> {
    let endpoint = repository::get_endpoint(&state.pool, id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Endpoint not found".to_string()))?;

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

    if let Err(err) =
        validate_endpoint_config(&payload.url, &headers, interval, timeout, threshold, jitter)
    {
        return Err((StatusCode::BAD_REQUEST, err));
    }

    let json_keys_str = payload
        .json_validation_keys
        .and_then(|keys| serde_json::to_string(&keys).ok());

    let endpoint = repository::update_endpoint(
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
    )
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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
}
