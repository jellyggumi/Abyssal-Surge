# Trigger Evaluation — game-studio-harness

20 queries: 10 should trigger, 10 should NOT. Run against the skill
description (Tier-1 catalog matching).

## Should trigger (10)

| # | Query | Why |
|---|---|---|
| T1 | 게임 제작 사이클 시작해줘 | direct Korean trigger "게임 제작" + cycle |
| T2 | Run the game production harness for my roguelike idea | "game production" + harness |
| T3 | 게임 하네스 돌려서 다음 사이클 진행해 | "게임 하네스" + next cycle |
| T4 | Start a production cycle: 2.5D dark fantasy RTS | "production cycle" |
| T5 | 스테이지 게이트 리뷰 해줘, G2 밸런스 확인 | "stage gate" review |
| T6 | 밸런스 사이클 재진입해줘, 익스플로잇 나왔어 | "balance cycle" re-entry |
| T7 | 게임 개발 사이클 3단계까지 돌려줘 | "게임 개발 사이클" |
| T8 | Run the studio on this GDD and give me gate verdicts | "run the studio" + gates |
| T9 | 지난 사이클 회고 기반으로 next cycle 시작해 | resume + "next cycle" |
| T10 | 컨셉 잡고 코어루프 구현까지 1차 사이클 돌려줘 | Stage-1 scope in harness terms |

## Should NOT trigger (10)

| # | Query | Why not |
|---|---|---|
| N1 | Unity 빌드가 깨졌어, 로그 봐줘 | build-log triage territory |
| N2 | 이 함수 리팩토링해줘 | plain code work |
| N3 | 스팀 상점 페이지 문구 다듬어줘 | steam-store-launch-ops |
| N4 | 프레임 드랍 프로파일링 해줘 | game-performance-profiler |
| N5 | 웹사이트 랜딩페이지 만들어줘 | not a game production cycle |
| N6 | 이 보드게임 규칙 설명해줘 | explanation, not production |
| N7 | 게임 추천해줘 | recommendation, not production |
| N8 | README 오타 고쳐줘 | trivial edit |
| N9 | A/B 테스트 결과 분석해줘 | analytics skill |
| N10 | 회의록 요약해줘 | summarization |

## Result template

| Query | Expected | Actual | Pass |
|---|---|---|---|
