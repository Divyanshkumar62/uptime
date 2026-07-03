use crate::api::sse::StatusEvent;

pub async fn send_discord_alert(
    event: &StatusEvent,
    webhook_url: &str,
) -> Result<(), reqwest::Error> {
    let client = reqwest::Client::new();
    let error_details = event.error_message.as_deref().unwrap_or("No error details");

    let (title, description, color) = if event.new_status == "UP" {
        (
            "✅ Monitor Recovered",
            format!("**{}** is now UP.", event.url),
            0x00FF00,
        )
    } else if event.new_status.starts_with("SSL_EXPIRING_") {
        (
            "⚠️ SSL Expiry Warning",
            format!(
                "SSL certificate for **{}** is expiring soon.\nDetails: {}",
                event.url, error_details
            ),
            0xFFAA00,
        )
    } else {
        (
            "🚨 Monitor Down",
            format!("**{}** is DOWN.\nError: {}", event.url, error_details),
            0xFF0000,
        )
    };

    let payload = serde_json::json!({
        "embeds": [{
            "title": title,
            "description": description,
            "color": color,
            "timestamp": event.alerted_at.to_rfc3339()
        }]
    });

    let response = client.post(webhook_url).json(&payload).send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let err_text = response.text().await.unwrap_or_default();
        eprintln!(
            "Discord alert delivery failed for endpoint {} with status code {}: {}",
            event.endpoint_id, status, err_text
        );
    } else {
        println!(
            "Discord alert successfully dispatched for endpoint {} to {} status.",
            event.endpoint_id, event.new_status
        );
    }

    Ok(())
}
