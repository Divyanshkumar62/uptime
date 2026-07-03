use crate::api::sse::StatusEvent;

pub async fn send_slack_alert(
    event: &StatusEvent,
    webhook_url: &str,
) -> Result<(), reqwest::Error> {
    let client = reqwest::Client::new();
    let error_details = event.error_message.as_deref().unwrap_or("No error details");

    let text = if event.new_status == "UP" {
        format!("✅ *Monitor Recovered*: {} is now UP.", event.url)
    } else if event.new_status.starts_with("SSL_EXPIRING_") {
        format!(
            "⚠️ *SSL Expiry Warning*: SSL certificate for {} is expiring soon. Details: {}",
            event.url, error_details
        )
    } else {
        format!(
            "🚨 *Monitor Down*: {} is DOWN. Error: {}",
            event.url, error_details
        )
    };

    let payload = serde_json::json!({
        "text": text
    });

    let response = client.post(webhook_url).json(&payload).send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let err_text = response.text().await.unwrap_or_default();
        eprintln!(
            "Slack alert delivery failed for endpoint {} with status code {}: {}",
            event.endpoint_id, status, err_text
        );
    } else {
        println!(
            "Slack alert successfully dispatched for endpoint {} to {} status.",
            event.endpoint_id, event.new_status
        );
    }

    Ok(())
}
