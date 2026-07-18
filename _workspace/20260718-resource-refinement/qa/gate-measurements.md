# Resource refinement gate measurements

**Run:** `20260718-resource-refinement`  
**Mode:** Stage 1 resource/presentation refinement  
**Ledger status:** `DRAFT / IN PROGRESS`  
**Measurement date:** 2026-07-18  
**Authority boundary:** These are scoped resource/presentation measurements. They do not score whole-game rules, save, or replay beyond presentation-equivalence checks against `campaign-state.js`.

## 1. Executive status

| Scope | Current status | Reason |
|---|---|---|
| 3D mesh/rig structural and renderer-selection subset | `PASS` | Headless build/source load, 15-asset hashes/actions/embedded PNG/tangents/rest-ground, rigid-control targets and 4/4 focused asset tests passed. Fresh browser proof loaded four Stage 1 GLBs with 13 clips; forced WebGL2 unavailability selected Canvas2D. Direct GLB-load fault equivalence and independent compact/blind review remain open. |
| 2D raster bridge structural/runtime-selection subset | `PASS` | Final verify closes 45/45 records (42 action atlases, 3 terrain), 0 missing actions, 12 px minimum padding and 8 animated directions. A forced WebGL2-unavailable fresh session hid 3D, showed Canvas2D and requested all 45 bridge PNGs. Blind compact/reduced-motion and missing-PNG failure behavior remain open. |
| Audio new-asset/runtime subset | `PASS` | Three new 44.1 kHz MP3s pass codec/role/size/loudness/headroom checks; active audio is 1.306 MiB; accepted wave cue and BGM scene lifecycle passed. Full 20-file probe, failure/autoplay and human intelligibility remain unscored. |
| Video encode/runtime subset | `PASS` | Final canonical cinematic is H.264 High, 960×540, yuv420p, 24/1 fps, 19.02 s, faststart, full-decode clean; browser play/pause/end/error/recovery/VTT/cache checks passed in [`../engineering/video-report.md`](../engineering/video-report.md). |
| Shared manifest file/hash inventory | `PASS` | Post-cleanup audit closes 188/188 shared records: every path exists and every byte count/SHA-256 matches; bridge remains 45/45 matching. Complete provenance and runtime/cache browser evidence remain open. |
| Compact-resolution readability | `NOT SCORED` | No final 360×800 and 320×640 resource-refinement screenshots/metrics or blind readability sheet exist yet. |
| Reduced-motion equivalence | `NOT SCORED` | Source contract exists, but no final post-change browser trace/save equivalence packet exists yet. |
| Full G4 immersion | `NOT SCORED` | No eligible structured human immersion cohort is available. |
| GodTiboImagen PNG candidate | `PASS — FILE/PROVENANCE SUBSET` | Real HTTP 200 generation, PNG decode/dimensions/hash and exact prompt/input/tool provenance passed; it remains unintegrated and GTI-03 compact/readability is unscored. |
| PerfectPixel bundle candidate | `NOT SCORED — PROVIDER BLOCKED` | Installed `ppgen` does not support requested `god-tibo-imagen`; exit 1, generated media 0. The report verified no fake bundle was created, so identity/transparency remain unassessed. |
| Vox resource-film candidate | `PASS — BEAT/ENCODE SUBSET` | Four beats/eight shots pass anti-repetition structure; local MP4 is H.264/yuv420p/960×540/24 fps/faststart and sample frames passed specialist readability. Human/reduced-motion/fallback promotion checks remain unscored. |
| Motion Previs candidate | `PASS — TECHNICAL BUNDLE` | Source plus 30 bundle checksum entries passed; 29 artifact hashes, 456 camera/scene records and 19 frames validated; unsupported depth/pose outputs are explicitly absent, not faked. |
| Stage 1 resource-refinement exit | `FIX` | Structural media, post-change focused contracts, browser renderer selection and full shared file/hash inventory subsets pass, but complete provenance, SW install/upgrade/offline, direct failure-equivalence, compact/blind and reduced-motion evidence remains incomplete. |

The pre-change 26/26 result is useful regression baseline evidence only. It cannot be relabeled as final after files change.

## 2. Recorded baseline commands

### BASE-01 — Focused asset and release closure

- **Scope:** Current 3D pack, GLB bridge, runtime media path/cache/release closure assertions.
- **Command:** `node --test tests/abyssal-command-assets.test.mjs tests/release-closure.test.mjs`
- **Reported result:** **26/26 PASS**.
- **Evidence source:** Parent agent verification report, 2026-07-18; final command output must also be copied into [`../engineering/runtime-integration-report.md`](../engineering/runtime-integration-report.md).
- **Adjudication:** `PASS — PRE-CHANGE FOCUSED BASELINE ONLY`.
- **Limitation:** This result predates completion of all specialist changes and does not prove Blender deformation quality, audio/video encoding, browser fallback, compact readability, reduced-motion equivalence, or human immersion.

### BASE-02 — Canonical cinematic validation

