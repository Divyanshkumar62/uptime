# API Boundaries

This document defines the interface contracts, communication protocols, and request security boundaries for the Lightweight Stateless Monitoring Engine.

## 1. Protocols & Formats
- **REST Admin API:** `[Observed]` Standard JSON over HTTP/HTTPS for CRUD operations (`[Observed]`).
- **Real-Time Stream:** `[Observed]` Server-Sent Events (SSE) for unidirectional client updates (`[Observed]`). WebSockets are out of scope (`[Observed]`).

## 2. API Security Boundaries
- **Access Control:** `[Observed]` Single Administrator role in v1. No multi-tenancy or role-based configurations are present (`[Observed]`).
- **Authentication Hooks:**
  - `[Observed]` REST management endpoints require API Key verification in the HTTP request headers (`[Observed]`).
  - `[Observed]` Web UI and SSE stream connections require Session Cookie validation (`[Observed]`).
- **Envelope Wrapping:** `[Assumed]` All API responses are wrapped in generic structures to prevent leaking internal runtime exceptions or implementation-specific error traces to clients.

## 3. Resource Classifications

### Endpoints Configuration Resource (CRUD)
- **POST:** `[Observed]` Register a new monitored microservice endpoint.
- **GET:** `[Observed]` Retrieve the list of active/inactive monitored endpoints.
- **PUT / PATCH:** `[Observed]` Update endpoint target configurations (e.g. check intervals, JSON keys, headers) or pause monitoring.
- **DELETE:** `[Observed]` Remove an endpoint from the configuration registry.

### Latency and Status History Resource
- **GET:** `[Observed]` Fetch historical latency metrics and computed p99 statistics for a specific endpoint over the 30-day retention window.

### Real-Time Update SSE Stream
- **GET:** `[Observed]` Establish an event stream to receive immediate endpoint status changes (Up -> Down or Down -> Up) within 2 seconds of transition events (`[Observed]`).
