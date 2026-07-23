# Balance Sheet — RPG Layer Numbers (G2 Input)

전체 수치 [TARGET] — Stage 2 QA 시뮬레이션 전까지 미검증. 스키마 결정: 동료는 스탯 배분 없이 **역할 패시브+장비+특성**으로만 성장 (§디렉터 결정, `UNIFIED-GDD.md` §3.3).

## Track A — Dusk Warden 전용 (자원: Echo Core, 캠페인 예산 40)

```yaml
system: dusk-warden-stat-block
stats:
  binding-might:      { per_point: "basicDamage += 15", max10: 150 }
  abyssal-resonance:  { per_point: "skillDamage *= 1.02", max10: "+20%" }
  echo-swiftness:     { per_point: "cooldown *= 0.995 (cap -5%)", max10: "-5%" }
  gate-resolve:       { per_point: "maxIntegrity += 20", max10: 200 }
  fracture-precision: { per_point: "critChanceBp += 100", max10: "+10pp" }
  reclaim-radius:     { per_point: "pickupRange += 150", max10: 1500 }
cost_curve: "ceil(n/2)+1"   # per_point_cost: [2,2,3,3,4,4,5,5,6,6], cumulative(10)=40
baseline: { basicDamage: 900, basicCooldown_ticks: 24, maxIntegrity: 1000, critChance: 0.15, critMult: 2.0, speed: 4100 }
label: TARGET
data_mirror: "defense-catalog.js COMMANDER 확장 예정 (미구현)"
---
system: dusk-warden-skill-tree
node_count: 5
nodes:
  echo-backlash:  { branch: attack-t1, prereq: [], cost: 5, effect: "10% 확률 추가타 basicDamage*0.5" }
  echo-cascade:   { branch: attack-t2, prereq: [echo-backlash], cost: 8, effect: "확률+15pp(25%), 배율+20pp(70%)" }
  wardens-ward:   { branch: survival-t1, prereq: [], cost: 5, effect: "내구30%이하 최초시 15%실드(런당1회)" }
  wardens-vigil:  { branch: survival-t2, prereq: [wardens-ward], cost: 8, effect: "내구50%이하시 초당0.5%재생" }
  echo-warden-awakening: { branch: capstone, prereq: [echo-cascade, wardens-vigil], cost: 15, effect: "dmg+10%,hp+10%,내구15%최초시 전스킬쿨다운초기화(런당1회)" }
total_cost_full_tree: 41   # 예산 40 초과 — 의도된 트레이드오프
coexists_with_run_scoped_skills: true   # 대체 아님, 동시 보유
label: TARGET
```

## Track B — 동료 (역할 패시브, 스탯 배분 없음)

```yaml
system: companion-roles
roles:
  vanguard: { members: [anchor-shard, veil-vanguard], passive: "자체내구+30%, 배치중 Commander피격-5%" }
  striker:  { members: [ember-cohort, rift-lens],     passive: "피해+20%, 보스/정예 대상+10%" }
  support:  { members: [throne-echo, dawnless-crown], passive: "Commander획득반경+10%, 스킬쿨다운-5%" }
label: TARGET
---
system: companion-equipment-tier
tiers: [{id: T1, name: Echo-Bound, mult: 1.00}, {id: T2, name: Umbral-Etched, mult: 1.15}, {id: T3, name: Void-Forged, mult: 1.35}, {id: T4, name: Abyss-Tempered, mult: 1.60}, {id: T5, name: Court-Sealed, mult: 2.00}]
slots: [weapon, ward, trinket]   # weapon->damage, ward->formationIntegrity(아래), trinket->range — lane-rpgsystems.md §4.3 원 설계, balance-sheet.md 합성 시 누락됐던 슬롯-스탯 매핑을 D7b 계기로 복원
currency: bound-fragment
campaign_budget: 10   # 슬롯 1개만 T5 완전 도달 가능
cost_by_step: { "T1->T2": 1, "T2->T3": 2, "T3->T4": 3, "T4->T5": 4 }
label: TARGET
```

