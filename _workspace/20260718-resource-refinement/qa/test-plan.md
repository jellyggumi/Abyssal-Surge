# Resource refinement QA test plan

**Run:** `20260718-resource-refinement`  
**Stage:** Stage 1 resource/presentation refinement  
**Status:** `DRAFT / PARTIALLY EXECUTED` — scoped specialist results are recorded in [`gate-measurements.md`](gate-measurements.md); unexecuted rows remain `NOT SCORED` or `FIX` where observed drift exists.  
**Non-goal:** This plan does not authorize code, test, or asset changes and does not score whole-game G1/G4/G6.

## 1. Objective and invariants

Prove that refined 3D mesh/rig, 2D raster bridge, audio, video, and cache/manifest resources are valid files, are actually reachable through the current runtime, degrade safely, remain readable in compact and reduced-motion modes, and do not alter the authoritative campaign outcome.

Hard invariants:

1. `campaign-state.js` is the only authority for rules, save envelopes, and replay/action trace.
2. Presentation success/failure may change only visible/audible delivery. It must not create, suppress, duplicate, reorder, or modify an authoritative action/result.
3. Three.js may parse source GLBs. Canvas 2D may consume only the raster bridge manifest and PNGs; adding a Canvas-side GLB parser is a `FIX`.
4. Every new or changed binary must be traceable by source, generation method, prompt or procedural recipe, ownership/license statement, bytes, and SHA-256 in `assets/media-manifest.json` or the cycle engineering resource manifest.
5. Missing evidence is not a pass. Human-only criteria cannot be inferred from file validators.

## 2. Status vocabulary

| Status | Meaning |
|---|---|
| `PASS` | The exact scoped threshold was exercised after the final change and the command/session plus raw evidence path is present. |
| `FIX` | A scoped threshold failed, evidence is missing for a required row, or an S1/S2 defect remains open. The owner must correct and rerun the affected bundle. |
| `NOT SCORED` | The row requires evidence that was intentionally not collected, especially structured human scoring. This is never equivalent to `PASS`. |
| `NOT RUN` | Planned but no execution evidence exists yet. |

A pre-change baseline may be recorded as such but cannot serve as the final post-change verdict.

## 3. Evidence ownership and canonical paths

| Lane | Owner evidence | Minimum contents |
|---|---|---|
| Mesh/rig | [`../engineering/mesh-rig-report.md`](../engineering/mesh-rig-report.md) | Final asset list/hashes, Blender version and exact headless command, mesh/skin/action inspection, pivot/bounds values, sampled renders, failures and fallback. |
| 2D bridge | [`../engineering/sprite-bridge-report.md`](../engineering/sprite-bridge-report.md) | Generator command/version, source and output hashes, record count, atlas geometry, direction/frame contact sheet, downscaled checks, runtime manifest-only proof. |
| Audio | [`../engineering/audio-report.md`](../engineering/audio-report.md) | Generation source/recipe, final hashes, `ffprobe`/decode results, duration/level table, cue mapping, runtime/failure evidence. |
| Video | [`../engineering/video-report.md`](../engineering/video-report.md) | Render/validation commands, codec/pixel format/resolution/fps/faststart values, duration/hash, captions/transcript/fallback and failure evidence. |
| Runtime/cache/manifest | [`../engineering/runtime-integration-report.md`](../engineering/runtime-integration-report.md) | Runtime request map, manifest reconciliation, focused tests, normal/failure/reduced-motion trace comparison, fresh-install/upgrade/offline cache evidence. |
| QA browser selection/fallback | [`browser-evidence/runtime-resource-e2e.json`](browser-evidence/runtime-resource-e2e.json), [`browser-evidence/stage1-3d.webp`](browser-evidence/stage1-3d.webp), [`browser-evidence/stage1-canvas-fallback.webp`](browser-evidence/stage1-canvas-fallback.webp) | Fresh-session 3D GLB requests/status, forced-WebGL2-unavailable Canvas/45-PNG selection, cinematic state/transcript, battle-BGM path, command/state sample, and explicit scope disclaimer; screenshots are not human G4 evidence. |
| Design | [`../design/presentation-spec.md`](../design/presentation-spec.md) | Scene/resource intent, silhouette and cue hierarchy, motion/reduced-motion equivalence, compact-layout priorities. |
| Release budget/rollback | [`../pm/resource-budget-and-release-map.md`](../pm/resource-budget-and-release-map.md) | Exact candidate byte accounting, cache-tier caps, media role format/size limits, public-delivery exclusions, and RB-01–10 rollback triggers. |
| GodTiboImagen image lane | [`../design/gti-image-report.md`](../design/gti-image-report.md) | Exact prompt/input/tool provenance, final PNG paths/bytes/SHA-256, decode/dimension/color-mode evidence, rights statement, and design review. |
| PerfectPixel lane | [`../engineering/perfectpixel-report.md`](../engineering/perfectpixel-report.md) | Exact `ppgen -json` command/result, bundle inventory/manifest, state/frame/direction closure, identity review, alpha/transparency checks, hashes and provenance. |
| Vox collage lane | [`../engineering/vox-report.md`](../engineering/vox-report.md) | [`../design/vox-resource-film/beats.json`](../design/vox-resource-film/beats.json) schema/cadence review, anti-monotony metrics, final codec/fps/faststart/hash validation and fallback. |
| Motion Previs lane | [`../engineering/motion-previs-report.md`](../engineering/motion-previs-report.md) | [`../engineering/previs-bundle/`](../engineering/previs-bundle/) inventory, source checksum, bundle-manifest checksum closure, analyzer settings/logs, and explicit depth/pose authenticity result. |
| QA | [`gate-measurements.md`](gate-measurements.md) | Threshold, measured value, method, timestamp/build, command/session, evidence link, scoped verdict. |

