# 씬 0 (Cinematic: 침투 개막) 제작 패키지

## 0. 산출 목적
- 트레일러/티저의 첫 12초를 고정한다.
- 플레이어가 즉시 다음을 인지하도록 만든다.
  - 항만 붕괴 지역의 생존 압박
  - S급 게이트의 차원적 위협
  - `일어나라`를 예고하는 영혼·흑색 연기·음향의 상승 텐션
  - `그림자 군단` 진입의 임계점
- 목표 감정 곡선: 공포-긴장 → 압박-각성 → 결의

## 1. 씬 정의
- **씬 ID:** `scene_00_opening_gate`
- **컷 시간:** 0:00 ~ 0:12
- **구조:** 4컷 × 3초 (총 12초)
- **연출 성격:** 오프닝 브릿지 + 핵심 룰 노출

## 2. 씬 입력 자산

### 2.1 정적/키 이미지

- `design/assets/cinematic/scene_00_opening_gate_prompt.png`
- `design/assets/cinematic/scene_00_opening_gate_v01.png`
- `design/assets/cinematic/scene_01_soul_pool_v01.png`
- `design/assets/cinematic/scene_03_possession_action_v01.png`
- `design/assets/cinematic/scene_04_domain_shift_v01.png`
- `design/assets/cinematic/scene_07_return_ui_v01.png`

### 2.2 컷 렌더 (씬 0)

- `assets/video/scene_00_shot_prompt_v01.mp4`
- `assets/video/scene_00_shot_gatev01_v01.mp4`
- `assets/video/scene_00_shot_soul_v01.mp4`
- `assets/video/scene_00_shot_domain_v01.mp4`
- `assets/video/scene_00_gate_opening_gotibo_v01.mp4`
- `assets/video/scene_00_gate_opening_gotibo_v02_scene0.mp4` (참고본)
- `assets/video/scene_00_gate_opening.mp4` (샘플 드래프트)
- `assets/video/scene_00_opening_gate_cinematic_v01.mp4` (4컷 concat 결과, 12초)
- `assets/video/scene_00_opening_gate_cinematic_v01_subbed.mp4` (SRT 하드번들)

### 2.3 오디오

- `assets/audio/domain.mp3` (예정: 현재 생성 자산 폴더에 미반영)
- `assets/audio/extract.mp3` (예정: 현재 생성 자산 폴더에 미반영)

## 3. 컨셉 프롬프트(갓티보이미젠)

### 3.1 기본 5컷

- `design/concept-image-prompts-gotibo.md`

### 3.2 확장 5컷

- `design/concept-image-prompts-gotibo-extended.md`
- `scene 0~7` 전이와 역습 구간을 잇는 추가 컷용

## 4. 씬 스토리보드 (씬 0 고정안)

| 시각 프레임 | 시간 | 핵심 연출 | 기술 키 |
|---|---:|---|---|
| S0-01 | 00:00-00:03 | 붕괴된 항만, 게이트 균열 노출 | `establish_city` |
| S0-02 | 00:03-00:06 | 게이트 탑 열림, 저역 확장 | `gate_opening` |
| S0-03 | 00:06-00:09 | 영혼 잔류 응고와 실체화 전조 | `portal_skin` |
| S0-04 | 00:09-00:12 | 영웅 개입 직전, `일어나라` 트리거 | `throne_call` |

## 5. 오디오/이펙트 매핑

- 00:00-00:02: 기본 긴장 레이어 + 저역 바닥음
- 00:02-00:06: `domain` 지속 + 공명 레이어
- 00:06-00:09: 고주파 억제 + 잔류 잉여물 레이어
- 00:09-00:12: `sfx_arise_prepare`, VO(로컬라이징 대사)

## 6. 컷 편집 규칙

- 컷 길이 고정 3초, S0 총 12초
- 컷 간 `transition`은 `dip_to_white`/`flash` 우선 사용
- 텍스트·로고는 별도 오버레이 CSV(`subtitles/vfx`)로 분리
- 색온도는 Blue/Purple vs Ember Red 유지(씬 전체 톤 락)

## 7. 템플릿 산출물(현재 권장)

- 씬 0 기본:
  - `design/assets/cinematic/scene_00_scene_script.csv`
  - `design/assets/cinematic/scene_00_shot_sheet.csv`
  - `design/assets/cinematic/scene_00_audio_cue.csv`
  - `design/assets/cinematic/scene_00_subtitles_kr.csv`
  - `design/assets/cinematic/scene_00_vfx_priority.csv`
