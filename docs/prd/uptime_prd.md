# Product Requirement Document (PRD): Lightweight Stateless Monitoring Engine

## 1. Product Vision & Business Goal
- **Product Vision:** `[Observed]` Build a lean, stateless monitoring engine designed explicitly for microservices monitoring, transitioning away from off-the-shelf, stateful solutions to a custom, lightweight, and highly reliable alternative.
- **Business Goals:**
  - `[Observed]` Eliminate architectural bloat and deep network incompatibilities when operating behind edge proxies and strict cloud NAT environments.
  - `[Observed]` Resolve fragile stateful connections that drop and cause blank screens.
  - `[Observed]` Avoid thundering herd concurrency spikes that trigger WAF bot flagging and false-positive HTTP 500 errors.
  - `[Observed]` Optimize secure SSL handshakes to prevent HTTP 525 failures.
  - `[Observed]` Eradicate resource bloat (kernel panics, OOM states on small machines) by using a fast, compiled backend daemon rather than a heavy JavaScript runtime.
- **ICE Prioritization Score:**
  Status: Not enough information. Business stakeholders must assign Impact, Confidence and Effort.
- **Stakeholder Impact Analysis:**
  - *Engineering Team:* `[Observed]` Receives direct Meta WhatsApp templated alerts when services fail. `[Assumed]` Benefits from reduced false-positive noise and alert fatigue, and gains visibility into early architectural bottlenecks via p99 latency tracking.
  - *QA/Test Team:* `[Assumed]` Requires testing frameworks to validate synthetic probes (both happy path and alternate error scenarios) and to verify false-positive suppression logic.
  - *Operations/DevOps:* `[Observed]` Operates a lightweight backend daemon on smaller machines without OOM panics. `[Assumed]` Downstream consumers of localized historical ping data.
  - *End Users:* `[Assumed]` Experience higher overall application uptime due to faster detection and resolution of microservice failures.

## 2. Target Personas
- **Target Personas:**
  - *Software Engineer / Reliability Engineer (Persona Name: Alert-Weary Developer):*
    - *User Needs:* `[Observed]` High-signal alerts for API failures, suppression of temporary transient network drops, and visibility into p99 latency degradation.
    - *Friction Points Resolved:* `[Observed]` Alert fatigue caused by false positives; blank screens due to disconnected UI state; thundering herd blocks by local WAFs.
  - *System Administrator / Operator (Persona Name: Lean Infrastructure Admin):*
    - *User Needs:* `[Observed]` A lightweight monitoring daemon with low memory footprint that runs reliably behind proxies and NATs without OOM crashes.
    - *Friction Points Resolved:* `[Observed]` Compute resource bloat, OOM crashes, proxy-terminated WebSocket connections.

## 3. Structured User Journeys
- **Structured User Journeys:**
  - **Journey US-001: Automated Health Polling with Jitter**
    - As a Software Engineer, I want the system to poll my microservices endpoints with randomized delays (jitter) and spoofed User-Agents, so that the monitoring traffic bypasses WAF bot-detection policies and avoids thundering herd spikes.
    - *GIVEN:* A configured list of microservice target endpoints.
    - *WHEN:* The scheduled polling cycle triggers.
    - *THEN:* The engine iterates through the target endpoints, applying artificial delays (jitter) between requests and using customized User-Agent headers, successfully collecting response status and latency data.
  - **Journey US-002: False-Positive Suppression on Transient Drop**
    - As a Software Engineer, I want the engine to retry probes on initial failure before raising an alert, so that transient connection drops do not trigger false alerts.
    - *GIVEN:* An endpoint is currently marked "Up" and has a consecutive failure threshold `N`.
    - *WHEN:* A scheduled poll to the endpoint fails.
    - *THEN:* The engine suppresses the alert, schedules retries, and only changes the service status to "Down" and sends an alert if the failures reach the threshold `N`.
  - **Journey US-003: WhatsApp Failure Alerting**
    - As a Software Engineer, I want the system to send an instant templated message to our engineering group chat when an API fails, so that we can immediately begin troubleshooting.
    - *GIVEN:* An endpoint failure count exceeds the suppression threshold.
    - *WHEN:* The endpoint status changes to "Down".
    - *THEN:* The system formats and broadcasts a templated alert via the Meta WhatsApp Cloud API directly to the configured engineering chat.
  - **Journey US-004: Latency Degradation Tracking**
    - As a Software Engineer, I want to track the p99 response latency for critical paths, so that I can diagnose architectural bottlenecks before a full service outage occurs.
    - *GIVEN:* The engine successfully queries health APIs over time.
    - *WHEN:* Latency data is recorded in the distributed datastore.
    - *THEN:* The system calculates the p99 latency trend and displays it via the stateless frontend updates (SSE or REST API).

