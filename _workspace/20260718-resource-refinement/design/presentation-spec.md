# Abyssal Surge 리소스 정밀화 프레젠테이션 사양

- **사이클:** `20260718-resource-refinement`
- **운영 모드:** Stage 1 — resource / presentation refinement
- **상태 기준:** 2026-07-18 저장소 구현
- **대상 독자:** 3D·리깅·스프라이트·오디오·비디오 제작자와 런타임 통합자
- **규칙 권위:** `campaign-state.js`

## 1. 목표와 비목표

이 문서는 이미 구현된 리소스가 **메시 → 액션 클립 → 래스터 스프라이트 → 사운드·영상 → 브라우저 런타임**으로 이어지는 한 경로를 고정한다. 각 매체는 같은 전투 사건을 더 잘 읽히게 해야 하며, 사건의 성공 여부·수치·보상·세이브·리플레이를 판정하지 않는다.

### 목표

1. WebGL 주 렌더러와 Canvas 2D 폴백이 같은 `abyssal-command` 원본을 다른 표현 방식으로 사용한다.
2. 64px 안팎의 유닛 표시에서도 진영·방향·행동·위협 우선순위가 색 없이 먼저 실루엣으로 읽힌다.
3. 액션 클립, MP3 큐, 시네마틱 컷이 모두 이미 존재하는 행동 또는 상태 전이를 설명한다.
4. 자산 하나가 실패해도 명령 규칙과 캠페인 상태는 손상되지 않는다.

### 비목표

- 새 행동, 전투 규칙, 피해 수식, 쿨다운, 보상, 성장, 밸런스 또는 수익화를 추가하지 않는다.
- Canvas 런타임에 GLB 파서나 별도 WebGL 컨텍스트를 추가하지 않는다.
- Stage 4–10 전용 신규 보스 메시를 이 문서만으로 승인하지 않는다. 현재 3종 메시 재사용은 기존 리소스 예산 면제 사항이다.
- `guard`, `jump`, `evade`, `explore`를 구현 완료된 행동으로 간주하지 않는다. 현행 GLB 액션 어휘는 아래 5/3/2클립 계약이다.

## 2. 결과 권위 경계

| 계층 | 소유하는 것 | 소유하지 않는 것 |
|---|---|---|
| `campaign-state.js` | 행동 수락·거부, 캠페인/인카운터 상태 전이, 수치, 세이브, 리플레이 | 렌더 프레임, 포즈, 파티클, 음향 공간화, 영상 재생 |
| `app.js` | 수락된 의미 행동을 렌더러에 전달, 오디오·영상 UI 수명주기 | 행동 결과 재판정 |
| `battle-realtime-three.js` | GLB 로드·클립 재생·3D 이동/교전 연출, `breach`·`wave-cleared` 의미 이벤트 전달 | 캠페인 수치 직접 확정 |
| `battle-visualizer.js` | Canvas 전장, 래스터 브리지, 절차 도형·파티클·공간음 폴백 | GLB 파싱, 독자 세이브/보상 판정 |
| MP3/MP4/PNG/GLB | 사건의 감각적 전달 | 상태 전이의 원인 또는 증거 |

표현 레이어가 만든 `breach`·`wave-cleared`도 최종 상태를 직접 고치지 않고 `app.js`를 통해 결정론 엔진의 인카운터 이벤트로 전달한다. 렌더러 모드는 이벤트 후보의 발생 경로를 달리할 수 있지만, 동일하게 기록된 의미 이벤트 trace의 저장·리플레이는 결정론적이며 PNG/MP3/MP4/GLB 자체가 캠페인 수치를 직접 쓰지 않는다.

**현행 권위 예시:** Stage 1 `encounter`는 준비 8초/legion 4/node 1, `scout` 8초·2기 → `guard` 22초·3기 → `reinforcement` 36초·3기, hostileHealth 2/breachDamage 1을 선언한다. `app.js`는 다음 미해결 웨이브 하나만 예약하고, 렌더러의 breach 후보는 활성 `stageId/waveId`와 일치해야 엔진이 수락한다. 반복 소강 루프·렌더러별 별도 적 수·자산 로드 실패 기반 피해는 없다.

