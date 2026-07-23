# Lane: RPG Systems (스탯 / 인벤토리 / 스킬트리 / 아이템 등급 / 특성)

- run-id: `20260723-solo-warden-rpg-concept`
- lane: designer × 3 중 1 (`DesignerRPGSystems`)
- 형제 레인: `DesignerWorldview` (`design/lane-worldview.md`, 세계관/서사), `DesignerCoreLoop` (`design/lane-coreloop.md`, 코어 루프/전투 타이밍)
- persona: `.claude/agents/game-designer.md`
- 근거 소스: `production-brief.md`, `shared-reference-bundle.md`, `docs/abyssal-command-defense-survivor-design.md`, `defense-catalog.js` (COMMANDER/ITEMS/REWARDS/ENEMIES/COMPANIONS/SKILLS/BOSSES/STAGES 실측값)

## 0. 스코프와 경계 (director 스티칭용)

이 레인은 **수치 RPG 심화 레이어**만 담당한다: 던전-소스 3 (스탯/인벤토리/스킬트리/아이템 등급/역할군/로그라이크) 어휘를 Abyssal Surge에 이식하는 구체적 숫자와 데이터 모델. 세계관 이름·서사 정당화는 `DesignerWorldview` 소관, 루프 타이밍/포메이션 전투 해석은 `DesignerCoreLoop` 소관이다. 경계선:

- 이 문서가 도입하는 신규 명칭(Echo Core, Bound Fragment, 6개 스탯명, 8개 특성명, 5개 스킬트리 노드명)은 **기능적 placeholder**다. 세계관 보이스에 맞게 다듬는 것은 `DesignerWorldview`의 승인 사항.
- 이 문서는 "얼마나 강해지는가"(수치)만 정의한다. "언제/어떤 액션으로 발동하는가"(루프 타이밍, 포메이션 배치 UX)는 `DesignerCoreLoop` 소관 — 본 레인의 모든 산출물은 "effective power" 스칼라(동료) / "스탯 수정자 집합"(Dusk Warden)으로 코어 루프 계산에 블랙박스 입력된다 (IRC 합의 완료).
- PM 레인(`PMRewardBands`, `PMEngagementMap`)은 이 레인이 정의하는 지급 지점(Echo Core 획득, Bound Fragment 획득, 특성 슬롯 해금)을 인게이지먼트 포인트/보상 밴드의 소스로 인용한다 (IRC 합의 완료).
- **⚠ 구조 분기 — director 조정 필요**: `engineering/lane-data-arch.md`(`ProgDataArch`)는 스탯 어휘를 Warden/동료가 공유하는 5개 범용 스탯(`vitality/power/focus/tenacity/resolve`) + 동료별 `allocatableStatIds` 서브셋 제한 모델로, 장비 등급을 4단계(common/rare/epic/legendary)로, 특성을 동료 evolution 승급 연동(Warden 특성 없음)으로 스키마를 스케치했다. 본 문서(디자인 권위)는 **의도적으로 다른 형태**를 제안한다: Warden 전용 6스탯 + 동료는 스탯 대신 역할(Vanguard/Striker/Support) 패시브, 5단계 장비 등급, 특성은 Warden 전용(동료 아님). 두 스키마는 "어떤 키가 존재하는가"에서 갈리므로 director가 하나를 확정해야 병합 가능 — 필드명 재사용 원칙(`damageBonus`/`maxIntegrity`/`cooldownReduction`/`pickupRange` 등 기존 `ITEMS` 어휘 재사용)은 양쪽이 일치하므로 구현 시 값 삽입 자체는 어느 쪽이 선택되어도 매끄럽다. 스키마 복잡도 델타(`ProgDataArch` IRC 확인): 공유-스탯안은 동료별 `allocatableStatIds` 카탈로그 필드가 추가로 필요하지만, 본 문서의 전용-분리안은 동료 역할-패시브가 그 역할을 대신하므로 그 필드가 아예 불필요 — "Warden만 고유하게 성장" 서사 논거에 더해 이 복잡도 차이도 director 결정 재료로 고려할 것.

## 1. 캐논 준수 체크리스트

