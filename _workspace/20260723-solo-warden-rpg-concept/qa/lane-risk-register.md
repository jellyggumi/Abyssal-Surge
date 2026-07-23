---
lane: qa
role: game-qa
lane-id: QARiskRegister
run-id: 20260723-solo-warden-rpg-concept
artifact: cross-system-balance-risk-register
stage: 1 (concept)
sibling-lanes:
  - QABenchmarkSurvey -> qa/lane-benchmark-survey.md
  - QAArchetypeTestPlan -> qa/lane-archetype-testplan.md
---

# 교차 시스템 밸런스 리스크 등록부 (Cross-System Balance Risk Register)

## 목적과 범위

이 문서는 세 시스템 — (a) Dusk Warden만 성장하는 고유 성장 시스템(Solo Leveling
구조), (b) 거점/편성/동료 수집 메타 레이어(Kingshot 구조), (c) 영구 스탯/아이템/특성
누적(로그라이크-RPG 깊이) — 을 하나의 레이어로 합칠 때 발생하는 **교차 시스템 밸런스
붕괴 리스크**를 사전(pre-implementation) 식별한다. Stage 1 컨셉 단계이므로 아직 빌드가
없다 — 모든 심각도 수치는 측정값이 아니라 메커니즘에서 도출한 가설이며 [INFERENCE] 또는
[TARGET]으로 표시한다. [OBSERVED] 표시는 `docs/abyssal-command-defense-survivor-design.md`와
`skill://game-studio-harness/references/quality-gates.md`에서 직접 인용한 기존 계약/게이트
수치에만 사용한다.

**형제 레인과의 경계**: `QABenchmarkSurvey`는 유사 게임에서 실제로 관찰된 밸런스 패턴/실패
사례를 수집하고(감도 보정), `QAArchetypeTestPlan`은 아키타입 로테이션 플레이테스트 세션을
설계한다(실행 계획). 이 문서는 그 사이 — **어떤 조합이 왜 깨질 수 있는지의 가설과, 디자이너가
지금 컨셉 단계에서 넣어야 할 제약**을 제공한다. 벤치마크 레인의 데이터는 R2/R5의 심각도
가설을 보정하는 데, 아키타입 테스트플랜 레인은 R1–R5 각각을 검증하는 플레이테스트 시나리오를
설계하는 데 이 등록부를 입력으로 사용해야 한다(중복 없이 이어받도록).

## 리스크 요약표

| ID | 리스크 | 충돌 시스템 | 위험 게이트 | 심각도 가설(요약) |
|---|---|---|---|---|
| R1 | 고유 성장이 런 전용 스킬 제안의 선택 긴장을 무력화 | (a)+기존 런 스킬 제안 | G7, G2 | 후반 스테이지 승률이 스킬 선택과 무관하게 수렴 |
| R2 | 편성 조합이 동료 다양성 자체를 무의미하게 만듦 | (b) | G3 | 단일 메타 편성으로 70–90% 수렴 [INFERENCE] |
| R3 | 아이템·특성 곱연산 누적이 G2 승률 밴드를 이탈 | (c)+(b) | G2, G5(재해석) | 완전 육성 파티 승률 >70%, 저육성 <30% [INFERENCE] |
| R4 | 런 범위 상태와 영구 원장의 경계 모호로 상태 버그 발생 | (a)+(c) | G7, 결함수명주기(S1) | 최초 아키타입 로테이션에서 S1 1건 이상 노출 가능 [TARGET] |
| R5 | 두 영구 성장축의 복리 누적이 플레이스타일 패리티를 붕괴 | (a)+(c) | G5(재해석) | 세션 10 시점 2배 이상 격차, 밴드 무관하게 확대 [INFERENCE] |

---

## R1 — 고유 성장이 런 전용 스킬 제안 긴장을 무력화

**시스템 충돌**: (a) Dusk Warden 고유 성장 vs 기존 계약의 런 전용 스킬 제안(XP 임계값 →
3개 중 1개 선택, 미선택 소멸, 런 종료 후 비영속).

