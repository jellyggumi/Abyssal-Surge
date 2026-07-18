# Abyssal Surge Resource Refinement — Production Brief

## BMAD-GDS intake

- **run_id:** `20260718-resource-refinement`
- **game_type:** 정적 Web/PWA로 배포되는 브라우저 로컬 싱글플레이어 RTS-RPG 캠페인. 규칙·세이브·리플레이의 단일 권위는 `campaign-state.js`다.
- **team_shape:** Game Studio Harness — director, game-designer, game-PM, 3D technical artist/rigging, 2D technical artist, audio engineer, video editor, game-programmer/integration, game-QA.
- **engine:** Native ESM JavaScript + Three.js/WebGL 실시간 전투 렌더러 + Canvas 2D/GLB raster fallback + PWA service worker. Blender MCP는 비활성이고 `/Applications/Blender.app/Contents/MacOS/Blender` headless 실행만 허용된 도구 경로다.
- **current_stage:** **Stage 1 — resource/presentation refinement only.** 새 콘셉트, 밸런스 재조정, Stage 2 익스플로잇 헌트, Stage 3 운영 안정화와 섞지 않는다.
- **next_public_beat:** 기존 Abyssal Surge 미디어가 동일한 전투 규칙과 세이브/리플레이 결과를 유지한 채, 정제된 메시·액션·2D raster bridge·사운드·시네마틱으로 로컬 런타임에서 로드되고 대표 전투 진입/이탈 경로가 증거와 함께 재현되는 resource-candidate drop.
- **source_packet:** `docs/shadow-lord-rts-rpg-hybrid-design.md`의 프로덕션 경계·리소스 계획·동사 사전, `_workspace/20260716-abyssal-surge-revision/`의 intake/architecture/decision 기록, `_workspace/20260717-combat-resource-parity/`의 리소스 parity 증거, `_workspace/20260718-combat-scene-cinematics/`의 bevel/VFX/audio 검증, `_workspace/20260718-medieval-battle-presentation/production/task-manifest.md`의 scoped-gate 원칙, 현행 `assets/models/abyssal-command/manifest.json`, `assets/images/battle/glb/manifest.json`, `assets/media-manifest.json`, `sw.js`.
- **main_constraint:** 리소스 연출은 `campaign-state.js`가 판정한 결과를 표현할 뿐 결과·쿨다운·보상·breach·save trace를 직접 만들거나 변경하지 않는다. 기존 모델/이미지/오디오/비디오/캐시 계약을 재사용하며 새로운 브라우저 GLB 파서를 추가하지 않는다.
- **main_question:** 기존 자산의 정체성과 결정론 계약을 훼손하지 않고, 각 매체의 기술 계약과 런타임 적용을 어떤 최소 검증 묶음으로 증명할 것인가?

## Operating-mode boundary

이번 사이클은 Stage 1의 **resource/presentation refinement** 한 모드만 실행한다.

### In scope

1. 기존 `abyssal-command-low-poly` GLB의 실루엣/메시 품질과 ground-center pivot 보존.
2. 모바일 유닛, 보스, 프롭의 선언된 action clip 보존과 리깅/클립 유효성 확인.
3. 기존 GLB를 Blender에서 rasterize한 2D action sheet 갱신. 런타임은 PNG와 `assets/images/battle/glb/manifest.json`만 소비한다.
4. 기존 cue vocabulary에 맞춘 MP3 정제와 전투/씬 진입·이탈 수명주기 적용.
5. 시네마틱의 H.264/yuv420p/960×540/24fps/faststart 규격 정제와 캡션/폴백 보존.
6. 미디어 provenance, 생성 방식, 프롬프트 또는 procedural recipe, byte count, SHA-256 기록.
7. 대표 로컬 런타임 경로에서 load/play/stop/fallback/cache 동작과 presentation-only 불변식의 focused QA 증거 수집.

### Out of scope

