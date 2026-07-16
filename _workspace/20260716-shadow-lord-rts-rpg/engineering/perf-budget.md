# Performance budget — measured (G6 input)

**Navigation:** [gate ledger](../qa/gate-measurements.md) · [architecture contract](architecture-contract.md)

측정: headless Chromium (M2 Pro), 라이브 배포 https://jellyggumi.github.io/Abyssal-Surge/ · 2026-07-16 · rules v2.

## Frame/입력 예산

| Budget | Threshold | Measured | Method | Verdict |
|---|---:|---:|---|---|
| Frame p50 | — | **8.3 ms** | rAF 300-frame sampling on live site (aurora+particles active) | — |
| Frame p95 | ≤16.7 ms | **9.2 ms** | 동일 | **PASS (여유 45%)** |
| Frame p99 | — | 9.3 ms | 동일 | — |
| Long frames >50 ms | <0.5% | **0 / 300 (0%)** | 동일 | **PASS** |
| JS heap | 안정 | **3.1 MB** | performance.memory 스냅샷 | PASS (규모 대비 극소) |
| Input-to-feedback | ≤100 ms | UI는 클릭 핸들러 → 동기 상태 전이 → 동기 render (rAF 1프레임 내 반영, 위 p95 9.2 ms) | 코드 경로 검토 + 프레임 측정 | PASS (구조적 보장) |

## 전송/캐시

- 재방문 로드: 서비스 워커 v2 캐시 히트 — transferSize 0 KB (전 리소스 로컬 캐시 서빙 확인).
- 콜드 로드 대략치: core 5파일 + 스프라이트 16 (0.9 MB) + 스토리보드 5 (0.6 MB) + 오디오 14 (0.5 MB) + 비디오 lazy.
- 오디오/비디오는 `preload="none"`/`preload="metadata"` — 재생 시점 로드.

## 이동동선 (movement-path) 노트

DOM 커맨드 게임에서의 동선 최적화는 포인터/시선 이동 거리:
- 7 액션 버튼이 단일 command-grid에 군집 (모바일 2열 → 데스크톱 4열), 진행 순서(hunt→extract→materialize→capture→…)와 DOM 순서 일치 — 다음 유효 액션이 항상 인접.
- 키보드 단축키(H/E/M/C/P/D/A)로 포인터 이동 0 경로 제공.
- 상태 패널(자원/보스)과 커맨드 패널이 세로 인접 — 시선 왕복 최소화.
- 비활성 버튼은 disabled+아이콘 grayscale로 즉시 구분 — 오클릭 방지.

## 회귀 절차

배포 후 이 문서의 rAF 샘플링 스니펫을 헤드리스로 재실행, p95 >16.7 ms 또는 롱프레임 >0.5% 시 G6 FAIL로 기록하고 최근 시각효과 커밋부터 이등분 탐색.
