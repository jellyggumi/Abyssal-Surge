# PM Lane — Engagement Point Map (revenue-map.md의 무상업 대응물)

run-id: `20260723-solo-warden-rpg-concept` · lane: `pm/lane-engagement-map.md` · owner: PMEngagementMap
persona: `.claude/agents/game-pm.md` · 형제 레인: `pm/lane-reward-bands.md`(PMRewardBands), `pm/lane-forecast.md`(PMForecast)

## 0. 무상업 재해석 고지 (필수, 매 PM 아티팩트 반복 표기)

이 문서는 하네스 템플릿의 `pm/revenue-map.md`(매출 포인트 지도)를 이 프로젝트의 무상업 경계
(`.survey/abyssal-command-systems-expansion/{triage,context,solutions}.md`,
production-brief.md `main_constraint #3`)에 맞춰 재해석한 것이다.

- "매출 포인트(revenue point)" → **인게이지먼트 포인트(engagement point)**: 플레이어의 **시간
  (time) / 실력(skill) / 주의(attention)**가 의미 있는 선택을 위해 투입되는 지점.
- "가격/보상 페어링(price/reward pairing)" → **투입/획득 페어링(investment/gain pairing)**: 화폐가
  아니라 반복 사냥 시간, 판단력, 조작 정확도가 투입 축이 된다.
- "전환 드라이버(conversion driver)" → **몰입 드라이버(commitment driver)**: 결제 유도가 아니라
  "왜 이 선택이 다음 사냥으로 플레이어를 다시 끌어들이는가"를 기록한다.
- 이 문서 어디에도 결제/광고/프리미엄 재화/확률형 뽑기/계정 시스템을 발명하지 않는다.

## 1. DesignerRPGSystems 인터페이스 가정 [INFERENCE]

`design/balance-sheet.md`(DesignerRPGSystems 산출물) 원문은 아직 읽을 수 없으나, DesignerRPGSystems가
IRC로 확인해 준 확정값을 아래 [OBSERVED-IRC]로 반영했다. 나머지 필드명은 여전히 잠정
placeholder이며, 실제 balance-sheet.md가 나오면 1:1 대조·수정해야 한다.

```yaml
assumed_balance_sheet_interface:  # [INFERENCE] — DesignerRPGSystems 실제 산출물로 검증 필요
  archetype_role_table: "역할군별(탱커/딜러/힐러 계열) 기본 스탯 블록 + 성장 곡선"
  stat_point_per_level: "동료 레벨업 시 지급되는 분배 가능 스탯 포인트 수 + 역할별 상한. [OBSERVED-IRC] 소모 자원명 'Echo Core', 포인트당 비용은 escalating cost curve(레벨 오를수록 비쌈, 정확한 곡선식은 balance-sheet.md 확인 대기)"
  item_tier_table: "장비 등급 사다리 + 등급별 스탯 보너스 폭. [OBSERVED-IRC] 5단계(5 tiers) 확정, 동료 장비 슬롯 단위로 적용"
  upgrade_material_cost_curve: "장비 강화 단계별 필요 재료량 곡선"
  skill_tree_node_costs: "영구 스킬트리 노드별 해금 조건(레벨/재료) + 액티브·패시브 파워 예산. [주의] DesignerRPGSystems의 IRC 확인 범위(stat-alloc/gear-upgrade/trait-select)에 스킬트리 언급 없음 — 별도 시스템으로 존재하지 않을 가능성, EP-7은 미확정 상태로 표기"
  trait_pool_table: "특성 후보 풀 + 특성별 파워 가중치. [OBSERVED-IRC] 5개 슬롯, 동료 스테이지 2/4/6/8/10 도달마다 1슬롯씩 해금, 매 해금 시 3개 후보 중 1개 선택(pick-1-of-3)"
  gate_difficulty_curve: "게이트 등급(E~S 상당)별 난이도·XP 배율·정수 등급 상한"
  essence_grade_thresholds: "추출 성과(생존/타이밍/포지셔닝) → 정수 등급 결정 함수의 임계값"
  roster_cap: "영구 동료 명부 상한 슬롯 수"
  formation_slot_count: "습격 편성 슬롯 구성 + 상성 매트릭스. [OBSERVED-IRC] DesignerCoreLoop 확정: 3슬롯 스탠스 체계(Vanguard/Rally/Split), 기존 '전열/후열' 가정을 대체"
```

## 2. 인게이지먼트 포인트 지도

루프 단계 태그는 기존 정경의 검증 체인 **hunt(사냥) → extract(추출) → materialize(물질화) →
capture(포획) → assault(습격)**을 따른다. 스탯/장비/스킬트리/특성은 런 사이(between-run)
성장 레이어로, 이 체인을 반복 순회하게 만드는 견인점이다.

