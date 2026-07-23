> 렌 소유: PMForecast (game-pm 페르소나). run-id `20260723-solo-warden-rpg-concept`.
> Sibling PM lanes: `pm/lane-engagement-map.md` (PMEngagementMap, engagement-point map), `pm/lane-reward-bands.md`
> (PMRewardBands, playstyle-parity 보상 밴드). 이 문서는 그 둘과 겹치지 않는 **PACING 리듬**(스테이지별
> 언제 무엇이 열리는가)만 다룬다. 금액/확률/세션-패리티 수치는 `lane-reward-bands.md`가 소유한다.

# PM Lane — Progression Pacing Forecast (RPG Layer × 기존 10-스테이지 캠페인)

## 0. No-Commerce Reframe 준수 선언 (MANDATORY)

`intake/production-brief.md`의 `main_constraint.3`와 `shared-reference-bundle.md`의
"No-commerce reinterpretation" 절을 따른다. 이 문서는 **현금/구매/프리미엄 화폐/광고/계정/가챠를
전혀 언급하지 않는다.** game-pm.md 페르소나 원래 어휘(revenue point, revenue-forecast, 일발역전,
paid/free parity)는 아래처럼 치환한다:

| 원래 어휘 (템플릿) | 이 문서에서 사용하는 대체 어휘 |
|---|---|
| revenue point | engagement point (시간/스킬/주의 투입이 일어나는 선택 순간) — `pm/lane-engagement-map.md` 소유 |
| revenue rhythm / revenue-forecast | **pacing rhythm** — 이 문서가 스테이지 축으로 예측 |
| 일발역전 (comeback spike) | skill-comeback moment — `pm/lane-reward-bands.md` 소유 |
| paid/free parity | playstyle parity — `pm/lane-reward-bands.md` 소유 |

이 문서가 답하는 질문은 "언제 매출이 몰리는가"가 아니라 **"언제 새 구조(트리 티어/포메이션 슬롯)가
열리고, 언제 그 구조를 소화하는 소강 구간이 오는가"**다.

## 1. Canon Grounding (기존 계약, 변경하지 않음)

- [OBSERVED] `campaign-state.js:7-18` — 10개 스테이지 고정: `cinder-span`(1) → `veil-citadel`(2) →
  `echo-throne`(3) → `sunken-bastion`(4) → `howling-sprawl`(5) → `glass-necropolis`(6) →
  `starless-canal`(7) → `shattered-causeway`(8) → `abyss-chancel`(9) → `gate-zenith`(10, 캠페인 완료).
- [OBSERVED] `campaign-state.js:20` — 현재 동료 로드아웃 상한은 스테이지 무관 고정값
  `MAX_LOADOUT_SIZE = 3`. 이 RPG 레이어는 이 상수를 **스테이지 게이팅 값으로 확장 제안**한다
  (§3, 이번 사이클은 문서 제안만, 런타임 상수 미변경).
  `defense-catalog.js:264-271` — `COMPANIONS` 카탈로그 프로토타입 6종(ember-cohort, rift-lens,
  veil-vanguard, anchor-shard, throne-echo, dawnless-crown). 6이라는 상한 목표(§3)는 이 6종 전량을
  엔드게임에 동시 배치 가능하게 만드는 것과 정확히 맞춘다.
- [OBSERVED] `docs/abyssal-command-defense-survivor-design.md` §"런과 성장" — 런 전용 스킬(XP 임계값 →
  제안 1개 선택, 런 종료 시 소멸)과 영구 동료(정예 처치 → 추출 → 영구 해금)는 **분리된 상태**이며,
  XP/레벨/스킬/포지션은 런을 넘어 보존되지 않는다. 이 두 상태만 현재 존재한다.
- [TARGET] 이 문서가 다루는 "Dusk Warden 승격 트리(Warden Ascension Tree)"는 **세 번째 상태 버킷**이다
  — 런 전용도 아니고 동료 컬렉션도 아닌, **캠페인 진행(스테이지 클리어) 게이팅 + 영구 보존** 상태.
  ProgDataArch에 새 저장 슬롯이 필요함을 알린다(§6 경계 노트).

