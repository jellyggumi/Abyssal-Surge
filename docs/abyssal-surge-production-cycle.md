# Abyssal Command production cycle

## 현재 제품 범위

Abyssal Command는 정적 GitHub Pages로 제공하는 모바일 우선 싱글플레이 디펜스 서바이버 캠페인이다. 플레이어는 full-bleed Canvas에서 이동하고 기본 전투는 자동으로 진행한다. 가장자리 HUD는 전장을 가리지 않으며, 가능한 환경에서는 fullscreen과 landscape lock을 자동 요청한다. 잠금하지 못한 세로 화면은 회전 안내 없이 시계 방향 논리 가로 화면으로 표시한다.

각 런은 XP 성장 제안과 런 전용 스킬 빌드로 구성된다. 정예 적 추출은 영구 동료 진행으로 남는다. 보스 승리는 다음 스테이지로 이어지고, Stage 10 보스 승리가 캠페인을 완료한다.

## 제작·기술 원칙

- 게임 규칙은 렌더링과 분리된 결정론적 60 Hz 시뮬레이션으로 유지한다.
- 현재 배포 경로는 Canvas 2D 스냅샷 투영이며, 전장 어댑터는 규칙과 입력을 소유하지 않는다. 렌더러 오류 시 같은 스냅샷 계약의 대체 어댑터가 표시를 이어간다.
- reduced motion을 지원하고, 위험·피해·선택 정보를 움직임에만 의존하지 않게 한다.
- 저장은 오프라인 로컬 우선이며 JSON 내보내기/가져오기를 포함한다. 이 범위는 클라우드 저장, 계정, 온라인 멀티플레이, 결제, APK 배포를 약속하지 않는다.

## 문서와 운영 경계

현재 설계 계약은 [Abyssal Command 디펜스 서바이버 설계](abyssal-command-defense-survivor-design.md)에 있다. 해당 문서는 공개 연구 출처와 참고 원칙의 경계를 기록한다.

`_workspace/20260716-*` 기록은 날짜가 있는 아카이브이며 현재 문서 변환 대상이 아니다. 외부 LLM wiki의 `wiki/reports/shadow-lord-rts-rpg-hybrid-design.md`는 이 checkout에 마운트되어 있지 않으므로 업데이트했다고 주장하지 않는다. 저장소의 설계 문서는 외부 동기화 전 mirror로 유지한다.

## GitHub Pages

`.github/workflows/static.yml`은 `main` 푸시에서 정적 Pages 배포 워크플로를 실행하도록 구성되어 있다. 배포 아티팩트는 워크플로의 커밋된 allowlist 범위에서 생성된다. 이 문서는 특정 배포, 테스트, 사람 검증이 완료되었다고 주장하지 않는다.
