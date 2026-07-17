# Balance sheet v3 — 보상 빌드 경로 확정 수치

**Navigation:** [production contract](../production/production-contract.md) · [core loop](core-loop.md) · [gate measurements](../qa/gate-measurements.md) · [exploit register](../qa/exploit-register.md)

## Status and source boundary

이 문서의 v3 수치는 구현된 `campaign-state.js`의 `export const BALANCE`가 단일 소스다. rules version은 `abyssal-surge-rules-v3`, save schema는 v2지만 v2 rules trace는 명시적으로 거부한다. 이는 저장 슬롯의 형식을 바꾸지 않으면서 기존 보상 의미가 재해석되는 것을 막는다.

검증 경계:

- `node --test tests/campaign-state.test.mjs`: 모든 공개 전이와 v3 보상 경로의 결정론을 검증한다.
- `node scripts/run-campaign-balance-sim.mjs`: v2 G2 승률 탐색의 원본 증거다. v3 보상 재설계의 live TTK/반복률을 증명하지 않는다.

v1의 슬롯 확장 보상과 v2의 단순 Lens +1은 폐기됐다. v3은 동일한 capacity 10 안에서 **Legion / Burst / Tempo / Bulwark / Recovery / Setup** 중 하나를 고르게 하며, 어떤 보상도 Hunt → Extract → Materialize → Capture → Possess/Domain/Assault 게이트를 우회하지 않는다.

## v3 확정 수치 표 (`BALANCE`)

| Knob | 값 | 의미 |
|---|---:|---|
| `counterBase` | **[1, 2, 8]** | assault 시 보스 반격 integrity 피해 기본값 (S1/S2/S3) |
| `shieldDivisor` | **4** | 군단 방패: legion 4당 반격 1 감소 |
| `thinMargin` / `thinPenalty` | **2 / +1** | legion < stage + 2 이면 얇은 군단 페널티 |
| `rewardRestore` | **+1** | 보상 선택 시 integrity 회복 (상한 10) |
| `domainRestore` / `domainAegis` | **+4 / 2** | Lord's Domain 회복 및 반격 무효 |
| `soulsPerExtract` | **4** | extract 1회당 souls. Hourglass는 두 번째 Hunt에서 이 payload를 즉시 적용 |
| `materializeCost` / `materializeSummon` | **2 / 2** | souls 2 → 기본 그림자 2 |
| `cohortSummonBonus` / `bannerSummonBonus` | **+2 / +1** | Cohort/Banner의 Materialize 추가 그림자 |
| `vanguardLegion` / `anchorRestore` | **4 / +2** | Vanguard/Anchor의 Echo Throne 진입값 |
| `hourglassCooldownReduction` | **20%** | 모든 control-pad 명령의 독립 쿨다운 감소 |
| `bannerInitialAegis` | **1** | Banner의 스테이지 진입 aegis |
| `brandCounterReduction` | **2** | Brand의 반격 감소. 최종 반격은 최소 1 |
| `assaultBase` / `possessDamage` / `lensDamage` | **[3,3,4] / +1 / +4** | Assault 기본값, 빙의 가산, Lens burst 가산 |
| `maxIntegrity` | **10** | integrity 상한. 스테이지 간 지속 |

### 반격 공식 (단일 정의)

```
shield = floor(legion / 4)
rawCounter = max(1, counterBase[stage] - shield) + (legion < stageNumber + 2 ? 1 : 0)
counter = max(1, rawCounter - brandCounterReduction)
aegis > 0 이면 counter 무효, aegis -= 1
```

킬 블로우에도 반격은 계산되지만 보스 사망 판정이 우선한다.

## 스테이지 표

| Stage | Boss HP | assault dmg (기본 / 빙의 / 빙의+Lens) | 반격 base | 핵심 준비선 |
|---|---:|---|---:|---|
| Cinder Span | 8 | 3 / – / – | 1 | L2를 만들고 forge node를 점거한다. |
| Veil Citadel | 10 | – / 4 / 8 | 2 | 빙의가 필수. Lens는 두 번의 Assault로 끝내지만 node와 Possess를 요구한다. |
| Echo Throne | 17 | 4 / 5 / 9 | 8 | Vanguard는 L4로 시작하지만 얇다. Cohort + Banner는 1회 Materialize 후 L5, Domain은 aegis 2를 추가한다. |

## 보상 경로 (각 승리 후 정확히 하나 선택)

| Reward | Stage | v3 효과 | 전략적 역할 |
|---|---|---|---|
| `ember-cohort` | S1 | Materialize마다 +2 그림자 | Legion: Banner와 조합하면 L5 안전선, 단 Burst/Recovery 없음 |
| `rift-lens` | S1 | S2부터 빙의 Assault +4 | Burst: S2를 2타로 단축; possession 전제 |
| `stillwater-hourglass` | S1 | 쿨다운 −20%, 두 번째 Hunt 자동 extract | Tempo: soul loop의 명령 한 번을 절약; 직접 피해 없음 |
| `shadebreaker-brand` | S1 | 반격 −2, 최소 1 | Bulwark: 얇은 군단의 노출을 완화; 전투 종료는 단축하지 않음 |
| `veil-vanguard` | S2 | S3 L4 시작 | Setup: 초반 soul loop 생략; L5 전에는 여전히 얇음 |
| `anchor-shard` | S2 | S3 진입 integrity +2 | Recovery: 진입 생존 버퍼만 제공 |
| `abyssal-banner` | S2 | S3 aegis 1, Materialize마다 +1 그림자 | Legion / defense: Cohort와 L5를 만들고 Domain 후 총 aegis 3 |
| `throne-echo` / `dawnless-crown` | S3 | 기록용 종결 보상 | 전투 수치에는 영향 없음 |

