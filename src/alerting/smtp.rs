use crate::api::sse::StatusEvent;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use std::time::Duration;

pub async fn send_smtp_alert(
    event: &StatusEvent,
    host: &str,
    port: u16,
    username: &str,
    password: &str,
    from: &str,
    to: &str,
) -> Result<(), String> {
    let error_details = event.error_message.as_deref().unwrap_or("No error details");

    let subject = if event.new_status == "UP" {
        format!("✅ Monitor Recovered: {}", event.url)
    } else if event.new_status.starts_with("SSL_EXPIRING_") {
        format!("⚠️ SSL Expiry Warning: {}", event.url)
    } else {
        format!("🚨 Monitor Down: {}", event.url)
    };

    let body = if event.new_status == "UP" {
        format!(
            "Hello,\n\nThe monitor for {} has successfully recovered.\n\nStatus: UP\nTimestamp: {}\n",
            event.url, event.alerted_at
        )
    } else if event.new_status.starts_with("SSL_EXPIRING_") {
        format!(
            "Hello,\n\nThe SSL certificate for {} is expiring soon.\n\nDetails: {}\nTimestamp: {}\n",
            event.url, error_details, event.alerted_at
        )
    } else {
        format!(
            "Hello,\n\nThe monitor for {} has reported a DOWN status.\n\nError: {}\nConsecutive Failures: {}\nTimestamp: {}\n",
            event.url, error_details, event.consecutive_failures, event.alerted_at
        )
    };

    let email = Message::builder()
        .from(
            from.parse()
                .map_err(|e| format!("Invalid from address: {:?}", e))?,
        )
        .to(to
            .parse()
            .map_err(|e| format!("Invalid to address: {:?}", e))?)
        .subject(subject)
        .body(body)
        .map_err(|e| format!("Email construction failed: {:?}", e))?;

    let creds = Credentials::new(username.to_string(), password.to_string());

    // NFR-014: Enforce SMTP connection timeout of 5 seconds
    let transport = SmtpTransport::relay(host)
        .map_err(|e| format!("Failed to create relay: {:?}", e))?
        .port(port)
        .credentials(creds)
        .timeout(Some(Duration::from_secs(5)))
        .build();

    // Blocking Transport send inside tokio spawn_blocking to prevent async thread starvation
    tokio::task::spawn_blocking(move || transport.send(&email))
        .await
        .map_err(|e| format!("Blocking task join error: {:?}", e))?
        .map_err(|e| format!("SMTP send failed: {:?}", e))?;

    Ok(())
}
