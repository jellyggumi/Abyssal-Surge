# Resource Refinement — Decision Log

## Decision schema

각 항목은 `status`, `decision`, `evidence/rationale`, `consequence`, `revisit trigger`를 가진다. 이 로그의 결정은 `20260718-resource-refinement` Stage 1 범위에만 적용된다.

## DR-001 — One operating mode

- **status:** accepted, 2026-07-18
- **decision:** 이번 run은 **Stage 1 resource/presentation refinement only**로 고정한다.
- **evidence/rationale:** 요청 대상은 3D 메시·리깅·2D 스프라이트·사운드·비디오와 실제 런타임 적용 가능성이다. 최신 production manifest는 scoped presentation 작업이 full-game gate를 가장하면 안 된다는 원칙을 이미 확립했다.
- **consequence:** 밸런스, 보상, 코어 루프, 수익화, 멀티플레이, 신규 gameplay authority는 작업 행에 넣지 않는다. G2/G3/G5/G7/G8과 Stage 3 full gate를 재판정하지 않는다.
- **revisit trigger:** 자산 적용이 규칙 또는 save/replay semantics 변경을 요구하면 해당 변경을 거부하고 별도 사이클 intake로 분리한다.

## DR-002 — Gameplay authority remains in `campaign-state.js`

- **status:** accepted, non-negotiable
- **decision:** 메시, animation, sprite, audio, video, Three.js/Canvas presentation은 엔진이 승인한 상태를 표현한다. 결과·피해·cooldown·breach·reward·trace를 직접 쓰지 않는다.
- **evidence/rationale:** canonical design과 기존 architecture contract는 `campaign-state.js`를 규칙·세이브·리플레이의 단일 권위로 선언한다.
- **consequence:** 런타임 smoke는 동일한 public action/save/replay 경로에서 resource-on/off가 같은 campaign trace 의미를 보존하는지 확인한다. media failure는 text/UI gameplay path를 막지 않아야 한다.
- **revisit trigger:** presentation code가 state transition을 직접 호출하거나 임의 outcome을 생성하는 diff가 발견되면 S1 defect로 즉시 차단한다.

## DR-003 — Refine the existing low-poly pack; do not redesign it

- **status:** accepted
- **decision:** `assets/models/abyssal-command/`의 기존 15 GLB ID와 flat-shaded faceted silhouette를 유지한다. selective bevel/mesh cleanup과 rig/action correction만 허용하며 subsurf 기반 organic smoothing은 사용하지 않는다.
- **evidence/rationale:** `assets/models/abyssal-command/manifest.json`은 ground-center pivot과 flat-shaded PBR/embedded texture 계약을 선언하고, 직전 cinematic cycle은 bevel-only를 검증하고 subsurf를 art-direction mismatch로 기각했다.
- **consequence:** 3D report는 15/15 pivot, embedded images, finite geometry, bounds, modifier policy, before/after SHA-256을 기록한다.
- **revisit trigger:** canonical presentation spec가 별도 pack/version을 명시적으로 승인할 때만 새로운 visual identity를 검토한다.

## DR-004 — Preserve the declared action vocabulary exactly

- **status:** accepted
- **decision:** unit 5종은 `Idle/Move/Strike/Special/Defeat`, boss 3종은 `Idle/Attack/Defeat`, prop 4종은 `Idle/Activate`, terrain 3종은 action 없음 계약을 보존한다.
- **evidence/rationale:** 현재 model manifest와 GLB raster bridge가 이 이름과 순서를 source contract로 사용한다.
- **consequence:** clip rename, alphabetic reorder, missing/extra clip, non-finite/zero duration은 FIX다. 새 action은 이번 refinement에 끼워 넣지 않는다.
- **revisit trigger:** runtime consumer와 model manifest, raster bridge를 함께 바꾸는 별도 approved animation-expansion cycle.

## DR-005 — Keep GLB out of the Canvas fallback runtime