Raw interactive evidence belongs under `qa/evidence/<UTC-run-id>/` and must preserve failures rather than overwrite them:

```text
metadata.json
requests.json
console-errors.json
page-errors.json
action-trace.json
save-envelope.json
frame-timings.json               # only when measured
NN-normal-360x800.png
NN-reduced-360x800.png
NN-accessibility-snapshot.txt
human-scorecards.csv             # only from real participants
result.md
```

## 4. Automated versus human evidence

| Evidence class | Automation allowed | Human required | Adjudication |
|---|---|---|---|
| Container/header/hash/path/manifest integrity | Yes | No | Validator output may `PASS` the file-contract row only. |
| Pivot, bounds, clip names, skin/weights, root motion | Yes, plus headless Blender sampling | Visual review of deformation/silhouette is required for presentation quality | Structural success does not prove the animation looks correct. |
| Raster dimensions, cell geometry, hashes, path safety | Yes | Direction identity, silhouette, alpha halo, and downscaled readability need human review | Both halves must pass for the bridge-quality row. |
| Audio codec/duration/peak/decode | Yes | Cue identity, narration intelligibility, fatigue, and mix masking require a listener | File validation cannot score sound quality. |
| Video codec/fps/pixel format/faststart/decode | Yes | Shot readability, subtitle timing, and comprehension without sound require a viewer | Both halves must pass for video-quality row. |
| Runtime request, fallback, cache, action trace/save equivalence | Yes, browser automation | Human not required unless appearance is being judged | Raw requests/errors/trace/save must be retained. |
| Compact viewport geometry/overflow/control size | Yes | Tactical silhouette and text comprehension require human review | A screenshot plus DOM metrics is required. |
| Reduced-motion functional equivalence | Yes | Comfort/clarity observation is human | No motion-only or sound-only state allowed. |
| Full G4 immersion | No substitution allowed | Yes: structured human cohort | No cohort means full G4 `NOT SCORED`. |

## 5. Preconditions

1. Record full revision/build identifier, UTC time, OS, browser/version, viewport/DPR, locale, connection state, cache name, reduced-motion setting, Blender version, Node version, Python version, and FFmpeg/ffprobe version used by the lane.
2. Resolve all asset paths from the repository root. Do not validate copied files outside their runtime path.
3. Final hash collection occurs after all asset generation and before browser/cache execution. If a file changes later, invalidate the prior row and rerun it.
4. For browser comparison, create one authoritative campaign fixture through public `campaign-state.js` APIs or visible UI, never by inventing a private state object.
5. Attach `console.error`, `pageerror`, failed-request, media-error, and service-worker lifecycle listeners before navigation.
6. Run only focused checks named in this plan or the specialist report. Do not run formatters, linters, or the project-wide test suite.
7. Apply the numeric resource and cache limits in [`../pm/resource-budget-and-release-map.md`](../pm/resource-budget-and-release-map.md). A specialist may tighten them but may not introduce a looser second threshold.

## 6. Test matrix

### 6.1 Three-dimensional mesh and rig

