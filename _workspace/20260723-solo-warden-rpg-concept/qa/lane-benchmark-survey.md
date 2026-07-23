# QA 벤치마크 조사 — 버드아이 액션RPG × 헌터 성장 × SLG 영웅수집 교차점

run-id: `20260723-solo-warden-rpg-concept` · lane: `QABenchmarkSurvey` (game-qa 역할, Stage 1 브레인스토밍)
persona: `.claude/agents/game-qa.md` — "Benchmark sense-calibration" 책임 항목 수행.

## Scope & Extension Note

이 문서는 `skill://survey`의 정식 4-레인 워크플로 전체를 재실행하지 않는다. 대신 기존
`.survey/abyssal-command-systems-expansion/{triage,context,solutions}.md`가 이미 확립한
증거 라벨 규약([OBSERVED]/[INFERENCE]/[TARGET]/[BOUNDARY], direct page retrieval 출처
표기, Source Ledger 표 형식)을 **그대로 계승**하여, 이번 사이클이 새로 요구하는 세 가지
구조적 버킷 — (A) 버드아이/아이소메트릭 액션RPG 카메라·성장 구조, (B) 헌터 성장 루프,
(C) SLG 영웅수집·거점진형 구조 — 에 대해서만 신규 항목을 추가한다.

기존 조사의 결론(90초 Cinder Span Command Feedback 슬라이스, 결정론적 60Hz, 오프라인
단일 정산, 절차성 제약)은 **재서술하지 않고 참조만** 한다. 아래 모든 신규 항목은 기존
조사와 충돌하지 않으며, 특히 기존 [BOUNDARY](상업화·네트워크·계정·클라우드 동기화·
백그라운드 전투 제외, C1/S1 제품 계약 우선)를 그대로 상속한다.

이 사이클에서 신규로 웹 조사한 5개 게임(6개 공식 소스, Q1–Q6)은 브랜드/UI/정확한 수치
테이블을 복제하기 위한 것이 아니라, `production-brief.md`가 이미 원천 승인한 구조적
원칙(Solo Leveling 헌터/게이트/추출, Kingshot 거점/영웅/부대/진형, RPG 장르 스탯·인벤토리·
스킬트리 어휘)에 대해 **공식 제품 페이지 기준으로 무엇이 실제로 공개 확인 가능한지**를
QA 감각 보정용으로 검증한 것이다.

## Evidence Contract (확장)

- 라벨 규약은 기존 triage.md와 동일: **[OBSERVED]** 공식 제품 페이지의 공개 기능 설명만
  뒷받침. **[INFERENCE]** 공개 설명에서 제한적으로 추론한 결론. **[TARGET]** 미측정 설계
  가설. **[BOUNDARY]** 이 프로젝트로 이식 금지 항목.
- 신규 [BOUNDARY] 추가: 커뮤니티 위키·팬사이트에서만 확인되는 정확한 부대 비율/수치
  (예: 특정 병종 배합 퍼센트)는 개발사가 공개 발표한 밸런스 수치가 아니므로 **이 문서
  어디에서도 사실로 인용하지 않는다** — 구조적 패턴(포지션 삼각 관계의 존재)만 [INFERENCE]로
  남기고 수치는 배제한다. 이는 "내부 밸런스 수치나 사용자 정서를 관측하지 않은 것으로
  주장하지 않는다"는 과제 제약을 QA 라인에 적용한 것이다.
- 모든 소스는 **direct page retrieval**로 표기된 공식 스토어/개발사 페이지 또는 Steam/iTunes
  공식 API, 혹은 위키백과(카메라 분류 확인용, 1차 공식 소스 아님을 명시)로 한정한다.
  스토어 리뷰·평점 수치·유저 코멘트는 사용자 정서 증거로 취급하지 않으며 인용하지 않는다.

## Bucket A — 버드아이/아이소메트릭 액션RPG: 카메라·던전·성장 구조

대상: Diablo IV(Q1), Path of Exile(Q2, Q3).

