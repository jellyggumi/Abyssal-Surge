# Abyssal Command

[![Deploy to Pages](https://github.com/jellyggumi/Abyssal-Command/actions/workflows/static.yml/badge.svg)](https://github.com/jellyggumi/Abyssal-Command/actions/workflows/static.yml)
[![GitHub Pages](https://img.shields.io/github/deployments/jellyggumi/Abyssal-Command/github-pages?label=GitHub%20Pages)](https://jellyggumi.github.io/Abyssal-Command/)

**Abyssal Command**는 오리지널 세계관의 전투 중심 무자원 RTS-RPG 하이브리드 웹 캠페인입니다. 모든 진행은 브라우저 로컬에서 결정론적으로 계산되며, 온라인 서비스·멀티플레이·클라우드 동기화를 사용하지 않습니다.

**▶ 플레이:** https://jellyggumi.github.io/Abyssal-Command/ (모바일·데스크톱, PWA 오프라인 지원)

## 플레이 영상

[약 68초 게임플레이 영상 보기](docs/media/abyssal-surge-play.mp4)

영상은 10단계 캠페인의 브리핑, 실시간 전장, 명령 피드백, 상자 보상, 스킬 이펙트 흐름을 1280×720·30fps H.264로 편집한 저장소 내 미디어입니다.

## 게임 시스템

1. **무자원 전투 루프**
   - `Hunt → Extract → Materialize`로 적을 소울 풀과 군단으로 전환합니다. 경제는 군단 슬롯 상한과 거점 점령으로 제한됩니다.
   - `Capture`는 스테이지별 보스전에 필요한 거점을 확보합니다.
2. **동등한 터치·키보드 명령**
   - `Hunt`, `Extract`, `Materialize`, `Capture`, `Possess`, `Domain`, `Assault`는 같은 상태 전이를 호출합니다.
   - Possession은 Stage 2부터, Lord's Domain은 Stage 3에서 사용할 수 있습니다.
3. **결정론적 위험·보상**
   - 보스 반격, integrity, 군단 방패, 얇은 군단 페널티, Lord's Domain의 단일 사용 제한은 `campaign-state.js`의 고정 규칙입니다.
   - 스테이지를 완료하면 그 스테이지에서 제시된 보상 중 하나를 선택합니다. 선택 효과는 현재 캠페인에만 적용됩니다.
   - 각 웨이브는 결정론적 랜덤 상자 하나를 생성합니다. 다음 웨이브 전에 상자를 열어 공격·방어·가속·무적·회피·약화 아이템을 확보할 수 있습니다.
   - 스테이지의 마지막 웨이브를 돌파하면 보스전에 적용되는 필드 이벤트 효과가 한 번 발생합니다. 같은 세이브·행동 기록은 같은 상자와 이벤트를 재현합니다.
4. **로컬 세이브**
   - 같은 액션 시퀀스는 같은 결과를 냅니다. 저장 봉투는 이벤트 트레이스를 재생해 검증합니다.
   - IndexedDB를 우선 사용하며 localStorage 폴백과 JSON 내보내기/가져오기를 제공합니다.
5. **브라우저 프레젠테이션**
   - 스테이지 브리핑, 보스 패널, 선택형 보상, 내레이션, Canvas 전장, reduced-motion 대체 프레젠테이션을 제공합니다.

## 10단계 캠페인

| Stage | 무대 | 핵심 전술 | 보스 |
|---|---|---|---|
| 1 | **Cinder Span** | 추출·점령 기본 루프 | Cinder Warden (HP 8) |
| 2 | **Veil Citadel** | Possession과 두 거점 유지 | Veil Tactician (HP 10) |
| 3 | **Echo Throne** | 1회성 Lord's Domain 역전기 | Gate Sovereign (HP 17) |
| 4 | **Sunken Bastion** | 4웨이브 방파제 방어 | Tide Warden (HP 12) |
| 5 | **Howling Sprawl** | 무리 파수꾼 빙의 | Pack Herald (HP 14) |
| 6 | **Glass Necropolis** | 두 유리 단상 + 3HP 정예 | Requiem Choir (HP 16) |
| 7 | **Starless Canal** | Domain 재개방, 두 다리 차선 | Lantern Tyrant (HP 18) |
| 8 | **Shattered Causeway** | 끊어진 스팬 차선 통제 | Bridge Colossus (HP 20) |
| 9 | **Abyss Chancel** | 세 의식 단상 장악 | Veiled Concordat (HP 22) |
| 10 | **Gate Zenith** | 5웨이브 + 전 보온 총력전 | Abyss Regent (HP 26) |

스테이지 사이에는 엔트리 플로어(최소 내구도 4)가 적용되어 아슬아슬한 승리가 다음 스테이지의 재시도 러닝머신으로 이어지지 않습니다.

스테이지·보스·보상 이름과 설명은 `campaign-state.js`의 `STAGES[*].trace` 및 `CONTENT_TRACE`에 기록됩니다. 원본 콘텐츠·자산 매핑은 [worldview inventory](_workspace/20260716-shadow-lord-rts-rpg/design/worldview.md)와 [resource manifest](_workspace/20260716-shadow-lord-rts-rpg/engineering/resource-manifest.md)에 있습니다.

## 단일 페이지 전투 흐름

`시나리오 브리핑 → 보스 정보 → 전장 → 결과/보상 → 다음 시나리오`는 `#campaign-screen` 안에서 전환됩니다. 패배하면 같은 흐름에서 현재 Stage를 재시도할 수 있습니다. 렌더러가 초기화되지 않아도 정적 전술 브리핑과 명령 상태 전이는 계속 사용할 수 있습니다.

## 전장 리소스 파이프라인

- `RealtimeBattle`가 WebGL에서 전장 지형·보스 GLB를 직접 불러오는 기본 런타임입니다. 제작한 Blender GLB 리소스 15개와 스테이지별 자산 대응은 `assets/images/battle/glb/manifest.json`에 남습니다.
- Canvas 2D는 reduced-motion 환경 또는 WebGL/GLB 초기화 실패 시에만 쓰는 대체 렌더러입니다.
- 알려진 전투 액션은 GLB 런타임과 대체 Canvas 모두에서 소스에 연결된 아틀라스 애니메이션·시각 효과와 오디오 큐로 제시됩니다. 서비스 워커는 브리지 출력에 network-first 캐시를 적용해, 오프라인에서는 마지막으로 유효했던 매니페스트와 래스터 출력을 유지합니다.

### 2026-07-17 검증 증거

- `node --test tests/*.test.mjs`는 136/136 통과했습니다. 임베디드 텍스처 소스 GLB, 액션 클립, stage 4–10 선언 resource rows와 Canvas fallback 대응, core asset의 no-store 캐시, 렌더러 부재 시 명령 피드백, 내레이션 자막 여유 시간, 내레이션 아틀라스·런타임·CSS 계약을 검증합니다.
- `time node --test tests/playtest-browser-3stage.cjs`는 1/1 통과했습니다(294.2초). 390px 뷰포트의 10개 스테이지 선택기, Stage 1–3 전투·보상·저장 왕복, Stage 4 브리핑 전이를 검증합니다.
- Playwriter headless 세션으로 `http://127.0.0.1:4173/`을 확인했습니다. 새 캠페인 → Stage 1의 사냥·추출·실체화·점거 → scout/guard/reinforcement 웨이브 → Cinder Warden 처치 → 보상 선택 → Stage 2 브리핑 전이가 정상 동작했습니다. 390px에서는 10개 선택기의 `clientWidth`와 `scrollWidth`가 모두 374px이고 문서 폭은 390px입니다. 렌더 증거는 [Stage 1](_workspace/20260716-shadow-lord-rts-rpg/qa/stage1-narration-playtest-20260717.png)과 [모바일 선택기](_workspace/20260716-shadow-lord-rts-rpg/qa/mobile-stage-selector-playtest-20260717.png)에 보관합니다.
- 내레이션은 저역 남성 Daniel 보이스, 짧은 실내 폐허 잔향이라는 톤 계약을 유지합니다. 측정 길이와 자막 동기 계산은 [narration scripts](_workspace/20260716-shadow-lord-rts-rpg/design/narration-scripts.md)에 기록합니다.

### 2026-07-19 릴리스 노트 및 검증 증거

- **3D 가독성 패스:** `RealtimeBattle`의 지형 수직 스케일, 어두운 지형 재질 밝기, 유닛 emissive lift, tactical marker, DPR tier를 조정해 실루엣·접촉·전장 대비를 개선했습니다. Stage 4+ identity tint와 shared contact-shadow 수명 규칙도 같은 패스에서 고정했습니다. Stage 4–10 전용 GLB가 추가됐다고 주장하지 않으며, 선언된 stage resource와 Canvas fallback 대응만 검증 범위로 둡니다.
- **결정론 전투 카탈로그:** `combat-systems.js`의 깊은 불변 `ENEMY_PATTERNS`, `BOSS_PHASES`, `SUMMON_RECIPES`, `COMBAT_ALERT_CUES`가 적 패턴·보스 체력 경계·소환 진화·경보 큐를 같은 입력에 같은 결과로 해석합니다. 호출자 컨텍스트와 안정적인 동률 선택을 보존하고, `campaign-state.js`의 소환 진화·세이브 재생과 연결합니다.
- **명령 큐/렌더러 요청 계약:** WebGL·Canvas 포인터 콜백은 `{type:'command-request', action, requestId, source:'renderer-pointer', rendererMode, occurredAt}`로 정규화합니다. 앱은 active session과 현재 renderer에서 온 요청만 받아 `campaign-state`에 먼저 예약하고, 큐 헤드를 미리보기만 한 뒤 타이머에서 실행합니다. 실행 결과는 기존 `abyssal:command-resolved` 이벤트로 발행하며 `stopBattle`은 stale 예약 작업을 무효화합니다.
- **전장 공간 인터랙션:** 2D 전술 HUD의 현재 목표·전선 압박·선택 부대·웨이브 상태를 WebGL/Canvas 전장 위의 간결한 필드 스트립으로 결합했습니다. 포인터·키보드 명령은 기존 결정론 큐를 그대로 사용하며, WebGL 선택 링·포커스 링·경로 미리보기와 Canvas 선택 윤곽은 현재 스테이지 아군 팔레트를 공유합니다. 모바일 390×844에서는 336px 전술 스트립이 366px 전장 안에 유지되고 긴 상태는 말줄임 처리됩니다.
- `node --test tests/battle-field-command-overlay.test.mjs tests/battle-realtime-three.test.mjs tests/battle-visualizer.test.mjs`는 141/141 통과했습니다. 선택 링의 지속 가시성·reduced-motion 고정 표시·팔레트 동기화, 전술 HUD 상태 복제와 해제 수명주기, 카메라 전장 경계 clamp를 검증합니다. 별도의 Chromium 390×844 프로브에서 전술 스트립의 전장 내 포함과 말줄임을 확인했습니다. 게임 하네스의 정식 G4/G6 수치 게이트는 별도이며, 몰입도 점수·≤100ms 피드백 지연·프레임/입력/soak 측정이 아직 없어 `FIX`를 유지합니다.
- `node --test --test-name-pattern='(readability|boss phase|spawn alert|summon evolution|Stage 4\+)' tests/battle-realtime-three.test.mjs`는 6/6 통과했습니다. 지형·유닛 readability lift, Stage 4+ identity tint, 보스 phase cue, spawn alert, summon evolution effect를 확인합니다.
- `node --test tests/combat-systems.test.mjs tests/campaign-evolution.test.mjs`는 16/16 통과했습니다. 네 전투 카탈로그의 불변성·결정론 resolver와 소환 진화 비용·상한·세이브 재생을 확인합니다.
- `node --test tests/command-queue-realtime.test.mjs`는 7/7 통과했습니다. 렌더러 요청 정규화, 중복·stale 세션 차단, 큐 헤드 미리보기, 예약 우선 실행, 거부 시 cooldown 보존, `stopBattle` 무효화를 확인합니다.

### 2026-07-20 플레이어 중심 UI/UX 강화

- **행동 준비도(스태미나) 게이지:** 아군·타워의 공격 쿨다운을 `ObjectFeedbackLayer` HP 바로 아래 3px 보조 게이지로 노출합니다(`energy`/`maxEnergy`, 값 미제공 시 그리지 않음). 커맨더·보스·바리케이드처럼 쿨다운이 없는 오브젝트는 표시하지 않습니다. `battle-realtime-three.js`는 `ALLY_STRIKE_COOLDOWN`(0.55초), `TOWER_FIRE_COOLDOWN`(1.0초) 상수로 기존 매직 넘버를 대체하고 두 값을 `feedbackObjects()`에서 계산해 전달합니다.
- **데미지 팝업 크리티컬 등급:** `critThreshold`(기본 20) 이상인 비힐 교환은 `bold 16px`·굵은 외곽선·`!` 접미사로 강조하고, 일반 타격은 기존 `bold 12px` 그대로 유지합니다. 힐 수치는 크기 상승 없이 항상 안정적으로 표시됩니다.
- **이동 경로 흐름 애니메이션:** 아군 우클릭 이동 미리보기의 점선(`LineDashedMaterial`)에 `dashOffset`을 매 프레임 갱신해 목적지 방향으로 흐르는 인상을 주고, `reduced-motion`에서는 정지 상태를 유지합니다. 도착 지점 링 마커와 WebGL 선택 링은 기존 구현을 그대로 사용합니다(변경 없음, 이미 구현되어 있었음을 확인).
- `node --test tests/object-feedback-layer.test.mjs tests/battle-realtime-three.test.mjs`는 105/105 통과했습니다(신규 3건: 준비도 게이지 렌더링, 크리티컬 등급 폰트 분기, `feedbackObjects()`의 아군/타워 준비도 계산과 커맨더/보스/바리케이드 제외). `node --test tests/*.test.mjs` 전체 스위트는 452/452 통과했습니다.

### 2026-07-20 기믹 근접 게이팅 및 캔버스 직접 조작

- **행동 커맨드 근접 게이팅:** `getCommandReadiness()`가 실제 커맨더-앵커 거리를 측정하도록 WebGL·Canvas 렌더러 양쪽에 구현했습니다(`ACTION_INTERACTION_RADIUS = 3.0`, 포탈/추출기/거점/보스와 동일 좌표계 사용). 범위를 벗어나면 `reason: "out-of-range"`를 반환하고, `app.js`의 `evaluateQueuedCommandReadiness`는 이 사유만 750ms 타임아웃 우회 대상에서 제외해 실제로 근접해야만 실행되도록 했습니다. 첫 진입 시 1회 `tactical.rejection.outOfRange` 안내(한/영 `i18n.js` 추가)를 띄우고, 재진입 시 반복하지 않습니다.
- **캔버스 직접 조작(기믹 클릭) 버그 수정:** WebGL 렌더러에서 커맨드 노드 마커의 `userData.semantic`이 `null`로 남아있어 클릭해도 Capture가 발동하지 않던 문제를 고쳤습니다(`"capture"`로 고정). 포탈·추출기 마커는 `userData.semanticGroup`(`["materialize","domain"]`, `["hunt","extract"]`)을 추가로 얻어, `resolvePointerAction`이 현재 `getAvailableActions()`에서 허용된 후보로 동적 해석합니다 — 이전엔 추출기 클릭이 항상 Extract로만 고정되어 Hunt를 캔버스에서 직접 발동할 방법이 없었습니다. 호버 하이라이트(`updateMarkerPulses`)도 동일한 동적 해석을 사용합니다. Canvas 폴백 렌더러는 이미 `tacticalActionAt()`에서 동일 동작을 구현하고 있어 변경하지 않았습니다.
- `node --test tests/battle-realtime-three.test.mjs tests/battle-visualizer.test.mjs tests/command-queue-realtime.test.mjs`는 신규 5건(마커 시맨틱 태깅, `resolvePointerAction` 그룹 해석, WebGL/Canvas `getCommandReadiness` 거리 게이팅, out-of-range 대기열 타임아웃 면제)을 포함해 전부 통과했습니다. `node --test tests/*.test.mjs` 전체 스위트는 457/457 통과했습니다.

### 2026-07-20 보스 위협 자동공격 및 지상 텍스처 완성

- **보스 자동공격("boss-strike"):** 10개 스테이지 전부에 보스별 `bossPattern`(`type: melee|ranged|aoe`, `triggerRange`, `cooldownSeconds`, `damage`)을 선언했습니다. `campaign-state.js`의 `applyEncounterEvent`에 새 `"boss-strike"` 분기를 추가해, 플레이어의 `assault` 명령과 완전히 독립적으로 — 노출·점령·빙의 여부, 웨이브 유무(veil-citadel·echo-throne 포함)와 무관하게 — 커맨더가 사거리 안에 머무르면 보스가 자체 쿨다운으로 피해를 입힙니다. `combat-systems.js`에 `BOSS_ATTACK_PATTERNS` 카탈로그(멜리/원거리/광역 텔레그래프·아이콘 키)를 추가해 보스별 공격 타입을 데이터로 구분합니다.
- **위협 범위 가독성:** `battle-realtime-three.js`가 보스 주위에 `triggerRange` 크기의 반투명 danger ring을 배치하고, 쿨다운이 찰수록 밝아지도록 해 "곧 맞는다"를 텍스트가 아니라 바닥에서 읽을 수 있게 했습니다.
- **지상 PBR 텍스처 적용:** 이전 리소스 정제 사이클에서 생성만 되고 실제 씬에는 한 번도 적용되지 않았던 `void-obsidian` 알베도·노멀 맵을, 모든 스테이지의 모든 걸을 수 있는 배틀필드 데크 타일에 실제로 로드·적용했습니다(`presentation-spec.md`의 mass/role/energy 재질 언어를 따름). GLB 유닛·보스·지형은 이미 임베디드 텍스처를 갖고 있었고, 실제로 단색이었던 것은 손수 만든 데크 프리미티브뿐이었습니다.
- Pages 배포 allowlist(`.github/workflows/static.yml`)에 새 텍스처 2개(`void-obsidian-albedo.png`, `void-obsidian-normal.png`)를 추가했습니다.
- `node --test tests/boss-strike.test.mjs`는 신규 6건(스테이지별 패턴 데이터 검증, assault와의 독립성, 웨이브 없는 스테이지 지원, 보스 처치 후 거부, stageId 불일치 거부, aegis 우선 흡수)을 포함해 전부 통과했습니다. `node --test tests/*.test.mjs` 전체 스위트는 463/463 통과했습니다.

### 2026-07-20 무제한 사냥 상한 — 탈취·처치·지형변화 채집

- **Hunt/Extract는 이제 스테이지당 유한 자원입니다.** `STANDARD_PROGRESSION.maxExtractions`(14)로 상한을 두고, `campaign-state.js`의 `hunt` 분기가 새 사이클 시작 시(`hunted === 0`) 상한 도달 여부를 검사합니다. 상한값은 실측으로 도출했습니다: 빈 군단을 가득 채우는 데 최대 3사이클, 소환 레시피 하나를 신선한 스테이지에서 순수 사냥만으로 완전 진화(essenceCosts 합계 24 ÷ 사이클당 2 essence)하는 데 12사이클, 거기에 그 스테이지 자체 최소 경제 1사이클을 더한 값이 실측 상한선입니다 — `scripts/run-campaign-balance-sim.mjs` 퍼저(150,000회 연산)로 `findings: []`(발견된 익스플로잇 0건), `optimal`/`greedy-economy` 100% 승률, 결정론 이중 실행 일치까지 확인했습니다.
- **탈취·처치·지형변화가 채집 소스입니다.** `capture` 성공 시 사이클 1회 환급("영토 산출"), 웨이브 처치(`wave-cleared`) 시 1회 환급("처치 드랍"), 보스가 처음 노출되는 순간(`bossExposed` 전이) 추가로 1회 더 환급("지형변화 광맥")됩니다 — 무제한 반복 클릭이 아니라 실제 전투/점령 참여가 사냥 여지를 되돌려줍니다.
- 상한 도달 시 거부 메시지는 한/영 완전 로컬라이즈됩니다(`tactical.rejection.extractionsExhausted`, `i18n.js` + `app.js` 폴백 카탈로그 양쪽).
- `node --test tests/farming-cap.test.mjs`는 신규 4건(상한 도달 후 무변이 거부, capture 환급, wave-clear·boss-exposed 이중 환급, 스테이지별 리셋)을 포함해 전부 통과했습니다. `node --test tests/*.test.mjs` 전체 스위트는 467/467 통과했습니다.

### 2026-07-20 5분 스테이지·상자·스킬 밸런스

- **5분 전투 호흡:** 10개 스테이지의 최종 웨이브를 235–250초에 배치해 준비·웨이브·보스 결전을 약 5분 구간으로 묶었습니다. 자동 시뮬레이터의 관측 모델은 실제 벽시계 플레이타임을 대신하지 않으므로, 최종 웨이브 스케줄과 행동량을 별도 수치로 기록합니다.
- **상자와 이벤트:** 전체 39개 웨이브가 상자를 하나씩 생성하고, 보스가 노출되는 최종 웨이브에서만 스테이지당 필드 이벤트가 한 번 발생합니다. `ATTACK`, `DEFENSE`, `HASTE`, `INVINCIBLE`, `EVASION`, `DEBUFF` 여섯 효과는 10단계 경로에서 모두 도달 가능하며 저장·재생 시 결정론적으로 복원됩니다.
- **전략 압력:** Stage 1·2의 자동 내구도 회복을 제거하고 Echo Throne의 얇은 군단 반격을 강화했습니다. Lord's Domain과 상자 방어 효과를 계획적으로 사용해야 생존하며, 보상과 HASTE를 합친 명령 쿨다운 감소는 40%를 넘지 않습니다.
- **밸런스 결과:** `node scripts/run-campaign-balance-sim.mjs`에서 casual 200회 승률 50%, rusher 0%, optimal·greedy-economy 100%, comeback 기준 경로 0%를 기록했습니다. 12개 초기 보상 조합은 모두 완주했고 최고 효율/중앙 효율 비는 1.183×, 150,000회 퍼즈 연산은 발견 0건, 이중 실행은 동일했습니다.
- **10개 QA 시나리오:** `PS-001`–`PS-010`이 마우스/명령 근접성, 39개 상자와 10개 이벤트, 여섯 효과의 소비·우선순위, 중복 상자 차단, 저장 재생, 재시도 초기화를 검증합니다.

### 2026-07-21 Mesh Command Telemetry

- **텍스처·명령·충돌 경로:** WebGL 기본 경로는 작성된 GLB 임베디드 텍스처와 역할별 deck 재질을 유지합니다. 드래그 랠리와 전술 팝업 명령은 하나의 canonical movement/action 경로로 위임하며, 이동은 캐시된 정적 mesh 충돌 경계로 지형·장애물 통과를 거부합니다.
- **전장·배우 피드백:** 선택된 경로는 지형 위의 점선과 목적지 마커로 표시되고, 명령 가능한 배우에는 체력과 focus readiness 게이지가 표시됩니다. 적용된 WebGL Stage 1 캡처는 [mesh telemetry evidence](_workspace/20260721-mesh-command-telemetry/qa/evidence/20260721-mesh-telemetry/stage-1-webgl-textured.webp)에 보관합니다.
- **대상 검증:** 최적화 뒤 `node --test tests/battle-realtime-three.test.mjs tests/battle-visualizer.test.mjs tests/battle-field-command-overlay.test.mjs tests/object-feedback-layer.test.mjs`는 **214 tests passed, 0 failed**로 보고되었습니다. 이전 두 파일의 **176 tests pass** 결과는 역사적 기록으로 유지합니다. 로컬 1280×800 WebGL 증거 패킷은 빈 지형 이동 안내와 범위 밖 Hunt 예약 유지, 창 오류 없음을 기록합니다.
- **성능 상태:** 최적화 전 180개 연속 `requestAnimationFrame` 간격은 p50 16.7ms, p95 25.0ms, 최대 34.2ms(>20ms 27회, >33.4ms 3회)였습니다. Stage 1 재로딩 뒤 commander preview geometry 재사용과 frame-shot 배열 재사용을 적용한 warmed 180-frame 세 번의 측정은 각각 p50 9.0/8.7/8.4ms, p95 17.6/17.7/17.5ms, 최대 25.8/25.0/25.5ms, >20ms 7/9/8회, >33.4ms 0/0/0회였습니다. 개선됐지만 모든 p95가 16.7ms 예산을 초과하므로 60fps 게이트는 **통과로 주장하지 않습니다**. 이 패킷은 GitHub Pages 배포 증거가 아니며, pre-wave 캡처는 배우 게이지의 사람 시각 평가나 사람 플레이테스트 완료를 주장하지 않습니다. 게임 하네스 게이트도 이 증거로 통과 처리하지 않습니다.

## 프로젝트 구조

```text
Abyssal-Command/
├── index.html            # 캠페인 UI와 공개 메타데이터
├── styles.css            # 프레젠테이션과 reduced-motion 규칙
├── app.js                # 입력, HUD, 내레이션, 로컬 저장
├── campaign-state.js     # 결정론 규칙 엔진과 콘텐츠 추적 ID
├── i18n.js               # 한국어/영어 로컬라이제이션
├── sw.js                 # PWA 서비스 워커
├── assets/               # 오디오, 이미지, 비디오와 provenance manifest
├── docs/                 # 구현과 디자인 문서
├── scripts/              # 밸런스 도구
├── tests/                # 규칙·캠페인·브라우저 검증
└── _workspace/           # 생산 및 감사 아티팩트
```

## 로컬 실행

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## GitHub Pages 배포

`main`에 푸시하면 [Deploy static content to Pages](.github/workflows/static.yml) 워크플로가 실행됩니다. 워크플로가 성공적으로 완료되면 https://jellyggumi.github.io/Abyssal-Command/ 가 갱신됩니다.

배포 아티팩트는 커밋된 런타임 파일 allowlist에서만 생성됩니다. 로컬 작업 트리의 미추적 파일이나 allowlist 밖 파일은 GitHub Pages에 포함되지 않습니다. 배포 상태는 상단 배지 또는 `gh run list --workflow static.yml --limit 1`로 확인합니다.

## 검증 상태와 패키징 범위

**v0.4.0 릴리스 후보:** RealtimeBattle WebGL/GLB 경로가 기본이며 Canvas는 대체 경로입니다. 규칙 엔진과 유닛 커버리지는 10개 스테이지에 걸치며, 전 스테이지가 약 5분 전투 스케줄, 웨이브 상자, 보스 노출 필드 이벤트, 여섯 전술 효과, 보스 위협 자동공격, 지상 PBR 텍스처, 유한 Hunt/Extract 상한을 공유합니다. 브라우저 검증은 캠페인 시작·브리핑·전투 진입, 1280×720 리소스 로드와 오버플로 없음까지 실행했습니다. 10개 스테이지 전체의 실제 사람 완주 시간과 게임 하네스의 몰입도·30분 soak 게이트는 아직 측정하지 않았으므로 통과로 주장하지 않습니다.

APK는 향후 선택 가능한 패키징 경로이며, 이 저장소는 APK 산출물이나 설치 가능한 Android 빌드를 제공한다고 주장하지 않습니다.