## 2. 두 축 모델 — 왜 이렇게 나뉘는가 (Solo Leveling × Kingshot 구조 합성)

원작 두 축의 핵심 차이를 그대로 구조에 반영한다:

- **Track A — Warden 승격 트리 (Solo Leveling 구조 원리)**: 다른 모든 헌터(=companion 아날로그)는
  관습적 방식으로 성장하는데, 주인공만 아무도 갖지 못한 성장 경로를 갖는다는 구조를 차용한다.
  companion 진화(evolution 1~3, 기존 `campaign-state.js` 필드)가 "관습적 성장" 축이라면,
  **Warden 승격 트리는 오직 주인공만 갖는 성장 축**이다 — 스테이지 보스 클리어로만 열리고,
  런을 넘어 영구 보존된다.
- **Track B — Formation Roster (Kingshot 구조 원리)**: 마을/영지가 레벨업하며 새 건물·용량을
  여는 것처럼, 포메이션(로드아웃)도 스테이지 클리어마다 슬롯/모드가 단계적으로 열린다. 기존
  추출→영구 동료 메커닉(변경 없음)이 "누구를 모으는가"를 담당하고, 이 트랙은 "몇 명을, 어떤 배치로
  한 번에 쓸 수 있는가"를 담당한다.

두 트랙은 독립적으로 게이팅되며, 아래 §3 표에서 의도적으로 **다른 스테이지**에 피크를 배치해 매
스테이지가 "새 트리 + 새 슬롯"을 동시에 요구하지 않도록 한다(스테이지 9는 예외 — §4).

## 3. Stage-by-Stage Pacing Table (Stage 1–10)

| Stage (seq) | ID / 이름 | Pacing Class | Track A — Warden 승격 트리 | Track B — Formation Roster | 플레이어 대면 투자 선택 | 근거 |
|---|---|---|---|---|---|---|
| 1 | `cinder-span` / Cinder Span | **PEAK** | Tier 1 오픈 — 시작 분기 노드 1-of-2 선택 | 기본 로드아웃 확정 (3슬롯, 기존값 유지) | "Tier-1 분기 1개 선택" | [TARGET] 캠페인 최초 구조적 선택은 스테이지 1에 배치해 두 트랙의 존재를 즉시 학습시킨다 |
| 2 | `veil-citadel` / Veil Citadel | TROUGH | 없음 (Tier 게이트 미도달) | 없음 (슬롯 게이트 미도달) | 없음 — Tier-1 노드 서브랭크에 승격 포인트 소비(신규 분기 아님) | [TARGET] "구조 변경 없이도 강해진다"를 초반에 학습시켜 이후 트로프 구간에서 이탈 없이 진행 |
| 3 | `echo-throne` / Echo Throne | **PEAK** | 없음 | 슬롯 +1 (3→4) | "4번째 동료를 컬렉션에서 배치" | [OBSERVED anchor] 카탈로그 6종 중 스테이지 3 시점에 정예 추출로 2~4종 보유가 합리적 — 4번째 슬롯이 빈 슬롯이 되지 않음 |
| 4 | `sunken-bastion` / Sunken Bastion | TROUGH | 없음 | 없음 (신규 슬롯/모드 없음) | 없음 — 동료 진화 재료 소비(기존 evolution 1~3 필드) + 장비 소켓 배정 | [TARGET] 스테이지 3의 신규 슬롯을 채우고 소화하는 구간, 피크 연속 방지 |
| 5 | `howling-sprawl` / Howling Sprawl | **PEAK** | Tier 2 오픈 — 특화 분기 1-of-3 (공격/방어/유틸) | 없음 | "Tier-2 특화 분기 1개 선택" | [TARGET] 캠페인 중간점(5/10) — 중반 특화 커밋은 "이 헌터가 이제 남들과 달라진다"는 서사 비트를 기계적으로 재현 |
| 6 | `glass-necropolis` / Glass Necropolis | TROUGH | 없음 | 없음 | 없음 — 포메이션 재배치(기존 4슬롯 순서 변경, 신규 슬롯 아님) + Tier-2 특성 슬로팅 | [TARGET] 동일한 흡수 패턴 반복 |
| 7 | `starless-canal` / Starless Canal | **PEAK** | 없음 | 슬롯 +1 (4→5) + 열/포지션 모드 오픈 (전열/후열) | "5번째 동료 배치 + 5슬롯 전체 전열/후열 배정" | [TARGET] 열 포지셔닝은 슬롯 4개 이하에서는 선택폭이 좁아 무의미 — 5번째 슬롯과 동시 개방해 빈 메커닉 방지 |
| 8 | `shattered-causeway` / Shattered Causeway | TROUGH | 없음 | 없음 | 없음 — 스탯 포인트 1회 무료 재분배 창 + 장비 등급 상한 상향(수치만, 신규 시스템 없음) | [TARGET] 9-10 컨버전스 피크 직전 "리셋" 여유 제공 |
| 9 | `abyss-chancel` / Abyss Chancel | **PEAK (convergence)** | Tier 3 오픈 — 고유 특성 1-of-2 (동료는 가질 수 없는 Warden 전용 특성) | 슬롯 +1 (5→6, 카탈로그 전체 6종과 동수 도달) + Assault Formation 모드 오픈 (다수 동료 vs 단일 엘리트/보스, 기존 추출-대상 엘리트 메커닉 재사용) | "고유 특성 1개 선택 + 6슬롯 Assault Formation 확정" | [TARGET] 의도적 더블피크 — 파이널 스테이지 직전 힘의 정점을 몰아 모멘텀을 만드는 표준 RPG 관습. 단기 인지부하 상승은 QARiskRegister에 리스크로 명시 위임 |
| 10 | `gate-zenith` / Gate Zenith | **PEAK (finale)** | Tier 4 Capstone — 선택 없음(0-of-1, 자동 부여), **캠페인 완료 이벤트와 동시 발화** | 로드아웃 프리셋 저장/불러오기 (New Game+ 연속성용, 신규 슬롯 아님) | 없음 (프리셋 이름 확인만) | [OBSERVED anchor] `campaign-state.js` 기존 계약: "Stage 10 보스 승리 = 캠페인 완료" — Capstone이 이 이벤트를 선행/방해하면 안 되므로 선택지 없는 보상형으로 설계 |