- `campaign-state.js` 규칙, `BALANCE`, 보상, stage transition, save envelope, replay semantics 변경.
- 신규 코어 루프, 신규 승패 판정, 신규 피해·브리치 판정, 수익화/멀티플레이/백엔드 작업.
- Stage 2의 G2/G3/G5/G7/G8 재판정과 Stage 3의 full G4/G6/G1 판정.
- 새 브라우저 GLB loader/parser, renderer 교체, 전면 UI 재설계.
- 포매터·린터·프로젝트 전체 테스트 실행. 각 담당자는 자신이 만든 자산과 직접 통합 지점만 국소 검증한다.

## Confirmed baseline and reusable contracts

1. `campaign-state.js`가 규칙·세이브·리플레이의 단일 권위다. 표현 레이어는 엔진이 승인한 이벤트를 시각·청각으로 재생할 수 있지만 결과를 직접 쓰지 않는다.
2. 모델 팩은 `assets/models/abyssal-command/` 아래 15개 GLB, ground-center pivot, 내장 이미지/텍스처, flat-shaded PBR 방향을 선언한다.
3. 모바일 유닛 5종은 `Idle/Move/Strike/Special/Defeat`, 보스 3종은 `Idle/Attack/Defeat`, 프롭 4종은 `Idle/Activate`, 지형 3종은 action 없음이 현재 manifest 계약이다.
4. 2D fallback은 `scripts/render-8dir-atlas.py`가 만든 `assets/images/battle/glb/*.png` 및 manifest를 소비한다. 이 bridge를 유지하고 런타임에서 GLB를 해석하지 않는다.
5. 현행 오디오는 `assets/audio/*.mp3`, 비디오는 `assets/video/*`, 통합 inventory는 `assets/media-manifest.json`, 오프라인 제공 목록은 `sw.js`가 담당한다.
6. 이전 사이클에서 bevel-only가 팩의 faceted silhouette와 맞고 subsurf는 맞지 않는다고 판정되었다. 이번 패스도 bevel/rig refinement이지 organic smoothing 전환이 아니다.
7. 최신 production manifest의 원칙을 계승한다. 이번 scoped PASS는 full-game G1/G4/G6 PASS가 아니다.

## Resource lanes and deliverable contract

| Lane | Deliverable | Non-negotiable contract | Primary evidence |
|---|---|---|---|
| 3D mesh | 기존 15 GLB의 제한된 silhouette/edge refinement | ground-center pivot, embedded images, flat-shaded identity, finite geometry, 기존 파일 ID 보존 | `engineering/mesh-rig-report.md#mesh` |
| Rig/action | 5 unit + 3 boss + 4 prop action contract 검증 | manifest의 action clip 집합·순서·duration 유효성 보존; 지형은 action 0 | `engineering/mesh-rig-report.md#rig-and-actions` |
| 2D sprite bridge | GLB-derived PNG action sheets와 bridge manifest | source GLB/action/yaw/frame recipe와 입력·출력 SHA-256 기록; 런타임 GLB parser 추가 금지 | `engineering/sprite-bridge-report.md` |
| Audio | MP3 cues 및 lifecycle 통합 | cue 의미 유지, decode 성공, 중복 재생/씬 이탈 후 잔류 없음, unavailable cue 무해 | `engineering/audio-report.md` |
| Video | 대표 cinematic 및 captions/lifecycle 통합 | H.264, yuv420p, 960×540, 24fps, faststart 목표; autoplay 실패·reduced motion·미디어 부재 시 텍스트/정적 경로 유지 | `engineering/video-report.md` |
| Runtime | 기존 loaders, `app.js`, renderer, manifest, `sw.js`에 최소 적용 | 규칙/trace 불변, 2D fallback 유지, 로드 실패가 campaign 진행을 막지 않음 | `engineering/runtime-integration-report.md` |
| QA | 정적 contract audit + focused browser smoke | exact command/session, observed value, timestamp, artifact path; open S1 0건 | `qa/gate-measurements.md` |

