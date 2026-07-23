# Stage-by-Stage Progression — Game Campaign Stage 1→10 (Grounded in `defense-catalog.js`)

이 문서는 게임 캠페인 10스테이지(Cinder Span~Gate Zenith, `docs/abyssal-command-defense-survivor-design.md`의 진짜 배포 계약) 각각에 RPG 레이어 수치를 정확히 결부시킨다. 모든 [OBSERVED] 값은 `defense-catalog.js`/`campaign-state.js`에서 직접 읽은 기존 코드 상수이며, RPG 레이어 열([TARGET])만 이번 사이클 신규 설계다. 하네스 프로덕션 사이클(Stage1~3, `game-studio-harness`)과 이 게임 캠페인 스테이지(1~10)는 별개 축임을 주의 — 이 문서는 후자.

## 0. 방법론 — 실제 코드 대조로 계산, 추정 아님

`eval` 도구로 `STAGES`/`BOSSES`/`COMPANIONS` 배열을 그대로 옮겨 시뮬레이션했다(아래 §1 표는 그 결과). 이 과정에서 Stage 1 초안 설계의 실제 오류 2건을 발견해 수정했다 — `production/decision-log.md` D10/D11 참조.

## 1. 전체 10스테이지 그라운드 테이블

| Stage | ID | 보스명 | 보스HP[OBSERVED] | 게이트타이머[OBSERVED] | 정예→동료[OBSERVED] | 해금유형 | 진화단계 | 로스터누적 | 누적Echo Core | 누적Bound Fragment | 저지선등급(wardLevel) | Undertow면역 | 특성언락(2/4/6/8/10) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | cinder-span | Cinder Warden | 40,000 | 12s | ember-cohort(Striker) | 신규 | 1 | 1 | 4 | 1 | 1 | ✗ | ✗ |
| 2 | veil-citadel | Veil Tactician | 48,000 | 13s | rift-lens(Striker) | 신규 | 1 | 2 | 8 | 2 | 3 | ✗ | ✓ |
| 3 | echo-throne | Gate Sovereign | 60,000 | 14s | throne-echo(Support) | 신규 | 1 | 3 | 12 | 3 | 4 | ✗ | ✗ |
| 4 | sunken-bastion | Tide Warden | 68,000 | 15s | anchor-shard(Vanguard) | 신규 | 1 | 4 | 16 | 4 | 6 | ✗ | ✓ |
| 5 | howling-sprawl | Pack Herald | 76,000 | 16s | veil-vanguard(Vanguard) | 신규 | 1 | 5 | 20 | 5 | 7 | ✗ | ✗ |
| 6 | glass-necropolis | Requiem Choir | 84,000 | 17s | throne-echo(Support) | **반복** | 2 | 5 | 24 | 6 | 8 | **✓(최초)** | ✓ |
| 7 | starless-canal | Lantern Tyrant | 92,000 | 18s | anchor-shard(Vanguard) | **반복** | 2 | 5 | 28 | 7 | 9 | ✓ | ✗ |
| 8 | shattered-causeway | Bridge Colossus | 100,000 | 19s | ember-cohort(Striker) | **반복** | 2 | 5 | 32 | 8 | 10 | ✓ | ✓ |
| 9 | abyss-chancel | Veiled Concordat | 110,000 | 20s | dawnless-crown(Support) | 신규 | 1 | 6 | 36 | 9 | 12 | ✓ | ✗ |
| 10 | gate-zenith | Abyss Regent | 150,000 | 21s | dawnless-crown(Support) | **반복** | 2 | 6 | 40 | 10 | 13 | ✓ | ✓ |

**보스HP 스케일**: [OBSERVED] 40,000→150,000, +275%. 정예 처치→추출 성공 시 Echo Core+1, 보스 처치 시 Echo Core+3(스테이지당 +4 누적, 기존 `balance-sheet.md` §3.2 40예산 산식과 정합 — 10스테이지 전량 완주 시 정확히 40).

**동료 6종 중 진짜 신규 해금은 6회, 반복 정예는 4회**([OBSERVED] `captureElite()` 로직 — `campaign-state.js:133-148`, 반복 캡처 시 신규 동료 아니라 `evolution` +1). 이는 §2 Bound Fragment 규칙 수정의 직접 근거.

## 2. Track A(Warden 스킬트리) 최초 구매 가능 시점

