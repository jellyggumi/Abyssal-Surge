# Abyssal Surge — Solo Warden RPG 레이어 통합 기획서 (Stage 1 Concept GDD)

run-id: `20260723-solo-warden-rpg-concept` · 작성: game-production-director (15개 브레인스톰 레인 종합)
상태: **Stage 1 Concept — 문서 확정, 코드 미구현.** 모든 수치는 [TARGET](미측정 설계 목표) 또는 [INFERENCE](추론)이며, [OBSERVED]만 기존 코드/문서에서 직접 확인된 사실이다.
원본 레인: `design/lane-*.md`, `pm/lane-*.md`, `engineering/lane-*.md`, `qa/lane-*.md`, `ui/lane-*.md` (15개 파일, 상세 근거는 각 레인 참조)

---

## 0. 제품 정의와 포지셔닝

**Abyssal Surge**에 이미 배포된 "Abyssal Command" 디펜스 서바이버(모바일 우선, 자동전투, 10스테이지, 정예 추출→영구 동료) 위에 얹는 **RPG 심화 레이어**다. 기존 제품 계약(`docs/abyssal-command-defense-survivor-design.md`)을 대체하지 않고 확장하며, 다음 세 원천의 구조적 원칙을 독자적 콘텐츠로 이식한다 — 이름·수치·UI·아트는 전혀 차용하지 않는다:

| 원천 | 이식하는 구조 원칙 | 이식하지 않는 것 |
|---|---|---|
| Solo Leveling (구조만) | 다수는 관습적으로 성장하지만 단 한 명(주인공)만 비밀 통로로 고유하게 영구 성장 | 등장인물명, 등급문자 체계, 그림자 소환 명칭 |
| Kingshot (구조만) | 거점 성장 + **거점 방어(Undertow 압력 정산, §1.4)** + 영웅 로스터 + 편성(전열/후열) 기반 전투 + 랠리(합공) | 영웅명, 정확한 수치표, 동맹(실시간 PvP) — **BOUNDARY로 명시 배제** |
| 롤플레잉 게임 장르 어휘 | 스탯/인벤토리/스킬트리/아이템 등급/역할군/로그라이크 영구-런 이원 구조 | 특정 게임의 구체 수치 |

**변경 없음(캐논 보존)**: Dusk Warden(주인공), Echo Deep, Moonless Court, Gate Zenith, 10스테이지 순서·이름·승패 조건, hunt→extract→materialize→capture→assault 동사 체인, 결정론적 60Hz 시뮬레이션, 오프라인 로컬 저장, 모바일 full-bleed Canvas + edge-only HUD, 무과금(실화폐 결제/광고/프리미엄 재화/계정/가챠 전면 금지).

**신규**: Dusk Warden 전용 영구 성장(3번째 영구 상태 버킷), 동료 진형 배치(3슬롯 고정, 전열/후열), 장비/특성 인벤토리, 조감 2.5D 카메라-팔로우, 셀셰이딩 애니메 화풍, Farwatch Hold(런 사이 영구 거점).

---

## 1. 세계관 확장 (근거: `design/lane-worldview.md`)

### 1.1 핵심 인과관계 — "왜 Dusk Warden만 다르게 성장하는가"

Stage 10 Gate Zenith에서 Moonless Court의 명령망이 끊긴 지점이 하필 Dusk Warden이 서 있던 자리였고, 그 절단면에서 Dusk Warden만 Echo Deep의 잔향을 여과 없이 직접 받아들이는 흔적(**Deepmark**)을 얻었다. 다른 모든 Warden(**Warden Corps** 소속)은 Court의 배급 체계(**Ration Sigil**)를 통해 여과된 잔향만 배급받아 관습적으로 성장한다. 이 설명은 기존 승리 대사("Moonless Court의 명령망이 끊겼다... Echo Deep은 남는다")를 재해석이 아니라 **후속 서사로 확장**한다 — 기존 문구는 1글자도 바꾸지 않는다.

**중요**: 다른 Warden(Warden Corps)은 세계 텍스처(NPC)이며 동료화 리크루트 로스터가 아니다. 동료는 지금처럼 정예 처치 후 추출로만 얻는다.

### 1.2 신규 고유명사 (전부 ORIGINAL, 3개 소스 원문 대조 확인 완료)

| 고유명사 | 유형 | 정의 |
|---|---|---|
| **Warden Corps** | 진영 | "Warden" 직함이 속한 제도 조직. Ration Sigil로 관습적 성장 |
| **Ration Sigil** | 유물 | Court 배급 잔향의 양·등급을 정하는 인장 |
| **Deepmark** | 유물 | Gate Zenith 절단면에 새겨진 흔적. Dusk Warden 고유 성장의 유일한 인월드 장치 |
| **Farwatch Hold** | 장소 | Echo Deep 경계의 전초 거점. 런 사이 플레이어가 키우는 영구 레이어 (스테이지 아님). 5번째 기능구역 "저지선"이 §1.4의 방어 메커닉을 소유 |
| **Undertow** | 현상 | Echo Deep에서 계속 밀려오는 심층 잔향 흐름. §1.4에서 결정론적 압력 정산으로 기계화(Kingshot "거점 방어" 구조 이식) |

### 1.3 동사 체인 추적성

모든 신규 로어 비트는 hunt→extract→materialize→capture→assault 중 최소 하나에 연결된다(감사표는 `lane-worldview.md` §5). 경쟁하는 별도 세계관 축은 도입하지 않았다.

### 1.4 저지선 구역 — Kingshot 방어 축 이식 (결정론적 압력 정산)

**배경**: 초기 킹샷 리서치 요약(`intake/shared-reference-bundle.md`)이 "거점 성장" 축만 기록하고 킹샷의 "거점 방어(Defend Against Invasions)" 축을 빠뜨렸다(발견: 사용자 지적 + QA벤치마크 레인의 독립 공식소스 확인). 킹샷 원본은 오프라인 실시간 침공이지만, 이는 프로젝트의 기존 경계(백그라운드 전투 시뮬레이션 금지)와 충돌하므로 **압력 정산**으로 재해석한다.

**메커니즘**: 기존 `settleIdleReturn()`(`campaign-state.js`)과 동일한 단일 함수 정산 패턴 재사용, 신규 화폐·백그라운드 시뮬레이션 없음.

