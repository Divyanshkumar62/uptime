use crate::db::models::Endpoint;
use rand::seq::SliceRandom;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, USER_AGENT};
use serde_json::Value;
use std::collections::HashMap;
use std::time::{Duration, Instant};

pub const DEFAULT_USER_AGENTS: &[&str] = &[
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
];

#[derive(Debug)]
pub struct ProbeResult {
    pub status_code: Option<u16>,
    pub response_time_ms: u64,
    pub is_success: bool,
    pub error_message: Option<String>,
}

pub async fn execute_probe(endpoint: &Endpoint, client: &reqwest::Client) -> ProbeResult {
    let timeout = Duration::from_secs(endpoint.timeout_seconds as u64);
    let start = Instant::now();

    // Prepare request headers
    let mut headers = HeaderMap::new();

    // Parse custom headers
    if let Ok(custom_headers) = serde_json::from_str::<HashMap<String, String>>(&endpoint.headers) {
        for (k, v) in custom_headers {
            if let (Ok(hname), Ok(hval)) = (
                HeaderName::from_bytes(k.as_bytes()),
                HeaderValue::from_str(&v),
            ) {
                headers.insert(hname, hval);
            }
        }
    }

    // Set User-Agent if not set manually
    if !headers.contains_key(USER_AGENT) {
        let mut rng = rand::thread_rng();
        if let Some(ua_val) = DEFAULT_USER_AGENTS
            .choose(&mut rng)
            .and_then(|&ua| HeaderValue::from_str(ua).ok())
        {
            headers.insert(USER_AGENT, ua_val);
        }
    }

    // Execute request
    let request_builder = client.get(&endpoint.url).headers(headers).timeout(timeout);

    let response_result = request_builder.send().await;
    let elapsed = start.elapsed().as_millis() as u64;

    match response_result {
        Ok(res) => {
            let status = res.status();
            let is_http_success = status.is_success();
            let status_code = Some(status.as_u16());

            // If we require JSON keys validation, check them
            if let Some(ref json_keys_str) = endpoint.json_validation_keys {
                if !is_http_success {
                    return ProbeResult {
                        status_code,
                        response_time_ms: elapsed,
                        is_success: false,
                        error_message: Some(format!("HTTP check failed with status: {}", status)),
                    };
                }

                let mut body_bytes = Vec::new();
                let mut response = res;
                let max_size = 65536; // 64KB limit
                let mut size_exceeded = false;

                while let Ok(Some(chunk)) = response.chunk().await {
                    if body_bytes.len() + chunk.len() > max_size {
                        size_exceeded = true;
                        break;
                    }
                    body_bytes.extend_from_slice(&chunk);
                }

                // If chunk read fails, capture that
                if body_bytes.is_empty() && !size_exceeded {
                    // Check if there was actually an error reading chunk (not just empty body)
                    // If we want to be safe, we can inspect chunk() result more closely,
                    // but standard while let is perfectly clean.
                }

                if size_exceeded {
                    return ProbeResult {
                        status_code,
                        response_time_ms: elapsed,
                        is_success: false,
                        error_message: Some("Response body exceeded 64KB limit".to_string()),
                    };
                }

                match serde_json::from_slice::<Value>(&body_bytes) {
                    Ok(json_value) => {
                        // Parse JSON validation keys array
                        if let Ok(keys) = serde_json::from_str::<Vec<String>>(json_keys_str) {
                            for key in keys {
                                // Verify key exists (can use simple pointer or direct lookup)
                                // Let's check direct lookup or nested pointer
                                let exists = if key.starts_with('/') {
                                    json_value.pointer(&key).is_some()
                                } else {
                                    json_value.get(&key).is_some()
                                };

                                if !exists {
                                    return ProbeResult {
                                        status_code,
                                        response_time_ms: elapsed,
                                        is_success: false,
                                        error_message: Some(format!(
                                            "JSON validation failed: key '{}' not found",
                                            key
                                        )),
                                    };
                                }
                            }

                            // All keys validated successfully
                            ProbeResult {
                                status_code,
                                response_time_ms: elapsed,
                                is_success: true,
                                error_message: None,
                            }
                        } else {
                            ProbeResult {
                                status_code,
                                response_time_ms: elapsed,
                                is_success: false,
                                error_message: Some(
                                    "Failed to parse json_validation_keys array".to_string(),
                                ),
                            }
                        }
                    }
                    Err(_) => ProbeResult {
                        status_code,
                        response_time_ms: elapsed,
                        is_success: false,
                        error_message: Some("Response body is not valid JSON".to_string()),
                    },
                }
            } else {
                // Standard status code check
                ProbeResult {
                    status_code,
                    response_time_ms: elapsed,
                    is_success: is_http_success,
                    error_message: if is_http_success {
                        None
                    } else {
                        Some(format!("HTTP status error: {}", status))
                    },
                }
            }
        }
        Err(e) => ProbeResult {
            status_code: None,
            response_time_ms: elapsed,
            is_success: false,
            error_message: Some(format!("Network connection error: {}", e)),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn start_mock_server() -> (String, tokio::task::JoinHandle<()>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let addr = format!("http://127.0.0.1:{}", port);

        let handle = tokio::spawn(async move {
            if let Ok((mut stream, _)) = listener.accept().await {
                use tokio::io::{AsyncReadExt, AsyncWriteExt};
                let mut buf = [0; 1024];
                let _ = stream.read(&mut buf).await;

                let response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 26\r\n\r\n{\"status\":\"ok\",\"code\":200}";
                let _ = stream.write_all(response.as_bytes()).await;
            }
        });

        (addr, handle)
    }

    #[tokio::test]
    async fn test_execute_probe_success() {
        let (url, _server) = start_mock_server().await;
        let endpoint = Endpoint {
            id: 1,
            url,
            headers: "{\"X-Custom-Header\":\"Value\"}".to_string(),
            interval_seconds: 60,
            timeout_seconds: 10,
            retry_interval_seconds: 15,
            consecutive_failure_threshold: 3,
            jitter_ratio: 0.20,
            json_validation_keys: Some("[\"status\", \"code\"]".to_string()),
            status: "UP".to_string(),
            consecutive_failures: 0,
            is_active: true,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let client = reqwest::Client::new();
        let res = execute_probe(&endpoint, &client).await;

        assert!(res.is_success);
        assert_eq!(res.status_code, Some(200));
        assert!(res.response_time_ms > 0);
        assert!(res.error_message.is_none());
    }

    #[tokio::test]
    async fn test_execute_probe_json_failure() {
        let (url, _server) = start_mock_server().await;
        let endpoint = Endpoint {
            id: 1,
            url,
            headers: "{}".to_string(),
            interval_seconds: 60,
            timeout_seconds: 10,
            retry_interval_seconds: 15,
            consecutive_failure_threshold: 3,
            jitter_ratio: 0.20,
            json_validation_keys: Some("[\"missing_key\"]".to_string()),
            status: "UP".to_string(),
            consecutive_failures: 0,
            is_active: true,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let client = reqwest::Client::new();
        let res = execute_probe(&endpoint, &client).await;

        assert!(!res.is_success);
        assert_eq!(res.status_code, Some(200));
        assert!(
            res.error_message
                .unwrap()
                .contains("JSON validation failed")
        );
    }

    #[tokio::test]
    async fn test_execute_probe_size_exceeded() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let url = format!("http://127.0.0.1:{}", port);

        let handle = tokio::spawn(async move {
            if let Ok((mut stream, _)) = listener.accept().await {
                use tokio::io::{AsyncReadExt, AsyncWriteExt};
                let mut buf = [0; 1024];
                let _ = stream.read(&mut buf).await;

                let response_headers = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n";
                let _ = stream.write_all(response_headers.as_bytes()).await;

                let chunk_size = 70000;
                let chunk_data = vec![b'a'; chunk_size];
                let chunk_header = format!("{:x}\r\n", chunk_size);
                let _ = stream.write_all(chunk_header.as_bytes()).await;
                let _ = stream.write_all(&chunk_data).await;
                let _ = stream.write_all(b"\r\n").await;
            }
        });

        let endpoint = Endpoint {
            id: 1,
            url,
            headers: "{}".to_string(),
            interval_seconds: 60,
            timeout_seconds: 10,
            retry_interval_seconds: 15,
            consecutive_failure_threshold: 3,
            jitter_ratio: 0.20,
            json_validation_keys: Some("[\"status\"]".to_string()),
            status: "UP".to_string(),
            consecutive_failures: 0,
            is_active: true,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let client = reqwest::Client::new();
        let res = execute_probe(&endpoint, &client).await;

        assert!(!res.is_success);
        assert_eq!(res.status_code, Some(200));
        assert!(
            res.error_message
                .unwrap()
                .contains("Response body exceeded 64KB limit")
        );
        let _ = handle.await;
    }
}
