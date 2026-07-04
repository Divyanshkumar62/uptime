<p align="center">
  <h1 align="center">Uptime</h1>
  <p align="center">
    A lightweight, self-hosted uptime monitoring engine built with Rust and React.<br/>
    Monitor HTTP, TCP, DNS, PostgreSQL, MySQL, Redis, and Docker services in real time.
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Rust-2024-blue?logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-6-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
</p>

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Alerting Channels](#alerting-channels)
- [Security](#security)
- [Development](#development)
- [Testing](#testing)
- [License](#license)

---

## Features

### Multi-Protocol Monitoring
- **HTTP/HTTPS** - Monitor endpoints with full request configuration: methods (GET, POST, PUT, DELETE, PATCH, HEAD), custom headers, JSON request bodies, and accepted status code ranges
- **TCP** - Verify port reachability on any host with configurable timeouts
- **DNS** - Resolve and validate A, AAAA, MX, CNAME, and TXT records against expected values with optional custom nameservers
- **PostgreSQL** - Ping and validate database connectivity with encrypted connection strings
- **MySQL** - Ping and validate database connectivity with encrypted connection strings
- **Redis** - Ping and validate database connectivity with encrypted connection strings
- **Docker** - Monitor Docker container health through a local Docker API proxy

### SSL Certificate Monitoring
- Automatic SSL certificate expiry tracking for all HTTPS endpoints
- Alerts at 14-day and 7-day thresholds with range-based tolerance for scheduler drift
- Daily background worker scans all HTTPS endpoints for upcoming expirations

### Real-Time Status Updates
- Server-Sent Events (SSE) endpoint streams status transitions (`UP`, `DOWN`, `SSL_EXPIRING_*`) to the frontend in real time
- Broadcast channel architecture ensures zero message loss between polling engine and alerting listeners

### Multi-Channel Alerting
- **WhatsApp** - Meta Cloud API template messages
- **Twilio** - Voice call alerts via TwiML webhooks
- **Slack** - Incoming webhook integration
- **Discord** - Incoming webhook integration
- **SMTP** - Email alerts via configurable SMTP transport
- **Generic Webhooks** - Custom HTTP methods, headers, and body templates with variable interpolation (`{status}`, `{monitorUrl}`, `{monitorName}`, `{errorMessage}`)

### Anti-Flapping & Throttling
- Per-endpoint configurable cooldown timer (`throttle_seconds`, default 900s)
- Cooldown is bypassed for `UP` resolution events to ensure recovery notifications always arrive
- Prevents alert storms during intermittent connectivity issues

### Encrypted Credential Storage
- AES-256-GCM encryption for database connection strings at rest
- Environment-variable-managed 32-byte hex encryption key
- No hardcoded keys or fallback credentials in the codebase

### Data Retention & Cleanup
- Background cleanup worker runs daily with configurable retention period (default 30 days)
- Automatic pruning of old `ping_metrics` and `status_alert_logs` records
- Idempotent cleanup with duplicate-deletion safety

### Frontend Dashboard
- **Monitor List** - View all endpoints with live status indicators, response times, and failure counts
- **Monitor Details** - Per-endpoint latency charts, incident history, and configuration editing
- **Integrations Page** - Configure all alerting channels from a unified settings panel
- **Register/Edit Modal** - Type-aware form with Zod schema validation that adapts fields based on monitor type
- **Login & Auth** - Session-based authentication with API key middleware

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│  Dashboard │ Monitor Details │ Integrations │ Login          │
│                         ↕ SSE                                │
├──────────────────────────────────────────────────────────────┤
│                     Axum API Server                          │
│  CRUD Endpoints │ SSE Stream │ Auth Middleware │ Settings     │
├──────────────────────────────────────────────────────────────┤
│                    Background Workers                         │
│  PollingScheduler │ SSL Expiry Worker │ Cleanup Worker       │
├──────────────────────────────────────────────────────────────┤
│                     Alerting Pipeline                         │
│  StatusEvent → Throttle Check → Multi-Channel Dispatch       │
│  (WhatsApp, Twilio, Slack, Discord, SMTP, Webhook)           │
├──────────────────────────────────────────────────────────────┤
│                    SQLite (WAL Mode)                          │
│  endpoints │ ping_metrics │ status_alert_logs │ settings     │
└──────────────────────────────────────────────────────────────┘
```

**Key design principles:**
- Stateless polling engine with database-driven configuration
- Broadcast channel for decoupled event distribution between polling, alerting, and SSE
- Encrypted secrets never leave the server boundary
- Frontend uses optimistic UI updates via SWR with SSE-driven cache invalidation

---

## Tech Stack

### Backend
| Component | Technology |
|---|---|
| Language | Rust (2024 Edition) |
| Runtime | Tokio (async) |
| HTTP Framework | Axum 0.7 |
| Database | SQLite via SQLx (WAL mode) |
| Database Drivers | PostgreSQL, MySQL, Redis |
| Encryption | AES-256-GCM (aes-gcm) |
| TLS Parsing | x509-parser |
| DNS Resolution | Hickory Resolver |
| Email | Lettre (SMTP) |
| Serialization | Serde + serde_json |

### Frontend
| Component | Technology |
|---|---|
| Framework | React 19 |
| Language | TypeScript 6 |
| Build Tool | Vite 8 |
| Routing | React Router DOM 7 |
| State Management | Zustand 5 |
| Data Fetching | SWR 2 + Axios |
| Validation | Zod 4 |
| Linting | OxLint |
| Mocking | MSW (Mock Service Worker) |

---

## Getting Started

### Prerequisites

- **Rust** 1.85+ (2024 Edition)
- **Node.js** 18+
- **npm** 9+

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/Divyanshkumar62/uptime.git
cd uptime

# Set the encryption key (required - 64 hex characters / 32 bytes)
export ENCRYPTION_KEY_SECRET="deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567"

# Set the admin API key (required)
export ADMIN_API_KEY="your-secure-admin-key"

# Build and run
cargo build --release
cargo run --release
```

The API server starts on port `8080` by default. Override with `PORT` env var.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The development server starts on port `5173` by default and proxies API requests to the backend.

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ENCRYPTION_KEY_SECRET` | Yes | - | 64-character hex string (32 bytes) used for AES-256-GCM encryption of database connection strings |
| `ADMIN_API_KEY` | Yes | - | API key for authenticating requests to the backend |
| `DATABASE_URL` | No | `sqlite:uptime.sqlite` | Database connection URL (SQLite, PostgreSQL, or MySQL) |
| `PORT` | No | `8080` | Port for the API server |
| `DOCKER_PROXY_URL` | No | `http://localhost:2375` | Docker daemon API endpoint for container monitoring |

> **Security note:** `ENCRYPTION_KEY_SECRET` must be a valid 64-character hex string. The application will panic on startup if the key is missing, invalid, or the wrong length.

### Monitor Configuration

Each endpoint is configured with:

| Field | Description |
|---|---|
| `monitor_type` | `HTTP`, `TCP`, `DNS`, `POSTGRES`, `MYSQL`, `REDIS`, or `DOCKER` |
| `url` | Target host, IP, or URL |
| `interval_seconds` | Polling interval (15–3600 seconds) |
| `timeout_seconds` | Request timeout (1–10 seconds) |
| `consecutive_failure_threshold` | Number of consecutive failures before marking DOWN |
| `jitter_ratio` | Random delay skew (0.0–1.0) to avoid thundering herd |
| `throttle_seconds` | Minimum cooldown between repeated alerts (default 900) |
| `tags` | Optional array of string tags for grouping |

---

## API Reference

All endpoints require authentication via `X-API-Key` header or session cookie.

### Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/endpoints` | Create a new monitored endpoint |
| `GET` | `/api/endpoints` | List all endpoints |
| `GET` | `/api/endpoints/:id` | Get endpoint details |
| `PUT` | `/api/endpoints/:id` | Update endpoint configuration |
| `DELETE` | `/api/endpoints/:id` | Delete an endpoint |
| `GET` | `/api/endpoints/:id/latency` | Get latency history (query: `since_hours`) |
| `GET` | `/api/endpoints/:id/incidents` | Get incident/alert history |
| `GET` | `/api/sse` | SSE stream for real-time status events |
| `GET` | `/api/integrations` | Get alerting integration settings |
| `PUT` | `/api/integrations` | Update alerting integration settings |

### SSE Events

The `/api/sse` endpoint streams JSON events:

```json
{
  "endpoint_id": 1,
  "url": "https://api.example.com/health",
  "previous_status": "UP",
  "new_status": "DOWN",
  "consecutive_failures": 3,
  "alerted_at": "2026-07-04T12:00:00Z",
  "error_message": "Connection timed out"
}
```

Status values: `UP`, `DOWN`, `SSL_EXPIRING_14`, `SSL_EXPIRING_7`

---

## Alerting Channels

Configure any combination of alerting channels from the Integrations page or API:

| Channel | Configuration Fields |
|---|---|
| **WhatsApp** | Token, Phone Number ID, To Number, Template Name |
| **Twilio** | Account SID, Auth Token, From Number, To Number, Callback URL |
| **Slack** | Webhook URL |
| **Discord** | Webhook URL |
| **SMTP** | Host, Port, Username, Password, From Address, To Address |
| **Webhook** | URL, Method (GET/POST/PUT/PATCH), Custom Headers (JSON), Body Template |

### Webhook Body Template Variables

```
{status}      → "DOWN" / "UP" / "SSL_EXPIRING_14"
{monitorUrl}  → "https://api.example.com/health"
{monitorName} → "Production API Health Check"
{errorMessage}→ "Connection timed out after 10s"
```

---

## Security

- **Encryption at rest:** Database connection strings are encrypted with AES-256-GCM before storage. No plaintext credentials are persisted.
- **No hardcoded secrets:** The encryption key and admin API key are required environment variables. The application refuses to start without them.
- **Error redaction:** Database probe failures return generic error messages (`"Database connection or ping failed"`) to prevent credential leakage through alerting channels.
- **SSRF protection:** Docker probe requests are restricted to a configurable proxy URL (default `http://localhost:2375`), preventing arbitrary internal network scanning.
- **Session-based auth:** Protected routes use session cookies with API key middleware.

---

## Development

### Project Structure

```
uptime/
├── src/
│   ├── main.rs                 # Application entry point
│   ├── api/
│   │   ├── mod.rs              # Axum router and server setup
│   │   ├── auth.rs             # API key and session authentication
│   │   ├── routes.rs           # CRUD endpoints, latency, incidents, integrations
│   │   └── sse.rs              # Server-Sent Events stream
│   ├── db/
│   │   ├── mod.rs              # Database initialization and migrations
│   │   ├── models.rs           # Data models (Endpoint, PingMetric, StatusAlertLog, IntegrationsSettings)
│   │   ├── repository.rs       # Database queries and operations
│   │   ├── crypto.rs           # AES-256-GCM encryption/decryption
│   │   └── cleanup.rs          # Background data retention worker
│   ├── polling/
│   │   ├── mod.rs              # Probe execution dispatch
│   │   ├── scheduler.rs        # Polling scheduler with jitter
│   │   ├── worker.rs           # Protocol-specific probes (HTTP, TCP, DNS, DB, Docker)
│   │   └── ssl.rs              # SSL certificate expiry checks
│   ├── monitoring/
│   │   ├── mod.rs              # Monitoring module
│   │   ├── evaluator.rs        # Status evaluation and alert triggering
│   │   └── latency.rs          # P99 latency calculations
│   └── alerting/
│       ├── mod.rs              # Alert dispatch orchestrator with throttling
│       ├── whatsapp.rs         # Meta Cloud API integration
│       ├── twilio.rs           # Twilio voice call integration
│       ├── slack.rs            # Slack webhook integration
│       ├── discord.rs          # Discord webhook integration
│       ├── smtp.rs             # Email alert integration
│       └── webhook.rs          # Generic webhook with template interpolation
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Root component with routing
│   │   ├── main.tsx            # Entry point
│   │   ├── pages/              # Dashboard, Login, Monitor Details, Integrations
│   │   ├── components/         # Shared UI components (Button, Input, Toggle, etc.)
│   │   ├── features/           # Feature-specific components
│   │   ├── hooks/              # Custom hooks (useEndpoints, useIncidents, useLatency)
│   │   ├── stores/             # Zustand stores (auth, search, SSE)
│   │   ├── lib/                # API client
│   │   ├── routes/             # Route guards and router config
│   │   └── mocks/              # MSW handlers for development
│   ├── package.json
│   └── vite.config.ts
├── schemas/                    # JSON schemas
├── Cargo.toml                  # Rust dependencies
└── .gitignore
```

### Running Tests

```bash
# Backend tests
cargo test

# Frontend lint
cd frontend && npm run lint

# Frontend build check
cd frontend && npm run build
```

---

## License

MIT

---

<p align="center">
  Built with Rust and React
</p>
