# Task Manifest — Cycle 2 (Progression-Aware Stage 1-10 Resource Validation)

run-id: `20260723-solo-warden-rpg-concept` · cycle: 2 · worktree: `../Abyssal-Surge-cycle2` (branch `cycle2-stage-progression`, isolated per Cycle 1's retrospective lesson)

| task | owner | stage.phase | artifact | gate | status | beat |
|---|---|---|---|---|---|---|
| 프로그레션 인지 시뮬레이션 하네스 구축 | director (impl) | Stage1 | `scripts/run-g2-progression-sweep.mjs` | G2 input | in_progress | 10스테이지 실제 검증 가능 |
| 10스테이지 전체 TTK 실측 | director (impl, via harness) | Stage1 | `qa/gate-measurements.md#g2-progression` | G2 | pending | TTK 밴드 준수 확인 |
| 특성언락/저지선면역 경계 검증 | director (impl) | Stage1 | `qa/gate-measurements.md#g2-progression` | G2 | pending | 경계값 정합 확인 |
| 전체 기존 테스트 스위트 회귀 확인 | QA subagent | Stage2 | `node --test` 출력 | 전체 | pending | 회귀 없음 확인 |
| G2 win_rate_band 장르 오버라이드 결정 | Designer subagent | Stage2 | `design/balance-sheet.md#band-overrides` | G2 | pending | Cycle1 stage2-review FIX 항목 해소 |
| 보상밴드 자원곡선 재검증 | PM subagent | Stage2 | `pm/reward-bands.md` | G5 | pending | comeback/steady/fairness 정합 |
| 성장패널 접근성 10스테이지 재확인 | UI subagent | Stage3 | `ui/accessibility-audit.md` | G4 | pending | 전체 스테이지 상태 커버 |
| TTK 드리프트 리튠 (조건부) | director (impl) | Stage2 | `defense-catalog.js`/`rpg-catalog.js` | G2 | pending | 측정 결과에 따라 결정 |
| 10스테이지 아크 성능/메모리 회귀 | director (impl) | Stage3 | perf test 출력 | G6 | pending | 배포 준비 |
| 커밋+푸시+Pages 확인 | director (impl) | Stage3 | git log, Pages 응답 | — | pending | 배포 |
| Stage3 gate review + retrospective | director | Stage3 | `retrospectives/cycle-2-retrospective.md` | G4/G6/G1 final | pending | 사이클 종료 |

## Note on tripled-role fan-out this cycle

The core progression-harness is built by the director directly (single coherent artifact — Cycle 1's retrospective specifically flagged that parallel writes to one shared engineering file, even well-intentioned, produce collision risk this project can't currently afford without per-agent isolated worktrees per file, which is overkill for one script). The tripled-role spirit is honored via 4 genuinely independent, non-overlapping subagent lanes running in parallel with the harness build: full-suite regression, G2 band-override decision, PM reward-band re-check, UI accessibility re-check — each owns a distinct file, zero overlap, isolated worktree removes external-workstream collision risk entirely.
