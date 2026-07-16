# Triage

- Problem: RTS-형 거시 조작 피로(채집/보급/마이크로)와 RPG-형 미시 몰입(영웅 성장/빌드) 간 단절을 동시에 해결하는 게임 아키텍처가 필요하다. '그림자 군주'는 전투 산출물을 곧바로 병력/성장으로 환산하는 구조로 해당 단절을 줄이는지 판단한다.
- Audience: 게임 기획팀(시스템/밸런스), 기획-개발 전환 단계에서 작업량/범위를 줄이길 원하는 PM, RTS 또는 RPG 핵심 유저층(캐주얼 진입층 포함).
- Why now: 현재 Abyssal Surge의 구현은 5단계 전투 루프 중심이므로, 이 설계를 바로 실험 가능한 **하이브리드 수직 슬라이스**로 확장하기 위한 설계-실행 경계를 명확히 해야 한다. 시장/유사장르 비교는 초기 범위 과부하를 줄이는 데 즉시 필요하다.

## Survey mode

```yaml
survey_run:
  primary_mode: market-landscape
  scope: medium
  evidence_floor: indexed-snippets-allowed
  output_language: user-language
  needs_platform_map: false
  reuse_existing: true
```