```yaml
system: undertow-encroachment
derived_ward_level: "resolvedIds.length + floor(companionCollection.length / 2)"   # 자동 파생, 별도 투자자원 불필요
pressure_formula: "min(floor(elapsedMs / (60 * IDLE_RETURN_INTERVAL_MS)), 8)"      # 1시간당 1압력, 상한 8 (기존 8시간 idle 상한 재사용)
outcome: "pressure > wardLevel ? ENCROACHED : HELD"
encroached_effect: "idleReturn.totalProgress 해당 elapsedMs 구간 몰수(forfeit, NO_COMPLETED_STAGES 분기와 동일 관용구) — 소급지급 아님, 동료/장비/영구성장은 손실 없음"
recovery: "다음 스테이지 승리 시 자동 HELD 복귀"
label: TARGET
```

**설계 의도**: 초반(wardLevel낮음)엔 조기 ENCROACHED로 메커닉 존재를 학습시키되 적립 진행도가 없어 실질 손해 0. 완주에 가까워질수록(wardLevel≥8) 영구 면역 — "자리잡은 거점은 함락되지 않는다". 예산 40/41/10 세트, fire-time 승수 체인(§9 R3) 어디에도 관여하지 않음 — 순수 hub-레이어 부가 시스템.

전체 근거: `design/worldview.md` 추가절 "저지선 구역".

---

## 2. 핵심 루프 (근거: `design/lane-coreloop.md`)

### 2.1 결정: 조감 카메라 전환에도 기본전투는 100% 자동 해상 유지

플레이어의 새 행위 주체성은 조준/락온이 아니라 **포메이션 스탠스**라는 상위 전략 레이어에 배치한다. 근거(`main_constraint#2` 4항목 대응 — 결정론/edge-HUD/reduced-motion 3항목이 수동 조준에 불리, 1항목 중립 → 자동 해상 유지가 유일하게 전 항목 통과). 카메라는 시뮬레이션 좌표계를 바꾸지 않는 순수 렌더 어댑터 변경이다.

### 2.2 포메이션: 3슬롯 스탠스 체계

> **디렉터 확정 (명칭 정정)**: 원 레인은 0-FRONT 스탠스를 "결집(Rally)"로 명명했으나, ProgFormationSim의 "Boss Rally Window"(§5.3, FRONT≥1 요구)와 이름이 충돌해 IRC로 **"포대(Turret)"**로 개명됨. 최종 3스탠스 명칭은 **전열(Vanguard) / 포대(Turret) / 분산(Split)**이다. "Rally"라는 단어는 오직 §5.3의 Boss Rally Window(전투 시뮬레이션 메카닉)에만 쓴다 — 두 시스템 어디에도 "결집" 명칭이 남지 않도록 통일했다.

| 스탠스 | 오프셋 | 대형 반경 | 주 효과 | 파생 FRONT 수 |
|---|---|---|---|---|
| 전열(Vanguard) | 이동방향 전방, 좌우분산 1,400유닛 | ±500유닛 | 동료가 커맨더보다 먼저 접근로 진입, 조기 교전 | 2 |
| 포대(Turret) | 후방 300유닛 | 300유닛(밀집) | 재배치 지연 최소, 지속 화력 최대 | 0 |
| 분산(Split) | 좌우 측면 2,000유닛 + 후방중앙 300유닛 | 최대 폭 9,000유닛 | 측면 커버리지 확장 | 1 |

스탠스 전환 쿨다운 4초[TARGET]. 오프셋은 기존 `OCTANT_VECTORS` 8방향 이산 체계 재사용(연속각 보간 불필요).

**동료 피격 가능성 — RESOLVED**: FRONT 슬롯(3개 중 최대 2개) 동료는 적의 유효 타겟이 되어 런 스코프 한정 `DOWNED` 상태로 소모될 수 있다(런 종료 시 리셋, **영구 손실 아님** — §4.4 참조). BACK은 피격 불가.

### 2.3 코어 루프 후보 (G7 draft input)

```yaml
core_loop_candidates:
  - id: vanguard-circuit
    role: primary
    period_s: 60            # [TARGET] band 45-90
    actions_per_loop: 4     # 이동, 스탠스전환, 자동전투소모, 보상확인
    reward_events_per_loop: 2   # XP임계값 스킬제안 + 포메이션유지보너스
    repeat_rate_proxy_target: 0.70
  - id: formation-assault
    role: nested-secondary  # 정예/보스 조우 전용, 스테이지당 정예1-2+보스1
    period_s: 100            # [TARGET] band 70-160
    actions_per_loop: 4     # 스카우트, 포메이션커밋, 자동전투해상, 결과확인
```

10스테이지 순서·이름·`XP_GROWTH` 8단계·오브젝티브 페이즈 순서·런/영구 상태 분리 규칙은 전부 유지. **포메이션 스탠스 선택도 런 스코프 상태다** — 어떤 동료를 로드아웃에 넣을지는 영구지만, 런 중 스탠스는 매 런 초기화.

### 2.4 디렉터 결정 — 로드아웃 정원은 이번 사이클 3 고정

PMForecast는 로드아웃 정원을 3→4(stage3)→5(stage7)→6(stage9)로 확장 제안했으나, 이는 스탠스 오프셋 수학(§2.2, 3-way 고정 전제)과 ProgFormationSim의 FRONT≤2/3 스키마 전체를 N-슬롯 일반화가 필요하게 만드는 상위 스코프 변경이다. **이번 사이클은 `MAX_LOADOUT_SIZE=3`([OBSERVED] `campaign-state.js:20`)을 고정 유지**하고, PMForecast의 Track B 페이싱 피크는 슬롯 정원 확장이 아니라 **모드 언락**(열 포지션 stage 7, Assault Formation stage 9)으로 재해석한다(§7 페이싱 표에 반영). 정원 확장 자체는 스탠스 수학 N-슬롯 일반화가 선행되어야 하는 **Stage 2 이후 후속 안건**으로 명시 이월한다.

---

## 3. RPG 시스템 (근거: `design/lane-rpgsystems.md`, `engineering/lane-data-arch.md`)

### 3.1 3개 영구 성장 축 (기존 2개 + 신규 2개)

```yaml
progression_axes:
  - id: run-scoped-skill-offer        # 기존, 변경 없음
    persistence: run-only
  - id: companion-unlock               # 기존, 변경 없음 — 해금 트리거는 추출 그대로
    persistence: campaign-permanent
  - id: dusk-warden-progression        # 신규 Track A
    persistence: campaign-permanent
  - id: companion-progression          # 신규 Track B
    persistence: campaign-permanent
```

### 3.2 Track A — Dusk Warden 전용 영구 성장

**자원: Echo Core** (= Deepmark에 결속된 잔향의 수치화 표현). 정예 추출 성공 1개(스테이지당 1회×10=최대10), 보스 처치 3개(10×3=최대30). **캠페인 전체 예산 40**.

