# Lane: HUD Layout — Bird's-Eye Camera-Follow (UI Senior Developer)

run-id: `20260723-solo-warden-rpg-concept` · lane-owner: `UIHudLayout` (ui-senior-developer persona)
scope: 전투 화면(HUD 오버레이)에서 화면공간(screen-space) 대 월드공간(world-space) 요소 분류,
카메라-추적 앵커의 방향(portrait/landscape) 열화, `prefers-reduced-motion` 하 카메라 이동 시 동작,
채택된 렌더링 경로(Option A: Blender-베이크 스프라이트, Canvas2D 유지)에서의 앵커링 전략과 미적용
Option B(WebGL)의 문서화된 대안 경로.

**레인 경계** (director가 병합 시 참고):
- `UIInfoArchitecture` (`ui/lane-info-architecture.md`): 전투 밖 전체화면 패널(스탯 시트, 인벤토리,
  스킬 로드아웃, 파티/포메이션 편성 화면)과 그 사이 내비게이션을 소유. 본 문서는 **전투 중** HUD만
  다룬다 — 패널을 열면 이 문서의 요소들은 기존 edge-HUD 관례상 배틀 서페이스 밑에 유지되거나 가려짐,
  그 전환 규칙은 정보 아키텍처 레인 소관.
- `UIAccessibilityPerf` (`ui/lane-accessibility-perf.md`): 터치 타깃 48dp·명암비·DOM 카운트·입력
  지연 100ms 등 **측정값**과 감산-모션 CSS 전역 정합성 감사를 소유. 본 문서는 감산-모션이 카메라
  자체의 이동(신규 요구사항)과 부딪히는 지점만 규정하고, 수치 감사는 그쪽 문서에 위임.
- 본 문서는 세 문서 중 유일하게 "카메라가 움직인다"는 새 축을 다룸 — 기존 edge-HUD 계약(고정 청록)은
  카메라가 정지된 탑다운 디펜스에서 설계됐고, 이번 사이클의 신규 변수는 카메라-추적(follow-cam)이다.

---

## 0. 기존 계약 요약 (근거)

- Edge-HUD: `#defense-edge-hud`는 뷰포트 전체를 덮는 `position:absolute; pointer-events:none` 컨테이너이고,
  그 안의 `.defense-edge` (top/bottom) 자식만 `pointer-events:auto`로 상호작용 가능 — 배틀필드 중앙은
  항상 노출됨. [OBSERVED: `styles.css:37-40`]
- 세로 모드: `html[data-defense-portrait="true"]`일 때 `#defense-canvas`에 `rotate(90deg)
  translateY(-100%)` CSS 트랜스폼 적용, 캔버스는 항상 논리적 가로 좌표로 그림. HUD 청록(DOM)은 물리
  뷰포트 기준으로 배치되어 이 회전과 무관. [OBSERVED: `styles.css:53-58`, `defense-viewport.js:36-45`]
- 가로 고정 요청: 전투 진입 시 `requestFullscreen()` → 성공하면 `screen.orientation.lock("landscape")`
  시도, 둘 다 실패를 `.catch(() => undefined)`로 조용히 흡수 — **보장이 아니라 best-effort**.
  [OBSERVED: `app.js:378-382`]
- 카메라 오프셋: `cameraOffset(frame, width, height)`가 `frame.camera.{x,y}`를 뷰포트 크기로 clamp한 뒤
  `context.translate(camera.x, camera.y)`로 월드 전체를 이동 — 이미 카메라-추적의 저수준 배관이 존재.
  [OBSERVED: `battle-visualizer.js:95-101,562-565`, `battle-realtime-three.js:109-115,592-596`]