## 3. 단일 리소스 추적선

| 단계 | 현행 산출물과 계약 | 다음 단계가 신뢰하는 표식 | 런타임 소비 |
|---|---|---|---|
| 1. 메시·재질 | `assets/models/abyssal-command/`: v2 매니페스트의 15 GLB(유닛 5, 보스 3, 프롭 4, 지형 3), flat-shaded PBR, 내장 albedo/normal, 외부 텍스처 URL 없음 | `<asset-id>-root`, ground-center pivot, 빌드 recipe·측정값·원본/GLB/텍스처 SHA-256 | Three.js 주 렌더러 또는 Blender 래스터 생성기 |
| 2. 리깅·액션 | 유닛 `Idle/Move/Strike/Special/Defeat`, 보스 `Idle/Attack/Defeat`, 프롭 `Idle/Activate`, 지형 정적; 유닛은 root 판정 소유권을 유지하면서 `body-control`/`equipment-control` 강체 보조 채널 사용 | `<asset-id>__<Clip>` 이름과 선언 순서; 유닛 클립별 channel 수 Idle/Move/Strike/Special/Defeat = 6/5/5/6/4; `Move` root translation 없음 | `RealtimeBattle.play()`와 `render-8dir-atlas.py`가 같은 이름으로 선택 |
| 3. GLB 래스터 브리지 | `assets/images/battle/glb/manifest.json`: `glb-raster-pack-v1`, 45레코드 = 액션 아틀라스 42 + 지형 플레이트 3 | 원본/출력 SHA-256, 8열 방향, 4행 샘플 프레임 1/10/20/30, 128px 셀 | Canvas가 매니페스트와 동일 출처 PNG만 로드; GLB 파서 없음 |
| 4. 소리·영상 | `assets/audio/*.mp3`, `assets/video/*.mp4`, 자막·시각 설명문 | 의미 행동 키, 스테이지 키, 코덱/해상도/프레임률, `assets/media-manifest.json`의 출처·파생·해시 | 수락된 행동, 스테이지 브리핑, 선택형 로비 시네마틱에 결합 |
| 5. 브라우저 런타임 | WebGL 주 렌더러 → Canvas 2D → 브리지별 개별 폴백 → 텍스트/명령 UI | 로드 상태는 표시하되 캠페인 상태와 분리 | `campaign-state.js` 결과를 표현하고 저장/리플레이는 건드리지 않음 |

### 3.1 실제 채택 범위

- WebGL 전투는 스테이지마다 **지형 1 + `shade` + `scout` + 보스 1**, 총 4 GLB 템플릿만 즉시 로드한다.
- WebGL 적 웨이브는 현행 코드에서 모두 `scout.glb`를 복제하고 웨이브 id를 아키타입 메타데이터로 둔다. 따라서 `guard`·`reinforce`의 메시 차이는 아직 주 렌더러에 채택되지 않았다.
- Canvas 브리지는 15개 원본 전체의 45개 래스터 레코드를 읽는다. 유닛 아키타입은 `shade/possessed/scout/guard/reinforce`, 의미 행동 오버레이는 프롭·유닛 액션을 사용할 수 있다.
- Stage 1–3은 전용 지형/보스 GLB를 사용한다. Stage 4–10은 3종 지형/보스 메시를 재사용하고 주 렌더러에서 스테이지 `palette.hostile` 틴트를 적용한다. Canvas는 Stage 4–10의 고유 보스 초상으로 정체성을 보존한다.
- 15개 root는 authored 원점에 있고 authored Z-up 최저점과 runtime Y-up 최저점이 모두 0m다. ground-center는 body/plinth 중심의 지면 기준이며, 비대칭 장비 때문에 전체 AABB의 수평 중심은 최대 0.272168m 벗어날 수 있다. 이는 접지 실패가 아니다.

