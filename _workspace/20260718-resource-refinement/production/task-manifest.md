# Resource Refinement — Production Task Manifest

## Cycle contract

- **Run ID:** `20260718-resource-refinement`
- **Operating mode:** Stage 1 — resource/presentation refinement only.
- **Repository root:** `/Users/jangyoung/orca/Abyssal-Surge`
- **Run root:** `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement`
- **Next public beat:** 규칙·세이브·리플레이 결과를 바꾸지 않는 resource-candidate drop이 3D/2D fallback에서 로드되고, audio/video lifecycle과 PWA packaging이 focused evidence로 재현된다.
- **Gate language:** 아래 G1/G4/G6는 모두 이번 변경 리소스에 대한 **scoped subset**이다. full gate PASS가 아니다.

## Work items

| ID | owner | stage.phase | artifact | gate | status | beat | verification contract |
|---|---|---|---|---|---|---|---|
| D0 | game-production-director | Stage 1 / intake | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/intake/production-brief.md` | scoped G1/G4/G6 definition | complete | 작업 경계 고정 | 단일 operating mode, in/out scope, measurable subset와 NOT SCORED 범위를 문서 대조 |
| D1 | game-production-director | Stage 1 / coordination | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/production/{task-manifest,decision-log}.md` | evidence governance | complete | owner/path/gate 계약 | 모든 작업 행이 owner, absolute artifact path, gate, status, beat, verification을 가짐 |
| DS1 | game-designer | Stage 1 / presentation direction | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/design/presentation-spec.md` | scoped G1, scoped G4 | assigned | 매체별 identity/readability 기준 | canonical worldview/action vocabulary와 각 매체 cue를 연결하고 mechanics 변경 0건을 명시; QA가 trace table 100% 대조 |
| PM1 | game-PM | Stage 1 / resource budget | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/pm/resource-budget-and-release-map.md` | scoped G6 input | assigned | 비용·용량·배포 경계 | 각 lane의 size/format/release risk와 public-beat 포함 여부를 수치 또는 explicit unknown으로 기록 |
| KI1 | visual development artist (god-tibo-imagen) | Stage 1 / key-art candidate | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/design/gti-image-report.md` | scoped G1, scoped G4 | assigned — candidate only; runtime not integrated | resource identity key-art candidate | `gti --dry-run` 성공 후 canonical references를 입력으로 사용한 prompt/tool/model/output dimensions/bytes/SHA-256 기록; stage/character identity mismatch 0건; shared runtime·manifest·`sw.js` 참조 0건을 QA가 확인 |
| PP1 | 2D technical artist (PerfectPixel) | Stage 1 / trial sprite candidate | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/engineering/perfectpixel-report.md` | scoped G1, scoped G4 | assigned — candidate only; runtime not integrated | one-state identity/animation trial | `ppgen -provider god-tibo-imagen -states idle -json` 시범 결과를 기록하고 8-direction/frame count/alpha/identity-drift/manifest/SHA-256을 검사; 승인 전 full state 확장·기존 GLB raster bridge 교체·runtime 참조 0건 |
| VX1 | technical video editor (Vox Director) | Stage 1 / resource explainer candidate | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/engineering/vox-report.md` + `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/design/vox-resource-film/beats.json` | scoped G1, scoped G4 | assigned — candidate only; runtime not integrated | resource-pipeline explainer candidate | one-topic beat map 승인, 3–6s shot cadence/2 shots per beat, source/tool/prompt/voice/music/caption provenance와 SHA-256 기록; candidate MP4를 `ffprobe`로 H.264/yuv420p/960×540/24fps/faststart 검사; gameplay/runtime claim 0건 |
| MP1 | motion previs specialist | Stage 1 / motion-analysis candidate | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/engineering/motion-previs-report.md` + `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/engineering/previs-bundle/` | scoped G1, scoped G4 | assigned — candidate only; runtime not integrated | reusable pose/depth/camera analysis bundle | reference/depth/openpose/camera-motion/control-layer outputs와 `bundle_manifest.json` inventory/checksums/settings를 생성·검사; nonempty frame/keypoint count, camera solve status, media probe 결과 기록; Blender/ComfyUI/Seedance용 분석 입력일 뿐 shared runtime 참조 0건 |
| M1 | 3D technical artist | Stage 1 / mesh refinement | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/engineering/mesh-rig-report.md#mesh` + `/Users/jangyoung/orca/Abyssal-Surge/assets/models/abyssal-command/` | scoped G1, scoped G4 | assigned | faceted silhouette resource candidate | Blender headless local validation: 대상 15/15, ground-center pivot, embedded image, finite vertices/normals, nonzero bounds, no unintended subsurf; exact invocation와 before/after SHA-256 기록 |
| M2 | 3D technical artist | Stage 1 / rig and actions | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/engineering/mesh-rig-report.md#rig-and-actions` | scoped G4 | assigned | runtime-safe action vocabulary | unit 5종은 5 clips, boss 3종은 3 clips, prop 4종은 2 clips, terrain 3종은 0 clips; manifest-declared names/order/duration과 GLB inspection 결과 15/15 일치 |
| S1 | 2D technical artist | Stage 1 / GLB raster bridge | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/engineering/sprite-bridge-report.md` + `/Users/jangyoung/orca/Abyssal-Surge/assets/images/battle/glb/` | scoped G1, scoped G4 | assigned | Canvas fallback resource candidate | `--skip-media-manifest` collision-free path 사용; source GLB SHA-256, Blender/tool version, yaw/frame recipe, output dimensions/bytes/SHA-256, action mapping 100% 기록; PNG/bridge manifest만 runtime 소비하고 GLB parser 추가 0건 |
| A1 | audio engineer | Stage 1 / audio assets | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/engineering/audio-report.md` + `/Users/jangyoung/orca/Abyssal-Surge/assets/audio/` | scoped G1, scoped G4 | assigned | combat audio candidate | 갱신 MP3 100%에 source/tool/prompt-or-recipe/bytes/SHA-256; `ffprobe` 또는 decoder로 codec/duration/channels 확인; clipping/silence 기준과 측정값 기록 |
| A2 | audio engineer | Stage 1 / audio runtime lifecycle | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/engineering/audio-report.md#runtime` | scoped G4, scoped G6 | assigned | cue 재생과 정리 | 대표 action cue가 승인된 action당 1회 발화, scene exit/retry에서 중지·해제, unavailable/decode failure에서 campaign 진행 유지; focused browser instrumentation과 console error 0건 기록 |
| V1 | technical video editor | Stage 1 / video refinement | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/engineering/video-report.md` + `/Users/jangyoung/orca/Abyssal-Surge/assets/video/` | scoped G1, scoped G4 | assigned | cinematic candidate | 갱신 MP4 100%에 provenance/recipe/bytes/SHA-256; `ffprobe`로 H.264, yuv420p, 960×540, 24fps 확인; faststart 여부와 captions/VTT 연계를 실제 측정으로 기록 |
| V2 | technical video editor | Stage 1 / video runtime lifecycle | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/engineering/video-report.md#runtime` | scoped G4, scoped G6 | assigned | 안전한 cinematic 진입/이탈 | play/pause/end/scene-exit/retry, autoplay rejection, reduced-motion, missing-media의 텍스트/정적 fallback을 focused browser session으로 확인; campaign action/trace 변경 0건 |
| R1 | game-programmer (integration) | Stage 1 / runtime application | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/engineering/runtime-integration-report.md` | scoped G1, scoped G4, scoped G6 | assigned | 3D/2D/audio/video 통합 drop | 기존 loader와 manifest 계약 재사용, 신규 browser GLB parser 0건, resource failure가 command path를 막지 않음, 3D와 Canvas fallback 대표 전투에서 media request 실패·unhandled error 0건 |
| R2 | game-programmer (integration) | Stage 1 / provenance and PWA packaging | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/engineering/runtime-integration-report.md#packaging` + `/Users/jangyoung/orca/Abyssal-Surge/assets/media-manifest.json` + `/Users/jangyoung/orca/Abyssal-Surge/sw.js` | scoped G1, scoped G6 | assigned | offline resource candidate | 변경 미디어 100%가 media manifest 또는 lane report에 provenance/recipe/bytes/SHA-256 보유; 런타임 및 cache 참조의 missing file 0건; 공유 JSON whole-file concurrent regeneration 금지 |
| Q1 | game-QA | Stage 1 / baseline and test plan | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/qa/{benchmark-notes,test-plan}.md` | scoped G1/G4/G6 method | assigned | 재현 가능한 국소 검증 | 대상 inventory, 대표 3D/2D/reduced-motion/offline paths, S1 기준, exact evidence fields를 테스트 전 고정; 프로젝트 전체 suite는 계획·실행하지 않음 |
| Q2 | game-QA | Stage 1 / static resource audit | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/qa/gate-measurements.md#static-resource-audit` | scoped G1, scoped G4 | assigned | 자산 계약 증거 | 15 GLB + 변경 sprite/audio/video의 report/manifest/actual file을 대조하고 measured numerator/denominator, command, timestamp, failures를 기록 |
| Q3 | game-QA | Stage 1 / focused runtime smoke | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/qa/gate-measurements.md#focused-runtime-smoke` | scoped G4, scoped G6 | assigned | 대표 플레이 경로 증거 | public API로 만든 유효 save/replay 경로 사용; 3D 및 Canvas fallback, audio/video lifecycle, online/offline reload를 국소 확인; request failure/pageerror/trace-semantic delta/open S1 수치 기록 |
| G1 | game-production-director | Stage 1 / subset review | `/Users/jangyoung/orca/Abyssal-Surge/_workspace/20260718-resource-refinement/production/gate-reviews/stage-1-resource-subset.md` | scoped G1/G4/G6 | blocked on Q2/Q3 | Stage 1 exit decision | 각 subset에 measured value + method + evidence path가 있고 open S1=0일 때만 SCOPED PASS; 그 외 FIX, full gate는 NOT SCORED |

