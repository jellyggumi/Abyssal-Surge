# lane-data-arch.md — Dusk Warden RPG 레이어 데이터 아키텍처

```yaml
run_id: 20260723-solo-warden-rpg-concept
lane: engineering / game-programmer (Data Architecture)
stage: 1-concept  # DOCUMENT ONLY — no shipped/committed code this cycle
owner: ProgDataArch
sibling_lanes:
  - { id: ProgRenderArch, artifact: engineering/lane-render-arch.md, facet: bird's-eye 2.5D 렌더링/카메라 }
  - { id: ProgFormationSim, artifact: engineering/lane-formation-sim.md, facet: 포메이션/전투 시뮬레이션 }
schema_version_summary:
  WARDEN_PROGRESS_VERSION: 1        # 신규
  IDLE_RETURN_VERSION: 1            # 기존 — 변경 없음 [OBSERVED campaign-state.js:4]
  campaign_top_level_key_chain: LEGACY_KEYS -> REWARD_KEYS -> CURRENT_KEYS -> RPG_KEYS  # 4단계, 전부 additive
  breaking_migration_required: false
```

## 0. 범위와 경계

이 문서는 **데이터 스키마**만 다룬다: Dusk Warden 영구 성장 상태, 동료(companion)별 스탯/장비/특성
상태, 장비 카탈로그 형태, 저장 호환성/마이그레이션. 이 스키마를 틱 시뮬레이션에 어떻게 적용하는지(전투
수치 계산, 포메이션 배치 로직)는 `ProgFormationSim`(`engineering/lane-formation-sim.md`)의 책임이고,
카메라/렌더 바인딩은 `ProgRenderArch`(`engineering/lane-render-arch.md`)의 책임이다. 이 문서는 그 두
레인이 소비할 **읽기 계약(read contract)**과 저장/마이그레이션 계약만 제공하며, 시뮬레이션 틱 로직이나
렌더 파이프라인은 다루지 않는다. 실제 스탯/스킬/장비 밸런스 수치는 `DesignerRPGSystems`
(`design/`) 레인의 `design/balance-sheet.md` 소관이며, 이 문서에 등장하는 모든 예시 수치는 **스키마
형태를 보여주기 위한 [TARGET] placeholder**이지 확정 밸런스 값이 아니다.

**모든 코드 블록은 일러스트레이션이며 커밋되지 않은 설계 스케치다.** 실제 구현은 Stage 2 이후, 이번
사이클에는 `campaign-state.js`/`defense-catalog.js`에 대한 어떤 diff도 적용하지 않는다.

인접 레인 경계 한 줄 요약:
- `ProgRenderArch` 경계: 이 문서가 정의하는 `WardenProgress`/장비/특성 상태는 렌더 어댑터가 "확정된
  sim state만 읽고 authoring하지 않는다"는 기존 계약([OBSERVED] shared-reference-bundle.md:28)을
  그대로 따르는 읽기 전용 데이터일 뿐, 카메라/투영 방식과는 무관하다.
- `ProgFormationSim` 경계: §5의 `deriveWardenRuntimeStats`/`deriveCompanionRuntimeStats` 함수
  시그니처가 두 레인의 접점이다 — 이 문서는 "카탈로그+영구상태 → 평평한 런타임 수정치" 변환 **계약**만
  정의하고, 그 값을 포메이션 전투 계산에 실제로 소비하는 로직은 `ProgFormationSim`이 설계한다.
- `DesignerRPGSystems` 경계: 스탯 ID 목록, 스킬트리 노드 구조, 장비 등급 체계의 **키(key) 이름**은 이
  문서가 제안하지만, 각 키에 들어갈 **최종 수치**(스탯 1포인트당 효과량, 노드 해금 비용, 장비 등급별
  보너스 폭)는 전적으로 designer 레인 소관이다.

## 1. 아키텍처 결정: 신규 카탈로그 파일 분리 제안

[INFERENCE] 기존 `defense-catalog.js`(613줄, [OBSERVED])는 틱 기반 **단일 런(run)** 시뮬레이션의
authored data(`ENEMIES`, `BOSSES`, `STAGES`, `ITEMS`, `SKILLS` 등, [OBSERVED] defense-catalog.js:132,
258-293)에 책임이 한정되어 있다. Warden 영구 성장/장비/스킬트리 카탈로그는 **런을 넘어 캠페인 전체에
걸쳐 존재하는 메타 진행 데이터**로 관심사가 다르므로, 신규 파일 `rpg-catalog.js`(가칭, 파일명은
placeholder)를 sibling으로 분리할 것을 제안한다.