| 항목 | 상태 |
|---|---|
| 주인공 이름/정체성 유지 (Dusk Warden) | 준수 — 이름 변경 없음 |
| 기존 검증 체인 유지 (hunt → extract → materialize → capture → assault) | 준수 — 신규 동사 도입 안 함, "materialize" 단계를 영구 성장 소비 지점으로 재사용 |
| 런-스코프 스킬 제안과 영구 동료가 별도 상태라는 기존 계약 | 준수 — 본 레인의 Track A/B는 제3의 영구 상태 레이어로 추가, 기존 두 상태를 대체하지 않음 |
| 실금전 수익화 없음 | 준수 — 모든 자원(Echo Core, Bound Fragment)은 스테이지 클리어/추출 성공으로만 획득, 구매 경로 없음 |
| Solo Leveling/Kingshot/RPG 장르 명칭·수치 직접 복사 금지 | 준수 — 이름은 전부 독자 명명, 구조 원칙만 차용 |

## 2. 전체 구조: 3개 영구 성장 축

기존 계약(요약 1행): **동료 해금(영구) + 런-스코프 스킬(비영구)** 두 축. 본 레인은 여기에 세 번째·네 번째 영구 축을 추가한다:

```yaml
progression_axes:
  - id: run-scoped-skill-offer
    owner: existing-contract
    persistence: run-only
    note: "변경 없음 — 본 문서가 건드리지 않음"
  - id: companion-unlock
    owner: existing-contract
    persistence: campaign-permanent
    note: "변경 없음 — 해금 트리거는 기존 추출 유지, 본 문서는 해금 이후 성장만 추가"
  - id: dusk-warden-progression   # Track A — 신규
    owner: DesignerRPGSystems
    persistence: campaign-permanent
  - id: companion-progression     # Track B — 신규
    owner: DesignerRPGSystems
    persistence: campaign-permanent
  - id: dusk-warden-trait-pool    # 신규, Track A에 종속
    owner: DesignerRPGSystems
    persistence: campaign-permanent
```

---

## 3. Track A — Dusk Warden 고유 영구 성장 (Solo Leveling "Player 시스템" 구조 대응)

### 3.1 왜 고유한가 (수치 근거만; 서사 근거는 `DesignerWorldview` 소관)

Solo Leveling 구조 원칙: 다른 헌터는 관습적 수단(장비, 길드)으로 성장하지만 한 헌터만 비밀 시스템으로 성장한다. Abyssal Surge에서 "다른 헌터"에 대응하는 것이 **동료(Track B)** 다 — 동료는 장비/등급으로 성장한다(관습적). Dusk Warden만 아래 Track A(스탯 포인트 + 전용 스킬트리)에 접근한다. **서사적 근거는 `design/lane-worldview.md`가 확정**: 다른 Warden은 "Ration Sigil"(궁정 매개 배급)로 관습적 성장, Dusk Warden만 "Deepmark"(Gate Zenith 지휘망 절단점에 남은 흔적으로 Echo Deep 잔향을 매개 없이 영구 흡수)로 성장 — 이것이 Solo Leveling "Player 시스템" 구조 대응이며 Track A 전체의 서사적 정당화다 [OBSERVED, IRC 확인: `DesignerWorldview` §1.2].

### 3.2 자원: Echo Core (영구 통화, materialize 단계에서 소비)

**Echo Core = Deepmark에 결속된 잔향(residual echo)의 수치화·소비 가능한 표현** (`design/lane-worldview.md` §1.2 참조) — 이름은 기존 캐논의 "Echo" 접두 관례(Echo Deep, Echo Rusher)와 정합하며 `DesignerWorldview`가 명칭 충돌 없음을 확인함.

| 소스 | 지급량 | 캠페인 내 최대 발생 |
|---|---|---|
| 정예(elite) 처치 후 추출 성공 | 1 Echo Core | 스테이지당 1회 추출 기회 × 10스테이지 = 최대 10 |
| 보스 처치 | 3 Echo Core | 10보스 × 3 = 최대 30 |
| **캠페인 전체 최대 예산** | | **40 Echo Core** [INFERENCE: `STAGES` 10개 항목, 항목당 정예 1종 + 보스 1종 확인, 완주 가정] |