| ID | 인게이지먼트 포인트 | 루프 단계 | 트리거 조건 | 투입(시간/실력/주의) | 획득 | 영향받는 밸런스 수치 [INFERENCE 필드명] | 근거 라벨 |
|---|---|---|---|---|---|---|---|
| EP-1 | 게이트 등급 선택 | 사냥 준비 | 로비에서 게이트 목록 진입, 사냥 런 시작 전 | 실력(자기 실력 대비 등급 판단) + 시간(예상 런 길이 감수) | XP 배율 접근권, 획득 가능 정수 등급 상한 | `gate_difficulty_curve` | [OBSERVED] 기존 스테이지 진행 구조(docs/abyssal-command-defense-survivor-design.md §런과 성장) 확장 |
| EP-2 | 정예 추출 시도 | 추출 | 정예 적 처치 직후 추출 가능 상태 진입 | 실력(추출 윈도우 동안 생존·포지셔닝) + 시간(윈도우 유지) | 정수(에센스) 1개, 등급은 **성과 결정론적**(확률 아님) | `essence_grade_thresholds` | [OBSERVED] docs §3 "정예 적 처치 뒤 추출 기회"; 등급 결정론화는 [INFERENCE] 아래 §4 확률형 배제 근거 |
| EP-3 | 물질화 — 동료 원형 결정 | 물질화 | 정수 보유 후 물질화 화면 진입 | 실력(파티 구성 이해 기반 원형 선택) — 즉시 판단, 되돌릴 수 없음 | 신규 동료 원형 확정(역할군 고정) | `archetype_role_table` | [INFERENCE] Solo Leveling 그림자 소환 구조·Kingshot 영웅 역할 특화를 결정론적 선택지로 재해석 |
| EP-4 | 포획 — 명부 슬롯 결정 | 포획 | 명부가 상한(`roster_cap`)에 도달한 상태에서 신규 동료 포획 시도 | 실력(교체 가치 판단) + 주의(기존 동료 성장 투자 회수 여부 검토) | 신규 동료 확보(대가: 기존 동료 은퇴 또는 포획 포기) | `roster_cap` | [TARGET] 상업형 템플릿의 "슬롯 구매" 지점을 은퇴-교체 판단으로 대체 — §5 director 노트 참조 |
| EP-5 | 스탯 포인트 분배 | 성장(런 간) | 동료가 반복 사냥 클리어로 레벨업할 때마다 | 시간(레벨업까지 반복 사냥) + 실력(분배 전략, 역할 적합도 판단) | 영구 스탯 성장(비가역 또는 제한적 재분배 — DesignerRPGSystems 확정 필요) | `stat_point_per_level` | [OBSERVED] RPG 장르 어휘 스탯/성장 구조(shared-reference-bundle §Source 3) |
| EP-6 | 장비 강화 선택 | 성장(런 간) | 사냥에서 강화 재료 획득 + 강화 화면 진입 | 시간(재료 파밍 반복) + 실력(강화 대상·순서 우선순위 판단) | 장비 등급 상승, 스탯 보너스 | `item_tier_table`, `upgrade_material_cost_curve` | [OBSERVED] RPG 장르 아이템 등급 어휘 |
| EP-7 | 스킬트리 노드 해금 [미확정] | 성장(런 간) | 동료 레벨 마일스톤 도달 (가정 — DesignerRPGSystems ack에 언급 없음) | 시간(마일스톤까지 반복 사냥) + 실력(트리 경로 선택, 런 전용 스킬과 다른 영구 판단) | 영구 액티브/패시브 스킬 1개 | `skill_tree_node_costs` | [TARGET] docs §런 전용 스킬과 별개 상태 원칙 확장을 가정 — 스킬트리가 별도 시스템으로 존재하는지 balance-sheet.md 확정 필요. 미존재 시 이 행 삭제 |
| EP-8 | 특성 선택 | 성장(런 간) | 동료 스테이지 2/4/6/8/10 도달 시 특성 슬롯 해금(5슬롯 중 해당 회차) | 실력(스테이지 도달까지 반복 사냥·전투) + 주의(3개 후보 중 1개, 비가역 선택 전 시너지 검토) | 영구 패시브 특성 1개(동료에 귀속), pick-1-of-3 | `trait_pool_table` | [OBSERVED-IRC] DesignerRPGSystems 확정: 5슬롯·스테이지 2/4/6/8/10·pick-1-of-3 |
| EP-9 | 습격 편성 재구성 | 습격 준비 | 보스/습격 대상 확정 후 편성 화면 진입 | 시간(편성 실험, 여러 조합 시도) + 실력(스탠스 선택: Vanguard/Rally/Split 상성 판단) | 습격 성공률/전투 효율 상승(파워 수치가 아니라 구성 최적화) | `formation_slot_count` | [OBSERVED-IRC] DesignerCoreLoop 확정 3슬롯 스탠스 체계 기반; Kingshot exploration/rally 구조 재해석(shared-reference-bundle §Source 2)에서 출발 |

## 3. 게이트 체크 가능 값 (YAML)