```
campaign-state.js  ──imports──>  defense-catalog.js   (기존, 변경 없음)
                    ──imports──>  rpg-catalog.js        (신규)
rpg-catalog.js      ──imports──   (없음: defense-catalog.js/campaign-state.js를 import하지 않음)
```

근거: 기존 의존 방향(`campaign-state.js -> defense-catalog.js`, [OBSERVED] campaign-state.js:1)과
동일한 단방향 원칙을 유지해 순환 참조를 만들지 않는다. `architecture-contract.md`가 요구하는 "모듈
경계는 명시적 계약"([OBSERVED] game-programmer.md:17) 원칙과 정합적이며, 단일 런 밸런스 데이터와
캠페인급 메타 데이터가 한 파일에 섞이면 QA의 `qa/gate-measurements.md`나 PM의 forecast 레인이 두
관심사를 구분해서 측정하기 어려워진다는 것이 [INFERENCE] 판단 근거다.

## 2. Dusk Warden 영구 스탯 + 스킬트리 해금 상태

### 2.1 기존 계약과의 관계 — 명시적으로 확장하는 지점

[OBSERVED] `docs/abyssal-command-defense-survivor-design.md`(shared-reference-bundle.md:23이 인용)의
현재 계약: "Permanent companions and run-scoped skills are SEPARATE state; XP/level/skills/positions do
not persist past a run, only companion unlocks do." 이 문서는 이 규칙을 **뒤집지 않는다** — 런 중
XP/레벨/스킬 선택은 여전히 런이 끝나면 사라진다. 대신 Source 1(Solo Leveling)의 구조적 원칙인
"단 한 명만 던전 클리어를 통해 영구적으로 강해지는 시스템"([OBSERVED]
shared-reference-bundle.md:40-48)을 반영해, **companion 영구 해금과 나란히** Dusk Warden 본인의
영구 성장 상태를 새 카테고리로 추가한다. 즉 "런이 끝나면 사라지는 것 / 영구 저장되는 것"의 경계선은
그대로 두되, 영구 저장되는 것의 목록이 `companionCollection` 하나에서 `companionCollection` +
`wardenProgress` 두 개로 늘어난다. 이 결정이 이번 문서에서 director가 알아야 할 가장 중요한 지점이며,
§7 handoff note에서 다시 강조한다.

### 2.2 캠페인 최상위 확장 필드

기존 캠페인 객체 최상위 키 체인은 `LEGACY_KEYS -> REWARD_KEYS -> CURRENT_KEYS`
([OBSERVED] campaign-state.js:46-48)이다. 여기에 `wardenProgress`, `ownedEquipmentIds` 두 키를
**추가**(치환 아님)하여 `RPG_KEYS`로 확장한다.

```typescript
// ILLUSTRATIVE — NOT committed code. 타입 표기는 설계 의도 전달용.

type WardenStatId = string;        // rpg-catalog.js#WARDEN_STATS 키 참조 (§2.3)
type WardenSkillNodeId = string;   // rpg-catalog.js#WARDEN_SKILL_TREE 키 참조 (§2.4)
type EquipmentCatalogId = string;  // rpg-catalog.js#EQUIPMENT_ITEMS 키 참조 (§4)

interface WardenProgress {
  version: number;                             // WARDEN_PROGRESS_VERSION — idleReturn.version과 동일 패턴 [OBSERVED campaign-state.js:49]
  level: number;                                // 영구 레벨. 런 중 commander XP/level과는 별개 필드, 절대 공유하지 않음
  totalStatPoints: number;                      // 스테이지 클리어 누적 획득 포인트 (§2.5)
  allocatedStats: Record<WardenStatId, number>; // statId -> 배분 포인트. sum(values) <= totalStatPoints (불변식)
  unlockedSkillNodeIds: WardenSkillNodeId[];    // 정렬·중복없음 — resolvedIds/achievementIds 패턴과 동일 [OBSERVED campaign-state.js:96-97,102]
  equippedSkillNodeIds: WardenSkillNodeId[];    // unlockedSkillNodeIds의 부분집합, <= MAX_EQUIPPED_SKILL_NODES
}

// 캠페인 최상위에 추가되는 두 필드:
interface CampaignStateRPGExtension {
  wardenProgress: WardenProgress;
  ownedEquipmentIds: EquipmentCatalogId[];  // 정렬·중복없음, rewardIds/achievementIds 패턴 재사용 (§4.3)
}
```

`initialWardenProgress()` 팩토리는 기존 `initialIdleReturn()`([OBSERVED] campaign-state.js:49)과
동일한 형태의 헬퍼로 제안한다:

```typescript
// ILLUSTRATIVE — NOT committed code
const initialWardenProgress = () => ({
  version: WARDEN_PROGRESS_VERSION,
  level: 0,
  totalStatPoints: 0,
  allocatedStats: {},
  unlockedSkillNodeIds: [],
  equippedSkillNodeIds: [],
});
```