- **Scope:** `assets/video/abyssal-surge-cinematic.mp4` encode contract.
- **Command:** `python3 scripts/render_stage_video.py validate --input assets/video/abyssal-surge-cinematic.mp4`
- **Threshold:** H.264, yuv420p, 960×540, exact `24/1` fps, faststart, validator exit 0.
- **Reported result:** **FAIL**; `frame_rate=30/1`, expected `24/1`.
- **Evidence source:** Parent agent verification report, 2026-07-18; final raw validator/ffprobe output belongs in [`../engineering/video-report.md`](../engineering/video-report.md).
- **Adjudication at capture:** `FIX`; superseded by final closure in BASE-04.
- **Closure condition:** Re-encode/replace the canonical file, update its final hash/provenance/cache records, and rerun VID-01/02/03/04 plus REL-01/02/04–06.

### BASE-03 — Blender validation route

- **Scope:** Tool availability, not asset quality.
- **Observed state:** Blender MCP connection unavailable; `/Applications/Blender.app/Contents/MacOS/Blender` exists.
- **Adjudication at capture:** Headless Blender route `AVAILABLE`; asset quality was then `NOT SCORED` and is superseded by BASE-06 measurements.
- **No waiver:** MCP unavailability does not waive M3D-03/04/06/08.

### BASE-04 — Canonical cinematic closure

- **Scope:** Final `assets/video/abyssal-surge-cinematic.mp4`, caption, runtime lifecycle and optional-cache integration.
- **Commands/results:** `python3 scripts/compress_stage_video.py validate --input assets/video/abyssal-surge-cinematic.mp4` → PASS; independent `python3 scripts/render_stage_video.py validate --input assets/video/abyssal-surge-cinematic.mp4` → PASS; full FFmpeg video/audio decode → PASS.
- **Measured:** H.264 High, 960×540, yuv420p, `24/1` fps, 19.02 s, 2,252,481 bytes, faststart; final SHA-256 `b84ccfa905e2be365f6def1df3a5f4553e6d74468c413c1a7c8edbab9ed8b95a`.
- **Runtime:** Play/pause/end, forced error fallback, recovery, VTT readiness, SW cache MIME and manifest bytes/hash all PASS.
- **Evidence:** [`../engineering/video-report.md`](../engineering/video-report.md).
- **Adjudication:** VID-01/02/03/04 `PASS`; VID-05 remains `NOT SCORED` without a separate human shot/readability sheet.

### BASE-05 — PerfectPixel provider blocker

- **Scope:** One-state `idle` pilot through installed `ppgen`.
- **Command result:** Requested `god-tibo-imagen`/`gpt-5.4`; exit 1 with `지원하지 않는 프로바이더입니다: god-tibo-imagen`.
- **Measured:** providers `gemini/openai/openrouter/fal/byteplus`; generated media 0; blocker evidence verified; no PNG/GIF/APNG/manifest fabricated.
- **Evidence:** [`../engineering/perfectpixel-report.md`](../engineering/perfectpixel-report.md).
- **Adjudication:** PP-01/02/03 `NOT SCORED — PROVIDER BLOCKED`; current GLB raster bridge remains authoritative.

### BASE-06 — Mesh/rig structural closure

- **Commands/results:** Headless Blender build exit 0 with `ABYSSAL_COMMAND_RESOURCE_PACK_READY assets=15`; source blend load `SOURCE_BLEND_CHECK 137 92 2`; `node --test tests/abyssal-command-assets.test.mjs` → 4/4 PASS.
- **Direct inspection:** 15/15 GLB/hash/action/embedded PNG/tangent checks passed; authoring `minZ` error 15/15 is `0.000000 m`; decoded runtime Y-up `minY` error 15/15 is `0.000000 m` (raw max `3.2e-8 m`); roots are exactly `(0,0,0)` with `runtime(X,Y,Z)=Blender(X,Z,-Y)`. Five units contain `body-control` and `equipment-control` secondary animation targets.
- **Visual:** A 5×8 reimported silhouette contact sheet was reviewed by the technical artist with no overlap observed. Independent compact/blind identification was not collected.
- **Evidence:** [`../engineering/mesh-rig-report.md`](../engineering/mesh-rig-report.md).
- **Adjudication:** M3D-01/02/03/05 and automated M3D-06 `PASS`; M3D-04 control-target subset `PASS`; M3D-07 `NOT SCORED`; M3D-08 independent compact/blind criteria remain open.

### BASE-07 — GTI image candidate

- **Output:** `assets/images/resource-refinement/gti/abyssal-surge-resource-forging-hero-frame.png`.
- **Measured:** PNG RGB 8-bit, 1672×941, non-interlaced; SHA-256 `df5d800274253512d474d0e45180c4991cc69857b87e435b0cb356d17cff65d2`.
- **Generation:** `gti` dry-run exit 0; real `private-codex`/`gpt-5.4` request HTTP 200; exact prompt, input reference and input SHA-256 recorded; debug evidence sanitized.
- **Visual:** Specialist review found one readable focal point, no visible text/logo/watermark/franchise copy, and no reproduction of the reference composition. No 360×800 review or legal IP clearance was claimed.
- **Evidence:** [`../design/gti-image-report.md`](../design/gti-image-report.md).
- **Adjudication:** GTI-01/02 `PASS — CANDIDATE FILE/PROVENANCE`; GTI-03 `NOT SCORED`.

