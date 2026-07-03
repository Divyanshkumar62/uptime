use crate::api::sse::StatusEvent;
use std::collections::HashMap;

pub async fn send_webhook_alert(
    event: &StatusEvent,
    url: &str,
    method: &str,
    headers_str: Option<&str>,
    body_template: Option<&str>,
) -> Result<(), reqwest::Error> {
    let client = reqwest::Client::new();

    let mut req_builder = match method.to_uppercase().as_str() {
        "PUT" => client.put(url),
        "PATCH" => client.patch(url),
        _ => client.post(url),
    };

    // Apply custom headers if present
    if let Some(headers_map) =
        headers_str.and_then(|h_str| serde_json::from_str::<HashMap<String, String>>(h_str).ok())
    {
        for (key, val) in headers_map {
            req_builder = req_builder.header(key, val);
        }
    }

    // Apply template or default JSON payload
    if let Some(tpl) = body_template {
        if !tpl.is_empty() {
            let error_details = event.error_message.as_deref().unwrap_or("No error details");
            let rendered = tpl
                .replace("{status}", &event.new_status)
                .replace("{monitorUrl}", &event.url)
                .replace("{monitorName}", &event.url)
                .replace("{errorMessage}", error_details);

            if serde_json::from_str::<serde_json::Value>(&rendered).is_ok() {
                req_builder = req_builder
                    .header("Content-Type", "application/json")
                    .body(rendered);
            } else {
                req_builder = req_builder
                    .header("Content-Type", "text/plain")
                    .body(rendered);
            }
        } else {
            req_builder = req_builder.json(event);
        }
    } else {
        req_builder = req_builder.json(event);
    }

    let response = req_builder.send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let err_text = response.text().await.unwrap_or_default();
        eprintln!(
            "Webhook alert delivery failed for endpoint {} with status code {}: {}",
            event.endpoint_id, status, err_text
        );
    } else {
        println!(
            "Webhook alert successfully dispatched for endpoint {} to {} status.",
            event.endpoint_id, event.new_status
        );
    }

    Ok(())
}