### 2.3 WARDEN_STATS 카탈로그 (rpg-catalog.js)

RPG 장르 구조적 어휘(스탯/인벤토리/스킬트리, [OBSERVED] shared-reference-bundle.md:73-75)를 따라
5개 스탯 카테고리를 **구조만** 제안한다 — 이름과 서술만 예시이고 어떤 실수치도 확정하지 않는다. 실제
수치(포인트당 효과량)는 designer 레인의 `balance-sheet.md`에서 채워진다.

| statId (예시) | 이름(예시) | 서술 목적(구조적) | 수치 상태 |
|---|---|---|---|
| `vitality` | 생명력 | 최대 체력/관문 방어 관련 파생치 | [TARGET] placeholder, 값 미정 |
| `power` | 위력 | 기본 공격/스킬 피해 관련 파생치 | [TARGET] placeholder, 값 미정 |
| `focus` | 집중 | 스킬 쿨다운 감소 관련 파생치 | [TARGET] placeholder, 값 미정 |
| `tenacity` | 인내 | 피격 시 관문/HP 손실 경감 관련 파생치 | [TARGET] placeholder, 값 미정 |
| `resolve` | 결의 | 픽업 반경/자원 흡수 관련 파생치 (기존 `pickupRange` 계열과 접점, [OBSERVED] defense-catalog.js:135) | [TARGET] placeholder, 값 미정 |

```typescript
// ILLUSTRATIVE — NOT committed code. 수치는 전부 placeholder이며 실제 값은 designer 레인 소관.
export const WARDEN_STATS = freeze({
  vitality: { id: "vitality", name: "생명력", description: "...", pointEffect: { maxIntegrity: 0 } }, // pointEffect 값은 미정 placeholder
  power:    { id: "power",    name: "위력",   description: "...", pointEffect: { damageBonus: 0 } },
  focus:    { id: "focus",    name: "집중",   description: "...", pointEffect: { cooldownReduction: 0 } },
  tenacity: { id: "tenacity", name: "인내",   description: "...", pointEffect: { gateDamageReduction: 0 } },
  resolve:  { id: "resolve",  name: "결의",   description: "...", pointEffect: { pickupRange: 0 } },
});
export const WARDEN_STAT_IDS = freeze(Object.keys(WARDEN_STATS));
```

이 `pointEffect` 필드 이름들은 기존 `ITEMS`/`REWARDS` 엔트리가 이미 사용 중인 필드명
(`damageBonus`, `maxIntegrity`, `cooldownReduction`, `gateDamageReduction`, `pickupRange`,
[OBSERVED] defense-catalog.js:133-147)과 **의도적으로 동일한 이름**을 재사용해, `ProgFormationSim`이
런타임에 두 출처(런 스코프 `ITEMS` 효과 vs 영구 `WARDEN_STATS` 효과)를 같은 누산 로직으로 합산할 수
있도록 설계했다 — 이것이 §5의 파생 함수 계약이 존재하는 이유다.

### 2.4 WARDEN_SKILL_TREE 카탈로그 — 선행조건 DAG

```typescript
// ILLUSTRATIVE — NOT committed code
interface WardenSkillNode {
  id: WardenSkillNodeId;
  name: string;
  description: string;
  tier: number;                         // 1부터 시작, 선행조건 tier보다 커야 함(불변식)
  prerequisiteIds: WardenSkillNodeId[];  // 빈 배열 = 루트 노드
  unlockCost: number;                   // totalStatPoints에서 차감(placeholder, designer 소관)
  effect: Record<string, number>;       // WARDEN_STATS.pointEffect와 동일 필드명 어휘 재사용
}
export const WARDEN_SKILL_TREE = freeze({
  "warden-root-strike":   { id: "warden-root-strike",   name: "...", description: "...", tier: 1, prerequisiteIds: [], unlockCost: 0, effect: { damageBonus: 0 } },
  "warden-tier2-echo":    { id: "warden-tier2-echo",    name: "...", description: "...", tier: 2, prerequisiteIds: ["warden-root-strike"], unlockCost: 0, effect: { cooldownReduction: 0 } },
});
export const MAX_EQUIPPED_SKILL_NODES = 3; // [TARGET] MAX_LOADOUT_SIZE=3 선례([OBSERVED] campaign-state.js:20)와 UI 인지 부하 정합성 맞춤 placeholder — designer 재조정 가능
```

`MAX_EQUIPPED_SKILL_NODES`를 카탈로그 상수로 뒀는지 코드 상수로 뒀는지가 중요한 구분점이다 — §6에서
"구조적 상한 vs 밸런스 수치" 원칙을 표로 정리한다.

