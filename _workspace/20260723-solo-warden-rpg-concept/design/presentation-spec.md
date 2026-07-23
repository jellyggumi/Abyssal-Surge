# Presentation Spec — Solo Warden RPG Layer

## 화풍 전환 (명시적 결정)

기존 배포 스프라이트(`dusk-warden-atlas.png` 등)는 사실적 페인팅 다크판타지, 청록/주황 계열 원소 글로우. 신규 RPG 레이어는 사용자 레퍼런스 이미지 기준 **셀셰이딩 애니메이션풍**(Hades 비교급 완성도)으로 전환한다:

- 플랫/셀 셰이딩, 명확한 실루엣 우선
- 웜 오텀 팔레트(주황/황토/적갈색 배경, 레이어드 폴리지)
- 히트 시 다이나믹 라이트-트레일 파티클
- 미니멀 원형 HUD 아이콘 + 기하학적 클린 필 바

**마이그레이션 경계**: 기존 사실적 아틀라스는 즉시 폐기하지 않는다 — 신규 레이어 전용 신규 베이크, 병존 가능(자산 경로 스왑만으로 상호 롤백). 완전 통일은 Stage 2 이후 아트 리뷰 결정.

## 카메라 (화풍과 독립된 축)

레퍼런스 이미지는 사이드뷰지만 사용자 명시 지시는 **버즈아이(탑다운) 2.5D, 플레이어 팔로우**. 화풍(셀셰이딩·팔레트·파티클)과 카메라 각도(버즈아이·팔로우)를 독립 축으로 취급 — 하나의 근거로 다른 하나를 추론하지 않는다.

```yaml
camera:
  angle: bird's-eye fixed elevation, north-up (no free rotation)
  follow: world-space window panning, deadzone 12%x/10%y, lag easing 0.18, reduced-motion hard-cut
  authoring: "3D-authored in Blender, baked to cel-shaded PNG atlas at fixed elevation — NOT real-time WebGL"
label: TARGET
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
