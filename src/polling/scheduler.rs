use crate::db::DbPool;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

pub struct PollingScheduler {
    pool: DbPool,
    client: reqwest::Client,
    semaphore: Arc<Semaphore>,
    cancel_token: CancellationToken,
    active_tasks: HashMap<i64, JoinHandle<()>>,
    broadcast_tx: Option<tokio::sync::broadcast::Sender<crate::api::sse::StatusEvent>>,
}

impl PollingScheduler {
    pub fn new(
        pool: DbPool,
        broadcast_tx: Option<tokio::sync::broadcast::Sender<crate::api::sse::StatusEvent>>,
    ) -> Self {
        let client = reqwest::Client::builder()
            .pool_max_idle_per_host(10)
            .build()
            .unwrap_or_default();

        Self {
            pool,
            client,
            semaphore: Arc::new(Semaphore::new(50)),
            cancel_token: CancellationToken::new(),
            active_tasks: HashMap::new(),
            broadcast_tx,
        }
    }

    pub async fn tick(&mut self) -> Result<(), sqlx::Error> {
        // Query active endpoints
        let active_endpoints = crate::db::repository::list_active_endpoints(&self.pool).await?;
        let mut found_ids = std::collections::HashSet::new();

        // Spawn loops for new active endpoints
        for ep in active_endpoints {
            found_ids.insert(ep.id);
            if !self.active_tasks.contains_key(&ep.id) {
                let pool = self.pool.clone();
                let client = self.client.clone();
                let semaphore = self.semaphore.clone();
                let cancel_token = self.cancel_token.child_token();
                let broadcast_tx = self.broadcast_tx.clone();

                let handle = tokio::spawn(async move {
                    start_endpoint_loop(ep.id, pool, client, semaphore, cancel_token, broadcast_tx)
                        .await;
                });

                self.active_tasks.insert(ep.id, handle);
            }
        }

        // Clean up tasks for endpoints that are no longer active
        let mut to_remove = Vec::new();
        for id in self.active_tasks.keys() {
            if !found_ids.contains(id) {
                to_remove.push(*id);
            }
        }

        for id in to_remove {
            if let Some(handle) = self.active_tasks.remove(&id) {
                handle.abort(); // Cancel the task loop
            }
        }

        Ok(())
    }

    pub async fn run(mut self) {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    if let Err(e) = self.tick().await {
                        eprintln!("Error synchronizing scheduler tasks: {}", e);
                    }
                }
                _ = self.cancel_token.cancelled() => {
                    break;
                }
            }
        }

        // Graceful shutdown: abort all remaining task loops
        for handle in self.active_tasks.values() {
            handle.abort();
        }
    }

    pub fn shutdown(&self) {
        self.cancel_token.cancel();
    }
}

