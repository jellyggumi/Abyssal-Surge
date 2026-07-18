# Resource refinement benchmark notes

**Run:** `20260718-resource-refinement`  
**Mode:** Stage 1 resource/presentation refinement  
**Status:** `DRAFT` — calibration notes, not a gate verdict

## 1. Scope and authority

This cycle evaluates whether the existing Abyssal Surge media pack can be shipped through the current static Web/PWA + Canvas/Three.js runtime without changing campaign outcomes.

- `campaign-state.js` remains the sole authority for rules, save state, and replay/action trace.
- Three.js GLB rendering, Canvas raster-bridge rendering, audio, video, and effects are optional presentation layers. Their success, failure, or reduced-motion replacement must not change the authoritative result.
- Source-model contract: `assets/models/abyssal-command/manifest.json` and the GLBs under the same directory.
- Canvas bridge contract: `assets/images/battle/glb/manifest.json`; the Canvas renderer consumes PNG records only and must not gain a GLB parser.
- Release inventory contract: `assets/media-manifest.json`, `sw.js`, and the static deployment allowlist checked by `tests/release-closure.test.mjs`.
- Design intent for this run: [`../design/presentation-spec.md`](../design/presentation-spec.md).

## 2. Current project baseline

The table records the pre-refinement calibration surface observed in the repository. It does not claim that in-flight replacement assets already satisfy the final thresholds.

| Surface | Current contract used as benchmark | QA consequence |
|---|---|---|
| 3D pack shape | 15 GLBs: 5 units, 3 bosses, 4 props, 3 terrain; Blender Z-up; declared ground-center pivots; 7 texture families; embedded PNG images | Any changed pack must retain declared category/path uniqueness, embedded-image closure, ground-center placement, and readable textures. |
| Animation vocabulary | Units declare `Idle/Move/Strike/Special/Defeat`; bosses declare `Idle/Attack/Defeat`; props declare `Idle/Activate`; manifest names use `<asset-id>__<clip>` | Missing, renamed, duplicated, out-of-order, non-finite, or unintended root-motion clips are `FIX`. |
| Three.js integration | `battle-realtime-three.js` loads one terrain, `shade`, `scout`, and one boss from `./assets/models/abyssal-command/` and parses GLB with the vendored `GLTFLoader` | Final proof must cover successful load and an injected load failure that falls back without mutating campaign state. |
| 2D bridge | `glb-raster-pack-v1`; orthographic 30° elevation; 8 yaw columns; 4 frame samples; 128×128 cells; action atlases are normally 1024×512; terrain plates are 128×128 | Regeneration must be deterministic at the manifest/hash level and remain raster-only in Canvas runtime. |
| Bridge admission/cache | Canvas reads `assets/images/battle/glb/manifest.json`; runtime accepts same-origin in-root PNG output paths; SW pre-caches the manifest and admitted outputs with `no-store` fetches and `cache.put` | Unsafe paths, missing outputs, stale hashes, cross-origin/path-traversal admission, or offline bridge failure are `FIX`. |
| Audio integration | Action cues, narration, ambience, and BGM use relative `assets/audio/*.mp3` URLs; runtime catches media playback/load rejection and retains text/status feedback | Decode failure, manifest/hash drift, command duplication, blocking autoplay error, or sound-only state is `FIX`. |
| Video integration | Stage transitions and the optional campaign cinematic use relative `assets/video/*`; failure hides the broken media and retains still/text/transcript paths | Canonical target is H.264, yuv420p, 960×540, 24 fps, faststart. The final representative now meets the machine/runtime subset; human shot/readability remains separately unscored. |
| Reduced motion | `prefers-reduced-motion: reduce` skips stage video and Three.js battle startup, uses Canvas static frames, disables major CSS motion/VFX, and renders narration text without typewriter delay | Reduced motion must retain commands, readable state, and the same authoritative trace/save outcome as normal motion. |
| Compact viewport | Existing focused precedent uses 360×800; prior mobile contract also exercises 320×640/DPR 2 touch | No horizontal page overflow, clipped critical copy, hidden command, ambiguous atlas silhouette, or control below 48 CSS px. |
| GTI key art candidate | GodTiboImagen may produce PNG design candidates, but the runtime must not depend on the undocumented generation backend | A candidate needs full PNG decode, exact prompt/input/tool/rights provenance, final hash and human design review before promotion. |
| PerfectPixel candidate | `ppgen -json` produces a game-engine bundle rather than one loose sprite | QA requires bundle/manifest closure, cross-state identity consistency and a real transparent background; generation success alone is insufficient. |
| Vox resource film candidate | `beats.json` is the story/motion contract; final MP4 remains an optional presentation derivative | Anti-monotony is measured in the beat map before encode; a promoted derivative also needs H.264/yuv420p/960×540/24 fps/faststart and still/text fallback. |
| Motion Previs candidate | Previs is production evidence, not runtime authority | Source checksum must close through the bundle; depth/pose layers are accepted only with real analyzer evidence and are omitted or marked not-generated otherwise. |