## 4. Assumptions & Business Clarifications Required
- **Business Clarifications Required:**
  1. What are the minimum and maximum limits, as well as the default value, for the consecutive failure threshold `N`?
  2. What is the minimum permitted polling interval frequency for target endpoints?
  3. What is the target connection timeout for synthetic probes?
  4. What specific delay interval should be used between consecutive retry probes?
  5. What is the fallback/queuing strategy if the Meta WhatsApp Cloud API rejects alert message templates (e.g. rate limiting or credential issues)?
  6. What are the browser Server-Sent Events (SSE) client-side reconnection backoff limits?
  7. Does the system support a "Degraded" status when p99 latency exceeds a limit? If so, what is that limit, and what is the transition logic?
  8. Does the system require "Paused" or "Disabled" endpoint states to temporarily stop polling?
  9. Is authentication/authorization required to access the CRUD REST APIs and SSE streams, or are they unauthenticated?
  10. What is the expected behavior if a health probe returns a non-JSON body when JSON key validation is enabled?
- **Assumptions (Temporary):**
  - *Assumption (Temporary):* Basic token-based authentication will be used for CRUD APIs - *Rationale:* Required to prevent unauthorized endpoint registration prior to final security review.
  - *Assumption (Temporary):* Non-JSON response bodies will be treated as validation failures when JSON key validation is enabled - *Rationale:* Necessary to avoid false-positives when target endpoints return raw HTML errors (like 502/504 Bad Gateway screens).

## 5. Ambiguities & Missing Requirements
- **Ambiguities:**
  - Jitter range: `Not Specified` (Business Clarification Required).
  - Spoofed User-Agent list: `Not Specified` (Business Clarification Required).
- **Missing Requirements:**
  - Endpoints CRUD management flow: `Not Specified` (Business Clarification Required).
  - Target timeout thresholds and retry intervals: `Not Specified` (Business Clarification Required).
  - Meta WhatsApp rate limit fallbacks: `Not Specified` (Business Clarification Required).
  - SSE client reconnection parameters: `Not Specified` (Business Clarification Required).
  - Access control and authentication scope: `Not Specified` (Business Clarification Required).
  - Status transitions for Degraded or Paused endpoints: `Not Specified` (Business Clarification Required).

## 6. Dependencies & Risks
- **Dependency Mapping:**
  - *External Dependencies:*
    - Meta WhatsApp Cloud API: Required for direct alerting.
    - Network Proxies / Firewalls: The engine must bypass or operate within edge proxies and strict cloud NAT environments.
  - *Internal Dependencies:*
    - Localized Distributed Datastore: Required to store ping history, failure counts, and latency statistics.
- **Dependency Risk Analysis:**
  - *Meta WhatsApp Cloud API (Risk: High):*
    - *Consequence:* If the WhatsApp Cloud API goes down or the rate limits are exceeded, critical alerts will be lost.
    - *Mitigation:* `[Assumed]` Implement local retry queues and fallback status logs in the console/file system when WhatsApp API calls fail.
  - *Localized Datastore Connectivity (Risk: Medium):*
    - *Consequence:* If the datastore fails to write, historical metrics and failure thresholds cannot be tracked, causing suppression failure.
    - *Mitigation:* `[Assumed]` Keep tracking states in-memory during datastore downtime and write alerts synchronously if state storage is inaccessible.
