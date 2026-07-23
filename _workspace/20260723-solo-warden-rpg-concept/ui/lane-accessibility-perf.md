# UI Lane — 접근성 & 성능 예산 (Accessibility & Performance Budget)

- role: `ui-senior-developer` (lane 3 of 3 — 형제 레인: `UIInfoArchitecture` = `ui/lane-info-architecture.md`(패널/내비게이션 IA), `UIHudLayout` = `ui/lane-hud-layout.md`(화면-공간/월드-공간 배치))
- run-id: `20260723-solo-warden-rpg-concept`
- scope boundary: 이 레인은 **숫자로 검증 가능한 G4/G6 게이트 입력값**만 다룬다 — 어떤 패널이 존재하는지(IA 레인), 패널이 화면 어디에 앵커되는지(HUD 레이아웃 레인)는 다루지 않는다. 여기서 정의하는 임계값은 세 레인 전체(및 형제 레인이 설계할 모든 신규 화면)에 공통 적용되는 접근성/성능 계약이다.
- authority cited: `docs/abyssal-command-defense-survivor-design.md` (`prefers-reduced-motion` 존중, 위험/피해/선택 상태의 비-색상 텍스트 대비 원칙 — 원문: "접근성 설정과 `prefers-reduced-motion`을 존중한다... 위험·피해·선택 상태는 정적인 대비와 텍스트로도 읽을 수 있어야 한다"), `.claude/skills/game-studio-harness/references/quality-gates.md` (G4/G6 임계값), `styles.css` (기존 44px 터치 타깃, `prefers-reduced-motion` 미디어쿼리 2곳 — 라인 5, 44, 59, 155-156, 183-186 관측)

---

## 1. 밀도 증가로 인한 탭 정밀도 리스크 [핵심 플래그]

**[OBSERVED]** 기존 조작 체계는 이동-only다 (`docs/abyssal-command-defense-survivor-design.md` L11: "플레이어 입력은 이동에 집중한다. 기본 공격과 대상 선택은 자동이며, 조준·공격·전술 명령 대기열을 요구하지 않는다"). 기존 상호작용 표면은 스테이지 카드(`grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))`), 동료 카드, 5버튼 원-썸 컨트롤(`grid-template-columns: repeat(5, minmax(44px, 1fr))`) 정도로, 화면당 동시 노출 인터랙티브 요소가 **≤10개** 수준이다 (`styles.css` L15, 155 관측).

**[INFERENCE]** 인벤토리 그리드(아이템 슬롯), 스킬트리(노드+연결선), 포메이션 셋업(진형 슬롯×동료 드래그)은 구조적으로 화면당 **20~40개**의 동시 탭 가능 요소를 요구한다 — 그리드/트리 레이아웃은 목록형 레이아웃보다 단위 면적당 상호작용 밀도가 2~4배 높다. 좁은 모바일 뷰포트(최소 폭 320px 지원, `styles.css` L3 관측)에서 슬롯 간 간격이 줄어들면, 인접 슬롯 오탭(mis-tap) 확률이 이동-only 체계 대비 유의미하게 상승한다.

**리스크 진술**: 기존 44px 터치 타깃 + 관대한 그리드 간격(`gap: .5rem`~`.65rem`)은 저밀도 화면에서 검증된 값이지만, 인벤토리/스킬트리/포메이션처럼 화면당 슬롯 수가 3~4배 늘어나는 화면에 그대로 적용하면 인접 슬롯 침범(target overlap)과 실수 탭이 급증할 것으로 예상된다. **이 레인은 밀도가 높은 3개 화면 카테고리에 대해 기존 44px보다 엄격한 48dp 하한 + 최소 간격 규칙을 명시적으로 요구한다.**

```yaml
touch_target_risk_flag:
  existing_baseline: "44px min (styles.css button/one-thumb-controls) — validated for ≤10 concurrent interactive elements/screen, move-only input scheme"
  new_screens_at_risk: [inventory-grid, skill-tree, formation-setup]
  risk_driver: "20-40 concurrent tappable slots/screen vs existing ≤10 — density ratio ~2-4x"
  mitigation: "48dp floor (not 44px) + explicit min-gap rule (section 2) for these 3 screen types only; other screens may retain 44px"
  label: "[INFERENCE] — density ratio derived from structural slot-count estimate (grid/tree topology), not measured; must be confirmed by QA mis-tap rate probe once screens are prototyped"
```

