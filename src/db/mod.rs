use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Pool, Sqlite};
use std::str::FromStr;

pub mod cleanup;
pub mod models;
pub mod repository;

pub type DbPool = Pool<Sqlite>;

pub async fn init_db(database_url: &str) -> Result<DbPool, sqlx::Error> {
    // Enable WAL mode and configure parameters on the connection
    let connection_options = SqliteConnectOptions::from_str(database_url)?
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .busy_timeout(std::time::Duration::from_secs(5))
        .pragma("foreign_keys", "ON");

    let pool = SqlitePoolOptions::new()
        .max_connections(5) // Limit pool size to match single-instance embedded bounds
        .connect_with(connection_options)
        .await?;

    // Create tables
    create_tables(&pool).await?;

    Ok(pool)
}

async fn create_tables(pool: &DbPool) -> Result<(), sqlx::Error> {
    // 1. Create endpoints table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS endpoints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            headers TEXT NOT NULL DEFAULT '{}',
            interval_seconds INTEGER NOT NULL DEFAULT 60,
            timeout_seconds INTEGER NOT NULL DEFAULT 10,
            retry_interval_seconds INTEGER NOT NULL DEFAULT 15,
            consecutive_failure_threshold INTEGER NOT NULL DEFAULT 3,
            jitter_ratio REAL NOT NULL DEFAULT 0.20,
            json_validation_keys TEXT,
            status TEXT NOT NULL DEFAULT 'UP',
            consecutive_failures INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
        );",
    )
    .execute(pool)
    .await?;

    // 2. Create ping_metrics table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS ping_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            endpoint_id INTEGER NOT NULL,
            status_code INTEGER,
            response_time_ms INTEGER NOT NULL,
            is_success BOOLEAN NOT NULL,
            checked_at DATETIME NOT NULL,
            FOREIGN KEY(endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
        );",
    )
    .execute(pool)
    .await?;

    // Create index on ping_metrics (left-prefix match on endpoint_id, sorted by checked_at)
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_ping_metrics_endpoint_checked 
         ON ping_metrics (endpoint_id, checked_at);",
    )
    .execute(pool)
    .await?;

    // 3. Create status_alert_logs table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS status_alert_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            endpoint_id INTEGER NOT NULL,
            previous_status TEXT NOT NULL,
            new_status TEXT NOT NULL,
            consecutive_failures INTEGER NOT NULL,
            alert_dispatched BOOLEAN NOT NULL DEFAULT 0,
            alerted_at DATETIME NOT NULL,
            FOREIGN KEY(endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
        );",
    )
    .execute(pool)
    .await?;

    // Create index on status_alert_logs
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_status_alert_logs_endpoint_alerted 
         ON status_alert_logs (endpoint_id, alerted_at);",
    )
    .execute(pool)
    .await?;

    Ok(())
}
