# Movement and command-path optimization

**Status:** `NOT-RUN` performance and device gate. This is an implementation-facing decision record, not a pathfinding plan.

**Evidence:** [input and persistence path](../../../app.js#L699-L720) · [deterministic transition rules](../../../campaign-state.js#L301-L437) · [browser scenario](../../../tests/playtest-browser-3stage.cjs#L409-L475) · [performance budget](perf-budget.md) · [G6 ledger](../qa/gate-measurements.md#g6-stage-1-operations-draft)

## Decision: command semantics precede presentation

The campaign has no documented unit-coordinate, route-request, or pathfinder state. “Movement” is therefore the player’s command/attention path, not simulated navigation. Preserve this boundary:

1. A button or its keyboard equivalent (`H/E/M/C/P/D/A`) reaches `handleAction(action)`.
2. The UI rejects a command outside the battle view, during its cooldown, or when `getAvailableActions` rejects it.
3. `applyAction` validates stage prerequisites, clones and advances the deterministic state, and appends the accepted event to the campaign trace.
4. Only after acceptance does the UI start the cooldown, trigger a visual effect, persist a save envelope, and render. Visualizer failure must not become an alternate rules path.

This is intentionally one authoritative command/state path. Do not add pointer-driven unit movement, a second command reducer, or an unimplemented “pathfinding optimization” claim without a versioned state contract and matching deterministic replay tests.

## Safe performance assumptions

- **Observed implementation shape:** seven command controls share the same handler and seven-key mapping; the state machine names the same seven actions. This avoids a separate touch-versus-keyboard rules path.
- **Observed implementation shape:** battle visualization is triggered after an accepted state transition; the browser scenario compares renderer and Canvas-fallback breach traces.
- **Target, not proof:** keep the command grid adjacent to state feedback and preserve the documented keyboard route so the next valid action does not require a pointer-only detour.
- **Target, not proof:** a command must remain responsive while visual presentation degrades. The Canvas-fallback scenario is the regression case; it is not a mobile performance measurement.
- **Do not infer a device result:** `perf-budget.md` records a headless Chromium sample, while final G6 still requires instrumented browser/mobile p95, long-frame, input, and 30-minute soak evidence. This document records no new measurement.

## Regression scenarios

Run these against the candidate revision and retain the command output with revision, device/browser, and timestamp. Their status in this document is `NOT-RUN`.

```bash
node --test tests/campaign-state.test.mjs
node tests/playtest-browser-3stage.cjs
```

The first command protects deterministic prerequisite/replay behavior. The second exercises the ordered three-stage command chains and renderer/fallback parity, including the fallback requirement that command controls remain usable. For current release evidence requirements, see [release readiness](../ops/release-readiness.md) and [Stage 3 handoff](../production/handoffs/stage-3.md).
