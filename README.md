# Abyssal Command

[![Deploy to Pages](https://github.com/jellyggumi/Abyssal-Surge/actions/workflows/static.yml/badge.svg)](https://github.com/jellyggumi/Abyssal-Surge/actions/workflows/static.yml)
[![GitHub Pages](https://img.shields.io/github/deployments/jellyggumi/Abyssal-Surge/github-pages?label=GitHub%20Pages)](https://jellyggumi.github.io/Abyssal-Surge/)

**Abyssal Command**는 오리지널 세계관의 전투 중심 무자원 RTS-RPG 하이브리드 웹 캠페인입니다. 모든 진행은 브라우저 로컬에서 결정론적으로 계산되며, 온라인 서비스·멀티플레이·클라우드 동기화를 사용하지 않습니다.

**▶ 플레이:** https://jellyggumi.github.io/Abyssal-Surge/ (모바일·데스크톱, PWA 오프라인 지원)

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

## 프로젝트 구조

```text
Abyssal-Surge/
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

`main`에 푸시하면 [Deploy static content to Pages](.github/workflows/static.yml) 워크플로가 실행됩니다. 워크플로가 성공적으로 완료되면 https://jellyggumi.github.io/Abyssal-Surge/ 가 갱신됩니다.

배포 아티팩트는 커밋된 런타임 파일 allowlist에서만 생성됩니다. 로컬 작업 트리의 미추적 파일이나 allowlist 밖 파일은 GitHub Pages에 포함되지 않습니다. 배포 상태는 상단 배지 또는 `gh run list --workflow static.yml --limit 1`로 확인합니다.

## 검증 상태와 패키징 범위

**v0.2.1 릴리스:** RealtimeBattle WebGL/GLB 경로가 기본이며 Canvas는 대체 경로입니다. 규칙 엔진과 유닛 커버리지는 10개 스테이지에 걸칩니다. 브라우저 검증은 Stage 1–3 전투·보상·저장 왕복과 Stage 4 브리핑 전이까지 실제로 실행했으며, 10개 스테이지 전체를 브라우저에서 완료했다고 주장하지 않습니다.

APK는 향후 선택 가능한 패키징 경로이며, 이 저장소는 APK 산출물이나 설치 가능한 Android 빌드를 제공한다고 주장하지 않습니다.