## 4. 리듬 불변식 (Rhythm Invariants) — director/QA가 바로 검증 가능한 수치

```yaml
pacing_rhythm:
  total_stages: 10
  peak_stages: [1, 3, 5, 7, 9, 10]        # 6개
  trough_stages: [2, 4, 6, 8]             # 4개
  peak_ratio: 0.6
  max_consecutive_trough_stages: 1        # 표 상 어떤 두 trough도 인접하지 않음
  deliberate_double_peak: [9, 10]         # 유일한 리듬 예외 — 파이널 전 컨버전스, §3 근거 참조
  predictability_window: "연속 2 스테이지 윈도우마다 peak ≥1"   # 9→10 제외 전 구간에서 성립
track_a_warden_ascension:
  tier_count: 4                            # Solo Leveling E~S(6랭크) 그대로 모사하지 않음 — 10-스테이지
                                            # 캐던스에 맞춰 3-스테이지 간격 + capstone으로 축약
  unlock_stages: [1, 5, 9, 10]
  gap_stages_between_tiers: [4, 4, 1]      # 마지막 1은 capstone이 stage9 직후 즉시 발화하기 때문
track_b_formation_roster:
  base_loadout_existing: 3                 # 변경하지 않는 기존 MAX_LOADOUT_SIZE
  slot_unlock_stages: [3, 7, 9]
  target_loadout_ceiling: 6                # = 기존 COMPANIONS 카탈로그 6종과 동수(§1 근거)
  mode_unlock_stages:
    row_position: 7
    assault_formation: 9
```

## 5. 오프라인/로컬 텔레메트리 필드 제안 (network/analytics-server 없음)

