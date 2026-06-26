# Background Workers

This document describes the scheduling, execution concurrency, and traffic throttling of background tasks inside the Lightweight Stateless Monitoring Engine runtime.

## 1. Health Probe Scheduling Worker
- **Goal:** `[Observed]` Periodic execution of health checks targeting configured endpoints.
- **Interval Parameters:**
  - `[Observed]` Default Interval: 60 seconds.
  - `[Observed]` Minimum Interval: 15 seconds.
  - `[Observed]` Maximum Interval: 3600 seconds.
- **Traffic Jitter:** `[Observed]` Each probe execution applies a randomized offset of ±20% to the configured interval to prevent concurrent network spikes and avoid triggering WAF blocks.
- **Probe Timeout:** `[Observed]` The connection timeout for synthetic probes is capped at 10 seconds.
- **Concurrency Throttling:** `[Observed]` Capped at 50 concurrent active probes. Any pending checks exceeding this limit are queued or deferred to protect system file handles and CPU cycles.

## 2. False-Positive Retry Suppressor
- **Goal:** `[Observed]` Re-examine failing endpoints before triggering WhatsApp/Twilio alerting.
- **Trigger Condition:** `[Observed]` Initial failure of a health check probe.
- **Retry Mechanics:** `[Observed]` Re-probes the failing target service at a 15-second retry interval (`[Observed]`).
- **Suppression Limit:** `[Observed]` Suppresses state transitions and alerts until 3 consecutive failures are registered (`[Observed]`).

## 3. Data Retention Purge Worker
- **Goal:** `[Observed]` Maintain the database footprint by cleaning up metrics and status logs older than 30 days.
- **Execution Schedule:** `[Observed]` Executes once per day as a scheduled task.
- **Execution Logic:** `[Assumed]` Runs as a batch transaction that deletes stale rows from the persistence layer.
