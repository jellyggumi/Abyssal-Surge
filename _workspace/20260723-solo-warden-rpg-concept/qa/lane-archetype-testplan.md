# QA 레인 — 아키타입 로테이션 테스트 플랜 (Pre-Implementation)

```yaml
artifact_status: PRE_IMPLEMENTATION
note: "이 문서가 기술하는 RPG 레이어 시스템(포메이션/스탯/스킬트리/트레잇/인벤토리)은
       아직 구현되지 않았다. 아래 모든 수치·밴드는 TARGET(미측정 가설)이며,
       실제 빌드가 존재하기 전까지 qa/playtest-report.md, qa/exploit-register.md,
       qa/gate-measurements.md 에 실측값을 채울 수 없다."
stage: "Stage 1 concept brainstorm lane (game-studio-harness 3-lane QA 트랙 중 1개)"
targets_gate: "Stage 2 G2/G3/G5 측정 설계의 선행 산출물; Stage 1 자체에는 게이트 의무 없음"
lane_id: QAArchetypeTestPlan
sibling_qa_lanes: [QABenchmarkSurvey, QARiskRegister]
run_id: 20260723-solo-warden-rpg-concept
```

## 0. 상태 및 범위

**본 문서는 사전 구현(pre-implementation) 테스트 플랜이다.** 새 RPG 레이어(포메이션,
영구 스탯/스킬트리/트레잇, 동료 로스터)는 이번 Stage 1 브레인스톰 사이클에서 문서로만
존재하며, 실행 가능한 빌드는 없다. 이 문서는 "빌드가 머지되면 QA가 정확히 무엇을,
누구 기준으로, 무슨 밴드로 테스트할지"를 미리 고정해 두는 산출물이다.
`game-qa.md`의 아키타입 로테이션 책임(≥5개 아키타입, 각 세션마다 전략/결과/밴드 이탈
기록)을 이번 신규 레이어에 선적용한 것이며, 실제 `qa/playtest-report.md` /
`qa/exploit-register.md`는 구현 이후 이 플랜을 스크립트 삼아 채워진다.

이 문서에서 제안하는 밴드 수치(45–55% 승리/클리어율, ±15% TTK 허용, EV cap 1.3×,
10–20 세션 패리티)는 `quality-gates.md`의 하네스 기본값을 앵커로 삼은 것이며,
"Threshold provenance" 조항에 따라 디자이너가 장르별 override를 `design/balance-sheet.md
#band-overrides`에 제안하고 디렉터가 `production/decision-log.md`에 승인 기록을 남기기
전까지는 이 기본값이 유효한 것으로 간주한다.

## 1. 의존 관계 맵 (Dependency Map)

이 플랜의 모든 아키타입 행동(포메이션/스탯/트레잇 선택)과 밴드 수치는 아래 레인들의
산출물이 머지되어야 실측 가능해진다. 현재는 병렬 브레인스톰 단계라 서로 블로킹하지
않고, 각 항목에 의존 레인만 명시해 둔다.

> **용어 정렬 (2026-07-23, IRC broadcast 반영):** `DesignerCoreLoop`, `PMRewardBands`,
> `PMEngagementMap` 세 레인이 스탯/기어/스킬 레벨을 합산한 편성 강도 지표로 **"formation
> power"**라는 공용 용어에 수렴했다는 브로드캐스트를 받았다. 이 문서의 `micro_optimizer`
> 대비 상대 성능 지표(§4.7 `clear_rate_vs_diversified_formation_baseline`)는 그 공용
> 지표를 QA 측 승률/클리어율 비교로 소비하는 것이며, formation power 자체의 산출 방식은
> `DesignerRPGSystems`/`ProgDataArch`의 블랙박스 입력으로 취급해 세 레인과 동일한 경계를
> 따른다 — QA는 이 값을 재정의하지 않는다.

