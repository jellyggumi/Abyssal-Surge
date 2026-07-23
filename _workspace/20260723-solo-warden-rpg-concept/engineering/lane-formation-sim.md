# Lane: Formation-Battle Simulation Extension

役割: game-programmer / Formation & Squad Battle Simulation
소스: `defense-run-simulation.js`(결정론적 고정 60Hz 시뮬레이션), `defense-catalog.js`(데이터),
`campaign-state.js`(영구 캠페인 상태). 인용 권위 문서: `docs/abyssal-command-defense-survivor-design.md`.

## 0. 불변식 선언 (Invariant Declaration) — 절대 우선

> **DETERMINISM INVARIANT (변경 불가)**: 동일한 저장 상태(save-state) + 동일한 입력 시퀀스 = 항상 동일한
> 출력(`getRunDigest` 동일값). 이 문서가 제안하는 모든 신규 시스템 — 포메이션 슬롯, 랠리 윈도우, 소모(attrition) —
> 은 이 불변식을 위반하지 않는 것으로 **설계 시점부터 증명 가능해야 한다**. 위반 조건: 실시간(`Date.now()`,
> `performance.now()`) 참조, 시드되지 않은 난수, 순회 순서가 안정적으로 정렬되지 않은 컬렉션, 렌더 프레임률에
> 종속된 로직. 아래 모든 제안은 이 4가지 위반 조건에 대해 명시적으로 무죄를 증명한다.

기존 코드가 이미 이 불변식을 지키는 방식([OBSERVED], `tests/defense-run-simulation.test.mjs:133-143`):
동일 시드 + 동일 입력 → `assert.equal(getRunDigest(left), getRunDigest(right))`. `run.combatRng`는
xorshift32로 시드되며(`defense-run-simulation.js:23`), 모든 배열 정렬은 `id.localeCompare`로 안정화된다
(`sortedActors`, `orderedTargets` 등 — `defense-run-simulation.js:32,330-337`). 신규 코드는 이 관용구를
그대로 재사용한다.

## 1. 현재 기반(substrate) 분석 — 무엇을 확장하는가

[OBSERVED, `defense-run-simulation.js:170-177,1401-1410`] 현재 동료(companion)는:
- `createDefenseRun`이 받는 `companionLoadout` 배열(정원 3, `campaign-state.js:20`
  `MAX_LOADOUT_SIZE`)로 런 시작 **이전에** 확정되어 `run.companions`에 얼려 넣어진다 — 이미 "사전 UI 선택이
  아니라 시뮬레이션 입력"이라는 원칙은 성립해 있다. 확장이 필요한 것은 슬롯 세분화다.
- 매 tick 커맨더 좌표에 스냅(`companion.x = run.commander.x`)하는 무편성(no-formation) 포탑이다 —
  전열/후열 구분, 상대 오프셋, 피격 판정이 전혀 없다.
- `hp: 1, maxHp: 1`의 더미 체력을 가지며 [OBSERVED, `defense-run-simulation.js:174`] 적 AI 타겟팅
  함수(`getTargetPosition`, `pressureTarget`, `defense-run-simulation.js:808-857`)는 `"commander"`와
  `"gate"` 두 개의 하드코딩된 타겟만 인식한다 — 동료는 구조적으로 피격 불가능. 소모(attrition)를 실장하려면
  이 타겟 해석 계층을 확장해야 한다.
- 전투 기여도는 `orderedTargets`가 매긴 사거리 내 최우선 순위 적을 향한 단순 DPS 합산이며, 편성 간
  시너지·상호작용이 없다 — "구성이 화력보다 중요하다"는 Kingshot 원칙이 아직 반영되어 있지 않다.

## 2. 편성 구성 → 시뮬레이션 입력 (Formation-as-Input)

### 2.1 데이터 형태 변경

`companionLoadout: string[]` (현재, ID 배열) →
`formation: { companionId: string, slot: "FRONT" | "BACK" }[]` (제안).

