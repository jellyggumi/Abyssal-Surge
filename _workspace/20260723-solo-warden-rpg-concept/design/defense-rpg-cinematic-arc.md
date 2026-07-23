# 디펜스 RPG 연출 아크 (10스테이지, 인터렉티브 컷씬 패키지)

작성 기준: `defense-catalog.js`의 스테이지 1~10 구조를 유지하면서, Worldview 확장(`worldview.md`)·시각 콘셉트(`presentation-spec.md`)·모션 파이프라인(`production/motion-previs-and-blender-execution-plan.md`)과 정합.

목표:
- 스테이지 1~10을 단일 성찰 아크로 묶어 게임-연출-오디오가 동기화되도록 함
- 컷씬(웹툰식 정지컷) + 인터렉티브 분기 교차로 사용 몰입도 극대화
- `/skill:god-tibo-imagen`용 컷 프롬프트 키 제공
- `/skill:motion-previs-studio` 액션셋( idle/move/run/hit/bighit/attack/critical/avoid/defence/die/show )과 1:1 또는 다대일 매핑 가능
- `/skill:vox-director`로 분할 출력 후 병합 가능한 파일 스펙 기반 산출

---

## 0) 글로벌 장면 규칙

- 기본 영상 화법: **3.5D 버즈아이(고정 카메라, 라이트 패닝)**,
  세밀 컷에서는 카메라 오버클로즈인(2D 합성 판독성 향상).
- 컷 길이 권장: 6~12초(보스 컷: 10~16초).
- 컷톤: `warm-automata / ember-noir` 기본 + 스테이지 고유 변형.
- 전환: `dip-to-black(0.3s) + 오디오 스윗치 포인트(0.5s)`.
- NPC 대화는 **항상 2문장 내외**로, 첫 문장은 상태 브리핑, 둘째 문장은 플레이어 선택 유도.
- 플레이어가 직접 조작하는 핵심은 전투가 아니라 **분기 선택(포메이션/출정태도/스킬 사용 타이밍 우선순위)**으로 표현.

---

## 1) 최소 8컷 구성을 넘는 14컷 구성안 (Stage 1~10 반영)

표의 `motionTrigger`는 `/production/boss-motion-previs-action-matrix.json`로 이어지는 키
(`previsMotionTag`)를 사용한다.

