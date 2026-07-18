# Medieval Battle Presentation — Stage 1 Gate Measurements

Scope: the additive field-command overlay (`battle-field-command-overlay.js` / `.css`), attached
only through `index.html`. This is a **presentation-layer subset review**, not a full Stage 1→2→3
production-cycle gate pass. Every gate below is scored strictly against `_workspace/20260718-medieval-battle-presentation/design/presentation-brief.md`'s
Stage 1 Screen Contract and Acceptance Criteria — nothing broader is claimed.

## Verdict table

| Gate | Scope reviewed | Verdict |
|---|---|---|
| G1 — narrative/material coherence **subset** (overlay vocabulary + material grammar) | This overlay's copy, labels, and visual material only | **PASS** |
| G1 — full gate (100% player-visible string/asset trace to `design/worldview.md`) | Whole game | **NOT SCORED** |
| G4 — immersion/accessibility **surface** subset (input invariants, reduced-motion, 360px readability) | This overlay's DOM/CSS contract only | **PASS** |
| G4 — full gate (median human immersion score ≥4.0/5, ≤100ms feedback-latency instrumentation) | Whole game | **NOT SCORED** |
| G6 — engineering/release-closure **subset** (tests, PWA cache, Pages allowlist, canvas-input non-interference) | This overlay's runtime/build contract only | **PASS** |
| G6 — full gate (telemetry contract, rollback runbook tested, release-readiness checklist, perf-budget soak) | Whole game | **NOT SCORED** |

---

## G1 — Narrative/material coherence (subset)

**Threshold (subset, this cycle):** The overlay introduces no copied game art, no new binary assets,
no renamed existing game concept, and no synthesized fact; every dynamic value it displays is read
live from an existing DOM element already driven by `campaign-state.js`/`app.js`.

**Method:** Direct current-source inspection of `battle-field-command-overlay.js`/`.css` in the
working tree; cross-referenced the four selectors the overlay reads (`#stage-objective`,
`#battle-hostile-label`, `#battle-pressure`, `#integrity-value`) against their existing producers
in `app.js`/`index.html`.

**Evidence:**
- No `url()`, `@font-face`, or `background-image` in `battle-field-command-overlay.css` (grep, 0 matches) — no new asset introduced.
- `battle-field-command-overlay.{js,css}` are additive files: no other module or stylesheet in the current source tree defines or exports `.ashen-field-command*` classes, and neither file references the binary GLB/PNG resource-pack assets present elsewhere in the working tree.
- The overlay imports nothing from `app.js`, `battle-realtime-three.js`, or `battle-visualizer.js` (`grep '^import\|require('` → 0 matches); it only queries public DOM selectors that already exist and are already populated by the campaign engine (`#integrity-value` ← `elements.integrity.textContent` in `app.js:1038`; `#stage-objective`, `#battle-hostile-label`, `#battle-pressure` are existing HUD nodes).
- "Gate ward — loss point" (current label text, verified in source) is a presentation label over the existing `integrity` stat, not a new mechanic or fact — `integrity` is the pre-existing loss-condition stat this campaign already tracks (`campaign-state.js`: `entryIntegrity`, `maxIntegrity`, boss/stage integrity-restore rewards).
- Command copy (`commandCopy()`) derives `name`/`detail` from the currently-selected command button's own `<strong>`/`<small>` text — it does not author new command names or effects.

**Verdict: PASS** for this subset only — material grammar and vocabulary coherence of the overlay itself.

**Full G1 gate: NOT SCORED.** A full G1 pass requires 100% of shipped player-visible strings/effects/scenarios to trace to `design/worldview.md` with 0 un-waived violations (per `.claude/skills/game-studio-harness/references/quality-gates.md`). That is a whole-game audit this review did not run and this cycle's scope (one additive overlay) does not license claiming.

## G4 — Immersion/accessibility surface (subset)

**Threshold (subset, this cycle):** the five Stage 1 input/motion invariants from the design brief:
(1) overlay root is non-interactive except the proxy button, (2) the proxy calls the existing
`#action-${action}` button rather than synthesizing state, (3) render updates batch via
`requestAnimationFrame` except under reduced motion, (4) reduced motion retains all text with no
motion-encoded state, (5) canvas pointer interactions outside the proxy still reach `#battle-canvas-3d`.
Acceptance criteria 4–6 (canvas passthrough, 360px/48px readability, reduced-motion text retention)
are included in this subset; criteria 1–3 (visible command/objective/route) are covered by the same
evidence below.

**Method:** Source read of `battle-field-command-overlay.css` (pointer-events rules, `@media
(max-width: 30rem)`, `@media (prefers-reduced-motion: reduce)`) and `.js` (activation handler,
`prefersReducedMotion()`/`requestRender()`); corroborated by a manual local Playwriter session
against `http://localhost:8000` (session 7, reported by the orchestrating session) and an
independent code-reviewer pass (`AssessLocalUiIntegration`) confirming canvas pointer ownership.