```yaml
system: companion-formation-integrity   # D7b(production/decision-log.md) — PRED-09 무비용 육탄방패 완화 레버
formula: "formationIntegrity = companion.damage(defense-catalog.js COMPANIONS) * 8 * wardSlotTierMultiplier"
ward_tier_multiplier_source: "companion-equipment-tier(위)의 동일 5티어 배율(T1=1.00~T5=2.00) — ward 슬롯 장착 등급 그대로 재사용, 신규 배율표 아님"
example_t1_undinvested: "ember-cohort: 420*8*1.00 = 3360"
example_t5_fully_invested: "ember-cohort: 420*8*2.00 = 6720 (2배 생존)"
design_intent: "무투자(T1 고정)와 완전투자(T5)의 생존시간 격차를 명시적 수치로 만들어, 방어 무투자가 항상 최적해라는 PRED-09 결함에 실제 비용을 부과 — 완전 해소 주장 아님, Stage2 시뮬레이션으로 버스트딜 전략과의 우열 검증 필요"
axis_note: "이 스탯은 생존(얼마나 버티는가)이며, R3/D6b의 fire-time 승수 체인(effectiveDamage, 얼마나 세게 때리는가)과는 직교하는 별도 축 — R3 1.3x 상한 계산에 포함되지 않음"
label: TARGET
```

## Warden 특성 8종 (스테이지 2/4/6/8/10, 3택1)

| ID | 효과 | 트레이드오프 |
|---|---|---|
| first-strike | 런 첫 공격 +100%(1회) | 후반 무영향 |
| desperate-echo | 내구25%↓시 dmg+30% | gate-resolve 저투자와 상충 |
| reckless-reclaim | 획득반경+40%, 피격+10% | 속도 vs 생존 |
| gate-keeper | hp+15%, dmg-8% | 탱키 vs 순딜 |
| chain-reaction | 처치마다 dmg+3%(최대5중첩) | 물량전 강함/단일강적 약함 |
| elite-hunter | 정예/보스+20%, 잡몹-10% | 보스러시 vs 웨이브클리어 |
| companions-wardpact | 동료dmg+12%, 동료사거리-10% | 근접특화 vs 카이팅 |
| echo-overflow | 쿨다운-15%, 스킬dmg-10% | 스팸 vs 강타 |

## G2 밴드 (전체 시스템 공통)

```yaml
win_rate_band: [0.45, 0.55]  # DEPRECATED — 2인용 PvP 전제, PvE 캠페인에 부적용. `#band-overrides` 참조 (D15)
ttk_target_s: 11.2          # 기준 계산: S1 보스 hp40000 기준
ttk_tolerance: 0.15
combo_ev_cap_vs_median: 1.3
enforcement_scope: "derive-fn(아이템+특성, 가산) + fire-time 스탠스승수(편성, 곱연산) 전체 체인 — 단일 레이어 상한은 불충분 (R3, qa/lane-risk-register.md)"
label: TARGET
```

## G2 밴드 오버라이드 (D15, `production/decision-log.md#d15` 승인) {#band-overrides}

PvE 단일 플레이어 캠페인에는 `win_rate_band`가 적용되지 않는다(위 DEPRECATED 표기). 대체 방법론: `qa/lane-archetype-testplan.md`가 설계한 아키타입별 개별 밴드를 공식 G2 판정 기준으로 채택. `ttk_target_s: 11.2`(±15%)는 스코프 변경 없음 — 원래도 Stage 1(보스 HP 40,000) 전용 타깃이었고 그대로 유효.

