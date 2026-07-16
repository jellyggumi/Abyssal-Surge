# Stage 1 G6 review — operations/performance draft

**Navigation:** [production contract](../production-contract.md) · [architecture](../../engineering/architecture-contract.md) · [telemetry](../../ops/telemetry-contract.md)

- **Canonical final threshold:** telemetry implemented; rollback tested once; release checklist 100%; p95 frame ≤16.7 ms; long frames <0.5%; 30-minute stable memory; input ≤100 ms.
- **Stage 1 draft evidence requirement:** resource manifest, state/persistence contract, semantic telemetry contract, and named mobile test plan exist.
- **Current status:** `NOT-RUN`; documents exist but no implementation or measured session does.
- **Director action:** do not promote a draft document into final G6 proof. Stage 3 requires measured mobile/browser sessions, rollback exercise, and release record.

## Exit record

| Value | Entry | Draft exit | Final exit | Observed result |
|---|---|---|---|---|
| Telemetry schema | absent/unknown | event contract written | implemented | contract written only |
| p95 frame | unknown | target recorded | ≤16.7 ms | not-run |
| Input latency | unknown | target recorded | ≤100 ms | not-run |
| Soak | unknown | protocol named | 30 min stable | not-run |