**메커니즘**: Dusk Warden만 얻는 영구 성장(Solo Leveling 구조 차용)이 "영구 기본 스탯 증가"
형태로 구현되고 런 전용 스킬 보너스와 **가산(additive)** 관계라면, 캠페인 초반에는 기본
스탯이 낮아 스킬 제안 3개 중 어느 것을 고르는지가 승패를 가르지만(선택 긴장 존재), 캠페인이
진행될수록 영구 기본 스탯이 누적되어 스킬 제안의 상대적 기여도가 점점 작아진다. 극단적으로는
후반 스테이지에서 "무엇을 골라도 클리어된다"가 되어, 문서에 명시된 "런 전용 스킬 제안을
선택한다"는 핵심 루프의 선택 긴장이 사라진다.

**심각도 가설** [INFERENCE]: 영구 스탯 증가가 스테이지 클리어당 무제한 가산(예: 클리어당
+5% 기본 스탯, 상한 없음)으로 설계될 경우, 스테이지 5–6 시점에 기본 스탯 기여가 런 스킬
기여의 3–5배를 넘어설 수 있고, 스테이지 8–10에서는 스킬 제안을 무시한 시뮬레이션도 승률
95% 이상에 도달할 수 있다. 이 경우 G2의 45–55% 밴드는 후반 스테이지에서 스킬 선택과 무관하게
결정된 결과이므로 측정 자체가 무의미해진다. [TARGET] G7이 요구하는 "루프당 ≥3 액션의 의미
있는 가중치"는 스테이지 1과 스테이지 10에서 동일하게 성립해야 한다.

**완화 설계 제약**: 고유 성장을 원시 스탯 가산이 아니라 **용량(capacity) 성장**으로 설계할
것 — 즉 스킬 슬롯 수, 제안 풀 크기, 추출 성공률 같은 "런 전용 스킬 시스템이 더 잘 작동하게
하는" 성장으로 한정하고, 영구 성장이 스테이지 기대 파워 예산에 기여하는 가산 비중의 명시적
상한을 `design/balance-sheet.md`에 못박는다.

```yaml
risk_id: R1
system_collision: [protagonist-unique-growth, run-scoped-skill-offer]
gates_at_risk: [G7, G2]
proposed_constraint:
  type: capacity-growth-not-additive-stat
  additive_stat_contribution_ceiling_pct: 20   # TARGET — stage power budget 대비 상한
verification_method: "스테이지별 '런 스킬 제안 없이' 시뮬레이션 승률 프로브 — 모든 스테이지에서 이 승률이 45% 미만이어야 함"
```

---

## R2 — 편성 조합 지배가 동료 다양성을 무의미하게 만듦

**시스템 충돌**: (b) Kingshot식 편성(탐험/원정/합공) vs 영구 동료 수집(기존 추출→동료
메커니즘).