| ID | Type | Method and captured values | `PASS` threshold | `FIX` condition | Evidence |
|---|---|---|---|---|---|
| M3D-01 Pack closure | Automated | Run the focused asset contract after the final export; enumerate manifest IDs/categories/paths and real files. | Exactly 15 unique declared assets with current intended category counts; every path is pack-relative, in-root, regular, non-empty; source `.blend` exists. | Missing/extra/duplicate/out-of-root/empty asset or undeclared binary. | Mesh report plus focused test output. |
| M3D-02 GLB container and embedded media | Automated | Parse every GLB header/chunk; inspect buffers/images. | glTF 2.0 GLB; valid lengths/alignment; JSON first and one BIN payload; declared images are embedded PNG buffer views; no external image URI. | Truncated/invalid GLB, external texture request, MIME mismatch, or unreadable accessor. | Mesh report table per asset. |
| M3D-03 Ground-center pivot | Automated/headless Blender | Evaluate root transform and world-space rest bounds; in Blender Z-up record ground `minZ`, declared body/plinth-center reference, full-equipment AABB center X/Y, dimensions and root; decode exported vertices/node matrices and record runtime Y-up `minY`, center X/Z and axis conversion. | Root translation is exactly zero; authoring `abs(minZ-rootZ)≤0.01 m`; runtime `abs(minY-rootY)≤0.01 m`; declared body/plinth center remains ground-centered; finite positive dimensions. Full-equipment AABB centroid offset is allowed only when quantified and traced to intentional asymmetric silhouette equipment, not root/axis drift. | Floating/sunk asset, nonzero root drift, axis mismatch, non-finite/zero bounds, off-center declared body/plinth, or unexplained equipment-centroid offset. | Mesh report 15-asset authoring/runtime pivot table. |
| M3D-04 Rig/control integrity | Automated/headless Blender | Detect whether each animated asset is skinned or intentionally rigid-controlled. For skins inspect joints, weights and inverse bind matrices; for rigid controls inspect parent targets, animated control channels and sampled transforms/bounds across all clips. | Declared architecture matches export: skin references/finite normalized weights/inverse binds are valid when present; rigid-controlled assets have resolvable control parents and finite secondary channels without unexpected skin dependency; sampled bounds stay finite with no detached/exploding geometry. Rigid props/terrain are explicitly N/A. | Broken reference/parent, invalid weight/matrix/channel, exploding/dead geometry, or unrecorded architecture mismatch. | Mesh report rig/control table and sampled bounds. |
| M3D-05 Action contract | Automated | Compare GLB animation names/order with `manifest.json`; inspect duration/key times and unit Move scene-root translation. | Names/order exactly match declared `actions`; clip suffix matches `actionClips`; duration and key times are finite and positive; units retain `Idle/Move/Strike/Special/Defeat`; Move root X/Z drift ≤`1e-5` unless a director-approved change exists. | Missing/renamed/duplicate/unbounded clip, wrong vocabulary, or root motion that would double runtime movement. | Mesh report and focused test output. |
| M3D-06 Material/normal integrity | Automated plus visual | Inspect image bindings, UV0, normal textures, tangent accessors; render representative lit frames. | Every normal-mapped primitive has POSITION/UV0/TANGENT with finite, count-aligned values; embedded textures render without missing/pink surfaces; representative material families remain distinguishable. | Broken normal binding/tangent, missing texture, NaN, or materially unreadable output. | Mesh report images and accessor table. |
| M3D-07 Runtime load/fallback | Automated browser | Normal run captures GLB requests and `loaded` status; route one selected GLB to fail in a separate run. Compare public action trace/save before and after one legal command. | Normal route loads intended terrain/units/boss. Failed route activates Canvas fallback or static readable path; command remains legal; exactly one identical authoritative action/result is recorded; no uncaught error. | Wrong asset identity, blank/unplayable field, duplicate/missing action, save divergence, or uncaught error. | Runtime report, requests/errors/trace/save JSON. |
| M3D-08 Deformation and silhouette | Human visual review | Review rest plus each action’s key samples at normal and compact display size. | No clipping, foot slide attributable to export, self-intersection that obscures role, reversed facing, or action silhouette confusion; unit/boss identity is correctly chosen in blind side-by-side check. | Any identity/action confusion or major deformation defect. | Mesh report contact sheet and reviewer record. |

### 6.2 Two-dimensional GLB raster bridge

