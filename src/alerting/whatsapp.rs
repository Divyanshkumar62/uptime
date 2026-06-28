use crate::api::sse::StatusEvent;
use serde_json::json;

pub async fn send_whatsapp_alert(
    event: &StatusEvent,
    token: &str,
    phone_number_id: &str,
    to_number: &str,
    template_name: &str,
) -> Result<(), reqwest::Error> {
    if token.is_empty()
        || phone_number_id.is_empty()
        || to_number.is_empty()
        || template_name.is_empty()
    {
        println!(
            "[INFO] Skipping WhatsApp alert for endpoint {} ({}): credentials not configured.",
            event.endpoint_id, event.url
        );
        return Ok(());
    }

    let url = format!(
        "https://graph.facebook.com/v18.0/{}/messages",
        phone_number_id
    );

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .bearer_auth(token)
        .json(&json!({
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {
                    "code": "en_US"
                },
                "components": [
                    {
                        "type": "body",
                        "parameters": [
                            { "type": "text", "text": event.url },
                            { "type": "text", "text": event.new_status },
                            { "type": "text", "text": event.alerted_at.to_rfc3339() }
                        ]
                    }
                ]
            }
        }))
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let err_text = response.text().await.unwrap_or_default();
        eprintln!(
            "WhatsApp alert delivery failed for endpoint {} with status code {}: {}",
            event.endpoint_id, status, err_text
        );
    } else {
        println!(
            "WhatsApp alert successfully dispatched for endpoint {} to DOWN status.",
            event.endpoint_id
        );
    }

    Ok(())
}