**스탯 6종** (기준: `COMMANDER` basicDamage 900/cooldown 24틱/maxIntegrity 1000/critChance 15%/critMult 2.0×/speed 4100):

| 스탯 | 효과(포인트당) | 최대(10P) |
|---|---|---|
| 결속력(binding-might) | 기본 공격력 +15 | +150 |
| 심연 공명(abyssal-resonance) | 액티브 스킬 피해 +2% | +20% |
| 메아리 신속(echo-swiftness) | 스킬 쿨다운 −0.5%(상한 −5%) | −5% |
| 관문 결의(gate-resolve) | 최대 내구 +20 | +200 |
| 균열 정밀(fracture-precision) | 치명타 확률 +1%p | +10%p |
| 회수 반경(reclaim-radius) | 자원 획득 반경 +150 | +1500 |

포인트 비용 곡선: `ceil(n/2)+1`, 1스탯 만렙(10P)=40 Echo Core(예산 100%).

**스킬트리 5노드** (공격 T1→T2, 생존 T1→T2, 공용 캡스톤): echo-backlash(5)→echo-cascade(8), wardens-ward(5)→wardens-vigil(8), echo-warden-awakening(15, 양 T2 선행 필요). 풀트리 총원가 **41** — 예산 40 초과, 의도된 트레이드오프. **기존 런-스코프 스킬 제안(XP임계값→3택1, 런종료소멸)과 별개로 동시 보유** — 대체 관계 아님.

> **디렉터 명확화 (PMForecast "Warden Ascension Tree" 페이싱과의 관계)**: PMForecast가 제안한 스테이지 1/5/9/10 티어 언락은 노드에 대한 **하드 스테이지 게이트가 아니라 기대 페이싱**이다. 실제 언락 조건은 Echo Core 보유량 + 선행 노드뿐이며(designer 확정), 스테이지 1/5/9/10은 "이 시점 정예/보스 처치 누적으로 이 정도 Echo Core가 쌓여있을 것"이라는 [TARGET] 기대치를 나타낸다. 캡스톤(양 T2 선행)만 사실상 스테이지 9 이후에나 도달 가능하므로 PMForecast의 "Tier 4 = 자동 부여, 캠페인 완료와 동시 발화"와 자연히 정합한다.

### 3.3 Track B — 동료 성장 (역할군 3종, 스탯 배분 없음)

**디렉터 스키마 결정**: designer(Warden 6스탯 전용 + 동료 역할패시브)와 ProgDataArch(5공유스탯+동료 배분 서브셋) 두 스키마가 갈렸다. **채택: designer안** — 동료는 스탯 포인트를 배분하지 않고 **고정 역할 패시브 + 장비 등급 + 특성**으로만 성장한다. 근거: (1) "Warden만 고유하게 성장"이라는 세계관 원칙과 정합 — 동료에게도 배분형 스탯을 주면 그 원칙이 희석된다. (2) Kingshot의 "loadout specialization, not stat-min-max"에 더 가깝다. (3) R2 리스크(편성 조합 지배)의 표면적을 줄인다(승수 원천 하나 감소). ProgDataArch의 `CompanionRecord.statPoints` 필드는 **제거**하고 `equipment`+`traits`만 유지 — 나머지 스키마(파일 분리, 마이그레이션 체인, `EQUIPMENT_ITEMS` 명명)는 그대로 채택.

| 역할 | 소속 동료 | 패시브 |
|---|---|---|
| Vanguard(수호) | anchor-shard, veil-vanguard | 자체 내구+30%, 배치 중 Commander 피격−5% |
| Striker(타격) | ember-cohort, rift-lens | 피해+20%, 보스/정예 대상 추가+10% |
| Support(지원) | throne-echo, dawnless-crown | Commander 획득반경+10%, 스킬쿨다운−5% |

**장비 5티어** (동료당 Weapon/Ward/Trinket 3슬롯, Warden도 동일 장착 구조): T1 일반(Echo-Bound, ×1.00) / T2 고급(Umbral-Etched, ×1.15) / T3 희귀(Void-Forged, ×1.35) / T4 영웅(Abyss-Tempered, ×1.60) / T5 전설(Court-Sealed, ×2.00). 자원: **Bound Fragment**(보스 처치 1개×10스테이지=최대10 — 슬롯 1개만 T5 완전 도달 가능한 예산, 강제 특화).

**Warden 특성 8종**(스테이지 2/4/6/8/10 언락, 3택1, campaign-permanent, 리스펙 없음): 선제격/사투의메아리/무모한회수/관문지기/연쇄반응/정예사냥꾼/동료서약/메아리과잉 — 전부 조건부 발동 또는 명시적 트레이드오프(무조건 상승형 없음, G2 EV캡 1.3× 위반 구조적 방지).

**자원 예산 상한이 곧 안티-지배빌드 장치**: Echo Core(40)+스킬트리(41)+Bound Fragment(10)를 **의도적으로 예산과 거의 정확히 일치**시켜, "모든 걸 만렙 찍는 지배 빌드"를 밸런스 튜닝이 아니라 산술로 원천 차단한다. **이 세 상수는 세트로만 조정 가능** — 하나를 바꾸면(예: 보스 보상 상향) 셋 다 재계산 필요.

### 3.4 데이터 아키텍처 (근거: `engineering/lane-data-arch.md`)

신규 카탈로그 파일 `rpg-catalog.js`(가칭) 분리 제안 — `defense-catalog.js`(런 스코프)와 관심사 분리, `campaign-state.js`가 양쪽을 import. 캠페인 최상위에 `wardenProgress`(레벨/배분스탯/스킬트리/장비) + `ownedEquipmentIds` 2필드 **추가**(기존 필드 무변경). 마이그레이션은 기존 4단계 체인(`LEGACY→REWARD→CURRENT`)에 5번째 단계로 **additive만** 추가 — 브레이킹 체인지 없음, 기존 세이브 100% 호환.

순수 함수 계약: `deriveWardenRuntimeStats`/`deriveCompanionRuntimeStats` — 카탈로그 입력만 받고 숫자 리터럴 없음(원칙: 리밸런스가 코드 변경을 요구하지 않음). 필드명(`damageBonus`/`maxIntegrity`/`cooldownReduction`/`pickupRange`)은 기존 `ITEMS`/`REWARDS` 어휘 재사용 — 런스코프 값과 영구 값을 동일 누산 로직으로 합산 가능.

---

## 4. 포메이션 전투 시뮬레이션 (근거: `engineering/lane-formation-sim.md`)

### 4.1 결정론 불변식