**Evidence:**
- `#battle-field .ashen-field-command { pointer-events: none; }` (root) with `pointer-events: auto` set only on `.ashen-field-command__activate` — the sole interactive element, matching the brief's invariant exactly.
- Activation handler: `activation.addEventListener("click", () => { if (!activeCommand?.disabled) activeCommand?.click(); })` — invokes the existing button's own `.click()`; no synthetic pointer/canvas event, no import of private `app.js` state.
- `RealtimeBattle` owns `pointerdown`/`move`/`up`/`wheel` and pick routing on `#battle-canvas-3d` (`battle-realtime-three.js:1052–1112`, confirmed independently by `AssessLocalUiIntegration`); because the overlay root is `pointer-events: none`, canvas input outside the proxy button's bounding box is structurally unaffected — no z-index/opacity trick, a real CSS property exclusion.
- `requestRender()`: under `prefers-reduced-motion: reduce`, calls `render()` synchronously and returns before scheduling `requestAnimationFrame`; the base CSS defines no `animation`/`transition` on any overlay element except a defensive `@media (prefers-reduced-motion: reduce) { … transition: none !important; animation: none !important; }` guard on `::before`. No overlay state is motion-only.
- 360px width: the `@media (max-width: 30rem)` breakpoint (480px) covers 360px; at that breakpoint `.ashen-field-command__activate` keeps `min-height: 3rem` (48px) and `min-width: 8.7rem` (~139px) — both dimensions clear the 48 CSS-pixel floor. Live confirmation: Playwriter snapshot/screenshot at 360×800 (`/tmp/abyssal-field-command-360.png`) — all overlays (standard, watch, ward, consequence, proxy) remained visible.
- Reduced-motion live check: Playwriter snapshot with `prefers-reduced-motion: reduce` retained the same objective/hostile/gate-ward/consequence text, with empty page logs (0 console/page errors).
- Live proxy-activation check: Playwriter session showed the overlay displaying current Hunt, hostile ingress, "Gate ward 10/10," and consequence; a proxy click advanced Hunt 0/2→1/2, and after cooldown a second proxy click advanced the checklist and proxied Hunt→Extract — satisfying acceptance criterion 3 (command-state change updates overlay text and button destination without rule mutation outside the existing handler) and criterion 1 (one activation route reaches the existing command button).
- Automated regression added this cycle for the same claim: `tests/playtest-browser-3stage.cjs` now asserts that activating `.ashen-field-command__activate` appends exactly one `{ kind: "action", action: "hunt" }` to the public campaign action trace — the same trace produced by the native `#action-hunt` button — confirmed passing in the final full-suite rerun (see G6 below).

**Verdict: PASS** for this input/motion/readability subset.

**Full G4 gate: NOT SCORED.** The full gate requires a median structured immersion/readability score ≥4.0/5 from human playtest scorecards and ≤100ms feedback-latency spot-checks (per `.claude/skills/game-studio-harness/references/quality-gates.md`, `qa/test-plan.md` precedent in sibling workspaces). No player scorecards or latency instrumentation were collected this cycle — none exist to score.

## G6 — Engineering/release closure (subset)

**Threshold (subset, this cycle):** every runtime contract the overlay depends on has a directly
exercised automated test; the overlay's assets ship in the GitHub Pages allowlist and the v28
service-worker core-asset cache; canvas input is provably unaffected; the full existing three-stage
browser playtest still passes end to end.

**Method:** `node --test` runs (executed by the orchestrating session and the Tester peer, both
reported verbatim into this review), plus direct source read of `sw.js`, `.github/workflows/static.yml`,
and `tests/release-closure.test.mjs` assertions.

