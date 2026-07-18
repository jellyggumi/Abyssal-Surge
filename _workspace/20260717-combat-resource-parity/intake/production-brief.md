# Combat Resource Parity — Production Brief

- **game_type:** Static, browser-local, single-player RTS-RPG campaign; 10-stage deterministic core loop.
- **team_shape:** Game Studio Harness: director (this session), designer decision below, programmer, QA.
- **engine:** Native ESM JavaScript; Three.js WebGL realtime battle renderer with Canvas 2D fallback.
- **current_stage:** Stage 1 — resource-completion sub-cycle (not a new concept; mechanics for stages 4-10 already shipped in commit `7c089ff`).
- **next_public_beat:** Stage 4-10 combat screens render their own correct terrain/boss identity instead of Stage 1-3 assets, and the campaign no longer crashes past Stage 3.
- **source_packet:** User request "게임전투화면 리소스 디벨롭할꺼야. 게임 스튜디오 하네스로 개선해줘." (develop the game's combat-screen resources; improve with the game studio harness) on the `Abyssal-Surge` repo, current branch state after commit `7c089ff` (ten-stage campaign, mobile RTS cockpit, stage 4-10 art).
- **main_constraint:** No dedicated GLB models exist for stages 4-10 bosses/terrain; only 3 boss GLBs and 3 terrain GLBs are shipped. Any fix must work within that resource budget this cycle.
- **main_question:** What is broken or degraded in the stages 4-10 combat screen, and what is the smallest correct fix that keeps G1 (narrative consistency) honest without new 3D asset production?

## Investigation findings (this cycle)

1. **S1 defect (blocking):** `renderBossSpec()` in `app.js` was suspected of indexing `BOSS_SPEC` out of bounds for stages 4-10 — disproven by direct read; `BOSS_SPEC` in fact has all 10 entries. No crash from this path.
2. **S1 defect (confirmed, now fixed):** `RealtimeBattle` (`battle-realtime-three.js`) clamped `stageNumber` to `Math.min(3, …)`, so every stage 4-10 battle silently rendered Stage 3's terrain (`echo-throne-steps.glb`) and boss (`gate-sovereign.glb`) regardless of the actual stage — a G1 narrative-consistency violation (wrong boss/terrain shown against correct HUD text) reproduced live via injected save state + network capture.
3. **S2 defect (fixed):** The Canvas 2D fallback (`battle-visualizer.js`) had no `BOSS_ART`/`BRIDGE_STAGE_TERRAIN` entries for stages 4-10, so the reduced-motion/WebGL-failure fallback path showed a flat colored triangle instead of any boss art for those stages.
4. **Packaging gap (fixed):** Stage 4-10 art (7 boss portraits + 7 stage backdrops, 14 files) shipped in commit `7c089ff` with zero `assets/media-manifest.json` entries — a Stage-1-acceptance violation ("every new visible image has one source entry in the resource manifest").
5. **Production-infra bug (fixed, found via live debugging):** The service worker's core-JS fetch (`sw.js`) used the default cache mode, so `Network.setCacheDisabled` and even `unregister()` still allowed the browser's heuristic HTTP cache to serve *stale* `battle-realtime-three.js`/`app.js` bytes back into a freshly-installed cache. This meant a real user could receive a stale JS bundle after a code update even though `CACHE_NAME` was unrelated. Fixed with explicit `cache: "no-store"` on every core-asset fetch and a `CACHE_NAME` bump (`v26` → `v27`) per the project's established per-release convention.

## Stage 1 acceptance (for this cycle)

- Every combat-screen resource stages 4-10 actually use traces correctly to its own stage identity (terrain + boss/portrait), verified live for stages 4, 5, 8, 10 via injected save state + GLB network-request capture.
- No new lore violation introduced: reused GLB boss meshes are visually tinted per-stage (see design decision) rather than silently passed off as the correct model.
- The 14 previously-unrecorded stage 4-10 art assets have manifest entries (byte count + SHA-256 computed directly; provenance honestly marked `unrecorded` since no generation record exists — resource-bible §"unknowns remain explicit").
- All 116 existing automated tests pass; no test was weakened to reach this state.