동일 저장상태+동일 입력=동일 출력(`getRunDigest`). 신규 시스템(포메이션/랠리/소모) 전부 이 불변식을 설계 시점부터 증명 가능 — RNG 미소비, 실시간 미참조, 안정 정렬 사용.

### 4.2 편성 데이터: `companionLoadout: string[]` → `formation: {companionId, slot: FRONT|BACK}[]`

`max_slots=3`(불변, §2.4 디렉터 결정), `max_front=2`(최소 1 BACK 유지), 레거시 배열 입력도 계속 지원(전량 BACK 해석, 하위호환). 후열 시너지: BACK 동료는 살아있는 FRONT≥1일 때만 데미지+25%bp(비례, 곱연산 폭주 방지 위해 낮게 설정).

### 4.3 Boss Rally Window (싱글플레이 경계 내 "랠리" 유일 용례)

보스 스폰 시 발동, 살아있는 모든 동료의 타겟팅을 보스로 강제 override(사거리 내 한정) + 쿨다운 20% 단축. **FRONT≥1 채워진 편성일 때만 발동**(0-FRONT는 기존 동작 유지, 하위호환). 멀티플레이 아님 — 전부 단일 플레이어가 로컬에 소유한 액터.

### 4.4 소모(Attrition) — RESOLVED: 런 스코프 전용, 영구 손실 없음

FRONT 동료는 `formationIntegrity`(= `companion.damage × 8 × wardSlotTierMultiplier`, Ward 슬롯 장착 등급의 기존 5티어 배율 T1=1.00~T5=2.00 재사용 — D7b) 소진 시 DOWNED — 즉시 공격중단, 타겟후보 제외, 런 종료까지 유지, **런 재시작/재생성 시 자동 ACTIVE 리셋**(campaign-state.js에 동료 삭제 API 자체가 없음 — 기존 계약이 이미 강제하는 사실). "완전 상실(퍼머데스)"은 명시적으로 기각(문서화된 영구성 계약 위반 + 확률적 손실이라는 부정적 가챠 축의 암묵적 도입).

**신규 밸런스 리스크(PRED-09, S1급) — 설계 레버 도입(D7b)**: DOWNED가 영구 손실 없음이라는 규칙 자체가 "무비용 육탄 방패" 착취 경로를 연다 — 방어 투자 0인 동료를 FRONT에 세우는 것이 항상 최적해가 될 위험. **완화 레버**: 위 formationIntegrity 공식이 Ward 슬롯 등급에 연동돼 있어, 무투자(T1)는 완전투자(T5) 대비 생존시간이 절반 — 조기 DOWNED로 인한 후열시너지(+25%bp) 손실 위험이 무투자 쪽에 실제로 부과된다. **완전 해소로 주장하지 않음** — "버스트 딜로 죽기 전에 끝내는" 전략이 그래도 우월한지는 Stage 2 시뮬레이션(조합 폭발 공간, 수식 하나로 단언 불가) 없이는 모른다.

### 4.5 신규 스냅샷 필드

`companions[].slot`/`status` 추가로 `SNAPSHOT_VERSION` 5→6(구버전 리플레이는 버전 게이트로 거부). 킬스위치: 전원 BACK 편성 시 FRONT 로직 전체가 조건 분기에서 자연 비활성 — 별도 feature flag 불필요.

---

## 4.6 게임 캠페인 스테이지 1→10 그라운드 진행 설계 (근거: `design/stage-progression.md`)

실제 `defense-catalog.js` STAGES/BOSSES 데이터를 계산해 스테이지별 Echo Core/Bound Fragment 누적, 스킬트리·장비 최초 구매 가능 시점, 저지선 면역 달성 시점(Stage 6)을 확정했다. **§8 페이싱 표 수정 필요 발견**: "Stage 1에서 Tier-1 노드 확정 선택"은 실제로 불가능 — Stage 1 종료 시 누적 Echo Core는 4인데 최저비용 노드는 5다. 정정: **Stage 1 = 트리 최초 노출(양쪽 브랜치 존재를 학습, 아직 구매 불가) / Stage 2 종료 시 = 실제 첫 노드 구매 가능**(누적8). §8 표는 이 정정을 반영해 갱신한다.

## 5. 렌더링·카메라 아키텍처 (근거: `engineering/lane-render-arch.md`)

### 5.1 채택: 옵션 A — Blender 3D 저작 → 셀셰이드 베이크 → 기존 Canvas2D 계약 유지

**핵심 재해석**: 사용자가 요구한 "3D 월드"는 **런타임 3D 렌더링(WebGL)**이 아니라 **3D로 저작된 콘텐츠**를 의미한다고 해석한다. 버즈아이 고정 고도각 카메라 자체가 매 프레임 자유 시점 렌더링을 불필요하게 만든다.

**결정 근거(3갈래)**:
1. **제로 런타임 의존성 유지** — `package.json`에 런타임 `dependencies`가 아예 없는 현재 상태를 그대로 지킨다.
2. **이 저장소는 WebGL 3D 렌더러를 이미 한 번 구축했다가 폐기했다** — 커밋 `161a2ab`~`141b8f7`, 6,761줄 삭제. 가설이 아니라 이 정확한 코드베이스에서 실제로 일어난 사건.
3. **결정론-분리 계약을 최소 표면적으로 지킨다** — 옵션 A는 `renderSnapshot()` 시그니처도 어댑터 계약 테스트도 건드리지 않는다. 픽셀 내용만 바뀐다.

**파이프라인**: Blender 저작 → Toon/Cel BSDF 셰이더 → 헤드리스 베이크(`blender --background --python`, 정투영 버즈아이 고도각) → PNG 아틀라스 → 기존 `sprite()` 소비. 과거 베이크 이력(`assets/images/battle/glb/.parts/*.json` 15개 매니페스트)이 검증 스키마(`visualValidation`)와 함께 이미 존재 — 재실행이지 신규 발명이 아니다.

**단계적 롤아웃**: Gate1(Dusk Warden 1종, Idle+Move, 4방향 파일럿) → Gate2(soak 테스트 회귀 없음 확인) → Gate3(전체 로스터, G4 몰입감 점수 확인). 킬스위치: `animation-manifest.json` 경로 스왑만으로 기존 사실적 아틀라스 즉시 복귀.

**옵션 B(WebGL) 배제 아님, 조건부 유보**: Stage 2 이후 자유 회전 카메라나 동적 조명이 명시적으로 요구되면 재검토 — 이번 사이클(버즈아이 고정각+셀셰이드)만 놓고 보면 그 자유도가 필요한 근거 없음.

### 5.2 카메라 모델 (옵션 중립, 신규 확정)