### BASE-08 — Motion Previs technical bundle

- **Source:** Canonical cinematic SHA-256 `b84ccfa905e2be365f6def1df3a5f4553e6d74468c413c1a7c8edbab9ed8b95a`, 456 video frames at 24 fps.
- **Command/result:** `(cd _workspace/20260718-resource-refinement/engineering/previs-bundle && shasum -a 256 -c checksums.sha256)` → source plus 30 bundle entries all OK.
- **Contract validation:** 29 artifact hashes, 456 camera records, 456 scene records and 19 extracted frames passed. Apparent motion is explicitly 2D phase-correlation reference data, not a physical 3D camera solution.
- **Authenticity:** Pose/OpenPose/depth/normals/subject-mask models were unavailable; their expected outputs are explicitly absent and listed in `unsupported_layers.json`. No placeholder or renamed reference is presented as depth/pose.
- **Evidence:** [`../engineering/motion-previs-report.md`](../engineering/motion-previs-report.md), [`../engineering/previs-bundle/`](../engineering/previs-bundle/).
- **Adjudication:** PRE-01/02/03 `PASS — TECHNICAL CANDIDATE`; no runtime promotion.

### BASE-09 — Vox beat and local-film candidate

- **Command/result:** `python3 _workspace/20260718-resource-refinement/design/vox-resource-film/validate-contract.py` → `PASS: beats=4 shots=8 planned=24.000s moves=push_in→pan→parallax→tilt→pull_out→element→push_in→static; video=h264 960x540 24/1 yuv420p duration=22.625s; faststart=moov(36)<mdat(17007); samples=4`.
- **Measured:** 4,827,490-byte H.264/AAC MP4 at 960×540, 24 fps, yuv420p, 22.625 s; output SHA-256 `e508c0ec3993fe1e4a4c16c682cb5f148614a742a8a51c839273d208386ae204`.
- **Editorial:** Four beats × two 3-second shots; first title within 3 seconds; adjacent camera moves never repeat; seven move classes plus static payoff; the traveling signal-ribbon formula is limited to one beat.
- **Fallback truthfulness:** Atlas key was absent, so no Atlas generation was claimed. A deterministic repository-asset Pillow/FFmpeg fallback was built without synthetic placeholder substitution.
- **Visual:** Four extracted samples passed independent review for English/Korean title contrast, source-card visibility, source identity and palette progression. No participant playback, reduced-motion browser path or runtime still/text fallback was exercised because the candidate was not promoted.
- **Evidence:** [`../engineering/vox-report.md`](../engineering/vox-report.md), [`../design/vox-resource-film/beats.json`](../design/vox-resource-film/beats.json).
- **Adjudication:** VOX-01/02 `PASS — CANDIDATE`; VOX-03 `NOT SCORED`.

### BASE-10 — New encounter audio and scene lifecycle

- **Commands/results:** `python3 scripts/generate_game_audio.py validate --input assets/audio/breach-alert.mp3 --role sfx`, `python3 scripts/generate_game_audio.py validate --input assets/audio/wave-spawn.mp3 --role sfx`, and `python3 scripts/generate_game_audio.py validate --input assets/audio/battle-bgm.mp3 --role music` each returned `valid:true`; JavaScript syntax, Python compile, manifest JSON and targeted path/role/hash checks exited 0.
- **Measured:** All three are 44.1 kHz/128 kbps MP3. `breach-alert` is mono, 2,429 ms, 39,331 bytes, -14.42 LUFS-I/-3.51 dBTP; `wave-spawn` mono, 1,541 ms, 25,120 bytes, -14.62 LUFS-I/-2.95 dBTP; `battle-bgm` stereo, 24,033 ms, 384,983 bytes, -18.05 LUFS-I/-5.30 dBTP. All 20 shipped MP3s total 1,369,716 bytes (1.306 MiB) versus the 4 MiB cap.
- **Runtime:** Clean browser session observed accepted first `start-wave` request/play exactly once, distinct later accepted wave signals, lobby theme → battle BGM after user opt-in, and battle → lobby cleanup/restoration. `breach` mapping was statically verified but no fabricated playback was claimed because the run cleared before breach.
- **Provenance/cache:** The three procedural recipes, bytes and hashes match media-manifest records; each path appears once in runtime and SW optional media.
- **Evidence:** [`../engineering/audio-report.md`](../engineering/audio-report.md).
- **Adjudication:** AUD-01/02 and AUD-03 new-resource/event subset `PASS`; full legacy-audio probe, AUD-04 listener score and AUD-05 autoplay/load failure remain `NOT SCORED`.

### BASE-11 — GLB raster bridge closure

