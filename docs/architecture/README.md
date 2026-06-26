# Architecture Index: Lightweight Stateless Monitoring Engine

This index maps the system architecture artifacts generated in the [docs/architecture/](file:///c:/dungeon/uptime/docs/architecture/) directory.

## 1. Core Overview and Decisions
- [architecture_overview.md](file:///c:/dungeon/uptime/docs/architecture/architecture_overview.md): `[Observed]` Executive summary of goals, core concerns, and scope boundaries.
- [architecture_decision_records.md](file:///c:/dungeon/uptime/docs/architecture/architecture_decision_records.md): `[Observed]` Architecture Decision Records (ADRs) detailing runtime, database, communication, alerting, and authentication decisions.

## 2. Structural & Behavioral Diagrams
- [system_context.md](file:///c:/dungeon/uptime/docs/architecture/system_context.md): `[Observed]` External system context, actors, clients, and API dependencies.
- [component_architecture.md](file:///c:/dungeon/uptime/docs/architecture/component_architecture.md): `[Observed]` System components, internal structural layout, and boundaries.
- [data_flow.md](file:///c:/dungeon/uptime/docs/architecture/data_flow.md): `[Observed]` Step-by-step sequence of probe execution, alert suppression, and real-time streaming updates.

## 3. Subsystem Architectures
- [api_boundaries.md](file:///c:/dungeon/uptime/docs/architecture/api_boundaries.md): `[Observed]` Interface contracts, protocols, access limits, and error envelopes.
- [background_workers.md](file:///c:/dungeon/uptime/docs/architecture/background_workers.md): `[Observed]` Background execution constraints, timeouts, scheduling, and concurrency limits.
- [persistence_architecture.md](file:///c:/dungeon/uptime/docs/architecture/persistence_architecture.md): `[Observed]` SQLite storage model, composite indexes, daily purge routines, and WAL concurrency.

## 4. Operational & Security Concerns
- [security_architecture.md](file:///c:/dungeon/uptime/docs/architecture/security_architecture.md): `[Observed]` Authentication mechanism, credentials validation, and data protection boundaries.
- [deployment_architecture.md](file:///c:/dungeon/uptime/docs/architecture/deployment_architecture.md): `[Observed]` Docker container host environment, network boundaries, and volume mounting.
- [observability_architecture.md](file:///c:/dungeon/uptime/docs/architecture/observability_architecture.md): `[Observed]` Diagnostic logs, metrics collection, tracing correlation, and answers to core failure questions.
- [scaling_strategy.md](file:///c:/dungeon/uptime/docs/architecture/scaling_strategy.md): `[Observed]` Concurrency scalability limits (500 to 5000 endpoints) and future scale-up path.

## 5. Execution Strategy
- [implementation_roadmap.md](file:///c:/dungeon/uptime/docs/architecture/implementation_roadmap.md): `[Observed]` Development roadmap detailing Phase 1, Phase 2, and Dark Launch verification milestones.