기존 카메라(`updateCamera()`)는 화면공간 오프셋(월드 전체가 항상 노출)이지만, 신규 요구는 **월드공간 카메라 창**(더 큰 월드의 일부만 노출, 이동에 따라 패닝)이다 — 신규 계층으로 설계 필요.

```yaml
camera_follow_mechanism:
  anchoring: { world_content: WORLD-SPACE, hud: SCREEN-SPACE }  # HUD는 world translate 블록 밖에서 그려짐 — 변경 불필요
  deadzone: { shape: "중심 사각형 폭12%×높10%", behavior: "데드존 내부 정지, 경계 초과분만 추적" }
  lag_easing: { factor: 0.18, reduced_motion: "즉시 스냅(기존 CAMERA_FOLLOW_EASING 패턴 재사용)" }
  determinism_boundary: "카메라 유도값은 frame 객체로만 전달, getRunDigest에 결코 반영되지 않음 — 기존 계약 그대로"
```

---

## 6. UI/UX (근거: `ui/lane-*.md` 3편)

### 6.1 정보구조 — 5탭 셸 구조로 승격

기존 커맨드 덱(단일 페이지)은 6개 신규 시스템 추가 시 스크롤 폭발이 확실하므로 탭 셸로 승격: **출정 / 성장(스탯·스킬트리·특성) / 동료(목록·편성) / 인벤토리 / 요새(Farwatch Hold)**. In-battle은 기존 edge-card 패턴 재사용하는 3개 신규 마이크로패널(레벨업 토스트, 총공세 트리거 버튼, 아이템 획득 토스트)만 추가 — 전투 중 신규 풀스크린/모달 없음.

> **디렉터 결정 — 일시정지 메뉴 규칙 충돌**: "중앙 패널로 위험 영역을 덮지 않는다"는 기존 규칙은 문언상 일시정지 중 대형 오버레이도 막지만, 그 규칙의 취지(실시간 위협 회피 가능성 보존)는 `userPaused===true`(시뮬레이션 정지) 상태에서는 적용되지 않는다. **채택: 옵션 A** — 일시정지 중에만 열리는 풀스크린/대형 오버레이 허용(스탯시트/인벤토리/동료상세 조회), 재개 시 닫힘. 프로그래머/UI 레인은 이 결정에 따라 구현.

### 6.2 화면공간 vs 월드공간 HUD 분류

**화면공간(고정)**: 커맨더/게이트 내구바, 미션 컨텍스트, 스킬액션바, 이동조작, [신규]동료 로스터 트레이(최대3), [신규]버프트레이, 보상/결과 카드, `aria-live` 피드백.
**월드공간(카메라 추적)**: 자기위치마커, [신규]동료 네임플레이트+체력바(위치 위), 적 체력링, [신규]위험/조준 지상표시, [신규]추출구역 진행링, [신규]엘리트 포획 프롬프트, [신규]부유 대미지 숫자.
**하이브리드**: [신규]오프스크린 목표 웨이포인트 화살표(뷰포트 내=월드투영, 밖=클램프).

세로모드 폴백(가로락 실패, iOS Safari 등에서 상시 발생하는 1급 시나리오): 대칭 도형(링)은 캔버스 회전에 자동 추종, **텍스트 포함 요소(네임플레이트 등)는 `drawWorldText` 역회전 패턴 필수**.

감산-모션: 카메라 추적 자체(기능)는 이미 하드컷 패턴 출하됨([OBSERVED] `app.js:534-551`) — 신규 월드공간 패닝 모델에도 동일 원칙 유지. 카메라 흔들림(장식)은 완전 억제. 월드 앵커의 위치 추적은 장식이 아니라 기능이므로 감산-모션과 무관하게 유지.

### 6.3 접근성/성능 예산

**밀도 리스크**: 인벤토리/스킬트리/포메이션 3개 신규 화면은 기존 이동-only 체계(≤10개 동시 상호작용요소) 대비 20-40개로 밀도 2-4배 상승 → 이 3화면 한정 **48dp 하한**(기존 44px 유지, 드래그 타깃 56dp) + 최소 간격 규칙.

**웜팔레트 대비 리스크**: 신규 셀셰이드 웜 오텀 팔레트는 기존 콜드 시안팔레트 대비 색상환 인접 위험(웜온웜) — 디자이너가 최종 헥스값 확정 시 이 레인의 6개 표면(등급배지/스킬트리노드/포커스링)에 실측 대비 계산 1회 필수, 자동통과 가정 금지.

**아이템 등급 색-독립 인코딩(필수)**: 5티어 각각 색상+아이콘(꼭짓점수 0/3/4/5/6)+텍스트 3중 인코딩, 최소 2채널이 색상 없이도 완전 식별 가능해야 함(그레이스케일 렌더 테스트로 검증).

**DOM/입력지연**: 인벤토리 ≤450노드(가상스크롤 목표 120), 스킬트리 ≤300, 포메이션 ≤250. 입력지연 탭 100ms/드래그시작 50ms/드롭확정 100ms(기존 G6 계약과 일관).

---

## 7. 경제/참여 설계 — 무과금 재해석 (근거: `pm/lane-*.md` 3편)

프로젝트 무과금 경계에 맞춰 하네스 템플릿 어휘를 전면 재해석했다: "매출 포인트"→**인게이지먼트 포인트**(시간/실력/주의 투입), "일발역전"→**스킬-역전 순간**, "paid/free 패리티"→**플레이스타일 패리티**. 확률형/구매 요소 전무.

### 7.1 인게이지먼트 포인트 지도 (9개)

| ID | 지점 | 투입 | 획득 | 가역성 |
|---|---|---|---|---|
| EP-1 | 게이트 등급 선택 | 실력+시간 | XP배율/등급상한 접근 | 가역 |
| EP-2 | 정예 추출 시도 | 실력+시간 | Echo Core(결정론적, **확률 아님**) | 비가역 |
| EP-3 | 물질화(동료원형 결정) | 실력 | 신규 동료 원형 | 비가역 |
| EP-4 | 포획(명부 슬롯 결정) | 실력+주의 | 신규동료 확보(대가: 기존동료 은퇴/포기) | 비가역 — **구 상업형 템플릿에서 가장 화폐화 압력 컸을 지점을 실력 판단으로 전환** |
| EP-5 | 스탯포인트 분배 | 시간+실력 | 영구 스탯 성장 | 비가역(리스펙 없음, Stage2 안건) |
| EP-6 | 장비 강화 선택 | 시간+실력 | 장비등급 상승 | 비가역 |
| EP-7 | 스킬트리 노드 해금 | 시간+실력 | 영구 스킬 1개 (**Warden 전용, 동료 아님** — §3.2 참조) | 비가역 |
| EP-8 | 특성 선택(3택1) | 실력+주의 | 영구 패시브 특성 | 비가역 |
| EP-9 | 습격 편성 재구성 | 시간+실력 | 습격 성공률↑ | 가역(스탠스는 전투 전 자유 재구성) |

