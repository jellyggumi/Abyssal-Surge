# Gate measurements ledger

**Navigation:** [production contract](../production/production-contract.md) · [retrospective schema](../retrospectives/cycle_retrospective.py) · [task manifest](../production/task-manifest.md)

All rows are deliberately `NOT-RUN` until a dated build/session evidence path is attached. A target is never a measured value. G2/G3/G7 시뮬레이션 수치는 measured-only이며 최종 verdict는 director 결정.

## G1

| Threshold | Current measured value | Method | Evidence | Verdict |
|---|---|---|---|---|
| 0 un-waived lore violations; 100% trace coverage | not-run | inventory-to-build audit | `design/worldview.md` (plan only) | NOT-RUN |

## G6 (Stage 1 operations draft)

| Threshold | Current measured value | Method | Evidence | Verdict |
|---|---|---|---|---|
| telemetry fields implemented; rollback tested; p95 frame ≤16.7 ms; long frames <0.5%; 30-min stable memory; input ≤100 ms | not-run | instrumented browser/mobile session | `ops/telemetry-contract.md`, `engineering/architecture-contract.md` (plans only) | NOT-RUN |

## G2 — 밸런스 v2 재측정

측정: `node scripts/run-campaign-balance-sim.mjs` (repo root, Node 22) · **2026-07-16T15:22:22Z** · rules `abyssal-surge-rules-v2` · seed 고정(mulberry32) · 승리 정의: 패배 0회 완주(첫 defeat에서 측정 종료). 튜닝 이력은 [balance-sheet 부록](../design/balance-sheet.md).

| Threshold | Current measured value | Method | Evidence | Verdict |
|---|---|---|---|---|
| casual 승률 45–55% | **51.0%** (n=200, 패배 98회 전부 Echo Throne). v1의 100%에서 노브 8회 반복으로 밴드 중앙 도달 | seeded 랜덤 legal walker 200 시행 | 시뮬레이터 stdout `archetypes.casual`, `design/balance-sheet.md` 반복 로그 | measured — **밴드 내** |
| 패배 도달 가능 | rusher(최소 materialize, domain 미사용) S3 1번째 assault에서 integrity 0 — 23액션 재현 시퀀스 고정 | 결정론 정책 + 계약 프로브 | stdout `contractProbes.rusherDefeatSequence`, `qa/exploit-register.md#B1` | measured — 충족 (v1 불가능 → v2 도달) |
| 정보형 플레이 완주 보장 | optimal 100% (25act) · greedy-economy 100% (56act) · comeback 100% (27act) | 결정론 정책 3종 | stdout `archetypes.*` | measured — 충족 |
| TTK ±15% | 액션 수 proxy: optimal 25act (9/10/6), casual 승리 시 31–71 (평균 50.3). **TTK 목표치는 여전히 미정의 — 밴드 비교 불성립** | 액션 수 = TTK proxy | `qa/playtest-report.md`, `design/balance-sheet.md`(초 단위 target 미정) | measured — 기준선 부재 (판정 불가, director) |
| 콤보 EV ≤1.3× median | **1.119×** — 4콤보 궤적이 실제로 분화된 상태에서의 비율 (v1은 궤적 동일로 공허 통과) | adaptive optimal 정책 × 4콤보 전수 | stdout `comboEv` (아래 표) | measured — **충족 (비-공허)** |

콤보 궤적 (adaptive optimal, seed 7):

| 콤보 (S1+S2) | 총 액션 | 스테이지별 | integrity 궤적 | EV(승/액션) |
|---|---:|---|---|---:|
| ember-cohort + veil-vanguard | 27 | 9/11/7 | 7→5→0 | 0.0370 |
| ember-cohort + anchor-shard | 31 | 9/11/11 | 7→5→0 | 0.0323 |
| rift-lens + veil-vanguard | 25 | 9/10/6 | 7→6→2 | 0.0400 |
| rift-lens + anchor-shard | 29 | 9/10/10 | 7→6→1 | 0.0345 |