Echo Core는 "materialize" 단계(기존 검증 체인 4번째 동사, 추출된 자원을 영구화하는 지점)에서 스탯 포인트 또는 스킬트리 노드로 전환한다. 전환은 되돌릴 수 없다(리스펙 없음, 동료 해금과 동일한 영속성 규칙 — 이번 사이클 범위 밖의 리스펙 시스템은 제안하지 않음, 후속 사이클 오픈 이슈로 남김).

### 3.3 스탯 블록 (6개 명명 스탯)

기준선: `COMMANDER` (defense-catalog.js) — basicDamage 900, basicCooldown 24틱(0.4s), maxIntegrity 1000, critChance 15%, critMult 2.0×, speed 4100.

| 스탯 ID | 한글명 | 포인트당 효과 | 최대 10포인트 시 총효과 | 게임플레이 효과 (수식) |
|---|---|---|---|---|
| `binding-might` | 결속력 | 기본 공격력 +15 | +150 (기준 900 대비 +16.7%) | `basicDamage += 15 × points` |
| `abyssal-resonance` | 심연 공명 | 액티브 스킬 피해 +2% | +20% | `skillDamage *= 1 + 0.02 × points` |
| `echo-swiftness` | 메아리 신속 | 스킬 쿨다운 −0.5% | −5% (상한, 기존 아이템 쿨다운감소 10%+20%와 중첩 시 과다 방지) | `cooldown *= 1 − 0.005 × points` (points ≤10 고정 상한) |
| `gate-resolve` | 관문 결의 | 최대 내구(개인) +20 | +200 (기준 1000 대비 +20%) | `commander.maxIntegrity += 20 × points` |
| `fracture-precision` | 균열 정밀 | 치명타 확률 +1%p | +10%p (기준 15%→25%) | `critChanceBp += 100 × points` |
| `reclaim-radius` | 회수 반경 | 자원 획득 반경 +150 | +1500 (기준 아이템 `echo-compass` +2500, 스킬 `soul-magnet` +1500과 동일 규모로 정합) | `pickupRange += 150 × points` |

포인트 비용 곡선 (스탯당 공통, escalating — 한 스탯을 10까지 만렙 시 40 Echo Core 전액 소진):

```yaml
system: dusk-warden-stat-cost-curve
cost_formula: "ceil(n/2) + 1  (n = 도달하려는 포인트 레벨, 1-indexed)"
per_point_cost: [2, 2, 3, 3, 4, 4, 5, 5, 6, 6]
cumulative_cost_to_reach_level:
  1: 2
  3: 7
  5: 14
  10: 40
budget_context: "캠페인 완주 시 최대 40 Echo Core. 스탯 1개 만렙 = 예산 100% 소진. 6개 스탯 중 1개만 만렙 가능하거나, 2-3개 스탯을 절반 수준으로 분산 투자하거나, 스탯 일부 + 스킬트리 일부를 병행 — 강제된 트레이드오프." # [TARGET] 설계 의도
data_mirror: "defense-catalog.js COMMANDER 확장 예정 (신규 STAT_GROWTH 테이블) — 미구현, 본 사이클은 문서만"
```

### 3.4 Dusk Warden 전용 스킬트리 (5노드, 2분기 + 공용 캡스톤)

**기존 런-스코프 스킬 제안(`SKILLS` 8종, XP 임계값마다 3택1 제시, 런 종료 시 소멸)과의 명시적 차이:**

| 항목 | 기존 런-스코프 스킬 제안 | 신규 Track A 스킬트리 |
|---|---|---|
| 통화/트리거 | XP 임계값 도달 (런 내 자동) | Echo Core (캠페인 영구 자원) |
| 영속성 | 런 종료 시 소멸, 매 런 재선택 | 캠페인 전체 영구, 1회 선택 후 유지 |
| 선택 구조 | 매 임계값마다 3택1, 독립적 | 선행 노드 요구(트리 구조), 5노드 고정 풀 |
| 효과 형태 | 고정 수치 버프 (예: 데미지+, 쿨다운−) | 조건부 발동형 패시브 (확률 프록, 임계값 트리거) — 기존 스킬과 형태적으로 구분되어 "같은 걸 두 번 얻는다"는 느낌 방지 |
| 대체 관계 | — | **대체하지 않음.** 둘 다 동시에 활성 — 예: 런 중 Dusk Warden은 영구 스킬트리 노드(항상 켜짐) + 그 런에 뽑은 런-스코프 스킬(그 런만)을 동시에 보유 |