## 4. 아트 디렉션

### 4.1 핵심 문장

**차갑고 무거운 저폴리 군세가 심연의 발광 균열을 둘러싸고, 제한된 색과 날카로운 가장자리로 명령 가능한 실루엣을 만든다.**

### 4.2 형태·재질·색

- **형태:** subdivision으로 둥글게 만들지 않는다. 기존 faceted plane과 bevel edge를 유지해 작은 화면에서도 면 전환이 보이게 한다.
- **비율:** 유닛은 머리/상체 덩어리와 무기·방패·돌출물 사이에 음영 간격을 둔다. 보스는 유닛보다 넓고 높은 외곽선, 프롭은 움직이는 캐릭터와 겹치지 않는 수직/환형 표식을 쓴다.
- **재질:** `void-obsidian`과 `ash-cloth`가 질량을, `cold-steel`·`old-bone`·`gate-gold`가 역할을, `violet-rift`·`cinder-ember`가 에너지 방향을 담당한다. 발광은 형태를 지우는 흰색 번짐이 아니라 국소 리듬으로 제한한다.
- **진영 언어:** 아군은 청록/냉색, 적은 적색·주황/온색, 빙의·영역은 보라, 목표·권위는 금색을 우선한다. 실제 색상 값은 스테이지의 `battle-presentation.js` 팔레트를 따른다.
- **카메라 일치:** 래스터 브리지는 정사영, 고도 30°, 45° 간격 8방향이다. 원근 과장이나 카메라별 비율 변경으로 WebGL과 Canvas의 체급 인상이 달라지지 않게 한다.

## 5. 실루엣·가독성 규칙

1. **실루엣 우선:** 색을 회색으로 보아도 `shade`의 양 sickle/X·후방 cloak tail, `scout`의 창·quiver/scarf, `guard`의 tower shield·halberd H, `reinforce`의 horn crown·중량 maul, `possessed`의 halo·비대칭 결정이 구분되어야 한다.
2. **8방향 구분:** 정면/후면은 어깨·망토·무기 겹침이 달라야 하고, 좌우 대각은 무기 쪽과 빈손 쪽의 negative space가 뒤집혀야 한다. 단순 색상 반전만으로 방향을 표시하지 않는다.
3. **접지:** 모든 GLB root와 authored body/plinth 지면 중심은 ground-center다. authored Z-up/runtime Y-up 최저점이 0m여야 하며 포즈 중 하단 접점이 프레임 밖으로 잘리거나 그림자에서 뜨지 않아야 한다. 비대칭 장비가 만드는 전체 AABB 수평 오프셋은 접지 판정에 쓰지 않는다.
4. **실제 표시 크기 검사:** 128px 원본만 보지 않는다. Canvas의 일반 유닛 약 64px, 강화 적 약 76px, 보스 약 82px에서 머리·무기·진영이 식별되어야 한다.
5. **동작 대비:** `Idle`은 낮은 진폭, `Move`는 진행축, `Strike/Attack`은 넓은 공격축, `Special/Activate`는 중심 발광·상향축, `Defeat`는 높이와 질량이 무너지는 축을 쓴다.
6. **이펙트 절제:** 파티클·링·트레일은 접촉점과 의미 대상을 강조하되 몸통 외곽선을 300ms 이상 완전히 가리지 않는다. 선택 링, 포털, 노드, 보스 노출 상태가 공격 파티클보다 우선한다.
7. **색각 비의존:** 진영은 팔레트뿐 아니라 외곽선, 무기 방향, 선택 타원, 이동 방향으로 중복 표현한다.
8. **보스 정체성 면제:** Stage 4–10 재사용 메시의 틴트는 완전한 고유 실루엣을 대체하지 않는다. 고유 초상과 HUD 이름이 정체성 보조 수단이며, 신규 메시가 생기기 전까지는 명시적 리소스 예산 면제로 유지한다.

