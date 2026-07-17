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

- 제작한 Blender GLB 리소스 15개를 빌드 시 결정론적으로 래스터화합니다. 결과물은 8방향·4프레임 액션 아틀라스 42개와 스테이지별 지형 플레이트 3개이며, 소스 GLB와 출력 PNG의 연결은 `assets/images/battle/glb/manifest.json`에 남습니다.
- Canvas 2D 런타임은 이 래스터 출력만 불러옵니다. 브라우저에서 GLB를 직접 로드하거나 네이티브 WebGL/GLB 재생을 제공하지 않습니다.
- 알려진 전투 액션은 소스에 연결된 아틀라스 애니메이션·시각 효과와 오디오 큐로 제시됩니다. 서비스 워커는 브리지 출력에 network-first 캐시를 적용해, 오프라인에서는 마지막으로 유효했던 매니페스트와 래스터 출력을 유지합니다.

### 2026-07-17 검증 증거

- `node --test tests/abyssal-command-assets.test.mjs tests/battle-realtime-three.test.mjs`는 12/12 통과했습니다. 임베디드 텍스처 소스 GLB, 런타임 액션 클립, normal-map/tangent 속성, Echo Throne의 얇은 높이 계단, 16×8 공용 이동·충돌 규칙을 검증합니다.
- `node --test tests/release-closure.test.mjs`는 15/15 통과했습니다. 런타임 미디어 URL은 Pages allowlist와 서비스 워커 캐시 정책에 모두 닫히며, `ffprobe`로 측정한 6개 내레이션 MP3보다 런타임 자막 노출 시간이 씬마다 최소 50ms 더 깁니다.
- Playwriter headless 세션으로 `http://127.0.0.1:4173/`을 확인했습니다. 새 캠페인 → Stage 1의 사냥·추출·실체화·점거 → scout/guard/reinforcement 웨이브 → Cinder Warden 처치 → 보상 선택 → Stage 2 브리핑 전이가 정상 동작했습니다. Stage 1의 렌더 증거는 `/tmp/abyssal-stage1-narration-recheck.png`에 보관됩니다.
- 내레이션은 저역 남성 Daniel 보이스, 짧은 실내 폐허 잔향이라는 톤 계약을 유지합니다. 측정 길이와 자막 동기 계산은 [narration scripts](_workspace/20260716-shadow-lord-rts-rpg/design/narration-scripts.md)에 기록합니다.


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

**0.1.0 릴리스 후보:** 이 후보는 GLB-to-Canvas 브리지를 포함하며, 확인 범위는 3단계 캠페인 브라우저 회귀에 한정됩니다. GitHub Pages 배포 성공이나 G1–G8 전체 통과를 의미하지 않습니다.

G1–G8은 개별 증거가 있는 경우에만 해당 원장에서 상태를 확인할 수 있습니다. 이 README는 어떤 게이트의 통과를 주장하지 않습니다.

APK는 향후 선택 가능한 패키징 경로이며, 이 저장소는 APK 산출물이나 설치 가능한 Android 빌드를 제공한다고 주장하지 않습니다.