- 씬 1 연속(씬 1: 12~18초) :
  - `design/assets/cinematic/scene_01_scene_script.csv`
  - `design/assets/cinematic/scene_01_shot_sheet.csv`
  - `design/assets/cinematic/scene_01_audio_cue.csv`
  - `design/assets/cinematic/scene_01_subtitles_kr.csv`
  - `design/assets/cinematic/scene_01_vfx_priority.csv`
## 8. 장면 전환 + 시나리오 확장(씬 0 → 1 연계)

### 8.1 상태 전환 규칙(씬 0 → 씬 1)

#### 트리거 기반 상태 머신
- **S0_EXIT(12.00s)**: `일어나라` 시작 트리거(cue 9: `sfx_invert_burst`) 진입 시 S1_PRELOAD 진입.
- **S1_PRELOAD(12.00~12.60)**: 잔류 응고 잔상 10초 계측 버퍼 확보, 전환 실패 0.6초 초과 시 `S1_FALLBACK` 진입.
- **S1_EMERGE(12.60~15.00)**: 스펙트럼 잔류가 축소·재증폭되며 병력 체감 스파크를 반복. 최소 1개 병력 실체화 이벤트가 1회 이상 감지되면 S1_GATHER 진입.
- **S1_GATHER(15.00~16.80)**: 소환된 병력이 전방 라인 정렬 후, 플레이어 HUD(미니맵)에서 `아군 점령 가능 좌표` 노출.
- **S1_TRANSITION(16.80~18.00)**: 빙의 힌트 노출 후 오디오-비주얼 잠금 해제. S1에서 4초 미만 체류하면 자동으로 S1_HOLD_LOOP로 되돌림.

#### 전환 우선순위
1. 컷 연출 완결(12~18초) > 보정 루프.
2. 씬1 실패 시: 자동 루프는 `scene_01_shot_soul_hunt_v01.mp4` 1회 반복 후 `scene_01_shot_possession_hint_v01.mp4` 진입.
3. 영웅의 실제 조작 입력 지연 시: 카메라만 전방 이동시키고 `SFX_DOMAIN_BREATH` 0.8초 재생(연결 단절 회복용).

### 8.2 실패 분기

- 컷 길이 미달(3초 미만) 또는 구간 누락 시: `scene_00_shot_prompt_v01.mp4`로 0.5초 페이드 타임워프.
- 오디오/SFX 싱크 에러가 누적되면 해당 구간 컷을 `v02_scene0` 변형으로 교체하고 씬1 큐는 재인덱싱.
- `scene_00_to_01_shot_subtitles.srt` 싱크 drift가 0.20초 초과 시 하드자막 재버닝(씬1은 cue 기준 1:1 대체).

### 9. 씨네마틱 영상 작성 방법(실무형)

### 9.1 도구 선택 우선순위

- 1차 검증: **FFmpeg concat/xfade**
- 2차 제어: **Remotion(상태 기반 씬 데이터 바인딩)**
- 3차 다국어/패키지 변형: **템플릿 기반 에디터(Shotstack·후처리용)**

### 9.2 최소 파이프라인

1. `scene_00_shot_sheet.csv`와 `scene_01_shot_sheet.csv`의 합성 순서를 승인한다.
2. `scene_00_scene_script.csv` + `scene_01_scene_script.csv`, `scene_00_audio_cue.csv` + `scene_01_audio_cue.csv`, `scene_00_subtitles_kr.csv` + `scene_01_subtitles_kr.csv`를 타임라인 0:00~0:18 기준으로 동기화한다.
3. 충돌 제어는 씬별로 각각 `scene_00_vfx_priority.csv`와 `scene_01_vfx_priority.csv`의 우선순위를 적용한다.
4. 18초 합성본 렌더 후 `scene_00_to_01_opening_encounter_cinematic_v01.mp4`, 하드자막본 생성.
5. Remotion/스크립트에서 상태 전이 실패 토스트 및 장면 툴팁 바인딩.

### 9.3 FFmpeg 최소 템플릿

```bash
ffmpeg -r 30 -f concat -safe 0 -i cinematic_manifest.txt \
  -vf "fps=30,format=yuv420p,scale=960:540" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -an \
  shadow-lord-scene0-draft.mp4
```

- 하드자막 결합 시:
```bash
ffmpeg -i shadow-lord-scene0-draft.mp4 -vf "subtitles=<scene_subtitle.srt>:force_style='Fontsize=28'" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -an shadow-lord-scene0-draft_subbed.mp4
```