## 6. 애니메이션 포즈별 목적

| 클립 | 시각적 목적 | 현행 런타임 사용 | 판정 경계 |
|---|---|---|---|
| 유닛 `Idle` | 병종과 무기 방향을 안정적으로 읽는 기준 포즈 | 정지한 commander/ally/enemy, Canvas 기본 셀 | 대기 상태를 판정하지 않음 |
| 유닛 `Move` | 진행 방향과 속도감을 전달하고 발 접지를 유지 | WASD/집결 이동, 아군 추종, 적 전진 | 위치·충돌 연출; 캠페인 행동 결과와 별개 |
| 유닛 `Strike` | 예비 동작 → 접촉축 → 회수의 한 타를 읽힘 | 근접 교전, `assault`의 commander 포즈 | 피해/assault 수치는 엔진 또는 인카운터 이벤트가 확정 |
| 유닛 `Special` | 일반 타격과 구분되는 소환·탐색·빙의·영역의 발동 신호 | 신규 아군 등장, 여러 의미 행동의 actor/source 포즈 | 효과 수치를 만들지 않음 |
| 유닛 `Defeat` | 높이를 낮추고 전투 가능 실루엣을 해제 | 로컬 교전 패배 뒤 `Defeat`에 latch | 캠페인 패배와 동일시하지 않음 |
| 보스 `Idle` | 노출된 위협의 체급·정체성을 유지 | 보스 노출 후 기본 | 보스 HP를 변경하지 않음 |
| 보스 `Attack` | boss-assault의 반응/반격 위험을 강조 | 노출 보스에 `assault` 성공 시 1회 | 반격 수치 권위는 엔진 |
| 보스 `Defeat` | 정점 종료를 짧고 명확하게 전달 | 권위 보스 HP가 0이 된 뒤 1회 | 승리 상태를 만들지 않음 |
| 프롭 `Idle` | 포털·추출기·오벨리스크·왕좌의 기능 위치 고정 | Canvas 의미 대상/대기 표현 | 상호작용 가능 여부를 판정하지 않음 |
| 프롭 `Activate` | 추출·소환·점령·영역의 발동 위치를 표시 | 수락된 의미 행동의 Canvas 오버레이 | 행동 수락 이후에만 재생 |
| 지형 정적 plate | 스테이지 공간의 질감·덩어리 보조 | Canvas 절차 지형 위 32% alpha | 충돌·고도·경로를 변경하지 않음 |

`glb-raster-pack-v1`의 4개 행은 별도 4포즈가 아니라 **동일 액션의 원본 프레임 1/10/20/30 샘플**이다. reduced-motion에서는 첫 행만 사용한다. 정상 Canvas 재생은 125ms 간격으로 4행을 순환하며, 방향 열은 이동 벡터를 8방향 인덱스로 변환한다.

### 6.1 수락된 7행동의 표현 매핑

| 의미 행동 | 소스 → 대상 | GLB/래스터 포즈 | MP3 역할 |
|---|---|---|---|
| `hunt` | portal → extractor | `shade__Special` | 탐지 개시와 목표 포착 |
| `extract` | extractor → portal | `soul-extractor__Activate` | 영혼 흡입과 회수 완료 |
| `materialize` | portal → portal | `rift-portal__Activate` + commander `Special` | 군단 생성의 상승 에너지 |
| `capture` | portal → node | `command-obelisk__Activate` | 점령 잠금/거점 확보 |
| `possess` | portal → ally | `possessed__Special` | 소유권 전이와 상태 변환 |
| `domain` | portal → portal | `echo-throne__Activate` | 넓고 지속적인 영역 개방 |
| `assault` | ally → boss | `shade__Strike`, 노출 보스 `Attack` | 가장 무거운 타격/결산 |

이 매핑은 `app.js`의 `BATTLE_ACTION_SEMANTICS`를 설명한 것이며 새 행동 규칙이 아니다. 거부되거나 쿨다운 중인 행동에는 포즈·큐를 재생하지 않는다.

