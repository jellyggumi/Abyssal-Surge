# Cycle 1 Retrospective — 20260721-lobby-battlefield-ux

로비/전장 UI를 사용자 경험·사용성 관점에서 서브에이전트로 분석하고, 그 회고를 근거로 개선한 사이클.

## 방법 (게임 하네스 준수)

1. 서브에이전트 2건(로비/전장) 읽기전용 UX 감사 → `design/lobby-ux-audit.md`, `design/battlefield-ux-audit.md`. 각 감사는 선행 회고(`20260716-shadow-lord-rts-rpg`, `20260718-*`, `20260719-sound-direction`, `20260720-canvas-native-boss-threat`, `20260721-mesh-command-telemetry`)를 먼저 훑어 **재작업 금지 목록**을 분리하고, 신규 발견만 후보로 올렸다.
2. 신규 발견 중 P0/P1과 저비용·고가치 P2를 이번 사이클 범위로 확정(`intake/production-brief.md`).
3. 파일 경합이 없도록 **쓰기 집합이 겹치지 않는** 3개 executor 레인을 병렬 실행, 공유 파일(i18n.js)은 사전에 중앙에서 키를 추가. LB-D(테마 모달)는 레인 파일들의 합집합을 건드리므로 병합 후 직접 구현.
4. 게이트: 정적 검증 → 대상 회귀 → 유니온 스위트. 결과는 `qa/gate-measurements.md`.

## What shipped (verified)

- **BF-F1 (P0) — Canvas 폴백 boss-strike 패리티.** `battle-visualizer.js`에 `updateBossStrike(dt)`/`playBossStrikeEffect`/`drawBossThreatRing()`와 생성자 필드·stage bossPattern latch를 추가. 이제 reduced-motion/저사양 사용자의 Canvas 경로도 WebGL과 **동일한** 보스 자동공격 코어 루프를 받고, 위협 반경 링(cooldown이 빌수록 밝아짐)을 본다. 피해는 exposure 무관(campaign-state와 일치), 링 드로잉만 exposure 게이팅 — 코드 주석에 명시. `tests/canvas-boss-strike.test.mjs` 4종.
- **BF-F2 (P1) — 대기 사유 지역화.** `cooldown`/`acknowledging`/`boss-not-exposed`/`waiting-renderer`/`timeout-fallback`이 더 이상 원문 영어 토큰으로 큐 UI에 새지 않는다. `translateRejectionReason` 분기 + app.js 인라인 fallback + i18n.js ko/en 키.
- **BF-F3 (P1) — 정체 사유 선제 안내.** `boss-not-exposed`는 최초 사유 전이 시 5초 토스트(가까이 걸어가도 해결 불가한 유일한 대기 사유). out-of-range 패턴과 동일한 전이 가드.
- **LB-A (P1) — 캠페인 맵 키보드 접근.** 가로 스크롤 컨테이너에 `tabIndex=0`/`role=group`/`data-i18n-aria=map.ariaLabel`, `.war-table-grid:focus-visible` outline(테마 `--focus` 토큰). 키보드 전용 사용자가 스테이지 6~10에 도달 가능. `tests/campaign-map-a11y.test.mjs` 4종.
- **LB-D (P2) — 테마 커스텀 확인 모달.** "새 캠페인 시작"의 파괴적 확인이 네이티브 `window.confirm`에서 기존 `result-overlay` 테마를 재사용하는 Promise 기반 모달로 교체. Escape/백드롭=취소, 포커스 이동, `#game-root` inert. 테마 모달 부재(테스트 DOM) 시 window.confirm 폴백 유지로 파괴적 가드가 절대 조용히 스킵되지 않음.
- **동반 수정.** Canvas `liveAlly`가 `alliesSet` 멤버십을 검사하도록 복원(선택 프루닝 정확성). 이전 turn에서 발견·커밋된 항목.

검증: 유니온 `node --test tests/*.test.mjs` = **568 pass / 0 fail**. 상세 `qa/gate-measurements.md`.

## What was NOT touched, and why

- **다음 사이클 백로그(의도적 이연, 재작업 금지 아님):** LB-B(locked 카드 거짓 hover 어포던스), LB-C(900–1399px 반응형 공백), LB-E(첫 페인트 로딩 인디케이터), LB-F(영어 자막 트랙), LB-G(경고 문구 근접성), LB-H(`!important` 리팩터), LB-I(정보 위계 재배치), BF-F4(목표/압박 HUD 중복), BF-F5(얇은 게이지 바·색상 전용 구분), BF-F6(실기기 모바일 재캡처), BF-F7(브레이크포인트 기반 기능 사라짐).
- **수치 게이트(FIX 유지):** G4/G6 몰입도·≤100ms 지연, G6-ops 60fps(여전히 미달), 30분 soak, 사람 플레이테스트. 이번 UX 변경은 프레임 비용을 크게 늘리지 않도록 기존 경량 프리미티브·기존 링 드로잉 패턴을 재사용했으나, 60fps 게이트 자체는 재측정하지 않았으므로 통과로 주장하지 않는다. BF-F1 수정이 렌더 예산을 늘리지 않았음을 다음 사이클에서 재측정 권고.

## Next-cycle entry decision

**Stage 2(retune/verify)** 진입 권고, 신규 컨셉 전환 아님:

1. **BF-F6 실기기 캡처를 선행.** 844×390 landscape + portrait pre-rotate Chromium 캡처로 07-19 전술 스트립 수치를 대체하고, 이후 어떤 배틀 HUD 리워크의 베이스라인으로 삼는다. 렌더 비용을 늘리는 UX 리디자인은 60fps 게이트가 닫히기 전엔 착수 금지.
2. **LB-C(900–1399px 반응형)를 다음 로비 P1로.** 이번 감사가 요구한 390–1280px 범위 중 상당 부분이 미검증 폴백이라는 구조적 리스크. LB-B/LB-I와 함께 로비 정보 위계·어포던스 정리로 묶는다.
3. **BF-F4/F5(HUD 중복·가독성)** 는 F6 캡처 결과로 우선순위를 재확정한다.

재론 금지: canvas-required engagement 모델, WebGL danger ring/readiness gauge/out-of-range 토스트(이미 구현), 비주얼 언어, Possession/Lord's Domain 의도적 보류, 사운드 lobby/battle 씬 정책.