- **Risk Assessment:**
  - *Implementation Complexity (Medium):* Decoupled backend loop with jitter, SSE reconnection logic, and Meta API integration requires precise implementation.
  - *Regression Risk (Low):* This is a custom alternative being built to replace an old system, minimizing regression risks on existing systems, but monitoring accuracy must be validated.

## 7. Functional Requirements & Invariants
- **Functional Requirements:**
  - **FR-001: Synthetic Probing Engine**
    - The engine must support health checks targeting health APIs via standard HTTP/HTTPS protocols.
    - The engine must support response body validation (verifying expected JSON keys) or response status checking (e.g., HTTP 200 OK).
  - **FR-002: Smart Scheduling with Jitter**
    - The engine must space out endpoint checks using a randomized delay (jitter).
    - The engine must utilize spoofed User-Agent headers to avoid bot flagging.
  - **FR-003: False-Positive Suppression**
    - The engine must track consecutive failures for each endpoint.
    - The engine must only transition an endpoint status to "Down" after failures cross the threshold.
  - **FR-004: WhatsApp Alerting**
    - The engine must send alerts via the Meta WhatsApp Cloud API using Meta Direct tokens.
    - Alerts must be sent to the configured engineering group chat using approved message templates.
  - **FR-005: Latency Tracking**
    - The system must capture and store response times for health checks.
    - The system must compute p99 latency for target endpoints over configurable windows.
  - **FR-006: Stateless Frontend Communication**
    - The system must expose real-time updates via Server-Sent Events (SSE) and provide historical data via a stateless REST API.
- **Business Invariants:**
  - **BR-001:** An endpoint must not be marked "Down" until the consecutive failure threshold is exceeded.
  - **BR-002:** The consecutive failure count for an endpoint must reset to 0 immediately upon a successful response.
  - **BR-003:** p99 latency values calculated must always be non-negative.

## 8. Acceptance Criteria
- **AC-001 (for FR-001):**
  - *GIVEN:* An endpoint configured for health checks.
  - *WHEN:* A probe is triggered and the target returns the expected JSON keys or HTTP 200 OK.
  - *THEN:* The system registers a success and records the latency.
- **AC-002 (for FR-002):**
  - *GIVEN:* Multiple configured endpoints.
  - *WHEN:* The scheduling engine fires a polling pass.
  - *THEN:* The requests are distributed using randomized jitter and spoofed User-Agent headers.
- **AC-003 (for FR-003):**
  - *GIVEN:* An endpoint marked "Up" with consecutive failure threshold `N`.
  - *WHEN:* The endpoint fails single probes up to `N - 1` times.
  - *THEN:* The endpoint remains in "Up" state and no alerts are sent.
- **AC-004 (for FR-003):**
  - *GIVEN:* An endpoint marked "Up" with consecutive failure threshold `N`.
  - *WHEN:* The endpoint fails `N` times consecutively.
  - *THEN:* The status transitions to "Down".
- **AC-005 (for FR-004):**
  - *GIVEN:* An endpoint transitions to "Down".
  - *WHEN:* The alerting rule is active.
  - *THEN:* A WhatsApp message is dispatched to the engineering chat template.
- **AC-006 (for FR-005):**
  - *GIVEN:* Recorded latency history for an endpoint.
  - *WHEN:* A client requests health history.
  - *THEN:* The p99 latency is computed and served.
- **AC-007 (for FR-006):**
  - *GIVEN:* An active SSE connection between browser and backend.
  - *WHEN:* An endpoint transitions status state.
  - *THEN:* The backend pushes a real-time event to the browser.