- **Command/result:** `/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render-8dir-atlas.py -- --verify --project-root .` → `GLB_RASTER_VERIFY records=45 action_atlases=42 terrain_plates=3 missing_actions=0 minimum_edge_padding_px=12 minimum_animated_direction_columns=8 manifest_sha256=d3609a878549974218871fd9867be25b482a7d5030d782a810efa9330af7a82c`.
- **Measured:** 42 RGBA 1024×512 action atlases with 8×4 128px cells plus three 128×128 terrain plates; 45 PNG bytes 12,289,554 and manifest bytes 69,718, combined 12,359,272 bytes (11.7867 MiB) under the 12 MiB bridge cap.
- **Framing/alpha:** Every 128px cell is non-empty with ≥12px transparent edge padding; all eight direction columns are animated; frames 1/10/20/30 and yaw 0°…315° are declared.
- **Runtime selection:** Canvas continues to fetch only the bridge JSON/PNG contract, with no GLB parser. Focused harness observed two defeated combatants latched to `Defeat` after engagements cleared.
- **Visual:** Specialist review found five representative action/boss/prop samples readable at their 64/82/52px runtime draw sizes. No independent blind identification or reduced-motion browser packet was collected.
- **Manifest reconciliation:** Serialized publish `/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render-8dir-atlas.py -- --pack --publish --project-root .` reported `GLB_RASTER_PACK assets=15 action_atlases=42 terrain_plates=3 outputs=45 media_manifest=updated`. QA then joined shared `assets[].filename` to bridge `records[].output.path`: entries 45/45, byte matches 45/45, SHA-256 matches 45/45, mismatches 0.
- **Evidence:** [`../engineering/sprite-bridge-report.md`](../engineering/sprite-bridge-report.md).
- **Adjudication:** B2D-01/02/03 `PASS`; B2D-04 specialist/direction subset `PASS`; B2D-05/06 `NOT SCORED`.

### BASE-12 — Full shared media-manifest audit

- **Method/session:** QA parsed all `assets/media-manifest.json assets[]`, resolved each `filename`, and for present regular files recomputed exact bytes and SHA-256.
- **Measured after stale-row cleanup:** 188 records total; 188 regular-file paths exist; byte matches 188/188; SHA-256 matches 188/188; mismatches 0. Bridge subset remains present/byte/hash matching 45/45.
- **Interpretation:** Stale historical support-file rows were removed rather than misrepresented as present. Full shared file inventory and serialized bridge reconciliation are clean for the current snapshot.
- **Adjudication:** `PASS — FULL FILE INVENTORY`.

### BASE-13 — Fresh browser presentation-path proof

- **Evidence:** [`browser-evidence/runtime-resource-e2e.json`](browser-evidence/runtime-resource-e2e.json), [`browser-evidence/stage1-3d.webp`](browser-evidence/stage1-3d.webp), and [`browser-evidence/stage1-canvas-fallback.webp`](browser-evidence/stage1-canvas-fallback.webp); fresh sessions dated 2026-07-18 at `http://127.0.0.1:8877/`.
- **Canonical cinematic:** `hidden=false`, `paused=false`, `muted=true`, `readyState=4`, intrinsic 960×540; fallback hidden and transcript expanded.
- **Three.js path:** Stage 1 requested direct `cinder-span`, `shade`, `scout`, and `cinder-warden` GLBs; status reported `GLB 소스 아틀라스 4/4 · 동작 클립 13개 활성`; 3D canvas visible.
- **Forced renderer fallback:** Before app load, `HTMLCanvasElement.getContext('webgl2')` returned `null` for the 3D canvas. The session hid 3D, showed Canvas2D, requested all 45 bridge PNGs, and reported `GLB 소스 아틀라스 45/45 · 동작 클립 42개 활성`. After `hunt×2 → extract → materialize`, ally state read `황혼 군단 · 2/10 실체화됨`.
- **Audio scene path:** Under the successful media-play branch, battle music selected `assets/audio/battle-bgm.mp3` with `scene=battle`.
- **Scope limit/adjudication:** Intended Three.js load and renderer-unavailable Canvas selection `PASS — BROWSER SUBSET`; cinematic and battle-BGM runtime paths corroborated. Screenshots do not score full G4. Direct GLB/PNG load-fault trace equivalence, SW version-upgrade/offline cache behavior, reduced-motion and human readability/immersion remain unscored.

### BASE-14 — Post-change three-stage browser rerun

- **Command/result:** `node tests/playtest-browser-3stage.cjs` → `PLAYTEST_BROWSER_PASS stages=Cinder Span,Veil Citadel,Echo Throne legion=0/10,4/10,8/10 worker=/sw.js cache=abyssal-surge-static-v38 optional-media-errors=6`; wall time 249.58 s.
- **Observed warnings:** Repeated WebGL GPU-stall/deprecation warnings only. The harness classifies six optional-media errors as tolerated and rejects unexpected client errors separately.
- **Scope limit/adjudication:** `PASS — POST-CHANGE THREE-STAGE BROWSER FLOW`. This does not prove direct media-fault state equivalence, offline/version-upgrade cache behavior, the focused asset/release contract, or full G6.

