# Production Task Manifest — 20260722 defense-survival expansion

| role | owner | lane | artifact | gate | status |
|---|---|---|---|---|---|
| director | game-production-director | intake/arbitration | `intake/production-brief.md` | G1/G6 | complete |
| designer | game-designer | canon/balance | `design/gameplay-contract.md` | G1/G2/G7 | complete |
| pm | game-pm | reward economy | `design/reward-bands.md` | G2/G5 | pending |
| programmer | game-programmer | deterministic engine | source + tests | G2/G6 | in progress |
| qa | game-qa | regression/gates | `qa/` | G1–G8 | pending |
| systems designer | gameplay-systems-designer | item/growth/reward tables | `design/systems-table.md` | G2/G7 | pending |
| narrative director | narrative-cinematics-director | canon cutscene beats | `design/cutscene-beats.md` | G1/G8 | pending |
| technical artist | technical-artist-2d5d | texture atlas/matte contract | `design/media-pipeline.md` | G4/G6 | in progress |
| animation rigger | animation-rigger | frame timing/pivot validation | `qa/animation-ledger.json` | G4 | pending |
| audio designer | audio-designer | SFX/BGM cue map | `assets/audio/defense-audio-manifest.json` | G4/G6 | in progress |
| VFX designer | vfx-designer | reduced-motion-safe effects | source + `design/vfx-contract.md` | G4 | pending |
| release engineer | release-build-engineer | Pages artifact/release receipt | `ops/release-readiness.md` | G6 | pending |
| playtest researcher | playtest-researcher | browser play/video evidence | `qa/playtest-report.md` | G7/G8 | pending |

## Stage policy

- **Stage 1:** freeze canon, implement item/reward contracts, wire passive textured presentation and audio.
- **Stage 2:** run deterministic balance and regression checks, then tune only catalog constants.
- **Stage 3:** run browser smoke, build the Pages artifact, capture a local playable video, and report any unpassed gate explicitly.

A gate is PASS only with a command, file, or browser evidence path. Blender timeout and missing external audio/video credentials remain explicit blockers, not silent passes.