- **[OBSERVED — direct retrieval, Wikipedia/Q3]** Path of Exile는 "The player controls a
  single character from an isometric perspective"로 명시적으로 카메라를 아이소메트릭
  퍼스펙티브로 규정한다. 이는 `production-brief.md`가 요청한 버드아이/탑다운 카메라 축과
  같은 계열의 검증된 업계 관례이며, 사이드뷰 참조 이미지와 별개의 축이라는 브리핑의 6번
  제약을 뒷받침하는 외부 근거다.
- **[OBSERVED — direct retrieval, Steam API/Q1, Q2]** 두 게임 모두 던전을 오픈월드와
  분리된 **별개의 콘텐츠 단위**로 구조화한다. Diablo IV: "delve into nightmarish
  dungeons"(오픈월드 내 별도 인스턴스). Path of Exile: "gameplay outside of encampments
  is highly instanced, providing every player or party with an isolated map"(위키백과
  Q3 서술, Steam Q2 설명과 일치). 이는 기존 조사의 절차적 공간/저작된 백본 분리 원칙
  (S2/S3, `.survey` solutions.md)과 동일 계열의 패턴이며, 새 RPG 레이어의 던전형 콘텐츠도
  캠페인 10단계 백본과 분리된 별도 인스턴스 단위로 설계하는 것이 기존 조사와의 일관성을
  가장 쉽게 지키는 경로다.
- **[OBSERVED — direct retrieval, Q1/Q2]** 두 게임 모두 **2단계 성장 구조**를 공식적으로
  설명한다: 1차는 레벨업 중 습득하는 클래스/스킬트리(Diablo IV: "powerful Skill Trees";
  PoE: 클래스별 시작점에서 뻗어나가는 패시브 스킬트리), 2차는 레벨 상한 이후 열리는 확장
  보드(Diablo IV: "Paragon Boards"; PoE: 별도의 Atlas 패시브 트리). PoE 위키백과 서술은
  기본 패시브 스킬트리가 123개 지점(레벨링 99 + 퀘스트 보상 24, 논-시온 기준)까지 확장됨을
  명시한다 — 이는 PoE 자체의 공개 수치이며 Abyssal 프로젝트의 목표 수치로 전용하지 않는다.
- **[OBSERVED — direct retrieval, Q1/Q2]** 캐릭터 강함은 스탯 단순 누적이 아니라 **아이템·
  스킬 조합**에서 나온다. Diablo IV: "vast arsenal of powerful weapons, armor... unique
  combinations". PoE: 소켓에 장착하는 Skill Gem + Support Gem 조합이 "unique combination
  of power, defence and destruction"을 만든다고 명시. 이는 `production-brief.md` Source 3의
  RPG 장르 어휘(스킬트리, 아이템 등급)가 실제로 상위 타이틀에서 조합 폭발형 빌드 다양성으로
  구현된다는 근거이며, 동시에 밸런스 QA 관점에서는 **조합 우위(dominant combo) 리스크**의
  실증 사례이기도 하다.

## Bucket B — 헌터 성장 루프

대상: Solo Leveling: ARISE(Q4, iTunes 공식 앱스토어 설명).

- **[OBSERVED — direct retrieval, Q4]** 핵심 루프는 공식 설명에 "Challenge dangerous
  dungeons and defeat powerful bosses! As you grow stronger, so do the gates! Form your
  teams, apply your strategies, clear the gates, and obtain rewards!"로 명시된다 —
  게이트(던전 포탈) 진입→클리어→보상 루프이며, 게이트 난이도가 플레이어 성장에 연동된다는
  것이 공식 텍스트에 직접 진술되어 있다.
- **[OBSERVED — direct retrieval, Q4]** "Command squads of loyal Shadow Soldiers by
  extracting the shadows of monsters you have defeated and recruiting them as your new
  allies!" — 처치한 몬스터에서 그림자를 추출해 아군으로 편입하는 구조가 공식 설명에 명시.
  이는 `shared-reference-bundle.md`가 이미 지적한 대로 Abyssal의 기존 추출→동료 메커닉과
  직접 대응하는 구조이며, 이번 조사는 그 대응 관계가 웹소설 요약이 아닌 **실제 출시 게임의
  공식 제품 설명에서도 동일하게 재현**됨을 확인한 것이다(기존 브리핑 Source 1은 원작 요약,
  Q4는 게임화된 버전의 공식 확인).
