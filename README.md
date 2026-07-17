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

## 3단계 캠페인

| Stage | 무대 | 핵심 전술 | 보스 |
|---|---|---|---|
| 1 | **Cinder Span** | 추출·점령 기본 루프 | Cinder Warden (HP 8) |
| 2 | **Veil Citadel** | Possession과 두 거점 유지 | Veil Tactician (HP 10) |
| 3 | **Echo Throne** | 1회성 Lord's Domain 역전기 | Gate Sovereign (HP 17) |

스테이지·보스·보상 이름과 설명은 `campaign-state.js`의 `STAGES[*].trace` 및 `CONTENT_TRACE`에 기록됩니다. 원본 콘텐츠·자산 매핑은 [worldview inventory](_workspace/20260716-shadow-lord-rts-rpg/design/worldview.md)와 [resource manifest](_workspace/20260716-shadow-lord-rts-rpg/engineering/resource-manifest.md)에 있습니다.

## 단일 페이지 전투 흐름

`시나리오 브리핑 → 보스 정보 → 전장 → 결과/보상 → 다음 시나리오`는 `#campaign-screen` 안에서 전환됩니다. 패배하면 같은 흐름에서 현재 Stage를 재시도할 수 있습니다. 렌더러가 초기화되지 않아도 정적 전술 브리핑과 명령 상태 전이는 계속 사용할 수 있습니다.

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

## 검증 상태와 패키징 범위

G1–G8은 개별 증거가 있는 경우에만 해당 원장에서 상태를 확인할 수 있습니다. 이 README는 어떤 게이트의 통과를 주장하지 않습니다.

APK는 향후 선택 가능한 패키징 경로이며, 이 저장소는 APK 산출물이나 설치 가능한 Android 빌드를 제공한다고 주장하지 않습니다.