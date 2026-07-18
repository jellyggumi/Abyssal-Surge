# Combat Scene Cinematics — Production Brief

- **game_type:** Static, browser-local, single-player RTS-RPG campaign; 10-stage deterministic core loop.
- **team_shape:** Game Studio Harness, this cycle: director (self) + Blender pipeline lane (subagent `BlenderBevelPass`) + code lane (self, "Lane B") + concurrent user engineering in the same working tree (action-feedback refactor, current-objective UI, browser test hardening).
- **engine:** Native ESM JavaScript; Three.js WebGL realtime battle renderer (primary), Canvas 2D fallback; Web Audio API for spatial sound; Blender 5.1.2 for source 3D assets.
- **current_stage:** Stage 1 — resource/presentation-completion sub-cycle continuing the standing production line (follows `20260716-abyssal-surge-revision` and `20260717-combat-resource-parity`).
- **next_public_beat:** The primary 3D combat screen (previously functionally correct but cinematically bare) has movement, collision, terrain, polygon detail, animation, controls, sound, hit effects, effect sound, and particle effects at a "다채롭고" (varied) production-quality level, verified live and gate-reviewed.
- **source_packet:** User request: "작업내역알려줘" (report prior work) followed by "이어서 한계개선하고, 전투씬내에서 이동, 충돌, 지형 계층, 컨셉에 맞는 폴리곤, 에니메이션, 조작, 사운드, 타격효과, 이펙트사운드, 파티클 효과 등 전투씬을 다채롭고 연출할수있도록 개선, 검증, 모니터링까지 블랜더 등 mcp서버이용햐서 병렬로 작업하자" — continue improving the noted limitation; add movement, collision, terrain layers, concept-fitting polygons, animation, controls, sound, hit effects, effect sound, and particle effects to make the combat scene varied and well-directed; improve, verify, and monitor; use Blender and other MCP servers in parallel.
- **main_constraint:** No new 3D character models (budget/time); the resource pack is explicitly `"abyssal-command-low-poly"` flat-shaded PBR by design intent — polygon work must sharpen the existing faceted silhouette (bevel), never smooth it into an organic style (no subsurf).
- **main_question:** Which combat-scene systems are genuinely missing production value versus already functionally solid, and what is the highest-leverage parallel work split between 3D-asset refinement (Blender) and runtime VFX/audio/feel (code)?

## Investigation findings (grounding, this cycle)

1. **Movement/collision/terrain/controls**: already solid — circle-probe collision, elevation-gated `climbOk` movement, WASD+Shift-surge commander control, click-to-rally, ally intercept/formation logic, enemy advance+detour steering. Needed polish, not a rebuild.
2. **Polygon detail**: source pack is intentionally low-poly (12-192 polys per primitive part); many hero parts (bosses especially) had zero edge treatment. Subsurf was tested and explicitly rejected (fights the flat-shaded faceted art direction already established in `resource-manifest.md`/`presentation-spec.md`); bevel-only (matching the existing idiom already on `guard-body`, `sovereign-torso`, etc.) was validated as the correct technique.
3. **Animation**: complete 5-clip vocabulary (Idle/Move/Strike/Special/Defeat) per mobile unit, 3-clip (Idle/Attack/Defeat) per static boss — already fully wired via `RealtimeBattle.play()`. No gap.
4. **Sound**: prior to this cycle, only flat non-positional `<audio>` cues at the `app.js` layer (`playCue`), zero spatial/3D audio in the primary WebGL renderer. The Canvas 2D fallback already had a mature procedural spatial-audio system (virtual listener, oscillator synthesis) that the primary renderer lacked entirely.
5. **Hit effects / particle effects**: zero in the primary WebGL renderer prior to this cycle — no spark, no impact flash, no dissolve-on-defeat, nothing. The Canvas 2D fallback had a working particle system the WebGL path had no equivalent of.

## Stage 1 acceptance (this cycle)

- Primary WebGL combat renderer has a working pooled particle system and real 3D positional audio (Web Audio `PannerNode`, HRTF panning, camera-following listener) covering every combat event: player command actions (hunt/extract/materialize/capture/possess/domain/assault), melee clash exchanges, unit defeat (ally/enemy/boss-weighted), enemy breach, wave-cleared.
- Camera micro-shake and brief hit-stop on heavy impacts (boss defeat, boss-exposed assault).
- Movement feel: footstep dust while walking, brighter/faster particle trail while surging.
- Ambient atmosphere: slow drifting motes in the stage's own accent color (cheap, no new terrain geometry required).
- Boss/hero mesh silhouettes sharpened via non-destructive bevel modifiers on previously-untreated parts, matching the pack's existing flat-shaded low-poly idiom (no subsurf, no organic smoothing).
- Everything verified live in a real browser session (not just unit tests): particle emission and 3D positional audio confirmed firing during actual player-triggered actions and actual AI-resolved combat, with before/after evidence.
- No regression: full automated suite green throughout; performance budget confirmed negligible (particle+audio system is ~16% of a ~0.22ms update — far under the 16.7ms frame budget).

## Concurrent work note

Partway through this cycle, the user (or an equivalent process working directly in this shared repo — see `qa/gate-measurements.md#concurrent-work` for the full incident account) landed a complementary, independently-tested refactor of the player-action feedback path (`emitActionFeedback`/`actionFeedbackProfile`/`actionFeedbackPoint`, replacing the ad-hoc `playActionEffect` branches this session had written) plus a "current objective" command-button highlight UI feature and several real browser-test bug fixes (stale service-worker cache-name literal, hardcoded 3-stage assumption in `tests/playtest-browser-3stage.cjs`). This was investigated, confirmed non-destructive to this session's work, verified correct and fully tested (123/123 automated tests, live browser smoke test), and is treated as legitimate collaborative progress per the operating principle that this repo is not exclusively this session's workspace.