- **[OBSERVED — direct retrieval, Q4]** 플레이 모드가 "Play as Jinwoo"(단일 주인공 직접
  조작)와 "Combine different hunters, abilities, and tactics and form your ultimate team"
  (영입한 헌터들로 팀을 구성하는 모드)로 공식 설명에 구분되어 존재한다. 이는 브리핑이 언급한
  Player Mode/Hunter Mode 구분과 일치하며, 새 RPG 레이어에 "던전 워든 단독 조작"과
  "동료 진형 배치" 두 축이 모두 존재할 경우 참고할 수 있는 실증된 이중 모드 구조다.
- **[INFERENCE, Q4 텍스트 기반]** "As you grow stronger, so do the gates"는 게이트 난이도가
  플레이어 성장치에 동적으로 스케일링됨을 시사하지만, 정확한 스케일링 트리거·공식은 공식
  텍스트에 없으므로 그 메커니즘 자체는 추론이다. QA 관점에서 중요한 것은 **난이도가 성장에
  연동되지 않으면 이미 클리어한 저난이도 콘텐츠가 무한 파밍 루트로 남는다**는 리스크이며,
  이는 아래 테스트 패턴 5로 이어진다.

## Bucket C — SLG 영웅수집·거점/진형 구조

대상: Kingshot(Q5, iTunes 공식 앱스토어 설명), Whiteout Survival(Q6, Google Play 공식 스토어
설명) — 동일 개발사(Century Games) 계열의 두 타이틀을 교차 확인하여 패턴 반복성을 높임.

- **[OBSERVED — direct retrieval, Q5/Q6]** 두 게임 모두 거점 방어/육성 루프와 영웅 모집
  루프가 분리된 두 시스템으로 공식 설명에 구조화된다. Kingshot: "Defend Against Invasions...
  upgrade your defenses"(거점 방어) + "Recruit Heroes... roster of unique heroes"(영웅
  모집). Whiteout Survival: "Rebuild & Restore... build a bustling, welcoming town"(거점) +
  "Plan & Pair: Heroic Combos... Mix and match their skills"(영웅 조합). 이는
  `shared-reference-bundle.md` Source 2가 요약한 Kingshot의 거점 성장/영웅 로스터 분리
  구조가 동일 장르 타이틀 전반에서 반복되는 패턴임을 뒷받침한다.
- **[OBSERVED — direct retrieval, Q6]** Whiteout Survival 공식 설명은 "All heroes share
  the same level, so you can upgrade and swap without the grind"를 명시한다 — 영웅 개별
  레벨이 아니라 **공유 레벨 풀**을 채택해, 새로 얻은 영웅이 즉시 기존 투자 수준만큼
  전력화된다. 이는 신규 획득 유닛이 별도로 처음부터 파밍되어야 하는 마찰을 제거하는 명시적
  설계 의도이며, 무상업 프로젝트에서 특히 참고할 가치가 있다(과금 우회 수단이 아니라 순수
  UX 마찰 감소 패턴).
- **[BOUNDARY]** Kingshot/Whiteout Survival의 동맹(Alliance) 협력 레이어는 양쪽 모두
  플레이어 간 실시간 PvP/공동 레이드로 공식 설명되어 있다(Kingshot: "Compete against other
  players"; Whiteout Survival: "Join an alliance to heal faster... explore further" —
  얼라이언스 소속 플레이어 간 협력). 이는 `production-brief.md` 제약 2 및 기존 조사의
  네트워크/멀티플레이어 배제 [BOUNDARY]와 정면으로 충돌하는 구조이므로, **이식 금지**로
  명시한다. `shared-reference-bundle.md`가 이미 범위를 좁혀둔 대로, Kingshot의 "rally"만
  PvE 전용 "보스 러쉬 진형"(다중 영구 동료가 한 보스에 합류) 아날로그로 제한 이식 가능하다 —
  실시간 플레이어 협력이 아니라 오프라인 단일 플레이어의 자기 동료 편성으로 재해석해야 한다.