```bash
ffmpeg -r 30 -f concat -safe 0 -i cinematic_manifest.txt \
  -vf "fps=30,format=yuv420p,scale=960:540" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 160k \
  shadow-lord-scene0-draft.mp4
```

## 10. QA 통과 조건

- 12초 기준: 컷 경계 튐 없음, 프레임 드롭 1초 미만
- 오디오-이미지 체감 싱크 ±150ms
- 텍스트 최소 노출 1.2초
- 최종 포맷: H.264 yuv420p, 24 또는 30fps
- 씬 전환 지연 임계치 0.5초 이하

## 11. 재생성/버전 규칙

- `scene_00_opening_gate_prompt.png`: v01 → v02 → v03
- `scene_00_gate_opening_gotibo_v02_scene0.mp4`: 참고본(참고)
- `scene_00_opening_gate_cinematic_v01.mp4`: 씬 0 최종 본선 합성본(12초, 960x540, 30fps, H.264)
- `scene_00_opening_gate_cinematic_v01_subbed.mp4`: 자막 하드번들 최종본
- 파생본 네이밍: `..._v01`, `..._v02`, `..._v00X`
- 신규 에셋은 `assets/media-manifest.json`에 즉시 추가

## 12. 출력 검증 메모

- ffprobe 기준: `scene_00_opening_gate_cinematic_v01.mp4` `duration=12.000000`, `codec=h264`, `fps=30`
- 샘플 컷 경계: `scene_00_concat_input.txt`의 4개 컷(각 3초) 순차 연결
- 자막 싱크: 0:00-0:12 구간 4행 SRT 하드버전으로 오버레이 반영

## 13. 다음 단계

- 씬 0 → 씬 1 연계 샘플(총 0:00~0:18) **승인본 생성 완료**  
  - `assets/video/scene_00_to_01_opening_encounter_cinematic_v01.mp4`
  - `assets/video/scene_00_to_01_opening_encounter_cinematic_v01_subbed.mp4`
  - `assets/video/scene_00_to_01_concat_input.txt`
  - `assets/video/scene_00_to_01_shot_subtitles.srt`
  - `design/assets/cinematic/scene_01_scene_script.csv`
  - `design/assets/cinematic/scene_01_shot_sheet.csv`
  - `design/assets/cinematic/scene_01_audio_cue.csv`
  - `design/assets/cinematic/scene_01_subtitles_kr.csv`
  - `design/assets/cinematic/scene_01_vfx_priority.csv`
- 산출물 검증 체크 완료:
  - JSON 매니페스트 연동(루트/워크스페이스)
  - 샷 순번 일치(shot_sheet ↔ 실제 비디오 순서)
  - 씬1 씬 메모리 매핑 오프셋 및 자막 드리프트(±0.2s) 확인
- 승인본은 `docs/shadow-lord-rts-rpg-hybrid-design.md` **섹션 22.1** 및 llm-wiki 본문으로 동기화 유지
## 14. 후속 씬(2~7) 전개 준비 노트

### 현재 상태

- `scene 00~01` 산출물은 완성본 기준으로 운영 중이며,  
  `S2~S7`은 상태머신 확장 문서를 통해 씬 라우팅 규격이 선행 확정되었다.
- 후속 씬 제작 시 기본 규칙:
  - 파일명은 `scene_XX_*` 접두사 + `_to_YY` 브릿지 포맷 준수
  - 컷 전환 실패시 `fallback/retry/pivot` 상태 태그를 반드시 유지
  - 씬당 최소 1개 실패 복구 씬을 템플릿에 포함

### 즉시 실행 참조

- 현재 진행 상태: `scene_02~scene_07`의 씬 CSV(스크립트/샷/오디오/자막/VFX)와 `01→07` 브릿지 concat manifest/SRT가 모두 준비됨.
- 추가 반영: 루트/워크스페이스 모두 `scene_00~07`의 mp4 컷 산출물 42건이 워크스페이스 매니페스트에 반영되었고, 루트 매니페스트는 총 46건 mp4를 반영 상태로 통합 완료.
- 다음 단계: `scene_XX_shot_*.mp4` 및 `scene_XX_to_YY_*.mp4` 병합본을 `v100` 승인 포맷으로 통일하고, 컷 전환 로그/싱크 QA 후 론칭 패키지 고정.
### 공통 네이밍(추가 고정)

- 브릿지: `scene_02_to_03_arise_push_v01.mp4`
- 상태태그: `scene_03_scene-script_fallback_v01.csv`
- 실패전환: `scene_05_despair_to_07_return_retry_v01.mp4`