### 2.5 스탯 포인트 획득 — 스테이지 클리어 훅

```typescript
// ILLUSTRATIVE — NOT committed code. STAGE_ITEM_IDS/STAGE_REWARD_IDS와 동일한 stage-id keyed map 패턴.
export const STAGE_WARDEN_STAT_AWARD = freeze({
  "cinder-span": 0,     // [TARGET] placeholder
  "veil-citadel": 0,
  // ... 전체 10개 스테이지, defense-catalog.js STAGE_ITEM_IDS와 동일 키 집합 [OBSERVED defense-catalog.js:540-551]
});
```

기존 `applyCampaignRunResult`([OBSERVED] campaign-state.js:85-106)는 victory 시
`resolvedIds`/`achievementIds`/`rewardIds`를 갱신한다. 이 함수를 **확장**(대체 아님)해 승리 시
`wardenProgress.totalStatPoints`에 `STAGE_WARDEN_STAT_AWARD[stageId]`를 더하는 한 줄을 추가하는
것으로 제안한다 — 숫자는 카탈로그에서만 오고, 함수 본문에는 어떤 정수 리터럴도 새로 등장하지 않는다
(원칙 2 준수, [OBSERVED] game-programmer.md:30).

## 3. 동료(Companion)별 스탯/장비/특성 상태

### 3.1 기존 키잉(keying) 방식 그대로 재사용

[OBSERVED] `companionCollection`은 `COMPANIONS` 카탈로그 키를 가리키는 `prototype` 문자열로 각
레코드를 식별한다(`canonicalPrototype`, campaign-state.js:27,61). 신규 필드도 **동일한
`prototype` 키**에 매달아 확장한다 — 별도의 companion-id 네임스페이스를 만들지 않는다.

```typescript
// ILLUSTRATIVE — NOT committed code
interface CompanionRecord {
  // 기존 필드 — 변경 없음 [OBSERVED campaign-state.js:61]
  prototype: string;              // COMPANIONS 카탈로그 키 FK
  evolution: number;               // 1..3
  capturedEliteIds: string[];

  // 신규 추가 필드 (additive):
  statPoints: {
    earned: number;                                   // evolution 승급 시 획득 (§3.3)
    allocated: Record<WardenStatId, number>;           // WARDEN_STATS 어휘 재사용 — sum <= earned
  };
  equipment: Record<EquipmentSlotId, EquipmentCatalogId | null>; // §4 슬롯별 장착 상태
  traits: {
    unlockedIds: CompanionTraitId[];  // evolution 승급 시 해금 (§3.4)
    activeIds: CompanionTraitId[];    // unlockedIds 부분집합, <= COMPANION_ACTIVE_TRAIT_CAP
  };
}
```

### 3.2 companion 스탯이 warden 스탯과 같은 어휘를 공유하는 이유

[INFERENCE] `WARDEN_STATS`(§2.3) 어휘를 companion에도 재사용하도록 제안한다 — 별도의
`COMPANION_STATS` 카탈로그를 만들지 않는다. 근거: Source 3의 "스탯/능력치" 구조적 어휘는 캐릭터
유형과 무관하게 하나의 시스템이며, 어휘를 통일하면 §5의 파생 함수가 warden/companion에 대해 동일한
합산 로직을 재사용할 수 있다. 다만 어떤 companion prototype이 어떤 스탯 서브셋을 배분 가능한지는
`COMPANIONS` 카탈로그 엔트리에 `allocatableStatIds` 필드를 additive로 추가해 제어한다(이것은 저장
데이터가 아닌 authored 데이터이므로 마이그레이션 대상이 아니다):

```typescript
// ILLUSTRATIVE — NOT committed code. 기존 COMPANIONS 엔트리에 필드 추가하는 예시.
"ember-cohort": {
  id: "ember-cohort", name: "Ember Cohort", damage: 420, fireTicks: 36, range: 4600, // 기존 필드 [OBSERVED defense-catalog.js:265]
  allocatableStatIds: ["power", "focus"],   // 신규 additive 필드 — 이 companion은 power/focus만 배분 가능
},
```

### 3.3 companion 스탯 포인트 획득 — evolution 승급 훅

`captureElite`([OBSERVED] campaign-state.js:133-148)가 이미 `evolution`을 1→3으로 승급시킨다.
이 지점에 companion `statPoints.earned` 증가를 추가로 훅한다 — 새 정수 리터럴을 로직에 심지 않고
`COMPANION_EVOLUTION_STAT_AWARD`(카탈로그, evolution 레벨→포인트 맵) 참조로 처리한다.

### 3.4 특성(Trait) — Kingshot 구조적 원칙과의 접점

