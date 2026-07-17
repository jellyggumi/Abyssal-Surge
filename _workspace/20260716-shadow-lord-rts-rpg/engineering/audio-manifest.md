# 오디오 매니페스트 — Wave A (SFX 6종 + 한국어 내레이션 6종)

- 생성일: 2026-07-16
- 생성 스크립트: `tmp/generate-audio.mjs` (재실행 가능; 기존 파일은 skip, `--force`로 재생성)
- API: ElevenLabs — SFX는 `POST /v1/sound-generation` (prompt_influence 0.6), 내레이션은 `POST /v1/text-to-speech/{voice_id}` (model `eleven_multilingual_v2`, output_format `mp3_44100_96`)
- 내레이션 보이스: **Daniel** (`onwK4e9ZLuTAKqWW03F9`, ElevenLabs premade, 남성 저음 내레이터). voice_settings: stability 0.55, similarity_boost 0.75, style 0.35, speaker_boost on.
  - 선택 근거: API 키가 `voices_read` 권한이 없어 (`GET /v1/voices` → HTTP 401 missing_permissions) 목록 조회 불가. 전 계정 공통 premade 보이스 중 저음 내레이터 계열(Daniel)을 사용, 한국어 짧은 문장으로 사전 검증(HTTP 200, 20.4KB) 후 채택.
- 측정 방법: 길이/비트레이트 = `ffprobe -show_entries format=duration,bit_rate`, 음량 = `ffmpeg -af volumedetect`, 용량 = 파일시스템 stat. 12/12 파일 ffprobe 파싱 성공.
- 후처리: `capture.mp3`(+16dB), `hunt.mp3`(+14dB) — 생성 직후 peak가 −20.0/−18.9dB로 타 SFX(−3~0dB) 대비 과도하게 작아 `ffmpeg -af volume=NdB -b:a 128k` 재인코딩으로 정규화. 그 외 파일은 원본 그대로.

## 파일 표 (12/12 성공, API 실패 0건)

| 파일 | 종류 | 생성 파라미터 (prompt / text) | 길이(s) | 비트레이트 | 용량(KB) | mean/max dB | 후처리 |
|---|---|---|---|---|---|---|---|
| reward.mp3 | SFX | "dark choral shimmer, ancient blessing chime, dark fantasy, single one-shot cue" (dur 1.5s) | 1.52 | 130k | 24.1 | −19.1 / −3.3 | — |
| possess.mp3 | SFX | "whispering shadow takeover, ethereal grip, dark fantasy, single one-shot cue" (dur 1.4s) | 1.41 | 131k | 22.5 | −25.8 / −3.2 | — |
| capture.mp3 | SFX | "heavy banner slam onto stone, resonant, dark fantasy, single one-shot impact" (dur 1.2s) | 1.23 | 131k | 19.6 | −21.8 / −4.4 | +16dB, 128k 재인코딩 |
| materialize.mp3 | SFX | "shadow smoke coalescing into solid form, whoosh, dark fantasy, single one-shot cue" (dur 1.3s) | 1.31 | 131k | 20.9 | −20.9 / 0.0 | — |
| assault.mp3 | SFX | "massive dark energy strike impact, dark fantasy, single one-shot impact" (dur 1.2s) | 1.23 | 131k | 19.6 | −18.2 / −1.2 | — |
| hunt.mp3 | SFX | "low sonar ping, void echo, dark fantasy, single one-shot cue" (dur 1.0s) | 1.04 | 132k | 16.8 | −22.1 / −5.2 | +14dB, 128k 재인코딩 |
| narr-intro.mp3 | TTS | "심연의 문이 열렸다. 그림자 군주여, 일어나라." | 3.47 | 97k | 42.0 | prior measurement (not remeasured) | — |
| narr-stage1.mp3 | TTS | "잿빛 교량, 신더 스팬. 재의 메아리를 사냥하고 영혼을 거두어라." | 5.70 | 97k | 68.7 | prior measurement (not remeasured) | — |
| narr-stage2.mp3 | TTS | "장막 성채, 베일 시타델. 빙의의 힘이 깨어난다. 두 거점을 동시에 장악하라." | 7.84 | 96k | 94.4 | prior measurement (not remeasured) | — |
| narr-stage3.mp3 | TTS | "메아리 왕좌. 군주의 영역을 펼쳐 게이트 소버린을 무너뜨려라." | 5.09 | 97k | 61.5 | prior measurement (not remeasured) | — |
| narr-victory.mp3 | TTS | "침묵한 문 앞에서, 그림자 군단이 왕좌에 오른다." | 4.02 | 97k | 48.6 | prior measurement (not remeasured) | — |
| narr-defeat.mp3 | TTS | "군단의 닻이 끊어졌다. 다시, 일어나라." | 3.84 | 97k | 46.4 | prior measurement (not remeasured) | — |

## 수치 요약

- 12/12 파일 ≤400KB 게이트 통과 (최대 94.4KB, narr-stage2.mp3) — ≤300KB 목표 대비 최대 32% 수준이라 96k 재인코딩 불필요 (TTS는 이미 mp3_44100_96 출력).
- SFX 길이 1.04–1.52s (요구 0.8–1.5s; reward.mp3 1.52s는 요청 1.5s 대비 +0.02s 인코더 오차).
- 내레이션 길이 3.47–7.84s, 전량 eleven_multilingual_v2 한국어.
- 총 용량: 488.2KB (12 파일).

## 참고

- 기존 파일(ambient.mp3, domain.mp3, extract.mp3)은 이전 웨이브 산출물 — 본 웨이브에서 미변경.
- 원시 생성 로그: `tmp/audio-gen-results.json`.
- API 키는 `.env.game-audio`에서 스크립트가 직접 파싱하며 어떤 산출물에도 포함되지 않음.