`defense-telemetry.js`의 기존 계약을 그대로 따른다 — `scope: "offline-local-debug"`,
`privacy: { playerIdentifiers: false, networkTransport: false, persistentStorage: false }`,
append-only 세션-메모리 레코드, `exportJson()`으로만 내보냄(파일 다운로드/수동 공유, 자동 전송 없음).
아래는 `ops/telemetry-contract.md`에 추가할 **필드/이벤트 제안**이며, 기존
`SIMULATION_FIELDS` 배열과 같은 평면 필드 목록 패턴을 따른다. 네트워크/서버/분석 플랫폼 용어는
사용하지 않는다 — 모두 `DefenseTelemetry.append()`가 세션 메모리에만 쌓는 레코드다.

### 5.1 신규 이벤트 타입 (기존 `RUN_STARTED`/`RUN_RESULT`와 같은 UPPER_SNAKE_CASE 네이밍 유지)

| 이벤트 타입 | 트리거 시점 | payload 필드 | 용도 |
|---|---|---|---|
| `PACING_STAGE_ENTERED` | 스테이지 런 시작 시 | `stageId, sequence, pacingClass, declaredUnlockCount` | §3 표의 정적 선언값을 런타임에 기록 — QA가 실제 발화 이벤트 수와 대조 |
| `WARDEN_TIER_UNLOCKED` | Tier 오픈 확정 시 | `tier, stageId, branchChoiceId, presentedAtMs, resolvedAtMs` | Track A 피크 발화 시점 검증 |
| `WARDEN_NODE_ALLOCATED` | 트로프 구간 포인트 소비 시 | `tier, nodeId, category, stageId` | 트로프의 "소비만 있고 신규 구조 없음"을 확인 |
| `FORMATION_SLOT_UNLOCKED` | 슬롯 오픈 확정 시 | `slotIndex, totalSlots, stageId` | Track B 피크 발화 시점 검증 |
| `FORMATION_MODE_UNLOCKED` | 열 포지션/Assault 모드 오픈 시 | `mode, stageId` | 모드 오픈이 선언된 스테이지와 일치하는지 검증 |
| `FORMATION_RECONFIGURED` | 트로프 구간 재배치 시 | `stageId, slotCount, mode` | 트로프의 "신규 슬롯 없는 재배치"를 확인 |
| `INVESTMENT_CHOICE_RESOLVED` | 모든 선택형 이벤트(피크/트로프 공통) 확정 시 | `choiceKind, stageId, presentedAtMs, resolvedAtMs, deliberationMs` | §6 검증법의 핵심 필드 — 피크 vs 트로프 숙고 시간 대조 |

### 5.2 필드 목록 (기존 `SIMULATION_FIELDS` 배열에 추가 제안)

```yaml
proposed_pacing_fields:
  - tier
  - nodeId
  - category
  - slotIndex
  - totalSlots
  - mode
  - branchChoiceId
  - choiceKind
  - pacingClass
  - declaredUnlockCount
  - sequence
  - presentedAtMs
  - resolvedAtMs
  - deliberationMs      # = resolvedAtMs - presentedAtMs, 계산 필드
```

기존 `recordRunResult()`/`settleIdleReturn()`(campaign-state.js) 조합도 그대로 재사용한다 —
피크 스테이지 클리어 직후 복귀 지연을 재려면 새 네트워크 필드가 아니라 이미 존재하는
`idleReturn.lastSettledAt`/`totalProgress`(로컬 전용, 오프라인)를 `PACING_STAGE_ENTERED`
타임스탬프와 대조하면 된다. 신규 전송 경로는 제안하지 않는다.

## 6. QA 검증 방법 (offline export 재생 기반, 서버 없음)

QA는 로컬에서 `telemetry.exportJson()`으로 얻은 파일(브라우저 다운로드, 수동 공유 — 자동 업로드
없음)을 오프라인으로 재생해 세 가지를 점검한다:

1. **언락 카운트 대조**: 연속된 두 `PACING_STAGE_ENTERED` 레코드 사이에서
   `WARDEN_TIER_UNLOCKED + FORMATION_SLOT_UNLOCKED + FORMATION_MODE_UNLOCKED` 발생 수를 세어
   그 스테이지의 `declaredUnlockCount`와 비교. 불일치 = 페이싱 회귀.