4콤보 4개 서로 다른 (총액션, integrity 궤적) — 보상 무효 결함(B2) 해소.

## G3 — 아키타입 다양성 재측정

측정: 동일 명령 · 2026-07-16T15:22:22Z.

| Threshold | Current measured value | Method | Evidence | Verdict |
|---|---|---|---|---|
| 유효 아키타입 ≥3 | **4/5 승리 가능 + 1 의도적 패배 교본.** optimal(25act·counter-1 티어), greedy(56act·만벽 fortress), comeback(27act·domain 역전), casual(51%)이 서로 다른 시퀀스·결과로 완주. rusher는 S3 사망 — "domain 없는 얇은 돌격은 죽는다"는 규칙의 실증 | 아키타입별 시퀀스 서명 + 결과 궤적 비교 | stdout `diversity` (`uniqueDeterministicSequences: 4`, `distinctDeterministicOutcomes: 4`) | measured — 충족 (v1: 사실상 1종) |
| 지배 아키타입 ≤50% | 결정론 4종 결과 4종 분화(승률 0/100 × 액션 19–56 × integrity 궤적 상이). comeback은 rusher와 S1/S2 동일 궤적에서 domain 결정 하나로 승패가 갈림 — 전략 선택이 결과 변수를 실제로 지배 | 시퀀스 서명 4종/4종, branch census | stdout `diversity.branchCensus` (결정 지점 중 복수 선택지 비율: optimal 0.76, greedy 0.84, rusher 0.68, comeback 0.67, casual 0.89) | measured — 충족 |
| comeback 성립 | domain 발동 전 integrity 3 → +4 회복 + aegis 2로 반격 2회 무효 → 동일 라인이 domain 없으면 defeat, 있으면 완주 | 계약 프로브 쌍(동일 S1/S2, S3만 분기) | stdout `contractProbes.comebackDomainFlip`, `domainConvertsDefeatToWin: true` | measured — 충족 (v1: 구현 불가) |

## G7 — 루프 구조 (proxy)

측정: `node scripts/run-campaign-balance-sim.mjs` · 2026-07-16T15:22:22Z. 시간 수치는 **유도값**(액션당 5–15 s 가정; 75 s 목표 ÷ 8액션 = 9.4 s/액션이 가정 밴드 내). 실측 시간·반복률은 라이브 세션 필요.

| Threshold | Current measured value | Method | Evidence | Verdict |
|---|---|---|---|---|
| period 30–180 s | 액션/루프 9 / 10 / 6 (스테이지 1–3, optimal) → 유도 45–135 s / 50–150 s / 30–90 s — 전 스테이지 밴드 내 | 시뮬레이션 액션 수 × 5–15 s/act 가정 | stdout `g7Proxy`, `design/core-loop.md`(75 s 모델) | measured(proxy) — 밴드 내, 실측 대체 필요 |
| ≥3 actions/loop | 6–10 (optimal) · casual 승리 시 평균 50.3act/캠페인 | 동일 | stdout `g7Proxy.perStage` | measured — 충족 |
| ≥1 reward event/loop | 스테이지당 정확히 1 (2 제시 / 1 선택) | 시뮬레이션 보상 이벤트 카운트 | stdout, `campaign-state.js` chooseReward | measured — 충족 |
| repeat proxy ≥70% | **NOT-RUN** — 자발 반복 의사는 시뮬레이션 불가 | 10 voluntary repeat sessions (절차: core-loop.md) | 없음 | NOT-RUN |

## Future gate slots

G2/G3/G7 시뮬레이션 수치는 위에 부착됨(밸런스 v2). G5, G8 attach in Stage 2; G4 and final G6 attach in Stage 3. Each must state canonical threshold, measured value, method, evidence paths, timestamp, revision loops, and verdict.
