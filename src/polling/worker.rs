use crate::db::models::Endpoint;
use hickory_resolver::TokioAsyncResolver;
use hickory_resolver::config::{NameServerConfig, Protocol, ResolverConfig, ResolverOpts};
use rand::seq::SliceRandom;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, USER_AGENT};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::net::SocketAddr;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time::timeout;

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

pub fn match_status_code(code: u16, accepted_str: &str) -> bool {
    for entry in accepted_str.split(',') {
        let entry = entry.trim();
        if entry.is_empty() {
            continue;
        }
        if entry.contains('-') {
            let parts: Vec<&str> = entry.split('-').collect();
            if parts.len() == 2 {
                let start_val = parts[0].trim().parse::<u16>();
                let end_val = parts[1].trim().parse::<u16>();
                match (start_val, end_val) {
                    (Ok(start), Ok(end)) if (start..=end).contains(&code) => return true,
                    _ => {}
                }
            }
        } else if entry.parse::<u16>() == Ok(code) {
            return true;
        }
    }
    false
}

pub async fn execute_probe(endpoint: &Endpoint, client: &reqwest::Client) -> ProbeResult {
    match endpoint.monitor_type.to_uppercase().as_str() {
        "TCP" => execute_tcp_probe(endpoint).await,
        "DNS" => execute_dns_probe(endpoint).await,
        "POSTGRES" => execute_postgres_probe(endpoint).await,
        "MYSQL" => execute_mysql_probe(endpoint).await,
        "REDIS" => execute_redis_probe(endpoint).await,
        "DOCKER" => execute_docker_probe(endpoint).await,
        _ => execute_http_probe(endpoint, client).await,
    }
}

pub async fn execute_tcp_probe(endpoint: &Endpoint) -> ProbeResult {
    let start = Instant::now();
    let timeout_duration = Duration::from_secs(endpoint.timeout_seconds as u64);
    let port = endpoint.port.unwrap_or(80);
    let addr = format!("{}:{}", endpoint.url, port);

    let connect_fut = TcpStream::connect(&addr);
    match timeout(timeout_duration, connect_fut).await {
        Ok(Ok(_stream)) => ProbeResult {
            is_success: true,
            status_code: Some(200),
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: None,
        },
        Ok(Err(e)) => ProbeResult {
            is_success: false,
            status_code: None,
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: Some(format!("TCP connection failed: {}", e)),
        },
        Err(_) => ProbeResult {
            is_success: false,
            status_code: None,
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: Some("TCP connection timeout".to_string()),
        },
    }
}

pub async fn execute_dns_probe(endpoint: &Endpoint) -> ProbeResult {
    let start = Instant::now();
    let timeout_duration = Duration::from_secs(endpoint.timeout_seconds as u64);

    let server_addr: SocketAddr = match endpoint.dns_resolve_server.as_deref() {
        Some(s) => {
            let s_with_port = if s.contains(':') {
                s.to_string()
            } else {
                format!("{}:53", s)
            };
            match s_with_port.parse() {
                Ok(addr) => addr,
                Err(_) => {
                    return ProbeResult {
                        is_success: false,
                        status_code: None,
                        response_time_ms: 0,
                        error_message: Some("Invalid DNS resolve server format".to_string()),
                    };
                }
            }
        }
        None => {
            return ProbeResult {
                is_success: false,
                status_code: None,
                response_time_ms: 0,
                error_message: Some("Missing DNS resolve server".to_string()),
            };
        }
    };

    let mut config = ResolverConfig::new();
    config.add_name_server(NameServerConfig::new(server_addr, Protocol::Udp));

    let mut opts = ResolverOpts::default();
    opts.timeout = timeout_duration;

    let resolver = TokioAsyncResolver::tokio(config, opts);

    let record_type_str = endpoint
        .dns_record_type
        .as_deref()
        .unwrap_or("A")
        .to_uppercase();
    let record_type = match record_type_str.as_str() {
        "A" => hickory_resolver::proto::rr::RecordType::A,
        "AAAA" => hickory_resolver::proto::rr::RecordType::AAAA,
        "CNAME" => hickory_resolver::proto::rr::RecordType::CNAME,
        "MX" => hickory_resolver::proto::rr::RecordType::MX,
        "TXT" => hickory_resolver::proto::rr::RecordType::TXT,
        _ => {
            return ProbeResult {
                is_success: false,
                status_code: None,
                response_time_ms: 0,
                error_message: Some(format!("Unsupported DNS record type: {}", record_type_str)),
            };
        }
    };

    let lookup_future = resolver.lookup(endpoint.url.as_str(), record_type);
    match timeout(timeout_duration, lookup_future).await {
        Ok(Ok(lookup)) => {
            let resolved_records: Vec<String> =
                lookup.records().iter().map(|rec| rec.to_string()).collect();
            let expected = endpoint.dns_expected_result.as_deref().unwrap_or("");
            let matched = resolved_records.iter().any(|rec| rec.contains(expected));

            if matched {
                ProbeResult {
                    is_success: true,
                    status_code: Some(200),
                    response_time_ms: start.elapsed().as_millis() as u64,
                    error_message: None,
                }
            } else {
                ProbeResult {
                    is_success: false,
                    status_code: None,
                    response_time_ms: start.elapsed().as_millis() as u64,
                    error_message: Some(format!(
                        "DNS resolution mismatch. Expected: '{}', Resolved: {:?}",
                        expected, resolved_records
                    )),
                }
            }
        }
        Ok(Err(e)) => ProbeResult {
            is_success: false,
            status_code: None,
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: Some(format!("DNS query resolution failed: {}", e)),
        },
        Err(_) => ProbeResult {
            is_success: false,
            status_code: None,
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: Some("DNS query resolution timeout".to_string()),
        },
    }
}