| ID | Type | Method and captured values | `PASS` threshold | `FIX` condition | Evidence |
|---|---|---|---|---|---|
| B2D-01 Source/output closure | Automated | Reconcile each bridge record source path/hash to final GLB and each output path/hash/bytes/dimensions to final PNG. | 100% exact match; unique safe in-root PNG outputs; no missing/zero-byte file. | Hash/bytes/path/dimension drift or orphan source/output. | Sprite bridge report. |
| B2D-02 Atlas geometry | Automated | Inspect `generationVersion`, layout, sample arrays, dimensions and per-record cell size. | `glb-raster-pack-v1`; action atlases use 8 yaw columns and 4 sampled rows, 128×128 cells (normally 1024×512); terrain plate records use one 128×128 cell; positive integral geometry. | Wrong version/layout/order/cell, partial atlas, or manifest/image disagreement. | Sprite bridge report and bridge manifest. |
| B2D-03 Runtime is raster-only | Automated source/release check | Inspect Canvas module closure and browser requests during reduced motion/fallback. | `battle-visualizer.js` loads only bridge manifest/PNGs for GLB-derived art; no `GLTFLoader`, `.glb` request, new parser, or WebGL requirement enters the Canvas path. | Any Canvas GLB parse/load dependency. | Sprite bridge and runtime reports. |
| B2D-04 Direction/frame semantics | Automated sampling plus human visual | Contact sheet labels all 8 yaws and 4 frame samples; compare facing order and sampled action progression against the source render. | No mirrored/reordered direction; no empty cell; action progression and ground contact remain coherent; reduced motion selects a stable frame without losing identity. | Direction swap, flicker-causing crop, empty/duplicate unintended cell, motion-only identity. | Sprite bridge contact sheet/reviewer result. |
| B2D-05 Native/downscaled readability | Human plus pixel metrics | Review each role/boss at runtime size on 360×800 and 320×640/DPR2 screenshots; inspect alpha edges and overlap. | Role, allegiance, facing, boss, and active action are distinguishable without zoom; no clipped weapon/head/feet or severe halo/bleed; terrain does not conceal targets. | Blind identification failure, crop/halo, or combat state unreadable. | Sprite bridge report and QA screenshots. |
| B2D-06 Partial/missing bridge | Automated browser | Route manifest, then one PNG, to fail in isolated runs; capture field, commands, errors and trace. | Runtime reports unavailable/partial state without uncaught error; uses existing geometric/static fallback; same command produces exactly one identical campaign result. | Blank field, state mutation, unsafe retry storm, or command blockage. | Runtime report raw evidence. |

### 6.3 Audio

| ID | Type | Method and captured values | `PASS` threshold | `FIX` condition | Evidence |
|---|---|---|---|---|---|
| AUD-01 File format/decode | Automated | Probe and fully decode every runtime-referenced final audio file; record codec, bitrate mode/rate, sample rate, channels, duration and decode exit. | MP3 at 44.1 kHz; SFX mono/128 kbps CBR/0.5–3.0 s, narration mono/96 or 128 kbps CBR/1–12 s, ambience stereo/128 kbps CBR/5–60 s, music stereo/128 kbps CBR/10–60 s; full decode exits 0. | Non-MP3, zero/truncated/undecodable file, or any role-format/duration mismatch without a director-approved contract change. | Audio report probe/decode table. |
| AUD-02 Level and byte safety | Automated | Measure EBU R128 integrated loudness and true peak; record exact file/family bytes and retain raw analyzer output. | True peak ≤`-1.0 dBTP`; SFX `-18..-14 LUFS-I` and ≤100 KiB; narration `-20..-16 LUFS-I` and ≤250 KiB; ambience `-24..-18 LUFS-I` and ≤1 MiB; music `-18..-14 LUFS-I` and ≤1 MiB; all runtime-active audio ≤4 MiB. | Clipping, loudness/byte/role mismatch, active-audio family over cap, or absent raw evidence. | Audio report and PM release map. |
| AUD-03 Cue mapping and single fire | Automated browser | Trigger each public action/reward and narration key; record requested URL, play attempt, and action trace. | Correct runtime-mapped file requested once per trigger; accepted/rejected state remains represented in text; playback rejection does not duplicate/suppress authoritative action. | Wrong/missing cue, duplicate burst, audio-only result, or state divergence. | Audio and runtime reports. |
| AUD-04 Narration intelligibility/mix | Human listening | Listen with BGM/ambience off and on using the same browser/device; rate text match, intelligibility and masking. | Exact script/cue identity; no clipping/cut-off; ≥4/5 median intelligibility among collected listeners; written transcript/status remains complete. This is an audio-subset score, not full G4. | Script mismatch, unintelligible key line, masking, fatigue defect, or missing text equivalent. | Audio report scorecards. |
| AUD-05 Failure/autoplay path | Automated browser | Route one action cue and one narration MP3 to fail; separately deny autoplay. | Command and narration text proceed; no uncaught/page/console error; controls expose unavailable/paused state where applicable; save/trace matches normal presentation. | Blocked command, error loop, hidden information, or state mismatch. | Runtime report raw evidence. |

### 6.4 Video