---

## 2. 터치 타깃 크기 (G4 입력값)

| 화면 | 최소 크기 | 최소 슬롯 간 간격 | 근거 | 레이블 |
|---|---|---|---|---|
| inventory-grid (슬롯) | **48×48dp** | **≥6px** (기존 `.5rem`=8px보다 좁혀지지 않음, 슬롯 자체 확대로 흡수) | WCAG 2.5.5 AAA(44×44 CSS px) 상회 + 밀도 리스크 상쇄분 | [TARGET] |
| skill-tree (노드) | **48×48dp**, 연결선 히트박스 제외 | **≥12px** 노드 중심간 최소 거리 64dp | 노드는 선택 후 상세 패널이 열리는 2단계 상호작용이라 오탭 시 되돌리기 쉬움 — 간격은 인벤토리보다 넉넉히 확보 | [TARGET] |
| formation-setup (진형 슬롯, 드래그 소스/타깃) | **48×48dp** (드래그 타깃은 **56×56dp** 권장 — 드롭 정밀도가 탭보다 더 어렵다) | **≥8px** | 드래그 제스처는 탭보다 오차 허용도가 낮음 — 업계 관행상 드래그 타깃은 탭 타깃보다 15~20% 확대 | [TARGET] |
| 기존 화면 (스테이지 선택, 동료 카드, 원-썸 컨트롤) | 44px 유지 | 변경 없음 | 저밀도 화면에서 이미 검증됨 — 재작업 불필요 | [OBSERVED] |

```yaml
g4_touch_target:
  new_dense_screens_min_dp: 48
  new_dense_screens_min_dp_source: "WCAG 2.5.5 Level AAA baseline (44x44 CSS px) + density-risk margin"
  drag_target_min_dp: 56
  drag_target_rationale: "drop-precision harder than tap-precision; +15-20% industry convention"
  legacy_screens_min_px: 44
  legacy_screens_evidence: "styles.css:5 (button), styles.css:155-156 (one-thumb-controls)"
  measurement_method: "computed min-width/min-height in DevTools + manual thumb-reach pass on 360x780 viewport (smallest supported per styles.css:3 min-width:320px)"
  label: TARGET
```

---

## 3. 대비 비율 — 웜 오텀 팔레트의 웜-온-웜 리스크 [핵심 플래그]

**[OBSERVED]** 아트 방향 결정: 셀셰이딩/애니메 스타일, 웜 오텀 배경 팔레트(`intake/shared-reference-bundle.md` "warm autumn-forest background with layered painterly foliage"). **[OBSERVED]** 기존 다크 UI는 시안/블루 액센트(`#81d6ff`, `#79d6ff`, `#80d8ff`) 위에 저채도 다크 네이비 배경(`#050812`, `#0a1a29`)을 쓰는 콜드 팔레트로, 텍스트 대비가 배경과 자연스럽게 분리된다(`styles.css` L1, 6, 89 관측).