| 의존 대상 (현재 lane id) | 머지 후 정식 경로 (artifact-contract.md) | QA가 필요로 하는 것 |
|---|---|---|
| `DesignerCoreLoop` | `design/core-loop.md` (완료: `design/lane-coreloop.md`) | 인카운터 티어별 TTK 목표치(`ttk_target_s`), 루프 주기(30–180s), 액션/보상 이벤트 수 — 확정: 3슬롯 포메이션 스탠스 **전열(Vanguard)/결집(Rally)/분산(Split)**(전/후열이 아님), 스탠스 전환 쿨다운 4초, `formation_power = effective_power × stance_modifier` 합성식(ASSUMPTION), **RESOLVED**: FRONT 슬롯(최대 2/3)은 피격+DOWNED 가능(런 스코프 리셋), BACK은 피격 불가 — `ProgFormationSim` 확정, IRC 2026-07-23(§4.2 참조) |
| `DesignerRPGSystems` | `design/balance-sheet.md` (RPG 스탯/스킬/트레잇/인벤토리 시스템 확장 섹션) | 스탯 축 종류, 스킬트리 구조, 트레잇 풀, 아이템 등급 테이블 — "밴드가 무엇을 측정하는지"의 전제 |
| `ProgFormationSim` | `engineering/architecture-contract.md` (포메이션/전대 시뮬레이션 서브섹션) | 3슬롯 전열/결집/분산(Vanguard/Rally/Split) 스탠스별 오프셋 계산 로직, exploration/expedition/rally(보스 어썰트) 배틀 타입의 실제 승패 계산 로직. **확정**: FRONT<=2/3 피격+DOWNED(런 스코프), BACK 피격 불가. **미확인 잔여**: DOWNED 상태의 화력/부활 조건 세부 |
| `ProgDataArch` | `engineering/architecture-contract.md`, `engineering/resource-manifest.md` (완료: `engineering/lane-data-arch.md` — `WardenProgress.allocatedStats`/`equippedSkillNodeIds` + `CompanionRecord.statPoints`/`equipment`/`traits`, `deriveWardenRuntimeStats`/`deriveCompanionRuntimeStats` 순수함수, `EQUIPMENT_ITEMS` 카탈로그가 formation power 산출 스키마) | QA 세션에서 TTK/EV/세션 카운트/자원 산출률을 로그로 뽑을 수 있는 스크립터블 훅 — 스키마 확정, PRED-05 EV 시뮬레이션이 이 순수함수 위에서 조합공간을 전수 실행 가능 |
| `PMRewardBands` | `pm/reward-bands.md` | playstyle-parity 세션 밴드(10–20 세션 기본값의 RPG 레이어 재해석) |
| `PMEngagementMap` | `pm/revenue-map.md` (engagement point 재해석) | economy-greed 아키타입의 "자원 산출 vs 세션 투입" 공정성 기준 |
| `UIInfoArchitecture` / `UIHudLayout` | `ui/information-architecture.md`, `ui/hud-layout-spec.md` | 캐주얼/저APM 아키타입이 실제로 마주치는 기본 추천 포메이션·스탯 배분 UI |
| `DesignerWorldview` | `design/worldview.md` | 완주 수집형(completionist-collector) 아키타입이 언락하는 동료명/설정이 G1 세계관과 일치하는지 |

## 2. 형제 QA 레인과의 경계

- `QABenchmarkSurvey`는 Kingshot/Solo Leveling/RPG 장르 비교 게임에서 **밸런스 패턴·보상
  페이싱·실패 사례**를 뽑아 QA의 감각(threshold sensitivity)을 보정하는 입력 자료를 만든다.
  이 문서는 그 결과를 머지 후 감각 보정용 **입력**으로만 소비하며, 서베이 실행 자체는
  소유하지 않는다.
- `QARiskRegister`는 시스템 간(cross-system) 상단(top-down) 리스크 — 여러 시스템이
  동시에 상호작용할 때 생기는 구조적 위험 — 을 카탈로그화한다. 이 문서는 반대로
  **하단(bottom-up) 접근**을 취한다: "이 플레이어 타입이 이렇게 플레이하면 정확히
  무엇이 깨지는가"를 아키타입 단위로 좁혀서 기술한다. 두 문서가 같은 결함을 다른
  각도에서 발견할 수 있으나, 이 문서는 리스크를 시스템 조합으로 일반화하지 않고
  항상 특정 아키타입의 구체적 플레이 패턴에 묶어 둔다 — 디렉터가 머지할 때 중복이
  아니라 상호 참조로 읽어야 한다.

## 3. 아키타입 세트 (7개, 하네스 기본 5 + RPG 레이어 확장 2)

`game-qa.md` 기본 세트는 rusher/turtle/economy-greed/micro-optimizer/casual-low-APM/
whale-paid/F2P-grinder다. 이번 사이클은 **NO REAL-MONEY** 제약(생산 브리프 제약 3,
공유 레퍼런스 번들 "No-commerce reinterpretation")에 따라 **whale/paid와 F2P-grinder를
그대로 채택하지 않는다** — 유료/무료 분기가 존재하지 않으므로 두 아키타입이 측정하려던
"paid/free 승률 delta"는 애초에 성립하지 않는다. 대신 `PMRewardBands`가 소유한
playstyle-parity(grind-heavy vs skill-heavy vs completionist가 동일 세션 밴드 내
수렴하는지) 공정성 축으로 흡수시키고, economy-greed 아키타입이 grind-heavy 축을 대표하게
한다. 대신 이 RPG 레이어의 두 축 — Solo Leveling의 "단독 성장" 대 Kingshot의
"로스터/포메이션 구성" — 이 실제로 서로 경쟁하는지 검증하기 위해 두 개의 신규 아키타입
(completionist-collector, single-companion-main)을 추가한다. 합계 7개로 G3
(`≥5 아키타입 테스트` 요건)를 여유 있게 충족한다.