## 7. 8방향 아틀라스의 실제 상태

### 7.1 주 Canvas 경로: GLB raster bridge

- 매니페스트 버전: `glb-raster-pack-v1`.
- 액션 PNG: 1024×512, 8열 × 4행, 셀 128×128, 투명 배경.
- 지형 PNG: 128×128 단일 plate.
- 카메라: 정사영, 고도 30°, yaw 0/45/90/135/180/225/270/315°.
- 액션의 4개 frame × 8개 yaw 전체 evaluated mesh bounds로 ortho scale/target을 정하고 샘플마다 `<asset-id>-root` translation을 추적한다. 셀마다 10% 투명 moat를 목표로 하며 현행 pack의 최소 edge padding은 12px다.
- Canvas는 `assets/images/battle/glb/` 아래 동일 출처 PNG만 허용하고 `generationVersion`, 8열, 4행을 검사한다. 현행 42개 action atlas는 모두 8개 direction column과 8개 animated direction column을 기록한다.
- 런타임 검수 크기는 unit 64px, boss 82px, prop 52px이며 `Strike/Special/Defeat`와 대표 boss/prop clip의 crop·접지·방향 구분을 확인했다.

### 7.2 기존 아틀라스의 채택 상태

- `shade/possessed/scout/guard/reinforce-atlas.png`는 각각 1024×128의 8방향 단일행 산출물로 저장되어 있으나, 현행 JS가 직접 선택하지 않는 **레거시 제작 산출물**이다. 존재만으로 런타임 채택을 주장하지 않는다.
- `sovereign-atlas.png`(256×256)는 Stage 3 보스의 보조 이미지로 참조되지만, 사용 순서는 `gate-sovereign__Idle` 브리지 아틀라스 다음이다.
- 브리지 유닛 프레임이 없으면 Canvas는 `assets/images/characters/dusk-legion-atlas.png`의 8방향 × 2 idle-light phase를 사용한다. 이것도 없으면 진영색 절차 실루엣을 그린다.

## 8. 사운드 큐 역할

### 8.1 의미 큐

| 큐 | 전달해야 하는 정보 | 금지 |
|---|---|---|
| `hunt.mp3` | 탐색 시작, 멀리 있는 표적이 잡히는 상승/핑 | 성공 보상처럼 장중한 종결음 |
| `extract.mp3` | 에너지가 안쪽으로 빨려 들어와 자원화되는 하강/흡입 | 공격 충돌음 |
| `materialize.mp3` | 아래에서 위로 질량이 생기는 소환 | 적 breach 경보와 유사한 하강음 |
| `capture.mp3` | 짧은 기계적 잠금과 거점 안정 | 지속 BGM처럼 긴 꼬리 |
| `possess.mp3` | 한 주체에서 다른 주체로 제어가 건너가는 위상 이동 | 단순 타격음 |
| `domain.mp3` | 넓은 범위가 열리고 유지되는 저역/공간 확장 | 즉시 승리 팡파르 |
| `assault.mp3` | 현재 액션 집합에서 가장 무거운 공격 결산 | 보스 패배를 미리 확정하는 종결음 |
| `reward.mp3` | 선택이 수락되어 다음 상태로 넘어감을 알림 | 선택 전 미리 재생 |
| `wave-spawn.mp3` | 권위 `start-wave`가 수락되어 적이 진입함 | 스케줄 전 예고를 사건 완료처럼 재생 |
| `breach-alert.mp3` | 권위 `breach` 수락과 방어선 손실 경보 | renderer의 미수락 접촉만으로 재생 |
| `battle-bgm.mp3` | 전투 장면의 지속 압박, 사용자 BGM 선택 유지 | 자동재생 또는 행동 결과 암시 |

### 8.2 계층과 폴백

