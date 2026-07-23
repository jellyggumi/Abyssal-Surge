# Lane: Core Loop — 조감 2.5D 카메라 팔로우 액션 RPG 레이어

- run-id: `20260723-solo-warden-rpg-concept`
- lane owner: `game-designer` (persona: `.claude/agents/game-designer.md`) — sub-lane **Core Loop & Combat Mechanics**
- sibling lanes (같은 스테이지 1, 겹치지 않는 facet): `DesignerWorldview` → `design/lane-worldview.md` (세계관/서사), `DesignerRPGSystems` → `design/lane-rpgsystems.md` (스탯/스킬/인벤토리/특성)
- 이 문서의 facet 경계: **코어 루프 구조, 조감 카메라와 전투 해상 방식의 상호작용, 동료→포메이션 전환의 배치/커맨드 메커닉, G7용 수치 루프 모델.** 세계관 명명·서사는 다루지 않는다(→ DesignerWorldview). 스탯/스킬/인벤토리/특성의 수치 산출 로직은 다루지 않는다(→ DesignerRPGSystems, 아래 §6에서 인터페이스만 가정).

## 0. 근거 자료 (인용)

- 제품 계약 원본: `docs/abyssal-command-defense-survivor-design.md` — "플레이어는 생존자를 이동시키고, 기본 전투는 자동으로 해결한다", "전장은 full-bleed 모바일 Canvas... 상태 정보와 조작은 가장자리 HUD에" [OBSERVED]
- 현재 동료 시뮬레이션 (`defense-run-simulation.js:170-194, 1401-1410`): `addCompanion`은 동료를 `run.commander.x/y`에 배치하고, 매 tick `companion.x = run.commander.x; companion.y = run.commander.y`로 커맨더 위치에 고정 스냅한다. 동료는 자기 사거리(`companion.range`, 4000-6000) 내 `orderedTargets` 1순위를 쿨다운마다 자동 발사한다. 포메이션·배치 개념은 현재 존재하지 않는다 — 3개 동료가 항상 완전히 겹친 한 점에서 발사한다. [OBSERVED]
- 적 타겟팅 (`defense-run-simulation.js:808-857`, `getTargetPosition`/`pressureTarget`): 모든 정책(`player-pursuit`, `resource-denial`, `elite-escort`, `low-hp-focus`, `flank`)이 반환하는 대상은 `run.commander` 또는 `run.gate`뿐이다. **동료는 현재 적의 유효 공격 대상이 아니다.** [OBSERVED] — §4에서 이 사실이 포메이션 설계에 미치는 제약을 명시한다.
- 렌더 투영 (`battle-visualizer.js:103-105` `project()`): 정규화된 좌표를 고정 뷰포트에 매핑하는 전장 전체 투영이며 카메라 팔로우/팬 로직이 없다. README는 현재 전투 화면을 "2.5D 아이소메트릭"으로 서술한다. [OBSERVED] — 조감 카메라는 기존과 다른 투영 축이다(브리프 제약 #6과 일치).
- 이동 벡터: `OCTANT_VECTORS` (`defense-catalog.js`)가 8방향 이산 이동을 이미 정의한다. [OBSERVED] — 포메이션 오프셋을 연속각이 아닌 8방향 이산값으로 설계할 근거.
- 결정론적 시뮬레이션 조건: `main_constraint #2` (production-brief.md) — 60Hz 결정론 분리, 오프라인 로컬 저장, 모바일 full-bleed + edge HUD, reduced-motion/비색상 신호. [OBSERVED]
- Kingshot 구조 원칙 (구조만 차용, 명칭/수치 비차용): exploration = 전열/후열 포메이션 + 저작 PvE, expedition = 필드 배치 포메이션 vs 타겟, 스카우팅 선행. (shared-reference-bundle.md §Source 2) [OBSERVED]

## 1. 핵심 결정: 조감 카메라 + 전투 해상 방식은 그대로 자동 해상 유지

**결정: 기본 공격과 타겟 선택은 계속 100% 자동 해상한다. 플레이어의 새 행위 주체성은 조준/락온이 아니라 "포메이션 스탠스"라는 상위 전략 레이어에 배치한다.**

근거를 `main_constraint #2`의 4개 항목에 각각 대응시켜 판정한다:

| 제약 #2 항목 | 수동 조준/락온 도입 시 | 자동 해상 유지 + 포메이션 스탠스 |
|---|---|---|
| 결정론적 60Hz 시뮬 / 렌더 분리 | 연속 아날로그 조준각·프레임 단위 타겟 커밋은 재현 입력 표면을 넓히고 프레임 종속 스무딩이 섞일 위험이 있다 | 스탠스 전환은 기존 `MOVE` 옥탄트 입력과 동일한 이산·tick-stamped 이벤트로 기록 가능 — 재현 표면 확장 없음 |
| 모바일 full-bleed Canvas + edge-only HUD | 가상 조이스틱/조준선 오버레이는 전장 위에 그려야 하므로 edge-only HUD 규칙과 직접 충돌하거나, 탭-타겟팅은 밀집 웨이브에서 손끝 정확도를 요구해 동일 규칙을 위반 위험 | 스탠스 전환은 edge HUD의 버튼/스와이프 1개로 완결 — 전장을 덮지 않음 |
| reduced-motion / 비색상 신호 | 조준 트래킹 이펙트·록온 인디케이터가 추가 시각 부하를 만들어 저감 모드와 정면 충돌 | 스탠스는 정적 아이콘 상태(현재 선택된 스탠스)로 표현 가능, 저감 모드에서도 동일하게 읽힘 |
| 오프라인 로컬 우선 저장 | 중립 | 중립 |

**결론: 4개 항목 중 3개가 수동 조준에 불리하고 1개는 중립 — 자동 해상 유지가 유일하게 전 항목을 통과한다.** 이는 새로운 발명이 아니라 `docs/abyssal-command-defense-survivor-design.md`가 이미 못박은 계약("기본 공격은 자동")을 조감 카메라 전환에도 불문에 부치지 않고 명시적으로 재확인하는 것이다.

카메라 자체는 시뮬레이션 좌표계(`ARENA` 24000×12000)를 바꾸지 않는다 — 뷰포트가 커맨더를 데드존/랙을 두고 따라가는 순수 렌더 어댑터 변경이며, 기존 투영 계약("투영 방식의 차이가 전투 결과·성장 제안·추출·캠페인 진행을 바꾸면 안 된다")을 만족한다. [INFERENCE — 구현은 ProgRenderArch 소관, 여기서는 설계 의도만 명시]

## 2. 포메이션: 동료를 "컬렉션 카운트"에서 "능동 배치·커맨드 대상"으로

### 2.1 현재 상태 대비 변경

현재: 최대 3기 로드아웃(`MAX_LOADOUT_SIZE = 3`)의 동료가 전원 커맨더 좌표에 겹쳐 스폰되고, 자체 사거리 내 자동 발사만 한다 — "배치"라는 개념이 없다.

신규: 3개 **포메이션 슬롯**을 도입한다. 각 슬롯은 커맨더 위치 + (스탠스, 이동 방향의 8방향 옥탄트)로 결정되는 오프셋 벡터를 갖는다. 슬롯-동료 매핑은 로드아웃 순서를 그대로 쓴다(동료 개별 AI 없음, 결정론 유지).

| 스탠스 | 오프셋 방향 | 오프셋 거리 | 대형 반경 | 주 효과 | 대응하는 적 유형 |
|---|---|---|---|---|---|
| 전열(Vanguard) | 이동 방향(facing) 전방, 좌우 분산 | 1,400유닛 | ±500유닛 | 동료가 커맨더보다 먼저 접근로에 들어가 웨이브에 조기 발사 — 커맨더 도달 전 교전 개시 | rusher, guardian (근접 압박형) |
| 포대(Turret) | facing 반대(후방) | 300유닛 | 300유닛(밀집) | 재배치 지연 최소화 → 커맨더 이동 중에도 3기 동시 사거리 유지, 지속 화력 최대화 | 단일 강적(정예/보스) 지속 딜링 |
| 분산(Split) | 좌/우 측면 + 후방중앙 | 2,000유닛(좌우), 300유닛(후방) | 최대 폭 9,000유닛(양 사거리 원 합산, 사거리 4,600-6,000 기준) | 측면 커버리지 확장, 광역 사거리 겹침 최소화 | flanker (policyId `flank`, 측면 접근 정책과 직접 대응) |

스탠스 전환은 edge HUD 단일 컨트롤(버튼/스와이프)로 이산 커맨드이며 **쿨다운 4초**를 둔다 [TARGET, rationale: 연타 남용 방지 + 웨이브 페이즈(§3 기준 12-21초) 내 최소 1회 이상 유의미한 전환이 가능한 하한값]. 오프셋 계산은 `OCTANT_VECTORS`와 동일한 8방향 이산 체계를 재사용해 연속각 보간을 요구하지 않는다 [INFERENCE — 구현 난이도를 낮추는 설계 의도, 최종 판단은 ProgFormationSim].

**스탠스 ↔ FRONT/BACK 슬롯 매핑 (제안, 디렉터 재가 필요):** `ProgFormationSim`이 독립적으로 `engineering/lane-formation-sim.md` §2에서 `FRONT`/`BACK` 슬롯(피격 가능성·후열 시너지 축, 최대 FRONT 2/총 3슬롯)을 제안했다. 이는 이 문서의 스탠스(포메이션 전체 위치 프리셋 축)와 다른 이름의 같은 축이 아니라 **서로 다른 레벨의 축**이다 — 스탠스가 "무엇을 선택하는가"라면 FRONT/BACK은 "그 선택이 어떤 슬롯 규칙(피격·시너지)을 적용받는가"다. 두 레인을 하나의 스키마로 합치는 가장 단순한 경로는 스탠스가 FRONT/BACK 배분을 결정론적으로 파생시키는 것이라고 제안한다:

| 스탠스 | 파생 FRONT 수 | 근거 |
|---|---|---|
| 전열(Vanguard) | 2 (`ProgFormationSim`의 `max_front: 2` 상한과 정확히 일치) | 전방 배치 의도와 직접 대응 |
| 포대(Turret) | 0 | 전원 커맨더 근접 밀집 — 피격 노출 최소화 의도와 일치 |
| 분산(Split) | 1 | 좌우 분산 중 1기만 전방 노출, 후방중앙 슬롯은 BACK — 두 극단 사이 균형점 |

이 매핑은 이 레인의 제안일 뿐이며, `ProgFormationSim`이 독립적으로 작성했으므로 최종 확정은 디렉터가 두 레인을 병합할 때 양측과 함께 재가해야 한다 — 침묵 속에 어느 한쪽이 임의로 채택하지 말 것.

### 2.2 동료 피격 가능성 — RESOLVED (ProgFormationSim 확인, 2026-07-23 IRC)

**설계 의도(이상형):** 전열 스탠스는 동료가 적의 유효 공격 대상이 되어 실제로 피해를 흡수해야 Kingshot의 "전열이 맞는다" 구조 원칙과 일치한다.

**작성 시점 시뮬레이션 사실:** `getTargetPosition`/`pressureTarget`는 당시 오직 `run.commander` 또는 `run.gate`만 반환했다 — 동료는 피격 불가였다. [OBSERVED, §0 인용]

**RESOLVED:** `ProgFormationSim`이 `engineering/lane-formation-sim.md` §4에서 이 요청에 답했다 — `FRONT` 슬롯 동료는 적 AI의 유효 타겟 후보가 되어(`getTargetPosition`/`pressureTarget` 확장), 런 스코프 한정 `DOWNED` 상태로 소모될 수 있다. `BACK` 슬롯은 현행대로 피격 불가 유지. 소모는 캠페인 영구 컬렉션에 도달하지 않는다(런 종료 시 리셋) — 이 결정이 `docs/abyssal-command-defense-survivor-design.md`의 영구성 계약과 충돌하지 않도록 `ProgFormationSim`이 별도로 검증했다. 이 레인이 §2.1 표에 기술한 스탠스별 "주 효과"(전열 조기교전, 포대 지속화력, 분산 측면커버리지)는 FRONT/BACK 구현 여부와 무관하게 위치·교전 타이밍만으로도 성립하므로, 이 RESOLVED는 코어 루프 확정을 소급 변경하지 않는다 — 다만 §2.1의 스탠스↔슬롯 매핑 제안이 추가되었다.

**후속 리스크 (`QAArchetypeTestPlan` PRED-09, S1, 2026-07-23 IRC):** DOWNED가 영구 손실로 이어지지 않는다는 위 RESOLVED 사실 자체가 새로운 착취 경로를 연다 — 방어 투자가 0인 동료를 FRONT에 세워 피해를 흡수시키는 것이 전략적으로 열등하지 않고 오히려 최적 선택이 될 수 있다(잃을 게 없으므로). 이는 이 문서가 §2.1에서 설계한 "구성이 화력보다 중요"라는 전열 스탠스의 의도를 훼손할 수 있는 **동료 방어 스탯 투자 전체의 무의미화** 리스크이며, turtle 아키타입에 국한되지 않고 스탯 시스템 전반에 영향을 준다. 이 문서의 소관을 벗어나는 두 가지 후속 결정이 필요하다: (a) `DesignerRPGSystems`가 방어 스탯 감소 스태킹 규칙을 확정할 때 "무투자 희생양" 경로가 여전히 우월한지 재검증, (b) 만약 그렇다면 DOWNED에 런 스코프 내 비용(예: 부활까지 대기시간, 복귀 시 일시적 화력 페널티)을 추가할지는 `ProgFormationSim`/디자인 팀의 상위 결정 — 이 문서는 문제를 여기 기록만 하고 해법을 선결하지 않는다.

## 3. 후보 코어 루프

두 후보를 제시한다. **후보 A를 G7 1차 제출(주 루프)로 권고**하고, 후보 B는 정예/보스 조우에 내포되는 2차(강화) 루프로 제시한다 — 브리프의 "1-2개 후보" 요구를 충족하며 둘 중 하나만 골라야 하는 상황이 아니다.

### 3.1 후보 A — Vanguard Circuit (주 루프, 웨이브 페이즈 심화)

기존 "이동 → 자동전투 → XP 임계값 → 스킬 선택" 루프를 대체하지 않고 심화한다. Kingshot의 exploration(전열/후열 포메이션 + 저작 PvE)을 조감 카메라 실시간 이동 위에 얹은 형태다.

행동 4가지(≥3 충족):
1. **이동** — 위험지대 회피, 픽업/오브젝티브 접근 (기존 유지)
2. **포메이션 스탠스 전환** — 전열/포대/분산 중 선택 (신규, §2.1)
3. **자동전투 소모** — 커맨더+동료 기본 공격 자동 해상, 스탠스가 위치·교전 타이밍만 변조 (기존 규칙 유지, §1)
4. **보상 확인** — XP 임계값 스킬 제안 선택 또는 웨이브 클리어 픽업 수령 (기존 유지)

보상 이벤트 2가지(≥1 충족):
- XP 임계값 → 런 전용 스킬 제안 (기존, `XP_GROWTH` 8단계)
- **포메이션 유지 보너스(신규)**: 하나의 스탠스를 한 웨이브 페이즈 동안 중단 없이 유지하면 동료 화력에 일시 보너스를 준다. 기존 `abyssal-banner` 보상이 이미 동료 전원에게 `damageBonus`를 일괄 적용하는 선례가 있어([OBSERVED] `defense-run-simulation.js:193`), 이 신규 보너스도 동일한 "동료 전원 일괄 수정자" 패턴을 재사용한다 — 새 데이터 구조를 요구하지 않는다. [TARGET]

### 3.2 후보 B — Formation Assault (내포 루프, 정예/보스 조우 전용)

Kingshot의 expedition(필드 배치 포메이션 vs 타겟, 스카우팅 선행)을 정예 처치→추출 및 보스전에 대응시킨다. 후보 A 루프 안에 중첩되며, 스테이지당 정예 1-2회 + 보스 1회 발생한다 — 후보 A를 대체하지 않는다.

행동 4가지:
1. **스카우트** — 정예 후보/보스 스폰 텔레그래프 확인 (기존 `eliteCandidate`/보스 스폰 이벤트의 시각적 노출을 강화)
2. **포메이션 커밋** — 해당 조우 전용으로 스탠스를 고정(락) — Kingshot expedition의 "출전 전 배치 확정"에 대응
3. **자동전투 해상** — §1과 동일 규칙, 스탠스로 변조
4. **결과 확인** — 추출 성공/스테이지 승리 + 스탠스 유지 보너스 조건부 수령

보상 이벤트: 추출/스테이지클리어 1회 보장 + 스탠스 유지 보너스 0-1회 조건부.

## 4. 수치 루프 모델 (G7 draft input)

```yaml
core_loop_candidates:
  - id: vanguard-circuit
    role: primary               # G7 제출 대상
    period_s: 60                # [TARGET] band 45-90, G7 요구 30-180 내
    period_rationale: >
      웨이브 페이즈 간격(gateTicks 720-1260틱=60Hz 기준 12-21초, defense-catalog.js STAGES)에
      웨이브 3파 + 스탠스 전환 여유를 더한 상한. 미구현 상태이므로 TARGET, Stage 2 QA
      playtest에서 실측 필요.
    actions_per_loop: 4         # 이동, 스탠스전환, 자동전투소모, 보상확인 — G7 요구 ≥3 충족
    reward_events_per_loop: 2   # XP임계값 스킬제안 + 포메이션유지보너스
    repeat_rate_proxy_target: 0.70   # G7 임계값과 동일값(하한, 열망치 아님) — 측정: qa/playtest-report.md
  - id: formation-assault
    role: nested-secondary      # 후보 A 안에 중첩, 단독 G7 제출 대상 아님
    period_s: 100               # [TARGET] band 70-160, 정예/보스 TTK에 종속(미측정)
    period_rationale: >
      기존 보스 스탯(BOSSES, defense-catalog.js) hp 40000-150000에 대한 TTK는 미측정.
      스카우트+커밋 오버헤드를 더한 잠정 상한.
    actions_per_loop: 4         # 스카우트, 포메이션커밋, 자동전투해상, 결과확인
    reward_events_per_loop: 1.5 # 추출/클리어 1회 보장 + 유지보너스 0-1회 조건부 (기대값)
    frequency_per_stage: "정예 1-2회 + 보스 1회"
```

## 5. 10-스테이지 구조: 변경/유지 명시

**그대로 유지:**
- 10개 스테이지 시퀀스·이름·순서(`Cinder Span` → ... → `Gate Zenith`), 보스 목록, `gateTicks`, 웨이브 배열, `XP_GROWTH` 8단계 — 전부 `defense-catalog.js`의 기존 값 그대로.
- 오브젝티브 페이즈 순서: `gate-defense → echo-recovery → growth → occupation → extraction → boss-kill` — 변경 없음.
- 런 전용 스킬 vs 영구 동료의 상태 분리 — 변경 없음. XP/레벨/스킬/현재 배치는 런 범위를 벗어나 보존하지 않는다는 규칙은 포메이션에도 동일 적용: **포메이션 스탠스 선택도 런 스코프 상태다** (배치 자체는 영구 진행이 아니다; 어떤 동료를 로드아웃에 넣을지는 기존처럼 영구지만, 런 중 스탠스는 매 런 초기화).
- 검증 verb chain: `hunt → extract → materialize → capture → assault` — 그대로 유지. "assault" 단계의 겉모습만 바뀐다(동료가 위치를 갖고 실행됨), 체인 자체는 재정의하지 않는다.
- 정예 처치→추출→영구 동료 해금 규칙 — 변경 없음.

**변경:**
- 카메라: 고정 전장 전체 투영(현재 "2.5D 아이소메트릭") → 조감 카메라 팔로우(커맨더를 데드존/랙으로 추적). 시뮬레이션 좌표계는 불변, 렌더 어댑터만 교체(§1).
- 동료: 커맨더 좌표 100% 스냅 → 3슬롯 포메이션(스탠스별 오프셋 벡터, §2.1). 신규 이산 입력 채널(스탠스 전환 커맨드)이 기존 `MOVE` 입력과 나란히 추가된다.
- 신규 보상 이벤트 타입(포메이션 유지 보너스) — 기존 보상 구조(스킬제안/동료추출/스테이지보상)를 대체하지 않고 추가.
- 정예/보스 조우 앞에 스카우트+포메이션커밋의 짧은 선행 비트(후보 B)가 붙는다 — 오브젝티브 페이즈 순서 자체는 바뀌지 않고 그 안에 내포된다.

## 6. RPG 시스템 인터페이스 — 명시적 가정

`DesignerRPGSystems`의 산출물을 기다리지 않기 위해 다음을 **가정(ASSUMPTION)**하며, 확인된 인터페이스 이름을 그대로 인용한다 (IRC 확인, 2026-07-23):

> **[ASSUMPTION]** `DesignerRPGSystems`는 동료 1기당 단일 스칼라값 "effective power"와 Dusk Warden용 "stat-modifier set"으로 수렴하는 산출물을 낸다. 이 레인은 포메이션 스탠스 효과(§2.1의 오프셋·교전 타이밍 변조)를 "effective power" 스칼라 자체를 바꾸지 않는 **위치 레이어 승수**로 취급한다 — 즉 RPG 시스템은 "얼마나 강한가"를 정하고, 포메이션은 "언제·어디서 그 힘이 적용되는가"만 정한다. 두 레이어를 직교로 유지해 어느 한쪽이 완성되지 않아도 다른 쪽이 진행 가능하다. `formation-power`(=포메이션 문맥에서 소비되는 실효값)는 `effective_power × stance_modifier`로 합성된다고 가정하며, 정확한 합성식은 `DesignerRPGSystems`/`ProgDataArch`의 최종 스키마에 따라 조정될 수 있다.

이 가정은 `PMRewardBands`/`PMEngagementMap`이 공유 수렴 지표로 채택한 "formation power" 용어와 일치한다(IRC 확인).

**합성 경계 명시 (`QARiskRegister` R3 대응):** `stance_modifier`는 `ProgDataArch`의 `deriveWardenRuntimeStats`/`deriveCompanionRuntimeStats` **내부에 들어가지 않는다고 가정한다** — 두 함수는 캐탈로그+영구진행 데이터에서 순수 스탯을 산출하는 레이어이며, 스탠스는 그 산출값과 무관한 런타임 위치 상태이기 때문이다. `stance_modifier`는 `ProgFormationSim`이 제안한 후열 시너지 배수(`back_row_damage_bonus_bp`, `engineering/lane-formation-sim.md` §2.3)와 동일한 레이어 — 즉 `fire()` 호출 직전 `companion.damage`(derive-fn 산출값)에 곱해지는 **fire-time 승수**로 적용된다고 가정한다. 따라서 R3의 교차-카테고리 캡(아이템×특성×포메이션)이 실제로 작동하려면 이 fire-time 승수 체인 전체(후열 시너지 × 스탠스 승수)를 포괄해야 한다 — derive-fn 산출값만 검사하면 두 승수를 놓친다. 최종 판정은 `ProgFormationSim`/`ProgDataArch`가 실제 승수 적용 지점을 확정한 뒤 필요.

**밸런스 리스크 인지 (`QARiskRegister` R2 대응):** 이 문서는 스탠스별 `stance_modifier`의 구체적 수치를 아직 확정하지 않았다 — §2.1은 정성적 효과만 기술한다. 3개 스탠스가 동일 콘텐츠를 비교 가능한 승률 범위 내에서 클리어하도록 캘리브레이션하는 것은 `design/balance-sheet.md`(Stage 2)의 책임이며, 이 문서는 그 캘리브레이션이 필요하다는 사실만 명시한다. 지배적 스탠스 1개로 수렴하면 §2.1의 "구성이 화력보다 중요"라는 의도 자체가 무효화되므로, G2/G3 게이트(승률 45-55%, ≥3 아키타입 독립 생존)를 스탠스 3종 모두에 대해 개별 검증해야 한다.

## 7. 다른 레인과의 경계

- `DesignerWorldview`와의 경계: 이 문서는 "전열/포대/분산" 같은 기능명만 쓴다. 세계관에 맞는 최종 명칭(한국어 플레이버 텍스트, 스탠스 고유명사)은 `DesignerWorldview`가 결정한다 — 이 문서의 이름은 자리표시자(placeholder)다.
- `ProgFormationSim`과의 경계 — 명명 충돌 해소 (IRC 확인, 2026-07-23): 원래 이 문서는 0-FRONT 스탠스를 "결집(Rally)"로 명명했으나, `ProgFormationSim`의 "Boss Rally Window"(보스 스폰 시 강제 표적 수렴 메커닉, `engineering/lane-formation-sim.md` §3, **FRONT ≥1 필요**)와 정면 충돌 — 동일 단어가 반대 조건(0 FRONT vs ≥1 FRONT)을 가리켜 디렉터 통합 문서와 플레이어 양쪽에 혼동을 유발할 것이라는 지적을 받아 **"포대(Turret)"로 개명**했다. "Rally"는 `ProgFormationSim`의 보스 조우 메커닉 전용 명칭으로 남긴다.
- `DesignerRPGSystems`와의 경계: §6에서 명시. 동료 특성(role: 탱커/딜러/힐러 등)이 스탠스와 상호작용해야 하는지(예: 힐러 역할 동료는 항상 후방 강제)는 이 문서가 정하지 않는다 — `DesignerRPGSystems`의 역할군 정의가 나오면 후속 조정 대상.
- `ProgFormationSim`과의 경계: §2.2에서 RESOLVED로 갱신 — "동료 피격 가능화"는 FRONT 슬롯에 한해 확인됨. 스탠스↔FRONT/BACK 매핑(§2.1)은 이 레인의 제안이며 `ProgFormationSim`의 최종 확정 대상. `stance_modifier`의 fire-time 합성 위치(§6)도 두 레인 합의 필요.
- `PMForecast`와의 경계 (IRC 확인, 2026-07-23): `PMForecast`의 "슬롯"(로드아웃 정원, 스테이지 3/7/9에 걸쳐 3→6으로 성장 제안)과 이 문서의 "포메이션 슬롯"(현재 정원 3 고정, `MAX_LOADOUT_SIZE` 관측값)은 **서로 다른 축**이다. 이 문서의 스탠스 오프셋 수학(§2.1, 전열/포대/분산 3-way 분배)은 정원 3 고정을 전제한다 — 로드아웃 성장이 채택되면 오프셋 계산을 정원 비의존(N-way)으로 일반화해야 한다. 미해결 종속성으로 디렉터 병합 시 명시적 처리 필요(양쪽 다 침묵 병합 금지로 기록).
- `ProgRenderArch`와의 경계: 조감 카메라 팔로우의 데드존/랙 수치, 실제 렌더 파이프라인 변경은 이 문서가 정하지 않는다 — §1은 카메라가 시뮬레이션 좌표를 바꾸지 않는다는 계약만 명시한다.

## 디렉터 핸드오프 노트

이 레인에서 가장 중요한 결정은 **"조감 카메라 전환에도 불구하고 기본 전투는 100% 자동 해상을 유지한다"**는 것이며, 이는 임의 선호가 아니라 `main_constraint #2`의 4개 항목(결정론·edge-HUD·reduced-motion·오프라인저장) 중 3개가 수동 조준에 명백히 불리하다는 §1의 대응표 판정에 근거한다. 플레이어 행위 주체성은 조준이 아니라 **포메이션 스탠스**(전열/포대/분산, 3슬롯, 8방향 이산 오프셋)로 이전되며, 이는 Kingshot의 전열/후열 구조 원칙을 조감 실시간 이동 위에 얹으면서도 기존 제품 계약을 한 글자도 어기지 않는다. §2.2의 "동료가 적의 유효 공격 대상이 될 수 있는가"는 이제 RESOLVED다 — `ProgFormationSim`이 FRONT 슬롯 한정으로 가능함을 확인했다. 원래 "결집(Rally)"으로 명명했던 0-FRONT 스탠스는 `ProgFormationSim`의 "Boss Rally Window"(FRONT≥1 요구)와 명명 충돌이 지적되어 **"포대(Turret)"로 개명**했다 — 두 레인의 "Rally"는 이제 서로 다른 대상(스탠스 vs 보스전 메커닉)을 가리키지 않는다. 디렉터가 병합 시 반드시 처리해야 할 **미해결 항목 3가지**: (1) 이 문서의 스탠스(Vanguard/Turret/Split) 축과 `ProgFormationSim`의 FRONT/BACK 슬롯 축을 하나의 스키마로 합칠지 — §2.1에 파생 매핑을 제안했으나 두 레인 중 누구도 최종 확정 권한이 없다; (2) 이 문서의 고정-3-슬롯 전제와 `PMForecast`의 3→6 로드아웃 성장 제안 사이의 충돌 — 채택 시 스탠스 오프셋 수학을 정원-비의존으로 재설계해야 한다; (3) **`QAArchetypeTestPlan`이 발견한 PRED-09(S1)** — DOWNED가 영구 손실 없이 런 종료 시 리셋된다는 사실이 "무투자 방어 희생양이 최적"이라는 착취 경로를 열어, 동료 방어 스탯 투자 전체를 무의미하게 만들 수 있다(§2.2 후속 리스크 참조) — 이는 스탯 시스템 전반의 문제이므로 `DesignerRPGSystems`의 방어 스태킹 규칙과 함께 재검증 필요. 세 항목 모두 코어 루프 자체(§3-4)의 확정을 막지 않는다 — 승수·슬롯 스키마·방어 밸런스 세부는 Stage 2에서 조정 가능한 하위 결정이다.