## 9. Non-Functional Requirements (NFR)
- **Non-Functional Requirements:**
  - **NFR-001: Availability**
    - `[Assumed]` Polling daemon availability of 99.9% to ensure reliable microservice tracking.
  - **NFR-002: Performance/Latency**
    - `[Assumed]` Backend daemon CPU and memory usage must remain low (e.g., <50MB RAM usage under standard load). SSE updates should stream within 2 seconds of status changes.
  - **NFR-003: Scalability**
    - `[Assumed]` Capable of polling up to 500 endpoints concurrently with jitter configurations without memory exhaustion.
  - **NFR-004: Reliability**
    - `[Observed]` Automatically handle SSE reconnections natively in browsers.
  - **NFR-005: Data Retention**
    - `[Assumed]` Historical ping data stored for a minimum of 30 days.

## 10. Scope Assessment (MoSCoW)
- **Must Have:**
  - Scheduled HTTP/HTTPS synthetic probes with configurable intervals.
  - Spoofed User-Agent headers and customizable jitter between polls.
  - Consecutive failure suppression logic.
  - Direct Meta WhatsApp Cloud API integration for alerting.
  - SSE real-time updates for status transitions.
- **Should Have:**
  - Validation of specific JSON keys in the probe response body.
  - p99 latency calculation for endpoints.
  - CRUD REST APIs to manage monitored endpoints list.
- **Could Have:**
  - Web UI dashboard displaying status history and p99 latency charts.
  - SSL certificate expiration monitoring.
- **Out Of Scope (Won't Have):**
  - Persistent WebSocket streams for real-time frontend updates (explicitly deferred).
  - Integration with third-party SMS providers (e.g., Twilio).
  - Complex user permissions and RBAC (Role-Based Access Control) in the initial release.
- **Feature Flag & Rollout Planning:**
  - `[Assumed]` Deploy the new monitoring engine in parallel with the old system (dark launch) to verify alert matching and probe reliability before decomissioning the old system. Use a feature flag to toggle WhatsApp alerts on/off.
- **Compliance & PII Boundaries:**
  - `[Assumed]` The system logs target endpoint URLs and latencies. No PII should be passed in health endpoint URLs.
  - `[Assumed]` WhatsApp alerts will contain only public service names, failure statuses, and timestamps; no customer credentials or private data will be sent in messages.

## 11. Success Metrics & Telemetry
- **Telemetry & Analytics Planning:**
  - `[Assumed]` Track internal system health events, such as polling daemon loops executed, datastore write counts, WhatsApp API attempt and success rates.
- **Product Success Metrics:**
  - *Adoption Metrics:* Number of endpoints configured and active.
  - *Engagement Metrics:* Count of SSE connection streams active by users.
  - *Operational Metrics:* Polling daemon memory usage, CPU load on the daemon, probe latency measurement overhead.
  - *Failure Metrics:* WhatsApp API error rates, datastore write exception rates, false-alert rate (measured by operator feedback/tickets).

## 12. Implementation Roadmap & Milestones
- **Phase 1 (Core & Schema Scoping):**
  - Define the localized datastore requirements (for storing endpoints list, ping histories, and failure logs).
  - Implement the core synthetic prober loop with jitter and User-Agent spoofing.
  - Build the consecutive failure threshold suppression logic.
- **Phase 2 (Logic & API Requirements):**
  - Expose the REST APIs for endpoint CRUD.
  - Implement SSE (Server-Sent Events) streaming for frontend clients.
  - Integrate Meta WhatsApp Cloud API templated notification engine.
  - Implement p99 latency aggregation logic.

## 13. PRD Confidence Score
- **PRD Confidence Score:** 80/100
- **Rationale:** Gaps identified by QA audit have been explicitly categorized and moved to the blocking "Business Clarifications Required" section to prevent speculative solutions. Requirement identifiers (US, FR, NFR, BR, AC) are now strictly mapped.
