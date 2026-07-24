# Presentation Spec — Solo Warden RPG Layer

## 화풍 전환 (명시적 결정)

기존 배포 스프라이트(`dusk-warden-atlas.png` 등)는 사실적 페인팅 다크판타지, 청록/주황 계열 원소 글로우. 신규 RPG 레이어는 사용자 레퍼런스 이미지 기준 **셀셰이딩 애니메이션풍**(Hades 비교급 완성도)으로 전환한다:

- 플랫/셀 셰이딩, 명확한 실루엣 우선
- 웜 오텀 팔레트(주황/황토/적갈색 배경, 레이어드 폴리지)
- 히트 시 다이나믹 라이트-트레일 파티클
- 미니멀 원형 HUD 아이콘 + 기하학적 클린 필 바

**마이그레이션 경계**: 기존 사실적 아틀라스는 즉시 폐기하지 않는다 — 신규 레이어 전용 신규 베이크, 병존 가능(자산 경로 스왑만으로 상호 롤백). 완전 통일은 Stage 2 이후 아트 리뷰 결정.

## 카메라 (화풍과 독립된 축) — **Cycle 3에서 Option B로 재채택 (D17 참조)**

레퍼런스 이미지는 사이드뷰지만 사용자 명시 지시는 최초 **버즈아이(탑다운) 2.5D, 플레이어 팔로우**(Option A, 아래 "Superseded" 참조)였다. Cycle 3에서 사용자가 명시적으로 자유 회전 카메라를 요구 — `UNIFIED-GDD.md:219`가 정의한 재검토 조건("자유 회전 카메라나 동적 조명이 명시적으로 요구되면 재검토")이 실제로 트리거됨. 화풍(셀셰이딩·팔레트·파티클)과 카메라 모델은 여전히 독립 축 — 화풍 축은 변경 없음.

```yaml
camera:
  angle: free orbit — yaw unrestricted, pitch clamped [30°, 85°] from ground plane (default 65°)
  follow: world-space 3D target tracking (commander position), lag easing 0.18 (기존 CAMERA_FOLLOW_EASING 재사용), reduced-motion hard-cut on auto-follow only — user-driven drag/pinch input always responsive regardless of reduced-motion
  zoom: distance clamped to [near, far] scaled from arena/model bounding box (exact values TBD at implementation, measured against GLB content)
  control: one-finger drag = orbit (yaw/pitch), two-finger pinch = zoom, movement input unaffected (separate control surface)
  authoring: "real-time WebGL via three.js — Blender GLB assets (assets/models/abyssal-command/abyssal-command-resource-pack.glb) rendered live, NOT baked to sprite atlas"
label: TARGET (Cycle 3)
```

### Superseded — Option A (Cycle 1/2 결정, 재검토됨)

아래는 Cycle 1에서 채택되고 Cycle 2까지 유효했던 원래 결정이다. 삭제하지 않고 보존 — 아티팩트 계약(`artifact-contract.md`) 원칙 및 향후 자유 카메라 요구가 철회될 경우의 롤백 경로.

```yaml
camera_superseded:
  angle: bird's-eye fixed elevation, north-up (no free rotation)
  follow: world-space window panning, deadzone 12%x/10%y, lag easing 0.18, reduced-motion hard-cut
  authoring: "3D-authored in Blender, baked to cel-shaded PNG atlas at fixed elevation — NOT real-time WebGL"
label: SUPERSEDED (see D17)
```

## 씬/이펙트별 몰입 의도 (G4 입력)

| 씬/이펙트 | 의도 | 저감모드 대체 |
|---|---|---|
| 정예 추출 성공 | 결정론적 확정감, 화려하지만 짧은 확정 이펙트 | 정적 아이콘+텍스트 즉시 표시 |
| Boss Rally Window 발동 | 전 동료 일제 수렴 — "합동 돌격"으로 읽히는 화력 집중감 | 타겟 인디케이터 정적 표시, 애니메이션 생략 |
| 결집 강화(Formation Surge) 발동 | 역전 순간의 명확한 파워업 신호 | 색상 변화 없이 수치 배지로 즉시 표시 |
| DOWNED 전이 | 명확하되 패닉 유발 아닌 절제된 피드백 | 정적 회색조 아이콘 전환 |
| 스킬트리 노드 해금 | 성취감 있는 확산 애니메이션+파티클 | 즉시 상태 전환, 테두리색 변경만 |
| 아이템 등급 획득 | 등급 고조감(확대+반짝임) | 즉시 표시, 테두리색 정적 |

## HUD 앵커링 원칙 (렌더 경로 무관 공통)

화면공간(고정): 내구바/미션패널/스킬바/이동조작/동료로스터트레이/버프트레이/보상카드/`aria-live`.
월드공간(카메라추적): 자기위치마커/동료네임플레이트+체력바/적체력링/위험표시/추출진행링/포획프롬프트/부유대미지숫자.
하이브리드(클램프): 오프스크린 목표 웨이포인트.

세로모드 폴백 시 텍스트 포함 월드앵커는 `drawWorldText` 역회전 필수, 대칭 도형은 캔버스 자동회전으로 무처리.

전체 근거: `intake/shared-reference-bundle.md`, `engineering/lane-render-arch.md`, `ui/lane-hud-layout.md`. 통합본: `design/UNIFIED-GDD.md` §5, §6.2, §11.