### 7.2 스킬-역전 순간 — "결집 강화(Formation Surge)"

> **디렉터 명칭 변경 및 스코프 축소**: 원 레인의 "Full Rally"는 3슬롯 상한을 넘어 보유 동료 전원이 전투 한정 합류하는 설계였으나, 이는 §2.4에서 확정한 "로드아웃 3고정" 결정과 정면 충돌하고 "Rally"라는 이름도 §4.3 Boss Rally Window와 겹친다. **채택: 결집 강화(Formation Surge)** — 로드아웃 3슬롯 상한은 유지하되, 발동 시 **현재 편성된 3기 전원에게 일시 강화**(원 설계의 "빈 슬롯이 채워지는" 효과를 "기존 슬롯이 강해지는" 효과로 대체)를 부여한다. 나머지 수치(충전/상한/자격조건)는 원 레인 설계를 그대로 채택.

```yaml
mechanic: formation-surge   # renamed from full-rally, director decision
trigger: "boss/elite 습격전, 현재 편성 파워 < 스테이지 설계 목표 파워"
charge_max: 3
charge_sources: [무피격정예추출, 보스페이즈1무피격통과, 회피콤보임계달성]
formation_power_swing_max_pct: 30       # min(power_deficit_pct, 30)
swing_ceiling_pct_of_stage_power: 90
activation_cap: "1 per boss/elite encounter"
resets: per-run
label: TARGET — Stage2 QA 시뮬레이션 전까지 DRAFT
```

### 7.3 플레이스타일 패리티

그라인드형/스킬형/컴플리셔니스트형 3원형이 **런 12-18회** 구간(체크포인트 15)에서 편성 파워 중앙값 수렴, 격차 상한 10%p, 승률 델타 상한 5%p(기존 하네스 값 유지). 수렴 지표는 "총 보유 자산"이 아니라 "현재 3슬롯 로드아웃 최선 조합의 실전 파워".

**미해결(Stage 2 필수)**: 런↔세션 단위 환산비 — PMForecast는 "런"을, QARiskRegister R5는 "세션"을 단위로 써 자동 일치하지 않음. PMForecast+QA가 확정할 것.

---

## 8. 페이싱 — 10스테이지 축 (근거: `pm/lane-forecast.md`, §2.4 디렉터 수정 반영)

```yaml
pacing_rhythm:
  peak_stages: [1, 3, 5, 7, 9, 10]      # 6개
  trough_stages: [2, 4, 6, 8]           # 4개, 어떤 두 trough도 인접하지 않음
  deliberate_double_peak: [9, 10]        # 파이널 직전 컨버전스, 유일한 예외
```

| Stage | Class | Track A(Warden) | Track B(동료/편성) | 투자 선택 |
|---|---|---|---|---|
| 1 | PEAK(노출) | 스킬트리 UI 최초 노출(양쪽 브랜치 존재 학습, **구매 불가** — 누적4 < 최저비용5, D11 정정) | 기본 3슬롯 로드아웃 확정, 첫 동료(Striker) 해금 | 없음(관찰만) |
| 2 | TROUGH | **실제 첫 T1 노드 구매**(누적8, D11 정정 — 신규 구조 아님, 노출된 트리 소비) | — | Tier-1 노드 1개 선택 |
| 3 | PEAK | — | 첫 Support 역할 동료 해금(throne-echo) — 역할 다양성 최초 노출, 장비 슬롯1 T2→T3 도달(누적Fragment3) | Support 편입 여부 판단 |
| 4 | TROUGH | 한쪽 브랜치 T1+T2 완성 가능(누적16, 기존 노출 소비) | 진화 재료 소비, 첫 Vanguard 역할 동료 해금(anchor-shard, 조용한 로스터 완성 — 3역할 전부 등장) | 없음(진화 소비) |
| 5 | PEAK | Tier-2 특화분기 최초 노출(공격/방어/유틸 1택) | — | Tier-2 분기 1개 선택 |
| 6 | TROUGH | 양쪽 브랜치 T2 근접(누적24, 기존 브랜치 소비) | **저지선 영구 면역 달성**(wardLevel8=압력상한 도달, `stage-progression.md` §4 — 신규 UI 없는 조용한 임계값 통과) | 재배치 |
| 7 | PEAK | — | **열 포지션 모드 최초 오픈**(전열/후열, §2.2 스탠스 활성화) | 스탠스 배정 |
| 8 | TROUGH | — | 장비 강화 선택(EP-6, 슬롯1 T3→T4 도달, 누적Fragment8 — 기존 장비 소비, 리스펙 아님) | 장비 강화(스탯 재분배 아님 — EP-5 비가역 원칙 준수) |
| 9 | PEAK(컨버전스) | T3 고유특성 최초 노출·1택 | **Assault Formation 모드 최초 오픈**(Boss Rally Window 활성) | 특성+모드 확정 |
| 10 | PEAK(피날레) | 캡스톤 자동부여(도달 불가 확정 사실: 누적40<41, §7 자원예산 산술과 정합) | 프리셋 저장(NG+용) — 배경 사실: 장비 슬롯1 T4→T5도 정확히 이 시점 도달(누적Fragment10) | 없음(확인만) |

> **디렉터 수정 사항 정정 이력**: (1) D11 — "Stage 1 = Tier-1 확정 선택"은 실제 Echo Core 누적과 모순돼 정정(노출만 → Stage 2가 실제 첫 구매). (2) 1차 표 재구성 시 Class 열을 "구매 가능 시점" 기준으로 잘못 재도출해 위 YAML(peak=[1,3,5,7,9,10]/trough=[2,4,6,8])과 모순되는 표를 만들었다가 재수정 — **PEAK/TROUGH는 PMForecast의 "신규 구조 노출 vs 기존 구조 소비" 리듬이며 구매 시점과는 다른 축**이다: D11의 구매-불가 사실은 Track A 셀 텍스트에만 반영하고 Class는 원래 리듬(6-peak/4-trough, 9-10 유일한 인접 더블피크)을 그대로 유지한다. (3) Stage 3은 §2.4(로드아웃 3고정)로 무효화된 "슬롯 +1" 대신, 실제 컴패니언 데이터(`stage-progression.md`)에서 확인되는 **최초 Support 역할 해금**을 PEAK 내용으로 대체 — 임의 창작이 아니라 `defense-catalog.js` STAGES 실측 그대로. Stage 4에서 3역할(Striker/Support/Vanguard) 전부 등장 완료. (4) Stage 8 "스탯 재분배 창"은 §7.1 EP-5("비가역·리스펙 없음, Stage2 안건")와 정면 모순이라 **장비 강화(EP-6)**로 교체 — 리스펙 시스템은 여전히 미결정 상태(§12 미해결 7번과 동일 항목, 이번에 도입하지 않음). (5) 저지선 영구 면역(stage6)·캡스톤 도달불가(stage10)는 신규 구조가 아니라 기존 자원곡선이 조용히 넘는 임계값이므로 TROUGH/PEAK 배경사실로 배치, Class 판정에 영향 없음.

