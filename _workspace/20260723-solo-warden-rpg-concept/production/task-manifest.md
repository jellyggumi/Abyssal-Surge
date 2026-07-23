# Task Manifest — Solo Warden RPG Concept Cycle

run-id: `20260723-solo-warden-rpg-concept` · scope: Stage 1 implementation (code, not concept-only)

| task | owner | stage.phase | artifact | gate | status | beat |
|---|---|---|---|---|---|---|
| rpg-catalog.js 신규 작성 | director (impl) | Stage1.data | `rpg-catalog.js` | G7 draft input | done | 데이터 층 |
| campaign-state.js RPG 확장 | director (impl) | Stage1.data | `campaign-state.js` | G7 draft input | done | 데이터 층 (migrateCampaign 데이터손실 버그 자체 발견/수정) |
| defense-run-simulation.js 포메이션/랠리/DOWNED | director (impl) | Stage1.sim | `defense-run-simulation.js` | G1/G7 draft | done | 시뮬레이션 층 — `resolveFormation`/`livingFrontCompanions`/BOSS_RALLY_WINDOW/COMPANION_DOWNED 전량 구현 확인(`defense-run-simulation.js:174-350,1160-1600`) |
| SNAPSHOT_VERSION 6 | director (impl) | Stage1.sim | `defense-run-simulation.js` | G7 draft | done | 결정론 계약 — `SNAPSHOT_VERSION = 6`(line 39), 레거시 파라미터 생략 시 byte-identical 재현 테스트 통과 |
| 최소 UI 패널 | director (impl) | Stage1.ui | `app.js`/`index.html`/`styles.css` | G6-ops draft | done | 스탯/장비/저지선 조작 가능 — `allocateWardenStatPoint`/`purchaseEquipmentTier`/`setCompanionFormationSlot` 전량 UI 핸들러 결선 확인(`app.js` growth-panel) |
| 신규 로직 테스트 | Tester 위임 | Stage1.ui | `tests/*.test.mjs` | G1/G7 | done | 회귀 안전망 — `rpg-catalog.test.mjs`/`campaign-state-rpg.test.mjs`/`defense-run-simulation-rpg.test.mjs` 57/57, 전체 스위트 164/165(유일 실패는 20260722 워크스페이스의 미커밋 fixture ENOENT, 이번 사이클 범위 밖) |
| 기존 스위트 회귀 | director (impl) | Stage1.ui | `node --test` 출력 | 전체 | done | 회귀 없음 확인 — `node --test 'tests/**/*.test.mjs'` 164 pass / 1 pre-existing fail(무관 fixture) |
| Stage1 gate review | director | Stage1.ui | `production/gate-reviews/stage1-review.md` | G7/G1/G6-ops | done | Stage1 종료 |
| QA 아키타입 실측 | director (impl as QA) | Stage2 | `qa/gate-measurements.md` | G2/G3/G5 | done | 밸런스 검증 — 7 archetype × 3 seed × 10 stage 실측 시뮬레이션 완료 |
| R1/R3/R5 거버넌스 실측 | director (impl) | Stage2 | `qa/gate-measurements.md` | G2/G3/G5 | done | 지배빌드 방지 검증 |
| Stage2 gate review | director | Stage2 | `production/gate-reviews/stage2-review.md` | G2/G3/G5/G7final/G8 | done | Stage2 종료 |
| 성능/접근성 회귀 | director (impl) | Stage3 | soak/perf 로그, `ops/*.md` | G4/G6 | done-with-note | 배포 준비 — G4(터치타깃/그레이스케일/reduced-motion) MET, 몰입감·레이턴시 인간 플레이테스트 항목만 FIX(자동화 불가, 다음 사이클); G6 ops-runbook 3종 신규 작성 완료(`ops/telemetry-contract.md`/`rollback-runbook.md`/`release-readiness.md`) — 작성 과정에서 실제 코드 교차버전 검증으로 **미문서화 회귀 위험 발견**: 이번 사이클(233a9d0) 이후 저장된 세이브를 그 이전 빌드로 롤백 시 `hasOnlyKeys` 엄격 검증이 신규 3키(wardenProgress 등)를 거부 → 플레이어 다음 액션 시 세이브 소실(전진 마이그레이션은 안전, 역방향만 위험) — `ops/rollback-runbook.md` 완화책 포함 문서화. G6 잔여 항목은 실제 프로덕션 롤백 라이브 테스트 1건뿐(고의적 인간 승인 대기, 이번 세션에서 임의 실행하지 않음) — `production/gate-reviews/stage3-review.md` |
| 커밋+푸시+Pages 확인 | director (impl) | Stage3 | git log, Pages 응답 | — | done | 배포 — `e7d5e8d`(stale-base allowlist 회귀 정정+world-art 기능 병합)+`b1be9d5`(정리) 푸시 완료, CI 전체 그린(`engine_contract`/`browser_contract`/`release_closure`/`package_pages`/`artifact_smoke`/`deploy_pages`/`deployed_smoke`/`release_receipt`), 라이브 사이트 200 확인(https://jellyggumi.github.io/Abyssal-Command/) |
| Stage3 gate review + retrospective | director | Stage3 | `retrospectives/cycle-1-retrospective.md` | G4/G6/G1 final | done | 사이클 종료 — G1 final PASS, G4/G6 done-with-note(위 참조) |

## Note on scope reconciliation vs original Stage1 GDD document-only intent

`intake/production-brief.md` originally scoped this run as **"document-only, no shipped code"** (Stage 1 Concept). The user's most recent live-session instruction explicitly requested continuing into implementation ("다음 단계 진행" — 3-stage implementation-to-deployment plan). This manifest supersedes the document-only constraint for code stages; the GDD documents remain the frozen source of truth for numbers (all still labeled [TARGET], unvalidated until Stage 2 QA simulation per the documents' own gate self-audit in UNIFIED-GDD.md §13).