### BASE-15 — Post-change focused resource contracts

- **Command/result:** `node --test tests/resource-refinement-assets.test.mjs tests/app-command-feedback.test.mjs tests/battle-realtime-three.test.mjs` → 45/45 `PASS`; fail/cancelled/skipped/todo 0; duration 1,135.776 ms.
- **Covered subset:** 188-record inventory closure, schema v2 to 45-record raster bridge reconciliation, audio and canonical cinematic contracts, candidate honesty, accepted event cues, battle-BGM teardown/fallback, and Canvas `Defeat` latch.
- **Scope limit/adjudication:** REL-02 and the G6 post-change focused-contract subset `PASS`. This does not establish complete provenance, SW version-upgrade/offline behavior, direct presentation-failure trace equivalence, compact/reduced-motion quality, or full G6.






## 3. Domain measurement ledger

| Test IDs | Threshold summary | Current measured value | Method/evidence | Current verdict |
|---|---|---|---|---|
| M3D-01/02/05/06 | 15 declared assets; valid embedded-texture glTF 2.0; exact declared actions; unit vocabulary/root origin; normal-map/tangent contract | Headless build and source load passed; 15/15 hashes/actions/images/tangents passed; focused asset test 4/4 PASS | BASE-06; mesh report | `PASS — STRUCTURAL/AUTOMATED` |
| M3D-03 | Zero root; Blender Z-up ground and runtime Y-up ground within 0.01 m; declared body/plinth centered; asymmetric equipment centroid offsets quantified/traced | Roots exact zero; authoring ground 15/15 `0.000000 m`; runtime ground 15/15 `0.000000 m`, raw max `3.2e-8 m`; axis map recorded; max full-AABB radial `0.272168 m` traced to asymmetric silhouette equipment | BASE-06; mesh report 15-row pivot table | `PASS` |
| M3D-04 | Declared skin or rigid-control architecture resolves and sampled transforms/bounds remain finite | Five units have body/equipment rigid-control targets and secondary channels; skinning intentionally absent; per-clip sampled bounds not tabulated | BASE-06; mesh report | `PASS — CONTROL-TARGET SUBSET`; sampled-bounds portion `NOT SCORED` |
| M3D-07 | Intended GLBs load; injected failure falls back; identical one-action public trace/save; zero uncaught errors | Fresh browser loaded four intended Stage 1 GLBs and 13 clips; forced WebGL2 unavailability hid 3D and selected Canvas2D, where all 45 bridge PNGs loaded and `hunt×2 → extract → materialize` produced ally `2/10`. No direct GLB-file fault injection or normal/fallback trace-save diff was captured. | BASE-13; browser JSON/screenshots | Intended load and renderer fallback `PASS`; trace equivalence `NOT SCORED` |
| M3D-08 | No major deformation/foot-slide/identity/action-silhouette defect at normal/compact size | Technical artist reviewed a 5×8 contact sheet with no silhouette overlap; independent compact/blind review absent | BASE-06; mesh report | `PASS — SPECIALIST SILHOUETTE SUBSET`; full row `NOT SCORED` |
| B2D-01/02 | Exact source/output hashes; safe unique PNGs; 8×4 action atlas, 128px cells; manifest/image agreement | 45/45 records: 42 action atlases + 3 terrain; 0 missing actions; all cells non-empty with ≥12px padding; exact input/output hashes and manifest digest | BASE-11; sprite bridge report | `PASS` |
| B2D-03 | Canvas GLB-derived path remains manifest+PNG only; no Canvas GLB parser/WebGL requirement | Forced WebGL2-unavailable browser session hid 3D, showed Canvas2D, and requested all 45 bridge PNG outputs; no Canvas GLB parser was required | BASE-11/13; sprite bridge report and browser JSON/screenshots | `PASS — SOURCE/RUNTIME SELECTION` |
| B2D-04 | Correct eight-direction/frame semantics and compact action/identity legibility | All 8 direction columns animated in declared yaw order; frames 1/10/20/30; five specialist samples readable at 64/82/52px; no two-reviewer blind sheet | BASE-11; sprite bridge report | `PASS — STRUCTURAL/SPECIALIST`; blind threshold `NOT SCORED` |
| B2D-05 | Reduced-motion chooses a stable sufficient frame | No reduced-motion browser packet | Runtime/QA evidence pending | `NOT SCORED` |
| B2D-06 | Missing manifest/PNG degrades without state mutation or uncaught error | Fallback hierarchy is documented, but no browser fault-injection trace/save packet | Runtime report pending | `NOT SCORED` |
| AUD-01/02 | 44.1 kHz MP3; role channel/bitrate/duration contract; EBU loudness by role; true peak ≤-1 dBTP; SFX ≤100 KiB, narration ≤250 KiB, ambience/music ≤1 MiB, active audio ≤4 MiB | Three new files pass role validators and level/headroom/size limits; all shipped MP3 bytes total 1.306 MiB; full per-file probe table for the other 17 assets was not supplied | BASE-10; audio report | `PASS — THREE NEW ASSETS`; full inventory row `NOT SCORED` |
| AUD-03 | Correct URL once per accepted trigger and scene lifecycle cleanup | Accepted first `start-wave` played `wave-spawn.mp3` once; distinct declared waves emitted distinct cues; user-activated battle path selected `battle-bgm.mp3` with `scene=battle`, and prior browser evidence restored lobby audio on exit; breach branch statically matched only | BASE-10/13; audio report and browser JSON | `PASS — NEW EVENT/SCENE SUBSET` |
| AUD-05 | Autoplay/load failure preserves text, command and identical authoritative state | No audio failure/autoplay-denial packet | Runtime report pending | `NOT SCORED` |
| AUD-04 | Exact script/cue identity and collected listener median intelligibility ≥4/5; complete text equivalent | Cue identity is recorded, but no listener sheet | Audio report; human scorecards absent | `NOT SCORED` |
| VID-01 | H.264/yuv420p/960×540/24 fps, decode/validator exit 0 | H.264 High, 960×540, yuv420p, 24/1 fps, 19.02 s, 2,252,481 bytes; both validators and full decode passed | BASE-04; video report | `PASS` |
| VID-02 | Faststart / progressive atom order verified | Faststart passed | BASE-04; video report | `PASS` |
| VID-03/04 | Optional lifecycle and failure fallback preserve commands/state with zero uncaught error; caption/transcript/still remain | Browser play/pause/end/error/recovery, VTT readiness and MP4 fallback passed; presentation writes no campaign state | BASE-04; video report | `PASS — VIDEO SUBSET` |
| VID-05 | Human shot/subtitle/compact/replacement readability passes | No reviewer sheet | Video report pending | `NOT SCORED` |
| REL-01 | 100% declared changed/runtime resources have exact bytes/hash/source/generator/prompt-or-recipe/ownership record; no stale/orphan inventory record | Shared manifest closes 188/188 existing/byte/hash matches with zero mismatch; bridge is 45/45 matching. Linked mesh/GTI/Vox/Previs reports support only their declared outputs; this numeric reconciliation does not establish complete provenance. PerfectPixel generated none. | BASE-04/06–12 and linked reports | File/hash `PASS`; complete provenance `NOT SCORED` |
| REL-02 | Final focused asset/release tests pass after all changes | Post-change resource, command-feedback and realtime-three contracts pass 45/45; fail/cancelled/skipped/todo 0 | BASE-15; exact Node test command | `PASS` |
| REL-03 | Same-origin/in-root admission; traversal/cross-origin rejected | Existing assertions passed within focused baseline; final post-change output absent | Runtime report pending | `PASS — PRE-CHANGE BASELINE`; final `NOT SCORED` |
| REL-04/05 | Fresh install/offline works; prior project caches removed; final response hashes current | No final browser cache dump | Runtime report pending | `NOT SCORED` |
| REL-06/RM-03 | Normal, reduced-motion and each media-failure run have identical authoritative action order/count, result and save | No trace/save diff artifact | Runtime report pending | `NOT SCORED` |
| REL-07 | Core ≤2 MiB; optional install ≤32 MiB; bridge+manifest ≤12 MiB; install attempt ≤48 MiB; active lazy GLB ≤112 MiB; worst-case persistent cache ≤160 MiB; inactive candidate pre-cache and old cache names both 0 | Final bridge+manifest is 12,359,272 bytes (11.7867 MiB) and all shipped audio 1.306 MiB; PM baseline is 36.97 MiB install, 104.98 MiB lazy GLB, 141.95 MiB combined; full final candidate not recalculated | BASE-11, BASE-10, PM release map; runtime report pending final union | `PASS — BRIDGE/AUDIO + MEASURED BASELINE`; full row `NOT SCORED` |
| UX-01 | 360×800: no horizontal overflow; critical copy/actions visible; controls ≥48×48 CSS px | No final measurement | QA evidence pending | `NOT SCORED` |
| UX-02 | 320×640/DPR2 touch: same action semantics; no overflow/hit error | No final measurement | QA evidence pending | `NOT SCORED` |
| UX-03 | 100% critical-state identification, ≥80% identity/facing, 0 unresolved S1/S2 readability complaint | No blind review sheet | QA evidence pending | `NOT SCORED` |
| RM-01/02 | Before-load reduced-motion emulation skips Three.js/video, uses static Canvas, suppresses major motion, retains immediate sufficient text | No final browser packet | Runtime/QA evidence pending | `NOT SCORED` |
| RM-04 | 0 S1/S2 comfort/readability complaint with raw human observations | No participant evidence | Human scorecards absent | `NOT SCORED` |
| GTI-01/02/03 | Every proposed PNG fully decodes with finite dimensions and matching bytes/hash; exact prompt/input/tool/rights provenance; human design/readability approval | Real PNG decodes at 1672×941 with matching hash; dry-run and HTTP 200 generation/provenance passed; specialist normal-size review passed; compact review absent | BASE-07; [`../design/gti-image-report.md`](../design/gti-image-report.md) | GTI-01/02 `PASS`; GTI-03 `NOT SCORED` |
| PP-01/02/03 | `ppgen -json` bundle/member closure; consistent cross-state identity; transparent RGBA background with no key-color field/severe fringe | Requested provider unsupported; exit 1; generated media 0; no fake bundle; identity/transparency not assessable | BASE-05; [`../engineering/perfectpixel-report.md`](../engineering/perfectpixel-report.md) | `NOT SCORED — PROVIDER BLOCKED` |
| VOX-01 | Valid beats; ≤3 s hook; two 3–6 s shots per beat; no adjacent repeated camera move; ≥3 move types; static payoff; flyer motif not every beat | 4 beats/8 shots; first title within 3 s; sequence `push_in→pan→parallax→tilt→pull_out→element→push_in→static`; formulaic ribbon limited to one beat | BASE-09; Vox report and beats | `PASS — CANDIDATE` |
| VOX-02/03 | H.264/yuv420p/960×540/24 fps/faststart plus decode, human playback/readability, reduced-motion and still/text fallback before promotion | Encode/profile/atom-order validator passed and four samples passed specialist readability; no participant playback, reduced-motion browser or fallback promotion evidence | BASE-09; Vox report | VOX-02 `PASS — ENCODE/SAMPLE`; VOX-03 `NOT SCORED` |
| PRE-01 | Exact source checksum/bytes/trim/timebase and bundle-member hash closure | Source plus 30 checksum entries OK; 29 artifact hashes, 456 camera+scene records and 19 frames validated | BASE-08; [`../engineering/previs-bundle/`](../engineering/previs-bundle/), [`../engineering/motion-previs-report.md`](../engineering/motion-previs-report.md) | `PASS — TECHNICAL CANDIDATE` |
| PRE-02/03 | Claimed depth/pose has analyzer evidence; unavailable layers omitted/not-generated; metadata finite/aligned/safe | Unsupported pose/depth/normals/mask files are absent and declared; no fake layer; 2D apparent motion is explicitly bounded and not called a 3D solve | BASE-08; Motion Previs report | `PASS — TECHNICAL CANDIDATE` |

