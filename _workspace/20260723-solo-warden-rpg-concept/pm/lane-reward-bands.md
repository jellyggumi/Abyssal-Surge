# PM 레인 — 보상 밴드: 스킬-역전 & 플레이스타일 패리티 (Reward Bands, No-Commerce Reframe)

- role: `game-pm` (lane 1 of 3 — 형제 레인: `PMEngagementMap` = `pm/lane-engagement-map.md`(참여 지점 지도, WHERE), `PMForecast` = `pm/lane-forecast.md`(진행 리듬/세션 예측, WHEN))
- run-id: `20260723-solo-warden-rpg-concept`
- scope boundary: 이 레인은 **보상 밴드의 크기·상한값(WHAT/HOW MUCH)만** 다룬다 — 어느 상호작용 지점에서 투자가 발생하는지(참여 지점 레인), 그 투자가 캠페인 어느 시점에 리듬으로 배치되는지(예측 레인)는 다루지 않는다. 여기서 정한 숫자는 두 형제 레인이 참조할 단일 출처다.
- authority cited: `docs/abyssal-command-defense-survivor-design.md`(정예 처치→추출→영구 동료, 런 전용 스킬 리셋, Stage 10 캠페인 완료 — 원문 인용은 본문에서), `intake/production-brief.md`(no-commerce 재해석 지시), `intake/shared-reference-bundle.md`(Kingshot rally 구조 유사체, 스킬-역전/플레이스타일 패리티 용어 정의), `.claude/skills/game-studio-harness/references/quality-gates.md` G5, `.claude/skills/game-studio-harness/references/artifact-contract.md`(`pm/reward-bands.md` 스키마), `campaign-state.js`(`MAX_LOADOUT_SIZE=3`, `attemptsByStage` L20/L40 관측)

---

## 0. No-commerce 재해석 선언 (mandatory)

**[OBSERVED]** 이 프로젝트의 문서화된 연구 경계는 `intake/production-brief.md` main_constraint 3이 명시한 항목들(`.survey/abyssal-command-systems-expansion/` 경계 문서 참조)을 명시적으로 제외한다. 하니스의 `game-pm` 페르소나(`.claude/agents/game-pm.md`)는 원래 두 갈래 경로(외부 투입 경로 + 플레이 경로)를 전제로 한 보상 밴드 3종(일발역전/꾸준 보상/공정성)을 요구하지만, 이 사이클은 그 템플릿을 다음과 같이 재해석한다:

- 이중 경로 전제가 사라진다 — 이 레이어에는 오직 **플레이로 획득하는 단일 경로**만 존재한다. 원 템플릿이 요구하던 외부 투입 경로는 발생하지 않는다 — 구체 제외 항목은 `intake/production-brief.md` main_constraint 3 참조.
- "일발역전(반전 확률)" 개념은 **스킬-역전 순간(skill-comeback moment)**으로 대체된다 — 확률이 아니라 플레이어가 전투 중 실제로 수행한 행동으로 충전되는 결정론적 파워 스윙이다.
- "꾸준 보상 세션 밴드" + "공정성 상한"은 **플레이스타일 패리티(playstyle parity)** 하나로 통합된다 — 이중 경로가 없으므로 경로 간 격차 자체가 성립하지 않고, 대신 서로 다른 플레이 방식(그라인드형/스킬형/컴플리셔니스트형)이 같은 런 수 구간에서 얼마나 수렴하는지가 유일한 공정성 질문이 된다.

아래 섹션 1·2가 각각 이 두 개념의 구체 수치를 정의하고, 섹션 3이 이를 `pm/reward-bands.md` 계약과 동일한 shape의 YAML로 고정한다.

---

## 1. 스킬-역전 순간 (Skill-Comeback Moment) — "Full Rally"

### 1.1 메커니즘 정의

**[OBSERVED]** 기존 정예 추출 시스템은 정예 처치 후 추출에 성공하면 영구 동료를 해금하고(`docs/abyssal-command-defense-survivor-design.md` §런과 성장 3항), 현재 편성 슬롯은 `MAX_LOADOUT_SIZE=3`으로 고정되어 있다(`campaign-state.js` L20, L63, L151 — "Loadout must contain up to three owned canonical companions"). `intake/shared-reference-bundle.md`는 Kingshot의 rally 구조를 "다수 영구 동료가 하나의 습격 편성에 합류해 정예/보스에 맞서는" 구조적 유사체로 이미 제안했다(Source 2, Battle types 항목).