## 3. Comparable-game calibration

These references calibrate presentation questions only. QA may adopt an abstract pattern; copied names, art, audio, writing, animation, or a clone-like mechanic are rejected. The source list is carried from the project’s prior source-backed benchmark survey in `_workspace/20260716-shadow-lord-rts-rpg/qa/benchmark-notes.md`.

| Comparable | Published pattern used for calibration | Resource-refinement question | Source |
|---|---|---|---|
| Warcraft Rumble | Compact deployment economy, map control, leaders/boss progression | At reduced resolution, can the player distinguish allied role, boss identity, and objective without reading animation alone? | [Blizzard](https://warcraftrumble.blizzard.com/en-us/) |
| Clash Royale | Small loadout and immediate real-time feedback | Does every accepted/rejected action produce a readable response within 100 ms, independent of audio and motion? | [Supercell](https://supercell.com/en/games/clashroyale/) |
| Clash of Clans | Persistent army choice separated from short tactical sessions | Do resource effects remain presentation-only while reward/save continuity remains owned by campaign state? | [Supercell](https://supercell.com/en/games/clashofclans/) |
| Bad North | Compact tactical terrain and consequential stage rewards | Do terrain tiers, unit silhouettes, and target lanes remain separable at 360×800 and in the 2D bridge? | [Steam](https://store.steampowered.com/app/688420/Bad_North_Jotunn_Edition/) |
| Kingdom Two Crowns | Build/defend/expand cadence with restrained presentation | Can ambience/cinematics fail or be muted without hiding the next legal action or campaign consequence? | [Steam](https://store.steampowered.com/app/701160/Kingdom_Two_Crowns/) |

Comparable-game observations do not establish G4. Only the structured Abyssal Surge human scorecard in [`test-plan.md`](test-plan.md) can provide the immersion value.

## 4. Technical calibration targets
| Domain | Calibration target | Why it matters in this runtime |
|---|---|---|
| GLB container | glTF 2.0 binary header/chunk integrity; one in-container buffer; embedded images; no external texture URI | Static hosting and offline use must not depend on undeclared sidecar texture requests. |
| Pivot and bounds | Blender authoring ground at local `Z≈0`, declared body/plinth center at root, exact zero root translation, and runtime reimport ground at Three.js `Y≈0`; finite bounds and explicit `runtime(X,Y,Z)=Blender(X,Z,-Y)` mapping. Full-equipment AABB centroid offsets are acceptable only when quantified and traced to intentional asymmetric silhouette equipment. | Axis mapping and reference-center semantics prevent false “off-center” failures while still detecting floating, sinking, or root/export drift. |
| Rig/control deformation | Valid skin/joint/weight/inverse-bind data when skinned, or valid rigid-control parents/channels when intentionally non-skinned; no detached vertices or exploding bounds across sampled clips | The current units use rigid body/equipment controls, so QA validates the declared control architecture rather than requiring nonexistent skin weights. |
| Raster bridge | Manifest/output hash agreement; 8 directions; 4 samples; exact cell geometry; alpha and silhouette inspection at native and downscaled display size | Canvas uses the manifest as its only GLB-derived contract. |
| Audio | MP3 decodes; duration is finite/non-zero; peak does not clip; cue/narration identity matches runtime mapping; speech remains intelligible over ambience/BGM | Media failure is optional, but wrong or duplicated cues corrupt player feedback. |
| Video | H.264/yuv420p/960×540/24 fps/faststart; finite duration; captions/transcript and still fallback; no required action encoded only in video | The cinematic is optional and must remain streamable, broadly decodable, and non-blocking. |
| Manifest/provenance | Every new or changed media file has path, bytes, SHA-256, source, generation method, prompt or procedural recipe, and ownership/license note | A present file without reproducible provenance is not release-ready. |
| Cache/budget | Fresh install fetches current core/bridge assets; upgrade removes old `abyssal-surge-*` caches; offline reload serves admitted versions; hard caps are core 2 MiB, optional install 32 MiB, bridge+manifest 12 MiB, total install 48 MiB, active lazy GLB 112 MiB, worst-case persistent cache 160 MiB | PWA success must not conceal a stale asset, exceed the approved delivery footprint, or create a different rules outcome. |
| Accessibility | Critical state is present as text/semantics; 360×800 and 320×640 are usable; reduced motion is functionally equivalent | Full G4 cannot pass on visual polish alone. |
| GTI/PNG | Full PNG decode; finite dimensions; exact bytes/SHA-256; prompt, reference-input hashes, tool/model/version, operator, rights and design-intent trace | A decodable image without truthful provenance is not promotable. |
| PerfectPixel | `ppgen -json` success; manifest/member/state/frame/direction closure; identity contact sheet; RGBA alpha/background and fringe audit | A bundle can be structurally complete yet unusable if identity drifts or the keyed background remains opaque. |
| Vox beats/encode | Hook ≤3 s; two 3–6 s shots per beat; adjacent camera moves vary; at least 3 move types; payoff static; no repeated flyer formula; final 24 fps/faststart | Beat-level cadence catches monotony before expensive rendering; encoding does not repair repetitive editorial structure. |
| Motion Previs | Exact source checksum/timebase; per-member checksums; analyzer model/settings/logs for claimed derived layers; no renamed reference masquerading as depth/pose | Previs metadata is useful only when its lineage and analysis claims are reproducible. |

## 5. Baseline evidence and known gaps

- Parent-focused baseline: `node --test tests/abyssal-command-assets.test.mjs tests/release-closure.test.mjs` → **26/26 PASS**. This is a pre-final focused baseline, not authorization to skip post-change rerun.
- Post-change focused contracts: `node --test tests/resource-refinement-assets.test.mjs tests/app-command-feedback.test.mjs tests/battle-realtime-three.test.mjs` → **45/45 PASS**, fail/cancelled/skipped/todo 0, 1,135.776 ms. Coverage closes the final focused inventory/bridge/media, event-cue/BGM lifecycle/fallback and Canvas `Defeat`-latch subset; it does not promote untested SW/offline/fault-equivalence or human gates.
- Historical video baseline failed at `frame_rate=30/1`; final `python3 scripts/compress_stage_video.py validate --input assets/video/abyssal-surge-cinematic.mp4` and the independent renderer validator both **PASS** at 24/1 fps, H.264 High, yuv420p, 960×540, 19.02 s, 2,252,481 bytes and faststart. See [`../engineering/video-report.md`](../engineering/video-report.md).
- Blender MCP was unavailable, so the accepted headless route was used. Build/source checks exited 0; the refined 15-asset pack passed 4/4 focused tests and 15/15 hash/action/embedded-PNG/tangent inspection. Pivot evidence passes authoring Z-up and decoded runtime Y-up ground at 0 error to six decimals (raw runtime max `3.2e-8 m`), exact zero roots and explicit axis mapping; AABB offsets are traced to asymmetric equipment. Fresh browser proof loaded the four Stage 1 GLBs and 13 clips, while forced WebGL2 unavailability selected Canvas2D. Direct GLB-file fault trace equivalence and independent compact/blind review remain open; see [`../engineering/mesh-rig-report.md`](../engineering/mesh-rig-report.md) and [`browser-evidence/runtime-resource-e2e.json`](browser-evidence/runtime-resource-e2e.json).
- No structured human immersion scorecard is available for this run. Full G4 therefore remains **NOT SCORED**.
- The serialized bridge publish closes bridge records at 45/45 path, byte and SHA-256 matches. After stale-row cleanup, the full shared inventory also closes at 188/188 existing paths, byte matches and SHA-256 matches with 0 mismatches. Compact/reduced-motion, audio failure/autoplay, SW upgrade/offline and direct runtime failure-equivalence evidence remain pending.
- PM measured the current baseline at 36.97 MiB install attempt, 104.98 MiB active lazy GLB, and 141.95 MiB combined worst case, each below its hard cap. These are capacity baselines only; the exact final candidate must be recalculated.
- PerfectPixel pilot is honestly blocked: the installed `ppgen` excludes `god-tibo-imagen`; exit 1, generated media 0, and no fake bundle. PP identity/transparency remain **NOT SCORED** in [`../engineering/perfectpixel-report.md`](../engineering/perfectpixel-report.md).
- The GTI candidate is a real decoded 1672×941 PNG (`df5d800…65d2`) from an HTTP 200 generation with exact prompt/input/tool provenance. It is not runtime-integrated; compact/readability and legal clearance are not claimed.
- Motion Previs source plus 30 bundle checksum entries passed. The technical bundle contains 29 hashed artifacts, 19 frames, and 456 camera/scene records; unsupported pose/depth/normals/mask layers are declared absent, with fabricated layers 0.
- The local Vox candidate passes its four-beat/eight-shot anti-repetition contract and H.264/yuv420p/960×540/24 fps/faststart validator. Four samples passed specialist title/source-identity review; participant playback, reduced-motion and runtime fallback remain **NOT SCORED** because it was not promoted.
- Three new encounter-audio assets pass 44.1 kHz MP3 role/size/loudness/headroom checks; all shipped audio totals 1.306 MiB. Browser evidence closes accepted wave cue and opt-in BGM battle/lobby lifecycle, while full legacy-file probing, autoplay/load failure and human intelligibility remain **NOT SCORED**.
- The final raster bridge passes 45/45 records: 42 action atlases + 3 terrain, 0 missing actions, all eight direction columns animated, and ≥12px cell padding. Canvas remains JSON/PNG-only. In a fresh forced-WebGL2-unavailable session, 3D hid, Canvas2D appeared, all 45 PNGs were requested, and `hunt×2 → extract → materialize` reached ally `2/10`. Specialist 64/82/52px samples passed, but independent blind/reduced-motion/missing-PNG failure checks remain unscored.

## 6. Specialist evidence links

The following are the canonical evidence paths for this cycle. Missing files or commands/results keep the associated row unscored.

- 3D mesh/rig: [`../engineering/mesh-rig-report.md`](../engineering/mesh-rig-report.md)
- 2D raster bridge: [`../engineering/sprite-bridge-report.md`](../engineering/sprite-bridge-report.md)
- Audio: [`../engineering/audio-report.md`](../engineering/audio-report.md)
- Video: [`../engineering/video-report.md`](../engineering/video-report.md)
- Runtime/cache/manifest integration: [`../engineering/runtime-integration-report.md`](../engineering/runtime-integration-report.md)
- Fresh browser presentation paths: [`browser-evidence/runtime-resource-e2e.json`](browser-evidence/runtime-resource-e2e.json), [`browser-evidence/stage1-3d.webp`](browser-evidence/stage1-3d.webp), [`browser-evidence/stage1-canvas-fallback.webp`](browser-evidence/stage1-canvas-fallback.webp)
- Design intent: [`../design/presentation-spec.md`](../design/presentation-spec.md)
- Release budgets and rollback triggers: [`../pm/resource-budget-and-release-map.md`](../pm/resource-budget-and-release-map.md)
- GodTiboImagen image candidate: [`../design/gti-image-report.md`](../design/gti-image-report.md)
- PerfectPixel candidate: [`../engineering/perfectpixel-report.md`](../engineering/perfectpixel-report.md)
- Vox candidate report and beats: [`../engineering/vox-report.md`](../engineering/vox-report.md), [`../design/vox-resource-film/beats.json`](../design/vox-resource-film/beats.json)
- Motion Previs report and bundle: [`../engineering/motion-previs-report.md`](../engineering/motion-previs-report.md), [`../engineering/previs-bundle/`](../engineering/previs-bundle/)
- QA execution contract: [`test-plan.md`](test-plan.md)
- QA measurement ledger: [`gate-measurements.md`](gate-measurements.md)
