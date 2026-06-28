use crate::api::sse::StatusEvent;

pub async fn send_webhook_alert(event: &StatusEvent, url: &str) -> Result<(), reqwest::Error> {
    let client = reqwest::Client::new();
    let response = client.post(url).json(event).send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let err_text = response.text().await.unwrap_or_default();
        eprintln!(
            "Webhook alert delivery failed for endpoint {} with status code {}: {}",
            event.endpoint_id, status, err_text
        );
    } else {
        println!(
            "Webhook alert successfully dispatched for endpoint {} to DOWN status.",
            event.endpoint_id
        );
    }

    Ok(())
}