**[TARGET] 제안 메커니즘 — Full Rally**: Dusk Warden 전용 편성 오버라이드. 보스전 또는 정예 습격전 중 현재 편성 파워가 해당 스테이지의 설계 목표 파워보다 낮을 때만 발동 가능한, 해당 전투 한정의 일시적 편성 확장이다. 발동 시 평소의 3슬롯 상한을 넘어 그 순간 보유한 영구 동료 전원이 해당 전투 한정으로 합류한다(캠페인 영구 상태는 변경하지 않음 — 전투 종료 시 3슬롯 편성으로 복귀).

이것이 오직 플레이 행동만으로 획득되는 이유: 발동 자격이 **Rally 충전치(Rally Charge)**로 게이팅되고, 충전치는 오직 해당 런 내에서 스킬 있는 행동으로만 축적된다(런 종료 시 리셋 — 기존 런 전용 스킬과 동일한 상태 분리 원칙, `docs/abyssal-command-defense-survivor-design.md` §영구 동료와 런 전용 스킬은 별도 상태다).

| Rally Charge 획득원 | 충전량 | 근거 | 레이블 |
|---|---|---|---|
| 무피격 정예 추출 완수 | +1 | 추출 국면에서의 정밀 플레이 — 기존 추출 메커니즘(§0 인용)에 스킬 조건만 추가, 신규 시스템 발명 아님 | [TARGET] |
| 보스전 페이즈 1구간 무피격 통과 | +1 | 보스 페이즈 구조는 designer 코어루프 레인이 확정할 값이나, "무피격 구간"은 장르 공통 스킬 신호이므로 선제 제안 | [TARGET] |
| 회피/무피격 콤보 임계치 달성(임계치는 designer 밸런스 시트 종속) | +1 | 정밀 조작 보상 — 정확한 임계치는 `design/balance-sheet.md`가 확정할 전투 수치에 종속되므로 여기선 트리거 존재만 고정 | [TARGET], 값 종속 대기 |

- 최대 저장치: 3충전 (한 발동당 1충전 소비)
- 발동 상한: **보스/정예 습격전당 1회** — 원 템플릿의 "1 per match" 문구를 그대로 스킬 기반으로 계승
- 자격 조건: 현재 편성 파워 < 해당 스테이지 설계 목표 파워 (자격 미달 시 발동 버튼 자체가 비활성 — 우위 상태에서 추가 파워를 얹는 용도가 아님, 순수 역전 전용)

### 1.2 파워 스윙 상한 (핵심 수치)

**[TARGET]** `formation_power_swing_max_pct = 30` — 발동 1회당 편성 파워를 최대 30%p까지 끌어올릴 수 있다. 근거: 하니스 원 템플릿의 `reversal_probability_max: 0.30`(일발역전 확률 상한)를 확률에서 결정론적 크기로 옮긴 값이다. 원 시스템은 "30% 확률로 즉시 역전"이었지만, 이 시스템은 확률이 아니라 매 발동 100% 발생하는 대신 크기를 30%로 상한한다 — "가끔 크게 뒤집는다"에서 "항상 부분적으로만 뒤집는다"로 리스크 프로파일을 낮췄다.

**[TARGET]** 스윙은 정액이 아니라 **격차 해소형**이다: `swing = min(power_deficit_pct, 30)` — 목표 파워 대비 부족분을 최대 100% 메우되, 그 메움 자체가 30%p를 넘지 못한다. 근거: 이미 격차가 작은 플레이어에게 정액 30%를 얹으면 스킬-역전이 아니라 순수 파워 크리프가 된다. 격차가 클수록 더 크게(상한까지) 메우고, 격차가 작으면 그만큼만 메우는 편이 "역전"이라는 이름에 부합한다.