| ID | Type | Method and captured values | `PASS` threshold | `FIX` condition | Evidence |
|---|---|---|---|---|---|
| VID-01 Canonical encode | Automated | Run `python3 scripts/render_stage_video.py validate --input assets/video/abyssal-surge-cinematic.mp4`; corroborate with ffprobe and byte accounting. | H.264 video, yuv420p, 960×540, exact `24/1` fps, finite duration, validator exit 0; stage transitions are 5.00±0.10 s and ≤512 KiB each; optional cinematic is ≤60 s and ≤8 MiB; all runtime-active MP4/VTT ≤12 MiB. | Any validator error, including 30 fps; wrong codec/pixel format/size; decode error; role duration/file/family cap exceeded. | Video report raw command/result and PM release map. |
| VID-02 Faststart | Automated | Inspect MP4 atom order or validator output. | `moov` precedes media payload needed for progressive playback; faststart recorded. | `moov` only at tail or unverified. | Video report. |
| VID-03 Runtime lifecycle | Automated browser | Activate optional cinematic and stage transition; capture request, load/play/ended/error state and controls. | User activation starts one intended file; media remains muted/controlled initially as designed; no duplicated source/load loop; stage commands remain independent. | Blocking load, repeated request storm, focus trap, or rule/result mutation. | Video/runtime reports. |
| VID-04 Captions/transcript/fallback | Automated plus human | Verify caption path and transcript semantics; review without sound; route video failure. | Transcript and still/text briefing convey required objective without sound/video; caption file loads where declared; failure hides broken player and leaves controls/commands usable; no uncaught error. | Video-only required information, broken fallback, missing declared caption, or state divergence. | Video/runtime reports and screenshots. |
| VID-05 Shot readability | Human | Review at 960×540, 360×800 embedded layout, and reduced-motion replacement. | Key subject/text remains identifiable, no important UI-safe-area crop, subtitles readable, and the replacement communicates the same required briefing. | Critical subject/copy unreadable or motion is required to understand state. | Video report reviewer sheet. |

### 6.5 Manifest, provenance, cache and release closure

| ID | Type | Method and captured values | `PASS` threshold | `FIX` condition | Evidence |
|---|---|---|---|---|---|
| REL-01 Inventory/provenance | Automated audit plus human record review | Build union of changed files and runtime-referenced media; reconcile to `assets/media-manifest.json` or cycle resource manifest. Recompute bytes/SHA-256. | 100% of new/changed resources have exact path/bytes/hash, source, generator/version, prompt or procedural recipe, ownership/license note, and role; no stale/orphan record. | Missing/fabricated/ambiguous provenance, hash drift, runtime asset omitted from release inventory. | Runtime integration report and manifest diff table. |
| REL-02 Focused contract tests | Automated | Final run: `node --test tests/abyssal-command-assets.test.mjs tests/release-closure.test.mjs`. | All focused tests pass after final files; zero failed/cancelled/skipped required assertions. | Any failure or only pre-change evidence. | Runtime report exact output. |
| REL-03 SW admission/path safety | Automated | Exercise bridge path normalization and runtime media path checks with in-root, traversal, encoded traversal, backslash and cross-origin candidates. | Only same-origin in-root declared resources admitted; traversal/cross-origin rejected; no unsafe cache key. | Unsafe admission or valid declared path rejected. | Runtime report. |
| REL-04 Fresh install | Automated browser | Clear storage/SW/cache; install candidate; record network and cache keys; then offline reload. | Core app, bridge manifest/outputs, and intended optional media policy install without blocking; offline campaign shell and admitted bridge resources load; no stale prior cache. | Install rejection from required asset, missing bridge offline, blank shell, or unexpected rules difference. | Runtime report cache dump and screenshots. |
| REL-05 Upgrade/stale cache | Automated browser | Seed previous `abyssal-surge-*` cache, install candidate, activate, reload; compare final response hashes. | Old project caches removed; candidate cache name active; current response hash matches manifest; no old binary served after activation/reload. | Old hash served, old cache retained, or cache-name/doc contract drift. | Runtime report. |
| REL-06 Offline/optional failure semantics | Automated browser | In separate runs block audio, video, bridge PNG and source GLB; compare normal/failure action trace and save envelope after the same visible command sequence. Include the canonical Stage 1 defended-battle declaration (prep 8 s; waves at 8/22/36 s with counts 2/3/3, hostile health 2, breach damage 1) and verify each renderer/fallback submits only engine-validated semantic events for the active stage/wave. | Optional failures preserve identical authoritative actions/results/save fields and declared encounter timing/count/health/damage; no renderer-local repeating loop, synthetic breach, or asset-failure damage; each media loss has readable fallback; no uncaught error. | Any state/result/declaration difference, duplicate/stale wave event, synthetic breach/damage, command blockage, data loss, or no readable fallback. | Runtime report trace/save diff; [`../design/presentation-spec.md`](../design/presentation-spec.md) authority example; `campaign-state.js` declaration. |
| REL-07 Candidate/cache budgets | Automated | Recalculate exact candidate bytes by PM accounting tier after all changes; inspect SW cache lists and active/public runtime references. | Core ≤2 MiB; optional install media ≤32 MiB; bridge+manifest ≤12 MiB; total install attempt ≤48 MiB; active lazy GLB set ≤112 MiB; worst-case persistent cache ≤160 MiB; complete GLB source pack ≤200 MiB; inactive candidate media pre-cache count 0; old project cache names after activation 0. Per-file/family media caps also pass. | Any hard cap exceeded, P4/inactive candidate promoted to cache, more than one promoted cinematic or three stage clips, runtime-unreferenced candidate MP4 pool >128 MiB, or byte accounting absent. Apply the matching RB-03/RB-08/RB-10 response. | PM release map plus runtime integration report. |