- **[INFERENCE — 커뮤니티 소스, 수치 미인용]** 웹 검색 과정에서 확인된 다수의 팬 위키/공략
  사이트는 Kingshot·Whiteout Survival 모두에서 병종 간 상성 삼각 구조(전열 방어형 ↔ 원거리
  화력형 ↔ 중간 견제형)와 전열/후열 포지셔닝이 존재한다고 서술한다. 이 삼각 구조의 **존재
  자체**는 여러 독립 커뮤니티 소스에서 반복 확인되는 구조적 패턴이나, 구체적 배합 수치는
  개발사 공식 발표가 아닌 팬 산출 메타 수치이므로 이 문서에서는 **수치를 인용하지 않고
  구조적 존재만** 참고 신호로 남긴다. 새 진형 시스템이 포지션 역할(탱커/딜러 아날로그)을
  둘 경우, 실제 밸런스 수치는 반드시 프로젝트 자체 시뮬레이션으로 도출해야 한다.

## Frequency Ranking (G8 노벨티 보정용)

`quality-gates.md` G8은 "≤2/5 비교 타이틀에서만 등장하는 요소"를 참신성 후보로 요구한다.
이번 5개 타이틀(Diablo IV, Path of Exile, Solo Leveling: ARISE, Kingshot, Whiteout Survival)
기준 구조 요소 등장 빈도:

- **5/5 — 별도 시스템으로서의 "영구 성장" 계층**: 모든 타이틀이 런/세션을 넘어서는 영구
  진행 요소(클래스 성장, 게이트 레벨, 거점 레벨, 영웅 로스터)를 공식 설명에 명시. 이미
  Abyssal의 기존 영구 동료 메커닉과 겹치므로 참신성 후보에서 제외.
- **4/5 — 아이템/스킬 조합 기반 빌드 다양성**: Diablo IV, PoE, Solo Leveling(장비/룬 교체),
  Kingshot·Whiteout Survival(영웅+진형 조합)에서 반복. 흔한 패턴이므로 참신성 후보 아님.
- **2/5 — 추출/영입한 개체가 즉시 완전 전력화되는 공유 성장 풀**: Whiteout Survival(공유
  레벨)과 Solo Leveling(그림자 추출 즉시 전력 편입, 별도 파밍 불필요 — 공식 텍스트상 즉시
  "군대"로 편입된다고만 서술되고 개별 재파밍 요구가 명시되지 않음)에서만 확인. Diablo IV·
  PoE(동료 시스템 자체 없음)와 Kingshot(신규 영웅은 여전히 자체 스킬 재료 필요)에서는
  부재. **2/5로 G8 참신성 후보 기준(≤2/5)을 충족** — Abyssal이 기존 추출→동료 메커닉에
  "신규 동료도 즉시 전력 편입, 별도 재파밍 없음" 규칙을 명시적으로 채택하면, 노벨티스코어카드
  후보로 design 라인에 제안할 가치가 있다. 단, 실제 QA 인상 점수(≥4/5)는 플레이 가능한
  빌드가 있어야 측정 가능하므로 이 단계에서는 [TARGET] 후보일 뿐이다.
- **1/5 — 던전 난이도의 명시적 플레이어-레벨 연동 자동 스케일링**: Solo Leveling에서만
  공식 텍스트로 확인(다른 4개는 별도 난이도 티어 선택 방식이며 자동 연동이 아님). 참신성
  후보이나, Abyssal의 결정론적 시드 스테이지 구조와 충돌 가능성이 있으므로 채택 시 기존
  조사의 시드/재현성 [BOUNDARY](C7/S2/S4)와의 정합성을 먼저 검토해야 한다.

## Derived QA Test-Pattern Candidates

페르소나 규칙("사이클당 최소 3개 신규 테스트 패턴 도출")에 따라 7개 후보를 도출한다.
이 단계는 Stage 1 개념 단계이므로 실측 게이트 수치가 아니라 **향후 빌드가 나왔을 때
실행할 테스트 절차**로 제시하며, `qa/lane-archetype-testplan.md`(QAArchetypeTestPlan)가
구체적 아키타입 로테이션 절차로, `qa/lane-risk-register.md`(QARiskRegister)가 리스크
등재 형식으로 각각 흡수·확장할 수 있는 원재료로 남긴다.

