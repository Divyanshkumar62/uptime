# uptime

> High-efficiency, self-hosted uptime monitoring engine built with Rust, React, and Docker.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Core: Rust](https://img.shields.io/badge/Engine-Rust%201.75+-orange.svg)](Cargo.toml)
[![Frontend: React](https://img.shields.io/badge/UI-React%20%2B%20TypeScript-61DAFB.svg)](frontend/)
[![Deployment: Docker](https://img.shields.io/badge/Container-Docker-2496ED.svg)](Dockerfile)

---

## Overview

`uptime` is a lightweight, low-overhead monitoring daemon designed for self-hosted infrastructure. Unlike heavy enterprise observability suites that consume gigabytes of memory, `uptime` uses native asynchronous Rust tasks to run continuous health checks across multiple network layers with negligible CPU and RAM footprints.

### Monitored Protocols & Services
* **HTTP / HTTPS:** Status code assertions, latency tracking, SSL certificate expiration countdowns, and response keyword matches.
* **TCP Probes:** Low-level port connectivity checks for custom daemons, SSH, and mail servers.
* **DNS Resolution:** Record propagation validation and nameserver response latency.
* **Databases & Caches:** Native health pings against PostgreSQL, MySQL, and Redis endpoints.
* **Container Health:** Real-time Docker container status inspection via local Docker socket.

---

## System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   uptime Architecture                  │
└────────────────────────────────────────────────────────┘
                           │
      ┌────────────────────┼────────────────────┐
      ▼                    ▼                    ▼
[ Rust Probe Engine ]  [ SQLite/Postgres ]  [ Real-Time UI ]
• Tokio Async Loop     • Historical Logs    • React Dashboard
• Protocol Dispatcher  • Incident Records   • Latency Graphs
• Threshold Alerter    • Metric Rollups     • Event Timeline
```

* **Core Engine (`src/`):** Implemented in Rust using `tokio` for non-blocking concurrent probes.
* **Frontend (`frontend/`):** Responsive React interface providing live status badges, incident timelines, and response latency graphs.
* **Schema Validation (`schemas/`):** Strict declarative configurations for monitoring targets.

---

## Quickstart

### Running with Docker Compose (Recommended)
```bash
git clone https://github.com/Divyanshkumar62/uptime.git
cd uptime

# Start monitoring daemon and dashboard
docker compose up -d
```

Access the dashboard at `http://localhost:3000`.

### Building from Source

#### Prerequisites
* Rust toolchain (Cargo 1.75+)
* Node.js 20+

```bash
# 1. Build Rust backend probe engine
cargo build --release

# 2. Build React frontend bundle
cd frontend
npm install
npm run build
cd ..

# 3. Launch monitoring engine
cargo run --release
```

---

## License
Distributed under the [MIT License](LICENSE).
