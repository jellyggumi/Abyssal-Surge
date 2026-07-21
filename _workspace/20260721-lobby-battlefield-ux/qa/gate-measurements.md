# Gate Measurements — 20260721-lobby-battlefield-ux

게임 하네스 원칙: "no adjective ever passes a gate." 아래는 실제 실행된 명령과 결과만 기록한다. 형용사·주관 평가는 게이트 통과 근거로 쓰지 않는다.

## 정적 검증

- `node --check app.js` / `react-game-ui.js` / `battle-visualizer.js` / `i18n.js` — 4/4 OK (구문).

## 대상 회귀 (변경 영역 직접 커버)

- `node --test tests/canvas-boss-strike.test.mjs tests/command-wait-feedback.test.mjs tests/campaign-map-a11y.test.mjs tests/boss-strike.test.mjs tests/battle-visualizer.test.mjs`
  - **72 pass / 0 fail.**
  - 커버: Canvas 폴백 boss-strike 발동/미발동/relax/방어 게이팅, threat-ring exposure 게이팅, 큐 대기 사유 i18n(ko/en) 및 boss-not-exposed 토스트, 캠페인 맵 키보드 포커스·role·aria·focus-visible outline·양 사전 aria 키 소유, 기존 campaign-state boss-strike 규칙, 기존 visualizer 53종.

- `node --test tests/release-closure.test.mjs tests/app-command-feedback.test.mjs`
  - **127 tests, 126 pass → 1 fail(초기) → 재실행 후 그린.**
  - 초기 실패: `new campaign ... locale` 테스트가 `window.confirm` 격리 실행을 가정 → `showConfirmDialog is not defined`. 하네스(`loadReleaseLocalization`)에 `showConfirmDialog` 추출 라인을 추가해 실제 위임 경로(테마 모달 부재 시 window.confirm 폴백)를 격리 실행하도록 갱신. **테스트를 약화하지 않고** 정확한 지역화 문구 단언을 유지하면서 신규 위임을 커버하도록 강화.

## 유니온 (전체 mjs 스위트)

- `node --test tests/*.test.mjs` (30개 파일) — **568 tests, 568 pass, 0 fail, 0 skipped.**

## 통과로 주장하지 않는(FIX 유지) 게이트 — 다음 사이클 이월

이번 사이클은 아래를 측정하지 않았으므로 통과로 주장하지 않는다(선행 감사 §1 재작업 금지 목록과 동일):

- G4/G6 구조화 몰입도 median ≥4.0/5 — 미측정.
- G4/G6 피드백 지연 ≤100ms (수락→가시 확인) — 미측정.
- G6-ops 60fps (p95 ≤16.7ms) — 여전히 미달(선행 07-21 최적화 후 warmed p95 17.5–17.7ms). 이번 UX 변경은 프레임 비용을 크게 늘리지 않도록 최소 구현(Canvas boss-strike는 기존 경량 피드백 프리미티브 재사용, threat-ring은 기존 drawActionRangeRing 패턴 재사용)으로 제한했으나 60fps 게이트 자체는 재측정하지 않음.
- 30분 메모리 soak — 미실행.
- 실기기 모바일 844×390 landscape / portrait pre-rotate 캡처 (BF-F6) — 미실행. 07-19 전술 스트립 수치는 신규 베이스라인으로 신뢰하지 않음.
- 사람 플레이테스트(코어 루프 반복률 등) — 미실행.