1. **카메라 고정 가독성 체크** — 새 버드아이 레이어의 고정 줌 거리에서 피격 텔레그래프·
   위험구역 표시가 고밀도 전투 시에도 판독 가능한지 검증(근거: Bucket A, 아이소메트릭
   카메라 관례). 기존 사이드뷰 디펜스 레이어의 텔레그래프 튜닝과 별개로 재검증 필요.
2. **빌드 조합 우위(dominant combo) 스윕** — RPG 레이어가 공유/개방형 스킬·특성 배분을
   제공할 경우, `balance-sheet.md`의 콤보 EV 상한(중앙값 대비 1.3배 초과 금지, G2 기준)을
   초과하는 단일 조합이 있는지 전수 대조(근거: Bucket A, PoE 소켓 연결형 빌드).
3. **던전 인스턴스 결정론 체크** — 새 RPG 레이어의 인스턴스형 콘텐츠가 절차적 변형을
   포함하더라도 고정 시드 하에서 동일 규칙 상태로 수렴하는지 검증(근거: Bucket A 인스턴스
   구조; 기존 조사 C7/S2/S4의 PCG/결정론 경계를 계승).
4. **솔로/진형 모드 이원 생존성 비교** — 단독 조작 모드와 동료 진형 배치 모드가 모두 별도로
   존재할 경우, 두 모드가 각각 독립적으로 G3 승률 밴드(45–55%) 내에서 성립하는지, 어느
   한쪽이 50% 초과 지배력을 갖지 않는지 검증(근거: Bucket B, Solo Leveling Player/Hunter
   모드 이원 구조).
5. **구형 콘텐츠 파밍 정체 체크** — 플레이어가 이미 클리어한 저난이도 구간이 아웃레벨 이후에도
   유효한 파밍 루트로 남는지 확인. 남는다면 노출된 익스플로잇으로 `exploit-register.md`
   등재 후보(근거: Bucket B, 게이트 난이도 성장 연동 패턴).
6. **신규 동료 즉시 전력 편입 검증** — 새로 추출/영입한 동료가 현재 투자 수준 대비 유의미하게
   약한 상태로 시작하는지, 아니면 즉시 진형 투입 가능한 수준인지 확인. 후자가 아니면
   "포획은 실질적 선택지"라는 기존 추출→동료 설계 의도와 모순되므로 공정성 인접 리스크로
   `qa/lane-risk-register.md`에 등재 제안(근거: Bucket C, Whiteout Survival 공유 레벨 패턴).
7. **진형 역할 편중 스윕** — 진형 시스템이 포지션 역할(전열/후열, 탱커/딜러 아날로그)을
   채택할 경우, 특정 역할 구성이 최적 플레이에서 50%를 초과해 지배하지 않는지 검증. 개인
   아키타입이 아닌 진형-구성 단위에 G3 기준을 적용한 변형판(근거: Bucket C, 병종 삼각
   구조의 구조적 존재 — 정확한 배합 수치는 미인용, 프로젝트 자체 시뮬레이션 필요).

## Sibling-Lane Boundary

이 문서는 **구조적 벤치마크 패턴과 테스트 패턴 후보만** 다룬다. 실제 아키타입 로테이션
절차(러셔/터틀/이코노미형 등 5종 이상 세션 설계)는 `QAArchetypeTestPlan`
(`qa/lane-archetype-testplan.md`)의 소관이며, 위 테스트 패턴 4·7이 그 절차 설계에 입력값을
제공한다. 리스크 등재·심각도 분류·재현 절차는 `QARiskRegister`(`qa/lane-risk-register.md`)의
소관이며, 위 테스트 패턴 5·6이 리스크 후보 원재료를 제공한다. 이 문서는 어느 쪽의 표 형식도
선점하지 않는다 — 벤치마크 근거와 후보 목록만 남기고, 실제 등재/절차화는 두 자매 레인에
위임한다.