**리스크 진술**: 웜 오텀 팔레트(주황/황토/적갈색 계열 배경·폴리지)에 아이템 등급 색(예: 주황=희귀, 금색=전설 같은 흔한 RPG 관행)이나 UI 강조색을 얹으면, **웜-온-웜 색상 쌍은 색상환에서 인접해 명도/채도만으로 구분되기 쉬워 대비 비율이 WCAG 임계값 미달로 떨어질 위험이 구조적으로 높다** — 예: 주황 배경(#c46a3a 유사) 위 금색 텍스트(#d4a04a 유사)는 색상(hue)이 30~40도 이내로 근접해 휘도 대비만으로 버텨야 하는데, 웜 톤은 대체로 중~고휘도 대역에 몰려 있어 이 여유가 좁다.

```yaml
contrast_risk_flag:
  palette_shift: "cold cyan-on-navy (existing, #81d6ff on #050812, high hue separation) -> warm autumn (target, orange/gold/rust family, low hue separation risk)"
  risk_pair_example: "warm accent text (gold/amber) on warm background (orange/rust) — hue proximity ~30-40deg, contrast must rely entirely on luminance delta"
  affected_surfaces: [item-grade badges, skill-tree node highlight states, inventory rarity glow/border]
  label: "[INFERENCE] — palette not yet finalized by designer/art direction lane; risk is structural (warm-family hue proximity), not measured against final hex values"
```

| 요소 | 임계값 | 근거 | 레이블 |
|---|---|---|---|
| 본문/라벨 텍스트 vs 배경 | **≥4.5:1** (WCAG AA 일반 텍스트) | 표준 임계값 | [TARGET] |
| 대형 텍스트(≥24px 또는 ≥19px bold, 예: 스탯 큰 숫자) vs 배경 | **≥3:1** (WCAG AA large text) | 표준 임계값 | [TARGET] |
| 등급 배지 테두리/아이콘 vs 인접 배경 | **≥3:1** (WCAG AA non-text/UI component) | 등급 구분은 사실상 UI 컴포넌트 식별 신호이므로 비-텍스트 임계값 적용 | [TARGET] |
| 포커스 링/선택 상태 (`:focus-visible` 아웃라인) | **≥3:1** vs 인접 배경, 두께 ≥2px 유지 | 기존 `outline: 2px solid #81d6ff`가 콜드 팔레트에서 검증된 패턴(`styles.css` L6) — 웜 팔레트 전환 시 이 아웃라인 색이 배경과 저대비가 되지 않도록 별도 검증 필요 | [TARGET] |
| **디자이너/아트 방향에 대한 요구사항** | 최종 웜 팔레트 헥스값이 확정되면, 이 레인이 지정한 6개 표면(등급 배지, 스킬트리 노드, 포커스 링 등)에 대해 실측 대비 계산(WCAG 공식)을 1회 수행 — 자동 통과 가정 금지 | 웜-온-웜 리스크가 구조적으로 존재하므로 사후 검증이 아니라 팔레트 확정 시점에 이 레인으로 색상표를 회부해야 함 | [TARGET] |

---

## 4. 감소-모션 패리티 — 스킬트리/인벤토리 전환 애니메이션

**[OBSERVED]** `prefers-reduced-motion: reduce` 쿼리가 이미 2곳에 존재(`styles.css` L59 전역, L183-186 로컬 — `.tactical-map::after`, `.integrity-meter i`). 프로젝트 원칙: "저감 모드에서는 연속 흔들림·번쩍임·장식 애니메이션을 줄이고, 위험·피해·선택 상태는 정적인 대비와 텍스트로도 읽을 수 있어야 한다."

신규 화면에 적용할 규칙:

| 애니메이션 | 기본 동작 | 저감 모드 동작 | 정보 손실 여부 | 레이블 |
|---|---|---|---|---|
| 스킬트리 노드 잠금해제 (glow pulse + 파티클) | 300ms 확산 애니메이션 + 파티클 | 즉시 상태 전환(0ms), 정적 테두리 색 변경만 | 없음 — 잠금해제 상태는 아이콘 채움 + 텍스트 라벨로 이미 인코딩(섹션 5) | [TARGET] |
| 인벤토리 슬롯 정렬/필터 전환 (아이템 재배치 슬라이드) | 200ms ease 슬라이드 | 즉시 재배치(0ms), 페이드 없이 스냅 | 없음 — 최종 위치는 그리드 좌표로 결정적(deterministic) | [TARGET] |
| 등급 획득 연출 (신규 아이템 획득 시 확대+반짝임) | 250ms scale+shimmer | 즉시 표시, shimmer 생략, 테두리색 정적 표시 | 없음 — 등급은 색+아이콘+텍스트 3중 인코딩(섹션 5)이라 반짝임 생략해도 정보 유지 | [TARGET] |
| 스킬트리 화면 진입/이탈 전환 (패널 슬라이드-인) | 200ms 슬라이드 | 페이드만 100ms 또는 즉시 전환 | 없음 — 내비게이션 상태 변화이며 판정에 필요한 정보 없음 | [TARGET] |

```yaml
g4_reduced_motion:
  new_animated_elements: [skill-node-unlock, inventory-slot-reflow, item-grade-acquire-fx, panel-transition]
  reduced_mode_max_duration_ms: 100
  reduced_mode_rule: "decorative motion (particles, shimmer, ease-slide) removed entirely; state-defining motion (position/value change) collapses to instant or <=100ms linear, never omitted"
  parity_check: "every animated state change must have a zero-animation equivalent that conveys the same information via static color+icon+text (ties to section 5)"
  existing_pattern_reused: "styles.css:59 global *,*::before,*::after transition/animation:none; styles.css:183-186 local override pattern"
  label: TARGET
```

---

## 5. 아이템 등급 색상-독립 인코딩 [필수 명시]

**[OBSERVED]** 프로젝트 기존 원칙(`docs/abyssal-command-defense-survivor-design.md` L12): "위험·피해·선택 상태는 정적인 대비와 텍스트로도 읽을 수 있어야 한다" — 색상 단독 인코딩 금지가 이미 확립된 프로젝트 규범이다. 이 레인은 신규 아이템 등급(rarity/grade) 시스템에 동일 원칙을 적용한다.

**규칙: 등급은 반드시 3중 인코딩(색상 + 아이콘/모양 + 텍스트) 중 최소 2개 채널이 색상 없이도 등급을 완전히 식별 가능해야 한다.**

| 등급 (예시 5단계 — 최종 명칭/단계 수는 designer 레인 확정) | 색상 (참고용, 단독 사용 금지) | 아이콘/모양 (색맹·저시력 사용자용 1차 식별 채널) | 텍스트 라벨 (스크린리더/최종 확인용) | 테두리 스타일 (2차 시각 채널) |
|---|---|---|---|---|
| 1등급 (일반) | 회색 계열 | 원(circle) 아이콘, 꼭짓점 0개 | "일반" / "Common" | 실선 1px |
| 2등급 (고급) | 녹색 계열 | 삼각형(triangle) 아이콘, 꼭짓점 3개 | "고급" / "Uncommon" | 실선 1.5px |
| 3등급 (희귀) | 청색 계열 | 사각형(square) 아이콘, 꼭짓점 4개 | "희귀" / "Rare" | 이중선(double) 1.5px |
| 4등급 (영웅) | 자색 계열 | 오각별(pentagon-star) 아이콘, 꼭짓점 5개 | "영웅" / "Epic" | 이중선 2px + 코너 노치 |
| 5등급 (전설) | 금색 계열(웜 팔레트와 충돌 리스크 — 섹션 3 참조) | 육각별(hexagram) 아이콘, 꼭짓점 6개 | "전설" / "Legendary" | 이중선 2px + 코너 노치 + 대각선 해치 패턴 |

**설계 근거**: 아이콘의 꼭짓점 수를 등급과 1:1 대응시키는 이유는 — 형태 인식이 색상 인식보다 색각 이상(약 남성 인구의 8%) 및 저채도 웜 팔레트 환경 모두에서 더 안정적이기 때문이다. 텍스트 라벨은 스크린리더 및 툴팁 확인용 3차 채널로 항상 DOM에 존재(시각적으로 숨김 가능하나 `aria-label` 또는 `sr-only` 텍스트로 유지).

```yaml
g4_color_independent_encoding:
  domain: item-grade-tiers
  required_channels_min: 2
  channel_1_shape: "vertex-count icon (circle=0, triangle=3, square=4, pentagon-star=5, hexagram=6) — color-blind-safe primary channel"
  channel_2_text: "always-present text label (visible or aria-label), never color-only"
  channel_3_border_optional: "line-style escalation (solid -> double -> double+notch -> double+notch+hatch) as tertiary reinforcement"
  color_role: "supplementary/decorative only — grade must remain 100% identifiable with color channel disabled (grayscale render test)"
  verification_method: "grayscale screenshot diff — render each grade badge in grayscale, confirm shape+text still uniquely identify tier without relying on hue"
  existing_project_precedent: "docs/abyssal-command-defense-survivor-design.md:12 — danger/damage/selection states already require static-contrast+text readability, this extends same principle to item grade"
  label: TARGET
```

---

## 6. DOM 노드 상한 (화면당)

**[OBSERVED]** 기존 화면 DOM 밀도 관측 기반 추정: 로비 화면(스테이지 카드×N + 동료 카드×N)은 카드당 대략 4~6개 자식 노드(아이콘/제목/부제/상태) 구조를 사용(`styles.css` L16, L112-117, L135-137 구조 관측). 배틀 HUD는 `#defense-battle-surface` 아래 절대배치 패널 소수(5~8개)로 매우 가볍다.

| 화면 | 최대 슬롯/노드 수 | 슬롯당 DOM 노드 | 화면당 DOM 노드 상한 | 근거 | 레이블 |
|---|---|---|---|---|---|
| inventory-grid | 60 슬롯(스크롤 가상화 전 가정) | ≤5 (아이콘/등급배지/수량/이름/컨테이너) | **≤450** (가상 스크롤 적용 시 뷰포트 내 ~24슬롯×5 = 120 실측 목표, 450은 비가상화 폴백 상한) | 60슬롯×5노드=300 + 헤더/필터바/여백 오버헤드 ~150 | [TARGET] |
| skill-tree | 40 노드 + 연결선(SVG 또는 CSS) | ≤4 (노드 원+아이콘+텍스트+연결선 1개) | **≤300** | 40노드×4=160 + 패널 크롬 + 상세 사이드패널 ~140 | [TARGET] |
| formation-setup | 진형 슬롯 ≤12 + 동료 후보 리스트 ≤20 | 슬롯 ≤6(드롭존+아이콘+스탯요약), 후보 ≤5 | **≤250** | 12×6 + 20×5 = 172 + 크롬 ~78 | [TARGET] |
| 기존 로비/HUD 화면 (참고 기준선) | 다양 | 4~6 | 관측치 기준 대략 150~250 추정 | 실측 미실시 — 신규 화면 예산 설정을 위한 정성적 참고치 | [INFERENCE] |

```yaml
g6_dom_node_ceiling:
  inventory_grid_max_nodes: 450
  inventory_grid_virtualized_target: 120
  skill_tree_max_nodes: 300
  formation_setup_max_nodes: 250
  measurement_method: "document.querySelectorAll('#screen-root *').length at worst-case full-population state (max items/nodes/slots filled)"
  virtualization_requirement: "inventory-grid MUST virtualize (windowed rendering) once item count exceeds ~24 visible slots — non-virtualized 450 ceiling is an explicit fallback bound, not the design target"
  escalation_rule: "ceiling breach reported to programmer + director before adding another screen element, per persona Error Handling protocol — consolidate, do not silently skip"
  label: TARGET
```

---

## 7. 입력 지연 예산 (G6, 기존 ≤100ms 계약과 일관)

**[OBSERVED]** 기존 계약: G6 게이트 임계값 "input ≤100ms"(`quality-gates.md` G6 행), UI senior developer 페르소나 명시 "input latency for every tap/drag control (≤100ms)". 이 레인은 신규 화면 3종에도 동일 예산을 적용하되, 상호작용 유형별 지연 원인을 분해한다.

| 상호작용 | 입력→시각 피드백 지연 상한 | 지연 구성 요소 | 레이블 |
|---|---|---|---|
| 인벤토리 슬롯 탭(아이템 선택) | **≤100ms** | 터치 이벤트→상태 갱신→리렌더 | [TARGET] |
| 스킬트리 노드 탭(상세 패널 오픈) | **≤100ms** (패널 오픈 애니메이션 자체는 별도, 섹션 4 규칙 적용) | 동일 | [TARGET] |
| 포메이션 드래그 시작→드롭존 하이라이트 | **≤50ms** (드래그는 탭보다 짧은 피드백 지연 요구 — 드래그 중 시각 추적이 끊기면 정밀도가 더 떨어짐) | 드래그 이벤트→하이라이트 렌더 | [TARGET] |
| 포메이션 드롭 확정(놓기)→진형 갱신 반영 | **≤100ms** | 드롭 이벤트→sim state 반영 확인→리렌더(읽기 전용 관찰자 경계 유지, 섹션 8 참조) | [TARGET] |

```yaml
g6_input_latency:
  tap_budget_ms: 100
  drag_start_feedback_budget_ms: 50
  drag_start_rationale: "drag requires tighter feedback loop than tap — visual tracking loss during drag degrades precision more than a delayed tap ack"
  drop_confirm_budget_ms: 100
  measurement_method: "Performance API markers: pointerdown/dragstart timestamp -> next paint timestamp (requestAnimationFrame callback), p95 over >=20 samples per interaction type"
  consistency_note: "matches existing G6 contract (quality-gates.md G6 row: 'input <=100ms') and ui-senior-developer persona baseline; drag-start is a stricter internal sub-budget, not a contract change"
  label: TARGET
```

---

## 8. 렌더 경계 원칙 (재확인)

**[OBSERVED]** 페르소나 원칙 3: "Read-only against simulation: UI reflects confirmed sim state; it never becomes a second rules authority." 이 레인이 정의한 모든 지연/DOM 예산은 이 경계를 전제로 한다 — 즉 UI가 결정론적 시뮬레이션의 확정 상태를 읽어 렌더링하는 비용만 측정하며, 시뮬레이션 로직 자체의 지연은 프로그래머 레인(`engineering/perf-budget.md`)의 책임이다. 이 레인의 100ms/50ms 예산은 "이벤트 발생 → UI 페인트"까지만 커버한다.

---

## 9. 형제 레인과의 경계

- `UIInfoArchitecture`(정보구조 레인): 어떤 화면/패널이 존재하고 어떻게 내비게이션되는지는 그쪽 소관. 이 레인은 그 화면들 중 밀도가 높은 3종(inventory-grid/skill-tree/formation-setup)에 접근성·성능 숫자만 부여한다 — 화면 자체의 존재 여부나 이름은 여기서 확정하지 않는다.
- `UIHudLayout`(HUD 레이아웃 레인): 화면-공간 vs 월드-공간 앵커링, 카메라-팔로우 좌표계는 그쪽 소관. 이 레인의 터치 타깃/DOM 예산은 앵커링 방식과 무관하게 적용되는 절대 수치다.
- 경계 접점: 세 레인 모두 동일한 3개 신규 화면(인벤토리/스킬트리/포메이션)을 다루므로, 디렉터 병합 시 "이 화면이 존재한다(IA) + 화면이 어디 앵커된다(HUD) + 화면의 접근성/성능 숫자는 이렇다(본 레인)"를 한 화면 스펙으로 합쳐야 한다.

---

## 디렉터 핸드오프 노트

이 레인에서 가장 중요한 결정은 **인벤토리/스킬트리/포메이션 3개 화면에 한해 기존 44px 터치 타깃 기준을 48dp(드래그 타깃은 56dp)로 상향한 것**이다 — 근거는 밀도가 저밀도 이동-only 체계 대비 2~4배 높아 오탭 리스크가 구조적으로 커진다는 점([INFERENCE], 섹션 1)이며, 이는 기존 검증된 44px 기준을 프로젝트 전역에서 깨는 것이 아니라 **밀도가 높은 화면 카테고리에만 국한된 예외 규칙**이다. 디렉터가 통합 GDD 작성 시 이 예외를 "전역 기준 변경"으로 오독하지 않도록, 저밀도 기존 화면(로비/HUD/원-썸 컨트롤)은 44px을 그대로 유지한다는 점을 명시해야 한다. 두 번째로 중요한 점: 웜 오텀 팔레트의 웜-온-웜 대비 리스크(섹션 3)와 아이템 등급 색-독립 인코딩(섹션 5)은 아직 확정되지 않은 디자이너의 팔레트/등급 체계에 대한 **선제 제약 조건**이므로, designer 레인이 색상표와 등급 단계 수를 확정하는 시점에 반드시 이 레인의 대비 임계값과 형태(꼭짓점 수) 인코딩표를 참조해야 한다 — 순서를 반대로 하면(팔레트 먼저 확정 후 접근성 검증) 재작업 비용이 발생한다.
