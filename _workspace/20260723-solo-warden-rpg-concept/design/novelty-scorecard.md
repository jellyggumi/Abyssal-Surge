# Novelty Scorecard (G8 — vs Survey Frequency)

QA 벤치마크(`qa/lane-benchmark-survey.md`, 5개 공식 소스: Diablo IV, Path of Exile, Solo Leveling: ARISE, Kingshot, Whiteout Survival) 대비 빈도 분석.

## 참신성 후보

| # | 요소 | 빈도 | G8 충족(≤2/5)? | 채택 여부 |
|---|---|---|---|---|
| 1 | 추출/영입 개체 즉시 완전 전력화 (공유 성장 풀 방식) | 2/5 (Whiteout Survival 공유레벨, Solo Leveling 그림자즉시편입) | **충족** | **채택 후보** — 신규 동료가 현재 투자수준 대비 유의미하게 약하지 않게 설계 (§10.2, QA 검증 항목 6 "신규 동료 즉시 전력 편입" 참조) |
| 2 | 던전 난이도의 플레이어-레벨 자동 스케일링 | 1/5 (Solo Leveling만) | 충족 | **비채택** — 결정론적 시드 스테이지 구조(기존 캐논)와 충돌 위험, 이번 사이클 도입 안 함 |
| 3 | 영구 성장 계층 존재 자체 | 5/5 | 미충족 | 이미 Abyssal 기존 동료 메커닉과 중복, 참신성 후보 아님 |
| 4 | 아이템/스킬 조합 기반 빌드 다양성 | 4/5 | 미충족 | 흔한 패턴, 참신성 후보 아님 |

## 채택 결정: #1 — "확보 즉시 실전 투입 가능"

Bound Fragment/장비 등급 시스템(§`balance-sheet.md`)이 신규 동료를 별도로 처음부터 재파밍시키지 않도록 — 새 동료도 역할 패시브는 즉시 활성(스탯 배분이 없으므로 파밍 격차 자체가 구조적으로 작음, §3.3 디렉터 결정과 정합). QA 인상 점수(≥4/5)는 실제 빌드 존재 후 측정 필요 — 현재는 [TARGET] 후보.

```yaml
novelty_candidate: instant-viable-new-companion
survey_frequency: "2/5"
qa_impression_score: null   # 미측정, 빌드 필요
status: TARGET
```

전체 근거: `qa/lane-benchmark-survey.md` Frequency Ranking. 통합본: `design/UNIFIED-GDD.md` §10.2.
