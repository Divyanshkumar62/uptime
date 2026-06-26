# Scaling Strategy

This document outlines the scaling strategy for the Lightweight Stateless Monitoring Engine from the initial release to long-term scalability targets.

## 1. Concurrency Boundaries & Scale Targets
- **Current Target:** `[Observed]` 500 monitored endpoints (`[Observed]`).
- **v1 Max Target:** `[Observed]` 2000 monitored endpoints (`[Observed]`).
- **Long-Term Target:** `[Observed]` 5000 monitored endpoints (`[Observed]`).
- **Concurrent Active Probe Cap:** `[Observed]` Capped at 50 concurrent active checks (`[Observed]`).

## 2. Scaling within Single Instance (v1)
- **Asynchronous Execution Model:** `[Observed]` Using Rust's native asynchronous execution boundaries, the engine schedules hundreds of endpoints using a small number of system threads, keeping memory footprint under 50MB RAM (`[Observed]`).
- **Embedded Database Concurrency:** `[Assumed]` By enabling SQLite Write-Ahead Log (WAL) mode, the system allows concurrent reads of status and latency metrics without blocking the background writer logging check results.
- **Connection Reuse:** `[Assumed]` Health probe HTTP connections use TCP keep-alives and reuse connection sockets to prevent socket exhaustion when executing up to 2000 checks periodically.

## 3. Scale-Up Path & Evolution (Out of Scope v1)
- **External Persistence Transition:** `[Observed]` To support the long-term target of 5000+ endpoints, the system can transition from the local SQLite storage model to an External Relational Persistence Layer (e.g. PostgreSQL) or an In-Memory Cache for fast metrics processing.
- **Distributed Clustering:** `[Observed]` If the polling demand exceeds single-node capacity, the architecture can evolve from a Single Instance to a Distributed Clustering model with centralized coordination.
- **Multi-Region Deployments:** `[Observed]` Out of scope for v1. Later versions can distribute polling workers across multiple regions to check targets from different geographic edge points.