| 컷ID | 단계 | 장면/컷 목적 | god-tibo 이미지 프롬프트 핵심 | Motion Trigger | 오디오 키 (보컬/FX) | 인터렉티브 연결 |
|---|---|---|---|---|---|---|
| C01 | Prologue | 절단 직후 재난의 전조. `Na-Honjam` 직전 장면 + 재료면역 파동. | `ember ruins, broken ether gate, lone dusk-warden silhouette, distant command lines collapsing, 1024x576` | `player:show`, `environment:idle` | `narr_intro_01`, `sfx:gate_rip_01`, `bgm:prologue_low` | 튜토리얼 시작 버튼 전 1회 선택: `호흡 모드` vs `엄호 모드` (연출 텍스트만 변경) |
| C02 | Lobby | Farwatch Hold 로비. 동료 교체/스테이지 브리핑 UI. | `war-hold command room, dusk light, strategic table with 10 red pins, calm but tense atmosphere` | `player:idle`, `npc:show` | `narr_lobby_intro`, `sfx:ambient_forge`, `bgm:lobby_day` | NPC 대화가 첫 선택지를 열고, 선택에 따라 오프닝 컷에서 NPC 코멘트 분기 |
| C03 | Stage 1 전환 | Cinder Span 접근로. 저지선 지표 불안정 표시. | `narrow canyon, ember ash bridge, red warning sigils, player enters through smoke` | `player:move`, `player:attack`(연출용) | `narr_stage01_entry`, `sfx:ward_level_warning`, `bgm:stage01_entry` | `runMode` 분기(안정 수색/선제 공격)로 컷 내 BGM 레이어 가중치 변동 |
| C04 | Stage 1 보스 쇼케이스 | 인간형 지휘관군 최초 출현, `sung-hum` 감지. | `human-commander, tactical mask, ember crown, cinematic pose, dramatic sidelight` | `boss:human-command:show`, `player:idle`, `boss:human-command:attack` | `narr_boss01_show`, `sfx:boss_enter_chime`, `bgm:stage01_boss` | 컷 종료 선택(공격 우세/회피 우선)이 첫 보정 슬롯 토큰 1개에 반영 |
| C05 | Stage 2 전환 | Veil Citadel. 정예 추출 실패 시 위험 수치 상승.| `fortress bridge under storm, two-way shadow flares, fog + red signal rods` | `player:run`, `boss:human-command:move` | `narr_stage02_entry`, `sfx:bridge_grind`, `bgm:stage02_entry` | 정예 우선 정리 여부 선택에 따라 다음 컷의 보상 오디오 레이스(성공/경고) 분기 |
| C06 | Stage 2 보스 쇼케이스 | 통제권 상실군의 두 번째 보스. | `veil tactician, dual-spear shadow soldier, cracked visor, layered armor, cinematic side reveal` | `boss:human-command:show`, `player:defence`, `boss:human-command:attack` | `narr_boss02_show`, `sfx:tactical_ping`, `bgm:stage02_boss` | 보스 `show` 후 `boss:attack` 시작 전 회피 창이 0.8초로 축소됨(회피 탭 강조) |
| C07 | Stage 3-4 몽타주 | 연동 컷: gate throne + sunken bastion을 한 장면으로 압축(연속 전환) | `royal hall echo + drowned battlement, alternating palette shifts, low-angle cut` | `boss:shadow-commander:show`, `player:show`, `player:run` | `narr_stage03_04_bridge`, `sfx:echo_drone`, `bgm:mid_gate_drive` | NPC 브리핑 한 줄: “저지선 임계값이 다음 두 스테이지에 걸쳐 유지된다.”
| C08 | Stage 3 보스 쇼케이스 | Gate Sovereign/저항형 그림자군 지휘. | `void knight from abyssal gate, cloak-like shadow fragments, crimson-thorn staff` | `boss:shadow-commander:show`, `player:attack`, `boss:shadow-commander:critical` | `narr_boss03_show`, `sfx:staff_windup`, `bgm:stage03_boss` | 보스 crit 경보가 오면 플레이어 상태창에 `defence` 보정 팝업 |
| C09 | Stage 5 쇼케이스 | howling-sprawl 직전, 포위감 상승. | `howling pack herald, torn signal tower, wind circles around enemy line` | `player:move`, `boss:human-command:show`, `boss:human-command:attack`, `boss:human-command:bighit` | `narr_stage05`, `sfx:howl_loop`, `bgm:stage05` | NPC “우측 측면 경로를 비워라” 대사로 `Split` 포메이션 유도 |
| C10 | Stage 6 쇼케이스 | glass-necropolis에서 저지선 영구면역 문장. `wardLevel` 강화 텍스트 등장. | `glass cathedral ruins, ward sigils rising, emperor-like commander silhouette` | `boss:broken-court-monarch:show`, `player:defence`, `boss:broken-court-monarch:attack`, `boss:broken-court-monarch:bighit` | `narr_stage06`, `sfx:ward_lock`, `bgm:stage06_peak` | 첫 `wardLevel` 상승 연출시 인터렉티브 브리핑: `방어를 강화` / `공격 템포 유지` |
| C11 | Stage 7-8 몽타주 | starless-canal + shattered-causeway 전개를 압축. | `dark canal, broken bridge, mirrored shadows, two-lane pursuit` | `player:move`, `boss:shadow-commander:move`, `player:show`, `boss:shadow-commander:attack` | `narr_stage07_08`, `sfx:bridge_break`, `bgm:bridge_cascade` | 장면 내 NPC 대화가 1회만 등장하고, 응답에 따라 보스 체력바 UI 애니메이션 형태 분기 |
| C12 | Stage 8 보스 쇼케이스 | Bridge Colossus 전투 직전의 압축. | `colossus frame from gate ruins, colossal shadow banners, metallic ash storms` | `boss:broken-court-monarch:show`, `boss:broken-court-monarch:critical`, `player:critical` | `narr_boss08_show`, `sfx:colossus_step`, `bgm:stage08_colossus` | `critical` 타이밍에서 플레이어가 `Avoid` 반응 성공 시 3초 무피격 버프 |
| C13 | Stage 9 보스 쇼케이스 | Veiled Concordat, 배신/동맹 전환의 긴장. | `diplomatic courtroom in abyss, veiled pact, split-light duel` | `boss:human-command:show`, `boss:human-command:hit`, `player:defence`, `boss:human-command:attack` | `narr_stage09`, `sfx:vow_break`, `bgm:stage09_dissonant` | 플레이어 대사 선택지: “추적을 멈춘다”/“계속 추적한다”가 컷엔드 이후 `intro of ending` 톤 분기 |
| C14 | Stage 10 보스 쇼케이스 | Gate Zenith 최종 전투 직전의 고조. | `abyss regent, crimson sigil throne, fractured moonless command` | `boss:broken-court-monarch:show`, `boss:broken-court-monarch:attack`, `boss:broken-court-monarch:critical`, `player:bighit` | `narr_boss10_show`, `sfx:final_gate_shatter`, `bgm:stage10_final` | 이 컷에서 1회 선택지: `공격형 연쇄` vs `방어형 생존` — 각자 엔딩 텍스트 다름 |
| C15 | 엔딩 공통 | Gate Zenith 파열, `Echo Deep` 잔존 암시. | `dawn over abyssal wall, deepmark rune in chest glow, companions waiting` | `player:show`, `npc:show`, `player:idle` | `narr_ending_common`, `sfx:resonance_bloom`, `bgm:ending_common` | 컷 후 플레이어 상태 스냅샷 + 다음 챕터 오픈 조건 제시 |
| C16 | 엔딩 브랜치 A | 생존형: 군주의 명령망을 봉쇄 후 재건을 선택. | `peaceful hold with rebuilding crews, warm campfire, quiet banners` | `player:move`, `player:idle`, `npc:show` | `narr_ending_a`, `bgm:ending_a`, `sfx:forge_soft` | 다음 시즌용 `회복 루트` 티저 안내 |
| C17 | 엔딩 브랜치 B | 반격형: 남은 명령망 결집 잔향 추적. | `storm-charged horizon, vow-marked map, pursuit silhouette` | `player:run`, `player:attack`, `npc:show` | `narr_ending_b`, `bgm:ending_b`, `sfx:pursuit_wind` | 다음 시즌 `재침투 루트` 티저 안내 |