모든 신규/갱신 미디어는 `assets/media-manifest.json` **또는** 이 run의 engineering report/resource manifest 중 한 곳에 `source`, `generator/tool`, `prompt` 또는 `procedural recipe`, `bytes`, `sha256`를 반드시 가진다. 공유 JSON을 동시 재생성하지 않는다. 전용 engineering report가 이 계약을 충족하면 후속 통합 전까지 유효한 provenance 원장이다.

## Measurable Stage 1 subset gates

### Scoped G1 — changed-resource identity and traceability

- 분모: 이번 run에서 생성 또는 byte 변경된 player-visible media 전부.
- **PASS subset:** 100%가 provenance/recipe/SHA-256 기록을 가지며, 100%가 `design/presentation-spec.md` 또는 기존 canonical resource/action 항목에 연결되고, 변경 리소스의 stage/character/action identity mismatch가 0건이다.
- **Method:** changed-media inventory 대 manifest/report 및 presentation spec의 양방향 대조; QA가 누락/중복/오식별 목록을 남긴다.
- **Evidence:** `qa/gate-measurements.md#scoped-g1-resource-traceability`와 각 engineering report.
- **Not scored:** 전체 player-visible string, 전 캠페인 lore, 모든 기존 미디어. 따라서 full G1 PASS를 선언하지 않는다.

### Scoped G4 — presentation readiness, not immersion

- **PASS subset:** 대상 GLB 15/15가 pivot/embed/geometry 검사를 통과하고 선언 action 계약이 정확히 일치한다. 갱신된 sprite record 100%가 선언 source/action/layout/hash와 일치한다. 갱신 MP3 100%가 probe/decode되고 대표 cue가 runtime에서 1회 발화·이탈 후 정지한다. 갱신 MP4 100%가 probe되며 목표 codec/pixel-format/resolution/fps/faststart와 캡션/폴백 계약을 보고한다. 대표 3D 및 2D fallback 전투에서 missing-resource blocker와 unhandled media error가 0건이다.
- **Method:** Blender headless/asset validator, image/manifest audit, `ffprobe`, focused browser instrumentation.
- **Evidence:** `qa/gate-measurements.md#scoped-g4-resource-readiness`와 engineering reports.
- **Not scored:** 인간 플레이어 median immersion ≥4.0/5, 전 씬 effect latency ≤100ms, 전체 readability complaint 0건. 따라서 full G4 PASS를 선언하지 않는다.

### Scoped G6 — packaging and focused runtime integration

- **PASS subset:** changed-media SHA-256/byte coverage 100%, 런타임 참조와 PWA cache 참조가 실제 파일과 일치, 대표 온라인/오프라인 reload에서 required changed resource request 실패 0건, campaign trace/save envelope의 before/after 의미 차이 0건, focused smoke 중 console/page error 0건, open S1 defect 0건.
- **Method:** file/manifest/cache audit, local static-server browser session, 기존 public save/replay API를 이용한 before/after trace 비교. 수동 JSON state 조작은 증거로 쓰지 않는다.
- **Evidence:** `qa/gate-measurements.md#scoped-g6-resource-integration`, `engineering/runtime-integration-report.md`, `qa/defect-register.md`가 생기면 해당 행.
- **Not scored:** 전체 telemetry 구현, rollback rehearsal, release-readiness 100%, 30분 memory soak, p95 frame ≤16.7ms, long-frame <0.5%, 전체 input latency ≤100ms. 따라서 full G6 PASS를 선언하지 않는다.

## Stage exit rule

Director는 위 세 subset 각각에 measured value, method, evidence path가 있고 open S1이 0일 때만 `SCOPED PASS`를 기록한다. 누락 또는 실패는 `FIX`이며 최대 2회 수정한다. 세 번째 실패는 full gate로 승격하지 않고 scope/arbitration 결정을 `production/decision-log.md`에 남긴다. 이 run은 full G1/G4/G6 또는 release-ready를 주장하지 않는다.