| # | 아키타입 | 페르소나 기본 세트 매핑 | 이 레이어에서의 역할 |
|---|---|---|---|
| 1 | Rusher | 기본 | 최소 투자로 최속 클리어 |
| 2 | Turtle | 기본 | 무손실 지향, 방어 스택 |
| 3 | Economy-greed | 기본 (grind-heavy 축 흡수) | 추출/자원 극대화 |
| 4 | Micro-optimizer | 기본 | EV 극대화 이론크래프팅 |
| 5 | Casual/low-APM | 기본 | 기본값 수용, 접근성 대표 |
| 6 | Completionist-collector | RPG 레이어 확장 | Kingshot 로스터 축 극단값 |
| 7 | Single-companion-main | RPG 레이어 확장 | Solo Leveling 단독성장 축 극단값 |

### G3 뷰어빌리티 사전 분류

G3는 "≥3개 아키타입이 서로 다른 전략으로 밴드 내 승률을 독립적으로 달성"할 것을
요구한다. 7개 전부가 "승률 최적화"를 목표로 하지 않으므로, 사전에 다음과 같이
분류해 둔다 — 실측 후 재분류 가능하나 초기 가설은 이렇다.

| 분류 | 아키타입 | 이유 |
|---|---|---|
| 승률 뷰어빌리티 후보 (G3 핵심 대상) | Rusher, Turtle, Micro-optimizer, Single-companion-main | 넷 다 "클리어를 목표로 서로 다른 전략을 쓴다" — G3가 원하는 정확한 비교군 |
| 커버리지 대상 (뷰어빌리티 축이 아닌 별도 축 검증) | Economy-greed, Casual/low-APM, Completionist-collector | 승률 최적화가 목적이 아니라 각각 자원 공정성 / 접근성 / 수집 완주성을 검증 — G3 통과 여부와 별개로 G4·G5·완주 페이싱에 기여 |

## 4. 아키타입별 상세

각 섹션: 정의 → 이 레이어에서의 구체적 포메이션/스탯/트레잇 선택 → 밴드(YAML) →
예상 익스플로잇 형태 → 의존 레인.

### 4.1 Rusher — 세션 코드명 "Gate Rush"

**정의.** 게이트/던전 콘텐츠를 최소 동료 투자로 최속 클리어한다. 편성(composition)
숙고에 시간을 쓰지 않고 순수 화력으로 밀어붙인다.

**행동.**
- 포메이션: 로드아웃에 동료를 1기 이하만 등록(신규 확정 모델에서 "포메이션 슬롯 비움"은
  스탠스 선택이 아니라 애초에 로드아웃에 동료를 적게 넣는 것과 동치 — `lane-coreloop.md`
  §2.1/§5 확인). 스탠스는 결집(Rally, 오프셋 300유닛, 재배치 지연 최소)을 기본으로 쓰되
  전환 자체에 신경 쓰지 않음 — 어떤 스탠스든 최속 클리어와 무관하다는 것이 이 아키타입의
  가설.
- 스탯: 공격/치명타 축에 올인, 방어·유틸 스탯은 0에 가깝게 방치.
- 트레잇/스킬: 단일 버스트 트레잇 체인만 선택, 생존 계열 트레잇은 전부 스킵.

```yaml
archetype: rusher
scenario_id: gate-rush
primary_metric: gate_clear_success_rate
band: [0.45, 0.55]
band_status: TARGET
band_source: "quality-gates.md G2 하네스 기본값; 실제 스테이지 난이도 커브는 DesignerCoreLoop 확정 후 재검증"
ttk_tolerance_pct: 15
ttk_baseline_source: "design/lane-coreloop.md#4 vanguard-circuit period_s=60(TARGET) — 최종 확정 시 갱신"
session_count_band: null  # 이 아키타입의 1차 지표는 승률/TTK, 세션 카운트 아님
```

**예상 익스플로잇 형태.** (a) 단일 공격 스탯 스택만으로 모든 인카운터 티어에서
TTK가 목표치보다 15% 초과로 짧아지는 "폭딜 빌드"가 존재 — 의도된 위험/보상 곡선을
무력화. (b) 로드아웃에 동료를 아예 넣지 않는 편(0기)이 3기 대비 승률/TTK 손해가
미미하게 판명 — 이 경우 Kingshot 축의 로스터 시스템이 rusher 전략 공간에서 완전히
무의미해진다는 뜻이므로, 단순 밸런스 이슈가 아니라 구조적 결함으로 취급. (c)
`formation_power = effective_power × stance_modifier` 합성식(lane-coreloop.md §6,
ASSUMPTION)이 실제로 채택되면, `stance_modifier`가 스탠스 무관하게 1에 수렴하는
구간이 있는지도 함께 확인 — 있다면 그 구간이 rusher의 "스탠스 무시" 전략을 정당화하는
근거가 된다.