```yaml
formation_schema:
  max_slots: 3                 # 관측값 유지, campaign-state.js:20 MAX_LOADOUT_SIZE 불변
  max_front: 2                 # [TARGET] 근거: 최소 1 BACK 슬롯을 항상 남겨 "전부 전열"이
                                # 무의미한 극단이 되지 않게 함 — 구성 선택 긴장 유지
  min_front: 0                 # 하위호환: FRONT 0개 = 현재 무편성 포탑 동작과 완전히 동일
  duplicate_policy: reject      # validLoadout()과 동일하게 companionId 유일성 강제
  determinism: "슬롯 배열은 companionId asc 정렬 후 freeze; 런 생성 시점에 1회 확정, tick 중 재정렬 없음"
```

`createDefenseRun`은 `companionLoadout`(레거시, 전량 BACK으로 해석해 하위호환 유지) 또는 `formation`
(신규) 중 하나를 받는다. `validLoadout`을 대체하는 `validFormation(formation)`은 동일한 순수 함수
계약을 따른다 — 정렬 후 슬라이스, 부작용 없음:

```js
// 설계 스케치 — 결정론 계약: 입력에 대한 순수 함수, RNG/시각 없음
function validFormation(formation) {
  const rows = (Array.isArray(formation) ? formation : [])
    .filter((e) => COMPANIONS[e?.companionId] && (e.slot === "FRONT" || e.slot === "BACK"));
  const deduped = [...new Map(rows.map((e) => [e.companionId, e])).values()]
    .sort((a, b) => a.companionId.localeCompare(b.companionId))
    .slice(0, MAX_FORMATION_SLOTS);
  const front = deduped.filter((e) => e.slot === "FRONT").slice(0, MAX_FRONT);
  const frontIds = new Set(front.map((e) => e.companionId));
  return [...front, ...deduped.filter((e) => !frontIds.has(e.companionId))];
}
```

이 함수는 정렬 입력 → 정렬 출력의 순수 변환이며, `state.rng`/`state.combatRng`를 소비하지 않는다.
동일 입력 → 동일 편성 배열이 보장된다 — 불변식 위반 조건 4종 중 어느 것도 해당하지 않는다.

### 2.2 슬롯이 전투 규칙을 바꾸는 지점 (UI 장식이 아님을 증명)

슬롯이 순수 표시값이 아니라 시뮬레이션 규칙을 바꾸는 3곳:

1. **피격 가능성**: FRONT 슬롯 동료만 적 AI의 타겟 후보가 된다(§4). BACK은 현재처럼 피격 불가.
2. **후열 시너지**: BACK 슬롯 동료는 살아있는(비-DOWNED) FRONT 동료가 최소 1기 있을 때만 데미지
   보너스를 받는다(§2.3) — "구성이 화력보다 중요"를 수치로 구현.
3. **랠리 우선순위**: 보스 스폰 시 FRONT 슬롯 유무가 랠리 윈도우 발동 조건이다(§3).

### 2.3 후열 시너지 수치

```yaml
formation_synergy:
  back_row_damage_bonus_bp: 2500      # [TARGET] +25%. 근거: 기존 abyssal-banner 보너스(+60 flat,
                                       # defense-catalog.js:146)와 다른 축(비례)이라 곱연산 스택 시
                                       # 폭주 방지 위해 낮게 설정. 밸런스 시트에서 재조정 대상.
  condition: "COUNT(FRONT slot AND status != DOWNED) >= 1"
  applies_to: "BACK 슬롯 동료의 companion.damage 계산에만; FRONT 자신에는 미적용"
  stacking: "조건 충족 여부는 boolean; 다중 FRONT라도 보너스는 1회만 적용 (multiplier 아님, gate)"
  data_mirror: defense-catalog.js#COMPANIONS  # 프로그래머가 balance-sheet.md와 동기 유지
```