노드 구성:

| 노드 ID | 분기 | 선행 | 비용(Echo Core) | 효과 |
|---|---|---|---|---|
| `echo-backlash` | 공격 T1 | 없음 | 5 | 기본 공격 명중 시 10% 확률로 추가 "메아리 타격" 발동, `basicDamage`의 50% 추가 피해 |
| `echo-cascade` | 공격 T2 | `echo-backlash` | 8 | 메아리 타격 발동 확률 +15%p(10%→25%), 추가 피해 비율 +20%p(50%→70%) |
| `wardens-ward` | 생존 T1 | 없음 | 5 | 개인 내구 30% 이하로 최초 하락 시, 최대 내구의 15%만큼 보호막 획득 (런당 1회) |
| `wardens-vigil` | 생존 T2 | `wardens-ward` | 8 | 개인 내구 50% 이하일 때 초당 최대 내구의 0.5% 재생 |
| `echo-warden-awakening` | 공용 캡스톤 | `echo-cascade` AND `wardens-vigil` | 15 | `basicDamage` +10%, 최대 내구 +10%, 그리고 개인 내구가 15% 이하로 최초 하락 시 런당 1회 모든 액티브 스킬 쿨다운 즉시 초기화 |

```yaml
system: dusk-warden-skill-tree
node_count: 5
total_cost_full_tree: 41   # Echo Core; 40 예산 초과 → 풀트리 완성 시 스탯 포인트 투자 거의 불가, 의도된 트레이드오프
capstone_requires_both_branches: true   # Kingshot "loadout specialization, not one BiS" 구조 원칙 적용 — 공격/생존 한쪽만 투자해선 캡스톤 도달 불가
data_mirror: "defense-catalog.js SKILLS와 별도 신규 딕셔너리 (WARDEN_SKILL_TREE) 제안 — 미구현"
```

---

## 4. Track B — 동료 성장 (Kingshot 영웅 구조 대응)

### 4.1 역할군 (역할군/troop-type 대응)

기존 `COMPANIONS` 6종(ember-cohort, rift-lens, veil-vanguard, anchor-shard, throne-echo, dawnless-crown)에 역할군을 배정한다. 힐러 역할은 도입하지 않음 — 기존 `ITEMS`/`REWARDS`에 체력 회복 계열 항목이 전혀 없어(피해량/내구/쿨다운/획득반경 레버만 존재) 오토배틀 동료에게 회복을 부여하는 것은 근거 없는 신규 발명이 되므로 의도적으로 제외 [INFERENCE]. 대신 탱커/딜러/서포터 3역할로 구성:

| 역할 | 소속 동료 | 역할 고유 패시브 | 수치 효과 |
|---|---|---|---|
| Vanguard (수호) | `anchor-shard`, `veil-vanguard` | Bulwark Stance | 동료 자체 내구(§4.2 신규 필드) +30%; 이 동료가 배치된 동안 Commander 피격 데미지 −5% |
| Striker (타격) | `ember-cohort`, `rift-lens` | Focused Assault | 동료 피해량 +20%; 현재 보스/정예 타겟 대상 추가 피해 +10% |
| Support (지원) | `throne-echo`, `dawnless-crown` | Warden's Aid | Commander 획득 반경 +10% (Track A `reclaim-radius`와 가산), Commander 액티브 스킬 쿨다운 −5% |

### 4.2 신규 데이터 필드 요구사항 — `integrity` (동료 내구)

현재 `COMPANIONS` 스키마(damage/fireTicks/range)에는 체력/내구 필드가 없다 — 동료가 피해를 받거나 파괴될 수 있는지는 시뮬레이션 소관(`ProgFormationSim`)이며, 본 레인은 **역할 배율의 기준값으로만** 제안한다. 이 필드가 실제로 전투에서 소모되는지는 확정하지 않음:

| 동료 | 역할 | 제안 base integrity [INFERENCE, 신규 필드] |
|---|---|---|
| anchor-shard | Vanguard | 1200 |
| veil-vanguard | Vanguard | 1200 |
| ember-cohort | Striker | 700 |
| rift-lens | Striker | 700 |
| throne-echo | Support | 850 |
| dawnless-crown | Support | 850 |

### 4.3 장비 슬롯 + 아이템 등급 티어 (5티어)