**Evidence — exact commands and results:**
- `node --test tests/battle-field-command-overlay.test.mjs` → **3 tests, 3 passed, 0 failed**, duration 93.76075ms. (`selectCurrentCommand` priority-order resolution incl. all-disabled fallback; `textOf` whitespace/fallback normalization.)
- `node --test tests/battle-field-command-overlay.test.mjs tests/release-closure.test.mjs` → **22 tests, 22 passed, 0 failed, 0 cancelled**, duration 871.929292ms. This is the final count after a new release-closure assertion was added this cycle ("local index stylesheet and module entry points are shipped in the Pages artifact and precached offline"), which directly checks that every local `<link rel="stylesheet">`/`<script type="module">` in `index.html` — including both `battle-field-command-overlay.css` and `.js` — appears in both the GitHub Pages `PAGES_RUNTIME_PATHS` archive and the service worker's `CORE_ASSETS`/`isCoreRequest` set.
- `node tests/playtest-browser-3stage.cjs` (full existing three-stage browser playtest, final rerun after the field-proxy assertion was added) → **`PLAYTEST_BROWSER_PASS stages=Cinder Span,Veil Citadel,Echo Throne legion=0/10,4/10,8/10 worker=/sw.js cache=abyssal-surge-static-v28 optional-media-errors=0`**, wall time 228.93s. Only WebGL `readPixels`/deprecation driver warnings logged; no test failure. This run includes the new in-suite assertion that clicking `.ashen-field-command__activate` produces the same public `hunt` action-trace entry as the native `#action-hunt` button.
- Bridge-cache boundary check (`verifyBridgeCacheBoundary`, part of the same playtest file, run in isolation) → **`PLAYTEST_BRIDGE_CACHE_BOUNDARY_PASS cached=manifest,asset rejected=traversal,cross-origin`** — confirms the GLB bridge manifest and each admitted bridge asset are fetched with `cache: "no-store"` and stored via `cache.put` (never `cache.add`, which cannot guarantee HTTP-cache bypass), and that path-traversal/cross-origin bridge candidates are rejected. (A code-review pass flagged a stale fixture expectation on this exact assertion mid-cycle; the fixture was corrected to match `sw.js`'s actual no-store/`cache.put` behavior, re-verified in the counts above — see Resolved concern, below.)
- Manual local Playwriter mobile/reduced-motion check (session 7, `http://localhost:8000`): Stage 1 overlay displayed correctly, proxy-click action progression confirmed, 360×800 viewport snapshot confirmed all overlay panels visible, `prefers-reduced-motion: reduce` snapshot confirmed static text retention with 0 page-log errors. (Full narrative in the G4 section above; recorded here because it is also release-readiness evidence.)

**PWA cache / Pages allowlist evidence (source-level, corroborated by the passing tests above):**
- `sw.js`: `CACHE_NAME = "abyssal-surge-static-v28"`; `CORE_ASSETS` includes `"./battle-field-command-overlay.js"` and `"./battle-field-command-overlay.css"`; `isCoreRequest()`'s suffix list includes both `/battle-field-command-overlay.js` and `/battle-field-command-overlay.css`.
- `.github/workflows/static.yml`: `PAGES_RUNTIME_PATHS` folded scalar lists `battle-field-command-overlay.js` and `battle-field-command-overlay.css`; the separate "Guard committed static import closure" job step's `for file in …` allowlist also enumerates both.
- `apk/BUILD.md` verifies the same `abyssal-surge-static-v28` cache name (checked by `release-closure.test.mjs`'s `"apk/BUILD.md must verify the ${cacheName} offline cache"` assertion, included in the 22/22 pass above).

**Resolved concern (worth recording, not a residual defect):** A code-review pass over uncommitted
source mid-cycle raised a synchronization concern between `tests/playtest-browser-3stage.cjs`'s
bridge-cache fixture and `sw.js`'s actual `cacheGlbBattleBridge()` implementation (fixture asserted
a single `cache.add`-style admission; implementation fetches-then-`cache.put`s both the manifest and
each admitted asset with `cache: "no-store"`). This was a **test-fixture drift, not a runtime
regression** — `cacheGlbBattleBridge()` in `sw.js` already matched `tests/release-closure.test.mjs`'s
existing assertion (`assert.doesNotMatch(…, /cache\.add\(/…)`) before this cycle. The fixture was
corrected to assert the real two-request no-store/`cache.put` sequence; the corrected fixture and a
new Pages/service-worker entrypoint-closure test both pass in the final counts above.

**Verdict: PASS** for this subset — the overlay's own runtime contract, test coverage, and
release-artifact inclusion.

**Full G6 gate: NOT SCORED.** The full gate requires an implemented telemetry contract
(`ops/telemetry-contract.md`), a tested rollback runbook, a 100%-complete release-readiness
checklist, and a perf-budget soak (p95 frame ≤16.7ms, long-frame <0.5%, 30-minute stability, input
≤100ms) per `.claude/skills/game-studio-harness/references/quality-gates.md`. None of those ops
artifacts exist or were exercised this cycle; this review did not run a soak test or rollback drill.

---

## Explicit non-goals (carried from the design brief, not re-litigated here)

- No native touch group-rally: not implemented, not claimed. The proxy button dispatches the
  existing button's `click()`, not a synthetic long-press or right-click gesture.
- No world-locked tactical path or 3D landmark replacement: the "Command route" element is
  confirmed (by source read) to be a `<svg viewBox="0 0 100 100" preserveAspectRatio="none"
  aria-hidden="true">` HUD diagram with a fixed `d="M 17 79 C 31 64, 50 60, 77 35"` path — not a
  renderer-world coordinate, not derived from camera/scene state.
- No game-rule changes: the overlay's only side effect is `activeCommand?.click()` on an
  already-existing, already-enabled command button; every rule mutation still happens inside that
  button's own pre-existing handler, unmodified by this cycle.

## What this review did not do

- Did not run the project-wide test suite (`node --test tests/*.test.mjs`) — scope was the overlay's
  own subset (`battle-field-command-overlay.test.mjs`, `release-closure.test.mjs`,
  `playtest-browser-3stage.cjs`), per the assignment's constraint.
  All commands and results above were reproduced verbatim from the orchestrating session and the
  `TestFieldOverlay`/`AssessLocalUiIntegration` peers, not independently re-run by this review, per
  the assignment's "use only already recorded evidence" constraint.
- Did not collect human playtest scorecards, latency instrumentation, or a soak/rollback test — the
  artifacts required to score full G4/G6 do not exist for this cycle and are not fabricated here.
- Did not audit the full existing game's strings/effects against `design/worldview.md` — full G1 is
  out of scope for a one-feature additive-overlay cycle.

---

## 2026-07-18 — Order Seal P1 focused evidence addendum

**Scope:** P1 Order Seal evidence only. This addendum corrects the stale focused-test count
recorded above without rewriting the historical entry; it does not add or imply 360px-specific P1
evidence.

**Focused verification:**
- `node --test tests/battle-field-command-overlay.test.mjs` → **14 tests passed, 0 failed**.
- `node tests/playtest-browser-3stage.cjs --reduced-motion` →
  **`PLAYTEST_BROWSER_PASS stages=Cinder Span,Veil Citadel,Echo Throne legion=0/10,4/10,8/10 worker=/sw.js cache=abyssal-surge-static-v28 optional-media-errors=0`**;
  wall **277.09s**. Only WebGL driver/deprecation warnings were reported.

**P1 verdict:** **PASS** for the scoped **G1/G4/G6 subset** only.

**Full-gate status:** **NOT SCORED**. The full G1, G4, and G6 gaps already recorded in this
document remain unscored: no whole-game worldview trace audit; no human immersion scorecards or
feedback-latency instrumentation; and no telemetry contract, tested rollback runbook,
release-readiness checklist, or perf-budget soak.

**P2 status:** **PENDING.**

---

## 2026-07-18 — Compact Consequence P2 verification addendum

**Scope:** P2 Compact Consequence evidence only. This addendum records the focused 360px,
locale-neutral browser proof without rewriting the P1 record above.

**Focused verification:**
- `node tests/playtest-browser-3stage.cjs --compact-field-overlay` →
  **`PLAYTEST_BROWSER_COMPACT_FIELD_OVERLAY_PASS viewport=360x800 contexts=standard,reduced consequence=one-line proxy=48px canvas=pass-through`**;
  wall **7.30s**. Only WebGL GPU-stall warnings were reported.

**Contract conditions proven:**
- The check is dynamic and locale-neutral: the consequence is compared with the current command
  button's own `<small>` source text rather than a fixed localized string.
- At a `360×800` viewport, the consequence remains one line, the proxy retains its 48px floor,
  no horizontal overflow occurs, and the proxy owns its center hit-test point.
- The proxy remains the sole overlay control; a blank standard-context field point resolves to the
  canvas, preserving canvas ownership and pass-through input.
- In reduced motion, critical copy remains present, no `requestAnimationFrame` is required for the
  result, and no client errors occur.

**P2 verdict:** **PASS** for the scoped **G1/G4/G6 subset** only. No production style or module
change was required for P2: the existing `.ashen-field-command__activate-note` already presents
the native command detail as one line.

**P1 boundary:** P1 production is unchanged by this P2 verification. Its 2026-07-18 Order Seal
focused evidence remains its own proof and is not superseded or broadened by this addendum.

**Full-gate status:** **NOT SCORED.** The full G1, G4, and G6 gates remain unscored: no
whole-game worldview trace; no human immersion scorecards or feedback-latency evidence; and no
telemetry contract, tested rollback drill, or performance soak.

**Post-P2 default browser regression:**
- `node tests/playtest-browser-3stage.cjs` →
  **`PLAYTEST_BROWSER_PASS stages=Cinder Span,Veil Citadel,Echo Throne legion=0/10,4/10,8/10 worker=/sw.js cache=abyssal-surge-static-v29 optional-media-errors=0`**;
  wall **241.74s**. Only WebGL GPU-stall/deprecation warnings were reported.

This is post-P2 regression evidence that the P2 test additions are compatible with the default
existing three-stage browser flow. It remains scoped evidence and does not score or imply a full
G1, G4, or G6 PASS.
