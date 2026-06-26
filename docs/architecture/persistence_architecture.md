# Persistence Architecture

This document describes the data storage strategy, transaction boundaries, and data retention policies for the Lightweight Stateless Monitoring Engine.

## 1. Storage Choice & Engine
- **Storage Choice:** `[Observed]` SQLite (Embedded Relational Store) (`[Observed]`).
- **Concurrency Mode:** `[Assumed]` Configured in Write-Ahead Log (WAL) mode to permit concurrent read queries (e.g. REST API latency fetches and SSE update reads) during active write operations (e.g. background health check logging).
- **Data Safety:** `[Observed]` Single-instance file persistence. Automatic daily database backup strategy to handle disaster recovery with a maximum acceptable data loss (RPO) of 24 hours (`[Observed]`).

## 2. Relational Schemas (Logical Structure)
Without specifying concrete SQL DDL, the database organizes data into three distinct architectural models:

- **Monitored Endpoints Schema:** `[Observed]` Stores configuration parameters for target endpoints (e.g., target URL, request headers, interval settings, active flags, JSON validation keys, consecutive failure limits).
- **Ping History and Latency Metrics Schema:** `[Observed]` High-frequency time-series logging of individual probe events containing status code, response time (latency), execution timestamp, and success status.
- **System Alert & Status Transitions Log Schema:** `[Observed]` Records historical status transition events (e.g., Up -> Down, Down -> Up) with consecutive failures count, transition timestamps, and alert confirmation references.

## 3. Indexing Principles
To support fast REST API queries and p99 latency aggregations:
- **Sequential Primary Keys:** `[Observed]` Primary keys use sequential identifiers to optimize data layouts.
- **Composite Indexes:** `[Assumed]` Composite indexes must follow the left-prefix rule (e.g., matching target endpoint ID first, followed by timestamp ranges) to ensure fast query times for p99 latency trend analysis over the 30-day window.

## 4. Data Retention and Maintenance
- **Retention Limit:** `[Observed]` Health metrics and status history are maintained for 30 days (`[Observed]`).
- **Purging Mechanism:** `[Observed]` A daily scheduled cleanup worker executes a delete transaction to remove records older than 30 days (`[Observed]`).