- WebGL 전투는 수락된 의미 행동 MP3를 3D 위치의 sample로 재생하고, 근접 충돌·defeat·wave-clear에는 짧은 절차 tone을 더한다.
- Canvas 전투는 `AudioContext` oscillator로 행동의 소스/대상 위치를 구분한다. 가상 리스너 아래쪽은 가깝게, 위쪽은 감쇠·low-pass 처리한다.
- `wave-spawn.mp3`와 `breach-alert.mp3`는 직렬화된 인카운터 사건 큐가 권위 `start-wave`/`breach`를 수락한 뒤 app-level 비공간 큐로 재생한다. 단일 cue player와 동일 큐 150ms guard가 중첩을 억제하며 renderer-local 절차 tone은 이 의미 큐를 대체하지 않는다.
- `ambient.mp3`는 전투 중 별도 사용자 토글로 반복한다. BGM을 사용자가 켠 경우에만 로비 `bgm-theme.mp3`와 전투 `battle-bgm.mp3` 사이를 전환하며, 재생 거부나 디코드 실패는 무음으로 저하된다.
- 전투 이탈은 cue/ambient source를 멈추고 해제하며, 사용자가 BGM을 켜 둔 경우 로비 `bgm-theme.mp3`를 복원한다. BGM의 사용자 선택은 장면 source 전환과 분리하며 자동재생하지 않는다.
- `narr-intro`, `narr-stage1/2/3`, `narr-victory`, `narr-defeat` MP3는 같은 키의 텍스트 타이핑 및 screen-reader 문장과 결합한다. Stage 4–10은 현재 텍스트 내레이션만 있다.
- `click.mp3`는 파일은 존재하지만 현행 프로덕션 JS의 직접 참조가 없다. 공급 자산과 사용 자산을 구분한다.

## 9. 시네마틱 전달 목표와 계약

### 9.1 런타임 목적

- **로비 캠페인 시네마틱:** 선택형 요약이다. 플레이어가 사냥→추출→소환→거점→빙의/영역→보스 압박→귀환의 전투 판타지를 이해하게 하되, 시청을 시작 조건으로 만들지 않는다.
- **스테이지 전환 영상:** Stage 1–3의 장소 분위기를 5초 안에 전달하는 보조 배경이다. 목표·보스명·명령은 항상 텍스트 브리핑이 소유한다.
- **컷 우선순위:** 세계/위협 설정 → 플레이어 명령과 반응 → 결과/귀환. 구현되지 않은 규칙을 플레이 가능한 기능처럼 보여주지 않는다.

### 9.2 인코딩·접근성

- 신규/갱신 런타임 MP4 목표는 H.264, yuv420p, 960×540, 24fps, faststart다.
- 현행 전환 경로는 `cinder-span.mp4`, `veil-citadel.mp4`, `echo-throne.mp4`를 참조한다. Shared inventory는 세 파일의 출처·해시를 기록하지만 코덱/프레임률/faststart를 모두 증명하는 verification artifact는 없으므로 이 24fps 프로필을 통과했다고 승격하지 않는다.
- 현재 `abyssal-surge-cinematic.mp4`는 H.264 High/yuv420p/960×540/24fps/faststart, 19.02초, AAC-LC다. 3개의 한국어 VTT cue와 시각 설명문은 실제 3전장 몽타주 시간축 00:00–00:19.02에 맞는다.
- 로비 영상은 poster, `preload="none"`, 사용자 버튼 로드, 최초 음소거, `playsinline`, native controls, 한국어 VTT, MP4 직접 링크를 사용한다.
- loading/ready/playing/paused/ended/unavailable 상태를 알리고, unavailable 시 MP4 직접 링크·캠페인 텍스트 브리핑·포커스 가능한 시각 설명문을 유지한다. 다음 재생 요청으로 canonical MP4를 다시 로드해 회복할 수 있다.
- reduced-motion에서는 스테이지 전환 MP4를 로드하지 않고 정적 stage art와 텍스트를 유지한다.

## 10. 런타임 폴백 사다리

