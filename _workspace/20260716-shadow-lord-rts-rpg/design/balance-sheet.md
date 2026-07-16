# Balance sheet v2 — 확정 수치 (시뮬레이션 검증)

**Navigation:** [production contract](../production/production-contract.md) · [core loop](core-loop.md) · [gate measurements](../qa/gate-measurements.md) · [exploit register](../qa/exploit-register.md)

## Status and source boundary

이 문서의 수치는 **구현·측정 완료된 결정**이다. 단일 소스는 `campaign-state.js`의 `export const BALANCE`(rules `abyssal-surge-rules-v2`, save schema v2)이며, 아래 표는 그 사본이다. 검증 명령: `node --test tests/campaign-state.test.mjs` (14/14) · `node scripts/run-campaign-balance-sim.mjs` (2026-07-16T15:22:22Z 실행 기준).

v1 시트(Stage 1 전용 설계값: Shade/Bulwark/Riftblade 슬롯 표, cinder-march/relay-ward 보상)는 Wave A 시뮬레이션이 밸런스 결함 B1–B5를 실증하며 **전면 대체**되었다. 유닛-슬롯 세분화는 엔진에 반입되지 않았고, v2는 legion 총량 모델을 사용한다.

## v2 확정 수치 표 (`BALANCE`)

| Knob | 값 | 의미 |
|---|---:|---|
| `counterBase` | **[1, 2, 8]** | assault 시 보스 반격 integrity 피해 기본값 (S1/S2/S3) |
| `shieldDivisor` | **4** | 군단 방패: 반격 = max(1, base − floor(legion/4)) |
| `thinMargin` | **2** | legion < 2 + stage.number 이면 "얇은 군단" |
| `thinPenalty` | **+1** | 얇은 군단 assault의 반격 가산 |
| `rewardRestore` | **+1** | 보상 선택 시 integrity 회복 (clamp 10) |
| `domainRestore` | **+4** | Lord's Domain integrity 회복 |
| `domainAegis` | **2** | Domain 후 반격 무효 횟수 |
| `soulsPerExtract` | **4** | extract 1회당 souls (hunted 2 소비·리셋, 반복 가능) |
| `materializeCost` / `materializeSummon` | **2 / 2** | souls 2 → 그림자 2 |
| `vanguardLegion` | **4** | veil-vanguard: Echo Throne 개시 legion |
| `anchorRestore` | **+2** | anchor-shard: Echo Throne 진입 시 integrity 회복 |
| `assaultBase` | **[3, 3, 4]** | 플레이어 assault 데미지 (S1/S2/S3) |
| `possessDamage` | **+1** | 빙의 중 assault 데미지 가산 (S2·S3) |
| `lensDamage` | **+1** | rift-lens: 빙의 중 추가 가산 |
| `maxIntegrity` | **10** | integrity 상한. **스테이지 간 지속** (리셋 없음) |

### 반격 공식 (단일 정의)

```
counter = max(1, counterBase[stage] - floor(legion / 4)) + (legion < 2 + stageNumber ? 1 : 0)
aegis > 0 이면 counter 무효, aegis -= 1 (킬 블로우에도 반격은 적용되나 보스 사망 판정이 우선)
```

## 스테이지 표

| Stage | Boss HP | assault dmg (기본/빙의/빙의+lens) | 반격 base | 반격 실효 범위* |
|---|---:|---|---:|---|
| Cinder Span | 8 | 3 / – / – | 1 | L2: 2 · L4+: 1 |
| Veil Citadel | 10 | – / 4 / 5 (빙의 필수) | 2 | L2: 3 · L4+: 1 |
| Echo Throne | 17 | 4 / 5 / 6 | 8 | L2: 9 · L4: 8 · L8: 6 · L12: 5 · L22: 3 (+domain aegis 2회 무효) |

*L = legion. S3에서 domain(+4, aegis 2)이 사실상 생존 필수 수단 — 계약 5의 "1회 한정 일발역전기".