[OBSERVED] shared-reference-bundle.md:55-56: "hero good-for-exploration != good-for-large-scale
-expedition (loadout specialization, not one BiS hero)". 이 구조적 원칙을 특성 시스템으로 반영한다:
companion마다 evolution 승급 시 특성 슬롯이 열리고, 어떤 특성을 활성화하느냐로 "탐색형 vs 원정형"
같은 역할 특화가 갈리도록 스키마를 열어둔다. 다만 실제 포메이션 역할 계산은 `ProgFormationSim`
소관이므로, 이 문서는 `traits.activeIds`가 존재한다는 것과 카탈로그 형태만 정의한다.

```typescript
// ILLUSTRATIVE — NOT committed code
export const COMPANION_TRAITS = freeze({
  "vanguard-specialist": { id: "vanguard-specialist", name: "...", description: "...", roleAffinity: "assault", effect: {} }, // [TARGET] placeholder
  "extraction-specialist": { id: "extraction-specialist", name: "...", description: "...", roleAffinity: "extraction", effect: {} },
});
export const COMPANION_TRAIT_SLOTS_BY_EVOLUTION = freeze({ 1: 0, 2: 1, 3: 2 }); // evolution -> 해금 슬롯 수, [TARGET] placeholder
export const COMPANION_ACTIVE_TRAIT_CAP = 2; // [TARGET] placeholder — 밸런스 수치이므로 카탈로그에 위치(§6 원칙)
```

## 4. 장비(Equipment) 카탈로그 — `defense-catalog.js` 저작 패턴을 따르되 명확히 구분

### 4.1 기존 `ITEMS`와의 결정적 차이 — 이름 충돌 주의

[OBSERVED] 기존 `ITEMS`(defense-catalog.js:132-138)는 **런 스코프 픽업**이다 — 웨이브 중 엘리트를
잡으면 필드에 드롭되고(`STAGE_ITEM_IDS`, [OBSERVED] defense-catalog.js:768-770), 획득 즉시
`run.commander.basicDamage`/`run.gate.maxIntegrity`에 직접 가산되며([OBSERVED]
defense-run-simulation.js:400-404) **런이 끝나면 사라진다** — `campaign-state.js`는 `ITEMS`를 전혀
import하지 않는다([OBSERVED] campaign-state.js:1, `COMPANIONS, REWARDS, STAGE_REWARD_IDS`만 import).

반면 이 절에서 제안하는 장비는 **캠페인에 영구 저장**되고 warden/companion에 장착되는 상태다. 이름
충돌을 피하기 위해 신규 카탈로그 export 이름을 `ITEMS`가 아닌 **`EQUIPMENT_ITEMS`**로 명시적으로
제안한다. `defense-run-simulation.js`의 기존 런-스코프 아이템 로직은 이번 제안으로 전혀 건드리지
않는다 — 두 시스템은 이름도, 저장 위치도, 생명주기도 완전히 분리된 별개 카탈로그다.

### 4.2 장비 인스턴스 없음 — 결정론적 카탈로그 참조만

[OBSERVED] `.survey/abyssal-command-systems-expansion/`의 기존 경계(shared-reference-bundle.md:29-33
가 인용): "no probabilistic/gacha rewards, single deterministic settlement per return". 이 경계를
장비 시스템에도 그대로 적용한다 — 장비는 **무작위 스탯 롤이 붙은 고유 인스턴스가 아니라**, `COMPANIONS`/
`REWARDS`가 이미 그렇듯 카탈로그 id로만 참조되는 결정론적 authored 엔트리다. 이 결정으로 인스턴스별
고유 ID 생성, 인스턴스 인벤토리 배열, 롤 확률 테이블이 전부 불필요해진다 — 스키마가 훨씬 단순해지고
기존 "확정적 정산" 원칙과 완전히 정합된다.

```typescript
// ILLUSTRATIVE — NOT committed code
type EquipmentSlotId = "weapon" | "armor" | "trinket"; // Source 3 RPG 어휘: 인벤토리/아이템 등급
export const EQUIPMENT_SLOTS = freeze({
  weapon:  { id: "weapon",  name: "무기" },
  armor:   { id: "armor",   name: "방어구" },
  trinket: { id: "trinket", name: "장신구" },
});
export const EQUIPMENT_SLOT_IDS = freeze(Object.keys(EQUIPMENT_SLOTS));

type EquipmentGrade = "common" | "rare" | "epic" | "legendary"; // Source 3 "아이템 등급" 구조적 어휘, 수치 미포함

interface EquipmentItem {
  id: EquipmentCatalogId;
  name: string;
  description: string;
  slot: EquipmentSlotId;
  grade: EquipmentGrade;
  ownerScope: "warden" | "companion" | "shared";  // 어떤 엔티티가 장착 가능한지
  statBonuses: Record<string, number>;             // WARDEN_STATS.pointEffect와 동일 필드명 어휘 재사용
}
export const EQUIPMENT_ITEMS = freeze({
  "warden-blade-t1": {
    id: "warden-blade-t1", name: "...", description: "...",
    slot: "weapon", grade: "common", ownerScope: "warden",
    statBonuses: { damageBonus: 0 }, // [TARGET] placeholder — 실제 값은 balance-sheet.md
  },
  "companion-ward-charm": {
    id: "companion-ward-charm", name: "...", description: "...",
    slot: "trinket", grade: "rare", ownerScope: "companion",
    statBonuses: { maxIntegrity: 0 }, // [TARGET] placeholder
  },
});
```

