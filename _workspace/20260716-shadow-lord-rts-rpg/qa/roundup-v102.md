# 그림자 군주 씨네마틱 v102 라운드업 (워크스페이스)

## 목표

- 씬 0~7 통합 컷의 v102 판을 `자막 하드코딩 + 상태 로그 + UI 메타 라벨` 반영본으로 확정하고,
  루트/워크스페이스 패키지 정합성을 최종 검증한다.
- `ROUNDUP_DONE_V102` 상태 반영을 기반으로 내부 시연 잠금 버전으로 승인 전 단계에 진입한다.

## 산출물

- `assets/video/scene_00_to_07_concat_v102.txt`
- `assets/video/scene_00_to_07_shot_subtitles_v102.srt`
- `assets/video/scene_00_to_07_state_log_v102.jsonl`
- `assets/video/scene_00_to_07_ui_labels_v102.csv`
- `assets/video/scene_00_to_07_cinematic_v102.mp4`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_concat_v102.txt`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_shot_subtitles_v102.srt`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_state_log_v102.jsonl`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_ui_labels_v102.csv`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_cinematic_v102.mp4`

## 확인 항목

- v102 해시/크기 동기화(5종)
- 루트/워크스페이스 concat manifest 및 패키지 동기화
- 루트/워크스페이스 매니페스트 항목 등록 여부
- 오디오/길이 정합성
- 라운드업 로그 기록

## 증적

- `scene_00_to_07_concat_v102.txt` SHA-256: `54cab417ba00c29f16d5eb4addf880a4c6498b573777935c0f933d91354f8ed0`
- `scene_00_to_07_concat_v102.txt` Bytes: `366`
- `scene_00_to_07_shot_subtitles_v102.srt` SHA-256: `8a7fc35f36b71d5fd1f1c55897e30e4cf7612ea4c6213732288b517e809b9106`
- `scene_00_to_07_shot_subtitles_v102.srt` Bytes: `2540`
- `scene_00_to_07_state_log_v102.jsonl` SHA-256: `03826abbf16bea7ed8110e84fee42844a62f13a2a32bf60e1ef99fa050abf4f8`
- `scene_00_to_07_state_log_v102.jsonl` Bytes: `1594`
- `scene_00_to_07_ui_labels_v102.csv` SHA-256: `d2bfb0a17e36c952f232711ca4f2f3ec6f1a3e0e7577201a2486f9da2e1cae02`
- `scene_00_to_07_ui_labels_v102.csv` Bytes: `573`
- `scene_00_to_07_cinematic_v102.mp4` SHA-256: `1b94c6f70a7816206fdae69b9ab853cd7f7a61922961f59c22da2a18cd6d8c30`
- `scene_00_to_07_cinematic_v102.mp4` Duration: `189.000000s`
- `scene_00_to_07_cinematic_v102.mp4` Bytes: `15917147`
- Root `updated_at`: `2026-07-16T15:55:03Z`
- Workspace `updated_at`: `2026-07-16T15:55:03Z`

## 정합성 결과

- 루트/워크스페이스 `v102` SHA-256 일치
- 루트/워크스페이스 `concat` SHA-256 일치
- 루트/워크스페이스 길이 일치 (`189.000000s`)
- Audio: `none` (무음 테스트 버전)
- `media-manifest.json` 둘 다 v102 영상/메타 자막/로그/라벨 항목 반영 완료
- `ROUNDUP_DONE_V102` 상태 반영 대상

## 상태

- 라운드업: `DONE`
- 다음 라운드: `v103`(실패 루프 튜닝 및 시나리오 F~H 보정 반영)