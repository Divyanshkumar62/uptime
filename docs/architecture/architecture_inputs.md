# Architecture Inputs

## Runtime

* Runtime: Rust
* Reason: Native compiled runtime optimized for long-running polling workloads, low memory usage, and minimal operational overhead.

---

## Persistence

* Datastore: SQLite
* Storage Model: Embedded relational database
* Historical Data Retention: 30 days
* Automatic Purge: Daily scheduled cleanup
* Future: Configurable retention period

---

## Authentication

* REST API: API Key
* Web UI: Session Cookie
* User Roles: Single Administrator (v1)

---

## Deployment

Primary Deployment:

* Docker Container

Supported Deployment:

* Native Linux Binary

Development:

* `cargo run`

---

## Hosting Targets

* Bare Metal Linux Server
* Docker
* Cloud Virtual Machine

Kubernetes is **not required** for v1.

---

## Scale Targets

Current Supported:

* 500 monitored endpoints

Recommended Maximum (v1):

* 2000 monitored endpoints

Long-Term Target:

* 5000 monitored endpoints

---

## Multi-Tenancy

* Single Tenant (v1)

Future:

* Multi-Tenant SaaS support may be introduced in later versions.

---

## Disaster Recovery

Backup Strategy:

* Automatic daily database backup

Recovery:

* Manual restore procedure

Maximum Acceptable Data Loss (RPO):

* 24 hours

Recovery Objective:

* Restore service within operational maintenance window.

---

## Compliance

Current Compliance Requirements:

* None

Current Product Scope:

* Internal Engineering Tool

Future:

* Compliance requirements may be introduced for enterprise deployments.

---

## Monitoring Configuration

Default Polling Interval:

* 60 seconds

Minimum Polling Interval:

* 15 seconds

Maximum Polling Interval:

* 3600 seconds

Probe Timeout:

* 10 seconds

Retry Interval:

* 15 seconds

Failure Threshold:

* 3 consecutive failures

Jitter:

* ±20%

User-Agent Strategy:

* Random rotation from a configurable User-Agent pool.
* Administrators may extend or modify the pool.

---

## Capacity Planning

Expected Average Endpoint Response Time:

* 500 ms

Maximum Probe Timeout:

* 10 seconds

Maximum Concurrent Active Probes:

* 50

Worker Scheduling:

* Distributed using randomized jitter

Historical Data Retention:

* 30 days

Deployment Model:

* Single Instance (v1)

Availability Target:

* 99.9%

Frontend Update SLA:

* Status updates visible within 2 seconds.

Monitoring Strategy

Probe Type:
- Intelligent Synthetic HTTP/HTTPS Probes

Validation:
- HTTP Status Code
- Expected JSON Keys

Alert Suppression:
- 3 Consecutive Failures
- 15 Second Retry Interval

Traffic Distribution:
- Randomized Jitter (±20%)
- Configurable User-Agent Rotation

Real-Time Updates:
- Server-Sent Events (SSE)

Latency Monitoring:
- p99 Response Time
- Historical Trends

Alerting:
- Twilio webhook integration for call handling
- Meta WhatsApp Cloud API

## Out of Scope (v1)

- Multi-region deployment
- Kubernetes
- Multi-tenancy
- Distributed clustering
- External database support
- Role-Based Access Control (RBAC)
- Plugin ecosystem
- Mobile application