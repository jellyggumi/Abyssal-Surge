# Abyssal Command (Shadow Lord)

[![Deploy to Pages](https://github.com/jellyggumi/Abyssal-Surge/actions/workflows/static.yml/badge.svg)](https://github.com/jellyggumi/Abyssal-Surge/actions/workflows/static.yml)
[![GitHub Pages](https://img.shields.io/github/deployments/jellyggumi/Abyssal-Surge/github-pages?label=GitHub%20Pages)](https://jellyggumi.github.io/Abyssal-Surge/)

**Abyssal Command**는 《나 혼자만 레벨업》 IP에서 영감을 얻은 **전투 중심 무자원 RTS-RPG 하이브리드 웹 게임**입니다. 
전투 성과를 곧바로 병력(그림자 군단)과 성장으로 전환하는 결정론적 규칙 엔진 기반으로 동작합니다.

---

## 🎮 게임 특징 및 시스템

1. **무자원 확장 루프 (그림자 추출)**
   * 자원 채집 노동자 없이, 적 마수 처치 후 잔류 영혼을 추출(`일어나라`)하여 즉시 아군 병력으로 실체화합니다.
   * 마력 거점(Tech Node) 점령을 통해 전장 통제력과 슬롯 상한을 확장합니다.
2. **듀얼 제어 조작**
   * **WASD**: 영웅 직접 이동 (RPG 모드)
   * **Space**: RPG 숄더뷰 ↔ RTS 전술 뷰 전환
   * **Tab / 휠클릭**: 소환수 직접 빙의(Possession) 제어
3. **결정론적 규칙 엔진**
   * `game-core.js`와 `campaign-state.js`를 통해 모든 전투 판정과 캠페인 상태 전이가 결정론적으로 처리됩니다.
   * 로컬 저장소(IndexedDB)를 활용한 세이브 복원 및 위조 방지 검증을 지원합니다.

---

## 🗺️ 3단계 캠페인 구조

* **Stage 1: Cinder Span (잿빛 교량)**
  * 목표: 재의 메아리 사냥, 그림자 군단 추출 및 보스 처치. 클리어 시 독점 보상 선택.
* **Stage 2: Veil Citadel (장막 성채)**
  * 목표: 이전 스테이지 보상을 계승하며, 2개 이상의 거점 점령 및 방어.
* **Stage 3: Echo Throne (메아리 왕좌)**
  * 목표: 최종 보스(Gate Sovereign) 처치 및 일발역전기 `군주의 영역` 활용.

---

## 📂 프로젝트 구조

```text
Abyssal-Surge/
├── index.html          # 메인 캠페인 UI 및 마크업
├── styles.css          # RTS-RPG 하이브리드 뷰 스타일
├── app.js              # 입력 처리, HUD 연출, 오디오 및 실시간 루프
├── game-core.js        # 순수 규칙 엔진 (결정론 Reducer)
├── campaign-state.js   # 캠페인 진행 및 보상/세이브 상태 머신
├── sw.js               # PWA 서비스 워커 (오프라인 미디어 캐싱)
├── assets/             # 오디오, 이미지, 비디오 및 미디어 매니페스트
├── docs/               # 상세 게임 디자인 및 아키텍처 문서
└── tests/              # 단위 및 통합 테스트 스위트
```

## 🚀 실행 및 테스트

### 로컬 실행
```bash
python3 -m http.server 8000
```
브라우저에서 `http://localhost:8000` 접속

### 테스트 실행
```bash
# 핵심 규칙 및 현재 3단계 캠페인 상태 머신
node --test tests/game-core.test.mjs tests/campaign-state.test.mjs
#
# UI 기반 3단계 종단 간 검증 (Node 환경에서 `playwright` 모듈을 해석할 수 있어야 함)
node tests/playtest-browser-3stage.cjs
```