**의존.** `DesignerCoreLoop`(TTK 목표, 확정: `lane-coreloop.md`), `ProgFormationSim`(0-1기
로드아웃이 실제로 허용되는지, `formation_power` 합성식 최종 확정), `DesignerRPGSystems`
(공격/치명타 스탯 곡선).

---

### 4.2 Turtle — 세션 코드명 "Iron Ward"

**정의.** 손실 회피를 최우선으로 한다. 느려도 지지 않는 것을 목표로 방어 스택을
극단으로 쌓는다.

> **설계 확정 반영 (`lane-coreloop.md` §2.2 RESOLVED, IRC 2026-07-23):** 이 아키타입의
> 원래 가설("탱커형 동료가 앞에서 대신 맞아준다")이 이제 구체 메카닉으로 확정됐다 —
> `ProgFormationSim` 확인: **FRONT 슬롯(3개 중 최대 2개)에 배치된 동료는 적의 유효
> 공격 대상이 되며 DOWNED 상태에 빠질 수 있다(런 스코프 한정 — 런 종료 시 리셋, 영구
> 손실 아님). BACK 슬롯은 기존과 동일하게 피격 불가.** 더 이상 조건부 가설이 아니라
> 확정 메카닉이므로, 아래 행동/밴드/익스플로잇을 이 구체 규칙 기준으로 서술한다.

**행동.**
- 포메이션: 동료 로드아웃 중 최소 1기(최대 2기)를 FRONT 슬롯에 배치해 피해 흡수
  역할을 맡기고, 나머지는 BACK(피격 불가)에 남긴다. 워든 자신은 FRONT 동료 뒤에서
  결집(Rally) 또는 분산(Split) 스탠스로 안전 거리 유지.
- 스탯: FRONT 배치 동료는 방어/체력/재생 축에 올인. BACK 동료·워든은 상대적으로
  공격 축 재배분 가능 — FRONT가 피해를 흡수하는 만큼 워든 자신의 생존 투자
  부담이 줄어드는 것이 이 아키타입의 핵심 가설.
- 트레잇/스킬: FRONT 동료는 재생·피해 감소 계열 트레잇 체인. 워든은 생존
  트레잇 최소치만 유지(FRONT 동료에게 위임).

```yaml
archetype: turtle
scenario_id: iron-ward
primary_metric: encounter_duration_multiplier_vs_ttk_target
band: [1.0, 1.15]   # TTK 목표치의 +15%를 넘지 않아야 함(과도한 스톨 방지)
band_status: TARGET
band_source: "quality-gates.md G2 TTK ±15% 허용치를 상한으로 재사용; turtle 특유의 '무한 방어' 리스크를 잡기 위한 QA 제안, DesignerCoreLoop 확정 필요"
death_risk_floor: "0이면 결함 — 완전 무적 루프는 액션 RPG 페이싱(Hades 비교급) 의도와 충돌"
slot_rule: "FRONT<=2/3(피격+DOWNED 가능, 런 스코프 리셋), BACK 피격 불가 — lane-coreloop.md §2.2 RESOLVED 반영"
```

**예상 익스플로잇 형태.** (a) FRONT 동료의 피해 감소가 곱연산으로 중첩되면 사실상
무적에 가까운 방어벽을 세워 TTK 상한(+15%)을 초과하는 무한 지연 전투를 만들어낸다 —
"이길 수는 있지만 끝나지 않는" 상태, TTK 밴드 위반이자 액션 RPG 템포 의도(정적
스톨이 아닌 동적 전투) 위반이라는 이중 결함. (b) **신규 — 무비용 육탄 방패
(zero-cost meat shield):** DOWNED가 런 스코프 한정(영구 손실 없음)이라는 규칙 자체가
구조적 허점이 될 수 있다 — FRONT 동료에게 방어 스탯을 전혀 투자하지 않고도(오히려
공격 스탯에 올인한 채로) 그냥 세워두는 것만으로 피해를 대신 흡수시키는 것이 항상
최적해가 될 위험이 있다. 이 경우 "방어 축 투자"라는 turtle 고유의 스탯 트레이드오프
자체가 무의미해지고, 모든 아키타입이 FRONT에 아무 투자 없는 동료를 하나 세워두는
것만으로 손실 회피를 공짜로 얻는 결과가 되므로 turtle만의 문제가 아니라 전체 스탯
시스템의 구조적 결함으로 격상 분류한다.

**의존.** `DesignerCoreLoop`(TTK 상한, 확정: `lane-coreloop.md`), `ProgFormationSim`
(FRONT/BACK 피격 규칙 확정: `lane-coreloop.md` §2.2 RESOLVED — DOWNED 상태의 정확한
효과 범위(예: DOWNED 중 해당 동료 화력 0인지, 부활 조건은 무엇인지)는 아직 미세부
확인 필요), `DesignerRPGSystems`(피해 감소 중첩 규칙 — 곱연산인지 가산인지가 (a)의
존재 여부를 결정; FRONT 무투자 동료가 유효한지 판단하려면 방어 스탯 0의 실제 생존
시간 곡선 필요).