## 4. G1 — narrative/provenance consistency subset

### Scope

Only the new/changed resource inventory, provenance, cue/asset identity, and trace to this run’s presentation intent are in scope. A complete audit of every shipped string/effect/scenario is not in scope.

### Subset threshold

- 100% of new/changed assets reconcile to exact runtime path, bytes and SHA-256.
- Each has source, generation method/version, prompt or procedural recipe, and ownership/license note.
- Asset/cue identity matches [`../design/presentation-spec.md`](../design/presentation-spec.md) and the runtime map.
- 0 unwaived provenance, identity, or copied-content conflicts.

### Measurement

- **Current value:** Stage 1 defended-battle numbers in the presentation spec exactly match `campaign-state.js` (prep 8 s; waves 8/22/36 s; counts 2/3/3; health 2; breach 1). Serialized reconciliation closes shared bridge records at 45/45 byte and SHA matches; audio/video shared records and declared mesh/GTI/Vox/Previs report provenance close, with no PerfectPixel output fabricated.
- **Method:** REL-01 specialist audit; direct comparison of presentation-spec authority example to `campaign-state.js`; join shared manifest `assets[].filename` to bridge `records[].output.path` and compare `bytes`/`sha256`.
- **Evidence:** BASE-04/06–11, [`../design/presentation-spec.md`](../design/presentation-spec.md), linked specialist reports.
- **Verdict:** **PASS — DECLARED RESOURCE/TRACE SUBSET**.

