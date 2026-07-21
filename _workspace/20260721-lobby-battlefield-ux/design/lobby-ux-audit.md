# 로비 / 메인 메뉴 / 스테이지 브리핑 UX·사용성 감사

**범위**: `react-game-ui.js` (CampaignLobby, CampaignCockpit 브리핑 마크업), `react-game-ui.css`, `app.js`(로비 관련 로직), `index.html`, `i18n.js`(로비 문구), `README.md:1-159`.
**미대상**: 전장(Battlefield HUD)/커맨드 오버레이 — 별도 감사(`battlefield-ux-audit.md`)가 담당. 다만 로비-전장 경계에 걸친 `stage-selector`(브리핑 상단 진행 내비)와 `mission-briefing` 모달은 로비 흐름의 일부로 포함했다.
**방법**: 읽기 전용 코드 분석. 코드 수정 없음.

---

## 1. 선행 회고/설계 요약 — 재작업 금지 목록

| # | 항목 | 근거 | 상태 |
|---|---|---|---|
| 1 | 비주얼 언어(차콜/엠버/틸, 오리지널 실루엣, 차용 IP 금지) | `design/presentation-spec.md` Decisions | **확정** — 재디자인 제안 금지 |
| 2 | 모든 주요 상태 변화는 텍스트+아이콘+모션(+선택적 사운드) 큐를 동반해야 함 | `presentation-spec.md` | **확정 원칙** |
| 3 | 320 CSS-px 폭에서 핵심 액션이 가로 스크롤 없이 동작 | `presentation-spec.md` 가독성 종료 기준 | **확정 기준** (핵심 액션=전투 커맨드 한정, 로비 정보 콘텐츠엔 미적용 — §3에서 신규 발견) |
| 4 | Possession(2단계)·Lord's Domain(3단계) 최종 효과는 "의도적 보류" | `presentation-spec.md` | **재작업 금지** |
| 5 | 시네마틱 제작 파이프라인(스토리보드→러프→Remotion) | `presentation-spec.md` | **확정** |
| 6 | 내레이션 타이핑 + reduced-motion + sr-only 접근성 경로 라이브 검증 완료 | `retrospectives/phase-04-ui-integration.json` | **완료** — 재구현 금지 |
| 7 | 보상 텍스트-밸런스 수치 동기화 | `phase-04-ui-integration.json` | `applied: true` — 재제안 금지 |
| 8 | BGM lobby/battle 씬 단위 전환, 스테이지 밴드 확장은 별도 트랙 | `sound-direction.md:28,254` | **다른 트랙 소유** |
| 9 | 내레이션 언어별 오디오 계약, boss-phase-change 통합 큐 | `sound-direction.md:253-257` | **다른 트랙 소유** (영상 자막은 다른 표면 — §3-F 신규) |
| 10 | 10스테이지 24×12 그리드/경로/도달가능성 결정론 검증 완료 | `tests/stage-navigation.test.mjs` | 로비 UX 무관 — 재검토 불필요 |

### 1-1. 무효화된 과거 QA 증거

`_workspace/20260716-shadow-lord-rts-rpg/qa/mobile-stage-selector-playtest-20260717.png`는 현재 코드(`react-game-ui.css:2029-2031`, `:3700-3701` — `.cockpit-top .stage-selector { display:none !important }` at `max-width:899px`)와 불일치하는 구형 스냅샷. 다음 사이클에서 신규 캡처로 교체 권고.

---

## 2. 신규 발견 목록

### A. 캠페인 맵(10-스테이지 워 테이블) — 키보드 접근 불가 [P1] [신규]
근거: `react-game-ui.js:175` `.campaign-map-grid war-table-grid`에 `tabindex` 없음 + `react-game-ui.css:566-572` `overflow-x:auto`가 전 구간(390~1280px)에 항상 적용. `.map-node`도 포커스 불가 `div`.
왜 나쁜가: 키보드 전용 사용자는 스테이지 1~5만 보고 6~10단계 존재를 알 방법이 없음. `presentation-spec.md`의 "프로그램적 이름과 키보드 포커스 순서" 원칙과 상충.
개선 방향: 스크롤 컨테이너에 `tabindex="0"`+`role="group"`/`aria-label` 또는 좌우 이동 버튼 추가.

