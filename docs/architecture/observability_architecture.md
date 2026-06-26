# Observability & Diagnostics Architecture

This document describes the observability, logging, and error-diagnostics patterns designed for the Lightweight Stateless Monitoring Engine.

## 1. Observability Core Concerns
- **Performance Metrics:** `[Observed]` The system captures probe latency times, counting success rates, failure rates, and computing p99 response trends over 30 days (`[Observed]`).
- **Telemetry Collection:** `[Observed]` Tracks background process health metrics (polling execution rates, datastore write counts, and WhatsApp/Twilio API delivery statuses) (`[Observed]`).
- **Traceability:** `[Assumed]` Logs trace propagation using unified correlation IDs to trace individual health check transactions from scheduling trigger to API execution and final persistence.

## 2. Production Failure Vectors & Diagnostics

### Question 1: How will this fail?
- **Failure Vector A (External Alerting Outage):** `[Observed]` The Meta WhatsApp Cloud API rejects alert message templates (e.g. rate limit bounds, token expiration) (`[Observed]`).
- **Failure Vector B (Network Timeout Storm):** `[Assumed]` Slow target endpoints consume all 50 concurrent active check tasks, delaying the scheduling of other targets.
- **Failure Vector C (Persistence Write Blocker):** `[Assumed]` Disk I/O exhaustion locks the local SQLite database file, preventing latency writes and failure count state logging.

### Question 2: How will we detect it?
- **For External Alerting Failures:** `[Observed]` Logging daemon catches HTTP error codes from the Meta WhatsApp Cloud API and records them locally.
- **For Network Timeout Storms:** `[Assumed]` Metrics track the execution time of scheduling loops. If loops overrun the 15-second minimum interval, an alert state is raised.
- **For Database Lockouts:** `[Assumed]` The engine monitors write timeouts. Errors writing latency data are logged immediately.

### Question 3: How will we debug it?
- **Trace correlation:** `[Assumed]` Correlation IDs link the scheduled target probe ID, the executed network HTTP span, and the resulting SQLite database insert transaction.
- **Diagnostic Logging:** `[Observed]` Structured console logs track when suppression parameters are checked, when retries are triggered, and when the status changes.