```yaml
system: g2-band-overrides
approved_by: game-production-director
decision_ref: "production/decision-log.md#D15"
clear_rate_metric: "win_rate 대체 — 캠페인 완주 여부(FINAL_COMPLETION 도달), 단일 밴드 없음(아키타입별 목표가 상이)"
per_archetype_bands:
  rusher_vs_micro_optimizer:
    metric: "TTK 상호 비율(둘 중 느린 쪽/빠른 쪽)"
    cap: 1.3
    measured_cycle2: "10스테이지 중 9개 이내, glass-necropolis 1.326×(노이즈 범위, 조치 불요)"
  turtle:
    metric: "TTK 비율(turtle / rusher-microopt 평균)"
    band: [1.0, 1.15]
    band_status: TARGET_UNVALIDATED_BY_DESIGNER
    measured_cycle2: "10스테이지 중 7개 위반(1.160×~1.574×, 후반 악화) — qa/evidence-cycle2/g2-progression-ttk-verdict.json 참조. 원인은 QA 정책의 스탯 우선순위(데미지 스탯 미투자), 게임 수치 자체의 결함으로 미확정. 리튠 불요(D15 판정 2), 다음 디자인 반복 입력으로 이월."
  single_companion_main:
    metric: "TTK 비율(single-companion-main / micro-optimizer)"
    band: { min: 1.0, note: "TTK-비율 메트릭이므로 준수 방향은 >=1.0(단독편성이 다변화 편성보다 느려야 정상). min:1.0 위반=이 값이 1.0 미만(단독편성이 더 빠름=구조 결함)." }
    measured_cycle2: "10스테이지 전부 만족(1.018×~1.695×, 항상 micro-optimizer보다 느림) — PRED-08 스테이지 단위 재확인"
  economy_greed_casual_completionist_collector:
    metric: "커버리지 축(자원공정성/접근성/완주성) — TTK 밴드 게이팅 대상 아님"
    band_status: "qa/lane-archetype-testplan.md §3 분류 그대로 유지"
label: CONFIRMED
```

## 전체 영구 파워 예산 거버넌스 (D6 해소, R1/R3/R5 통합 — `UNIFIED-GDD.md` §9.1 상세)

```yaml
system: total-permanent-power-governance
shared_computation_chain: "deriveWardenRuntimeStats()/deriveCompanionRuntimeStats() 가산 출력 -> fire-time stance_modifier 곱연산 -> 최종 effectiveDamage/effectiveStats"
enforcement_binding: "R1/R3/R5 세 상한 전부 fire-time 이후 최종값에 대해 측정 — derive-fn 출력만 검사하는 단일 레이어 상한은 불충분(D6 확정)"
r1_warden_capacity_ceiling: { ceiling_pct_of_stage_power_budget: 20, label: TARGET }
r3_combo_dominance_ceiling: { cross_category_multiplier_ceiling: 1.3, baseline: "run-scoped-skill-only power", label: TARGET }
r5_session_growth_ceiling: { cumulative_power_multiplier_ceiling: 1.6, ceiling_reached_by_session: 15, label: TARGET }
set_adjustment_rule: "세 상한 중 하나만 조정 금지 — 동일 계산 체인을 다른 절단면(축/스냅샷/시간)으로 측정하므로 세트로만 재검토"
label: TARGET — Stage2 QA 시뮬레이션 전까지 DRAFT
```

## 저지선 구역 (Kingshot 방어 축 이식, hub 레이어 전용)

```yaml
system: undertow-encroachment
scope: "Farwatch Hold hub 레이어 전용 — run 시뮬레이션(defense-run-simulation.js)에 관여하지 않음, R3 fire-time 승수 체인과 무관"
derived_ward_level: "resolvedIds.length + floor(companionCollection.length / 2)"
pressure_per_hour: 1
pressure_cap: 8   # IDLE_RETURN_MAX_ELAPSED_MS(8h) 재사용
outcome_rule: "pressure > wardLevel -> ENCROACHED (idleReturn.totalProgress 해당 elapsedMs 구간 몰수/forfeit, settleIdleReturn() NO_COMPLETED_STAGES 관용구 재사용, 소급지급 아님) / else HELD"
recovery_trigger: "다음 스테이지 승리 시 자동 HELD"
new_currency: false
reused_functions: ["settleIdleReturn() 확장 제안"]
data_mirror: "campaign-state.js — 미구현, 문서만"
label: TARGET
```

## 자원 예산 상한 = 안티-지배빌드 장치

Echo Core(40) + 스킬트리(41) + Bound Fragment(10) 세 상수가 예산과 거의 정확히 일치하도록 **의도적** 설계 — "전체 만렙 지배빌드"를 산술로 원천 차단. 세 상수는 세트로만 조정.

전체 근거: `design/lane-rpgsystems.md`, `qa/lane-risk-register.md`. 통합본: `design/UNIFIED-GDD.md` §3, §9.
