# Motion Previs 분석 보고서

## 분석 대상과 추적성

- 원본: `assets/video/abyssal-surge-cinematic.mp4`
- 원본 SHA-256: `b84ccfa905e2be365f6def1df3a5f4553e6d74468c413c1a7c8edbab9ed8b95a`
- 컨테이너 길이: 19.020초
- 영상 스트림: H.264 High, 960×540, yuv420p, 24 fps, 456프레임, 19.000초
- 오디오 스트림: AAC-LC, 22,050 Hz, 스테레오, 19.020초
- 분석 계약: `skill://motion-previs-studio`
- 번들: `_workspace/20260718-resource-refinement/engineering/previs-bundle/`

`reference.mp4`는 원본 스트림을 재인코딩하지 않고 faststart 메타데이터로 재배치한 참조 클립이다. 원본과 참조 클립의 SHA-256은 각각 manifest에 따로 기록되어 있다. `frames/frame_001.jpg`부터 `frame_019.jpg`까지는 ffmpeg로 초당 1프레임씩 실제 디코딩한 19개 참조 프레임이며, `contact_sheet.jpg`는 같은 샘플링으로 만든 5×4 시트다.

## 측정 결과

### 장면 및 프레임 차이

`scene_measurements.json`은 456개 모든 프레임에 대해 FFmpeg `signalstats`의 YDIF/UDIF/VDIF/YAVG와 `scdet`의 MAFD/scene score를 기록한다.

- hard-cut 판정 임계값: scdet score 8.0
- 검출된 hard cut: 0개
- 최대 scene score: 4.077, 프레임 170, 7.083333초
- 결론: 임계값을 넘는 불연속 컷은 측정되지 않았다. 연속 동작과 점진 전환을 컷으로 꾸며내지 않고, 전체 프레임 차이 시계열과 1초 샘플 간 평균 절대 휘도 차이를 그대로 제공한다.

원시 FFmpeg 출력은 `frame_metrics.ffmetadata`와 `scene_cuts.ffmetadata`에 보존했다.

### 카메라/화면 운동

`camera_motion.json`은 240×136 grayscale 분석 프레임에 Hann window를 적용하고, 인접 프레임을 whole-frame phase correlation으로 정렬해 얻은 2D apparent translation을 원본 960×540 좌표와 정규화 좌표로 제공한다.

- 측정 가능 프레임: 419
- 전환 또는 비강체 운동 오염으로 구분한 프레임: 36
- 원점 프레임: 1
- 측정 프레임의 프레임당 절대 정렬 이동 중앙값: X 0.0 px, Y 0.0 px
- 측정 프레임의 프레임당 절대 정렬 이동 최대값: X 4.0 px, Y 3.9706 px
- raw 보조 측정: FFmpeg `vidstabdetect` local-motion field인 `vidstab_local_motion.trf`

좌표의 의미는 “현재 프레임을 이전 프레임에 맞추기 위해 적용하는 영상 평면 이동”이다. 이 값은 재촬영/재렌더에서 2D 배경 보정 또는 reference curve로만 사용해야 한다. 피사체 마스크 없이 측정했으므로 캐릭터·환경 애니메이션, 시차, 생성 프레임 변형이 카메라 운동과 섞여 있다. 물리 카메라 위치, focal length, roll, 3D 회전 또는 zoom으로 해석하면 안 된다. 이 번들에서는 rotation과 zoom 값을 `null`로 유지했다.

## 지원 레이어와 미지원 레이어

지원 및 실제 생성:

- 원본 추적 reference clip, 19개 추출 프레임, contact sheet
- 프레임별 색차/휘도차와 scene score
- 프레임별 whole-frame 2D apparent translation
- source probe, 분석 설정, raw ffmpeg/vidstab 측정, SHA-256 inventory

지원 불가이며 생성하지 않음:

- OpenPose/BODY_25: 모델과 runtime이 없어 `openpose_pose.mp4`와 `openpose_keypoints.json`을 만들지 않았다.
- Pose landmarks: pose-estimation 모델이 없어 landmarks와 high-contrast pose 영상을 만들지 않았다.
- Depth: MiDaS/ZoeDepth/DPT 계열 모델이 없어 `depth.mp4`와 `ai_depth.mp4`를 만들지 않았다.
- Normals: 유효한 depth/geometry가 없어 만들지 않았다.
- Subject mask: segmentation/pose mask 모델이 없어 만들지 않았다.

`unsupported_layers.json`이 이 구분과 생성하지 않은 예상 파일을 기계 판독 가능하게 기록한다. 가짜 keypoint, depth, normals, subject mask는 없다.

## 번들 구성

- `reference.mp4`: 실제 원본의 stream-copy 참조 클립
- `frames/frame_001.jpg` … `frame_019.jpg`: 초당 1프레임 추출본
- `contact_sheet.jpg`: 5×4 참조 시트
- `source_probe.json`: ffprobe 원본 스트림/컨테이너 정보
- `analysis_settings.json`: 명령, 필터, 임계값, 해상도, solver 범위
- `scene_measurements.json`: 456프레임 scene/frame-difference 측정 JSON
- `camera_motion.json`: 456프레임 2D apparent-motion JSON
- `frame_metrics.ffmetadata`, `scene_cuts.ffmetadata`: 원시 FFmpeg metadata
- `vidstab_local_motion.trf`: 원시 vidstab local-motion field
- `unsupported_layers.json`: 미지원 레이어 선언
- `bundle_manifest.json`: source SHA-256, 분석 범위, 레이어 상태, 29개 산출물 inventory와 산출물별 SHA-256
- `checksums.sha256`: 원본, manifest를 포함한 번들 파일의 독립 SHA-256 목록

## 재현 및 검증

분석에는 FFmpeg/ffprobe 7.1.1을 사용했다. 주요 명령과 설정은 `analysis_settings.json`에 기록했다. 무결성 검증은 번들 디렉터리에서 `shasum -a 256 -c checksums.sha256`로 수행할 수 있다. checksums 첫 항목의 상대 경로는 번들 위치에서 프로젝트 원본 영상을 직접 가리킨다.