### 4.3 소유 vs 장착 — 공유 풀 + 배타적 장착 불변식

`ownedEquipmentIds`(§2.2)는 캠페인이 획득한 장비 id의 **공유 풀**이다(중복 없는 flat 목록, `rewardIds`
패턴 재사용). 장착은 `wardenProgress`에는 없고 별도로 두지 않으며, warden 자신도 companion과 동일하게
`equipment: Record<EquipmentSlotId, EquipmentCatalogId | null>` 형태를 갖는다(§3.1 구조와 대칭 —
`WardenProgress`에도 이 필드를 추가해야 한다는 뜻이므로 §2.2 인터페이스를 아래처럼 보정한다):

```typescript
// ILLUSTRATIVE — NOT committed code. §2.2 WardenProgress 인터페이스에 추가되는 필드.
interface WardenProgress {
  // ...§2.2의 기존 필드들...
  equipment: Record<EquipmentSlotId, EquipmentCatalogId | null>;
}
```

**불변식**: 한 `EquipmentCatalogId`는 warden의 `equipment`와 모든 companion의 `equipment`를 통틀어
**최대 1곳에만** 장착될 수 있다(같은 검을 warden과 companion이 동시에 들 수 없음) — 이는 물리적
아이템 개념을 지키는 데이터 무결성 규칙이며, 검증 함수 `allEquippedEquipmentIds(campaign)`가 전체
장착 슬롯을 모아 중복을 검사하는 형태로 제안한다(§5.2 검증 표에 포함).

## 5. 런타임 파생 계약 — ProgFormationSim과의 접점

이 절은 시뮬레이션 로직 자체가 아니라, `ProgFormationSim`이 소비할 **순수 함수 시그니처 계약**만
정의한다.

```typescript
// ILLUSTRATIVE — NOT committed code. 함수 본문은 ProgFormationSim 소관, 시그니처만 계약.
interface RuntimeStatModifiers {
  damageBonus: number;
  maxIntegrity: number;
  cooldownReduction: number;
  gateDamageReduction: number;
  pickupRange: number;
  // 필드명은 기존 ITEMS/REWARDS 필드명과 동일 어휘 — run-scope 값과 합산 가능하도록 설계 (§2.3)
}

function deriveWardenRuntimeStats(
  wardenProgress: WardenProgress,
  ownedEquipmentIds: EquipmentCatalogId[],
  catalog: { WARDEN_STATS, WARDEN_SKILL_TREE, EQUIPMENT_ITEMS },
): RuntimeStatModifiers;

function deriveCompanionRuntimeStats(
  record: CompanionRecord,
  ownedEquipmentIds: EquipmentCatalogId[],
  catalog: { WARDEN_STATS, COMPANION_TRAITS, EQUIPMENT_ITEMS },
): RuntimeStatModifiers;
```