### Full G1

**NOT SCORED.** Full G1 requires 100% of all shipped player-visible strings/effects/scenarios to trace to the canonical worldview with zero unwaived violations. This resource-cycle draft has not performed that whole-game inventory.

## 5. G4 — presentation/immersion subset

### Automated surface threshold

- Critical accepted/rejected feedback ≤100 ms through text/semantics.
- No unresolved S1/S2 readability defect.
- 360×800 and 320×640/DPR2 compact contracts pass.
- Reduced motion, blocked audio/video, bridge failure and GLB failure retain sufficient readable feedback and an authoritative state identical to normal presentation.

### Measurement

- **Current value:** No final compact/reduced-motion browser packet or latency sample exists.
- **Method:** UX-01–03, RM-01–03, feedback-latency probes.
- **Evidence:** `qa/evidence/<UTC-run-id>/`, sprite/video/audio reports, runtime report.
- **Verdict:** **NOT SCORED**.

### Full G4 human gate

- **Threshold:** At least 10 eligible complete first-loop scorecards; median five-question participant composite ≥4.0/5; feedback latency ≤100 ms; 0 unresolved S1/S2 readability complaints.
- **Measured value:** No eligible human immersion scorecards supplied.
- **Method:** Not run.
- **Evidence:** None.
- **Verdict:** **NOT SCORED**.