**[TARGET]** `swing_ceiling_pct_of_stage_power = 90` — Full Rally로도 편성 파워는 해당 스테이지 설계 목표 파워의 90%를 넘지 못하도록 이중 상한을 둔다. 근거: 30%p 스윙 자체는 발동 직전 파워가 낮을수록 절대치가 커질 수 있으므로, 스테이지 난이도를 무의미하게 만들지 않으려면 별도의 절대 천장이 필요하다 — 이는 QARiskRegister가 제안한 `cross_category_multiplier_ceiling=1.3`(R3, 아이템+특성+편성 중첩 상한)이 편성 파워 입력 자체를 이미 유한하게 묶어준다는 전제 위에서만 성립하는 값이다. 그 전제가 깨지면(무한 중첩 허용) 이 90% 천장도 재계산이 필요하다.

```yaml
# Full Rally — 스킬-역전 메커니즘 요약 (섹션 3의 skill_comeback 블록과 동일 값)
mechanic: full-rally
trigger: "boss 또는 elite 습격전, 현재 편성 파워 < 스테이지 설계 목표 파워"
charge_max: 3
charge_per_activation: 1
charge_sources: [elite-extraction-no-hit, boss-phase1-no-hit, dodge-combo-threshold]
formation_power_swing_max_pct: 30
gap_close_formula: "min(power_deficit_pct, 30)"
swing_ceiling_pct_of_stage_power: 90
activation_cap: "1 per boss/elite encounter"
resets: "per-run (기존 런 전용 스킬과 동일 상태 분리)"
label: TARGET
```

---

## 2. 플레이스타일 패리티 밴드 (Playstyle Parity)

### 2.1 세 플레이스타일 정의

`intake/shared-reference-bundle.md` §No-commerce reinterpretation이 지정한 3원형을 이 레이어의 구체 행동으로 번역한다:

| 플레이스타일 | 행동 패턴 | 편성 파워 도달 경로 |
|---|---|---|
| 그라인드형 | 런 반복 횟수를 늘려 동료 수집·소재 축적으로 파워를 쌓음. 런당 스킬 요구치는 낮음 | 물량(동료 수·장비 티어) 축적 |
| 스킬형 | 적은 런으로 고정밀 클리어·정예 무피격 추출을 반복해 Rally Charge와 상위 보상을 조기 확보 | 소수 정예 자원의 효율적 전환 |
| 컴플리셔니스트형 | 로스터 전종·스킬트리 전분기 해금을 목표로 폭넓게 진행 | 폭(보유 자산 다양성) — 개별 동료 성장은 상대적으로 얕을 수 있음 |

**[INFERENCE]** 세 유형이 동일한 잣대로 비교되려면 "총 보유 자산 합"이 아니라 "실제 전투에 투입 가능한 편성 파워"(현재 3슬롯 로드아웃 상한 내 최선 조합의 파워)를 수렴 지표로 써야 한다 — 그래야 컴플리셔니스트형이 폭넓게 얕은 동료를 많이 보유했다는 이유만으로 불리하게 측정되지 않는다. 이 지표의 정확한 산식(스탯·장비 티어·특성이 어떻게 합산/승산되는지)은 DesignerRPGSystems 레인의 출력(에코 코어 예산 ~40/캠페인, 장비 티어 배율 T1 1.0x~T5 2.2x, 특성 5슬롯)에 종속되며, 이 레인은 그 산식의 **최종 스칼라 값**만 소비한다 — 이 의존 관계를 negotiation-record 항목으로 Stage 2에 등록할 것을 권고한다.

### 2.2 수렴 구간 및 상한

**[TARGET]** `parity_run_band = [12, 18]` — 12~18회 런 구간에서 세 플레이스타일의 편성 파워 중앙값이 수렴해야 한다. 근거: 캠페인은 최소 10회 성공 런(스테이지 10개 × 보스 승리 1회씩)으로 완주되지만, 실패 재도전은 이미 상태 모델에 존재한다(`campaign-state.js` L40 `attemptsByStage` — 스테이지별 시도 횟수를 이미 추적). 12~18은 "10회 최소 완주 + 2~8회의 재도전/파밍"을 흡수하는 구간이며, 하니스 원 템플릿 기본값(10~20세션)의 하한을 캠페인 최소 런 수 위로 밀어 올린 값이다.