- **status:** accepted
- **decision:** 2D sprite는 Blender headless로 GLB를 rasterize한 PNG/manifest bridge로 공급한다. 브라우저 Canvas fallback에 GLB parser 또는 loader를 추가하지 않는다.
- **evidence/rationale:** canonical design의 검증된 `scripts/render-8dir-atlas.py` 경로와 현재 `assets/images/battle/glb/manifest.json`이 이미 source manifest, yaw columns, frame samples를 기록한다.
- **consequence:** sprite lane은 최종 GLB hash 이후 raster를 생성하고 source hash, tool version, recipe, dimensions, bytes, output SHA-256을 run-local report에 기록한다. runtime은 PNG bridge만 소비한다.
- **revisit trigger:** Canvas fallback 자체를 폐기하거나 renderer architecture를 재승인하는 별도 결정.

## DR-006 — Media formats and graceful fallback

- **status:** accepted
- **decision:** audio는 MP3, video는 H.264/yuv420p/960×540/24fps/faststart를 목표로 한다. 실제 probe 값이 목표와 다르면 숨기지 않고 FIX 또는 explicit exception으로 기록한다.
- **evidence/rationale:** 현행 디렉터리 및 production contract가 해당 형식을 사용하며 정적 PWA/브라우저 호환성을 우선한다.
- **consequence:** 모든 갱신 파일은 `ffprobe` 또는 동등한 decoder evidence를 가진다. autoplay rejection, reduced motion, decode failure, missing file에서 text/static gameplay path가 유지되어야 한다.
- **revisit trigger:** 지원 브라우저 매트릭스 또는 CDN/transcoding 전략이 별도 release decision으로 바뀔 때.

## DR-007 — Provenance may live in the shared manifest or a run-local engineering ledger

- **status:** accepted
- **decision:** 모든 신규/갱신 미디어는 `assets/media-manifest.json` **또는** 이번 run의 lane report/resource manifest에 source, generator/tool, prompt 또는 procedural recipe, bytes, SHA-256을 기록한다.
- **evidence/rationale:** cycle contract가 둘 중 하나를 허용하며, 현재 여러 asset lane이 같은 shared JSON을 동시에 갱신하면 충돌·entry loss 위험이 있다.
- **consequence:** whole-file concurrent regeneration은 금지한다. prefix ownership이 없는 lane은 run-local report를 source of record로 사용한다. Sprite lane은 `--skip-media-manifest`를 사용하고 `engineering/sprite-bridge-report.md`에 완전한 기록을 남긴다. 후속 integrator는 누락 없이 합칠 수 있지만 이 초기 harness 작업은 shared manifest를 편집하지 않는다.
- **revisit trigger:** 모든 asset lane이 종료되고 한 명의 integrator가 current-file read 후 serialized reconciliation을 수행할 때.

## DR-008 — Separate technical readiness from human immersion

- **status:** accepted
- **decision:** 이번 run은 G4의 기술적 presentation-readiness subset만 측정한다. human immersion median ≥4.0/5 또는 전체 readability complaint 0건을 주장하지 않는다.
- **evidence/rationale:** 자산 validator, probe, representative browser smoke는 load/play/fallback readiness를 증명하지만 인간 몰입 점수를 대신하지 못한다.
- **consequence:** scoped G4는 GLB 15/15 contract, changed sprite/audio/video 100% validation, 대표 3D/2D 경로의 blocker/unhandled error 0건으로 제한한다. full G4는 `NOT SCORED`다.
- **revisit trigger:** 정의된 scene sample과 인간 세션 수를 갖춘 별도 structured playtest가 완료될 때.

## DR-009 — G1/G4/G6 verdicts are scoped subsets only