---

## 9. 밸런스 거버넌스 — 교차 시스템 리스크 (근거: `qa/lane-risk-register.md`)

5개 리스크(R1-R5)의 공통 패턴: **개별 시스템은 45-55% 밴드 내인데, 합쳐지면 이탈한다.**

| ID | 리스크 | 완화 제약 |
|---|---|---|
| R1 | Warden 고유성장이 런스킬 선택긴장 무력화 | 영구성장은 "용량"만(원시스탯 무제한 가산 금지), 상한 20%[TARGET] |
| R2 | 편성 조합이 동료다양성 무의미화 | 역할 인접보너스는 체감(diminishing), ≥2개 구조적으로 다른 편성이 동일 보스 클리어 가능해야 함 |
| R3 | 아이템×특성×편성 곱연산이 G2 밴드 이탈 | **카테고리 내 가산, 카테고리 간 상한 1.3×**(기존 콤보EV캡 선례 재사용) — §3.2 R3 보강 참조 |
| R4 | 런/영구 경계 모호로 상태버그 | 2-경로 소유권: 영구원장(추출성공/귀환화면에서만 기록) vs 런중 임시스냅샷(항상 폐기) |
| R5 | 두 영구축 복리누적이 패리티 붕괴 | **합산 영구파워 총량**에 세션당 한계체감, 세션15까지 기준선 1.6배 캡[TARGET] |

**R3 시행 지점 정정(중요)**: 곱연산 체인이 2개 레이어로 나뉜다 — (1) `derive-fn` 반환 단계(아이템+특성, 현재 가산 — 준수) (2) fire-time 스탠스 승수(편성 보너스, 곱연산). **1.3× 상한은 반드시 두 레이어를 합친 전체 체인을 감싸야 한다** — derive-fn 출력값만 검사하면 fire-time 배수가 빠져나간다. 정확한 시행 지점은 ProgFormationSim+ProgDataArch 확정 필요(Stage 2).

> **디렉터 최우선 지시 — 이행 완료**: R1·R3·R5는 서로 다른 시스템 쌍이지만 전부 "개별은 정상, 합치면 초과"라는 동일 실패 유형이다. 세 시스템(Track A/Track B/편성)이 공통 참조하는 단일 "전체 영구 파워 예산" 거버넌스 오브젝트를 아래에 명문화한다 — 개별 조정 금지, 세트로만 재검토.

### 9.1 전체 영구 파워 예산 거버넌스 오브젝트 (D6 해소, R1/R3/R5 통합)

**구성 원칙**: 세 리스크가 측정하는 지점이 서로 다르다는 것을 먼저 명확히 한다 — R1은 "Warden 원시스탯이 런스킬 선택을 얼마나 대체하는가"(스탯 축 하나), R3는 "동일 시점 최적 조합이 중앙값 대비 얼마나 튀는가"(스냅샷, 콤보 축), R5는 "세션이 늘수록 캐주얼과 그라인드형 격차가 얼마나 벌어지는가"(시간 축, 누적 총량). 세 지표 모두 **같은 원천값**(`deriveWardenRuntimeStats`/`deriveCompanionRuntimeStats` 출력 × fire-time 스탠스 승수, D6에서 확정한 전체 체인)을 다른 절단면으로 읽는다 — 그래서 하나의 오브젝트로 관리 가능하다.

```yaml
system: total-permanent-power-governance
authority: "design/balance-sheet.md — 세 리스크(R1/R3/R5) 완화 제약의 단일 소스, 개별 조정 금지"

shared_computation_chain:
  step_1_derive: "deriveWardenRuntimeStats() / deriveCompanionRuntimeStats() — 카탈로그+영구상태 -> RuntimeStatModifiers, 카테고리 내(아이템+특성) 가산"
  step_2_fire_time: "fire() 호출 직전 stance_modifier 곱연산 적용 (companion.slot===BACK && synergyActive 등, engineering/lane-formation-sim.md §2.3 동일 레이어)"
  enforcement_binding: "R3/R1/R5 세 상한은 전부 step_2 이후의 최종 effectiveDamage/effectiveStats에 대해 측정한다 — step_1 출력만 검사하는 것은 D6에서 '불충분'으로 확정됨"
  enforcement_owner: "ProgFormationSim(fire-time 승수 적용 지점 소유) + ProgDataArch(derive-fn 소유) 공동 구현, designer(balance-sheet.md)가 상한값 소유"

r1_warden_capacity_ceiling:
  measures: "Warden 원시스탯 단독 기여도가 스테이지 파워예산에서 차지하는 비중"
  ceiling_pct_of_stage_power_budget: 20   # TARGET
  verification: "스테이지별 '런 스킬 제안 없이' 시뮬레이션 승률 프로브 — 모든 스테이지에서 45% 미만이어야 함"

r3_combo_dominance_ceiling:
  measures: "동일 투자 수준에서 특정 조합(스탯+스킬트리+트레잇+기어등급+스탠스)의 effectiveDamage가 중앙값 조합 대비 얼마나 튀는가 — 스냅샷"
  cross_category_multiplier_ceiling: 1.3   # TARGET, 기존 combo_ev_cap_vs_median 선례
  baseline: "run-scoped-skill-only power"
  verification: "완전육성 vs 저육성 동일슬롯 파티의 동일 보스 매치업 승률 시뮬레이션"

r5_session_growth_ceiling:
  measures: "세션 경과에 따른 누적 permanent power 배수 — 시간축, R3와 다른 절단면"
  cumulative_power_multiplier_ceiling: 1.6   # TARGET
  ceiling_reached_by_session: 15             # TARGET
  diminishing_returns_curve: "log(session+1)/log(16) 형태 제안 — session0=1.0배, session15=1.6배 근사, 15 이후 평탄화. 정확한 계수는 Stage2 QA 실측 후 확정"
  verification: "casual(5세션) vs grind-heavy(20세션) 세션10 시점 유효파워 비율 시뮬레이션"

relationship: "r1은 축 하나(원시스탯)만 격리 측정, r3는 스냅샷 콤보 다양성, r5는 시간축 누적 — 세 상한이 동시에 통과해야 G2/G3/G5 전체가 성립. 셋 중 하나만 조정하면 나머지 둘의 전제(같은 계산 체인)가 깨지므로 세트로만 재검토."
label: TARGET — Stage2 QA 시뮬레이션 전까지 DRAFT
```