## 보상 (스테이지당 2 제시 / 1 선택)

| Reward | Stage | v2 효과 | 기계적 근거 |
|---|---|---|---|
| `ember-cohort` | S1 | +12 legion slots (잔여 캠페인) | 방패 상한 확장: S3 fortress(L22 → 반격 3) 경로 개방 |
| `rift-lens` | S1 | 빙의 assault +1 dmg (S2부터) | S2 3→2회, S3 4→3회 assault — 반격 노출 1회씩 절약 |
| `veil-vanguard` | S2 | Echo Throne 개시 legion 4 | S3 경제 페이즈 생략 (약 4액션 절약) |
| `anchor-shard` | S2 | Echo Throne 진입 integrity +2 | 저체력 진입(comeback 라인) 보험 |
| `throne-echo` / `dawnless-crown` | S3 | 기록용 (종결 코스메틱) | 캠페인 종료 후 선택 |

4콤보(ember/lens × vanguard/anchor) 전부 **서로 다른 결과 궤적** — [gate-measurements #G2](../qa/gate-measurements.md) 콤보 표 참조.

## Hard invariants (유지)

| Rule | Value | Verification owner |
|---|---:|---|
| Slot cap clamp | integer min **10**, max **100** | Engineering / G2 (퍼저 150k op 위반 0) |
| Stage 1 starting capacity | 10 | Design |
| Rewards per completed stage | exactly 2 offered; exactly 1 selected | Engineering/QA |
| Save trace budget | ≤ **400** events (v2에서 200→400, 반복 경제 루프 수용) | Engineering |
| Save schema | v2, **v1 봉투는 명시적 마이그레이션 메시지로 거부** | Engineering |
| 결정론 | 동일 액션 시퀀스 = 동일 결과 (엔진 RNG 없음) | QA (더블 런 diff 동일) |
| Cinder Span target loop | 75 s | QA/G7 |
| Valid loop band | 30–180 s | QA/G7 |

## 부록 — G2 밴드 튜닝 반복 로그

목표: casual(seeded random legal walker, n=200) 캠페인 승률 45–55%. 조정 노브: 반격 기본값 `counterBase`, 보상 회복 `rewardRestore`, 방패 계수 `shieldDivisor`, 페널티 `thinPenalty` (계약 8). 반복 한도 12회 중 **8회 사용**.

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

## Band overrides — TTK 목표 (2026-07-17 확정)

스테이지 클리어 시간 목표(디렉터 승인, canonical 기획서 `wiki/reports/shadow-lord-rts-rpg-hybrid-design.md` §2와 동기):

| Stage | TTK 목표 | 허용 밴드 (±15%) | 유도 근거 |
|---|---:|---|---|
| Cinder Span | **75 s** | 64–86 s | 라이브 실측 9–14 act × 인간 페이스 5–15 s/act의 중앙, core-loop.md 75 s 모델 유지 |
| Veil Citadel | **100 s** | 85–115 s | 실측 10–16 act (빙의 1액션 추가) |
| Echo Throne | **120 s** | 102–138 s | 실측 6–17 act (domain·fortress 분기 폭 반영) |

측정 방법: 라이브 세션의 stage-clear 타임스탬프 (봇 페이스 측정치는 act 수 × 5–15 s/act로 환산 비교). G2 TTK 행은 이 밴드로 판정 가능 상태가 된다.

## 남은 미해결 수치

체감 액션 시간 실측(5–15 s 가정의 인간 세션 치환)과 반복률 proxy는 여전히 라이브 인간 세션 필요 — [gate-measurements](../qa/gate-measurements.md) G7 PARTIAL 행 참조. 쿨타임-감소 보상(Stillwater Hourglass)의 콤보 EV 재검증은 다음 시뮬 배치 대상 (canonical 기획서 §8 회고 항목 3).
