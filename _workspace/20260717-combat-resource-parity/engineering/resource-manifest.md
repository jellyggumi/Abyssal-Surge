# Combat Resource Parity — Engineering Resource Manifest

## Code changes

| File | Change | Reason |
|---|---|---|
| `battle-realtime-three.js` | `stageNumber` clamp `Math.min(3,…)` → `Math.min(10,…)` | Stages 4-10 were forced onto Stage 3's `STAGE_ASSETS` entry, showing the wrong terrain and boss for 7 of 10 stages. |
| `battle-realtime-three.js` | New `applyBossIdentityTint(root)`, called from `createBattleObjects()` for `stageNumber > 3` | Distinguishes reused boss meshes per-stage using the stage's own `palette.hostile` color (material clone + color lerp + emissive), avoiding a silent G1 lore violation from unclamping alone. |
| `battle-visualizer.js` | `BOSS_ART` extended stages 4-10 → each stage's own shipped boss portrait PNG | Canvas 2D / reduced-motion fallback previously showed no boss art at all past Stage 3 (undefined lookup → generic triangle fallback). |
| `battle-visualizer.js` | `BRIDGE_STAGE_TERRAIN` extended stages 4-10 → reused terrain plate id, matching `STAGE_ASSETS` reuse mapping | Keeps the 2D and 3D renderers visually consistent about which of the 3 terrain plates each stage uses. |
| `sw.js` | Core-asset fetch (`fetch(request)` → `fetch(request, { cache: "no-store" })`) in both the `install` handler and the `fetch` event's core-request branch | **Found during live verification**, not part of the original ask: the service worker's own fetches for core JS were subject to the browser's heuristic HTTP cache, so a "network-first" strategy could still serve stale JS after a code change even with `Network.setCacheDisabled` and a full unregister/re-register cycle. This is a real production risk for any future JS deploy, not just this fix. |
| `sw.js` | `CACHE_NAME` `abyssal-surge-static-v26` → `v27` | Per this project's established convention (12 prior version bumps in git history) of bumping on every meaningful core-JS change. |
| `apk/BUILD.md` | Updated cache-name reference to `v27` | Kept in sync per `tests/release-closure.test.mjs` assertion (caught by the test suite, not missed). |
| `assets/media-manifest.json` | Added 14 entries (7 stage-4-10 boss portraits + 7 stage backdrops) with computed `bytes`/`sha256` | These files shipped in commit `7c089ff` with zero manifest entries — a Stage-1-acceptance gap this cycle closes. Provenance is honestly recorded as `unrecorded` (no generation log exists for them) per the resource-bible's explicit-unknowns rule; nothing is fabricated. |

## Adjacent release integration

`app.js` now marks the next objective as the current command step and preserves one renderer-independent effect/cue only when neither battlefield renderer is available. `styles.css` changes the narrow stage selector from a wide scroll row to a bounded two-column grid. The corresponding behavior checks live in `tests/app-command-feedback.test.mjs`, `tests/battle-realtime-three.test.mjs`, `tests/release-closure.test.mjs`, and `tests/playtest-browser-3stage.cjs`.

## Verification evidence

- `node --test tests/*.test.mjs`: 136/136 pass (0 fail). 이 전체 회귀 실행은 좁은 자원·런타임 변경 뒤에 다시 수행했으며, 내레이션 아틀라스/런타임/CSS와 GLB 브리지의 no-store 사전 캐시 계약도 포함합니다.
- Live browser verification (headless Chromium via Playwriter-equivalent browser tool, fresh tab + fresh HTTP server port to eliminate any residual cache/service-worker state): injected deterministic save envelopes (built from `campaign-state.js`'s public API, not hand-crafted) at stage entry for stages 4, 5, 8, and 10; captured actual `.glb` network requests per stage.

| Stage | Expected terrain | Expected boss | Observed terrain | Observed boss | Match |
|---|---|---|---|---|---|
| 4 (Sunken Bastion) | `veil-citadel.glb` | `cinder-warden.glb` | `veil-citadel.glb` | `cinder-warden.glb` | ✅ |
| 5 (Howling Sprawl) | `cinder-span.glb` | `veil-tactician.glb` | `cinder-span.glb` | `veil-tactician.glb` | ✅ |
| 8 (Shattered Causeway) | `echo-throne-steps.glb` | `cinder-warden.glb` | `echo-throne-steps.glb` | `cinder-warden.glb` | ✅ |
| 10 (Gate Zenith) | `echo-throne-steps.glb` | `gate-sovereign.glb` | `echo-throne-steps.glb` | `gate-sovereign.glb` | ✅ |

Before the fix, all four stages above observably requested `terrain/echo-throne-steps.glb` + `bosses/gate-sovereign.glb` regardless of actual stage (Stage 3's assets), reproduced live prior to the code change.

## Performance

`applyBossIdentityTint` itself runs once per battle session on a single boss instance (one `root.traverse` over a small mesh hierarchy, cloning only that boss's materials). It does not run in the frame loop. The broader renderer changes in this release do add per-frame effects, so this artifact makes no unmeasured global frame-time claim.