---

## 2) 단계별 스테이지 내러티브 정합(요약)

- Stage 1 (Cinder Span): 기초 진입/저항 동요 구간. 보조 목표는 조우 탐지 루틴 학습.
- Stage 2 (Veil Citadel): 적의 교전 타이밍이 늘어나며 첫 보조/스태그 보상.
- Stage 3 (Echo-Throne): 하위 커맨드군이 동조해오는 장면. 그림자 군단의 지휘형
  형태를 시각적으로 보여줌.
- Stage 4 (Sunken Bastion): 지형 밀집/경로 제약을 통해 회피-방어 리듬 연습.
- Stage 5 (Howling Sprawl): 대형 정예 조우로 `move/run/defence` 전환 훈련.
- Stage 6 (Glass Necropolis): 저지선 영구면역 임계치 도달을 스토리로 전환.
- Stage 7 (Starless Canal): 보급선 단절 구간, 후열 분산과 타이밍 압박.
- Stage 8 (Shattered Causeway): 중간 보스급 압박의 대형 실루엣 연출.
- Stage 9 (Abyss Chancel): 동맹/배신 분기, 협상/결단이 인터렉티브 선택으로 연결.
- Stage 10 (Gate Zenith): 최종 결속/최종 전술 분기. 엔딩 브랜치 분기 노출.

---

## 3) 로비 화면 시나리오 (반복 사용 템플릿)

### 3-1. 공통 로비 레이아웃
- 좌측 상단: 오늘의 저지선 지수, 다음 스테이지 추천 포지션.
- 중앙: 작전 브리핑 화면(선택형 텍스트 2개).
- 하단: 동료/장비/성장 상태.

