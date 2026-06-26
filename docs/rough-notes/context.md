1. Project Context & Motivation
We are transitioning away from off-the-shelf, stateful monitoring solutions to a custom, lightweight, and highly reliable alternative. The previous infrastructure suffered from architectural bloat and deep network incompatibilities when operating behind edge proxies and strict cloud NAT environments. The objective is to build a lean, stateless engine designed explicitly for microservices monitoring, drawing on robust, production-grade engineering principles utilized in high-performance API tools.

2. Core Problems & Challenges Addressed
Fragile Stateful Connections (The Blank Screen): Relying on persistent WebSockets to stream UI state creates a highly fragile environment. Cloud firewalls and edge proxies silently drop idle TCP connections, causing the frontend to lose sync, crash, and render blank screens.

The "Thundering Herd" Concurrency Spike: Default polling engines often blast all target endpoints simultaneously. This triggers Web Application Firewalls (WAF) to flag the bursts as malicious bot traffic, resulting in false-positive HTTP 500 errors.

SSL Handshake Failures (HTTP 525): Strict SSL validation policies clash with rapid, unoptimized synthetic polling, causing secure handshakes to be dropped by the proxy network.

Resource Bloat: Running a heavy JavaScript runtime environment just to ping REST endpoints consumes unnecessary compute memory, leading to kernel panics and Out-Of-Memory (OOM) states on smaller machines.

3. Target Architecture
A stable, distributed monitoring tool requires a fundamental shift away from stateful UI dependency toward a decoupled, background-first design.

The Polling Engine (Rust / Spring Boot): A fast, compiled backend daemon handling a precise, scheduled worker loop. This minimizes memory overhead while allowing for granular control over network connection pooling and TCP keep-alives.

Stateless Frontend Communication: Instead of WebSockets, the backend will expose a simple REST API or utilize Server-Sent Events (SSE) for real-time frontend updates. SSE is natively supported by browsers, automatically handles reconnections, and is not aggressively terminated by edge proxies.

Distributed Datastore: A localized, low-latency database to track historical ping data, uptime percentages, and failure counts efficiently.

Smart Polling Workers: Network workers designed to iterate through the endpoint list using artificial delays (jitter) and proper User-Agent header spoofing to easily bypass WAF bot-detection layers.

4. Essential Feature Set
Intelligent Synthetic Probes: Standard HTTP/HTTPS probes targeting specific health APIs, validating responses by checking for expected JSON keys or explicit 200 OK status codes.

Direct Meta WhatsApp Alerting: Native integration with the Meta WhatsApp Cloud API. Utilizing Meta Direct tokens is far superior for pure development and testing environments than navigating the limits of third-party SMS providers. When an API fails, the system will broadcast a templated alert directly to the engineering group chat.

False-Positive Suppression: Implementing a strict consecutive failure threshold before marking a service as "Down". If an endpoint drops a packet, the engine waits and retries, suppressing noise and preventing alert fatigue.

Service Degradation Tracking: Tracking p99 latency for crucial API paths, shifting the monitoring focus from simple binary uptime to identifying early symptoms of architectural bottlenecks.