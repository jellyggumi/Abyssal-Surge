# 그림자 군주 씨네마틱 v100 라운드업 (워크스페이스)

## 목표
- 씬 0~7 통합 컷을 승인본(`v100`)으로 패키징하고, 루트/워크스페이스 동시 반영을 검증한다.

## 산출물
- `assets/video/scene_00_to_07_cinematic_v100.mp4`
- `assets/video/scene_00_to_07_concat_v100.txt`

## 확인 항목
- 루트/워크스페이스 파일 해시 동일
- FFprobe duration 동일
- manifest 항목 등록 및 파일 존재 검증

## 증적
- `scene_00_to_07_cinematic_v100.mp4` SHA-256: `e501572949ce0dadca47b950e25a25f09d71419520ac0ef30a4b7e2d5419c8fb`
- `scene_00_to_07_cinematic_v100.mp4` duration: `189.000000s`
- `scene_00_to_07_concat_v100.txt` SHA-256: `54cab417ba00c29f16d5eb4addf880a4c6498b573777935c0f933d91354f8ed0`
- concat manifest 라인 수: `8`

## 상태
- 라운드업: `DONE`
- 다음 라운드 제안: `v101`(브랜딩/오디오 정밀 튜닝)