---

### 4.3 Economy-greed — 세션 코드명 "Extraction Chaser"

**정의.** hunt → extract → materialize → capture → assault 체인 중 assault(보스전)를
최소화하고 extract/materialize/capture 반복으로 자원 산출을 극대화한다.

**행동.**
- 포메이션: 보스 대응력이 아니라 정예(elite) 반복 처치 효율에 맞춘 편성 — 보스급
  대응 포메이션은 투자하지 않음.
- 스탯: 생존 + 처치 속도의 균형(반복 가능성 우선), 버스트보다 지속 화력.
- 트레잇/스킬: 추출 수율(extraction-yield) 또는 자원화(materialize) 계열 트레잇이
  존재한다면 최우선 선택.

```yaml
archetype: economy-greed
scenario_id: extraction-chaser
primary_metric: resource_yield_per_session_minute
band: null   # PMEngagementMap / PMRewardBands 머지 전까지 미정 — QA는 측정 방법만 선정의
band_status: TARGET_PENDING
band_source: "PMEngagementMap의 engagement-point 재해석, PMRewardBands의 playstyle-parity 세션 밴드 확정 필요"
boundary_check: "no-background-combat / no-probabilistic-gacha / 세션당 단일 결정론적 정산(.survey/abyssal-command-systems-expansion 경계) 위반 여부 — 이 아키타입이 가장 먼저 이 경계를 건드릴 후보"
```

**예상 익스플로잇 형태.** 정예 파밍 루프가 반복 가능해지면서 세션당 투입 대비
스트롱홀드/로스터 자원 산출이 의도한 페이싱보다 과도하게 빨라지는 형태 — 특히
`.survey/abyssal-command-systems-expansion`이 명시적으로 배제한 "백그라운드 전투
시뮬레이션"이나 "확률적/가챠성 보상"으로 편법 유도되지 않는지가 이 아키타입 테스트의
핵심 체크포인트다. capture 단계가 세션당 단일 결정론적 정산 원칙을 우회하는 루프를
만들면 이는 밸런스 결함이 아니라 프로젝트 경계 위반(S1급)으로 즉시 상향 분류한다.

**의존.** `PMEngagementMap`, `PMRewardBands`, `DesignerRPGSystems`(추출 수율 트레잇
존재 여부), `ProgDataArch`(자원 산출 로그 훅).

---

### 4.4 Micro-optimizer — 세션 코드명 "Theorycrafter"

**정의.** 모든 스탯/스킬/트레잇/포메이션/장비 등급 조합의 기댓값(EV)을 계산해
최적해만 플레이한다. 패치마다 최적해를 재계산.

**행동.**
- 포메이션: 시뮬레이션상 최적으로 증명된 편성만 채택, 패치 후 즉시 재검증.
- 스탯: 인카운터 티어별로 정밀하게 min-max된 배분.
- 트레잇/스킬: 트레잇+스킬+장비등급 간 시너지 조합을 추적해 지배적(dominant) 조합을
  탐색.

```yaml
archetype: micro-optimizer
scenario_id: theorycrafter
primary_metric: combo_ev_vs_median
band: { max_multiplier: 1.3 }
band_status: TARGET
band_source: "quality-gates.md G2 combo-matrix EV cap(기존 유닛 전투용)을 스탯/스킬/트레잇/장비등급 조합 공간으로 확장 적용"
scope_note: "기존 balance-sheet.md의 EV cap은 유닛 전투 콤보 대상; 이 레이어는 신규 RPG 진행 축(스탯+스킬트리+트레잇+기어등급) 조합 공간에 동일 원칙을 최초 적용함 — DesignerRPGSystems가 조합 공간을 확정해야 실측 가능"
```

**예상 익스플로잇 형태.** 특정 스탯×스킬×트레잇×기어등급 조합의 실측 EV가
중앙값의 1.3배를 초과하는 "정답 빌드"를 발견 — 이 경우 다른 6개 아키타입의 선택이
전략적으로 무의미해지므로 G3(아키타입 다양성) 자체를 무너뜨리는 최우선순위 결함으로
취급.

**의존.** `DesignerRPGSystems`(전체 조합 공간 정의), `ProgDataArch`(EV 계산 가능한
시뮬레이션/스크립트 훅 — 페르소나의 Error Handling 조항대로, 이 훅이 없으면 QA는
수동 측정만 가능하고 신뢰도 저하 태그를 붙여야 한다).

---

### 4.5 Casual/low-APM — 세션 코드명 "Default Path"

**정의.** 포메이션/스탯 배분을 직접 조정하지 않고 UI가 제시하는 기본값·첫 번째
제안을 그대로 수용한다. 최적화가 아니라 서사/탐험/완주 자체를 목적으로 플레이.

