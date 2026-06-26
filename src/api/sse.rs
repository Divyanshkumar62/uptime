use axum::extract::State;
use axum::response::sse::{Event, KeepAlive, Sse};
use futures_util::StreamExt;
use futures_util::stream::Stream;
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use tokio_stream::wrappers::BroadcastStream;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct StatusEvent {
    pub endpoint_id: i64,
    pub url: String,
    pub previous_status: String,
    pub new_status: String,
    pub consecutive_failures: i32,
    pub alerted_at: chrono::DateTime<chrono::Utc>,
}

pub async fn sse_handler(
    _auth: super::auth::SessionCookieAuth,
    State(state): State<super::AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|res| async {
        match res {
            Ok(event) => {
                if let Ok(json_str) = serde_json::to_string(&event) {
                    Some(Ok(Event::default().data(json_str)))
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    });

    Sse::new(stream).keep_alive(KeepAlive::default())
}
