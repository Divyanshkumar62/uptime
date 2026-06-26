# Architecture Decision Records (ADRs)

This document details the critical architectural decisions approved for the Lightweight Stateless Monitoring Engine.

## ADR-001: Execution Runtime Selection
- **Status:** `[Observed]` Approved
- **Context:** `[Observed]` The monitoring engine requires rapid, concurrent health probes with minimal memory and CPU overhead to avoid resource exhaustion or kernel panics on small VM instances (`[Observed]`).
- **Decision:** `[Observed]` Selected a Native Compiled Runtime utilizing Rust.
- **Options Considered:**
  - `[Observed]` Native Compiled Runtime (Rust)
  - `[Observed]` Managed VM Runtime (Spring Boot)
- **Trade-offs / Rationale:** `[Assumed]` Rust offers deterministic resource utilization, high concurrency primitives, and very small deployment footprints. This eliminates the CPU/Memory bloat of managed runtime environments, matching the performance criteria.
- **Evidence:** `[Observed]` [architecture_inputs.md](file:///c:/dungeon/uptime/docs/architecture/architecture_inputs.md) Section "Runtime".

---

## ADR-002: Persistence Strategy Selection
- **Status:** `[Observed]` Approved
- **Context:** `[Observed]` The system must record health status history, failure counters, and latency data over a 30-day retention window (`[Observed]`). It operates as a single-instance daemon (`[Observed]`).
- **Decision:** `[Observed]` Selected an Embedded Relational Store utilizing SQLite.
- **Options Considered:**
  - `[Observed]` Embedded Relational Store (SQLite)
  - `[Observed]` External Persistence Layer (Deferred for v1)
- **Trade-offs / Rationale:** `[Assumed]` An embedded relational database eliminates network roundtrip latency, simplifies zero-downtime setup for single-instance installations, and easily sustains the required concurrency boundaries without external database administrative burdens.
- **Evidence:** `[Observed]` [architecture_inputs.md](file:///c:/dungeon/uptime/docs/architecture/architecture_inputs.md) Section "Persistence".

---

## ADR-003: Real-Time Event Communication Model
- **Status:** `[Observed]` Approved
- **Context:** `[Observed]` Real-time updates of endpoint status changes must be delivered to browser clients within 2 seconds (`[Observed]`). Edge proxies and NAT environments frequently drop idle WebSockets (`[Observed]`).
- **Decision:** `[Observed]` Selected Server-Sent Events (SSE).
- **Options Considered:**
  - `[Observed]` Server-Sent Events (SSE)
  - `[Observed]` Persistent WebSockets (Explicitly Out of Scope)
- **Trade-offs / Rationale:** `[Assumed]` SSE is an HTTP-native protocol that supports native browser automatic reconnection, operates transparently through corporate firewalls/proxies without dropping connections, and uses stateless HTTP connections.
- **Evidence:** `[Observed]` [architecture_inputs.md](file:///c:/dungeon/uptime/docs/architecture/architecture_inputs.md) Section "Monitoring Strategy".

---

## ADR-004: Alerting Integration Model
- **Status:** `[Observed]` Approved
- **Context:** `[Observed]` Engineers need immediate failure alerts. The system should avoid the operational limits of generic SMS integrations during v1 development (`[Observed]`).
- **Decision:** `[Observed]` Selected Meta WhatsApp Cloud API for message templates and Twilio webhooks for call handling.
- **Options Considered:**
  - `[Observed]` Meta WhatsApp Cloud API and Twilio webhook integration
  - `[Observed]` Generic SMS / Third-Party SMS (Explicitly Out of Scope)
- **Trade-offs / Rationale:** `[Assumed]` Direct WhatsApp alerting enables templated group alerts with high delivery reliability. Integrating Twilio webhook call handling allows high-priority voice alerts.
- **Evidence:** `[Observed]` [architecture_inputs.md](file:///c:/dungeon/uptime/docs/architecture/architecture_inputs.md) Section "Monitoring Strategy".

---

## ADR-005: Authentication Strategy
- **Status:** `[Observed]` Approved
- **Context:** `[Observed]` The CRUD administration REST APIs and Web UI require secure authentication, restricted to a single administrator in v1 (`[Observed]`).
- **Decision:** `[Observed]` API Key authentication for the REST APIs, and Session Cookie authentication for the Web UI.
- **Options Considered:**
  - `[Observed]` API Key (REST) + Session Cookie (Web UI)
  - `[Observed]` Role-Based Access Control (RBAC) (Explicitly Out of Scope)
- **Trade-offs / Rationale:** `[Assumed]` Simple API Key and Session Cookie validation are easy to secure, preventing complex JWT or OAuth overhead while meeting security criteria for a single-tenant internal tool.
- **Evidence:** `[Observed]` [architecture_inputs.md](file:///c:/dungeon/uptime/docs/architecture/architecture_inputs.md) Section "Authentication".