동료당 3슬롯: **Weapon**(`damage` 배율), **Ward**(`integrity` 배율, §4.2 신규 필드 필요), **Trinket**(`range` 배율). 등급 배율표:

| 티어 | 명칭 | 배율 | 슬롯 대상 수치 상승분 (기준 대비) |
|---|---|---|---|
| T1 | Echo-Bound (메아리 결속) | ×1.00 | 기준 (미장착 동치) |
| T2 | Umbral-Etched (그림자 각인) | ×1.15 | +15% |
| T3 | Void-Forged (공허 단조) | ×1.35 | +35% |
| T4 | Abyss-Tempered (심연 단련) | ×1.60 | +60% |
| T5 | Court-Sealed (궁정 봉인) | ×2.00 | +100% |

```yaml
system: companion-equipment-tier-scaling
tier_count: 5
multiplier_by_tier: [1.00, 1.15, 1.35, 1.60, 2.00]
slot_to_stat_map: { weapon: damage, ward: integrity, trinket: range }
scaling_rule: "슬롯 수치 = base × multiplier_by_tier[현재 티어]"
```

### 4.4 자원: Bound Fragment (동료 장비 전용 통화)

Echo Core(Track A 전용)와 분리된 별도 통화. 이미 해금된 동료의 정예를 다시 처치·포획(capture 동사 재사용)하면 중복 동료 해금 대신 Bound Fragment로 전환된다는 설계 — 단, 캠페인 재도전/NG+ 가용성은 미확정이므로 [INFERENCE]로 표기하고 안전한 하한선으로 "보스 처치 1회당 1개, 스테이지당 1회" 만 확정 커밋한다:

| 소스 | 지급량 | 캠페인 내 최대 |
|---|---|---|
| 스테이지 보스 처치 | 1 Bound Fragment | 10 (10스테이지 × 1) |

```yaml
system: companion-equipment-cost-curve
currency: bound-fragment
campaign_max_budget: 10   # [INFERENCE] 10보스 완주 가정
upgrade_cost_by_tier_step:  # T(n) -> T(n+1)
  "T1->T2": 1
  "T2->T3": 2
  "T3->T4": 3
  "T4->T5": 4
total_cost_full_slot_t1_to_t5: 10   # 전체 예산과 정확히 일치 — 슬롯 1개만 완전 만렙 가능
design_intent: "18슬롯(6동료×3슬롯) 중 단 1슬롯만 T5 도달 가능한 예산. 강제된 동료 특화 — Kingshot 'no single BiS hero, loadout specialization' 구조 원칙 직접 적용." # [TARGET]
data_mirror: "defense-catalog.js COMPANIONS 확장 예정 (신규 integrity 필드, 신규 COMPANION_EQUIPMENT 테이블) — 미구현"
```

### 4.5 역할별 스킬 키트 (6종, 역할 공유 — 개별 동료가 아닌 역할 단위)

| 역할 | 액티브 | 패시브 |
|---|---|---|
| Vanguard | "결속 방벽" — 발동 시 3초간 자신 피격 데미지 −40% | "완강함" — 내구 40% 이하일 때 이동속도 +10% (후퇴 방지용 생존 보정) |
| Striker | "표식 사격" — 발동 시 다음 공격 1회 데미지 +80% | "가속 축적" — 처치마다 공격속도 +2%, 최대 +10%, 피격 시 초기화 |
| Support | "메아리 공명파" — 발동 시 Commander 쿨다운 즉시 −20% (1회성, 자체 쿨다운 있음) | "안정 반경" — Commander가 Support 반경 내에 있을 때 획득 반경 +5% 추가 가산 |

### 4.6 인벤토리 가시성 (필수 명시)

동료 스탯은 **동료별로 구분된 인벤토리 화면**에서 상시 확인·관리 가능해야 한다. 본 레인이 요구하는 데이터 노출 항목 (화면 레이아웃 자체는 `ui-senior-developer` 레인 소관, 아래는 데이터 계약):