- **status:** accepted
- **decision:** gate review 표기는 `SCOPED PASS`, `FIX`, `NOT SCORED`만 사용한다. full G1/G4/G6 PASS 또는 release-ready를 쓰지 않는다.
- **evidence/rationale:** full G1은 전체 visible content audit, full G4는 인간 immersion/latency/readability, full G6는 telemetry/rollback/release checklist/performance soak가 필요하다. 이번 Stage 1 resource run은 그 증거를 만들지 않는다.
- **consequence:** subset마다 measured value + method + evidence path가 필수이고 open S1 1건이라도 있으면 PASS 불가다. 누락 증거는 낙관적 추정이 아니라 FIX다.
- **revisit trigger:** full gate 계약의 모든 증거 경로가 별도 cycle에서 실제로 채워질 때.

## DR-010 — Local verification only; no broad quality commands

- **status:** accepted
- **decision:** 각 lane은 자신이 만든 asset validator, probe, manifest/hash audit, focused browser scenario만 실행한다. 포매터, 린터, 프로젝트 전체 테스트는 실행하지 않는다.
- **evidence/rationale:** 이번 assignment와 cycle constraints가 국소 검증만 요구한다. broad suite 결과는 resource-specific acceptance를 대체하지 못하며 병렬 작업 중인 타인의 변경을 섞는다.
- **consequence:** QA evidence에는 exact command/session, observed value, timestamp, artifact path가 들어간다. `node --test tests/*.test.mjs` 같은 전체 suite는 이번 run의 gate 증거로 요구하거나 실행하지 않는다.
- **revisit trigger:** integration owner가 별도 release-cycle에서 전체 회귀를 명시적으로 요청할 때.

## DR-011 — Candidate handoff order prevents stale derivatives

- **status:** accepted
- **decision:** final GLB candidate와 SHA-256이 먼저 고정되고, 그 뒤 sprite raster candidate를 생성한다. Audio/video asset 후보가 고정된 뒤 runtime lifecycle과 PWA packaging을 통합하고, 마지막에 QA static audit와 focused runtime smoke를 수행한다.
- **evidence/rationale:** GLB 변경 후 먼저 만든 sprite는 stale derivative이고, asset hash 확정 전 cache/manifest 갱신은 잘못된 provenance를 만들 수 있다.
- **consequence:** 순서는 `mesh+rig → sprite`, `audio asset → audio runtime`, `video asset → video runtime`, `all candidates → runtime/package → QA → director review`다. 병렬 lane은 서로의 파일을 되돌리지 않는다.
- **revisit trigger:** upstream candidate가 다시 변경되면 해당 derivative/integration/QA evidence만 무효화하고 재실행한다.

## DR-012 — Sprite-prefix and shared media file/hash reconciliation completed

- **status:** accepted after serialized reconciliation, 2026-07-18
- **decision:** `assets/media-manifest.json`의 `assets/images/battle/glb/` prefix는 현재 45개 파일과 동기화되었으므로 sprite bridge의 supporting inventory로 다시 사용할 수 있다. 생성 recipe/action/layout의 단일 권위는 계속 `assets/images/battle/glb/manifest.json`과 `engineering/sprite-bridge-report.md`다.
- **evidence/rationale:** ManifestJanitor 후 fresh local SHA-256 audit에서 hash-bearing records 188/188이 실제 파일로 존재하고 hash mismatch 0건이었다. 그중 bridge records는 45/45 존재, hash mismatch 0건이다. Audio, Video, Mesh, Sprite 담당자 모두 shared manifest pending/in-flight write가 없다고 확인했다.
- **consequence:** stale/non-authoritative bridge 경고와 이전 missing-file 경고를 제거한다. Shared manifest는 현재 file/hash inventory supporting evidence로 사용할 수 있고, sprite generation recipe/action/layout의 단일 권위는 bridge manifest/report에 남는다. 이 file/hash audit만으로 provenance 완전성, runtime 동작, full G1 또는 full G6 PASS를 주장하지 않는다.
- **revisit trigger:** media asset 또는 manifest record가 다시 변경되면 동일한 양방향 existence/SHA-256 audit을 재실행하고, recipe·runtime 증거는 각 lane report와 QA gate measurement에서 별도로 판정한다.