`companion.cooldown <= 0`분기(`defense-run-simulation.js:1405-1408`)에서 `fire()` 호출 직전에
`effectiveDamage = base * (synergyActive && companion.slot === "BACK" ? 12500 : 10000) / 10000`처럼
정수 연산으로 계산 — 기존 `scaled()`(`defense-run-simulation.js:22`)와 동일한 bp 정수 스케일링
관용구를 재사용해 부동소수점 결정론 위험을 피한다.

## 3. 랠리(Rally) 아날로그 — 싱글플레이 경계 내에서

Kingshot의 랠리는 **다수의 독립적인 플레이어 편성**이 하나의 강한 타겟에 동시 집결하는 구조다. Abyssal은
멀티플레이가 없으므로([OBSERVED] 제작 브리프 제약 2, 캔버스 문서 §시뮬레이션과 저장 "네트워크... 멀티플레이를
요구하지 않는다") 이식할 것은 "다수 플레이어"가 아니라 **"다수 편성 조각(전열/후열/커맨더)이 평소엔 각자
가장 가까운 표적을 치다가, 보스전에서 하나의 표적에 강제 수렴한다"**는 구조적 패턴이다.

### 3.1 설계: Boss Rally Window

```yaml
boss_rally_window:
  trigger: "run.bossSpawned === true (기존 spawnBoss() 호출, defense-run-simulation.js:249-305)"
  duration: "보스 전투 종료까지 (run.terminal 확정 또는 적 소멸)"
  effect_1_forced_target_priority:
    rule: "FRONT/BACK 무관, 모든 살아있는(non-DOWNED) 동료의 orderedTargets() 결과를 보스 엔티티로
           강제 override (사거리 내에 있을 때만 — 사거리 밖이면 기존 최우선 표적 유지)"
    rationale: "[INFERENCE] 개별 동료가 잡몹을 쏘느라 보스 화력 집중이 흩어지는 것을 방지 — Kingshot
                랠리의 '단일 표적 집중'을 커맨더+전 동료 단위로 재현"
  effect_2_cooldown_compression_bp: 8000  # [TARGET] 랠리 중 fireTicks * 0.8 (20% 단축)
    rationale: "[TARGET] 근거: 집결 화력이 정찰 웨이브 대비 체감상 강해야 보스전이 '합동 돌격'처럼 읽힘;
                수치는 balance-sheet.md에서 QA 시뮬레이션으로 검증 필요 (G2 게이트 TTK ±15%)"
  requires: "FRONT 슬롯 >= 1 채워진 편성일 때만 발동 — 0 FRONT(레거시 전량 BACK) 편성은 랠리 없이
             기존 동작 그대로 유지 (하위호환)"
```

결정론 검증: 트리거 조건(`run.bossSpawned`)과 지속 조건(`run.terminal`)은 이미 존재하는 냉동 상태
필드이며, 랠리 로직은 이 필드들에 대한 순수 조건 분기다 — 신규 RNG 소비 없음, 신규 시각 의존 없음.
"강제 타겟 override"는 `orderedTargets()`가 이미 사용하는 안정 정렬(`distanceSquared` → `hp` →
`id.localeCompare`)을 그대로 통과한 뒤 필터링만 추가하므로 동순위 처리 방식도 그대로 상속된다.

이것이 멀티플레이가 아닌 이유: 참여하는 모든 액터(커맨더 + 최대 3 동료)는 **단일 플레이어 세션이 오프라인
로컬 저장 상태에서 소유한 액터들**이다. 랠리는 네트워크 상태 동기화가 필요한 협력 개념이 아니라, 이미 로컬에
존재하는 편성 조각들의 타겟팅 규칙을 보스전에서만 바꾸는 조건부 로직이다.

## 4. 소모(Attrition) — 그리고 영구성과의 긴장 해소

### 4.1 긴장의 정확한 서술

Kingshot 구조: 전투 중 병력(troop) 손실이 실시간으로 유효 전투력을 깎는다 — 소모는 **전투 결과에 영향을
주는 실재하는 손실**이어야 의미가 있다.
Abyssal 계약([OBSERVED] `docs/abyssal-command-defense-survivor-design.md:22`, "영구 동료와 런 전용
스킬은 별도 상태다... 동료 획득은 로컬 영구 진행에 기록"): 동료는 캠페인 전역 영구 자산이며, [OBSERVED]
`campaign-state.js` 전체에 동료를 컬렉션에서 제거하는 API가 **존재하지 않는다**(`captureElite`는
추가/`evolution` 갱신만 수행; `applyCampaignRunResult`는 스테이지 해금·보상만 다루고 동료 컬렉션을
전혀 건드리지 않음, `campaign-state.js:85-106`).

### 4.2 결정 — 명시적, 모호함 없음

> **RESOLVED: 소모는 런 범위(run-scoped)에서만 발생하며, 캠페인 영구 컬렉션에는 어떤 경로로도 도달하지
> 않는다. 동료는 런 내에서 "DOWNED"(전투불능) 상태가 될 수 있으나, 영구적으로 "상실(lost)"되는 경로는
> 이 설계에 존재하지 않는다.**

근거 3가지:
1. **계약 우선순위**: `docs/abyssal-command-defense-survivor-design.md`는 이 저장소의 유일한 배포
   제품 계약("현재 저장소에 배포되는 유일한 제품 계약")이며 동료 영구성을 명문화한다. 이를 침묵 속에
   뒤집는 것은 브리프 제약 3("기존 캔버스... 침묵 속에 모순시키지 말 것")을 정면 위반한다.
2. **API 표면 부재**: 영구 컬렉션에서 항목을 제거하는 함수가 캠페인 상태 모듈에 없다 — 소모를
   영구적으로 만들려면 신규 삭제 API를 추가해야 하는데, 이는 기존 세이브 파일의 `companionCollection`
   불변성 가정(`restoreCampaign`의 검증 로직, `campaign-state.js:61-63`)을 깨는 스키마 변경이다.
3. **런 경계의 기존 관용구와 일치**: 커맨더의 `integrity`가 0이 되어도 커맨더 엔티티 자체가 "삭제"되지
   않고 런이 `DEFEAT`로 종결될 뿐이듯(`defense-run-simulation.js:1425-1433`), 동료의 소모도 동일한
   "런 종결 시 전부 리셋" 패턴을 따른다.

### 4.3 메커니즘: FRONT 피격 가능성 + DOWNED 상태

```yaml
companion_attrition:
  targetable_slots: [FRONT]           # BACK은 현행대로 피격 불가 유지 — 신규 타겟팅 표면을 최소화
  integrity_source: "신규 catalog 필드 companion.formationIntegrity — ProgDataArch/디자이너 소유"
  integrity_formula_seed: "[TARGET] damage * 8 (예: ember-cohort 420 dmg -> 3360 integrity).
                            근거: 근접 교전 시 수 초 이상 버텨야 '소모'가 체감되지, 즉사하면
                            의미 없는 노이즈가 됨 — QA archetype 세션에서 실측 후 balance-sheet.md
                            로 확정 필요, 이 문서는 시작값 제안일 뿐 최종 수치 아님"
  downed_state:
    transition: "FRONT companion.integrity <= 0 -> status = 'DOWNED'"
    effects:
      - "즉시 공격 중단 (companions.forEach 루프에서 status === 'ACTIVE' 가드로 스킵)"
      - "적 타겟 후보 풀에서 제거 (getTargetPosition/pressureTarget 재획득 로직 적용, 기존
         escortLeaderId 재획득 패턴과 동일 관용구)"
      - "BACK 시너지 조건(§2.3)의 FRONT-alive 카운트에서 제외"
    duration: "런 종료(승리/패배/재시작)까지 유지 — 런 중 부활 없음. 다음 런 생성 시
               addCompanion()이 매번 status: 'ACTIVE'로 새로 초기화하므로 자동 리셋됨
               (신규 코드 불필요, createDefenseRun이 이미 매 런 신규 companion 배열을 만듦)"
    permanent_effect: "없음 — campaign-state.js는 run.companions의 status/integrity 필드를
                        전혀 읽지 않는다. ELITE_EXTRACTED 이벤트만 captureElite()를 트리거하며,
                        이는 DOWNED와 무관한 별도 이벤트다."
```

전투 중 실제로 걸리는 곳: `moveEnemies`의 `pressureTarget`/`getTargetPosition`
(`defense-run-simulation.js:808-857`)이 현재 `"commander"`/`"gate"` 2종만 반환하는 것을, FRONT
슬롯이면서 `status === "ACTIVE"`인 동료도 후보에 포함하도록 확장한다. 접촉 피해 적용 지점
(`defense-run-simulation.js:971-1022`)의 `target.id === "gate"` / else-커맨더 이분기를 3분기로
확장해 `target.kind === "companion"`일 때 `companion.integrity`를 깎고 `COMPANION_DAMAGED` 이벤트를
`emit`한다 — 기존 `COMMANDER_DAMAGED` 이벤트와 동일한 스키마 관용구.

### 4.4 왜 "완전 상실"을 채택하지 않았는가 (기각된 대안)

고려했으나 기각: 동료가 전투 중 소모되어 완전히 죽으면 캠페인 컬렉션에서도 제거되는 "진짜 퍼머데스".
기각 사유: (a) 문서화된 영구성 계약을 정면으로 깨 브리프 제약 3 위반, (b) 로그라이크 vs 메타-영구 성장
분리(shared-reference-bundle §Source 3, "permanent STATS/INVENTORY/TRAITS on companions... 대체가
아니라 심화")라는 이번 사이클의 명시적 방향과 충돌, (c) `.survey/abyssal-command-systems-expansion/`이
이미 못박은 "확률적/가챠성 보상 없음" 경계와 인접한 리스크(퍼머데스는 손실 확률이라는 부정적 가챠 축을
암묵적으로 도입) — no-commerce 재해석 정신에도 어긋난다.

## 5. 결정론 보존 체크리스트

| 신규 요소 | RNG 소비? | 실시간 의존? | 정렬 안정성 | getRunDigest 커버리지 |
|---|---|---|---|---|
| `validFormation()` | 없음 (순수 변환) | 없음 | `companionId.localeCompare` | 자동 (companion 필드에 slot 추가 시 snapshot에 포함됨) |
| 후열 시너지 계산 | 없음 (boolean 게이트 + 정수 bp 연산) | 없음 | N/A (조건식) | 자동 (companion.damage 유도값이 fire() 결과 이벤트에 노출) |
| Boss Rally 강제 타겟팅 | 없음 (`run.bossSpawned`/`run.terminal` 조건 분기) | 없음 | `orderedTargets()` 기존 정렬 상속 | 이벤트 로그(`ENEMY_ATTACK` 등)에 이미 포함 |
| FRONT 피격/DOWNED | 없음 (결정론적 접촉 판정, 기존 `contactRange` 로직 재사용) | 없음 | `sortedActors` 상속 | **신규**: `getRunSnapshot()`의 `companions` 배열에 `status`/`integrity` 필드 추가 필요 — snapshot 스키마 버전(`SNAPSHOT_VERSION`, 현재 5)을 6으로 증가 |

증가된 `SNAPSHOT_VERSION`은 리플레이 호환성 계약을 명시적으로 깬다는 신호이므로, 기존 저장된 런의
리플레이는 버전 게이트로 거부되어야 한다(기존 코드에 `SNAPSHOT_VERSION`이 이미 존재하므로 이 관용구는
신규 발명이 아니라 기존 패턴 준수).

## 6. 롤아웃 — 신기술 정책 준수

페르소나 원칙 1("죽일 수 없는 신기술은 출시하지 않는다")에 따른 킬스위치:

```yaml
rollout:
  kill_switch: "formation.every(e => e.slot === 'BACK') 이면 FRONT 피격/DOWNED/랠리 로직 전체가
                조건 분기에서 자연히 비활성화됨 — 별도 feature flag 불필요, 데이터 형태 자체가
                스위치. 레거시 companionLoadout(string[]) 입력 경로도 계속 지원해 완전 우회 가능."
  verification_before_adoption:
    - "tests/defense-run-simulation.test.mjs의 결정론 테스트(133-143행 패턴)를 FRONT/BACK 혼합
       편성으로 복제 — 동일 시드+입력 → 동일 digest 재확인 필수"
    - "0 FRONT 편성으로 기존 전체 테스트 스위트 재실행 — 회귀 없음 증명 (하위호환 검증)"
    - "SNAPSHOT_VERSION 6 스냅샷에 대해 구버전(5) 리플레이 거부 동작 테스트"
  fallback: "이 문서의 §2-4 전체 채택 실패 시, §3(랠리)만 독립 채택 가능 — 강제 타겟팅은 FRONT/BACK
             슬롯 스키마에 의존하지 않고 companionLoadout 레거시 배열 그대로도 적용 가능한 최소 조각"
```

## 7. 경계 — 형제 레인과의 접점 (1줄 요약)

- **ProgDataArch** (`engineering/lane-data-arch.md`): `formationIntegrity`, `slot` 필드는 이
  레인이 제안하지만 catalog 스키마 소유권과 실제 수치 밸런싱은 데이터 아키텍처/디자이너 레인 — 내가
  제안하는 건 "이런 필드가 필요하다"는 계약이지 최종 스키마가 아니다.
- **ProgRenderArch** (`engineering/lane-render-arch.md`): FRONT/BACK 상대 좌표 오프셋(현재
  `companion.x = commander.x` 스냅을 대체할 실제 화면 배치)은 렌더링이 시뮬레이션 상태를 읽기만
  하는 기존 계약(`docs/...design.md` §투영 계약, "렌더러는 결정론적 시뮬레이션 상태만 읽고")을 따라
  이 문서가 정의하는 `companion.slot`을 **읽어서** 투영하되, 좌표 저작권은 시뮬레이션(이 레인)에 남는다.
- **DesignerCoreLoop/PMRewardBands/PMEngagementMap**(IRC 확인): "formation power"를 공유 수렴
  지표로 사용 중 — 이 레인은 그 지표의 **원천 계산**(companion.damage × synergy multiplier × 편성
  유효성)을 소유하고, 상위 지표로의 집계는 디자이너/PM 레인에 블랙박스로 넘긴다.

## 8. 디렉터 핸드오프 노트

가장 중요한 결정: **동료 소모(attrition)는 런 경계에서 완전히 리셋되는 순수 임시 상태이며, 캠페인 영구
컬렉션에 도달하는 코드 경로가 설계상 존재하지 않는다** — 이는 타협이 아니라 기존 제품 계약
(`docs/abyssal-command-defense-survivor-design.md`)과 캠페인 상태 API 표면(삭제 함수 부재)이 이미
강제하는 사실을 그대로 반영한 것이다. 디렉터가 통합 GDD에서 이 레인을 병합할 때 반드시 알아야 할 것:
만약 다른 레인(특히 디자이너나 PM)이 "동료를 잃을 수 있다"는 긴장감이나 서바이버 장르 특유의 상실 리스크를
핵심 훅으로 설계했다면, 그 설계는 이 시뮬레이션 레인의 결정과 **직접 충돌**한다 — 그 경우 캠페인 상태에
삭제 API를 신규 추가하는 별도 스코프 결정이 필요하며, 그것은 이번 문서의 제안 범위를 벗어나는 상위
제품 결정(디렉터 재가 필요)이다. 이 문서는 현재 계약을 침묵 속에 깨지 않는 경로만 제시했다.
