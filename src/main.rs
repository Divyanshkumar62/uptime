pub mod alerting;
pub mod api;
pub mod db;
pub mod monitoring;
pub mod polling;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting Lightweight Stateless Monitoring Engine...");

    // In-memory or file-based DB setup
    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:uptime.sqlite".to_string());

    println!("Initializing database at: {}", database_url);
    let pool = db::init_db(&database_url).await?;
    println!("Database initialized successfully with WAL mode enabled.");

    // Verify connection is healthy
    sqlx::query("SELECT 1").execute(&pool).await?;
    println!("Connection test query execution successful.");

    // Initialize broadcast channel for real-time status transitions
    let (tx, _rx) = tokio::sync::broadcast::channel::<crate::api::sse::StatusEvent>(100);

    // Initialize and run Polling Scheduler
    let scheduler = polling::scheduler::PollingScheduler::new(pool.clone(), Some(tx.clone()));
    tokio::spawn(async move {
        scheduler.run().await;
    });
    println!("Scheduled polling engine task spawned.");

    // Initialize and run Alerting listener
    let pool_alert = pool.clone();
    let rx_alert = tx.subscribe();
    tokio::spawn(async move {
        alerting::start_alert_listener(pool_alert, rx_alert).await;
    });
    println!("External alerting listener task spawned.");

    // Initialize and run Database Cleanup Worker (runs daily, retention 30 days)
    let pool_cleanup = pool.clone();
    let cleanup_cancel = tokio_util::sync::CancellationToken::new();
    tokio::spawn(async move {
        db::cleanup::start_cleanup_worker(
            pool_cleanup,
            std::time::Duration::from_secs(24 * 3600),
            30,
            cleanup_cancel,
        )
        .await;
    });
    println!("Database cleanup background worker task spawned.");

    // Start Axum API and SSE server
    let app_state = api::AppState {
        pool: pool.clone(),
        tx: tx.clone(),
    };
    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .unwrap_or(8080);
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));

    println!("Starting API server on port {}...", port);
    api::start_api_server(app_state, addr).await;

    Ok(())
}