**행동.**
- 포메이션: UI가 자동 추천하는 첫 편성을 그대로 사용(`UIInfoArchitecture` /
  `UIHudLayout`이 정의할 기본 추천 로직에 의존).
- 스탯: 자동 배분 기능이 있으면 그대로, 없으면 매번 첫 번째 제시 옵션을 선택.
- 트레잇/스킬: 비교 없이 첫 제시 옵션을 즉시 선택 — 기존 캠페인의 "런 전용 스킬
  제안 중 하나 선택" 패턴과 동일한 저숙고 방식.

```yaml
archetype: casual-low-apm
scenario_id: default-path
primary_metric: clear_success_rate_using_only_defaults
band: [0.40, 0.55]   # 접근성 하한을 45%보다 5%p 낮춰 제안 — 숙고 없는 플레이가 완전히 배제되지 않도록 하는 QA 제안 하한
band_status: TARGET
band_source: "QA 제안 — quality-gates.md G4 접근성 조항(reduced-motion parity 등)의 정신을 승률 축으로 확장; 최종 확정은 디자이너/디렉터"
```

**예상 익스플로잇 형태.** 이 아키타입의 "익스플로잇"은 의도적 악용이 아니라
역방향 발견이다: (a) 기본/자동 추천 경로가 우연히 전체 게임에서 가장 강력한 빌드로
드러나 사실상 모든 플레이어를 한 경로로만 유도하는 경우, 또는 (b) 기본 경로가
제안 하한(40%)보다 낮은 클리어율을 보여 저숙고 플레이어가 부당하게 불이익을 받는
경우 — 둘 다 QA가 이 아키타입 없이는 발견할 수 없는 공정성 결함이다.

**의존.** `UIInfoArchitecture`, `UIHudLayout`(기본 추천 로직의 실제 구현),
`DesignerRPGSystems`(자동 배분 알고리즘 존재 여부).

---

### 4.6 Completionist-collector — 세션 코드명 "Full Roster" (RPG 레이어 확장)

**정의.** 전투 효율보다 완주성을 목표로 한다: 추출 가능한 모든 동료 로스터 100%
해금, 모든 트레잇 조합 확인, 최대 아이템 등급 커버리지. Kingshot의 "로스터 다양성"
축을 극단까지 밀어붙이는 대조군.

**행동.**
- 포메이션: 매 세션 다른 동료 조합을 순환 배치해 각 동료를 개별적으로
  검증/해금 — 하나의 "최적 편성"에 정착하지 않음.
- 스탯: 한 동료에 집중하지 않고 로스터 전체에 얇게 분산 투자(단독성장 아키타입의
  정반대).
- 트레잇/스킬: 트레잇 최적화가 아니라 트레잇 다양성/완주를 추구.

```yaml
archetype: completionist-collector
scenario_id: full-roster
primary_metric: sessions_to_full_roster_completion
band: [20, 40]   # QA 제안 초기 가설: 핵심 클리어 패리티(10-20)보다 넓은 상한이 필요
band_status: TARGET_PENDING
band_source: "harness 기본 10-20 세션 패리티(pm/reward-bands.md 스키마)를 완주 축으로 확장한 QA 초기 가설; PMRewardBands 확정 시 override"
narrative_trace_requirement: "해금되는 각 동료명/설정은 design/worldview.md에 100% 추적 가능해야 함(G1 audit 대상)"
```

**예상 익스플로잇 형태.** 두 방향 모두 결함이다: (a) 특정 동료 또는 특정 아이템
등급이 구조적으로 영구 도달 불가능한 "완주 차단(dead-end)" — 이는 단순 밸런스가
아니라 완주형 플레이어에게는 치명적인 콘텐츠 결함(S1급 후보)이다. (b) 반대로 완주
루프를 의도된 세션 밴드보다 훨씬 빠르게 우회하는 경로가 존재해 로스터가 장기
리텐션 훅으로 기능하지 못하는 경우.

**의존.** `DesignerRPGSystems`(로스터 전체 크기, 해금 조건), `DesignerWorldview`(G1
추적성), `PMRewardBands`(완주 세션 밴드 확정), `ProgDataArch`(로스터 완주율 로그).

---

### 4.7 Single-companion-main — 세션 코드명 "Lone Bond" (RPG 레이어 확장)

**정의.** 이 사이클의 핵심 구조적 질문(main_question)을 아키타입으로 직접
검증하는 대조군이다: Solo Leveling 축("단독으로 유일하게 성장하는 주인공")과
Kingshot 축("로스터/포메이션 구성 전략 레이어")이 실제로 경쟁하는가, 아니면 하나가
다른 하나를 완전히 대체하는가? 이 아키타입은 자원 전부를 동료 1기 + 워든 페어링에만
쏟아붓고, 나머지 포메이션 슬롯은 캠페인 전체에서 의도적으로 비워 둔다.