async fn start_endpoint_loop(
    endpoint_id: i64,
    pool: crate::db::DbPool,
    client: reqwest::Client,
    semaphore: Arc<Semaphore>,
    cancel_token: CancellationToken,
    broadcast_tx: Option<tokio::sync::broadcast::Sender<crate::api::sse::StatusEvent>>,
) {
    loop {
        // Fetch current endpoint config inside the loop to support dynamic updates
        let endpoint = match crate::db::repository::get_endpoint(&pool, endpoint_id).await {
            Ok(Some(ep)) => {
                if ep.is_active {
                    ep
                } else {
                    // Endpoint deactivated, safe to terminate loop
                    break;
                }
            }
            Ok(None) => {
                // Endpoint deleted, safe to terminate loop
                break;
            }
            Err(e) => {
                // Transient database error: log and retry after 5 seconds to prevent silent shutdown
                eprintln!(
                    "Transient database error fetching endpoint {}: {}. Retrying in 5 seconds...",
                    endpoint_id, e
                );
                tokio::select! {
                    _ = tokio::time::sleep(std::time::Duration::from_secs(5)) => {
                        continue;
                    }
                    _ = cancel_token.cancelled() => {
                        break;
                    }
                }
            }
        };

        // Calculate sleep duration: use 15-second retry interval if in false-positive suppression phase
        let sleep_secs = if endpoint.consecutive_failures > 0 && endpoint.status == "UP" {
            endpoint.retry_interval_seconds as f64
        } else {
            let interval = endpoint.interval_seconds as f64;
            let jitter_range = interval * endpoint.jitter_ratio;
            let mut rng = rand::thread_rng();
            let jitter = rand::Rng::gen_range(&mut rng, -jitter_range..jitter_range);
            (interval + jitter).max(1.0) // minimum 1 second sleep safety
        };

        tokio::select! {
            _ = tokio::time::sleep(std::time::Duration::from_secs_f64(sleep_secs)) => {
                // Acquire concurrency permit
                let permit = match semaphore.acquire().await {
                    Ok(p) => p,
                    Err(_) => break, // Semaphore closed, shutdown
                };

                let res = crate::polling::worker::execute_probe(&endpoint, &client).await;
                drop(permit); // Release permit immediately

                // Log metric
                if let Err(e) = crate::db::repository::log_ping_metric(
                    &pool,
                    endpoint.id,
                    res.status_code.map(|s| s as i32),
                    res.response_time_ms as i64,
                    res.is_success,
                )
                .await
                {
                    eprintln!("Failed to log metric for endpoint {}: {}", endpoint.id, e);
                }

                // Evaluate probe results and update status transitions
                if let Err(e) = crate::monitoring::evaluator::evaluate_probe_result(
                    &pool,
                    &endpoint,
                    res.is_success,
                    broadcast_tx.as_ref(),
                )
                .await
                {
                    eprintln!("Failed to evaluate status for endpoint {}: {}", endpoint.id, e);
                }
            }
            _ = cancel_token.cancelled() => {
                break;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db;
    use crate::db::repository::create_endpoint;

    #[tokio::test]
    async fn test_scheduler_sync_tasks() {
        // Initialize db in memory
        let pool = init_db("sqlite::memory:").await.unwrap();

        // Create an endpoint
        let endpoint = create_endpoint(
            &pool,
            "http://127.0.0.1:8080/health",
            "{}",
            60,
            10,
            15,
            3,
            0.20,
            None,
        )
        .await
        .unwrap();

        let mut scheduler = PollingScheduler::new(pool.clone(), None);

        // Execute tick - should spawn loop for endpoint
        scheduler.tick().await.unwrap();
        assert_eq!(scheduler.active_tasks.len(), 1);
        assert!(scheduler.active_tasks.contains_key(&endpoint.id));

        // Deactivate endpoint in DB
        sqlx::query("UPDATE endpoints SET is_active = 0 WHERE id = ?")
            .bind(endpoint.id)
            .execute(&pool)
            .await
            .unwrap();

        // Tick again - should clean up task
        scheduler.tick().await.unwrap();
        assert_eq!(scheduler.active_tasks.len(), 0);
    }

    #[tokio::test]
    async fn test_scheduler_db_error_retry() {
        let pool = init_db("sqlite::memory:").await.unwrap();
        let endpoint = create_endpoint(
            &pool,
            "http://127.0.0.1:8080/health",
            "{}",
            60,
            10,
            15,
            3,
            0.20,
            None,
        )
        .await
        .unwrap();

        let cancel_token = CancellationToken::new();
        let semaphore = Arc::new(Semaphore::new(50));
        let client = reqwest::Client::new();

        // Spawn start_endpoint_loop
        let loop_token = cancel_token.child_token();
        let pool_clone = pool.clone();
        let handle = tokio::spawn(async move {
            start_endpoint_loop(endpoint.id, pool_clone, client, semaphore, loop_token, None).await;
        });

        // Sleep briefly to ensure loop started
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;

        // Force DB error by dropping endpoints table
        sqlx::query("DROP TABLE endpoints")
            .execute(&pool)
            .await
            .unwrap();

        // Sleep briefly to check if the loop is still running (retrying)
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        // Assert the task handle is still active (not aborted)
        assert!(!handle.is_finished());

        // Cancel cleanly
        cancel_token.cancel();
        let _ = tokio::time::timeout(std::time::Duration::from_secs(1), handle)
            .await
            .unwrap();
    }
}
