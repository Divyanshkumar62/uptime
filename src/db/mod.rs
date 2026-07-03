use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Pool, Sqlite};
use std::str::FromStr;

pub mod cleanup;
pub mod crypto;
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
            http_method TEXT NOT NULL DEFAULT 'GET',
            request_body TEXT,
            accepted_status_codes TEXT NOT NULL DEFAULT '200-299',
            ignore_tls_errors BOOLEAN NOT NULL DEFAULT 0,
            ssl_expires_at DATETIME,
            throttle_seconds INTEGER NOT NULL DEFAULT 900,
            monitor_type TEXT NOT NULL DEFAULT 'HTTP',
            port INTEGER,
            dns_record_type TEXT,
            dns_resolve_server TEXT,
            dns_expected_result TEXT,
            db_connection_string TEXT,
            docker_container_id TEXT,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
        );",
    )
    .execute(pool)
    .await?;

    // Alter endpoints table to add v2 columns if they don't exist
    let _ =
        sqlx::query("ALTER TABLE endpoints ADD COLUMN http_method TEXT NOT NULL DEFAULT 'GET';")
            .execute(pool)
            .await;
    let _ = sqlx::query("ALTER TABLE endpoints ADD COLUMN request_body TEXT;")
        .execute(pool)
        .await;
    let _ = sqlx::query(
        "ALTER TABLE endpoints ADD COLUMN accepted_status_codes TEXT NOT NULL DEFAULT '200-299';",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "ALTER TABLE endpoints ADD COLUMN ignore_tls_errors BOOLEAN NOT NULL DEFAULT 0;",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("ALTER TABLE endpoints ADD COLUMN ssl_expires_at DATETIME;")
        .execute(pool)
        .await;
    let _ = sqlx::query(
        "ALTER TABLE endpoints ADD COLUMN throttle_seconds INTEGER NOT NULL DEFAULT 900;",
    )
    .execute(pool)
    .await;
    let _ =
        sqlx::query("ALTER TABLE endpoints ADD COLUMN monitor_type TEXT NOT NULL DEFAULT 'HTTP';")
            .execute(pool)
            .await;
    let _ = sqlx::query("ALTER TABLE endpoints ADD COLUMN port INTEGER;")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE endpoints ADD COLUMN dns_record_type TEXT;")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE endpoints ADD COLUMN dns_resolve_server TEXT;")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE endpoints ADD COLUMN dns_expected_result TEXT;")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE endpoints ADD COLUMN db_connection_string TEXT;")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE endpoints ADD COLUMN docker_container_id TEXT;")
        .execute(pool)
        .await;

    // Create endpoint_tags table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS endpoint_tags (
            endpoint_id INTEGER NOT NULL,
            tag TEXT NOT NULL,
            PRIMARY KEY (endpoint_id, tag),
            FOREIGN KEY(endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
        );",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_endpoint_tags_tag ON endpoint_tags (tag);")
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

    // 4. Create integrations_settings table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS integrations_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            whatsapp_token TEXT,
            whatsapp_phone_number_id TEXT,
            whatsapp_to_number TEXT,
            whatsapp_template_name TEXT,
            whatsapp_enabled BOOLEAN NOT NULL DEFAULT 0,
            twilio_account_sid TEXT,
            twilio_auth_token TEXT,
            twilio_from_number TEXT,
            twilio_to_number TEXT,
            twilio_callback_url TEXT,
            twilio_enabled BOOLEAN NOT NULL DEFAULT 0,
            webhook_url TEXT,
            webhook_enabled BOOLEAN NOT NULL DEFAULT 0,
            slack_url TEXT,
            slack_enabled BOOLEAN NOT NULL DEFAULT 0,
            discord_url TEXT,
            discord_enabled BOOLEAN NOT NULL DEFAULT 0,
            smtp_host TEXT,
            smtp_port INTEGER,
            smtp_username TEXT,
            smtp_password TEXT,
            smtp_from TEXT,
            smtp_to TEXT,
            smtp_enabled BOOLEAN NOT NULL DEFAULT 0,
            webhook_method TEXT NOT NULL DEFAULT 'POST',
            webhook_headers TEXT,
            webhook_body_template TEXT,
            updated_at DATETIME NOT NULL
        );",
    )
    .execute(pool)
    .await?;

    // Alter integrations_settings table to add new columns if they don't exist
    let _ = sqlx::query("ALTER TABLE integrations_settings ADD COLUMN slack_url TEXT;")
        .execute(pool)
        .await;
    let _ = sqlx::query(
        "ALTER TABLE integrations_settings ADD COLUMN slack_enabled BOOLEAN NOT NULL DEFAULT 0;",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("ALTER TABLE integrations_settings ADD COLUMN discord_url TEXT;")
        .execute(pool)
        .await;
    let _ = sqlx::query(
        "ALTER TABLE integrations_settings ADD COLUMN discord_enabled BOOLEAN NOT NULL DEFAULT 0;",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("ALTER TABLE integrations_settings ADD COLUMN smtp_host TEXT;")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE integrations_settings ADD COLUMN smtp_port INTEGER;")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE integrations_settings ADD COLUMN smtp_username TEXT;")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE integrations_settings ADD COLUMN smtp_password TEXT;")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE integrations_settings ADD COLUMN smtp_from TEXT;")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE integrations_settings ADD COLUMN smtp_to TEXT;")
        .execute(pool)
        .await;
    let _ = sqlx::query(
        "ALTER TABLE integrations_settings ADD COLUMN smtp_enabled BOOLEAN NOT NULL DEFAULT 0;",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "ALTER TABLE integrations_settings ADD COLUMN webhook_method TEXT NOT NULL DEFAULT 'POST';",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query("ALTER TABLE integrations_settings ADD COLUMN webhook_headers TEXT;")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE integrations_settings ADD COLUMN webhook_body_template TEXT;")
        .execute(pool)
        .await;

    // Seed default configuration row if not exists
    sqlx::query(
        "INSERT OR IGNORE INTO integrations_settings (
            id, whatsapp_enabled, twilio_enabled, webhook_enabled, updated_at
        ) VALUES (1, 0, 0, 0, datetime('now'));",
    )
    .execute(pool)
    .await?;

    Ok(())
}