2. **숙고 시간 대조** (§4 표의 핵심 검증):
   ```yaml
   deliberation_contrast_band:
     metric: median(deliberationMs) grouped by pacingClass
     target_ratio_peak_over_trough_min: 1.5   # [TARGET] QARiskRegister/QAArchetypeTestPlan과 협상 가능한 초기값
     measured_by: "INVESTMENT_CHOICE_RESOLVED 레코드의 오프라인 로그 집계"
   ```
3. **인접성 회귀 점검**: §4 `pacing_rhythm.trough_stages` 정적 목록에서 인접한 두 값이 없는지
   설정 감사로 확인(런타임 계측 불필요, 문서/데이터 대조만).

세 검증 모두 로컬 재생 + 정적 설정 대조로 끝난다 — 분석 서버, 네트워크 전송, 계정 식별자를
요구하지 않는다.

## 7. 경계 노트 (director 스티칭용, 각 1줄)

- **PMEngagementMap**: 나는 "언제" 구조가 열리는가(스테이지 축)만 다룬다. "그 순간이 왜 engagement
  point로 유효한가"(투자의 질적 의미)는 그쪽 문서가 소유 — 겹치면 스테이지 번호로 교차 참조.
- **PMRewardBands**: 슬롯/티어 수량(카디널리티)은 내가 제안하지만, 그 슬롯/티어가 주는 보상의
  숫자(수치 밴드, 세션 패리티)는 그쪽 소유 — §0 표 참조.
- **DesignerCoreLoop**: (2026-07-23 IRC 교차확인) 그쪽 3-슬롯 포메이션은 위치 개수([OBSERVED],
  기존 `MAX_LOADOUT_SIZE=3` 고정), 나의 "슬롯"은 로스터 용량(3→4→5→6, [TARGET])으로 축이 다름을
  상호 확인함. **확정된 후속 의존성**: 그쪽 Vanguard/Rally/Split 스탠스 오프셋 수학이 3-way 고정
  전제라면, 내 §3/§4의 슬롯 3→4(stage 3)→5(stage 7)→6(stage 9) 확장이 그 전제를 깨뜨린다 —
  스탠스 수학이 용량-비종속(capacity-agnostic)으로 일반화되지 않는 한, 내 로스터 확장 스테이지
  게이팅(§3, §4 `target_loadout_ceiling: 6`)은 코어 루프 스탠스 시스템 확정 전까지 [TARGET]
  유지하며, director는 두 문서를 병합하지 않고 이 의존성을 먼저 해소해야 한다.
- **DesignerRPGSystems**: Warden 승격 트리의 노드 내용(스탯/스킬 수치)은 그쪽 스탯/스킬 시스템의
  실제 카탈로그에 종속된다 — 나는 티어 오픈 "시점"만 고정하고 노드 "내용"은 명시적으로 위임한다.
  요청: 그쪽 Warden Ascension Tree 명목 노드는 [OBSERVED anchor]가 아니라 [TARGET].
- **ProgDataArch**: Track A는 런 전용 스킬도 동료 컬렉션도 아닌 제3의 영구 상태 버킷이 필요하다
  (§1) — 저장 스키마 설계 시 반영 요청.
- **QARiskRegister**: 스테이지 9의 의도적 더블피크(§3, §4)는 인지부하 리스크로 이미 플래그했다 —
  등록만 요청, 완화안은 QA 소유.

## 8. Director Handoff Note

이 문서에서 가장 중요한 단일 결정은 **Warden 승격 트리를 런 전용 스킬도 영구 동료도 아닌 제3의
영구 상태로 분리**하고, 그 언락을 "런 내 XP"가 아니라 "스테이지 보스 클리어"에 게이팅한 것이다 —
이것이 Solo Leveling의 "혼자만 특별하게 성장하는 주인공" 구조를 기존 companion evolution(관습적
성장 축, 변경 없음)과 충돌 없이 병치시키는 유일한 방법이며, 동시에 §4의 6-peak/4-trough,
"트로프 인접 금지" 리듬이 이 분리를 전제로만 성립한다. 만약 director가 이 3-상태 분리를 승인하지
않고 Track A를 기존 두 상태 중 하나에 합치기로 한다면, §3–§4 전체 표와 리듬 불변식을 다시 짜야
하므로 — 이 결정은 다른 어떤 스테이지별 세부 조정보다 먼저 확정되어야 한다.