```yaml
track_a_affordability:
  first_t1_node_5cost: "Stage 2 종료 시 (누적8) — Stage 1 종료 시점(누적4)엔 최저비용 노드(5)도 구매 불가"
  both_t1_nodes_10cost: "Stage 3 종료 시 (누적12)"
  one_branch_full_t1t2_13cost: "Stage 4 종료 시 (누적16)"
  both_branches_t2_26cost: "Stage 7 종료 시 (누적28)"
  capstone_full_tree_41cost: "캠페인 내 도달 불가 (최대 누적 40 < 41) — balance-sheet.md의 '의도된 트레이드오프' 그대로 확정, 산술적으로 재확인됨"
```

## 3. Track B(동료 장비) 최초 구매 가능 시점

```yaml
track_b_affordability:
  slot_t1_to_t2_1cost: "Stage 1 종료 시 (누적1)"
  slot_t2_to_t3_3cost: "Stage 3 종료 시 (누적3)"
  slot_t3_to_t4_6cost: "Stage 6 종료 시 (누적6)"
  slot_t4_to_t5_10cost: "Stage 10 종료 시 (누적10) — 캠페인 완주 시 정확히 슬롯 1개 T5 도달, 딱 맞음"
  source_rule: "D10 확정 — 정예 종류(신규/반복) 무관 보스 처치 1회당 1개 고정 지급 (아래 §5 참조)"
```

## 4. 저지선(Undertow 압력) 스테이지별 상태

Stage 6부터 `wardLevel`(8) ≥ 압력상한(8)에 도달해 **영구 면역**(그 이후 오프라인 방치로는 ENCROACHED 불가). Stage 1~5는 실제 취약 구간이지만 이 시점 idle 진행도 자체가 낮아 몰수 손해가 작음(`balance-sheet.md` §저지선 구역 밸런스 함의와 정합, 이번 §1 표로 정확한 스테이지 경계 확정: 5까지 취약/6부터 면역).

## 5. 보스별 프레젠테이션 비트 (기존 컷신 텍스트 인용, 신규 창작 없음)

| Stage | 기존 승리 대사[OBSERVED, `defense-catalog.js` CUTSCENES] | RPG 레이어 프레젠테이션 결부 |
|---|---|---|
| 1 | "다리 끝의 재가 다음 봉쇄선을 가리킨다." | 첫 정예 추출 성공 → Echo Core 최초 획득 토스트(§presentation-spec.md 아이템획득토스트 재사용) |
| 5 | "측면의 명령이 끊기고 다섯 번째 봉쇄선이 닫혔다." | 캠페인 중간점 — Track A Tier-2 특화분기 선택 가능 구간 진입(§2, 20 Echo Core 근접) |
| 6 | "반사된 명령이 멎고 여섯 번째 봉쇄선이 이어졌다." | **저지선 영구 면역 달성 스테이지** — 요새 탭에 정적 배지("저지선 안정")로 1회성 알림, 신규 애니메이션 불필요(감산-모션 원칙 재사용) |
| 9 | "가려진 서약이 끊기고 아홉 번째 봉쇄선이 이어졌다." | Track A Tier-3 고유특성 + Assault Formation 모드 동시 오픈(기존 §8 더블피크 설계 그대로) |
| 10 | "Moonless Court의 명령망이 끊겼다. 열 번째 봉쇄선은 유지되고 Echo Deep은 남는다." | 캡스톤 자동부여 이벤트가 이 대사 **직후** 발화(선행/방해 금지, 기존 §8 근거 유지) |

## 6. 미해결 — TTK 실측 (Stage 2 QA 시뮬레이션 필요, 이 문서가 임의 확정하지 않음)

보스 HP가 40,000→150,000(+275%)로 스케일링되는 동안 플레이어 파워(Track A 스탯 최대 +16.7% dmg, Track B 장비 배율 최대 ×2.0, 역할 패시브 +12~20%)가 이를 상쇄하는지는 **조합 폭발 공간이라 수식 하나로 단언 불가** — `qa/lane-archetype-testplan.md` PRED-05(조합 EV 시뮬레이션)와 동일 인프라가 필요하다. 이 문서는 스테이지별 HP/보상 스케줄만 확정하고, TTK 밴드 검증은 Stage 2로 명시적으로 이월한다(기존 `production/gate-reviews/stage1-review.md`의 PENDING 판정과 정합).

전체 근거: `defense-catalog.js`(STAGES/BOSSES/COMPANIONS 실측), `design/balance-sheet.md`, `production/decision-log.md` D10/D11.
