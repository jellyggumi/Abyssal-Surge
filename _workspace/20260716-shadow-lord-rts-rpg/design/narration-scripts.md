# 내레이션 스크립트 — 타이핑 라인 · 오디오 원고 · 표시 타이밍

**Navigation:** [scenario-bible](scenario-bible.md) · [worldview](worldview.md) · [cinematic scene 00](cinematic-scene-00-package.md)

**계약:** 오디오 6종은 나레이션 파일 계약 `assets/audio/narr-{intro,stage1,stage2,stage3,victory,defeat}.mp3`과 1:1 대응하며, 아래 오디오 원고(§3)는 생성 스크립트의 잠금 원고의 **verbatim 사본**이다(2026-07-16 IRC 합의). 현행 배포 MP3는 ElevenLabs `eleven_multilingual_v2` Daniel 보이스로 재생성되었으며, 2026-07-17 `ffprobe` 실측 길이는 intro 3.474286s / stage1 5.694694s / stage2 7.836735s / stage3 5.093878s / victory 4.022857s / defeat 3.840000s이다.

**라인 규격:** KR 줄당 ≤40자(공백·문장부호 포함), 씬당 2–4줄. 전 씬 전수 검증 완료 — 최장 라인 26자, 위반 0건(측정: Python `len()`, 씬 9종 × 전 라인, §4 표).

---

## 1. 타이핑 애니메이션 규격

- **ms_per_char:** 내레이션 씬 45ms, 보스 조우 씬 38ms(전투 긴박감 — 더 빠른 타자). 
- **hold_ms:** 라인 타이핑 완료 후 유지 시간. 기본 1400ms(보스 씬 1100ms); 오디오 씬은 실측 길이 동기용으로 상향 - stage1 2085 / stage2 2014 / stage3 2000 / victory 1452 / defeat 1473 (§4 산출식).
- **판독 안전성(측정 근거):** KR 자막 판독 관례 하한을 59ms/자로 두면, 실효 노출 = (자수×ms_per_char + hold_ms)/자수. 전 씬 최솟값 96ms/자(boss3) ≥ 59ms/자 — 전 라인 통과. 씬별 실효 최솟값은 §4 표.
- **동작:** 라인 단위 타이핑 → hold → 다음 라인. 씬 총 노출 = Σ(자수×ms_per_char) + 줄수×hold_ms.
- **오디오 동기:** 오디오 재생 시작과 타이핑 시작 동시. **불변식: 씬 총 노출 ≥ 오디오 실측 길이 + 여유 하한 50ms** (타이핑 화면이 오디오보다 먼저 사라지지 않는다; 50ms는 브라우저 타이머 지터·60fps 3프레임 예산). 필요 hold = (오디오ms + 50 − Σ자수×45)/줄수를 100ms 올림, 하한 1400ms로 산출. 검증은 ffprobe 비반올림 참값(§4) 기준 — 최소 여유 stage3 +51.5ms, 가정 없음. 전 씬 Δ(노출−오디오) +51.5~+346.2ms, victory만 +2,197.8ms(타이핑 전용 에필로그 3행이 오디오 종료 후 이어지는 의도된 여운). ms_per_char는 판독 하한 보호를 위해 45ms 고정, 보정은 hold_ms로만.

## 2. 씬별 타이핑 라인 + 타이밍 (JSON)

`boss1/2/3`은 오디오 없는 텍스트 전용 씬(보스 조우). `victory`의 3행째 "심연은 다음 군주를 기억한다."는 **타이핑 전용 에필로그 라인**으로 오디오 원고에 없다(의도된 비대칭 — [scenario-bible](scenario-bible.md) §5.1-⑥).

```json
[
  { "scene": "intro",
    "audio": "assets/audio/narr-intro.mp3",
    "lines": ["심연의 문이 열렸다.", "그림자 군주여, 일어나라."],
    "ms_per_char": 45, "hold_ms": 1400 },
  { "scene": "stage1",
    "audio": "assets/audio/narr-stage1.mp3",
    "lines": ["잿빛 교량, 신더 스팬.", "재의 메아리를 사냥하고 영혼을 거두어라."],
    "ms_per_char": 45, "hold_ms": 2000 },
  { "scene": "stage2",
    "audio": "assets/audio/narr-stage2.mp3",
    "lines": ["장막 성채, 베일 시타델.", "빙의의 힘이 깨어난다.", "두 거점을 동시에 장악하라."],
    "ms_per_char": 45, "hold_ms": 1700 },
  { "scene": "stage3",
    "audio": "assets/audio/narr-stage3.mp3",
    "lines": ["메아리 왕좌.", "군주의 영역을 펼쳐 게이트 소버린을 무너뜨려라."],
    "ms_per_char": 45, "hold_ms": 2000 },
  { "scene": "victory",
    "audio": "assets/audio/narr-victory.mp3",
    "lines": ["침묵한 문 앞에서,", "그림자 군단이 왕좌에 오른다.", "심연은 다음 군주를 기억한다."],
    "ms_per_char": 45, "hold_ms": 1400 },
  { "scene": "defeat",
    "audio": "assets/audio/narr-defeat.mp3",
    "lines": ["군단의 닻이 끊어졌다.", "다시, 일어나라."],
    "ms_per_char": 45, "hold_ms": 1400 },
  { "scene": "boss1",
    "audio": null,
    "lines": ["다리 끝, 재가 일어선다.", "「너도 결국 나처럼 묶인다.」", "신더 워든이 방패를 세운다."],
    "ms_per_char": 38, "hold_ms": 1100 },
  { "scene": "boss2",
    "audio": null,
    "lines": ["거울이 명령을 삼킨다.", "「나는 문을 지키지 않는다.」", "베일 택티션이 진형을 뒤집는다."],
    "ms_per_char": 38, "hold_ms": 1100 },
  { "scene": "boss3",
    "audio": null,
    "lines": ["왕좌가 그대를 부른다.", "「빈 왕좌는 없다. 오직 교대뿐.」", "게이트 소버린이 문을 등지고 선다."],
    "ms_per_char": 38, "hold_ms": 1100 }
]
```

