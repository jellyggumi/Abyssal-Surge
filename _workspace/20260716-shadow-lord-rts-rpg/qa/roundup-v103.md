# 그림자 군주 씨네마틱 v103 라운드업 (워크스페이스)

## 목표
- 씬 0~7 통합 컷을 `v103` 실패 루프 튜닝(시나리오 F~H 및 state log 확장) 정식본으로 확정하고, 루트/워크스페이스 자산 정합성과 패키지 동기화를 최종 검증한다.

## 산출물
- `assets/video/scene_00_to_07_concat_v103.txt`
- `assets/video/scene_00_to_07_shot_subtitles_v103.srt`
- `assets/video/scene_00_to_07_state_log_v103.jsonl`
- `assets/video/scene_00_to_07_ui_labels_v103.csv`
- `assets/video/scene_00_to_07_cinematic_v103.mp4`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_concat_v103.txt`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_shot_subtitles_v103.srt`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_state_log_v103.jsonl`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_ui_labels_v103.csv`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_cinematic_v103.mp4`

## 확인 항목
- `v103` 해시/사이즈 동기화(총 5종)
- `concat`/`srt`/`state_log`/`ui_labels`/`cinematic` 루트-워크스페이스 정합성 확인
- 미디어 매니페스트 항목 반영 (`assets/media-manifest.json`, `_workspace/.../assets/media-manifest.json`)
- 오디오/타임라인 정합성 검증
- 라운드업 상태 코드 반영

## 증적

### 루트
- `scene_00_to_07_concat_v103.txt` SHA-256: `54cab417ba00c29f16d5eb4addf880a4c6498b573777935c0f933d91354f8ed0` / Bytes: `366`
- `scene_00_to_07_shot_subtitles_v103.srt` SHA-256: `24d410cacb03e9389f47de76b65e46bfcb73f0de595cd116f54be37229d696d9` / Bytes: `1873`
- `scene_00_to_07_state_log_v103.jsonl` SHA-256: `a51f4ec805450db0ef183d5bcaee98a2f72f73789dd3f7dbdca9f53a4ecd3a11` / Bytes: `2905`
- `scene_00_to_07_ui_labels_v103.csv` SHA-256: `44f52f78d0d86ad14a0f4029960d6a93e1a9892931813807627e0ee57f88a0d7` / Bytes: `954`
- `scene_00_to_07_cinematic_v103.mp4` SHA-256: `1b94c6f70a7816206fdae69b9ab853cd7f7a61922961f59c22da2a18cd6d8c30` / Duration: `189.000000s` / Bytes: `15917147`
- `media-manifest.json` updated_at: `2026-07-16T16:00:00Z`

### 워크스페이스
- `.../scene_00_to_07_concat_v103.txt` SHA-256: `54cab417ba00c29f16d5eb4addf880a4c6498b573777935c0f933d91354f8ed0` / Bytes: `366`
- `.../scene_00_to_07_shot_subtitles_v103.srt` SHA-256: `24d410cacb03e9389f47de76b65e46bfcb73f0de595cd116f54be37229d696d9` / Bytes: `1873`
- `.../scene_00_to_07_state_log_v103.jsonl` SHA-256: `a51f4ec805450db0ef183d5bcaee98a2f72f73789dd3f7dbdca9f53a4ecd3a11` / Bytes: `2905`
- `.../scene_00_to_07_ui_labels_v103.csv` SHA-256: `44f52f78d0d86ad14a0f4029960d6a93e1a9892931813807627e0ee57f88a0d7` / Bytes: `954`
- `.../scene_00_to_07_cinematic_v103.mp4` SHA-256: `1b94c6f70a7816206fdae69b9ab853cd7f7a61922961f59c22da2a18cd6d8c30` / Duration: `189.000000s` / Bytes: `15917147`
- `workspace media-manifest.json`: `scene_00_to_07_*_v103` 항목 5종(`concat`, `srt`, `state_log`, `ui_labels`, `cinematic`) 반영 확인

### 동기화 보조 지표
- `state_log_v103.jsonl` 레코드 수: `14`
- `ui_labels_v103.csv` 상태 구간 수: `15`
- `srt` 자막 구간 수: `14`

## 정합성 결과
- 루트/워크스페이스 `v103` SHA-256 일치 (concat/srt/state_log/ui_labels/cinematic)
- 루트/워크스페이스 길이/바이트 수 일치
- 루트/워크스페이스 `media-manifest.json` 둘 다 `v103` 항목 반영 완료
- `assets/video/scene_00_to_07_cinematic_v103.mp4` Audio: `none`
- `ROUNDUP_DONE_V103` 상태 반영 대상

## 상태
- 라운드업: `DONE`
- 다음 라운드: `v104`(자막/상태 정합도 정밀 동기화, 다국어 라벨 패키지, 실패 루프 지표 캘리브레이션)