### 3-2. NPC 대화 샘플 (실행할 수 있는 문자열)

1. **하람(행정관)**
- 브리핑: "오늘도 살아서 돌아왔다는 증거가 1개 남았어. 대신 저지선은 2배로 짓누르고 있다."
- 플레이어 상태 질문: "선두를 바꾸든 뒤를 지키든, 첫 12초는 네가 정하는 템포야."

2. **메리(정비관)**
- 브리핑: "그림자군사 리본은 맞을 듯 안 맞는다면 더 빠르게 커진다. 시야보다 타이밍이 중요해."
- 피드백: "네 컷은 잘 나왔어. 다음은 분산을 먼저 보여주고 결집은 마지막에 쓰도록."

3. **라엘(포로 교신자, Stage 9에서만 등장)**
- 브리핑: "우린 저들의 약속을 들어도 기록만 남았지, 대가는 남겨둔 사람의 의지야."
- 선택 유도: "지금 멈추면 생존이 늘고, 계속 가면 증거가 열린다."

---

## 4) 스테이지 전환 룰 (컷씬-게임 동기 부여)

| 전환 규칙 | 연출 처리 | 게임 처리 |
|---|---|---|
| 다음 스테이지 진입 | 전 스테이지 종료 컷에서 1컷 페이드아웃 후 로비로 복귀 |
| 실패/되돌이 없음 | 컷에서 죽음/부상 연출 시 `die` 음성·SFX 트리거 |
| 중요 보상 획득 | NPC 짧은 브리핑 컷 + 1줄 스테이터스 텍스트 |
| 스킬 사용시 내레이션 | 액션 트리거에 맞춘 `skillActivation` 음성 키를 즉시 재생 |
| 스테이지 하이라이트 | 보스 `show` 직전 0.5초 오디오 스윕 + HUD 글리치(저지선 임계치 표시) |

---

## 5) 컷별 모션/보스 프리비즈 라벨 바인딩 키

- `human-command` 보스: `boss:human-command:{action}`
- `shadow-commander` 보스: `boss:shadow-commander:{action}`
- `broken-court-monarch` 보스: `boss:broken-court-monarch:{action}`
- `player`(성진우): `player:{action}`

권장 우선순위:
1. `show`로 식별성 확보
2. `attack`/`critical`/`bighit`로 공격적 정점 전달
3. `avoid`/`defence`로 회피-방어의 긴장 상승
4. `die`는 클리어 여부와 무관하게 짧게 사용(페이드)
5. 컷 전환 시 `idle`로 정합 후 다음 액션 진입

---

## 6) /skill:vox-director 분리 출력 가이드 (요약)

- 출력 파트 권장:
  - `part_intro.mp4`
  - `part_lobby.mp4`
  - `part_stage01~stage10.mp4` (10개)
  - `part_ending_common.mp4`
  - `part_ending_branchA/B.mp4`
- 합본: `defense_stage1to10_story_01.mp4` + `defense_stage1to10_story_alt.mp4`
- 대체 스타일:
  - `anime-soft`: 채도 8~12%, grain 적게, 음성 리버브 증가
  - `noir-cut`: 채도 강하, 선명한 실루엣, 대비 상승
  - `webtoon-static`: 0.25x 모션 감소 + 컷 넘김 강화

---

## 7) 웹툰 관점의 보완

- 컷 수는 17개(C01~C17)로 구성되며, 컷의 길이는 **장면당 1개 이상의 선택지**를 보장.
- 각 컷은 최소 1개의 음향 키(나레이션/효과음 중복 가능) + 1개 모션키를 가져야 함.
- 배경 스크롤은 스태틱컷 기반이므로 모바일에서 텍스트 가독성 유지(최소 46px 기본 텍스트) 보장.

---

## 8) 다음 작업 연결 산출물

이 문서를 기준으로 바로 바인딩 가능한 하위 파일:
- `production/elevenlabs_sound_plan.json` (컷별 보컬/효과음)
- `production/storyboard-motion-sound-matrix.json` (컷-액션-오디오 매핑)
- `production/vox-director_manifest.json` (파트 분할+병합 소스)
- `production/vox-director_video_pipeline.md` (실행 지침)
