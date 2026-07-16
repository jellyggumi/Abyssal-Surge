# 씬 0 (Cinematic: 침투 개막) 제작 패키지

## 0. 산출 목적
- 트레일러/티저의 첫 12초를 책임지는 **오프닝 시퀀스**를 확정한다.
- 사용자에게 즉시 아래를 전달한다.
  - 항만 붕괴 공간의 위기감
  - S급 게이트의 차원적 위협
  - `일어나라`를 예고하는 영혼·흑색 연기·음향의 텐션
  - `그림자 군단`으로의 전환 준비 신호

## 1. 씬 정의
- **씬 ID:** `scene_00_opening_gate`
- **컷 시간:** 0:00 ~ 0:12
- **목표 감정:** 공포-긴장 → 압박-각성 → 결의(영웅 개입)
- **연출 성격:** 오프닝 영화적 브릿지 + 룰 노출(환경/목표/핵심 보상 경로)

## 2. 씬 입력 자산

- 이미지(완성본):
  - `_workspace/20260716-shadow-lord-rts-rpg/design/assets/cinematic/scene_00_opening_gate_prompt.png`
- 영상(현재 생성본, 12초 정지화 + 푸시/스케일):
  - `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_gate_opening.mp4`
- 오디오 참조(선택):
  - `assets/audio/domain.mp3`(게이트/차원 개방 톤)

## 3. 컨셉 프롬프트 (갓티보이미젠 최종 반영본)

### 3.1 영어 프롬프트
`A cinematic concept art of a ruined hyper-modern coastal city at dusk, colossal vertical red gate tower tearing open to another dimension, neon blue and violet ghost flames leaking from the breach, collapsed skyscrapers, wet asphalt reflections, dark shadowy smoke currents flowing upward, high contrast, hyper-detailed concept art, dynamic composition`

### 3.2 부정 프롬프트
`blurry, low detail, cartoon, overexposed, text, watermark, duplicate figures`

### 3.3 카메라/구도
- 샷 타입: 와이드 16:9, 저각도 로우 앵글
- 톤: High contrast, blue/purple vs ember red split
- 동작: 천천히 인물+건축 축으로 드래그(2~3단 추적)

## 4. 씬 스토리보드(씬 0 전용)

| 시각 프레임 | 시간 | 핵심 연출 | 기술 키
|---|---:|---|---|
| S0-01 | 00:00-00:03 | 붕괴된 항만 시야 오프닝, 거리의 균열과 레드 게이트 실루엣 점등 | `establish_city`
| S0-02 | 00:03-00:06 | 거대한 게이트 탑 균열, 정적 + 저역 노이즈 상승 | `gate_opening`
| S0-03 | 00:06-00:09 | 붉은 차원문 내부의 푸른 영혼 물결이 도시를 침식 | `portal_skin`
| S0-04 | 00:09-00:12 | 카메라가 영웅 입장 방향으로 회전, `일어나라` 예고 텍스트/심볼 플래시(자막 분리권장) | `throne_call` |

## 5. 오디오/이펙트 매핑

- 00:00-00:02: `impact_impact` low impact layer + 하향식 wind
- 00:02-00:06: `domain` (느린 공명, 저역 확장)
- 00:06-00:09: 고주파 억제 + 잔향 확장
- 00:09-00:12: `sfx_arise_prepare`(가벼운 심장 박동/메탈성 잔향) + 음성 키워드(대사 선택)

## 6. 컷 편집 규칙

- 컷 길이 최소 3초, 씬 총 12초에서 4컷 구성
- 각 프레임 변경 전 1 프레임 이내에 상태 텍스트 노출(내부 QA 시)
- 최종 노출 텍스트는 별도 CSV에서 주입
- 씬 전체 색온도는 파장 단일화(blue/purple vs ember red) 유지

## 7. 자막/VO 텍스트 예시

- KR: `문이 열린다.`
- KR: `그림자들은 깨어난다.`
- KR: `그림자 군주가 호출된다.`
- EN(로컬라이징): `The gate awakened. The shadow legion answers.`

## 8. QA 통과 조건

- 12초 기준: 프레임 드롭 1초 미만, 컷 경계 튕김 없음
- 오디오-이미지 싱크 체감 오차 ±150ms 내
- 가독성 노출(텍스트) 최소 1.2초 보장
- 영상 출력: H.264, yuv420p, 24/30fps 중 1개 명시 버전

## 9. 재생성/버전 규칙

- `scene_00_opening_gate_prompt.png`: v01 → v02 ... (자연광/컬러 보정 후보 관리)
- `scene_00_gate_opening.mp4`: v001(내부), v010(리뷰), v100(승인)
- 파생본은 `design/cinematic/` 또는 `assets/video/` 하위에 `..._v01` 접미사 사용

## 10. 다음 단계

- 00-씬 완료 후, **씬 1의 `일어나라` 연출**과 인터페이스 연결 전용 브릿지 컷 1개를 즉시 확정.
- 14초 버전(12초→14초)에서 1회 반전 전환(색상) 인서트 테스트를 진행해 컷 전환 연속성 비교.

---

> 비고: 이미지 소스는 현재 Pollinations 기반 생성물이다. 차기 수정 라운드에서 같은 장면을 2~3개 후보 생성해 컷 안정성(A/B 비교) 후 고정할 것을 권장한다.