pub async fn execute_http_probe(endpoint: &Endpoint, client: &reqwest::Client) -> ProbeResult {
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
    let method = match reqwest::Method::from_bytes(endpoint.http_method.to_uppercase().as_bytes()) {
        Ok(m) => m,
        Err(_) => reqwest::Method::GET,
    };

    let mut request_builder = client
        .request(method, &endpoint.url)
        .headers(headers)
        .timeout(timeout);

    if let Some(ref body) = endpoint.request_body {
        request_builder = request_builder.body(body.clone());
        request_builder = request_builder.header(reqwest::header::CONTENT_TYPE, "application/json");
    }

    let response_result = request_builder.send().await;
    let elapsed = start.elapsed().as_millis() as u64;

    match response_result {
        Ok(res) => {
            let status = res.status();
            let status_code_val = status.as_u16();
            let is_http_success =
                match_status_code(status_code_val, &endpoint.accepted_status_codes);
            let status_code = Some(status_code_val);

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

pub fn check_ssl_expiry(url_str: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    let url = reqwest::Url::parse(url_str).ok()?;
    if url.scheme() != "https" {
        return None;
    }
    let host = url.host_str()?;
    let port = url.port().unwrap_or(443);

    use std::net::ToSocketAddrs;
    let addr = format!("{}:{}", host, port)
        .to_socket_addrs()
        .ok()?
        .next()?;
    let stream = std::net::TcpStream::connect_timeout(&addr, Duration::from_secs(5)).ok()?;

    let connector = native_tls::TlsConnector::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .ok()?;

    let tls_stream = connector.connect(host, stream).ok()?;
    let cert = tls_stream.peer_certificate().ok()??;
    let der = cert.to_der().ok()?;

    let (_, x509) = x509_parser::parse_x509_certificate(&der).ok()?;
    let dt = x509.validity().not_after.to_datetime();
    let ts = dt.unix_timestamp();
    chrono::DateTime::from_timestamp(ts, 0)
}

pub async fn execute_postgres_probe(endpoint: &Endpoint) -> ProbeResult {
    let start = Instant::now();
    let timeout_duration = Duration::from_secs(endpoint.timeout_seconds as u64);

    let encrypted = match &endpoint.db_connection_string {
        Some(conn) if !conn.is_empty() => conn,
        _ => {
            return ProbeResult {
                is_success: false,
                status_code: None,
                response_time_ms: 0,
                error_message: Some("Database connection string is missing".to_string()),
            };
        }
    };

    let decrypted = match crate::db::crypto::decrypt_secret(encrypted) {
        Ok(s) => s,
        Err(e) => {
            return ProbeResult {
                is_success: false,
                status_code: None,
                response_time_ms: 0,
                error_message: Some(format!("Decryption failed: {}", e)),
            };
        }
    };

    let connect_fut = async {
        use sqlx::Connection;
        use sqlx::postgres::PgConnectOptions;
        use std::str::FromStr;
        let opts = PgConnectOptions::from_str(&decrypted)?;
        let mut conn = sqlx::postgres::PgConnection::connect_with(&opts).await?;
        sqlx::query("SELECT 1").execute(&mut conn).await?;
        Ok::<(), sqlx::Error>(())
    };

    match tokio::time::timeout(timeout_duration, connect_fut).await {
        Ok(Ok(())) => ProbeResult {
            is_success: true,
            status_code: Some(200),
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: None,
        },
        Ok(Err(_e)) => ProbeResult {
            is_success: false,
            status_code: None,
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: Some("Database connection or ping failed".to_string()),
        },
        Err(_) => ProbeResult {
            is_success: false,
            status_code: None,
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: Some("Postgres ping timeout".to_string()),
        },
    }
}

pub async fn execute_mysql_probe(endpoint: &Endpoint) -> ProbeResult {
    let start = Instant::now();
    let timeout_duration = Duration::from_secs(endpoint.timeout_seconds as u64);

    let encrypted = match &endpoint.db_connection_string {
        Some(conn) if !conn.is_empty() => conn,
        _ => {
            return ProbeResult {
                is_success: false,
                status_code: None,
                response_time_ms: 0,
                error_message: Some("Database connection string is missing".to_string()),
            };
        }
    };

    let decrypted = match crate::db::crypto::decrypt_secret(encrypted) {
        Ok(s) => s,
        Err(e) => {
            return ProbeResult {
                is_success: false,
                status_code: None,
                response_time_ms: 0,
                error_message: Some(format!("Decryption failed: {}", e)),
            };
        }
    };

    let connect_fut = async {
        use sqlx::Connection;
        use sqlx::mysql::MySqlConnectOptions;
        use std::str::FromStr;
        let opts = MySqlConnectOptions::from_str(&decrypted)?;
        let mut conn = sqlx::mysql::MySqlConnection::connect_with(&opts).await?;
        sqlx::query("SELECT 1").execute(&mut conn).await?;
        Ok::<(), sqlx::Error>(())
    };

    match tokio::time::timeout(timeout_duration, connect_fut).await {
        Ok(Ok(())) => ProbeResult {
            is_success: true,
            status_code: Some(200),
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: None,
        },
        Ok(Err(_e)) => ProbeResult {
            is_success: false,
            status_code: None,
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: Some("Database connection or ping failed".to_string()),
        },
        Err(_) => ProbeResult {
            is_success: false,
            status_code: None,
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: Some("MySQL ping timeout".to_string()),
        },
    }
}

pub async fn execute_redis_probe(endpoint: &Endpoint) -> ProbeResult {
    let start = Instant::now();
    let timeout_duration = Duration::from_secs(endpoint.timeout_seconds as u64);

    let encrypted = match &endpoint.db_connection_string {
        Some(conn) if !conn.is_empty() => conn,
        _ => {
            return ProbeResult {
                is_success: false,
                status_code: None,
                response_time_ms: 0,
                error_message: Some("Database connection string is missing".to_string()),
            };
        }
    };

    let decrypted = match crate::db::crypto::decrypt_secret(encrypted) {
        Ok(s) => s,
        Err(e) => {
            return ProbeResult {
                is_success: false,
                status_code: None,
                response_time_ms: 0,
                error_message: Some(format!("Decryption failed: {}", e)),
            };
        }
    };

    let connect_fut = async {
        let client = redis::Client::open(decrypted.as_str())?;
        let mut conn = client.get_multiplexed_async_connection().await?;
        let reply: String = redis::cmd("PING").query_async(&mut conn).await?;
        if reply == "PONG" || reply.to_uppercase() == "PONG" {
            Ok::<(), redis::RedisError>(())
        } else {
            Err(redis::RedisError::from((
                redis::ErrorKind::ResponseError,
                "Unexpected PING reply",
                reply,
            )))
        }
    };

    match tokio::time::timeout(timeout_duration, connect_fut).await {
        Ok(Ok(())) => ProbeResult {
            is_success: true,
            status_code: Some(200),
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: None,
        },
        Ok(Err(_e)) => ProbeResult {
            is_success: false,
            status_code: None,
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: Some("Database connection or ping failed".to_string()),
        },
        Err(_) => ProbeResult {
            is_success: false,
            status_code: None,
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: Some("Redis ping timeout".to_string()),
        },
    }
}

pub async fn execute_docker_probe(endpoint: &Endpoint) -> ProbeResult {
    let start = Instant::now();
    let timeout_duration = Duration::from_secs(endpoint.timeout_seconds as u64);

    let container_id = match &endpoint.docker_container_id {
        Some(id) if !id.is_empty() => id,
        _ => {
            return ProbeResult {
                is_success: false,
                status_code: None,
                response_time_ms: 0,
                error_message: Some("Docker container ID is missing".to_string()),
            };
        }
    };

    let docker_proxy_url = env::var("DOCKER_PROXY_URL")
        .unwrap_or_else(|_| "http://localhost:2375".to_string());

    let docker_api_url = format!(
        "{}/containers/{}/json",
        docker_proxy_url.trim_end_matches('/'),
        container_id
    );
    let request_fut = reqwest::Client::new()
        .get(&docker_api_url)
        .timeout(timeout_duration)
        .send();

    match tokio::time::timeout(timeout_duration, request_fut).await {
        Ok(Ok(res)) => {
            let status = res.status();
            if status.is_success() {
                match res.json::<serde_json::Value>().await {
                    Ok(json_val) => {
                        let is_running = json_val["State"]["Running"].as_bool().unwrap_or(false);
                        if is_running {
                            ProbeResult {
                                is_success: true,
                                status_code: Some(status.as_u16()),
                                response_time_ms: start.elapsed().as_millis() as u64,
                                error_message: None,
                            }
                        } else {
                            ProbeResult {
                                is_success: false,
                                status_code: Some(status.as_u16()),
                                response_time_ms: start.elapsed().as_millis() as u64,
                                error_message: Some("Docker container is not running".to_string()),
                            }
                        }
                    }
                    Err(e) => ProbeResult {
                        is_success: false,
                        status_code: Some(status.as_u16()),
                        response_time_ms: start.elapsed().as_millis() as u64,
                        error_message: Some(format!("Failed to parse Docker JSON: {}", e)),
                    },
                }
            } else {
                ProbeResult {
                    is_success: false,
                    status_code: Some(status.as_u16()),
                    response_time_ms: start.elapsed().as_millis() as u64,
                    error_message: Some(format!("Docker API returned error: {}", status)),
                }
            }
        }
        Ok(Err(e)) => ProbeResult {
            is_success: false,
            status_code: None,
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: Some(format!("Docker socket connection failed: {}", e)),
        },
        Err(_) => ProbeResult {
            is_success: false,
            status_code: None,
            response_time_ms: start.elapsed().as_millis() as u64,
            error_message: Some("Docker socket connection timeout".to_string()),
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
            http_method: "GET".to_string(),
            request_body: None,
            accepted_status_codes: "200-299".to_string(),
            ignore_tls_errors: false,
            ssl_expires_at: None,
            throttle_seconds: 900,
            monitor_type: "HTTP".to_string(),
            port: None,
            dns_record_type: None,
            dns_resolve_server: None,
            dns_expected_result: None,
            db_connection_string: None,
            docker_container_id: None,
            tags: None,
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
            http_method: "GET".to_string(),
            request_body: None,
            accepted_status_codes: "200-299".to_string(),
            ignore_tls_errors: false,
            ssl_expires_at: None,
            throttle_seconds: 900,
            monitor_type: "HTTP".to_string(),
            port: None,
            dns_record_type: None,
            dns_resolve_server: None,
            dns_expected_result: None,
            db_connection_string: None,
            docker_container_id: None,
            tags: None,
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
            http_method: "GET".to_string(),
            request_body: None,
            accepted_status_codes: "200-299".to_string(),
            ignore_tls_errors: false,
            ssl_expires_at: None,
            throttle_seconds: 900,
            monitor_type: "HTTP".to_string(),
            port: None,
            dns_record_type: None,
            dns_resolve_server: None,
            dns_expected_result: None,
            db_connection_string: None,
            docker_container_id: None,
            tags: None,
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

    #[test]
    fn test_match_status_code_logic() {
        assert!(match_status_code(200, "200-299"));
        assert!(match_status_code(299, "200-299"));
        assert!(!match_status_code(300, "200-299"));
        assert!(match_status_code(302, "200, 302, 404"));
        assert!(match_status_code(404, "200, 302, 404"));
        assert!(!match_status_code(500, "200, 302, 404"));
        assert!(match_status_code(201, "200-205, 207-299"));
        assert!(!match_status_code(206, "200-205, 207-299"));
    }

    #[test]
    fn test_check_ssl_expiry_non_https() {
        assert!(check_ssl_expiry("http://example.com").is_none());
        assert!(check_ssl_expiry("invalid-url").is_none());
    }

    #[tokio::test]
    async fn test_execute_tcp_probe_success() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let port = listener.local_addr().unwrap().port();

        tokio::spawn(async move {
            let _ = listener.accept().await;
        });

        let endpoint = Endpoint {
            id: 1,
            url: "127.0.0.1".to_string(),
            headers: "{}".to_string(),
            interval_seconds: 60,
            timeout_seconds: 5,
            retry_interval_seconds: 15,
            consecutive_failure_threshold: 3,
            jitter_ratio: 0.20,
            json_validation_keys: None,
            status: "UP".to_string(),
            consecutive_failures: 0,
            is_active: true,
            http_method: "GET".to_string(),
            request_body: None,
            accepted_status_codes: "200-299".to_string(),
            ignore_tls_errors: false,
            ssl_expires_at: None,
            throttle_seconds: 900,
            monitor_type: "TCP".to_string(),
            port: Some(port as i32),
            dns_record_type: None,
            dns_resolve_server: None,
            dns_expected_result: None,
            db_connection_string: None,
            docker_container_id: None,
            tags: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let res = execute_tcp_probe(&endpoint).await;
        assert!(res.is_success);
        assert_eq!(res.status_code, Some(200));
        assert!(res.error_message.is_none());
    }

    #[tokio::test]
    async fn test_execute_tcp_probe_failure() {
        let endpoint = Endpoint {
            id: 1,
            url: "127.0.0.1".to_string(),
            headers: "{}".to_string(),
            interval_seconds: 60,
            timeout_seconds: 1,
            retry_interval_seconds: 15,
            consecutive_failure_threshold: 3,
            jitter_ratio: 0.20,
            json_validation_keys: None,
            status: "UP".to_string(),
            consecutive_failures: 0,
            is_active: true,
            http_method: "GET".to_string(),
            request_body: None,
            accepted_status_codes: "200-299".to_string(),
            ignore_tls_errors: false,
            ssl_expires_at: None,
            throttle_seconds: 900,
            monitor_type: "TCP".to_string(),
            port: Some(12345),
            dns_record_type: None,
            dns_resolve_server: None,
            dns_expected_result: None,
            db_connection_string: None,
            docker_container_id: None,
            tags: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let res = execute_tcp_probe(&endpoint).await;
        assert!(!res.is_success);
        let err = res.error_message.unwrap();
        assert!(err.contains("TCP connection failed") || err.contains("TCP connection timeout"));
    }

    #[tokio::test]
    async fn test_execute_dns_probe_invalid_resolver() {
        let endpoint = Endpoint {
            id: 1,
            url: "google.com".to_string(),
            headers: "{}".to_string(),
            interval_seconds: 60,
            timeout_seconds: 5,
            retry_interval_seconds: 15,
            consecutive_failure_threshold: 3,
            jitter_ratio: 0.20,
            json_validation_keys: None,
            status: "UP".to_string(),
            consecutive_failures: 0,
            is_active: true,
            http_method: "GET".to_string(),
            request_body: None,
            accepted_status_codes: "200-299".to_string(),
            ignore_tls_errors: false,
            ssl_expires_at: None,
            throttle_seconds: 900,
            monitor_type: "DNS".to_string(),
            port: None,
            dns_record_type: Some("A".to_string()),
            dns_resolve_server: Some("invalid-ip-format".to_string()),
            dns_expected_result: Some("127.0.0.1".to_string()),
            db_connection_string: None,
            docker_container_id: None,
            tags: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let res = execute_dns_probe(&endpoint).await;
        assert!(!res.is_success);
        assert!(
            res.error_message
                .unwrap()
                .contains("Invalid DNS resolve server format")
        );
    }
}