- **정정 + 확정 (ProgRenderArch `engineering/lane-render-arch.md` 반영)**: 실제 카메라 이동은 두 계열이
  공존한다. (a) `app.js`의 `updateCamera(commander)`는 **화면공간** 넛지 — 24000×12000 시뮬레이션
  월드가 항상 전체 노출된 고정 단일 화면 아레나 위에서, 지휘관 쪽으로 뷰포트를 최대 X축 18%/Y축 14%
  편향시키는 보간(`CAMERA_FOLLOW_EASING=0.18`)이며, **감산-모션 하드컷이 이미 구현되어 출하됨**
  (`this.motionQuery?.matches`일 때 보간 없이 `target`으로 즉시 스냅) [OBSERVED: `app.js:42-44,534-551`,
  `motionQuery` 바인딩은 `app.js:433`]. (b) 신규 RPG 레이어는 이와 다른 **월드공간 카메라 창**을
  쓴다 — `engineering/lane-render-arch.md#5`가 렌더링 경로(옵션 A/B) 중립적으로 확정한 값: 데드존
  뷰포트 폭 12%(x)×높이 10%(y)(플레이어가 이 사각형 안에 있으면 카메라 정지, 벗어난 초과분만 추적),
  lag easing 계수 `0.18`(기존 `CAMERA_FOLLOW_EASING` 값 재사용), 레벨 경계까지 clamp, 감산-모션 시
  easing 미적용 즉시 스냅(기존 `motionQuery.matches` 분기 재사용) [OBSERVED:
  `engineering/lane-render-arch.md:196-208`]. **카메라는 고정 상방(fixed north-up)이며 절대 회전하지
  않는다** — 이는 §6에서 채택된 Option A(고정 방향 세트로 베이크된 스프라이트)가 요구하는 제약이자,
  본 문서 §2의 회전-보정 로직이 "canvas 물리 회전(portrait 1회성)"만 다루면 되고 "camera 회전(매 프레임)"은
  존재하지 않는다고 가정할 수 있는 근거다 [OBSERVED: `engineering/lane-render-arch.md:101` 실패모드 표,
  "카메라를 고정 상방... 회전 없는 팔로우로 확정하면 이 실패 모드 자체가 발생하지 않음"]. HUD는 어느
  모델에서도 영향 없음 — `renderSnapshot()` 순서가 `clear → background → translate(camera) → world →
  restore → HUD`로, HUD draw call은 카메라 트랜스폼 밖에서 실행되어 §1의 화면공간/월드공간 분류 자체는
  변경되지 않는다 [OBSERVED: `engineering/lane-render-arch.md:199` "HUD: SCREEN-SPACE...구조적으로
  보장", ProgRenderArch IRC 확인].
- 월드 텍스트 회전 보정: `drawWorldText(context, label, x, y, portrait)`가 portrait일 때
  `translate→rotate(-90°)→fillText→restore`로 텍스트만 역회전 — 캔버스가 물리적으로 90° 돌아가도
  텍스트가 사람 눈에 항상 정방향. [OBSERVED: `battle-canvas-text.js:5-16`]
- 감산-모션: `prefersReducedMotion()`이 `matchMedia("(prefers-reduced-motion: reduce)")`를 읽어
  `this.reducedMotion`에 저장, 이펙트 진행률(`progress`)을 0으로 고정하고 `globalAlpha`를 1로 고정,
  위협 서클의 march-ants `lineDashOffset` 애니메이션을 끔(점선 모양 자체는 유지).
  [OBSERVED: `battle-visualizer.js:62-66,323-324,459-465`]
- 동료 로드아웃 상한: `MAX_LOADOUT_SIZE = 3` — 전투 중 동시 편성 가능한 영구 동료는 최대 3.
  [OBSERVED: `campaign-state.js:20,151`]
- 이펙트 풀 상한 선례: `MAX_VISUAL_EFFECTS = 24`, `MAX_VISUAL_EVENT_KEYS = 128` — 신규 부유 대미지
  숫자 풀 상한을 정할 때 이 선례를 재사용한다(§4). [OBSERVED: `battle-visualizer.js:5-6`]

이 배관은 "카메라가 정지된 탑다운"을 가정하고 만들어졌다. 신규 요구사항(bird's-eye camera-**follow**)은
카메라가 **매 틱 이동**한다는 점에서 다르다 — 이게 본 문서의 핵심 변수다.

---

## 1. 화면공간 vs 월드공간 요소 분류표

| # | HUD 요소 | 공간 | 좌표계 | 근거/판단 |
|---|---|---|---|---|
| 1 | 지휘관(플레이어) 내구 바 + 상태 라벨 | 화면공간 | `.defense-top` 청록 DOM | 기존 `#battle-commander-integrity` 패턴 그대로 유지 — 항상 같은 화면 위치라야 곁눈질 없이 확인 가능 [OBSERVED: `app.js:398,859-863`] |
| 2 | 관문(게이트) 내구 바 + integrity-meter fill | 화면공간 | `.defense-bottom` 청록 DOM | 기존 `#battle-integrity`/`#battle-integrity-fill` 패턴 유지 [OBSERVED: `app.js:404,864-871`] |
| 3 | 미션 컨텍스트 패널 (스테이지/도메인/오브젝티브) | 화면공간 | `.defense-top` 청록 DOM | 기존 `hud-panel hud-mission` 패턴 유지 [OBSERVED: `app.js:398`] |
| 4 | 스킬 액션 바 (`skill-actions`) | 화면공간 | `.defense-top` 청록 DOM | 상호작용 버튼은 카메라 이동과 무관하게 고정 탭 위치 필요 (터치 타깃 논스톱 접근) [OBSERVED: `app.js:399`] |
| 5 | 한 손 이동 조작 (`movement-actions`) | 화면공간 | `.defense-bottom` 청록 DOM | 엄지 위치 고정 — 카메라 회전/추적과 무관 [OBSERVED: `app.js:405-407`] |
| 6 | **[신규] 동료 로스터 트레이** (최대 3, 편성 아이콘 + 미니 체력) | 화면공간 | `.defense-top` 우측 청록 DOM 신설 | Kingshot 포메이션의 "누가 살아있나" 요약은 훑어보기 UI — 카메라 추적 중에도 위치 고정이라야 순간 확인 가능. `MAX_LOADOUT_SIZE=3`으로 폭 고정 [TARGET: 신규, 근거는 `campaign-state.js:20`] |
| 7 | **[신규] 버프/디버프 트레이** | 화면공간 | `.defense-top` 또는 `.defense-bottom` 청록 DOM 신설 | 지속효과 아이콘은 파악에 시간이 걸리므로 화면 고정이 원칙 (움직이는 앵커 위에서 스캔 불가) [TARGET] |
| 8 | 성장/보상 선택 카드 (`edge-card`) | 화면공간 | 뷰포트 중앙 오버레이 DOM | 기존 모달형 카드 패턴 그대로, 전투 일시정지 성격 [OBSERVED: `app.js:901-902,959-960`] |
| 9 | 추출 진행 카운트다운 텍스트 | 화면공간 | `.defense-bottom` 청록 DOM (텍스트 요약) | 숫자 판독은 화면 고정이 정확 — 월드 앵커(§행10)의 시각 보조 역할과 별개로 텍스트 소스는 화면공간에 둔다 [TARGET, `extractionProgress.holdTicks/maxHoldTicks` 기반 — OBSERVED 필드는 `defense-run-simulation.js:1588-1598`] |
| 10 | **[신규] 자기 위치 마커 + 시야 링** (플레이어 발밑) | 월드공간 | 캔버스, 카메라-추적 좌표 | 회전-대칭 도형(링)이라 portrait 회전 보정 불필요, 탑다운 ARPG 표준 관례 [TARGET] |
| 11 | **[신규] 동료 네임플레이트 + 체력바** (포메이션 위치 상단) | 월드공간 | 캔버스, 카메라-추적 좌표 | Kingshot 식 "부대 구성" 가독성은 각 동료 실제 위치 위에서 확인해야 유의미 — 화면공간 리스트(행6)는 요약, 월드 앵커는 위치 확인용, 역할 분리 [TARGET] |
| 12 | 적/엘리트 체력 링 (`drawHealthRing`) | 월드공간 | 캔버스, 카메라-추적 좌표 | 기존 함수 그대로 재사용 [OBSERVED: `battle-visualizer.js:584-585` 호출부] |
| 13 | **[신규] 위험/조준 지상 표시** (보스·엘리트 AoE 텔레그래프) | 월드공간 | 캔버스, 카메라-추적 좌표 | 기존 march-ants 원형 위협 표시(`context.arc` + dash) 확장 재사용 [OBSERVED: `battle-visualizer.js:322-327`] |
| 14 | **[신규] 추출 구역 진행 링** | 월드공간 | 캔버스, 카메라-추적 좌표 | `extractionProgress.holdTicks/maxHoldTicks` 비율을 실제 추출 지점 위에 원형 게이지로 시각화 — 화면공간 텍스트(행9)와 이중화, 위치+수치 각각 확인 [TARGET, 필드 근거: `defense-run-simulation.js:1205-1214`] |
| 15 | **[신규] 엘리트 포획/루팅 프롬프트** | 월드공간 | 캔버스, 카메라-추적 좌표 | 처치된 엘리트 시체 위 라벨 — "여기서 상호작용 가능"은 대상 위치와 결합해야 함 (`EXTRACT_ELITE` 입력과 대상 엔티티가 1:1) [TARGET, 근거: `defense-run-simulation.js:712-717`] |
| 16 | **[신규] 부유 대미지 숫자** | 월드공간 | 캔버스, 카메라-추적 좌표 | 타격 지점에서 발생해야 인과가 읽힘 — 화면 고정이면 어느 타격인지 식별 불가 [TARGET] |
| 17 | **[신규] 오프스크린 목표 웨이포인트 화살표** | 하이브리드 (월드→화면 클램프) | 목표가 뷰포트 내: 월드좌표 직접 투영 / 뷰포트 밖: 화면 가장자리로 클램프한 방향 화살표 | 카메라-추적 뷰는 화면 밖 목표(관문, 다음 스테이지 진입점)가 상시 존재 — 순수 월드공간이면 안 보이므로 클램프 필요 [TARGET] |
| 18 | 배틀 이벤트 피드백 (`#battle-event-feedback`, `aria-live`) | 화면공간 | `#defense-edge-hud` 내 고정 DOM | 스크린리더 announce는 위치 고정 DOM이라야 안정적 — 월드 앵커에 넣으면 캔버스 갱신 주기에 종속되어 `aria-live` 신뢰 불가 [OBSERVED: `app.js:401`] |

**분류 원칙**: 판독에 화면상 고정 위치가 필요한 것(수치 확인, 반복 탭, 스크린리더)은 화면공간.
발생 위치·대상과의 인과관계가 판독의 일부인 것(누가 맞았나, 어디를 밟아야 하나, 누가 어디 서 있나)은
월드공간. 화면 밖으로 나갈 수 있는 목표는 하이브리드(클램프).

---

## 2. Portrait vs Landscape 열화

가로 고정은 `requestFullscreen()` + `orientation.lock("landscape")` 둘 다 **best-effort**이며
`.catch(() => undefined)`로 무음 실패한다 [OBSERVED: `app.js:378-382`]. 이는 iOS Safari(홈 화면 추가
PWA 외에는 Orientation Lock API 미지원)와 데스크톱 브라우저(락 API 자체 미제공)에서 **상시 발생하는
정상 경로**이지, 예외가 아니다. 따라서 세로-폴백은 1급 시나리오로 취급한다.

| 상태 | 발생 조건 | 화면공간 HUD | 월드공간 앵커 |
|---|---|---|---|
| A. 가로 고정 성공 | Android Chrome/PWA 등 API 지원 환경 | 변화 없음, 정상 가로 레이아웃 | 변화 없음, 캔버스 논리좌표=물리좌표 |
| B. 가로 고정 실패, 세로 유지 (캔버스 회전 폴백) | iOS Safari, 데스크톱, API 미지원 전 브라우저 | **영향 없음** — `.defense-edge` 청록은 물리 뷰포트(`--defense-safe-*`) 기준으로 배치되어 캔버스 회전과 독립 좌표계 [OBSERVED: `styles.css:39-40` vs `:53-58`] | 대칭 도형(행10,12,13,14 링/서클)은 캔버스와 함께 자동 회전 → 추가 처리 불필요. **텍스트 포함 요소(행11,15,16)는 `drawWorldText`의 `portrait` 인자로 역회전 필수** — 안 하면 옆으로 눕거나 뒤집힌 텍스트 출력 [OBSERVED 기법: `battle-canvas-text.js:5-16`] |
| C. 세로 고정 실패, 짧은 쪽 가로 미확보 (초협소 뷰포트, 예: 접이식 기기 접힘 상태) | 물리 폭·높이 모두 최소 요구치 미달 | 화면공간 패널이 `max(84vw,620px)`/`min(42vw,340px)` clamp에 걸려 압축 — `UIAccessibilityPerf`가 터치 타깃 48dp 최소치와 함께 실측 [경계: 본 레인은 열화 존재만 명시, 수치 감사는 위임] | 월드 앵커 밀도가 화면 대비 상대적으로 높아짐 — §4의 상한(캔버스 24, DOM 8)을 초과하면 우선순위 낮은 앵커(먼 적 네임플레이트)부터 드롭 |

**행11 동료 네임플레이트의 특수 문제(상태 B 한정)**: 텍스트 라벨은 `drawWorldText` 역회전으로 해결되지만,
그 아래 체력바(사각 필 게이지)는 회전-비대칭이다 — 캔버스가 90° 돌면 가로로 넓던 바가 세로로 길어져
디자인이 깨진다. 해법: 체력바를 `drawWorldText`와 동일한 `save→translate→rotate(-portrait?90:0)→그리기→restore`
블록 안에서 라벨과 **같은 로컬 좌표계**로 함께 그린다 (텍스트 전용이 아닌 범용 `drawWorldGroup(context, x, y,
portrait, drawFn)` 헬퍼로 일반화 제안 — `battle-canvas-text.js`에 추가할 함수, 구현은 `ProgRenderArch`/
programmer 소관, 본 문서는 요구사항만 명시).

**확정 사항 반영**: `engineering/lane-render-arch.md`가 카메라를 고정 상방·무회전으로 확정했으므로
(§0), 위 표의 회전 보정 필요는 오직 **portrait 세로-폴백의 1회성 90° canvas 트랜스폼**에서만 발생한다
— 카메라 자체가 매 프레임 임의 각도로 회전하는 시나리오는 이번 사이클 범위에서 배제되어, 월드공간
앵커의 회전 처리 표면이 §2 표 하나로 완결된다.

---

## 3. `prefers-reduced-motion` × 카메라-추적 (신규 축)

기존 감산-모션 처리는 "정지 카메라 위에서 애니메이션 끄기"만 다뤘다 [OBSERVED: `battle-visualizer.js:62-66,
323-324,459-465`]. 카메라 자체가 매 틱 이동하는 신규 요구사항은 **새 감산-모션 표면**을 연다 — 카메라
이동은 화면 전체가 지속적으로 스크롤되는 것과 동등하며, 전정계 유발(vestibular trigger) 강도가 개별
이펙트 애니메이션보다 크다.

원칙 분리: **카메라 추적(follow, 기능적 — 꺼지면 플레이어가 화면 밖으로 나감)**과 **카메라 흔들림/펀치인
(shake/punch-in, 장식적 — 꺼져도 게임플레이 손실 없음)**을 별개 입력으로 취급하고 감산-모션 시 후자만 0으로:

```
camera.position = followTarget + (reducedMotion ? 0 : shakeOffset)
```

| 신호 | 표준 동작 | `reducedMotion=true` 동작 | 근거/판단 |
|---|---|---|---|
| 카메라 추적 자체 | 목표(플레이어) 주변 데드존(12%×10%) 이탈 시 초과분만 lag easing(`0.18`, 기존 `CAMERA_FOLLOW_EASING` 값 재사용)으로 추적 | **하드컷** — 보간 없이 목표 위치로 즉시 스냅. 추적 기능(데드존/월드 경계 clamp) 자체는 유지, 감산-모션과 무관하게 필요 | 지속적 화면 스크롤이 전정계 유발의 핵심 원인 — **이미 확정된 패턴**: `engineering/lane-render-arch.md:205`가 신규 카메라 모델에도 "기존 `app.js:543-545`의 `motionQuery.matches` 분기를 그대로 재사용"하도록 확정했고, 이는 `updateCamera()`가 `this.motionQuery?.matches`일 때 보간 없이 `target`을 즉시 반환하던 기존 출하 패턴과 동형이다 [OBSERVED: `app.js:534-551`, `engineering/lane-render-arch.md:196-208`] |
| 카메라 흔들림(피격/보스 강타) | 짧은 진폭의 화면 흔들림 | **완전 억제** (진폭 0) | 화면 전체 흔들림은 감산-모션의 정의상 1순위 억제 대상 |
| 시야 펀치인/줌 (Option B/WebGL 한정 — 이번 사이클 미적용, §4) | FOV 순간 변화 | **완전 억제**, 고정 FOV 유지 | 원근 변화는 2D 이펙트보다 강한 유발 요인. Option A(채택안, §4) 채택으로 실제 적용 대상 없음 — Option B 재검토 시에만 유효 |
| 월드 앵커의 위치 추적 (행10-16, 부모 엔티티를 따라감) | 부모 엔티티 실제 좌표를 그대로 따라감 | **변화 없음, 그대로 유지** | 이건 장식이 아니라 기능 — 네임플레이트가 동료를 안 따라가면 UI가 거짓말을 하게 됨. 감산-모션은 "불필요한 모션"을 줄이는 것이지 "필요한 정보 위치"를 끄는 게 아님 |
| 부유 대미지 숫자(행16)의 상승+페이드 장식 | 타격 지점에서 위로 떠오르며 흐려짐 | 상승/페이드 제거, 타격 지점에 **고정 위치로 즉시 표시 후 고정 시간 뒤 즉시 소멸** (드리프트 없음) — 기존 `progress→0, globalAlpha→1` 패턴과 동형 [OBSERVED 선례: `battle-visualizer.js:461,465`] | 수치 정보(대미지 값)는 유지, 모션 장식만 제거 |
| 위험 텔레그래프(행13) 펄스/확장 | 원이 맥동하거나 커지며 경고 강조 | 펄스 애니메이션 정지, **고정 고대비 윤곽선**으로 대체 (march-ants dash 정지와 동형) [OBSERVED 선례: `battle-visualizer.js:323-324`] | 경고 자체는 유지해야 함(안전 정보) — 모션만 제거 |
| 앵커의 부모-독립 보조 모션 (스프링랙/관성/패럴랙스) | 만약 도입 시: 부모보다 살짝 지연되어 따라오는 스프링 효과 | **금지** — 앵커는 항상 부모 좌표를 지연 없이 그대로 사용 | 부모 이동(카메라 추적) + 자식 지연 모션이 중첩되면 감산-모션 취지에 정면으로 위배되는 이중 모션 발생 |

---

## 4. 렌더링 경로별 앵커링 전략 — Option A 채택 확정, Option B 문서화된 대안

`ProgRenderArch`의 `engineering/lane-render-arch.md`가 **Option A(Blender-베이크 셀셰이드 스프라이트,
기존 Canvas2D 스냅샷 계약 유지)를 이번 사이클 채택안으로 확정**했다(§6, "단일 추천: 옵션 A") — WebGL은
검토·문서화되었으나 **이번 사이클에는 적용하지 않는다**(고정 북향 카메라가 자유 회전을 요구하지 않는 한
재검토 불필요, `lane-render-arch.md:243-246`). 아래는 확정된 Option A의 앵커링 계약을 1차 계약으로
명세하고, Option B는 향후 자유 카메라가 명시적으로 요구될 경우를 대비한 **문서화된 미적용 대안**으로
유지한다.

### Option A — 채택 확정 (Blender-baked 스프라이트, 기존 Canvas 2D 파이프라인 유지)

3D로 제작한 애셋을 Blender에서 고정 방향 세트(4~8방향)로 셀셰이드 베이크해, 기존
`battle-visualizer.js`/`defense-run-simulation.js` 패턴(Canvas 2D, `context.translate`형 카메라)에
그대로 얹는 경로. [OBSERVED: `engineering/lane-render-arch.md:60-77` 파이프라인, `:210-236` §6 채택 근거]

- **앵커 좌표계**: 스프라이트와 완전히 동일한 2D 캔버스 좌표계, `renderSnapshot()`의 world-translate
  블록 안에서 §0의 확정된 월드공간 카메라 창(데드존 12%×10%, easing 0.18, 경계 clamp)을 그대로
  적용받는다. 신규 배관은 §0에서 확정된 카메라 창 계산 로직 자체(이는 `ProgRenderArch` 소관)이고, HUD
  앵커 쪽은 기존 `project()`/draw call 패턴에 새 함수만 추가하면 됨 [OBSERVED: `battle-visualizer.js:95-101`].
- **회전 자유도**: 카메라가 §0에서 고정 상방·무회전으로 **확정**되었으므로, 스프라이트 아틀라스의
  고정 방향 세트 제약과 정확히 일치 — 회전-추적 앵커 재투영 로직은 **불필요하며 이번 사이클 범위에서
  아예 발생하지 않는다** (portrait 캔버스 90° 1회 회전만 §2에서 처리).
- **HUD 앵커 구현 방식(확정)**: 모든 신규 요소(§1 행10-17)는 **캔버스 2D draw call로 구현** — DOM으로
  승격하지 않는다. 기존 `drawHealthRing`/`drawWorldText`와 같은 함수형 draw 호출을 추가하는 것으로
  충분하며, **DOM 노드 수 증가가 0이다** — `UIAccessibilityPerf`의 DOM 상한 예산에 신규 항목이 없다.
- **비용**: 프레임당 앵커 재투영 비용이 사실상 0에 가까움(`translate` 1회 공유) — 부유 대미지 숫자
  풀도 기존 `MAX_VISUAL_EFFECTS=24` 선례를 그대로 재사용 가능 [OBSERVED 선례: `battle-visualizer.js:5`].

### Option B — 문서화된 대안 (이번 사이클 미적용)

3D 씬을 실제 WebGL 카메라(위치+회전+FOV, view-projection 행렬)로 렌더링하는 경로. `ProgRenderArch`가
검토했으나 **채택하지 않았다** — 이 저장소는 과거 WebGL/Three.js 3인칭 렌더러(6,761줄)를 실제로
운영하다 폐기한 이력이 있고, 제로 런타임 의존성 관행과 충돌한다는 것이 비채택 근거다
[OBSERVED: `engineering/lane-render-arch.md:38,214-227`]. 향후 자유 회전 카메라나 동적 조명 같은
명시적 요구가 생기면 재검토 가능한 경로로 아래 앵커링 요구사항을 보존해 둔다:

- **앵커 좌표계**: 3D 월드좌표를 카메라의 view-projection 행렬로 투영해 2D 화면좌표를 매 프레임 재계산
  해야 함 — Option A의 2D `translate`형 배관 재사용 불가.
- **HUD 앵커 권장 방식(재검토 시 적용)**: §1 행11(동료 네임플레이트+체력바), 행15(포획 프롬프트) 등
  **텍스트+상호작용 요소는 DOM 오버레이**로 분리하고 매 프레임 3D→2D 재투영 좌표만 CSS
  `transform: translate()`로 갱신. 이유: (1) 텍스트 가독성·`aria-live`/스크린리더 호환은 DOM이 캔버스
  내부 텍스트보다 근본적으로 우수. (2) 상호작용(엘리트 포획 탭)은 DOM 히트테스트가 3D 레이캐스트보다
  훨씬 저렴하고 신뢰도 높음. (3) 기존 edge-HUD 계약(safe-area, pointer-events 레이어링)을 그대로
  재사용 가능. 순수 도형 앵커(행10 자기 마커, 행12 체력 링, 행13 위험 표시)는 3D 씬 내부에 빌보드/데칼로
  유지해도 무방 — 텍스트가 없고 히트테스트가 필요 없어 DOM 승격 이득이 적음.
- **비용/DOM 상한(재검토 시 적용)**: DOM 오버레이 개수가 예산 항목이 됨 — **DOM 앵커 상한 8개**(동료 3
  + 근접 적/엘리트 최대 5)를 제안, 초과분은 캔버스/빌보드 체력 링으로 폴백.
- **감산-모션 표면 확대(재검토 시 적용)**: §3의 카메라 하드컷·흔들림 억제 외에, WebGL 경로는 **FOV
  펀치인/카메라 롤/틸트 추적**이라는 2D 경로엔 없는 추가 전정계 유발 축을 가진다.

### 경로별 비교 (기록용)

| 판단축 | Option A (채택, Canvas 2D) | Option B (미적용, WebGL) |
|---|---|---|
| HUD 앵커 구현 방식 | 캔버스 2D draw call (DOM 승격 없음) | 텍스트/상호작용 앵커만 DOM 오버레이, 도형은 3D 빌보드 |
| 신규 배관 필요량 | 낮음 — 기존 `project()`/카메라 창 계산만 추가 | 높음 — 3D→2D 재투영, DOM 동기화 루프 신설 |
| 카메라 회전 자유도 | 고정 상방·무회전 (Option A 채택으로 확정) | 완전 자유 (진짜 3D 카메라) — 이번 사이클 불필요 |
| DOM 카운트 영향 | 없음 | 있음 (앵커당 1노드, 상한 8 제안) |
| 감산-모션 표면 | §3 표만 해당 | §3 표 + FOV/롤/틸트 추가 축 |
| 이번 사이클 상태 | **채택, 본 문서 §1-3의 구현 계약** | 문서화된 대안, 미적용 |

**본 레인의 결론**: `ProgRenderArch`의 Option A 채택에 따라 본 문서 §1-3의 신규 요소는 모두 캔버스 2D
draw call로 구현되며 DOM 노드 증가가 없다 — Option B 열은 향후 자유-카메라 요구가 명시적으로 생길
경우를 위한 보존 기록이다.

---

## 5. Gate-checkable 값 (G4/G6 입력 예고)

측정·최종 감사는 `UIAccessibilityPerf`(`ui/lane-accessibility-perf.md`) 소관이며, 아래는 본 레인이
설계 단계에서 제안하는 상한/목표값이다 — 확정치가 아니라 그쪽 문서가 실측 검증할 TARGET.

```yaml
hud_layout_targets:
  rendering_path_adopted: "option-a-canvas2d-baked-sprite"  # engineering/lane-render-arch.md#6 확정
  screen_space_elements: 10          # 표 §1의 화면공간 요소 개수 (행1-9,18)
  world_space_elements: 8            # 표 §1의 월드공간+하이브리드 요소 개수 (행10-17)
  companion_nameplate_cap: 3         # MAX_LOADOUT_SIZE 재사용 [OBSERVED: campaign-state.js:20]
  floating_damage_number_pool_cap: 24  # MAX_VISUAL_EFFECTS 선례 재사용 [OBSERVED: battle-visualizer.js:5]
  path_b_dom_anchor_cap: 8           # Option B(미적용) 한정 보존값 — 동료 3 + 근접 적/엘리트 5, 재검토 시 사용 [TARGET]
  camera_deadzone_pct: [12, 10]      # x%,y% — engineering/lane-render-arch.md:201 확정
  camera_lag_easing: 0.18            # 기존 CAMERA_FOLLOW_EASING 재사용 — engineering/lane-render-arch.md:204
  reduced_motion_camera_follow: "hard-cut, no lerp"   # §3, engineering/lane-render-arch.md:205와 정합
  reduced_motion_camera_shake: "suppressed (amplitude 0)"  # §3
  reduced_motion_world_anchor_position_tracking: "unaffected"  # §3 — 기능이지 장식이 아님
  portrait_text_anchor_rotation_compensation: "required (drawWorldText pattern)"  # §2
  portrait_symmetric_anchor_rotation_compensation: "not required (auto via canvas transform)"  # §2
  camera_rotation_compensation: "not applicable (fixed north-up camera, confirmed Option A constraint)"  # §0/§2
```

---

## director handoff note

가장 중요한 새 사실은 **렌더링 경로 분기가 해소되었다**는 것이다 — `ProgRenderArch`가
`engineering/lane-render-arch.md`에서 Option A(Blender-베이크 셀셰이드 스프라이트, 기존 Canvas2D 계약
유지)를 확정 채택했으므로, 본 문서의 신규 요소(동료 네임플레이트·체력바, 포획 프롬프트, 부유 대미지
숫자 등)는 **모두 캔버스 2D draw call로 구현되며 DOM 노드 증가가 없다** — 애초에 우려했던 "Path B 채택
시 절반 재작성" 리스크는 소멸했다. 대신 director가 반드시 인지해야 할 새 리스크는 **카메라가 고정
상방·무회전이라는 전제 하나에 본 문서와 렌더링 아키텍처 문서 둘 다의 핵심 결정이 동시에 의존한다**는
점이다: (1) `ProgRenderArch`의 고정 방향 세트 스프라이트 베이크는 회전 카메라를 지원하지 않고, (2) 본
문서 §2의 회전-보정 로직은 "카메라 회전은 없고 canvas의 1회성 90° portrait 회전만 있다"는 가정 위에서
성립한다. 만약 통합 GDD 단계에서 디자이너나 다른 UI 레인이 "카메라가 플레이어 조작에 따라 자유롭게
회전/기울어지는" 연출을 핵심 훅으로 전제하면, 이는 Option A의 고정-북향 전제와 정면 충돌하며
`lane-render-arch.md`의 Option B 재검토뿐 아니라 본 문서 §1-4 전체의 회전-보정 설계도 함께 재작성해야
하는 연쇄 변경이 발생한다 — 이 단일 가정이 두 레인의 산출물을 동시에 지탱하는 축이므로, 병합 전
director가 자유-카메라 요구가 어디에도 없음을 재확인해야 한다.