### B. 맵 카드의 거짓 클릭 어포던스 [P1] [신규]
근거: `react-game-ui.css:591-595` hover 시 translateY+glow가 locked 카드에도 적용되나 `app.js`에 `.map-node`/`.war-table-node` 클릭 리스너가 전혀 없음.
개선 방향: 실제 액션 부여 또는 비대화형 요소는 hover 효과 제거+`cursor:default`.

### C. 반응형 브레이크포인트 불일치 (900~1399px 미검증 폴백) [P1] [신규]
근거: `react-game-ui.css:362` `@media (min-width:1400px)`에서만 콕핏 그리드 레이아웃 전환, `@media (max-width:720px)`에서 모바일 보정. 900~1399px(요구 검증 범위 포함)는 두 레이아웃 사이 미검증 폴백.
개선 방향: 브레이크포인트를 1280px/1024px로 낮추거나 900~1399px 전용 완충 레이아웃 설계.

### D. "새 캠페인 시작" 파괴적 확인이 테마 이탈 네이티브 다이얼로그 [P2] [신규]
근거: `app.js:4400` `window.confirm(translate("confirm.newCampaign"))`.
왜 나쁜가: 유일하게 가장 파괴적인 액션만 브라우저 기본 confirm 사용 — 스타일링 불가, 모바일 위치 부자연스러움, Playwright `page.on('dialog')` 별도 처리 필요.
개선 방향: `mission-briefing`/`result-overlay`와 동일 테마의 커스텀 확인 모달로 교체.

### E. 첫 페인트 전 로딩/빈 상태 부재 [P2] [신규]
근거: `index.html:37-45` 4개 render-blocking 동기 스크립트, 스켈레톤/스피너/`aria-busy` 없음.
개선 방향: `#react-game-root` 안에 정적 로딩 인디케이터 선삽입, React 마운트 후 제거.

### F. 시네마틱 자막 한국어 전용 [P2] [신규]
근거: `react-game-ui.js:124-131` `<track srcLang="ko">`만 존재, `.en.vtt` 없음.
개선 방향: 영어 VTT 추가 또는 `lang=en`에서 자막 비활성화+트랜스크립트 강조.

### G. 파괴적 경고 문구가 버튼과 시각적으로 멀리 떨어짐 [P2] [신규]
근거: 버튼(~L99) → 시네마틱 블록(~L104-157) → 경고 문구(~L158) 순. `aria-describedby`는 연결돼 있으나 시각적 근접성 없음.
개선 방향: 경고 문구를 버튼 바로 아래로 이동.

### H. `!important` 남용 — 스타일 계약 취약성 [P2] [신규 관찰]
근거: 로비/브리핑 규칙 다수(`.lobby-panel`, `.war-table-node`, `.mission-briefing-*`, `.codex-*`)가 `!important` 동반.
개선 방향: 로비/브리핑 스코프 `!important` 제거 리팩터를 별도 엔지니어링 티켓화.

### I. 정보 위계 — 긴 스크롤과 "예정" 카드 위치 [P2] [신규]
근거: 헤더→히어로→액션→시네마틱→경고→맵(10)→스토리보드(5)→"예정된 사령부 체계"(비기능 3카드, `.feature-card`와 동일 시각 무게)→코덱스(액션/아이템/스킬). 섹션 점프 링크 없음.
개선 방향: 코덱스를 시네마틱 직후·예고 카드보다 앞으로 재배치, 또는 skip-link 추가.

---

## 3. 우선순위 제안 Top 5

1. **[P1]** 캠페인 맵 키보드 접근 경로 추가 (§A)
2. **[P1]** 워 테이블 노드 hover 어포던스 불일치 해소 (§B)
3. **[P1]** 900~1399px 반응형 공백 해소 (§C)
4. **[P2]** "새 캠페인 시작" 확인을 테마 모달로 교체 (§D)
5. **[P2]** 첫 페인트 전 로딩 인디케이터 (§E)

(§F, G, H, I는 P2 추가 발견, 백로그 편입 권고.)
