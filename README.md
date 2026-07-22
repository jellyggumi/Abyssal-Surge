# Abyssal Command

[![Deploy to Pages](https://github.com/jellyggumi/Abyssal-Command/actions/workflows/static.yml/badge.svg)](https://github.com/jellyggumi/Abyssal-Command/actions/workflows/static.yml)
[![GitHub Pages](https://img.shields.io/github/deployments/jellyggumi/Abyssal-Command/github-pages?label=GitHub%20Pages)](https://jellyggumi.github.io/Abyssal-Command/)

**Abyssal Command**는 모바일 우선의 싱글플레이 디펜스 서바이버 캠페인입니다. 플레이어는 이동만 직접 조작하고 기본 공격은 자동으로 이루어집니다. 한 번의 런에서 성장 빌드를 만들고, 정예 적을 영구 동료로 추출하며, 10개 스테이지 캠페인을 완주합니다.

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

정적 파일을 제공할 수 있는 로컬 HTTP 서버로 저장소 루트를 엽니다. 예:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## GitHub Pages 배포

`main`에 푸시하면 [Deploy static content to Pages](.github/workflows/static.yml) 워크플로가 실행되도록 구성되어 있습니다. 워크플로가 성공적으로 완료된 경우 Pages URL은 https://jellyggumi.github.io/Abyssal-Command/ 입니다.

배포 아티팩트는 커밋된 런타임 파일 allowlist에서만 생성됩니다. 로컬 작업 트리의 미추적 파일이나 allowlist 밖 파일은 GitHub Pages에 포함되지 않습니다. 상단 배지와 GitHub Actions 실행 기록은 배포 상태를 확인하는 근거입니다.

## 저장소 구조

```text
Abyssal-Command/
├── index.html                 # 게임 진입점과 공개 메타데이터
├── app.js                     # 입력, HUD, 런 흐름, 로컬 저장 연결
├── defense-run-simulation.js  # 결정론적 60 Hz 전투 규칙
├── defense-catalog.js         # 스테이지·정예·스킬 authored 데이터
├── campaign-state.js          # 영구 캠페인·동료 진행 상태
├── battle-realtime-three.js   # 기본 Canvas 스냅샷 전장 투영
├── battle-visualizer.js       # 대체 Canvas 스냅샷 전장 투영
├── docs/                      # 현재 제품·제작 문서
└── tests/                     # 자동화된 테스트 소스
```