1. **정상 경로:** `RealtimeBattle`이 stage terrain + shade + scout + stage boss GLB를 로드하고 연속 액션 클립을 재생한다.
2. **렌더러 폴백:** reduced-motion이거나 WebGL 초기화/컨텍스트/GLB 로드가 실패하면 정적 전술 브리핑 sidecar와 `BattleVisualizer` Canvas 2D를 표시한다.
3. **Canvas 초기화 경계:** Canvas가 초기화되면 명령 패드는 활성 상태를 유지한다. Canvas 초기화 자체가 실패하면 정적 브리핑은 남지만 `visualizer=null`이므로 행동 입력은 renderer 복구 전까지 비활성이다.
4. **브리지 부분 실패:** Canvas 매니페스트 또는 개별 PNG가 없으면 사용 가능한 레코드만 채택한다. 유닛은 conceptual 8방향 atlas → 절차 실루엣, 보스는 스테이지 이미지 → 절차 삼각형, 지형은 기존 절차 타일을 유지한다.
5. **오디오 실패:** 해당 소리만 생략한다. 시각 효과, 상태 문구, `aria-live`/screen-reader 문장은 유지한다.
6. **영상 실패:** 비디오를 숨기고 정적 poster/stage art, MP4 fallback 링크, 텍스트 캠페인 브리핑, 시각 설명문을 유지한다.
7. **상태 불변:** 자산 실패 자체를 행동 실패·breach·패배·보상으로 직접 기록하지 않는다. 명령 수락과 상태 전이는 계속 `campaign-state.js`가 판정한다.

## 11. 독립 생성 후보 레인과 입고 경계

다음 레인은 현행 자산을 자동으로 교체하는 생산 경로가 아니라 **선택적 후보 제작/검증 경로**다. 보고서나 출력 파일의 존재는 shipped 증거가 아니다. 프로덕션 JS와 바이너리 채택은 별도 통합·검증 후에만 선언한다.

| 후보 레인 | 예상 근거 | 이 사이클에서 허용하는 용도 | shipped 승격 전 필수 게이트 |
|---|---|---|---|
| GodTiboImagen | `design/gti-image-report.md` | 실루엣·재질·장소 톤 후보와 키 아트 비교 | 출처/프롬프트/해시, 세계관 일치, 실제 표시 크기 가독성, 기존 UI/초상 폴백 보존 |
| PerfectPixel | `engineering/perfectpixel-report.md` | 8방향·포즈 스프라이트 후보와 번들 구조 검토 | 방향/포즈 순서 검증, alpha·접지·셀 bounds, GLB raster bridge와 충돌 없음, 런타임 파서 추가 없음, 매니페스트 등록 |
| Vox Director | `engineering/vox-report.md` | 선택형 캠페인 영상 후보와 컷 전달력 검토 | 구현된 행동만 표현, H.264/yuv420p/960×540/24fps/faststart, 자막·시각 설명문, 무음/오류 폴백, 미디어 해시 |
| Motion Previs | `engineering/motion-previs-report.md` | 포즈 타이밍·카메라·컷 연결 previsualization | 현행 5/3/2클립 이름/목적 보존, root/pivot 경계 검토, 게임 판정 비소유, 최종 GLB/MP4와 구분된 provenance |

- 후보가 기존 아트보다 실루엣·가독성·접근성 또는 계약 적합성에서 나쁘면 채택하지 않는다.
- 후보 간 소스 연결은 명시한다. 예: GTI key art → Vox 입력, GLB action → PerfectPixel 비교, Motion Previs timing → 최종 영상 편집. 파생 단계마다 원본과 출력 SHA-256을 남긴다.
- Motion Previs의 camera/pose 제안과 Vox의 편집 결과는 런타임 액션 길이·히트 타이밍·캠페인 상태를 바꾸는 권위가 없다.

### 11.1 2026-07-18 관찰 상태