### 6.6 Compact resolution and reduced motion

| ID | Type | Method and captured values | `PASS` threshold | `FIX` condition | Evidence |
|---|---|---|---|---|---|
| UX-01 360×800 geometry | Automated browser plus human | Normal-motion 360×800/DPR1; capture `scrollWidth/clientWidth`, target rectangles, computed font/line metrics, field screenshot and accessibility snapshot. | No horizontal page overflow; current objective/status/action/reward remain visible/reachable; interactive controls have at least 48×48 CSS px hit area; no clipped critical copy. | Overflow, hidden action, control <48 px, overlap/crop, or unreadable critical status. | QA evidence and runtime report. |
| UX-02 320×640 touch stress | Automated browser plus human | 320×640/DPR2/`hasTouch`; use touch for start, one legal action, save control and fallback path. | Same semantic action result as desktop; touch targets reachable; no horizontal overflow or canvas/overlay hit ownership error. | Touch action lost/duplicated, control unreachable, scroll trap or state divergence. | QA evidence. |
| UX-03 Asset readability at compact size | Human blind review | At both viewports, reviewer identifies ally role, boss, facing, objective state, accepted/rejected feedback from still captures without zoom. | 100% critical state identification and ≥80% correct identity/facing across the prepared set; 0 unresolved S1/S2 readability complaint. | Critical state miss, identity/facing below threshold, or unresolved major complaint. | Human review sheet. |
| RM-01 Motion selection | Automated browser | Emulate `prefers-reduced-motion: reduce` before load; record `matchMedia`, requests, renderer type, media visibility and animation state. | Three.js battle startup is skipped in favor of Canvas/static fallback; stage video remains hidden; major CSS motion/VFX suppressed; no GLB request is made by Canvas bridge. | Three.js/video/major animation still required or started; blank/static fallback unavailable. | Runtime report. |
| RM-02 Text/status sufficiency | Automated plus human | Run one accepted and one rejected action in reduced motion with audio blocked; capture before/after text and accessibility tree. | Narration line appears without typewriter delay; objective/status identifies accepted/rejected outcome; command remains playable; human reviewer can explain next legal action. | Motion/sound-only feedback, missing rejection, or delayed/hidden critical text. | QA screenshots/snapshot/reviewer note. |
| RM-03 Authoritative equivalence | Automated | Replay identical public command sequence in normal, reduced-motion, video-fail, audio-fail, bridge-fail and GLB-fail runs; normalize presentation-only timestamps and diff public action trace/save. | Authoritative action order/count, campaign state, reward/result and save payload are identical; each input creates exactly one intended action. | Any authoritative difference or duplicate/missing action. | Runtime report diff artifact. |
| RM-04 Comfort/clarity | Human | Participant rates reduced-motion clarity and discomfort after one loop. | 0 S1/S2 motion/readability complaint; report raw scores. This row cannot by itself satisfy full G4. | Major discomfort/clarity complaint. | Human scorecards. |

### 6.7 Auxiliary generation and previs lanes

These candidate lanes do not enter the runtime automatically. A structurally valid output remains `candidate` until its report, provenance, design approval, runtime reference, cache tier and fallback are all recorded.
Current execution note: the PerfectPixel pilot is `NOT SCORED — PROVIDER BLOCKED` because the installed `ppgen` does not support the requested `god-tibo-imagen` provider and no generated bundle exists. This is correct failure handling, not a reason to weaken PP-01–03 or synthesize substitute outputs.

