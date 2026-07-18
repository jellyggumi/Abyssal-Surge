# Combat Resource Parity — Gate Measurements

## G1 — Narrative consistency within the worldview

- **Threshold:** 0 un-waived lore violations; 100% of shipped strings/effects/scenarios trace to `design/worldview.md`.
- **Measured:** Prior state had 7/10 stages (4-10) rendering an unrelated boss/terrain pair in the primary WebGL renderer against correct HUD text — an un-waived violation. Fixed and verified live (see `engineering/resource-manifest.md` table): all 4 spot-checked stages (4, 5, 8, 10) now render their own `STAGE_ASSETS`-declared terrain/boss pair. Remaining GLB-mesh reuse across stages is now an explicitly documented and visually-differentiated (tint) resource-budget compromise, not a silent mismatch — recorded as a waiver in `design/presentation-spec.md`, not a violation.
- **Method:** Deterministic save-state injection via `campaign-state.js` public API (`createSaveEnvelope`) into IndexedDB + live network-request capture of `.glb` fetches per stage, in a fresh headless Chromium tab against a fresh local HTTP server (eliminates cache/state carryover).
- **Evidence:** This session's browser tool transcript; reproducible via the same method against any future build.
- **Verdict contribution:** PASS for the specific defect scoped this cycle (stage-asset identity mismatch). Full G1 (every single string/effect) was not re-audited wholesale — out of scope; no other lore surface was touched this cycle.

## G6-ops — Game-ops plan appropriately applied (resource-manifest subset)

- **Threshold (this cycle's subset):** New/changed visible assets have a resource-manifest entry.
- **Measured:** 14/14 previously-unrecorded stage 4-10 art files (7 boss portraits + 7 backdrops) now have `assets/media-manifest.json` entries with real computed `bytes` and `sha256`. `generated_by`/`derivation` honestly marked `unrecorded` — no fabricated provenance.
- **Method:** `python3 -c "import json; ..."` diff against manifest before/after; SHA-256 computed directly from the shipped files.
- **Evidence:** `assets/media-manifest.json` diff (142 lines added, this session).

## Final focused release check

- **Threshold:** Every modified runtime contract has a directly exercised regression test; the browser playtest completes the Stage 1–3 route and reaches the next real campaign state.
- **Measured:** `node --test tests/*.test.mjs` → 136/136 pass. `node --test tests/abyssal-command-assets.test.mjs tests/battle-realtime-three.test.mjs tests/release-closure.test.mjs tests/app-command-feedback.test.mjs` → 37/37 pass before the bridge-cache regression was added; the final full suite includes that regression. `time node --test tests/playtest-browser-3stage.cjs` → 1/1 pass in 294.2 seconds.
- **Method:** The full Node gate includes the narration atlas/runtime/CSS contract; the focused gate covers GLB identity/animation, stage 4–10 3D/Canvas parity, clip-less playback, bounded assault hit-stop, renderer-free command feedback, Pages closure, no-store core fetches, and narration timing. The browser route covers 390px selection layout, Stage 1–3 actions/rewards/save round trips, then Stage 4 briefing.
- **Evidence:** Final command output in this release session; Playwriter runtime captures are archived under `_workspace/20260716-shadow-lord-rts-rpg/qa/`.

## Independent review finding (caught before yield — this is the point of independent review)

A `code-reviewer`-role subagent independently reviewed the diff (read-only, no self-approval) and found a **critical regression the automated test suite could not catch**: the first implementation of the clamp fix in `battle-realtime-three.js` accidentally dropped `this.presentation = presentation;` from the constructor. Consequences, both confirmed by the reviewer with direct evidence:

1. `applyBossIdentityTint()` was dead code for every call — `this.presentation` was always `undefined`, so `const hex = this.presentation?.palette?.hostile` always short-circuited the whole method via `if (!hex) return;`. The headline G1 mitigation (tinting reused boss meshes) silently did nothing.
2. `this.renderer.setClearColor(this.presentation?.palette?.background ?? "#060913", 1)` always fell back to the hardcoded default background for **all 10 stages**, not just 4-10 — a regression versus pre-diff behavior, affecting every stage including the previously-correct 1-3.
3. Root cause of the test-suite blind spot: every `RealtimeBattle` test in `tests/battle-realtime-three.test.mjs` constructs with `canvas: null` and never calls `.init()` (which requires a real WebGL2 context), so `setClearColor` and `createBattleObjects`/`applyBossIdentityTint` are structurally untested by the current suite. 116/116 (then 117/117) green gave false confidence on this specific regression.

**Fixed:** restored `this.presentation = presentation;` immediately after `this.canvas = canvas;` in the constructor. Re-verified directly (not just via the test suite, given the proven blind spot):
- `new RealtimeBattle(null, { stageNumber: 4, palette: {...} })` → `battle.presentation` now correctly populated.
- `applyBossIdentityTint(fakeRoot)` against a real `THREE.Mesh` with a `THREE.MeshStandardMaterial` → material is cloned (not shared with the original), `color` lerped toward the stage's `palette.hostile`, `emissive` and `emissiveIntensity` set correctly.
- Full live re-verification (fresh tab, fresh server, stage 4): correct GLB assets (`veil-citadel.glb` + `cinder-warden.glb`) load with zero console/page errors.
- `node --test tests/*.test.mjs`: 117/117 pass after the fix.

The reviewer also flagged a secondary, lower-severity finding in `sw.js`'s install handler: the rewritten core-asset caching loop silently skipped non-2xx responses instead of failing the install (unlike the original `cache.addAll()`'s atomic-fail semantics). Fixed by adding an explicit `throw` on non-ok responses, restoring fail-fast behavior while keeping the `cache: "no-store"` fix for the actual stale-cache bug this cycle targets.

## Known non-goals (explicit, not silently dropped)

- Dedicated GLB models for stages 4-10 bosses/terrain: not produced this cycle (no generation budget/approval requested). The tint-based differentiation is the interim mitigation, recorded as such.
- Full G1 audit of every string/effect against `worldview.md`: not re-run this cycle; only the asset-identity defect found and fixed was in scope.