**[TARGET]** `parity_checkpoint_run = 15` — 밴드 중앙에 해당하는 단일 확인 지점. QARiskRegister가 제안한 `cumulative_power_multiplier_ceiling=1.6 by session 15`(R5)와 동일 지점으로 맞췄다 — 같은 체크포인트에서 "파워가 1.6배를 넘지 않는지"(QA 상한)와 "세 스타일이 서로 수렴했는지"(이 레인의 패리티)를 함께 측정할 수 있게 하기 위함이다.

**[TARGET]** `formation_power_delta_max_pct = 10` — parity_checkpoint_run 시점에서 세 플레이스타일 편성 파워 중앙값 간 최대 격차 10%p. 근거: 원 템플릿의 fairness 블록 승률 델타 상한값(5%p)을 파워 지표로 옮기며 여유폭을 넓혔다 — 승률 격차보다 파워 격차가 완주 가능성에 미치는 영향이 완만하므로(파워 격차가 있어도 스킬로 승률을 만회할 여지가 있음, 이는 섹션 1의 Full Rally가 정확히 그 만회 수단이다) 승률 지표보다 느슨한 상한을 둔다.

**[TARGET]** `winrate_delta_max_pp = 5` — 보스/정예 승률 기준 격차 상한은 원 템플릿 값을 그대로 유지한다. 근거: 이것은 실제 플레이 결과 지표이므로, 파워 산식이 무엇이든 최종 검증은 여기서 이뤄져야 한다 — QA 시뮬레이션이 측정할 진짜 판정선이다.

**⚠️ 단위 불일치 flag**: 이 레인은 "런(run)"을 1차 단위로 쓰지만, QARiskRegister R5는 "세션(session)"을 단위로 썼다. 하나의 세션에 여러 런이 들어갈 수 있어 두 단위는 자동으로 같지 않다 — PMForecast(세션 리듬 소유)와 QARiskRegister가 런↔세션 환산비를 확정해야 이 체크포인트가 실제로 동일 시점을 가리키는지 검증 가능하다. 이 레인은 이 불일치를 **미해결로 명시**하며 임의로 1:1 가정하지 않는다.

```yaml
# 플레이스타일 패리티 요약 (섹션 3의 playstyle_parity 블록과 동일 값)
archetypes: [grind-heavy, skill-heavy, completionist]
convergence_metric: "committed loadout formation power (best 3-slot combination), not total owned assets"
parity_run_band: [12, 18]
parity_checkpoint_run: 15
formation_power_delta_max_pct: 10
winrate_delta_max_pp: 5
unit_mismatch_flag: "run(this lane) vs session(QARiskRegister R5) — unresolved, needs PMForecast+QA reconciliation"
label: TARGET
```

---

## 3. G5 게이트 입력 — `reward-bands.md` 계약 재매핑 YAML

`artifact-contract.md`의 `reward-bands.md` shape(`comeback`/`steady`/`fairness` 3블록)을 이 사이클의 no-commerce 경계에 맞춰 재구성한다. 이중 경로 전제가 사라지므로 `steady`와 `fairness`는 하나의 `playstyle_parity` 블록으로 합쳐진다 — 원 템플릿이 "한쪽 경로가 다른 경로를 얼마나 늦게 따라잡는가"와 "한쪽 경로가 다른 쪽보다 얼마나 유리한가"를 별개 질문으로 뒀던 것은, 애초에 별도 경로가 있을 때만 의미가 있는 구분이기 때문이다.

```yaml
# pm/lane-reward-bands.md — G5 gate input (no-commerce reframe)
# run-id: 20260723-solo-warden-rpg-concept
skill_comeback:
  mechanic: full-rally
  formation_power_swing_max_pct: 30
  gap_close_formula: "min(power_deficit_pct, 30)"
  swing_ceiling_pct_of_stage_power: 90
  activation_cap: "1 per boss/elite encounter"
  charge_max: 3
  charge_sources: [elite-extraction-no-hit, boss-phase1-no-hit, dodge-combo-threshold]
  unlock_paths: [milestone]   # 원 템플릿의 이중 경로(외부 투입+마일스톤) 중 단일 경로만 존재
  eligibility: "current formation power < stage design-target power"
  resets: per-run
playstyle_parity:
  archetypes: [grind-heavy, skill-heavy, completionist]
  convergence_metric: "committed loadout formation power (best 3-slot combination)"
  parity_run_band: [12, 18]
  parity_checkpoint_run: 15
  formation_power_delta_max_pct: 10
  winrate_delta_max_pp: 5
  unit_mismatch_flag: "run vs QA's session unit — unresolved"
label: TARGET  # 전체 블록 — Stage 2 G5 심사 전 QA 시뮬레이션(qa/gate-measurements.md#g5)으로 검증 필요, 이 사이클은 DRAFT
```