| ID | Type | Method and captured values | `PASS` threshold | `FIX` condition | Evidence |
|---|---|---|---|---|---|
| GTI-01 PNG decode | Automated | Fully decode every proposed GTI PNG; record path, bytes, SHA-256, dimensions, color mode and decoder exit. | Every proposed output is a non-empty, fully decodable PNG with finite positive dimensions and a final hash matching its inventory record. | Truncated/undecodable file, extension/MIME mismatch, zero dimension, or hash/byte drift. | GTI image report. |
| GTI-02 Provenance and rights | Record audit | Reconcile each PNG to exact prompt, input/reference hashes, `gti` version/model/backend, operator/date, generation result, ownership/redistribution terms and design intent. | 100% complete truthful records; no auth/token/private local path in public metadata; changed output is never labeled as legacy or attributed to a conversion tool as creative source. | Missing/fabricated prompt/input/tool/rights field, secret exposure, or unidentified source. | [`../design/gti-image-report.md`](../design/gti-image-report.md) and media manifest. |
| GTI-03 Design/readability | Human | Review normal and 360×800 presentation against the design spec. | Intended subject and hierarchy remain identifiable; no copied IP/style imitation, misleading tactical state, text-only-in-pixels requirement, or S1/S2 readability defect. | Identity drift, provenance concern, copied content, or critical state carried only by the image. | GTI report reviewer decision. |
| PP-01 Bundle closure | Automated | Run `ppgen` with `-json`; reconcile machine summary, bundle manifest, sprite sheets, Aseprite JSON, declared state animations and individual frames actually requested by the lane. | Command exits 0; every declared bundle member exists, decodes, is non-empty, has matching dimensions/frame/state/direction metadata and a recorded SHA-256; no undeclared required member. | Partial bundle, summary/manifest mismatch, missing state/frame/direction, decode failure or hash drift. | [`../engineering/perfectpixel-report.md`](../engineering/perfectpixel-report.md). |
| PP-02 Identity consistency | Automated contact sheet plus human blind review | Compare the same character across all generated states, frames and directions; record reference, contact sheet and per-cell decision. | Costume, palette, body proportions, signature equipment and facing identity remain consistent; ≥80% blind identity/facing accuracy and 0 unresolved S1/S2 drift defect. | Character/gear/palette mutation, unintended mirrored symbol, direction ambiguity, or threshold miss. | PerfectPixel report/contact sheet. |
| PP-03 Transparent background | Automated pixel audit plus human edge review | Inspect RGBA/alpha distribution, corner pixels, matte-color residue and fringe against dark and white backgrounds. | Runtime frames have an alpha channel with transparent background outside the subject; all corners are transparent unless the manifest declares intentional contact; no solid magenta/matte field or severe fringe removes/obscures the subject. | Opaque generated background, missing alpha, key-color residue, clipped subject, or halo that fails compact readability. | PerfectPixel report. |
| VOX-01 Beats schema and anti-monotony | Automated JSON audit plus human editorial review | Parse [`../design/vox-resource-film/beats.json`](../design/vox-resource-film/beats.json); measure hook, beats/shots, durations, shot sizes, camera moves, payoff, and repeated motion motifs. | Beat 1 hook ≤3 s; each beat has wide/title plus detail/no-title shots; each shot 3–6 s and none >7 s; adjacent shots do not repeat `camera_move`; at least 3 distinct camera moves across the film; payoff uses `static`; hero-flyer motif is not used in every beat; narration/visual sequence has no unexplained duplicate or dead beat. | Invalid/missing beat fields, long dead shot, consecutive identical move, single repeated template/motif, missing payoff restraint, or human monotony finding. | [`../engineering/vox-report.md`](../engineering/vox-report.md) and beats JSON. |
| VOX-02 Encode and progressive playback | Automated | Probe and decode the final Vox candidate; inspect MP4 atoms. | H.264/yuv420p/960×540/exact `24/1` fps/faststart; full decode succeeds; duration/bytes/hashes match the report and applicable PM video caps. | Wrong codec/pixel format/size/fps, `moov` after `mdat`, decode failure, or budget/hash drift. | Vox report raw ffprobe/validator output. |
| VOX-03 Playback/readability/fallback | Human plus browser if runtime-referenced | Review normal speed and frame-step; verify captions/transcript/still fallback and reduced-motion exclusion before promotion. | No identity/text morph, tactical misrepresentation, unsafe >3 Hz flash, monotony S1/S2 defect, or required information available only through motion/audio; promoted runtime candidate degrades to approved still/text. | Any listed defect, absent human review, or missing fallback. | Vox report and runtime report when promoted. |
| PRE-01 Source and bundle checksum closure | Automated | Recompute source media SHA-256; compare with bundle manifest, every exported member and [`../engineering/previs-bundle/`](../engineering/previs-bundle/) inventory. | Exact source checksum, byte count, trim/timebase and tool/version recorded; all manifest members exist with matching hashes; no path escapes or undeclared source substitution. | Source checksum absent/mismatch, orphan output, changed source after analysis, or manifest drift. | [`../engineering/motion-previs-report.md`](../engineering/motion-previs-report.md). |
| PRE-02 No fake depth or pose | Automated evidence audit plus visual sampling | For each claimed depth/pose layer, require analyzer/model/version/settings, per-frame/keypoint metadata, generation logs and a derived output that is not a renamed/byte-identical copy of the reference. If no real analyzer ran, require the layer to be omitted or explicitly `not-generated`. | Every present depth/pose claim has reproducible analyzer evidence and sampled output consistent with the source; unavailable layers are truthfully absent/not-generated. | Reference video copied/renamed as depth or pose, placeholder/constant layer presented as analysis, fabricated keypoints/depth, or a claim without analyzer evidence. | Motion Previs report, bundle manifest/settings/logs/contact sheet. |
| PRE-03 Downstream-safe candidate | Automated audit | Validate camera/pose/depth metadata shapes only for layers actually produced; inspect import scripts/manifests without executing untrusted generated code. | Finite timestamps/values, source frame/timebase alignment, documented coordinate systems, no absolute/private paths or secrets; outputs remain production evidence unless separately promoted. | NaN/out-of-range data, frame misalignment, unsafe path/secret, fake layer dependency, or automatic runtime promotion. | Motion Previs report. |