## Dependency and handoff order

1. `DS1`이 identity/cue/readability 기준을 고정한다. `M1/M2`, `S1`, `A1`, `V1`은 병렬 가능하다.
2. `S1`은 `M1/M2`의 최종 GLB hash를 입력으로 사용한다. GLB가 바뀐 뒤 생성한 raster만 candidate다.
3. `A2`는 `A1`, `V2`는 `V1` 이후 수행한다. `R1/R2`는 각 lane의 candidate와 provenance record를 소비한다.
4. `KI1/PP1/VX1/MP1`은 QA와 `R1`의 명시적 채택 전까지 **candidate only**다. run-local artifact에 provenance/검증을 남기되 shared runtime, `assets/media-manifest.json`, `sw.js`에 자동 등록하지 않는다.
5. `Q2`는 lane reports가 닫힌 뒤, `Q3`는 runtime integration drop 이후 수행한다.
6. `G1` review는 `Q2/Q3`와 defect status를 소비한다. 증거가 없는 항목은 추정 PASS가 아니라 FIX다.

## Immutable constraints

1. `campaign-state.js`가 규칙·save·replay의 단일 권위다. presentation code는 outcome을 직접 변경하지 않는다.
2. GLB는 ground-center pivot, embedded images, 선언 action clip을 보존한다. flat-shaded low-poly 정체성을 organic smoothing으로 바꾸지 않는다.
3. Sprite는 GLB raster bridge다. 런타임 GLB parser를 추가하지 않는다.
4. Audio는 MP3, video는 H.264/yuv420p/960×540/24fps/faststart를 목표로 하되 실제 probe 결과를 기록하며 불일치는 숨기지 않는다.
5. changed media provenance는 `assets/media-manifest.json` 또는 run-local engineering report에 반드시 존재한다. 공유 manifest 충돌을 피하기 위해 prefix 소유 또는 전용 report를 사용한다.
6. 포매터·린터·프로젝트 전체 테스트를 실행하지 않는다. 자산 validator, probe, manifest audit, focused browser smoke만 허용한다.
7. 이 manifest의 `assigned`는 완료나 품질 증거가 아니다. `SCOPED PASS`는 QA 측정 후 director가 별도 gate-review에만 기록한다.

## Subset gate thresholds

| Subset | PASS threshold this run | Required evidence | Explicitly NOT SCORED |
|---|---|---|---|
| scoped G1 | changed player-visible media provenance/hash coverage 100%; presentation/canonical trace 100%; identity mismatch 0 | `qa/gate-measurements.md#scoped-g1-resource-traceability` + lane reports | 전체 strings/lore/기존 media audit |
| scoped G4 | target GLB contract 15/15; changed sprite/audio/video validation 100%; representative 3D+2D runtime missing-resource blocker/unhandled error 0 | `qa/gate-measurements.md#scoped-g4-resource-readiness` + lane reports | human immersion median, 전 씬 latency/readability full gate |
| scoped G6 | changed media hash/byte coverage 100%; runtime/cache missing file 0; focused online/offline request failure 0; trace-semantic delta 0; open S1 0 | `qa/gate-measurements.md#scoped-g6-resource-integration` + runtime report | telemetry/rollback/release checklist, 30-min soak, global p95/long-frame/input budget |