## Source Ledger

| ID | Evidence label | Source URL | 사용 한계 |
|---|---|---|---|
| Q1 | **direct page retrieval** / Steam API 공식 제품 데이터 | https://store.steampowered.com/api/appdetails?appids=2344520 (Diablo® IV) | 공식 기능 설명(던전, 클래스, 스킬트리, Paragon Board, 시즌)만 확인. 카메라 각도는 이 텍스트에 명시되지 않아 인용하지 않음. 시장 성과/유저 정서 증거 아님. |
| Q2 | **direct page retrieval** / Steam API 공식 제품 데이터 | https://store.steampowered.com/api/appdetails?appids=238960 (Path of Exile) | 공식 기능 설명(패시브 스킬트리, 스킬 젬/서포트 젬, 절차적 지역, 하이드아웃, Atlas)만 확인. |
| Q3 | **direct page retrieval** / Wikipedia (1차 공식 소스 아님, 카메라 분류 확인 용도로만 사용) | https://en.wikipedia.org/wiki/Path_of_Exile | "isometric perspective" 카메라 서술과 인스턴스 구조 서술만 인용. 개발사 발표 수치가 아닌 항목(패시브 포인트 수 등)은 PoE 자체의 공개 수치로만 취급, Abyssal 목표치로 전용하지 않음. |
| Q4 | **direct page retrieval** / iTunes Search API 공식 앱스토어 설명 (trackId 1662742277) | https://itunes.apple.com/search?term=solo+leveling+arise&entity=software | 게이트 진입→클리어→보상 루프, 그림자 추출, Player/Hunter 모드 구분만 공식 텍스트로 확인. 난이도 자동 스케일링의 정확한 트리거 메커니즘은 텍스트 밖 추론([INFERENCE] 명시). 구독 가격 등 상업 정보는 인용하지 않음(NO-COMMERCE 경계). |
| Q5 | **direct page retrieval** / iTunes Search API 공식 앱스토어 설명 (trackId 6739554056) | https://itunes.apple.com/search?term=kingshot&entity=software | 거점 방어·자원·영웅 모집·동맹·기술 구조만 공식 텍스트로 확인. 부대 구성 비율 수치는 이 소스에 없으며 별도 커뮤니티 출처이므로 인용하지 않음. |
| Q6 | **direct page retrieval** / Google Play 공식 스토어 설명 | https://play.google.com/store/apps/details?id=com.gof.global (Whiteout Survival) | 영웅 공유 레벨, 거점 재건, 동맹 협력 구조만 공식 텍스트로 확인. 평점·리뷰 텍스트는 사용자 정서 증거로 취급하지 않고 인용하지 않음. |

## Director Handoff Note

가장 중요한 결정 지점은 **Bucket C의 [BOUNDARY] 판정**이다 — Kingshot/Whiteout Survival의
동맹(Alliance) 실시간 협력 레이어는 두 공식 소스 모두에서 플레이어 간 네트워크 상호작용으로
명시되어 있어(Q5: "Compete against other players", Q6: "Join an alliance... together"),
`production-brief.md` 제약 2(오프라인/무상업/무계정)와 정면 충돌한다. 디자인 라인이 Kingshot의
"rally"(다중 파티 합동 공격)를 formation 시스템에 참고할 때, 이것이 실시간 플레이어 협력이
아니라 **오프라인 단일 플레이어가 자신의 영구 동료들을 한 보스 진형에 합류시키는 구조**로만
재해석되어야 한다는 점을 놓치면, 이후 스테이지에서 이 조사 자체가 멀티플레이어 도입의
근거로 오독될 위험이 있다 — 그 경우 G6-ops 게이트(오프라인/로컬 우선 계약)가 통째로 무너진다.
이 경계는 이미 `shared-reference-bundle.md`가 명시했지만, 이번 조사가 그 경계를 5개 공식
소스로 재확인했다는 점을 director가 최종 GDD 병합 시 formation 관련 모든 디자이너/프로그래머
레인 산출물에 대해 다시 한번 교차 검증해야 한다.