**행동.**
- 포메이션: 로드아웃에 동료 1기만 등록(§4.1 Rusher와 동일한 "빈 슬롯=적은 로드아웃"
  모델, `lane-coreloop.md` §2.1/§5), 그 1기와 워든을 결집(Rally) 스탠스로 항상 밀착
  배치해 페어링 근접도를 최대화.
- 스탯: 추출 가능한 스탯/기어/트레잇 자원의 100%를 그 한 동료 + 워든 페어링에
  집중.
- 트레잇/스킬: 워든-동료 간 시너지(유대/bond형) 트레잇이 존재한다면 최우선
  선택 — 로스터 폭이 아니라 페어링 깊이를 극대화.

```yaml
archetype: single-companion-main
scenario_id: lone-bond
primary_metric: clear_rate_vs_diversified_formation_baseline   # formation power 상대비교(§0 용어 정렬 참조)의 승률 축 대리 지표
band: { relative_formation_power_vs_micro_optimizer: "<=1.0" }
band_status: TARGET
band_source: "QA 정의 — '단독성장 축이 편성 다양성 축을 능가하면 안 된다'는 구조적 가설; 실제 임계값은 DesignerRPGSystems가 두 축의 의도된 상대 강도를 명시해야 확정 가능"
formula_ref: "lane-coreloop.md §6 ASSUMPTION: formation_power = effective_power × stance_modifier. 1기 페어링의 effective_power(동료 1기분)가 다변화 편성의 effective_power(동료 최대 3기 합산) × stance_modifier를 능가하면 이 밴드 위반 — DesignerRPGSystems가 단독 동료의 effective_power 성장 곡선을 로스터 분산 대비 얼마나 가파르게 설계하는지가 관건"
structural_significance: "이 밴드가 깨지면 단순 수치 불균형이 아니라 Kingshot 축(main_question의 3개 축 중 하나) 전체가 장식적(decorative) 요소로 전락했다는 뜻 — 최고 심각도"
```

**예상 익스플로잇 형태.** 단독 동료 집중 투자가 micro-optimizer의 다변화 편성과
동등하거나 그 이상의 클리어율/TTK를 동일 세션 카운트에서 달성하는 경우 — 이는
포메이션 시스템 자체가 실질적으로 아무 역할도 하지 않는다는 구조적 증거이며,
개별 수치 조정으로 고칠 수 없는 설계 축 충돌이므로 발견 즉시 디자이너 3개
레인(특히 `DesignerRPGSystems`, `DesignerCoreLoop`) 전체에 브로드캐스트해야 한다.

**의존.** `DesignerRPGSystems`(단독 성장 곡선 vs 로스터 성장 곡선의 상대 강도 설계
의도 — `effective_power` 스케일링 규칙), `ProgFormationSim`(`formation_power` 합성식
최종 확정, 빈 슬롯이 페널티인지 중립인지의 실제 계산 로직).

## 5. 예상 익스플로잇 요약표 (계획 단계 — 실제 exploit-register.md 아님)

`qa/exploit-register.md` 스키마(`id | severity | archetype | repro steps |
measured value vs band | status | broadcast-at`)를 계획 단계용으로 변형한
사전 예측표. 빌드가 존재하면 이 행들이 실제 익스플로잇 레지스터의 시드가 된다.

