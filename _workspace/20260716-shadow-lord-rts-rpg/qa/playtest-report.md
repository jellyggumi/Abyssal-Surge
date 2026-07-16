# Playtest report — 밸런스 v2 (시뮬레이션 기반 아키타입 플레이테스트)

**Navigation:** [exploit register](exploit-register.md) · [gate measurements](gate-measurements.md) · [test plan](test-plan.md) · [balance sheet](../design/balance-sheet.md)

**방법:** 라이브 세션이 아닌 **결정론 규칙 엔진 시뮬레이션** (`node scripts/run-campaign-balance-sim.mjs`, Node 22, seed 고정). 인간 플레이테스트가 필요한 항목(체감 페이스, 반복 의사)은 NOT-RUN으로 명시.
**타임스탬프:** 2026-07-16T15:22:22Z · rules `abyssal-surge-rules-v2` · 승리 정의: 패배 0회 완주(첫 defeat에서 측정 종료; retry는 UX 경로로 별도).

## 아키타입 × 스테이지 결과

승률(%) / 액션 수(TTK proxy) / 스테이지 종료 integrity(진입→종료). 결정론 정책은 1회 실행이 전 시행을 대표(엔진에 RNG 없음). casual만 200 시행.

| 아키타입 | 정책 | Cinder Span | Veil Citadel | Echo Throne | 캠페인 승률 | 총 액션 |
|---|---|---|---|---|---:|---:|
| rusher | 최소 군단 돌격, domain·S3 possess 거부 | 8act · 10→4 | 9act · 5→0 (킬 블로우 생존) | 2act · 진입 1, **1번째 assault에서 사망** | **0%** | 19 |
| greedy-economy | counter-1 만벽(fortress) 후 공격 | 9act · 10→7 | 11act · 8→5 | 36act · L22 만벽, 8→1 | 100% | 56 |
| optimal | 스테이지별 counter-1 티어 + S3 domain/possess | 9act · 10→7 | 10act · 8→6 | 6act · 7→2 | 100% | 25 |
| comeback | rusher와 동일한 얇은 S1/S2, S3에서 domain 역전 | 8act · 10→4 | 9act · 5→0 | 10act · 진입 3 → domain(7, aegis 2) → 0 (킬 블로우 완주) | 100% | 27 |
| casual (n=200) | 가용 액션 균등 랜덤 | 사망 0 | 사망 0 | **사망 98** | **51.0%** | 승리 시 31–71 (평균 50.3) |

관찰 노트:

- **rusher와 comeback은 S1/S2가 완전히 동일한 궤적** (integrity 10→4→0, 진입 3에서 S3 개시). 갈림길은 S3의 domain 결정 하나 — comeback은 capture→domain으로 integrity 3→7 + aegis 2를 얻어 완주하고, rusher는 같은 자리에서 반격 9에 즉사한다. "일발역전기"가 시뮬레이션상 실증됨 (`contractProbes.domainConvertsDefeatToWin: true`).
- **greedy-economy가 성립함.** v1에서는 경제 루프 깊이가 1로 고정되어 optimal에 붕괴했으나, v2의 반복 extract(souls 4, hunted 리셋) 위에서 L22 만벽(반격 8→3)이라는 실존 전략이 됨. 대가는 액션 2.2배(56 vs 25) — 안전과 속도의 실교환.
- **casual의 죽음은 전부 Echo Throne.** S1(반격 1–2)·S2(반격 1–3)는 학습 구간으로 안전하고, S3(반격 기본 8)가 시험대. domain을 언제 쓰는가(87%가 사용)와 assault 전 군단 크기가 생사를 가름. 밴드 중앙 51%.
- **S3 possess가 실선택이 됨.** 빙의 assault +1(+lens 시 +2)로 보스 17 기준 assault 4→3회. casual 승리 시퀀스 200종이 전부 상이 — v1의 "레일 위 순열"에서 벗어남.

## 보상 선택 경로별 결과 (콤보 EV)

adaptive optimal 정책, 4콤보 전수 (seed 7):

| 콤보 (Stage1 + Stage2) | 승리 | 총 액션 | 스테이지별 액션 | integrity 궤적 | EV(승리/액션) |
|---|---|---:|---|---|---:|
| ember-cohort + veil-vanguard | ✓ | 27 | 9/11/7 | 7→5→0 | 0.0370 |
| ember-cohort + anchor-shard | ✓ | 31 | 9/11/11 | 7→5→0 | 0.0323 |
| rift-lens + veil-vanguard | ✓ | 25 | 9/10/6 | 7→6→2 | 0.0400 |
| rift-lens + anchor-shard | ✓ | 29 | 9/10/10 | 7→6→1 | 0.0345 |

**max/median EV 비 = 1.119×** (≤1.3 밴드 이내). v1과 달리 4콤보의 (총 액션, integrity 궤적)이 전부 상이 — 보상이 결과 변수를 실제로 움직인다 (exploit register B2 해소).

## 루프 구조 (G7 입력)

| 스테이지 | 액션/루프 (optimal) | 유도 루프 시간 (5–15s/act 가정) | 보상 이벤트 |
|---|---:|---|---:|
| Cinder Span | 9 | 45–135 s | 1 |
| Veil Citadel | 10 | 50–150 s | 1 |
| Echo Throne | 6 | 30–90 s | 1 |

75s 목표(코어 루프 계약) ÷ 8–9액션 = 8.3–9.4s/액션이 가정 밴드 내. **반복률 proxy(≥70%)는 시뮬레이션 불가 — 라이브 세션 필요, NOT-RUN.**

## 인간 플레이테스트로만 검증 가능한 잔여 항목

1. 반복 의사(G7 repeat proxy ≥70%) — 10회 자발적 반복 세션 절차는 core-loop.md에 정의됨.
2. 체감 액션 시간(5–15s 가정의 실측 치환).
3. 메시지/피드백 가독성 (defect-register S2 항목) — v2에서 반격 수치가 메시지에 노출되므로("The counterblow tears N integrity") 재검 필요.
4. defeat→retry 루프의 체감 공정성 — retry는 스테이지 진입 integrity를 복원하므로 수학적 소프트락은 없음(진입 최저 3에서 domain 경유 완주 가능), 단 체감 확인 필요.