## Hard invariants (유지)

| Rule | Value | Verification owner |
|---|---:|---|
| Capacity | **10** | Engineering / state tests |
| Rewards per completed stage | S1 **4**, S2 **3**, S3 **2** offered; exactly **1** selected | Engineering / browser + state tests |
| Cooldown reduction | **0–50%** clamp | Engineering / state tests |
| Counter floor | **1** | Engineering / state tests |
| Save trace budget | ≤ **400** events | Engineering |
| Save compatibility | v3 trace replay only; v2 rules trace is rejected with a clear migration message | Engineering / state tests |
| 결정론 | 동일 액션 시퀀스 = 동일 결과 (엔진 RNG 없음) | QA |
| Cinder Span target loop | 75 s | QA/G7 |
| Valid loop band | 30–180 s | QA/G7 |

## 부록 — v2 G2 밴드 튜닝 원본 로그

이 표는 보상 재설계 전 v2 엔진의 반격·회복 노브를 고정한 역사적 증거다. v3의 새 보상 조합 EV나 TTK를 나타내지 않는다. 당시 목표는 casual(seeded random legal walker, n=200) 캠페인 승률 45–55%였고, 조정 노브는 반격 기본값 `counterBase`, 보상 회복 `rewardRestore`, 방패 계수 `shieldDivisor`, 페널티 `thinPenalty`였다.

| # | counterBase | rewardRestore | 기타 변경 | casual 승률 | 판정 · 근거 |
|---:|---|---:|---|---:|---|
| 1 | [2,3,4] | 3 | 계약 1 초기값 | (수기 검증만) | 기각 — rusher가 S2에서 사망, 계약 7(S3 패배 도달) 위반 |
| 2 | [2,2,4] | 3 | – | 90.5% | 기각 — 밴드 +35.5pp. rusher S3 사망 ✓. EV비 1.3006(>1.3) |
| 3 | [2,2,6] | 3 | optimal 정책을 생존제약 티어로 교체 (fortress 강제 제거) | 75.5% | 기각 — 밴드 +20.5pp. EV비 1.119로 해소 |
| 4 | [2,2,7] | 3 | greedy 폴백을 capacity 만벽으로 수정 | 69.5% | 기각 — 밴드 +14.5pp |
| 5 | [2,2,8] | 3 | – | 68.0% | 기각 — 반격 상향 한계효용 급감 (aegis가 크기 무관 흡수) |
| 6 | [1,2,8] | 2 | S1 base 1로 낮춰 rusher 경로 보존 | 63.5% | 기각 — 밴드 +8.5pp |
| 7 | [1,2,9] | 1 | – | 46.0% | 밴드 내(하단). 중앙 접근 시도 계속 |
| 8 | **[1,2,8]** | **1** | – | **51.0%** | **채택** — 밴드 중앙. 전 게이트 동시 충족 |

각 반복에서 불변 확인 항목: rusher S3 패배 재현, optimal/comeback/greedy 100%, 콤보 4궤적 분화, EV비 ≤1.3, 퍼저 위반 0, 더블 런 결정론. 반복 5의 교훈: S3 반격 크기만으로는 casual을 밴드에 넣을 수 없음(aegis 2가 크기 무관 흡수) → 진입 integrity(=rewardRestore) 병행 하향이 결정타.

## TTK 목표 (검증 대기)

아래 목표는 계획 기준선이다. 현재 정적 검증은 액션 게이트와 보상 빌드의 결정론만 증명한다. v3의 실제 세션 타임스탬프가 수집되기 전에는 TTK 통과로 판정하지 않는다.

| Stage | TTK 목표 | 허용 밴드 (±15%) | 유도 근거 |
|---|---:|---|---|
| Cinder Span | **75 s** | 64–86 s | 라이브 실측 9–14 act × 인간 페이스 5–15 s/act의 중앙, core-loop.md 75 s 모델 유지 |
| Veil Citadel | **100 s** | 85–115 s | 실측 10–16 act (빙의 1액션 추가) |
| Echo Throne | **120 s** | 102–138 s | 실측 6–17 act (domain·fortress 분기 폭 반영) |

측정 방법: v3 라이브 세션의 stage-clear 타임스탬프. 봇 페이스는 act 수 × 5–15 s 범위를 보조 비교로만 사용한다.

## 남은 미해결 수치

체감 액션 시간 실측(5–15 s 가정의 인간 세션 치환)과 반복률 proxy는 여전히 라이브 인간 세션 필요 — [gate-measurements](../qa/gate-measurements.md) G7 PARTIAL 행 참조. 쿨타임-감소 보상(Stillwater Hourglass)의 콤보 EV 재검증은 다음 시뮬 배치 대상 (canonical 기획서 §8 회고 항목 3).
