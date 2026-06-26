# Implementation Roadmap

This document outlines the phased development sequence for the Lightweight Stateless Monitoring Engine.

## Phase 1: Core & Schema Scoping
- **Goal:** Establish core polling mechanics and database structure.
- **Milestones:**
  1. `[Observed]` Design the localized relational schema structures for SQLite.
  2. `[Observed]` Implement the Polling Engine scheduler with randomized jitter (±20%) and User-Agent rotation.
  3. `[Observed]` Implement the consecutive failure counter and retry scheduler (15-second retries).
  4. `[Observed]` Validate false-positive suppression logic up to 3 consecutive failures.

## Phase 2: Logic & API Requirements
- **Goal:** Expose management interfaces, real-time update channels, and alerting services.
- **Milestones:**
  1. `[Observed]` Implement the REST CRUD endpoints for endpoints management (API Key authenticated).
  2. `[Observed]` Implement the Session-Cookie-based Web UI access and the Server-Sent Events (SSE) update channel.
  3. `[Observed]` Integrate the Meta WhatsApp Cloud API templated notification dispatches.
  4. `[Observed]` Integrate Twilio webhooks for call handling during outage events.
  5. `[Observed]` Implement the p99 latency metric calculation logic on database values.
  6. `[Observed]` Implement the daily scheduled cleanup worker for data older than 30 days.

## Verification & Dark Launch Phase
- **Goal:** Verify reliability and accuracy before production replacement.
- **Milestones:**
  1. `[Observed]` Run the new engine in parallel with the old system (dark launch) to verify alert accuracy without duplicate messaging.
  2. `[Observed]` Validate memory usage bounds remain under 50MB RAM under full load (500+ endpoints).
  3. `[Observed]` Validate SSE client connection stability and automatic reconnect behavior behind test proxies.
