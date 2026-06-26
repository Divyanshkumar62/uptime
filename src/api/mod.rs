pub mod auth;
pub mod routes;
pub mod sse;

use axum::{
    Router,
    routing::{get, post},
};
use sse::StatusEvent;
use std::net::SocketAddr;

#[derive(Clone)]
pub struct AppState {
    pub pool: crate::db::DbPool,
    pub tx: tokio::sync::broadcast::Sender<StatusEvent>,
}

pub async fn start_api_server(state: AppState, addr: SocketAddr) {
    let app = Router::new()
        .route(
            "/api/endpoints",
            post(routes::create_endpoint_handler).get(routes::list_endpoints_handler),
        )
        .route(
            "/api/endpoints/:id",
            get(routes::get_endpoint_handler)
                .put(routes::update_endpoint_handler)
                .delete(routes::delete_endpoint_handler),
        )
        .route(
            "/api/endpoints/:id/latency",
            get(routes::get_latency_handler),
        )
        .route("/api/events", get(sse::sse_handler))
        .route(
            "/api/alerts/twilio-twiml",
            get(routes::twilio_twiml_handler).post(routes::twilio_twiml_handler),
        )
        .with_state(state);

    println!("API server binding to http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