**메커니즘**: Kingshot의 편성 시스템은 개별 영웅 파워보다 배치(전열/후열) 조합이 더 크게
작용하도록 설계되어 있다. Abyssal의 동료-편성 레이어가 인접 보너스(예: "같은 역할군 인접 시
+X%") 방식으로 구현되면, 어떤 동료를 보유했는지와 무관하게 수학적으로 우월한 단일 편성
레시피가 발견될 위험이 있다 — 이 경우 "다양한 동료를 모으는" 동기 자체가 무너진다. 이는
개별 동료 스탯이 완벽히 균형 잡혀 있어도 편성 슬롯 레이어에서 별도로 발생하는 붕괴다.

**심각도 가설** [INFERENCE]: 인접 보너스형 편성 시스템을 쓰는 비교 가능 SLG들에서 특정
"메타 편성"으로 참여도 높은 플레이어의 70–90%가 수렴하는 패턴이 흔하다(벤치마크 레인
`QABenchmarkSurvey`가 실측 빈도로 보정할 것). Abyssal이 상쇄 장치 없이 유사 구조를 도입하면
[TARGET] G3(어떤 아키타입도 최적 플레이에서 50% 초과 지배 금지)가 "전략" 레벨에서는
통과해도 "편성 조합" 레벨에서는 위반될 수 있다 — G3는 현재 이 실패면을 측정하지 않는
새로운 리스크 표면이다.

**완화 설계 제약**: 동일 역할군 인접 보너스를 체감(diminishing returns)으로 강제하고
(곱연산/복리 금지), 최소 2개의 구조적으로 다른 편성 아키타입("전열 폭딜형" vs "분산
지속형")이 **동일 보스 컨텐츠**를 서로 다른 동료 역할 비율로 45–55% 밴드 안에서 클리어할
수 있음을 `design/balance-sheet.md`에 측정 가능한 편성 패리티 타깃으로 명시할 것 — 개별
동료 밸런스만으로는 불충분함을 디자이너 산출물에 못박는다.

```yaml
risk_id: R2
system_collision: [formation-role-adjacency, companion-collection]
gates_at_risk: [G3]
proposed_constraint:
  type: diminishing-returns-adjacency
  min_distinct_formation_archetypes: 2   # TARGET
  required_role_ratio_divergence: "측정 가능한 서로 다른 동료 역할 비율"   # TARGET
verification_method: "동일 보스 콘텐츠에 대해 편성 아키타입별 승률 매트릭스 — QAArchetypeTestPlan 세션에 위임"
```

---

## R3 — 아이템·특성 곱연산 누적이 G2 승률 밴드를 이탈

**시스템 충돌**: (c) 영구 스탯/아이템/특성(로그라이크-RPG 깊이) vs 기존 영구 동료 상태 +
(b) 편성 보너스.

**메커니즘**: 새 RPG 레이어는 기존 "영구 동료" 상태를 스탯/인벤토리/특성으로 심화하는
것이 목적이다(공유 참조 번들 Source 3). 만약 아이템 등급 보너스, 특성 보너스, 편성 보너스가
**같은 기초 스탯(예: 피해량)에 각각 곱연산**으로 적용된다면(트레잇 +15% × 아이템 +20% ×
편성 +10% 식으로 서로 곱해짐), 완전 육성된 동료의 파티 파워가 기존 밸런스 시트가 가정하는
범위(런 스킬 델타만 존재하던 시절 기준)를 크게 초과할 수 있다. 이는 완전 육성 파티의 승률을
G2 밴드 위로, 저육성 파티의 승률을 밴드 아래로 동시에 밀어내 **밴드를 좁히지 않고 오히려
넓힌다** — 이는 또한 PM의 "플레이스타일 패리티" 재해석(그라인드형과 스킬형이 명시된 세션
밴드 내에서 수렴해야 함)과도 정면으로 충돌한다.

**심각도 가설** [INFERENCE]/[TARGET]: 3개 이상의 독립 보너스원(특성/아이템/편성)이 곱연산으로
누적되는 패턴은 로그라이크-RPG 하이브리드에서 흔히 관찰되는 파워 폭주 패턴이다. [INFERENCE]
상한 없이 방치하면 완전 최적화된 동료 로드아웃이 캠페인 후반(스테이지 8–10)에 기준 로드아웃
대비 2–3배 파워에 도달할 수 있고, 이 경우 완전 육성 파티 승률은 80–95%로, 동일 슬롯 수를
가진 저육성 파티 승률은 25% 미만으로 갈라질 수 있다 — 둘 다 G2의 45–55% 밴드를 위반하며,
"육성된 아키타입"만 유일하게 유효한 전략이 되어 G3(아키타입 다양성)도 연쇄적으로 위반한다.

**완화 설계 제약**: `design/balance-sheet.md`에 명시적 누적 규칙을 못박을 것 — 같은
카테고리(특성 vs 아이템 vs 편성) 내 보너스는 **가산**으로 합산하고, 카테고리 간 최종
곱연산 배수에만 하네스가 이미 스킬 콤보에 쓰는 선례(콤보 EV 캡 "중복 페어 >중앙값 1.3배
금지")와 같은 형태의 **명시적 상한**(예: 모든 영구 원천 합산 파워 배수 ≤ 런 스킬 전용
기준선의 1.3배)을 건다. 이렇게 하면 QA는 아이템·특성 조합을 전수 검사하지 않고 게이트
사이클마다 이 공식 하나만 검증하면 된다.

**구현 지점 확정 및 정정** [OBSERVED, ProgDataArch IRC + DesignerCoreLoop IRC 2026-07-23]:
`deriveWardenRuntimeStats` / `deriveCompanionRuntimeStats` (engineering/lane-data-arch.md §5)가
특성·아이템 보너스를 합성하는 지점이며, `RuntimeStatModifiers`는 현재 소스 개수와 무관한
**무상한 가산 합**으로 설계되어 있다 — 여기까지는 카테고리 내 가산 규칙을 지킨다. 그러나
DesignerCoreLoop가 확인한 바에 따르면 `stance_modifier`(편성/스탠스 보너스, 예:
ProgFormationSim의 `back_row_damage_bonus_bp`와 동일 레이어)는 이 derive-fn **바깥의
fire-time(발사 시점) 곱연산**으로 합성될 예정이다 — 즉 곱연산 체인이 **두 레이어**로
나뉜다: (1) derive-fn 반환 단계(특성+아이템, 현재 가산), (2) fire-time 계산 단계(편성
스탠스, 곱연산). R3의 카테고리 간 상한을 derive-fn 반환값에만 걸면 fire-time 배수가
빠져나가 상한이 실제 최종 피해 배수를 통제하지 못한다 — 상한은 **두 레이어를 합친 전체
곱연산 체인**을 감싸야 한다. 정확한 곱연산 위치(어느 함수가 최종 배수를 계산하는지)의
최종 확정은 ProgFormationSim/ProgDataArch 몫이다.

```yaml
risk_id: R3
system_collision: [permanent-item-tier, permanent-trait, formation-bonus]
gates_at_risk: [G2, G5]
proposed_constraint:
  type: additive-within-category-capped-across-category
  cross_category_multiplier_ceiling: 1.3   # TARGET — 기존 combo_ev_cap_vs_median 1.3 선례 재사용
  baseline: "run-scoped-skill-only power"
  multiplier_chain_layers:
    - layer: "derive-fn return (item + trait, additive)"
      location: "deriveWardenRuntimeStats / deriveCompanionRuntimeStats (engineering/lane-data-arch.md §5)"
    - layer: "fire-time formation/stance multiplier"
      location: "same layer as back_row_damage_bonus_bp — owner TBD, likely ProgFormationSim"
  enforcement_point: "OPEN — must wrap the FULL chain (derive-fn output x fire-time stance_modifier), not derive-fn output alone; single-layer cap confirmed insufficient"
  enforcement_owner: "ProgFormationSim + ProgDataArch — joint, exact multiply site not yet finalized"
  cap_value_owner: "designer lane — must land in design/balance-sheet.md"
verification_method: "완전 육성 vs 저육성 동일 슬롯 파티의 동일 보스 매치업 승률 시뮬레이션 — G2 재측정"
```

---

## R4 — 런 범위 상태와 영구 원장의 경계 모호로 상태 버그 발생

**시스템 충돌**: (a) 런 종료 후 비영속 규칙(기존 계약) vs (c) 동료 영구 스탯/인벤토리/특성.

**메커니즘**: 기존 계약은 "XP 레벨·제안·스킬 효과·현재 전투 배치는 런 범위를 벗어나
보존하지 않는다. 동료 획득만 영구 진행에 기록한다"고 명시한다 [OBSERVED,
`docs/abyssal-command-defense-survivor-design.md`]. 새 RPG 레이어는 동료 자체에 영구
스탯/인벤토리/특성을 부여한다(Source 3: "unlock flags"가 아니라 실제 영구 스탯). 만약
편성 조립이 Kingshot처럼 **런 시작 전**에 이루어지고 런 중 동료가 전투 인스턴스 안에서
피해/버프/경험치를 얻는 구조라면, "런 중 획득한 동료 경험치가 영구 레벨에 즉시 반영되는가"
"런 실패/재시작 시 동료가 런 중 얻은 손실(피해 누적, 일시 디버프 등)이 영구 원장에도
반영되는가" 같은 상태 소유권 경계가 불분명해진다. 경계가 불분명한 채 구현되면 두 방향의
버그가 모두 가능하다: (1) 같은 전투를 반복 클리어해 영구 특성이 무한 누적되는 진행도 복제
익스플로잇, (2) 런 재시작 시 영구 동료 스탯이 실수로 리셋되는 진행도 손실 버그(플레이어
신뢰 손상 측면에서 더 심각).

**심각도 가설** [TARGET]: 영구/런 범위 상태 혼동은 이미 이 프로젝트가 "동료-스킬 분리"라는
설계로 명시적으로 방지하고 있던 버그 클래스다 — 즉 프로젝트 스스로 이 리스크를 한 번 이미
해결한 전례가 있다. 프로그래머/데이터 아키텍처 레인이 "영구 원장"과 "런 중 스냅샷"을 명확히
분리하지 않고 구현할 경우, 하네스의 결함 수명주기 관례(S1 결함은 모든 게이트를 막는다)에
따르면 **최초 아키타입 로테이션 패스에서 최소 1건의 S1 진행도 버그(복제 또는 손실)가
발견될 가능성이 높다**고 본다 — 이는 QAArchetypeTestPlan 레인의 첫 세션에서 최우선으로
프로브해야 할 항목으로 넘긴다.

**완화 설계 제약**: `engineering/architecture-contract.md`에 동료 상태를 **두 개의 명시적
읽기 경로**로 정의하도록 요구할 것 — (1) 영구 원장(레벨/스탯 포인트/장착 아이템·특성 —
확정된 런-외부 시점: 추출 성공, 런 종료 후 "귀환" 화면, 명시적 레벨업 확인에서만 기록),
(2) 런 중 임시 스냅샷(현재 HP/활성 버프/편성 위치 — 기존 런 전용 스킬과 동일하게 런
종료/재시작 시 항상 폐기). QA는 "의도적으로 실패시킨 런 전후 영구 스탯이 바이트 단위로
동일한가"를 게이트 체크 항목으로 검증한다.

```yaml
risk_id: R4
system_collision: [run-scoped-non-persistence, permanent-companion-ledger]
gates_at_risk: [G7]
defect_class: state-boundary-conflation
proposed_constraint:
  type: two-path-state-ownership
  permanent_ledger_write_points: ["extraction-success", "post-run-return-screen", "explicit-levelup-confirm"]
  ephemeral_snapshot_fields: ["hp", "active-buffs", "formation-position"]
verification_method: "의도적 런 실패 전후 영구 원장 diff = 0 어서션 — 최초 아키타입 로테이션 세션에서 최우선 프로브"
```

---

## R5 — 두 영구 성장축의 복리 누적이 플레이스타일 패리티를 붕괴

**시스템 충돌**: (a) Dusk Warden 고유 성장 축 + (c) 동료 영구 스탯/아이템/특성 축, 둘 다
비가역·영속이며 감쇠 없음.

**메커니즘**: 프로토타곤스트 고유 성장과 동료 영구 스탯 누적은 둘 다 되돌릴 수 없고 사라지지
않는다. 세션 수가 적은 캐주얼 아키타입은 **두 축 모두에서 동시에** 그라인드형 아키타입보다
누적량이 적다. Kingshot 원본은 이런 격차를 얼라이언스 지원(길드원 자원 지원, 합류 원정 등)으로
부분 완충하지만, Abyssal은 싱글플레이어이므로 이 얼라이언스형 캐치업 메커니즘의 구조적 대응물이
없다 [OBSERVED, 공유 참조 번들: 배틀 타입 3종(탐험/원정/합공) 중 "합공"만 부분 대응 가능하나
이는 얼라이언스 협력이 아니라 단일 플레이어의 동료 합류 편성일 뿐, 얼라이언스 자원 지원의
캐치업 효과와 동일하지 않다]. 상한 없는 두 축을 얼라이언스 등가물 없이 그대로 결합하면
PM의 "플레이스타일 패리티" 재해석(그라인드형 vs 스킬형이 명시된 세션 밴드 10–20 안에서
수렴)이 구조적으로 달성 불가능해질 위험이 있다.

**심각도 가설** [INFERENCE]: 어느 쪽 축에도 세션당 한계 체감(diminishing marginal gain)이나
명시적 상한이 없는 상태에서는, 5세션을 플레이한 캐주얼 아키타입과 20세션을 플레이한
그라인드형 아키타입의 유효 파워가 세션 10 시점에 이미 2배 이상 벌어질 수 있고 [INFERENCE],
이 격차는 두 축 모두 상한이 없으므로 세션이 늘어날수록 수렴하지 않고 계속 확대되는 구조다.
G2가 개별 축마다 상한을 요구하는 것과 달리, 두 축의 **합산 총량**에 대한 상한은 현재 어떤
게이트 산출물에도 존재하지 않는다.

**완화 설계 제약**: 디자이너/PM 레인이 프로토타곤스트 성장과 동료 영구 성장을 **개별
축이 아니라 합산 영구 파워 총량**에 대해 세션당 한계 체감 곡선(로그형 또는 캡형)을 정의하고,
`design/balance-sheet.md#band-overrides`에 명시적 수치 상한을 못박도록 요구한다(예: "합산
영구 파워 배수는 세션 15까지 기준선 대비 1.6배로 캡되고 이후 평탄화"). 이렇게 하면 QA는 두 개의
상관없는 성장 곡선 대신 검증할 숫자 하나를 갖게 된다.

```yaml
risk_id: R5
system_collision: [protagonist-unique-growth, permanent-companion-stacking]
gates_at_risk: [G5]
pm_reframe: playstyle-parity   # no-commerce reinterpretation, NOT paid/free
proposed_constraint:
  type: diminishing-returns-on-combined-permanent-power
  cumulative_power_multiplier_ceiling: 1.6   # TARGET
  ceiling_reached_by_session: 15             # TARGET, PM 재조정 가능
  parity_session_band: "[10, 20] — pm/reward-bands.md와 정합 필요"
verification_method: "casual(5세션) vs grind-heavy(20세션) 아키타입의 세션 10 시점 유효 파워 비율 시뮬레이션"
```

---

## 디렉터 인계 노트 (Director Handoff Note)

가장 중요한 단일 판단: 이 다섯 리스크는 각각 다른 디자이너 레인(세계관/코어루프/RPG시스템)이
독립적으로 담당할 세 시스템(고유 성장, 편성, 아이템·특성)이 **각자 따로 밸런스를 맞춰도
합쳐지면 깨진다**는 공통 패턴을 보인다 — R1·R3·R5는 서로 다른 시스템 쌍이지만 전부 "개별
시스템은 정상 범위인데 곱해지거나 더해지면 상한을 넘는다"는 동일한 실패 유형이다. 따라서
개별 리스크의 완화책(R1의 20% 가산 상한, R3의 1.3배 카테고리 간 상한, R5의 1.6배 누적
상한)을 각 디자이너 레인에 따로 전달하는 것보다 먼저, **디렉터가 통합 GDD에 "전체 영구 파워
예산" 하나를 세 시스템이 공통으로 참조하는 단일 거버넌스 오브젝트로 못박아야 한다** —
그렇지 않으면 세 디자이너 레인이 각자 자기 시스템만 45–55% 밴드에 맞추고, QA가 세 시스템을
합쳐 시뮬레이션했을 때 비로소 G2 위반을 발견하는 시점이 Stage 2 이후로 밀려 리텐션 비용이
가장 큰 시점에 재설계가 필요해진다.