## Deferred out of this cycle (explicit, not silently dropped)

- 5-tab UI shell (§6.1) — minimal single-panel UI only this cycle, tab shell is a follow-up
- Blender cel-shade bake pipeline (§5.1) — existing realistic atlas stays in place, kill-switch preserved
- World-space camera window + deadzone follow (§5.2) — visual-only, no simulation dependency, independent follow-up
- Formation stance system (Vanguard/Turret/Split positioning, §2.2) — FRONT/BACK slot mechanics (targeting/DOWNED/synergy/rally) ARE implemented this cycle; the 3-stance *positioning offset* layer is deferred (pure visual/positioning, no mechanic dependency)
- Loadout size 3→N expansion (§2.4) — explicitly out of scope per director decision in the source doc itself
- Track A respec (§12 item 5) — undecided in source doc, not implemented

## External motion-previs workstream — D8 remediation + resource generation (this session)

별도 codex-cli 워크스트림(`conflicts.md` C1, `decision-log.md` D8)이 남긴 캐논 위반 소지 자산에 대한 커밋 전 필수 조치를 이번 세션에서 완료:

| task | artifact | status | note |
|---|---|---|---|
| bossId 레벨 개명 (D8 원 지시 범위) | `assets/images/battle/pilot/concept-{sung-hum,broken-court-monarch}-boss.*`, `production/{sung-hum,broken-court-monarch}.previs.json` | done | `concept-sungjinwoo-boss.*`→`concept-sung-hum-boss.*`, `concept-monarch-boss.*`→`concept-broken-court-monarch-boss.*`; previs sidecar 파일명·내부 참조 일괄 갱신 |
| provenance sidecar 정정 | `assets/images/battle/pilot/concept-*-boss.provenance.json` (4종) | done | `asset` 필드가 구 파일명을 가리키던 문제 수정, `prompt` 필드의 "Solo Leveling boss concept" IP 직접 언급 4건 전량 originalized 문구로 교체 |
| **archetype 레벨 개명 (D8 미포함 범위, 이번에 발견)** | `design/boss-concept-prompt-pack.json`, `production/{boss-motion-previs-timing,boss_previs_timings,storyboard-motion-sound-matrix,elevenlabs_sound_plan}.json`, `design/defense-rpg-cinematic-arc.md` | done | `monarch` archetype id가 bossId 개명과 별개 네임스페이스로 남아있던 것 발견 — `concept-monarch-v0N.png` 배리언트 파일명, `boss:monarch:*` previsTag, `sfx_boss_monarch_*` 큐 ID, promptSchema enum 전량 `broken-court-monarch`로 통일 |
| "Shadow Monarch" 직접 인용 제거 | `design/boss-concept-prompt-pack.json` (aw-mo-v01 promptEnglish) | done | Sung Jin-Woo의 정본 칭호("Shadow Monarch")가 생성 프롬프트에 그대로 남아있던 것을 "broken-court ruler"로 재작성 |
| Blender previs 재베이크 | `production/boss_previs_workfile.blend`, `boss_previs_timings.json`, 4종 sidecar | done | 개명 후 실제 헤드리스 Blender(5.1.2) 재실행으로 산출물 일관성 확보(dry-run 아님, 실제 bake) |
| 콘셉트 배리언트 16종 생성 (god-tibo-imagen) | `assets/images/battle/pilot/concept-{sung-hum,shadow-soldier,player-core,broken-court-monarch}-v0{1-4}.png` | done | `--provider codex-cli` 폴백 사용(private-codex는 HTTP 429). 16/16 생성 완료 |
| 산출물 전수 육안 QA | 16종 이미지 | done | 15건 정상, 1건(`concept-broken-court-monarch-v02.png`) 타이틀/캡션 텍스트 번인 발견 → D14 참조, 재생성으로 해소 확인 |
| provenance sidecar 16종 작성 | `assets/images/battle/pilot/concept-{sung-hum,shadow-soldier,player-core,broken-court-monarch}-v0{1-4}.provenance.json` | done | sha256/치수/promptId/archetype/motionAffinity 포함; 실제 발신 프롬프트와 사후 수정된 pack 텍스트가 다른 2건(`sung-hum-v01`, `broken-court-monarch-v02`)은 `note` 필드로 그 괴리를 명시 |
| pack 내 잔존 캐릭터명 발견·제거 | `design/boss-concept-prompt-pack.json` (`aw-sjh-v01.negative`, `sung-hum.category`) | done | `negative` 배열 항목이 "Jin-Woo"를 문자 그대로 포함 — 향후 자동 재생성 시 API로 전송될 수 있는 잠재 유출로 판단해 "source protagonist"로 교체; `category` 라벨도 형제 archetype과 동일한 originalized 패턴으로 통일 |


## Stage3 CI note: engine_contract gate blocked by pre-existing bug, not this cycle's scope

After 3 fix-forward commits (c2dbb97 missing imports, 9a06fcf foreign-content
removal from styles.css/defense-run-simulation.js, 687cf87 asset-manifest
regeneration for the 40 D8/D13 pilot images), `engine_contract`'s remaining
2 failures (`terminal victory accepts a queued reward selection...` /
`selecting an already-owned reward closes an all-owned terminal offer`,
both in `tests/defense-run-simulation.test.mjs`) are **pre-existing at
b0a0c57** (verified via direct baseline repro before any RPG work) — the
reward-selection flow appends `INPUT_ACCEPTED` after `REWARD_SELECTED`
(processInput's terminal emit), so `events.at(-1).type` never equals
`REWARD_SELECTED`. Not caused by, or fixable within, this cycle's RPG-layer
scope. A fix is already in-progress in the shared working tree (uncommitted,
another concurrent workstream — relaxes the assertion to
`events.find(e => e.type === "REWARD_SELECTED")`). Deploy (`package_pages`
onward) stays gated until that lands; `browser_contract` and
`release_closure` are green as of 687cf87.