- **GodTiboImagen:** 리소스 제련 콘셉트 PNG와 원문 프롬프트·해시가 생성되었다. 아트 방향 참고 후보이며 런타임 이미지나 shipped 자산으로 채택되지 않았다.
- **PerfectPixel:** 요청 provider가 설치된 `ppgen`에서 지원되지 않아 단일 `idle` 시범도 미디어를 만들지 못했다. 기존 GLB raster bridge를 유지하며 대체 품질을 주장하지 않는다.
- **Motion Previs:** canonical 19.02초 영상에서 프레임·장면 차이·2D apparent motion 분석 번들을 만들었다. 포즈/카메라 측정 근거일 뿐 GLB 액션이나 최종 MP4를 대체하지 않는다.
- **Vox Director:** 저장소 소유 이미지를 사용한 22.625초 H.264/yuv420p/960×540/24fps/faststart paper-collage 후보를 로컬 Pillow/FFmpeg로 만들었다. Atlas credential 부재를 숨기지 않은 재현 가능한 fallback이며 프로덕션 시네마틱·앱·서비스 워커·공유 매니페스트에는 채택되지 않았다.

## 12. 제작·인수 규칙

- GLB 변경은 `assets/models/abyssal-command/manifest.json`의 pivot, 내장 이미지, 선언 action 이름/순서를 보존한다.
- GLB 파생 PNG는 `scripts/render-8dir-atlas.py --pack` 경로로만 갱신한다. 브리지 매니페스트에는 각 GLB/PNG의 경로·SHA-256·bytes·dimensions·clip/frame/direction/camera/alpha 검증을 기록하고, 공유 `assets/media-manifest.json` 또는 이 런의 engineering report/manifest 중 하나에 생성 recipe와 상위 해시를 남긴다. Sprite 생성 pass는 DR-007 예외와 `--skip-media-manifest`로 충돌을 피했고, 후속 serialized reconciliation이 shared manifest의 45개 bridge PNG 항목을 현재 파일과 일치시켰다. 런타임/생성 권위는 브리지 매니페스트, shared manifest는 현재 일치하는 보조 inventory다.
- 신규/갱신 오디오·비디오는 생성 방식, 소스, 프롬프트 또는 절차 레시피, SHA-256을 `assets/media-manifest.json` 또는 이 런의 engineering 리소스 매니페스트에 기록한다.
- 스프라이트 검수는 8방향 × 모든 선언 클립 × 실제 표시 크기에서 한다. 원본 128px 셀만 보고 통과시키지 않는다.
- 시네마틱은 코덱 검사와 함께 무음·오류·reduced-motion 경로에서 핵심 브리핑이 남는지 확인한다.
- 프레젠테이션 정밀화는 기존 사건을 더 명확히 보여주는 일이다. 새 규칙·밸런스·수익화 제안은 이 사이클의 인수 범위가 아니다.

## 13. 근거 파일

- `assets/models/abyssal-command/manifest.json`
- `assets/images/battle/glb/manifest.json`
- `assets/media-manifest.json`
- `scripts/render-8dir-atlas.py`
- `app.js` (`BATTLE_ACTION_SEMANTICS`, `CUE_BY_EFFECT`, `NARRATION`, `VIDEO_BY_STAGE`, renderer fallback lifecycle)
- `battle-realtime-three.js`
- `battle-visualizer.js`
- `index.html` (cinematic controls, captions, visual transcript)
- `_workspace/20260718-resource-refinement/design/gti-image-report.md`
- `_workspace/20260718-resource-refinement/engineering/perfectpixel-report.md`
- `_workspace/20260718-resource-refinement/engineering/vox-report.md`
- `_workspace/20260718-resource-refinement/engineering/motion-previs-report.md`
- `_workspace/20260718-resource-refinement/engineering/sprite-bridge-report.md`
- `_workspace/20260718-resource-refinement/engineering/audio-report.md`
- `_workspace/20260718-resource-refinement/engineering/mesh-rig-report.md`
- `_workspace/20260718-resource-refinement/engineering/video-report.md`
- `sw.js` (GLB bridge manifest-driven cache and static media cache)
