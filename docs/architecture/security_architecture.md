# Security Architecture

This document outlines the security boundaries, credential policies, and access controls for the Lightweight Stateless Monitoring Engine.

## 1. Access Control & Roles
- **Single Tenant Limit:** `[Observed]` The system operates as a single-tenant workspace in v1 (`[Observed]`). Multi-tenancy SaaS support is deferred to future releases (`[Observed]`).
- **Role Limits:** `[Observed]` Single Administrator role in v1. Role-Based Access Control (RBAC) is out of scope (`[Observed]`).

## 2. Authentication & Session Management
- **REST Admin Endpoint Validation:** `[Observed]` Authenticated via HTTP API Key headers (`[Observed]`).
- **Web UI & SSE Connections:** `[Observed]` Secured via cryptographic Session Cookies (`[Observed]`).
- **Data Ownership Isolation:** `[Assumed]` All API parameters are validated at the authentication boundary. Requests that do not match the single Administrator context are rejected before hitting the persistence layer.

## 3. Data Protection & External API Safety
- **Alert Payload Security:** `[Observed]` WhatsApp alerts must contain only public service names, failure statuses, and timestamps. Sensitive credentials or private parameters must not be sent in alert payloads (`[Observed]`).
- **Network Traffic Anonymization:** `[Observed]` Rotates User-Agent headers from a configurable pool to prevent target WAFs from blocking monitoring checks (`[Observed]`).
- **Persistence Protection:** `[Assumed]` Access to the local SQLite database file is restricted to the execution system process boundary.
