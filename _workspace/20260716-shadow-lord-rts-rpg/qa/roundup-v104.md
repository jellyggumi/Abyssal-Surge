# 그림자 군주 씨네마틱 v104 라운드업 (워크스페이스)

## 목표
- 씬 0~7 통합 컷 `v104` 패키지를 루트/워크스페이스에 정식 동기화하고
  실패 루프 타이밍(S5_DESPAIR/FAIL_PIVOT) 기준 자막/상태 로그/라벨 번역본의 정밀 일치도를 확정한다.
- 오디오(없음)·시간축 오차가 없는지 루프별로 검증 후 다음 라운드(v105)용 캠페인 보드 지표를 정리한다.

## 산출물
- `assets/video/scene_00_to_07_concat_v104.txt`
- `assets/video/scene_00_to_07_shot_subtitles_v104.srt`
- `assets/video/scene_00_to_07_shot_subtitles_v104_en.srt`
- `assets/video/scene_00_to_07_state_log_v104.jsonl`
- `assets/video/scene_00_to_07_ui_labels_v104.csv`
- `assets/video/scene_00_to_07_ui_labels_v104_en.csv`
- `assets/video/scene_00_to_07_cinematic_v104.mp4`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_concat_v104.txt`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_shot_subtitles_v104.srt`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_shot_subtitles_v104_en.srt`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_state_log_v104.jsonl`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_ui_labels_v104.csv`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_ui_labels_v104_en.csv`
- `_workspace/20260716-shadow-lord-rts-rpg/assets/video/scene_00_to_07_cinematic_v104.mp4`

## 확인 항목
- `v104` 해시/사이즈 정합성(총 7종 루트·워크스페이스 동시)
- 오디오 누락값(`none`) 및 `189.000000s` 고정 길이 검증
- 다국어 자막(`KR/EN`) 및 라벨(`KR/EN`) 타임코드 동기화 정합성
- 루트/워크스페이스 매니페스트 항목(`_v104`) 동기화

## 증적

### 루트
- `scene_00_to_07_concat_v104.txt` SHA-256: `54cab417ba00c29f16d5eb4addf880a4c6498b573777935c0f933d91354f8ed0` / Bytes: `366`
- `scene_00_to_07_shot_subtitles_v104.srt` SHA-256: `f07662ae1110e8f160a4fc4659300d386a2707304209877baa71d7773f4a7c24` / Bytes: `1873`
- `scene_00_to_07_shot_subtitles_v104_en.srt` SHA-256: `8ce46c0c95844e4ca8f1ad1389e447d7de8dae96579d02550ef24cdf5913bad6` / Bytes: `1658`
- `scene_00_to_07_state_log_v104.jsonl` SHA-256: `ad26603c66a7c2be492d057b6aab3172a5329685f8e2baafce577ccabb3412d2` / Bytes: `2884`
- `scene_00_to_07_ui_labels_v104.csv` SHA-256: `a88b2bbaf018232c72fe477fd4797e0d591c3e05acee4bece52fc699cda24bb6` / Bytes: `1015`
- `scene_00_to_07_ui_labels_v104_en.csv` SHA-256: `208b85ed11329f392bc8d3240d3fbbd6a972a1d623fe871d5c527de2ac8d5ff9` / Bytes: `1013`
- `scene_00_to_07_cinematic_v104.mp4` SHA-256: `1b94c6f70a7816206fdae69b9ab853cd7f7a61922961f59c22da2a18cd6d8c30` / Duration: `189.000000s` / Bytes: `15917147`
- `ROUNDUP_DONE_V104` 기록 및 `assets/media-manifest.json` `updated_at`: `2026-07-16T16:26:18Z`

### 워크스페이스
- `.../scene_00_to_07_concat_v104.txt` SHA-256: `54cab417ba00c29f16d5eb4addf880a4c6498b573777935c0f933d91354f8ed0` / Bytes: `366`
- `.../scene_00_to_07_shot_subtitles_v104.srt` SHA-256: `f07662ae1110e8f160a4fc4659300d386a2707304209877baa71d7773f4a7c24` / Bytes: `1873`
- `.../scene_00_to_07_shot_subtitles_v104_en.srt` SHA-256: `8ce46c0c95844e4ca8f1ad1389e447d7de8dae96579d02550ef24cdf5913bad6` / Bytes: `1658`
- `.../scene_00_to_07_state_log_v104.jsonl` SHA-256: `ad26603c66a7c2be492d057b6aab3172a5329685f8e2baafce577ccabb3412d2` / Bytes: `2884`
- `.../scene_00_to_07_ui_labels_v104.csv` SHA-256: `a88b2bbaf018232c72fe477fd4797e0d591c3e05acee4bece52fc699cda24bb6` / Bytes: `1015`
- `.../scene_00_to_07_ui_labels_v104_en.csv` SHA-256: `208b85ed11329f392bc8d3240d3fbbd6a972a1d623fe871d5c527de2ac8d5ff9` / Bytes: `1013`
- `.../scene_00_to_07_cinematic_v104.mp4` SHA-256: `1b94c6f70a7816206fdae69b9ab853cd7f7a61922961f59c22da2a18cd6d8c30` / Duration: `189.000000s` / Bytes: `15917147`
- `workspace media-manifest.json` `updated_at`: `2026-07-16T16:26:18Z`

### 동기화 보조 지표
- `state_log_v104.jsonl` 레코드 수: `14`
- `ui_labels_v104.csv` 행 수: `16`
- `ui_labels_v104_en.csv` 행 수: `15`
- `srt_v104.kr` 블록 수: `56`
- `srt_v104.en` 블록 수: `56`
- 상태 구간: `S5_DESPAIR`(`108~122`), `S6_APEX`(`122~151`), `FAIL_PIVOT`(`151~167`), `S7_RETURN`(`167~189`)

## 정합성 결과
- 루트/워크스페이스 `v104` SHA-256 `7종` 동일
- 루트/워크스페이스 길이/바이트 수 일치
- 루트/워크스페이스 `assets/media-manifest.json`의 `v104` 항목(7종) 반영 완료
- `assets/video/scene_00_to_07_cinematic_v104.mp4` Audio: `none`

## 상태
- 라운드업: `DONE`
- 다음 라운드: `v105`(실패 루프 데이터 캘리브레이션 결과를 반영한 2차 미세 튜닝)