## 7. Full G4 human scorecard

Full G4 requires actual human evidence. Use at least 10 completed first-loop participants; a scripted QA operator is not a participant. Immediately after the first loop, each participant scores 1–5:

1. I knew the next legal action.
2. I could distinguish success, cooldown, and rejection.
3. Units, boss, objective, and action effect remained readable at the tested resolution.
4. Text/status remained sufficient without motion or sound.
5. Mesh animation, effects, audio, and video supported rather than obscured tactical decisions.

Participant composite = arithmetic mean of all five answers. G4 score = median of participant composites.

- `PASS`: median ≥4.0/5, effect feedback latency spot checks ≤100 ms, and 0 unresolved S1/S2 readability complaints.
- `FIX`: threshold missed or any S1/S2 remains open after evidence collection.
- `NOT SCORED`: fewer than 10 eligible complete scorecards, missing answers, or no human playtest. Automation cannot promote this status.

## 8. Feedback-latency measurement

For one accepted and one rejected action in normal and reduced-motion modes:

1. Observe the public status/objective/result nodes, not private engine state.
2. Record `performance.now()` immediately before input dispatch.
3. Record the first text/semantic mutation that communicates the result.
4. Store before/after text, selector, dispatch time, mutation time and delta.
5. Discard only if the tab was not visible before dispatch; record the discarded attempt.

`PASS` requires every retained critical spot check ≤100 ms. A visual particle/audio onset alone is not sufficient evidence.

## 9. Severity and focused rerun bundles

| Severity | Definition | Disposition |
|---|---|---|
| S1 | Cannot start/continue a campaign, issue a core command, recover a valid save, or a resource/provenance violation creates legal/IP/release risk. | Stop affected run; all scoped gates remain `FIX`. |
| S2 | Wrong asset/action/state feedback, broken reduced-motion/compact path, optional-media failure blocks play, stale cache serves old content, or authoritative trace/save differs. | Must fix before scoped gate review. |
| S3 | Presentation defect with intact readable alternate path and no state/data risk. | Log, repair if within cycle, rerun affected lane. |
| S4 | Cosmetic issue with no readability, accessibility, provenance, cache or state effect. | Log for triage; does not independently block scoped pass. |

Focused rerun after changes:

- Mesh/rig change: M3D-01–08, B2D-01–05 for dependent outputs, REL-01–02, RM-01/03.
- Raster bridge change: B2D-01–06, REL-01–06, UX-01–03, RM-01–03.
- Audio change: AUD-01–05, REL-01–02/04–06, RM-02–03.
- Video change: VID-01–05, REL-01–02/04–06, RM-01–03.
- Manifest/cache/runtime wiring change: REL-01–06 plus one normal and one reduced-motion authoritative-equivalence run.
- Design/readability change: UX-01–03, RM-01–04 and the human scorecard if a full G4 claim is requested.
- GTI image change: GTI-01–03 and REL-01/07 before any promotion.
- PerfectPixel bundle change: PP-01–03, UX-03, REL-01/07 and the consuming bridge/runtime row if promoted.
- Vox film change: VOX-01–03, VID-01–05, REL-01/07 and RM-01–03 if promoted.
- Motion Previs bundle change: PRE-01–03; rerun the downstream mesh/video/sprite lane only if an authenticated layer is consumed.

## 10. Final reporting rule

Every result entered in [`gate-measurements.md`](gate-measurements.md) must contain:

```text
scope / test ID:
revision / build / UTC:
threshold:
measured value:
method:
exact command or browser session:
raw evidence path:
defect IDs:
verdict: PASS | FIX | NOT SCORED | NOT RUN
```

The director may cite scoped resource-subset results. The following claims remain prohibited without their complete evidence: full G1 narrative consistency, full G4 immersion, full G6 operations/performance, and any Stage 2 balance/fairness gate.