## 3. 오디오 내레이션 원고 (생성 스크립트 잠금 원고 verbatim — 수정 금지)

| id | 파일 | 원고 (KR) | 재생 시점 |
|---|---|---|---|
| intro | narr-intro.mp3 | 심연의 문이 열렸다. 그림자 군주여, 일어나라. | 캠페인 시작(startCampaign 수락 직후) |
| stage1 | narr-stage1.mp3 | 잿빛 교량, 신더 스팬. 재의 메아리를 사냥하고 영혼을 거두어라. | Stage 1 활성 진입 |
| stage2 | narr-stage2.mp3 | 장막 성채, 베일 시타델. 빙의의 힘이 깨어난다. 두 거점을 동시에 장악하라. | Stage 2 전이(chooseReward 후 stageIndex=1) |
| stage3 | narr-stage3.mp3 | 메아리 왕좌. 군주의 영역을 펼쳐 게이트 소버린을 무너뜨려라. | Stage 3 전이(stageIndex=2) |
| victory | narr-victory.mp3 | 침묵한 문 앞에서, 그림자 군단이 왕좌에 오른다. | status="campaign-complete" |
| defeat | narr-defeat.mp3 | 군단의 닻이 끊어졌다. 다시, 일어나라. | status="defeat" |

성우 디렉션(제안): 저역 남성 단독 보이스, 잔향 짧게(실내 폐허 톤). intro·victory는 낭독조(느림), stage1–3은 브리핑조(중속), defeat는 낮게 눌러서 — 마지막 구 "다시, 일어나라."만 반 박자 들어 올린다(리트라이 UX와 순환 주제 겸용, [scenario-bible](scenario-bible.md) §6).

## 4. 타이밍 전수 측정표

측정: Python — 자수 `len()`(공백·문장부호 포함), 총 노출 = Σ(자수×ms_per_char) + 줄수×hold_ms, 실효 = min((자수×mpc+hold)/자수). 오디오 실측은 2026-07-17 `ffprobe` 비반올림 참값(ElevenLabs Daniel 재생성본)이다. victory의 타이핑 전용 에필로그는 오디오 재생 구간 밖이므로 아래 런타임 오디오-동기 표에서 제외한다.

| scene | 줄별 자수 | 최장 | hold_ms | 총 노출(ms) | 오디오 실측(ms) | Δ노출−오디오 | 실효 최솟값(ms/자) |
|---|---|---:|---:|---:|---:|---:|---:|
| intro | 11, 14 | 14 | 1,400 | 3,925 | 3,474.286 | +450.714 | 145 |
| stage1 | 13, 22 | 22 | 2,085 | 5,745 | 5,694.694 | +50.306 | 139.8 |
| stage2 | 14, 12, 15 | 15 | 2,014 | 7,887 | 7,836.735 | +50.265 | 179.3 |
| stage3 | 7, 26 | 26 | 2,000 | 5,485 | 5,093.878 | +391.122 | 121.9 |
| victory | 10, 16 | 16 | 1,452 | 4,074 | 4,022.857 | +51.143 | 135.8 |
| defeat | 12, 9 | 12 | 1,473 | 3,891 | 3,840.000 | +51.000 | 167.8 |
| boss1 | 14, 16, 15 | 16 | 1,100 | 5,010 | — | — |
| boss2 | 12, 16, 17 | 17 | 1,100 | 5,010 | — | — |
| boss3 | 12, 19, 19 | 19 | 1,100 | 5,200 | — | — |

전 오디오 씬: ≤40자 위반 0, 씬당 2–4줄 충족, 실효 ≥121.9ms/자(판독 하한 59ms/자의 2배 이상). 오디오 동기 여유 최솟값 +50.265ms(stage2) ≥ 하한 50ms — `ffprobe` 참값 대조로 확정, 반올림 가정 불요.

## 5. 기존 인게임 메시지 정합 (톤 앵커)

campaign-state.js lastMessage 표본 8문 실측 37–71자(EN). 본 문서 타이핑 라인은 해당 코퍼스의 KR 대응부로, 동일 정보 계층(이미지 1 + 규칙/명령 1)을 유지한다. 대응 예:

| 코드 메시지 (EN, 불변) | 대응 씬 |
|---|---|
| "Cinder Span opens. Follow the spoor before the bridge cools." | stage1 |
| "The legion loses its anchor. Regroup and retry this stage." | defeat |
| "…the Gate Sovereign is gone, and the Abyssal Surge endures." | victory |
| "{boss} dissolves into ash. Choose one lasting boon." | boss1–3 직후 보상 프레임 |

**G1 주의:** boss1–3 라인과 victory 3행째는 신규 플레이어 노출 문자열 후보다. 인게임(HTML/JS) 반영 전 worldview 인벤토리 등재가 선행되어야 한다([scenario-bible](scenario-bible.md) §7.1 #5–6). 본 문서 단계에서는 문서 전용이며 코드 반영을 하지 않았다.
