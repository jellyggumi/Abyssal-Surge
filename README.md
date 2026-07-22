# Abyssal Surge

[![Deploy to Pages](https://github.com/jellyggumi/Abyssal-Command/actions/workflows/static.yml/badge.svg)](https://github.com/jellyggumi/Abyssal-Command/actions/workflows/static.yml)
[![GitHub Pages](https://img.shields.io/github/deployments/jellyggumi/Abyssal-Command/github-pages?label=GitHub%20Pages)](https://jellyggumi.github.io/Abyssal-Command/)

**Abyssal Surge**는 기존 심연 세계관을 유지한 모바일 우선 싱글플레이 디펜스 서바이버 캠페인입니다. 플레이어는 Dusk Warden을 이동시키고 자동 공격으로 지속되는 적군을 막으며, 런마다 스킬을 선택하고 정예를 추출해 영구 동료로 성장시킵니다. 10개 스테이지를 통과하면 Gate Zenith에서 캠페인이 종료됩니다. 전투 화면은 2.5D 아이소메트릭 스프라이트, 절차적 효과음/BGM, 스테이지 컷신 이벤트를 사용합니다.

## 플레이 계약

- 전장은 모바일 화면을 가득 쓰는 full-bleed Canvas입니다. HUD는 화면 가장자리에 배치하여 전장과 적의 위험 신호를 가리지 않습니다.
- 브라우저가 허용하는 범위에서 fullscreen과 landscape lock을 자동 요청합니다. 잠금할 수 없는 세로 화면에서는 회전 안내를 띄우지 않고, 시계 방향 논리 가로 화면을 세로 뷰포트에 표시합니다.
- 이동 입력 외에 기본 공격은 자동입니다. XP를 얻을 때마다 현재 런에만 적용되는 스킬 제안 중 하나를 선택합니다.
- 정예 적은 처치 뒤 추출할 수 있으며, 추출한 동료는 이후 캠페인에도 남는 영구 진행입니다.
- 보스를 쓰러뜨리면 다음 스테이지로 진행합니다. Stage 10 보스 승리는 캠페인을 마칩니다.

## 기술 계약

- 전투 규칙은 결정론적 60 Hz 시뮬레이션으로 진행합니다. 같은 저장 상태와 입력 순서는 같은 결과를 재현해야 합니다.
- 진행 데이터는 기기 로컬에 오프라인으로 저장하며, JSON 내보내기/가져오기로 백업과 이동을 지원합니다. 클라우드 동기화나 온라인 멀티플레이는 이 계약에 포함되지 않습니다.
- 전장 투영은 Canvas 2D 스냅샷 어댑터로 게임 규칙과 분리됩니다. 렌더러 오류가 발생하면 같은 스냅샷 계약의 대체 어댑터가 표시를 이어갑니다.
- reduced motion을 존중하고, 움직임·번쩍임을 줄인 읽기 쉬운 표현을 제공합니다.

상세한 규칙과 범위는 [디펜스 서바이버 설계 문서](docs/abyssal-command-defense-survivor-design.md), 제작 범위와 운영 원칙은 [production cycle](docs/abyssal-surge-production-cycle.md)을 따릅니다.

## 로컬 실행

정적 파일을 제공할 수 있는 로컬 HTTP 서버로 저장소 루트를 엽니다. `file://` 직접 실행은 ES module과 오프라인 저장 테스트를 우회하므로 지원하지 않습니다.

```bash
npm ci
python3 -m http.server 4173
# http://127.0.0.1:4173/
```

## 검증

```bash
node --test tests/defense-run-simulation.test.mjs tests/defense-campaign-adapter.test.mjs tests/defense-renderer-contract.test.mjs
node --test tests/defense-asset-manifest.test.mjs tests/no-rts-closure.test.mjs tests/release-closure.test.mjs
node tests/defense-survivor-browser.cjs
node tests/defense-hud-responsive-browser.cjs
```

브라우저 계약은 로비 → Cinder Span 전투 → 키보드/터치 이동 → 성장 선택을 확인합니다. Pages 아티팩트는 `.github/workflows/static.yml`의 런타임 allowlist와 `tests/pages-artifact-smoke.cjs`로 별도 폐쇄 검증합니다.

## 플레이 영상

실제 브라우저에서 새 저장소로 시작해 Cinder Span 전투와 성장 선택을 캡처한 영상은 [`assets/video/abyssal-surge-defense-survivor-smoke.mp4`](assets/video/abyssal-surge-defense-survivor-smoke.mp4)입니다. H.264, 1280×720, 22.88초입니다.

## GitHub Pages 배포

`main`에 푸시하면 [Deploy static content to Pages](.github/workflows/static.yml) 워크플로가 실행되도록 구성되어 있습니다. 현재 저장소의 Pages URL은 https://jellyggumi.github.io/Abyssal-Command/ 입니다. 저장소가 `Abyssal-Surge`로 실제 rename된 뒤에는 이 링크와 배지를 함께 갱신해야 합니다.

배포 아티팩트는 커밋된 런타임 파일 allowlist에서만 생성됩니다. `defense-audio.js`와 2.5D 전투 스프라이트 프레임은 allowlist와 service-worker 캐시에 포함되며, 로컬 작업 트리의 미추적 파일이나 allowlist 밖 파일은 Pages에 포함되지 않습니다. 상단 배지와 GitHub Actions 실행 기록은 실제 배포 상태를 확인하는 근거입니다.

## 저장소 구조

```text
Abyssal-Command/
├── index.html                 # 게임 진입점과 공개 메타데이터
├── app.js                     # 입력, HUD, 런 흐름, 로컬 저장 연결
├── defense-run-simulation.js  # 결정론적 60 Hz 전투 규칙
├── defense-catalog.js         # 스테이지·정예·스킬·아이템·보상 authored 데이터
├── defense-audio.js           # 오프라인 절차적 BGM/효과음 큐
├── campaign-state.js          # 영구 캠페인·동료 진행 상태
├── battle-realtime-three.js   # 기본 Canvas 스냅샷 전장 투영과 텍스처 프레임
├── battle-visualizer.js       # 대체 Canvas 스냅샷 전장 투영
├── assets/video/              # 캡처된 플레이 영상
├── docs/                      # 현재 제품·제작 문서
└── tests/                     # 자동화된 테스트 소스
```
