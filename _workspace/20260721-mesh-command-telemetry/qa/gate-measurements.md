# Stage 1 Gate Measurements — Mesh Command Telemetry

- **Cycle:** `20260721-mesh-command-telemetry`
- **Measured:** 2026-07-21, local `http://127.0.0.1:4179/index.html?mesh-telemetry=1`
- **Scope:** resource/material mapping, mesh-aware navigation, canonical tactical commands, route/focus feedback. This is not a full campaign certification.

## G1 — Narrative consistency (draft)

| Measure | Value | Method | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| Shipped player-visible strings traced to a cycle worldview | Not measured | The cycle has only an intake brief; no `design/worldview.md` and no complete player-string audit were created. | `intake/production-brief.md` | FIX |

## G6 — Game-ops plan (draft)

| Measure | Value | Method | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| Textured WebGL scene loaded | Observed | Fresh local browser opened Stage 1; WebGL primary canvas visible, fallback hidden. | `evidence/20260721-mesh-telemetry/stage-1-webgl-textured.webp`, `evidence/20260721-mesh-telemetry/browser-interaction.json` | PASS (slice) |
| Canonical tactical input integrity | 214 focused Node tests passed, 0 failed | `node --test tests/battle-realtime-three.test.mjs tests/battle-visualizer.test.mjs tests/battle-field-command-overlay.test.mjs tests/object-feedback-layer.test.mjs` | terminal result plus `evidence/20260721-mesh-telemetry/browser-interaction.json` | PASS (slice) |
| Frame budget | Before: p95 25.0ms, max 34.2ms. After geometry/frame-shot reuse: p95 17.5–17.7ms, max 25.0–25.8ms, 0/540 frames over 33.4ms. | One 180-frame baseline; 60-frame warm-up then three 180-frame `requestAnimationFrame` samples | `evidence/20260721-mesh-telemetry/frame-profile.json` | FIX — each p95 exceeds 16.7ms |
| 30-minute memory soak | Not measured | No 30-minute retained-heap soak was executed in this cycle. | None | FIX |
| Input latency ≤100ms | Not measured | Event semantics and errors were checked; end-to-end latency instrumentation was not collected. | `evidence/20260721-mesh-telemetry/browser-interaction.json` | FIX |

## G7 — Core loop (draft)

| Measure | Value | Method | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| Numeric loop model | Not measured | The implementation exposes Hunt / Extract / Materialize, but this cycle did not produce the required 30–180 second numeric model or voluntary repeat-rate playtest. | `README.md`, `intake/production-brief.md` | FIX |

## Stage 1 evidence limits

- The screenshot proves an applied textured battlefield; it does **not** certify a human readability score for active health/focus bars because the captured frame is pre-wave.
- A queued Hunt reservation remaining out of range is expected proximity gating, not a false success.
- G2–G5 and G8 are Stage 2/3 gates and were not evaluated.