```yaml
system: companion-inventory-data-contract
per_companion_fields:
  - id            # 기존
  - name          # 기존
  - role          # 신규 (vanguard | striker | support)
  - base_stats: [damage, integrity, range, fireTicks]   # integrity는 신규(§4.2)
  - equipped: { weapon: tier, ward: tier, trinket: tier }  # 신규
  - effective_stats: [damage, integrity, range]   # base × 티어 배율 적용 후 값, 계산 필드
  - skill_kit: { active: id, passive: id }   # 역할 단위 참조
distinct_per_companion: true   # 6개 동료 모두 독립적 장비/스탯 상태 보유, 공유 풀 아님
```

---

## 5. 캐릭터 특성(Trait) 시스템 — 8종, Dusk Warden 전용

로그라이크/Kingshot식 영구 패시브 수정자. Dusk Warden에게만 부여(동료에게는 부여하지 않음 — 조합 폭발 방지 및 "Warden만 고유하게 성장한다"는 Track A 원칙과 일관, [INFERENCE] 설계 선택). 해금 트리거는 스테이지 클리어이며, 기존 검증된 "3택1 명시적 성장" 패턴(`.survey/abyssal-command-systems-expansion/` 사전 서베이가 확정한 경계 — 배경 전투 없음, 확률적/가챠 보상 없음, 단일 결정론적 정산 원칙)을 그대로 재사용한다:

```yaml
system: dusk-warden-trait-pool
unlock_trigger: stage-clear
unlock_stages: [2, 4, 6, 8, 10]   # 5슬롯
offer_pattern: "pick-1-of-3, 기존 검증된 3택1 패턴 재사용 (확률/가챠 아님, 결정론적 3개 제시)"
persistence: campaign-permanent   # 동료 해금과 동일 영속성, 런 리셋 없음
respec: none   # 이번 사이클 범위 밖 — 후속 오픈 이슈로 명시
```

| ID | 명칭 | 효과 (수치) | 설계 의도 |
|---|---|---|---|
| `first-strike` | 선제격 | 런 시작 후 첫 기본 공격 데미지 +100% (런당 1회) | 초반 정예 처치 속도 가속, 후반 영향 없음 |
| `desperate-echo` | 사투의 메아리 | Commander 내구 25% 이하일 때 `basicDamage` +30% | 하이리스크 딜러 빌드, Gate Resolve 저투자와 상충(트레이드오프) |
| `reckless-reclaim` | 무모한 회수 | 획득 반경 +40%, 피격 데미지 +10% | 클리어 속도 vs 생존 트레이드오프 |
| `gate-keeper` | 관문지기 | 최대 내구 +15%, `basicDamage` −8% | 탱키 빌드, 순수 딜과 상충 |
| `chain-reaction` | 연쇄 반응 | 처치마다 `basicDamage` +3% 중첩(최대 5중첩, 지속 5초, 처치로 갱신) | 물량전 스테이지에서 강함, 단일 강적 스테이지에서 약함 — 스테이지별 가치 비대칭 의도 |
| `elite-hunter` | 정예 사냥꾼 | 정예/보스 대상 피해 +20%, 일반 몹 대상 피해 −10% | 보스 러시 빌드 vs 웨이브 클리어 빌드 분화 |
| `companions-wardpact` | 동료 서약 | 전체 동료 피해 +12%, 전체 동료 사거리 −10% | Track B 근접 특화, 원거리 카이팅과 상충 |
| `echo-overflow` | 메아리 과잉 | 액티브 스킬 쿨다운 −15%, 액티브 스킬 피해 −10% | 스킬 스팸 빌드 vs 스킬 강타 빌드 분화 |

각 특성은 **조건부 발동 또는 명시적 트레이드오프**를 가진다(무조건 상승형 스탯 스틱 없음) — G2 콤보 EV 상한(1.3×) 위반 방지를 시스템 레벨에서 구조적으로 설계한 것.

---

## 6. 밸런스 타겟 (G2 기준, [TARGET] — QA 실측 전 미검증)

기준 DPS/TTK는 캠프 실측이 아니라 `defense-catalog.js` 수치로부터 [INFERENCE] 계산한 값이다. 실측(시뮬레이션/플레이테스트)은 QA 레인 소관.

```
기준 계산 (S1 "Cinder Warden" 보스, hp 40000):
  기본 공격 DPS = 900 / (24/60) = 2250
  치명타 기댓값 배율 = 1 + 0.15×(2.0−1) = 1.15 → 2587.5 dps
  + 액티브 스킬 1종 대표값 (rift-bolt: 1800dmg/390틱) = 276.9 dps
  + 동료 1기 대표값 (ember-cohort: 420dmg/36틱) = 700 dps
  합계 DPS ≈ 3564.4 → TTK ≈ 11.2s
```

