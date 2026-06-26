use axum::async_trait;
use axum::extract::FromRequestParts;
use axum::http::StatusCode;
use axum::http::request::Parts;

pub struct ApiKeyAuth;

#[async_trait]
impl<S> FromRequestParts<S> for ApiKeyAuth
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let expected_key =
            std::env::var("ADMIN_API_KEY").unwrap_or_else(|_| "admin-key".to_string());

        let api_key = parts
            .headers
            .get("X-API-Key")
            .and_then(|v| v.to_str().ok())
            .or_else(|| {
                parts
                    .headers
                    .get("Authorization")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.strip_prefix("Bearer "))
            });

        if api_key == Some(expected_key.as_str()) {
            return Ok(ApiKeyAuth);
        }

        Err((
            StatusCode::UNAUTHORIZED,
            "Unauthorized: Invalid or missing API Key",
        ))
    }
}

pub struct SessionCookieAuth;

#[async_trait]
impl<S> FromRequestParts<S> for SessionCookieAuth
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, &'static str);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let expected_key =
            std::env::var("ADMIN_API_KEY").unwrap_or_else(|_| "admin-key".to_string());

        let cookie_header = parts.headers.get("Cookie").and_then(|v| v.to_str().ok());

        if let Some(cookies) = cookie_header {
            for cookie in cookies.split(';') {
                let parts: Vec<&str> = cookie.trim().splitn(2, '=').collect();
                if parts.len() == 2 && parts[0] == "session" && parts[1] == expected_key {
                    return Ok(SessionCookieAuth);
                }
            }
        }

        Err((
            StatusCode::UNAUTHORIZED,
            "Unauthorized: Invalid or missing Session Cookie",
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{Request, StatusCode};
    use axum::{Router, routing::get};
    use tower::ServiceExt;

    async fn dummy_handler() -> &'static str {
        "success"
    }

    #[tokio::test]
    async fn test_api_key_auth() {
        unsafe {
            std::env::set_var("ADMIN_API_KEY", "test-secret-key");
        }

        let app = Router::new().route(
            "/test",
            get(|_auth: ApiKeyAuth| async { dummy_handler().await }),
        );

        // 1. Success case: correct X-API-Key header
        let req = Request::builder()
            .uri("/test")
            .header("X-API-Key", "test-secret-key")
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        // 2. Success case: correct Bearer token in Authorization header
        let req = Request::builder()
            .uri("/test")
            .header("Authorization", "Bearer test-secret-key")
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        // 3. Failure case: wrong key
        let req = Request::builder()
            .uri("/test")
            .header("X-API-Key", "wrong-key")
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

        // 4. Failure case: missing key
        let req = Request::builder()
            .uri("/test")
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_session_cookie_auth() {
        unsafe {
            std::env::set_var("ADMIN_API_KEY", "test-secret-key");
        }

        let app = Router::new().route(
            "/test",
            get(|_auth: SessionCookieAuth| async { dummy_handler().await }),
        );

        // 1. Success case: correct cookie
        let req = Request::builder()
            .uri("/test")
            .header("Cookie", "session=test-secret-key")
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        // 2. Success case: correct cookie among multiple
        let req = Request::builder()
            .uri("/test")
            .header(
                "Cookie",
                "other_cookie=val; session=test-secret-key; another=val",
            )
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        // 3. Failure case: wrong cookie value
        let req = Request::builder()
            .uri("/test")
            .header("Cookie", "session=wrong-key")
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

        // 4. Failure case: missing cookie
        let req = Request::builder()
            .uri("/test")
            .body(axum::body::Body::empty())
            .unwrap();
        let res = app.clone().oneshot(req).await.unwrap();
        assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    }
}
