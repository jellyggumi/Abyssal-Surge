# Battlefield HUD/Command Overlay UX Audit — 20260721

**Scope:** Battlefield HUD, command overlay, tactical strip (WebGL `battle-realtime-three.js`, Canvas fallback `battle-visualizer.js`, shared `object-feedback-layer.js`, `react-game-ui.js`/`react-game-ui.css` battlefield markup, `app.js` command-queue/battlefield glue). Read-only analysis; no code changed.

## 1. Prior retrospective/gate summary — do NOT re-litigate

| Item | Status | Do not rework as if new |
|---|---|---|
| G4/G6 median structured immersion ≥4.0/5 | **FIX — not measured**, any cycle | Yes |
| G4/G6 feedback latency ≤100ms | **FIX — not measured** | Yes |
| G6-ops 60fps budget (p95 ≤16.7ms) | **FIX — still failing** post-optimization: warmed p95 17.5–17.7ms/max 25.0–25.8ms | Yes |
| 30-minute memory soak | **FIX — not run** | Yes |
| G7 core loop playtest | **FIX — not run** | Yes |
| G1 narrative/worldview audit | **FIX — not run** (mesh-telemetry only) | Yes |
| Canvas node marker `userData.semantic` null bug | **Fixed 2026-07-20** | Yes |
| Extractor click hard-locked to Extract | **Fixed 2026-07-20** | Yes |
| Out-of-range proximity gating + toast | **Implemented 2026-07-20** | Yes — see §2 for other wait reasons not covered |
| Boss threat-range danger ring (WebGL) | **Implemented 2026-07-20** | Yes for WebGL; **Canvas fallback absent — Finding F1, new** |
| Readiness/stamina gauge, crit popup tier, path dash | **Implemented 2026-07-20** | Yes |
| Mesh-aware navigation, drag-rally/tactical-popup unified path | **Implemented 2026-07-21** | Yes |
| Mobile 390×844 tactical strip claim | **Claimed passed 2026-07-19**, superseded by later CSS churn | **Needs re-verification — F6** |

## 2. New findings

### F1 — P0 — Boss-strike + danger ring exist only in WebGL; Canvas fallback has neither
Evidence: `battle-realtime-three.js:1429-1438` (danger ring), `:2341-2368` (`updateBossStrike`). `battle-visualizer.js` has zero matches for `dangerRing`/`triggerRange`/`bossPattern`/`boss-strike`. `app.js` only maps event type to alert-cue id (`:94-98`), never re-triggers the mechanic.
Why bad: reduced-motion/low-capability players get a silently easier, unbalanced core loop with no threat telegraph — fairness + consistency + readability defect.
Fix: shared, renderer-independent boss-strike proximity tick + Canvas threat indicator (radius outline or HUD countdown pip).

### F2 — P1 — Untranslated internal reason codes leak into command queue
Evidence: `evaluateQueuedCommandReadiness` (`app.js:1371-1430`) returns `cooldown`/`acknowledging`/`boss-not-exposed`/`waiting-renderer`/`timeout-fallback`; rendered via `translateRejectionReason` (`app.js:584-757`) which has no branch for these and falls through to raw token (`app.js:3730-3733`).
Why bad: Korean player sees e.g. `돌격 (boss-not-exposed)` — a raw dev token in either language.
Fix: add i18n entries + `translateRejectionReason` branches for every reason string.

### F3 — P1 — Silent "why is my command stuck" gap for all wait reasons except out-of-range
Evidence: `app.js:1758-1786` only toasts for `phase==="blocked"` or `reason==="out-of-range"`.
Why bad: queuing Assault while boss hidden gives zero proactive explanation; combined with F2, no legible source of truth.
Fix: extend the same first-transition toast pattern to `boss-not-exposed` at minimum.

### F4 — P2 — Objective/pressure state duplicated in two HUD locations
`.battle-screen-ui__mission` and `#battle-tactical-brief` both render objective/pressure/wave simultaneously with no shared source of truth.

### F5 — P2 — Readiness/HP micro-bars extremely thin, color-only differentiated
`object-feedback-layer.js:551-583` — 50×4px HP bar, 3px readiness bar, focus vs cooldown distinguished only by hue.

### F6 — P1 (verification gap) — Mobile tactical-strip visibility claim needs re-check
07-19 claim predates several `!important`-stacked mobile rules (`react-game-ui.css:3502-3507`, `:1944`/`:3557` forced landscape). No live re-verification since.

### F7 — P2 — Aggressive per-breakpoint feature hiding creates discoverability cliffs
`react-game-ui.css:2692-2723`, `:3980-3987` hide skill/summon-evolution/deployment sections at certain viewports with no visible affordance they still exist.

## 3. Priority Top 5 for next cycle

1. **F1 (P0)** — Canvas-fallback boss-strike/danger-ring parity
2. **F2 (P1)** — i18n/`translateRejectionReason` branches for all reason codes
3. **F3 (P1)** — proactive toast for `boss-not-exposed`
4. **G6-ops 60fps gate (known, open)** — do not add render cost before this closes
5. **F6** — live mobile capture before trusting 07-19 baseline

Secondary backlog: F4, F5, F7.