```yaml
system: dusk-warden-progression
win_rate_band: [0.45, 0.55]        # [TARGET] 스탯/스킬트리 빌드 다양성(딜 특화 vs 생존 특화) 간 클리어율 격차
ttk_target_s: 11.2                  # [INFERENCE] 기준 계산값, S1 보스, 미투자 상태
ttk_tolerance: 0.15                 # [TARGET] G2 기본 대역 채택, 밴드 = 9.5s–12.9s
combo_ev_cap_vs_median: 1.3         # [TARGET] G2 기본값 채택
data_mirror: "defense-catalog.js COMMANDER (해당 확장 시점까지 미구현)"

---
system: companion-formation-roles
win_rate_band: [0.45, 0.55]        # [TARGET] Vanguard-lead / Striker-lead / Support-lead 3구성 간 동일 스테이지 클리어율
ttk_target_s: 11.2                  # [TARGET] 동일 스테이지 기준, 역할 구성 변경만으로 상단 편차 없어야 함
ttk_tolerance: 0.15
combo_ev_cap_vs_median: 1.3         # [TARGET] 특히 주시 페어: Striker역할 + Weapon T5(동일 슬롯 집중 투자) 조합
data_mirror: "defense-catalog.js COMPANIONS (해당 확장 시점까지 미구현)"

---
system: dusk-warden-trait-synergy
win_rate_band: [0.45, 0.55]        # [TARGET] 8종 특성 각각 최소 1개 이상의 실전 viable 빌드에 포함되어야 함(특정 특성 pick-rate 독점 방지)
ttk_target_s: 11.2
ttk_tolerance: 0.15
combo_ev_cap_vs_median: 1.3         # [TARGET] 감시 대상 페어 명시: (chain-reaction × echo-cascade 노드), (desperate-echo × 낮은 gate-resolve 투자 "글래스캐넌" 빌드) — QA 콤보 매트릭스 우선 검증 요청
data_mirror: "신규 TRAIT_POOL 테이블 (해당 확장 시점까지 미구현)"
```

**파워 예산 상한 (구조적 EV 캡, 수치 이전에 시스템으로 제한):** Echo Core(40) 전액을 스탯 1종 만렙에 쓰면 스킬트리 획득 불가; 풀 스킬트리(41)를 완성하면 스탯 포인트 거의 남지 않음; Bound Fragment(10)는 슬롯 1개만 T5 도달 가능. 따라서 "모든 걸 만렙 찍은 지배적 빌드"는 자원 예산상 캠페인 1회차 내 **불가능** — 이는 [TARGET]이 아니라 위 §3.3/§3.4/§4.4 자원 수식에서 산술적으로 도출되는 구조적 사실이다.

---

## 7. 미해결/후속 사이클 이슈

- Track A 리스펙(스탯/스킬트리 재배분) 여부 — 미결정, 범위 밖.
- Bound Fragment 공급이 "보스 1회 처치 = 캠페인 전체 1회"에 의존 — 재도전/NG+ 가용성이 확정되면 재계산 필요.
- 동료 `integrity` 필드의 실제 전투 소모 여부(파괴 가능한가, 쿨다운 후 부활하는가) — `ProgFormationSim` 확인 필요.

---

## Director Handoff Note

가장 중요한 결정: 세 자원 곡선(Echo Core 40개/캠페인, 스킬트리 총원가 41, Bound Fragment 10개/캠페인 = 슬롯 1개 완전 만렙분)을 **의도적으로 캠페인 전체 예산과 거의 정확히 일치**하도록 설계했다 — 이는 "모든 시스템을 동시에 만렙 찍는 지배 빌드"를 밸런스 튜닝이 아니라 자원 산술 자체로 원천 차단하기 위함이다. Director가 이 예산 상수(40 / 41 / 10) 중 하나라도 조정하면(예: 보스 보상 상향, 정예 수 증가) 세 시스템의 "강제된 트레이드오프" 성질이 깨지므로, 다른 두 자원 곡선도 함께 재계산해야 한다 — 개별 조정 금지, 반드시 세트로 재검토할 것.