---

## 10. QA 계획 요약 (근거: `qa/lane-archetype-testplan.md`, `qa/lane-benchmark-survey.md`)

### 10.1 아키타입 7종 (하네스 기본 5 + RPG확장 2)

Rusher, Turtle, Economy-greed, Micro-optimizer, Casual/low-APM(하네스 기본, whale/F2P는 무과금 경계상 미채택) + **Completionist-collector**(Kingshot 축 극단값), **Single-companion-main**(Solo Leveling 축 극단값 — **이 사이클의 main_question을 직접 검증하는 대조군**).

**최우선 검증 항목**: PRED-08(single-companion-main이 다변화 편성과 동등/우세하면 Kingshot 축 전체가 장식으로 전락한 것 — 최고 심각도, 개별 수치조정 불가), PRED-09(무비용 육탄방패, §4.4), PRED-05(조합 EV 1.3× 초과, G3 붕괴 위험).

### 10.2 벤치마크 조사 핵심 발견 (5개 공식 소스 신규 확인)

- Diablo IV/Path of Exile: 아이소메트릭 카메라가 검증된 업계 관례(버즈아이 축 뒷받침), 던전은 캠페인과 분리된 별도 인스턴스, 2단계 성장(레벨링 트리+엔드게임 확장보드).
- Solo Leveling: ARISE(공식 앱): 게이트→클리어→성장 루프, 그림자추출→동료 편입이 실제 게임화 제품에서도 확인, Player/Hunter 이중모드 구조.
- Kingshot/Whiteout Survival: 거점+영웅모집 분리 구조 반복 확인. **Whiteout Survival의 "공유 레벨 풀"(신규 영웅 즉시 전력화)은 참신성 후보(빈도 2/5)로 design에 제안 가치 있음.**
- **[BOUNDARY 재확인]** 두 SLG의 동맹(Alliance)은 공식적으로 실시간 플레이어 협력 — 이식 금지 확정. §4.3 Boss Rally Window는 어디까지나 오프라인 단일 플레이어의 자기 동료 합류일 뿐.

---

## 11. 아트 디렉션 (근거: `intake/shared-reference-bundle.md`, `engineering/lane-render-arch.md`)

**스타일 전환 명시**: 기존 배포 스프라이트(`dusk-warden-atlas.png` 등)는 사실적 페인팅 다크판타지. 신규 RPG 레이어는 사용자 레퍼런스 이미지 기준 **셀셰이딩 애니메이션풍**(Hades 비교급), 웜 오텀 팔레트, 파티클 중심 히트이펙트, 미니멀 원형 HUD 아이콘을 채택한다. 이는 §5.1의 Blender 베이크 파이프라인으로 구현(방향 수는 4방향+미러링으로 절감 가능, 8방향 대비 용량 절반).

**카메라**: 레퍼런스 이미지는 사이드뷰지만 사용자 지시는 버즈아이 — 두 축을 별개로 취급(§5.2). 화풍(셀셰이딩·팔레트·파티클 언어)과 카메라 각도(버즈아이·팔로우)는 독립적으로 이식했다.

**마이그레이션 비용**: 기존 사실적 아틀라스는 즉시 폐기하지 않음 — 신규 레이어 전용으로 신규 베이크, 기존 자산과 병존 가능(킬스위치로 상호 롤백). 완전 통일은 Stage 2 이후 아트 리뷰 결정 사항.

---

## 12. 미해결 이슈 — Stage 2 필수 선결 항목

1. **동료 방어투자 무의미화 재검증**(§4.4 PRED-09) — designer가 방어스탯 중첩규칙 확정 후 재검토, 필요시 DOWNED에 런스코프 비용 부여.
2. **R3 시행 지점 확정**(§9) — derive-fn+fire-time 전체 체인을 감싸는 1.3× 상한의 실제 코드 위치, ProgFormationSim+ProgDataArch 공동 결정.
3. **전체 영구 파워 예산 거버넌스 오브젝트**(§9) — R1/R3/R5 공통 완화책을 하나의 상한으로 통합, designer가 `balance-sheet.md`에 명문화.
4. **런↔세션 단위 환산비**(§7.3) — PMForecast+QA 협의.
5. **Track A 리스펙 여부** — 미결정, 이번 사이클 범위 밖.
6. **Bound Fragment 재도전/NG+ 가용성** — 현재 "보스 1회 처치=캠페인 전체 1회"만 확정 커밋, 재도전 시 재계산 필요.
7. **로드아웃 정원 3→N 확장**(§2.4) — 스탠스 오프셋 수학을 N-슬롯으로 일반화하는 선행 작업 필요, Stage 2 이후 후속 안건.
8. **웜팔레트 최종 헥스값 대비 실측**(§6.3) — 디자이너 팔레트 확정 시 UI 레인 6개 표면 재검증.

---

## 13. Stage 1 Gate 자가진단 (draft, QA 실측 전)

```yaml
g7_core_loop_draft:
  status: DRAFT — vanguard-circuit 모델 존재(period_s=60, actions=4, rewards=2), 실측 미실시
  blocking: "빌드 없음 — Stage2 QA playtest 필요"
g1_worldview_draft:
  status: DRAFT — 신규 로어비트 100% 동사체인 추적 완료(design/lane-worldview.md §5), 캐논 무변경 확인
  blocking: "없음 — 문서 레벨에서는 PASS 조건 충족, 실제 콘텐츠 구현 후 재감사 필요"
g6_ops_draft:
  status: DRAFT — telemetry 필드 제안 존재(offline-local, PACING_STAGE_ENTERED 등), resource-manifest 미작성(코드 미구현)
  blocking: "engineering/architecture-contract.md 정식본 미작성 — 15개 lane의 engineering 3편이 그 초안"
overall_verdict: "Stage 1 개념 문서로서 완결. 코드 구현 0줄이므로 실측 게이트는 전부 PENDING — Stage 2 진입 조건은 §12의 8개 미해결 항목 중 1-3번(밸런스 거버넌스) 선결."
```