---

## 4. 경계 메모 (director가 접합 시 참조)

- **PMEngagementMap과의 경계**: 이 레인은 편성 재구성·특성 배분 같은 참여 지점이 "얼마나 큰 보상 크기·상한"을 갖는지만 정한다. 그 지점들이 코어루프 어디에 위치하는지, 어떤 밸런스 수치를 건드리는지는 PMEngagementMap 소유다.
- **PMForecast와의 경계**: 이 레인은 WHAT/HOW MUCH(패리티 런 수, 스윙 상한)만 정한다. 그 런들이 실제 세션 몇 개에 걸쳐 배치되는지, 스테이지별로 언제 Warden 트리 티어·편성 슬롯이 열리는지는 PMForecast 소유 — 단, 섹션 2.2의 "런↔세션 단위 불일치"는 PMForecast가 반드시 해소해야 할 입력이다.
- **DesignerRPGSystems와의 경계**: 편성 파워의 정확한 산식(스탯+장비+특성이 어떻게 합산되는지)은 DesignerRPGSystems 소유. 이 레인은 그 산식의 출력 스칼라만 소비하며, 산식 자체를 제안하지 않는다.
- **QARiskRegister와의 경계**: R5(`cumulative_power_multiplier_ceiling=1.6 by session 15`)와 R3(`cross_category_multiplier_ceiling=1.3`)는 이 레인의 두 상한(swing_ceiling 90%, formation_power_delta 10%)이 유효하기 위한 전제 조건이다. QA가 최종 캘리브레이션에서 R3/R5 값을 바꾸면 이 레인의 상한도 함께 재검토해야 한다.
- **미해결 항목 (decide-later, 임의 확정 금지)**: (1) Rally Charge 획득 임계치(회피 콤보 수) — designer 밸런스 시트 확정 대기. (2) 런↔세션 환산비 — PMForecast+QA 협의 대기. (3) 스테이지별 "설계 목표 파워"의 실제 수열 — designer 밸런스 시트에 없으면 이 레인의 자격 조건(§1.1)과 스윙 계산(§1.2)이 검증 불가능(unverifiable) 상태로 남는다.

---

## Director Handoff Note

이 레인에서 가장 중요한 결정은 **"보상 밴드"를 확률(30% 반전 확률)에서 결정론적 격차 해소 공식(`min(power_deficit_pct, 30)`)으로 바꾼 것**이다 — 원 하니스 템플릿은 외부 투입 기반 경제 시스템을 전제로 "가끔 크게 뒤집는" 확률형 역전을 상정하지만, 이 프로젝트는 결정론적 60Hz 시뮬레이션(`docs/abyssal-command-defense-survivor-design.md` §시뮬레이션과 저장)을 핵심 계약으로 못 박고 있어 확률형 역전 자체가 엔진 철학과 부딪힌다. 스킬-역전을 "낮은 확률의 큰 보상"이 아니라 "항상 발동하지만 크기가 격차에 비례하고 상한이 있는" 방식으로 재설계한 것은 단순 재명명이 아니라 no-commerce 경계가 강제한 구조적 재설계이며, 디렉터가 통합 GDD를 쓸 때 이 레인의 두 YAML 블록(섹션 1.2 말미, 섹션 3)을 `qa/gate-measurements.md#g5` 측정 전까지 **DRAFT로 표기**하고 QARiskRegister의 R3/R5 상한이 확정되는 시점에 재검증 사이클을 한 번 더 예약해야 한다는 점을 놓치지 말아야 한다.