No file validator, screenshot, benchmark comparison, or QA operator opinion may promote full G4 to `PASS`.

## 6. G6 — resource/release integration subset

### Subset threshold

- Final focused asset/release tests pass after all modifications.
- Canonical audio/video/model/bridge files meet declared format contracts.
- Manifest/provenance/hash closure is 100%.
- Fresh install, version upgrade, offline reload, and optional-media failures preserve a usable campaign and current assets.
- Presentation variants/failures produce identical authoritative action trace/save result.
- Exact final candidate remains within all PM hard caps: core 2 MiB, optional install 32 MiB, bridge+manifest 12 MiB, total install 48 MiB, active lazy GLB 112 MiB, worst-case persistent cache 160 MiB; inactive/P4 candidate pre-cache count and old cache names are both 0.

### Measurement

- **Focused baseline:** 26/26 PASS before final specialist closure.
- **Resolved:** The canonical cinematic was conformed from 30 fps to 24 fps and now passes VID-01/02/03/04; see BASE-04.
- **Post-change browser flow:** `node tests/playtest-browser-3stage.cjs` passed all three stages against worker `/sw.js` and cache `abyssal-surge-static-v38`; see BASE-14.
- **Post-change focused contracts:** 45/45 PASS across resource inventory/bridge/media, command-feedback/audio lifecycle and realtime-three/Canvas latch coverage; see BASE-15.
- **Missing final evidence:** SW fresh-install/version-upgrade/offline cache packet; direct media/GLB/PNG failure-equivalence traces; independent compact/blind and reduced-motion evidence.
- **Verdict:** **FIX**.

### Full G6

**NOT SCORED.** Full G6 additionally requires implemented telemetry, a tested rollback runbook, 100% release-readiness checklist, p95 frame ≤16.7 ms, long frames <0.5%, stable 30-minute soak, and input ≤100 ms. Those whole-operations artifacts and measurements are not part of the evidence currently available.

## 7. Other harness gates

| Gate | Status | Reason |
|---|---|---|
| G2 rules/balance | `NOT SCORED` | No balance simulation in this resource cycle. |
| G3 archetype diversity | `NOT SCORED` | No archetype rotation in this resource cycle. |
| G5 revenue/balance | `NOT SCORED` | No fairness/revenue simulation in this resource cycle. |
| G7 core loop | `NOT SCORED` | Resource integration does not replace loop/repeat-rate evidence. |
| G8 novelty | `NOT SCORED` | Comparable references calibrate presentation only; no QA impression cohort was collected. |

## 8. Required closure evidence

The Stage 1 resource-refinement subset remains `FIX` until all items below are present and linked:

1. [`../engineering/mesh-rig-report.md`](../engineering/mesh-rig-report.md): final hashes, headless Blender command, M3D-03/04/06/08 results.
2. [`../engineering/sprite-bridge-report.md`](../engineering/sprite-bridge-report.md): final bridge hashes/layout/contact sheet and compact readability handoff.
3. [`../engineering/audio-report.md`](../engineering/audio-report.md): final MP3 probe/decode/level/cue/failure evidence.
4. [`../engineering/video-report.md`](../engineering/video-report.md): canonical 24 fps validator PASS, faststart, runtime/fallback review and final hash.
5. [`../engineering/runtime-integration-report.md`](../engineering/runtime-integration-report.md): final manifest union, focused post-change test output, normal/failure/reduced trace-save diffs, and fresh-install/upgrade/offline cache evidence.
6. [`../pm/resource-budget-and-release-map.md`](../pm/resource-budget-and-release-map.md): final candidate byte recalculation passes REL-07 and no RB-01–10 rollback trigger remains active.
7. `qa/evidence/<UTC-run-id>/`: final 360×800, 320×640/DPR2, reduced-motion and accessibility evidence.
8. A defect ledger showing 0 open S1/S2 issues for any scoped `PASS`.
9. [`../design/gti-image-report.md`](../design/gti-image-report.md): every GTI candidate has PNG decode/hash and complete prompt/input/tool/rights provenance before promotion.
10. [`../engineering/perfectpixel-report.md`](../engineering/perfectpixel-report.md): `ppgen` bundle closure, identity and transparent-background checks pass before promotion.
11. [`../engineering/vox-report.md`](../engineering/vox-report.md) plus [`../design/vox-resource-film/beats.json`](../design/vox-resource-film/beats.json): anti-monotony and 24 fps/faststart/fallback checks pass before promotion.
12. [`../engineering/motion-previs-report.md`](../engineering/motion-previs-report.md) plus [`../engineering/previs-bundle/`](../engineering/previs-bundle/): source checksum closes and no fake depth/pose claim is present.

Human immersion is deliberately not a Stage 1 subset closure substitute: if no eligible cohort is collected, full G4 stays **NOT SCORED** even after every automated row passes.
