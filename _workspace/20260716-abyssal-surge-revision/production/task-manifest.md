# Production Task Manifest

| task | owner | stage.phase | artifact | gate | status | beat |
|---|---|---|---|---|---|---|
| Lock current source and deployment baseline | director | Stage 1 / intake | `intake/production-brief.md` | G1, G6 | complete | Correct Abyssal Surge release target |
| Survey narrative and comparable-game presentation | designer | Stage 1 / 1a | `design/trend-survey/` | G1, G8 | pending | Scenario/resource direction |
| Define world, core loop, presentation and numeric skeleton | designer | Stage 1 / 1b | `design/{concept,worldview,balance-sheet,core-loop,novelty-scorecard,presentation-spec}.md` | G1, G7, G8 | pending | Playable revision |
| Define resource, persistence and realtime boundary | programmer | Stage 1 / 1d | `engineering/architecture-contract.md` | G6 | pending | Safe future multiplayer |
| Draft narration/resource quality plan and test archetypes | QA | Stage 1 / 1a | `qa/{test-plan,benchmark-notes}.md` | G1, G4 | pending | Playwriter evidence |
| Build typed stage-reflection contract | programmer | Stage 1 / 1d | `engineering/reflection-contract.md` | G6 | pending | Process improvement |
| Build sound generation/import flow | programmer | Stage 1 / 1d | `engineering/resource-manifest.md` | G6 | pending | Importable generated sound |
| Update gameplay and presentation after specs lock | programmer | Stage 1 / 1d | source files + `engineering/resource-manifest.md` | G1, G7 | pending | Playable revision |
| Run Stage 1 smoke playtest | QA | Stage 1 / gate review | `qa/playtest-report.md` | G1, G6, G7 | pending | Stage 2 entry |

## Immutable constraints for this cycle

- The running browser is exercised through Playwriter only.
- Image resource provenance is GodTiboImagen.
- Animated UI/narration assets use concept-style non-pixel art at 16 fps, with PerfectPixel-style identity/animation validation.
- Stage evidence must include real file, command, or Playwriter session evidence; unknowns remain explicit.