```yaml
engagement_points:
  - id: EP-1
    stage: hunt
    investment_axis: [time, skill]
    reversible: true
  - id: EP-2
    stage: extract
    investment_axis: [skill, time]
    reversible: false          # 정수 등급은 추출 시점에 확정
  - id: EP-3
    stage: materialize
    investment_axis: [skill]
    reversible: false          # 원형 확정 후 재선택 불가 — DesignerRPGSystems 승인 필요
  - id: EP-4
    stage: capture
    investment_axis: [skill, attention]
    reversible: false          # 은퇴 결정은 되돌릴 수 없음
  - id: EP-5
    stage: growth
    investment_axis: [time, skill]
    reversible: unresolved     # 재분배 허용 여부 — DesignerRPGSystems 확정 대기
  - id: EP-6
    stage: growth
    investment_axis: [time, skill]
    reversible: false
  - id: EP-7
    stage: growth
    investment_axis: [time, skill]
    reversible: false
    status: unconfirmed        # 시스템 존재 자체가 미확정 — DesignerRPGSystems ack에 없음
  - id: EP-8
    stage: growth
    investment_axis: [skill, attention]
    reversible: false
  - id: EP-9
    stage: assault
    investment_axis: [time, skill]
    reversible: true           # 스탠스(Vanguard/Rally/Split)는 습격 전 자유 재구성 가능
```

## 4. 확률형/상업형 배제 근거

EP-2(정수 등급)를 확률이 아닌 **추출 성과 결정론 함수**로 명시한 이유: 프로젝트 연구
경계(`.survey/abyssal-command-systems-expansion/solutions.md` §Categories "배제된 해결책")가
확률형 보상을 명시적으로 배제한다. Solo Leveling/Kingshot 원본에는 드롭률·확률형 소환 같은
요소가 존재하지만, 이는 구조적 참고 대상에서 제외하고 "성과 → 결정론적 결과"로만 이식한다.
[OBSERVED] `.survey/abyssal-command-systems-expansion/solutions.md` line 16 "배제된 해결책: …
확률형…".

## 5. 레인 경계 (director 스티칭용)

- **PMRewardBands**(`pm/lane-reward-bands.md`): 이 지도가 "어디서/무엇을 대가로" 투입이
  일어나는지를 정의한다면, PMRewardBands는 "역전 확률 상한·플레이스타일 패리티 세션 밴드"
  같은 **숫자 캡**을 정의한다. 교차점은 EP-5(스탯 분배)·EP-8(특성 선택) — 이 두 지점이
  grind-heavy 대 skill-heavy 플레이스타일 패리티가 실제로 갈리는 지점이므로, 두 레인 모두
  "formation power"를 공통 수렴 지표로 채택했다(IRC 합의).
- **PMForecast**(`pm/lane-forecast.md`): 이 지도는 트리거 **조건**만 정의하고, "몇 세션마다
  발생하는가"의 리듬/타이밍 예측은 PMForecast 소관이다. 이 지도의 트리거 열을 PMForecast가
  세션 리듬 모델의 입력으로 그대로 재사용할 수 있다.
- **DesignerRPGSystems**: §1의 인터페이스 가정 중 stat-alloc(`stat_point_per_level`,
  Echo Core)·gear-upgrade(`item_tier_table`, 5단계)·trait-select(`trait_pool_table`, 5슬롯/
  스테이지 2·4·6·8·10/pick-1-of-3)는 IRC로 확정됨(EP-5/EP-6/EP-8 갱신 완료). `skill_tree_node_costs`
  (EP-7)는 ack 범위 밖이라 미확정 — 실제 balance-sheet.md에 스킬트리가 없다면 EP-7 행을
  삭제해야 한다(다음 사이클 또는 director 병합 시점 액션 아이템).
- **DesignerCoreLoop**(`design/lane-coreloop.md`): 이 지도의 EP는 런 사이(between-run) 메타
  선택이고, DesignerCoreLoop는 런 내부(in-run) 루프 타이밍을 소유한다 — 겹치지 않는다.

## 6. 무상업 준수 확인

**본 문서 전체에서 화폐/결제/광고/프리미엄 재화/계정/확률형 뽑기 용어를 일절 사용하지
않았으며, main_constraint #3(무상업·no-commerce)을 완전히 준수한다.** 모든 "투입" 축은
시간·실력·주의로만 구성되고, 모든 "획득"은 플레이로만 도달 가능하다.

## Director 핸드오프 노트

가장 중요한 결정: **EP-4(포획 명부 슬롯)를 상업형 템플릿이라면 "슬롯 구매" 지점이 됐을
자리에, "기존 동료 은퇴 대가로 신규 동료 확보"라는 비가역 실력 판단으로 재설계했다.** 이는
`pm/revenue-map.md` 원본 템플릿에서 가장 화폐화 압력이 강했을 지점을 이 프로젝트에서 가장
전략적 깊이가 큰 지점으로 전환한 것이며, 동시에 EP-2(정수 등급 결정론화)와 함께 이 RPG
레이어 전체가 확률/구매 압력 없이도 Solo Leveling·Kingshot 수준의 성장 깊이를 낼 수 있다는
증거로 director가 다른 14개 레인을 병합할 때 최우선으로 참조해야 한다. 단, EP-4의 "은퇴"
메커니즘(영구 손실인지 재료 환원 보상이 있는지)은 DesignerRPGSystems·QA와 함께 다음
사이클에서 반드시 수치화해야 하는 미확정 항목이다.