| id | archetype | 예상 익스플로잇 형태 (요약) | 위반 예상 밴드 | 예상 심각도(S1–S4) | 실사 검증 방법(빌드 후) |
|---|---|---|---|---|---|
| PRED-01 | rusher | 단일 공격 스탯 스택이 전 티어 TTK를 -15% 초과 단축 | TTK ±15% | S2 | 스탯 상한까지 밀어넣은 rusher 세션 반복, TTK 로그 비교 |
| PRED-02 | rusher | 로드아웃 0-1기가 3기 대비 승률/TTK 손해 미미 → 로스터 시스템 무의미화 | (구조적, G3 다양성) | S1 | micro-optimizer 최적 편성과 rusher 0-1기 로드아웃의 EV 직접 비교 |
| PRED-03 | turtle | FRONT 동료 피해 감소 곱연산 중첩으로 사실상 무적 벽 형성, TTK 상한 초과 스톨 | TTK 상한 +15% | S2 (동료 투자 자체가 무의미해지는 2차 결함 동반 시 S1) | FRONT 배치 동료의 피해 감소 중첩이 곱연산인지 실측, 사망 확률 0 유지 시간 측정 |
| PRED-04 | economy-greed | 정예 파밍 루프가 세션당 자원 산출을 의도 페이싱보다 과도 가속 | playstyle-parity(PM 확정 전) | S1 (경계 위반 가능성) | 세션당 자원 산출률을 PM 밴드와 비교, 백그라운드/확률적 보상 우회 여부 확인 |
| PRED-05 | micro-optimizer | 스탯×스킬×트레잇×기어등급 조합 EV가 중앙값 1.3배 초과 | combo EV cap 1.3× | S1 (G3 전체 붕괴 위험) | `deriveWardenRuntimeStats`/`deriveCompanionRuntimeStats`(순수함수, `engineering/lane-data-arch.md`)로 전체 조합 공간 스크립트 시뮬레이션, 상위 5% 조합 EV 분포 확인 |
| PRED-06 | casual/low-APM | 기본 추천 경로가 우연히 최강 빌드이거나 승률 하한 미달 | clear-rate [0.40, 0.55] | S2 | 기본값만 사용한 세션 반복, 조작 없는 클리어율 측정 |
| PRED-07 | completionist-collector | 특정 동료/등급이 영구 도달 불가 (완주 차단 dead-end) | 완주 세션 밴드 [20,40] | S1 | 로스터 100% 시도 세션에서 해금 실패 항목 전수 조사 |
| PRED-08 | single-companion-main | 단독 페어링이 다변화 편성과 동등/그 이상 성능 | relative<=1.0 | S1 (구조 축 붕괴) | 동일 세션 카운트에서 lone-bond vs theorycrafter 클리어율/TTK 직접 비교 |
| PRED-09 | turtle | 무비용 육탄 방패: FRONT 슬롯 DOWNED가 런 스코프 리셋(영구 손실 없음)이라 방어 스탯 무투자 동료를 세워두는 것만으로 손실 회피 획득 — turtle 고유 스탯 트레이드오프 붕괴, 전체 스탯 시스템 결함으로 확장 가능. **교차 레인 확인(2026-07-23)**: `DesignerCoreLoop`가 자신의 §2.1 "구성 우선(전열 스탠스가 화력이 아닌 배치로 이기는 설계 의도)"을 위협하는 위험으로 인정, `lane-coreloop.md` §2.2 후속 리스크 + 핸드오프 노트 미해결 항목(3)에 이 PRED-09를 인용해 등재함 — 후속 결정은 `DesignerRPGSystems`(방어 중첩 규칙 재검증)와 `ProgFormationSim`(DOWNED에 런 내 비용 부여 여부)에 위임됨 | (구조적, 스탯 시스템 무결성) | S1 | FRONT에 방어 스탯 0(공격 올인) 동료를 세운 세션과 방어 올인 세션의 승률/TTK 직접 비교 — 유의미한 차이 없으면 결함 확정 |

## 6. 테스트 인프라 요청 (→ ProgDataArch)

`game-qa.md` Error Handling 조항("시뮬레이션 도구 부재 시 프로그래머에게 스크립터블
훅 요청, 수동 측정은 신뢰도 저하 태그 부착")에 따라 미리 요청해 둔다. 빌드 머지 시점에
아래 로그 훅이 없으면 위 9개 예측 항목은 수동 측정으로 강등되고 `confidence: reduced`
태그가 붙는다.

- 인카운터별 TTK 타임스탬프 로그 (rusher/turtle)
- 세션 단위 자원 산출량 로그 (economy-greed)
- 스탯/스킬/트레잇/기어등급 조합별 EV 계산 가능한 시뮬레이션 스크립트 진입점
  (micro-optimizer)
- 로스터 해금 상태 전수 조회 API (completionist-collector)
- 편성 슬롯 점유/공석 상태와 그에 따른 실제 전투 계산 분기 로그 (single-companion-main,
  rusher)

## 7. 디렉터 핸드오프 노트

이 플랜에서 가장 중요한 판단은 **completionist-collector와 single-companion-main을
하네스 기본 5개 아키타입에 추가한 것**이다 — 단순히 커버리지를 넓히기 위해서가 아니라,
이번 사이클의 main_question이 요구하는 "Solo Leveling의 단독성장 축과 Kingshot의
로스터/편성 축이 실제로 공존하는가"라는 질문에 승률 수치만으로는 답할 수 없기
때문이다. single-companion-main(PRED-08)이 밴드를 넘어서면 그것은 수치 밸런스
문제가 아니라 세 원천(Solo Leveling/Kingshot/로그라이크) 중 하나의 구조적 축이
장식으로 전락했다는 증거이며, 디자이너의 스탯 곡선 재조정만으로는 고칠 수 없고
`DesignerRPGSystems`와 `ProgFormationSim` 양쪽의 설계 의도 자체를 다시 맞춰야 한다.
디렉터는 이 두 아키타입(특히 PRED-08)을 Stage 2 G2/G3 게이트의 "구조 검증" 우선순위로
분류하고, `DesignerRPGSystems`가 단독 성장 곡선과 로스터 성장 곡선의 **상대 강도를
명시적으로 설계 의도로 기록**하도록 통합 GDD에 반영해 주기 바란다 — 그 의도 값이
없으면 이 문서의 PRED-08 밴드(`relative_formation_power_vs_micro_optimizer: "<=1.0"`)는
QA가 임의로 정한 가설로 남는다.