두 함수는 순수 함수(입력 → 출력, 부수효과 없음)이며 어떤 숫자 리터럴도 함수 본문에 두지 않는다 —
모든 계수는 `catalog` 인자를 통해서만 들어온다. 이 계약이 원칙 2("balance numbers live in data
files")를 코드 레벨에서 강제하는 지점이다.

### 5.2 검증 불변식 표 (validCampaign 확장 시 체크할 조건)

| 필드 | 불변식 | 근거 |
|---|---|---|
| `wardenProgress.allocatedStats` | 키 ⊆ `WARDEN_STAT_IDS`, `sum(values) <= totalStatPoints` | 획득한 것보다 많이 배분 불가 |
| `wardenProgress.unlockedSkillNodeIds` | `validIds()`, 각 id ∈ `WARDEN_SKILL_TREE`, 선행조건(prerequisiteIds) 폐포 만족 | DAG 무결성 |
| `wardenProgress.equippedSkillNodeIds` | ⊆ `unlockedSkillNodeIds`, `length <= MAX_EQUIPPED_SKILL_NODES` | 해금 안 한 노드 장착 불가 |
| `wardenProgress.equipment[slot]` | `null` 또는 `EQUIPMENT_ITEMS[id].slot === slot` 이고 `ownerScope ∈ {warden, shared}` | 슬롯-등급 정합성 |
| `record.statPoints.allocated` | 키 ⊆ `COMPANIONS[prototype].allocatableStatIds`, `sum <= earned` | prototype별 배분 가능 스탯 제한 |
| `record.traits.activeIds` | ⊆ `unlockedIds`, `length <= COMPANION_ACTIVE_TRAIT_CAP` | 슬롯 상한 |
| 전역 | `allEquippedEquipmentIds(campaign)`에 중복 없음 | §4.3 배타적 장착 |
| 전역 | `ownedEquipmentIds`에 없는 id는 어디에도 장착 불가 | 소유하지 않은 장비 장착 방지 |

## 6. 원칙 — "구조적 상한(코드 상수)" vs "밸런스 수치(카탈로그)"

| 값 | 위치 | 선례/근거 |
|---|---|---|
| `MAX_LOADOUT_SIZE = 3` | 코드 로컬 상수 | [OBSERVED] campaign-state.js:20 — 기존 선례, companion 슬롯의 구조적(UI/엔진) 상한으로 취급됨 |
| `MAX_EQUIPPED_SKILL_NODES` | 이 문서는 위 선례를 그대로 따라 코드 상수급 취급을 제안하되, 재조정 요구가 잦을 것으로 예상되어 **카탈로그 상수**로 배치 | [INFERENCE] — 스킬트리는 companion 슬롯보다 튜닝 빈도가 높을 것으로 예상 |
| `COMPANION_ACTIVE_TRAIT_CAP`, `STAGE_WARDEN_STAT_AWARD`, `COMPANION_EVOLUTION_STAT_AWARD`, 모든 `statBonuses`/`pointEffect`/`unlockCost` 값 | 카탈로그(데이터 파일) | 원칙 2 직접 적용 — "a retune must never require a code change" [OBSERVED] game-programmer.md:30 |
| `RPG_KEYS`, `EQUIPMENT_SLOT_IDS` 같은 스키마 키 목록 | 코드 상수 | 이것은 밸런스 수치가 아니라 스키마 구조 자체이므로 코드에 두는 것이 맞음 |

구분 기준: **엔진/자료구조의 형태를 결정하는 값(슬롯 개수, 키 목록)** 은 코드에, **플레이 밸런스를
결정하는 값(포인트당 효과, 비용, 상한 캡처럼 플레이테스트로 조정될 값)** 은 카탈로그에 둔다. 애매한
경계(`MAX_EQUIPPED_SKILL_NODES`)는 이 문서에서 [INFERENCE]로 카탈로그 쪽에 배치했다 — designer 레인이
반대 의견이면 `balance-sheet.md#band-overrides` 절차([OBSERVED] quality-gates.md:43-44)로 뒤집을 수
있다.

## 7. 저장 호환성과 JSON 직렬화 — 마이그레이션 불필요, 스키마 버전은 그래도 부여

### 7.1 JSON 직렬화 가능성 확인

이 문서가 제안하는 모든 신규 필드(`wardenProgress`, `ownedEquipmentIds`, `statPoints`, `equipment`,
`traits`)는 오직 문자열, 숫자, 불리언, `null`, 배열, 순수 객체로만 구성된다 — `Map`/`Set`/함수/
`Symbol`/순환 참조가 전혀 없다. 이는 기존 `serializeCampaign`/`restoreCampaign`([OBSERVED]
campaign-state.js:156-166)이 이미 `JSON.parse`/`JSON.stringify`만으로 왕복하는 것과 동일한 제약이며,
신규 필드도 같은 제약을 그대로 만족한다 — 오프라인 local-storage + JSON export/import 계약
([OBSERVED] shared-reference-bundle.md:26-27)을 깨지 않는다.

### 7.2 마이그레이션 체인 — additive, 브레이킹 체인지 아님

기존 마이그레이션 체인은 4단계였다:
`LEGACY_KEYS` → (+`rewardIds`,`achievementIds`) → `REWARD_KEYS` → (+`idleReturn`) → `CURRENT_KEYS`
([OBSERVED] campaign-state.js:50-56, `migrateCampaign`). 이 문서는 5번째 단계를 **동일한 패턴으로**
추가한다:

```typescript
// ILLUSTRATIVE — NOT committed code. 기존 migrateCampaign 함수를 확장하는 형태.
const RPG_KEYS = [...CURRENT_KEYS, "wardenProgress", "ownedEquipmentIds"];

function migrateCampaign(value) {
  if (!isPlainObject(value)) return value;
  if (hasOnlyKeys(value, LEGACY_KEYS)) return { ...value, rewardIds: [], achievementIds: [], idleReturn: initialIdleReturn() };
  if (hasOnlyKeys(value, [...LEGACY_KEYS, "idleReturn"])) return { ...value, rewardIds: [], achievementIds: [] };
  if (hasOnlyKeys(value, REWARD_KEYS)) return { ...value, idleReturn: initialIdleReturn() };
  // 신규 5번째 단계 — 기존 CURRENT_KEYS 형태 세이브에 warden/장비 기본값 추가:
  if (hasOnlyKeys(value, CURRENT_KEYS)) {
    return {
      ...value,
      wardenProgress: initialWardenProgress(),
      ownedEquipmentIds: [],
      companionCollection: value.companionCollection.map(migrateCompanionRecord),
    };
  }
  return value;
}

// companionCollection 배열 내부 레코드는 최상위 hasOnlyKeys 체인에 걸리지 않으므로 별도 backfill 필요:
function migrateCompanionRecord(record) {
  if (Object.hasOwn(record, "statPoints")) return record; // 이미 마이그레이션됨 — 멱등
  return {
    ...record,
    statPoints: { earned: 0, allocated: {} },
    equipment: Object.fromEntries(EQUIPMENT_SLOT_IDS.map((slot) => [slot, null])),
    traits: { unlockedIds: [], activeIds: [] },
  };
}
```

**왜 브레이킹 체인지가 아닌가**: 기존 필드(`prototype`, `evolution`, `capturedEliteIds`,
`campaignId`, `resolvedIds` 등) 중 어느 하나도 이름을 바꾸거나, 타입을 바꾸거나, 제거하지 않는다.
기존 세이브를 로드하면 신규 필드가 전부 "빈 상태"(0포인트, 빈 배열, 빈 장착 슬롯)로 채워질 뿐이고,
그 즉시 계속 플레이 가능하다 — 기존 companion/스테이지 진행 상황은 바이트 하나도 손실되지 않는다.
따라서 이 문서의 제안은 "브레이킹 체인지가 불가피할 때의 버전+마이그레이션 노트"가 아니라, **불필요한
브레이킹 체인지를 additive 마이그레이션으로 회피하는 설계**다.

### 7.3 그럼에도 `wardenProgress`에 독립 버전 필드를 부여하는 이유

`idleReturn`이 캠페인 전체 마이그레이션 체인과는 별도로 자신만의 `version`/`IDLE_RETURN_VERSION`을
갖는 것([OBSERVED] campaign-state.js:4,49,66)과 동일한 선례를 따라, `wardenProgress`도
`WARDEN_PROGRESS_VERSION`을 갖도록 제안한다. 이유는 지금 당장 브레이킹 체인지가 필요해서가 아니라,
**나중에** 스킬트리 구조나 스탯 어휘 자체가 바뀌는 경우(예: 스탯 카테고리를 5개에서 7개로 재설계) 그
변경을 캠페인 전체 마이그레이션 체인을 다시 건드리지 않고 `wardenProgress` 서브트리 안에서만
독립적으로 처리할 수 있게 하기 위함이다 — `idleReturn`이 이미 증명한 확장 여지를 그대로 재사용하는
[INFERENCE] 설계 결정이다. 미래에 실제로 브레이킹 체인지가 필요해지면, 그 시점의 마이그레이션 노트는
`if (candidate.wardenProgress.version === 1) return { ...candidate, wardenProgress: migrateWardenProgressV1toV2(candidate.wardenProgress) }` 형태로 `idleReturn`과 같은 국소 패턴을 따르면 된다.

## 8. Director Handoff Note

가장 중요한 결정 하나: 이 문서는 기존 계약 문구 "only companion unlocks persist"(companion 해금만
런을 넘어 영구 저장된다)를 조용히 어기지 않고, **명시적으로 확장**한다 — companion 영구 해금과
나란히 Dusk Warden 본인의 영구 스탯/스킬트리/장비 상태라는 두 번째 영구 저장 카테고리를 추가하는
것이 이 RPG 레이어의 핵심이며, Solo Leveling의 "유일하게 영구 성장하는 주인공" 구조 원칙을 구현하는
데 반드시 필요한 지점이다. 이 확장은 기존 세이브 파일과 100% 하위 호환(additive migration, §7.2)이고
어떤 밸런스 수치도 로직에 하드코딩하지 않지만(§6), `docs/abyssal-command-defense-survivor-design.md`
의 원문 문구 자체는 이제 "companion 해금 + warden 영구 진행"으로 갱신되어야 한다는 점을 director가
공식 GDD 병합 시 그 문서의 해당 문장도 함께 갱신하도록 반드시 인지해야 한다 — 그렇지 않으면 신규
RPG 레이어가 기존 product-contract 문서와 문면상 모순되는 상태로 남는다.
