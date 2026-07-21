# Production Brief — Lobby & Battlefield UX Improvement Cycle

**Cycle:** 20260721-lobby-battlefield-ux
**Requested by:** 사용자 (사용자 경험 중심 사용성 개선, 서브에이전트 활용, 게임 하네스 검증)
**Method:** 서브에이전트(planner→architect 역할 대체, executor) 읽기전용 감사 2건 선행 → 이 브리핑 → 구현 → 하네스 검증 → 회고.

## 선행 감사

- `agent://4-LobbyUIAudit2` — 로비/메인메뉴/스테이지 브리핑 UX 감사 (전문 보관: 본 디렉터리 `design/lobby-ux-audit.md`)
- `agent://5-BattlefieldUIAudit2` — 전장 HUD/커맨드 오버레이 UX 감사 (전문 보관: 본 디렉터리 `design/battlefield-ux-audit.md`)

두 감사 모두 선행 회고(`_workspace/20260716-shadow-lord-rts-rpg`, `20260718-*`, `20260719-sound-direction`, `20260720-canvas-native-boss-threat`, `20260721-mesh-command-telemetry`)를 먼저 훑어 재작업 금지 항목을 분리했다. 아래 범위는 "신규 발견" 중에서만 선정했다.

## 이번 사이클 범위 (In-scope)

| ID | 출처 | 심각도 | 내용 |
|---|---|---|---|
| BF-F1 | Battlefield §F1 | **P0** | Canvas 폴백(`battle-visualizer.js`)에 boss-strike 피해 로직과 위협 텔레그래프(danger ring 상당물)가 전혀 없음 — reduced-motion/저사양 사용자가 다른(더 쉬운) 코어 루프를 조용히 받는 공정성·일관성 결함 |
| BF-F2 | Battlefield §F2 | P1 | `evaluateQueuedCommandReadiness`가 반환하는 `cooldown`/`acknowledging`/`boss-not-exposed`/`waiting-renderer`/`timeout-fallback` 사유가 `translateRejectionReason`에 분기가 없어 큐 UI에 원문 영어 토큰 그대로 노출 |
| BF-F3 | Battlefield §F3 | P1 | `out-of-range` 외 대기 사유(특히 `boss-not-exposed`)에는 선제 토스트가 없어 사용자가 커맨드가 왜 안 나가는지 알 방법이 없음 |
| LB-A | Lobby §A | P1 | 캠페인 맵(10단계 워 테이블) 가로 스크롤 컨테이너가 키보드로 접근 불가 (`tabindex` 없음, 카드가 포커스 불가 `div`) |
| LB-D | Lobby §D | P2 | "새 캠페인 시작" 진행상황 삭제 확인이 유일하게 네이티브 `window.confirm()` 사용 — 테마 일관성 이탈 |

## 이번 사이클 범위 밖 — 다음 사이클 백로그 (재작업 금지 아님, 의도적 이연)

- LB-B (locked 카드 거짓 hover 어포던스), LB-C (900–1399px 반응형 공백), LB-E (첫 페인트 로딩 인디케이터), LB-F (영어 자막 트랙 누락), LB-G (경고 문구 근접성), LB-H (`!important` 리팩터), LB-I (정보 위계 재배치)
- BF-F4 (목표/압박 HUD 중복), BF-F5 (얇은 게이지 바 + 색상 전용 구분), BF-F6 (모바일 전술 스트립 재검증 필요), BF-F7 (브레이크포인트 기반 기능 사라짐)
- G4/G6/G7 수치 게이트(몰입도, ≤100ms 지연, 60fps, 30분 soak, 코어 루프 반복률) — 이번 사이클에서 통과 주장하지 않음. BF-F1 수정이 프레임 비용을 늘리지 않도록 최소 구현으로 제한.

## 재작업 금지 확인 목록 (감사에서 이미 확정/완료로 표시)

Possession/Lord's Domain 의도적 보류, 비주얼 언어(차콜/엠버/틸), 내레이션 타이핑+reduced-motion 접근성 경로, 사운드 lobby/battle 씬 전환 정책, WebGL danger ring/readiness gauge/out-of-range 토스트(이미 구현됨 — BF-F1은 "Canvas에 없음"이 신규 발견이지 WebGL 재작업 아님).

## 완료 기준

1. BF-F1: Canvas 폴백 경로에서도 보스 근접 시 `boss-strike` 피해가 적용되고, 화면에 위협 반경/쿨다운 텔레그래프가 보인다. `tests/boss-strike.test.mjs`가 Canvas 경로도 커버하도록 확장(또는 동등 신규 테스트).
2. BF-F2/F3: `cooldown`/`acknowledging`/`boss-not-exposed`/`waiting-renderer`/`timeout-fallback` 각각 한국어/영어 번역 문구가 있고, `boss-not-exposed`는 최초 전이 시 토스트가 뜬다. 관련 `tests/app-command-feedback.test.mjs`/`tests/command-queue-realtime.test.mjs` 케이스 추가.
3. LB-A: 캠페인 맵 스크롤 컨테이너가 키보드 포커스+방향키(or 좌우 버튼)로 전체 10단계에 도달 가능. 관련 신규 테스트(jsdom, `stage-navigation.test.mjs` 혹은 신규 파일).
4. LB-D: `window.confirm()` 제거, 기존 테마 모달 패턴(`mission-briefing`/`result-overlay`)과 동일한 커스텀 확인 모달로 대체. 취소/확인 양쪽 경로 테스트.
5. 전체 프로젝트 테스트 스위트(`node --test tests/`) 그린 유지, 신규 회귀 없음. 결과를 `qa/gate-measurements.md`에 기록.
6. `retrospectives/cycle-1-retrospective.md`에 무엇을 고쳤는지/무엇을 의도적으로 안 건드렸는지/다음 사이클 진입 결정을 기록.
