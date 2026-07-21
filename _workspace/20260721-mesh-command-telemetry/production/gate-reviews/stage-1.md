# Director Gate Review — Stage 1: Mesh Command Telemetry

**Verdict: FIX — Stage 1 is not cleared.**

## Decision

The release slice has observable resource and interaction evidence: the saved Stage 1 WebGL capture shows authored/role texture binding on the battlefield deck and boss presentation; focused regression tests pass; empty-ground input produces a commander-movement focus rather than a duplicated command. These establish the scoped implementation paths, not the full Stage 1 gate.

## Gate status

| Gate | Verdict | Measured value | Evidence |
| --- | --- | --- | --- |
| G1 draft | FIX | No 100%-traceable player-string/worldview audit exists for this cycle. | `qa/gate-measurements.md#g1` |
| G6 ops draft | FIX | Frame allocations were reduced: baseline p95 25.0ms / max 34.2ms became three warmed p95 samples of 17.5–17.7ms / max 25.0–25.8ms. The strict 16.7ms p95 threshold, memory soak, and latency measurement remain unmet. | `qa/gate-measurements.md#g6`, `qa/evidence/20260721-mesh-telemetry/frame-profile.json` |
| G7 draft | FIX | No numeric 30–180s loop model or repeat-rate playtest exists for this cycle. | `qa/gate-measurements.md#g7` |

## Next required evidence

1. Investigate the remaining 0.8–1.0ms p95 gap after geometry/frame-shot reuse; recapture the same warmed probe with a current active commander route.
2. Run a 30-minute retained-heap soak plus a measured pointer-to-feedback latency probe.
3. Audit visible strings/effects against a committed worldview source.
4. Produce the core-loop timing/reward model and structured repeat-rate playtest.

No Stage 1 pass, release-readiness pass, or public deployment success is claimed by this review.
