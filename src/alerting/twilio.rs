use crate::api::sse::StatusEvent;

pub async fn trigger_twilio_call(
    event: &StatusEvent,
    account_sid: &str,
    auth_token: &str,
    from_number: &str,
    to_number: &str,
    callback_url: &str,
) -> Result<(), reqwest::Error> {
    if account_sid.is_empty()
        || auth_token.is_empty()
        || from_number.is_empty()
        || to_number.is_empty()
        || callback_url.is_empty()
    {
        println!(
            "[INFO] Skipping Twilio alert for endpoint {} ({}): credentials not configured.",
            event.endpoint_id, event.url
        );
        return Ok(());
    }

    let url = format!(
        "https://api.twilio.com/2010-04-01/Accounts/{}/Calls.json",
        account_sid
    );

    let client = reqwest::Client::new();
    let twiml_callback = format!("{}/api/alerts/twilio-twiml", callback_url);

    let params = [
        ("To", to_number),
        ("From", from_number),
        ("Url", twiml_callback.as_str()),
    ];

    let response = client
        .post(&url)
        .basic_auth(account_sid, Some(auth_token))
        .form(&params)
        .send()
        .await?;

    if !response.status().is_success() {
        let err_text = response.text().await.unwrap_or_default();
        eprintln!(
            "Twilio call trigger failed for endpoint {} status code: {}",
            event.endpoint_id, err_text
        );
    } else {
        println!(
            "Twilio voice call alert successfully triggered for endpoint {}.",
            event.endpoint_id
        );
    }

    Ok(())
}
