# Architecture Overview: Lightweight Stateless Monitoring Engine

## 1. Executive Summary
- **System Goal:** `[Observed]` Build a lightweight, stateless monitoring daemon optimized for microservices monitoring with a minimal operational footprint, eliminating stateful connection bloat and thundering herd concurrency issues.
- **Primary Runtime:** `[Observed]` Rust.
- **Primary Persistence:** `[Observed]` SQLite (Embedded Relational Store).
- **Primary Deployment:** `[Observed]` Single-instance Docker container.

## 2. Architectural Core Concerns
- **Compute Model:** `[Observed]` Native Compiled Runtime execution model (`[Observed]`). This guarantees a low memory footprint (<50MB RAM target `[Observed]`) and high concurrency capacity without virtual machine overhead.
- **Persistence Layer:** `[Observed]` Embedded Relational Store (`[Observed]`). It provides ACID transaction guarantees locally, eliminating the need for an external database network hop for v1 (`[Observed]`).
- **Communication Pattern:** `[Observed]` Stateless REST APIs for configuration CRUD management (`[Observed]`), and unidirectional Server-Sent Events (SSE) for real-time frontend updates (`[Observed]`). Persistent WebSockets are out of scope (`[Observed]`).
- **Execution Model:** `[Observed]` A decoupled, background-first design where network workers execute scheduled health checks with randomized delays (jitter) (`[Observed]`) and spoofed User-Agents (`[Observed]`).

## 3. Scope Boundaries
- **In Scope (v1):**
  - `[Observed]` Synthetic HTTP/HTTPS health checks.
  - `[Observed]` Randomized jitter distribution (±20%) and User-Agent rotation.
  - `[Observed]` False-positive suppression logic (3 consecutive failures).
  - `[Observed]` Meta WhatsApp Cloud API templated alerting.
  - `[Observed]` Twilio webhook integration for call handling.
  - `[Observed]` Browser Server-Sent Events (SSE) updates.
  - `[Observed]` Single Admin role with API Key (REST) and Session Cookie (Web UI) authentication.
- **Out of Scope (v1):**
  - `[Observed]` Multi-region deployment.
  - `[Observed]` Kubernetes.
  - `[Observed]` Multi-tenancy SaaS support.
  - `[Observed]` Distributed clustering.
  - `[Observed]` External database support.
  - `[Observed]` Role-Based Access Control (RBAC).
  - `[Observed]` Plugin ecosystem.
  - `[Observed]` Mobile application.
