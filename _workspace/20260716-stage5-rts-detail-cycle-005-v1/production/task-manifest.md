---
run_id: 20260716-stage5-rts-detail-cycle-005-v1
owner: game-production-director
created_at: 2026-07-16T05:33:00Z
artifact_version: v1
immutable: true
append_only: true
status: ready
decision_ids: [C005-D-001]
input_artifacts:
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260716-stage5-rts-detail-cycle-005-v1/intake/production-brief.md
---
# Task manifest v1 — Cycle 005 per-detail directives

C005-D-001 issues the following detail directives. Each directive is independently verifiable; QA (DET-QA) retains stop-ship veto over the whole set.

## DET-RTS — RTS control detail (keyboard + mouse)

1. Keyboard: existing s/b/d/r shortcuts stay; add visible `<kbd>` hints already present — verify they render on all 5 stages.
2. Mouse: battlefield lane click issues a contextual STRIKE command at clicked lane position (unit spawn x-origin follows click %, clamped 0–20%); command buttons remain pointer-first. No drag selection this cycle.
3. Both input paths MUST route through the same `recordCommand()` deterministic pipeline — no second command path.

## DET-STAGE — Stage 1–5 differentiation

1. Per-stage real-time presets in `app.js` (semantic core untouched):
   - Stage 1: foeAttackCooldown 3.5s, unit speed 33.3%/s (baseline, tutorial pacing)
   - Stage 2: 3.2s, 33.3 — pressure introduction
   - Stage 3: 3.0s, 36.0 — mid-campaign tempo rise
   - Stage 4: 2.8s, 36.0 — competing-responsibility stress
   - Stage 5: 2.5s, 40.0 — accountable-stewardship finale
2. Stage identity surfaces: per-stage backdrop (shipped), stage title (shipped), and per-stage Foe intent tempo above.
3. Balance guard: browser playtest MUST still clear all 5 stages with the adaptive scripted driver.

## DET-RES — Resource generation (god-tibo-imagen harness flow)

1. Unit sprites: generate 2 concept-style (non-pixel, PerfectPixel methodology adapted) sprite images via `gti` — `assets/images/unit_strike.png` (crimson knight vanguard, side view, marching) and `assets/images/unit_brace.png` (azure iron bulwark, shield up). Transparent or dark background, ≤256px, theme: dark fantasy oil-painting.
2. Wire sprites into `spawnUnit()` replacing inline SVG silhouettes; keep SVG as fallback on load error.
3. Audio: reuse existing 16 ElevenLabs assets; no new API spend unless a sprite-spawn SFX gap is found (existing `strike.mp3`/`brace.mp3` cover it).

## DET-NARR — Narrative & scene transition polish

1. Typing animation (shipped in terminal narration) MUST remain ≤45ms/char and skippable by click.
2. Stage-intro narration audio (`narr_intro_1..5.mp3`) plays on stage entry; verify no ERR_ABORTED regressions after service-worker reload (known prior flake).
3. Scene transitions keep the backdrop cross-fade; no new video assets this cycle (vox-director deferred — compression budget review first).

## DET-QA — Verification (Playwright-only playtests)

1. `node tests/stage1-vertical-slice.test.mjs` and `node tests/playtest-5-stages.test.mjs` PASS.
2. `NODE_PATH=$(npm root -g) node tests/playtest-browser.cjs` PASS including avatar-load asserts and settlement summary.
3. Mouse-path E2E: extend browser playtest with at least one lane-click spawn assertion.
4. Visual evidence: refresh `tests/playtest_walk_mid.png` + mobile variant via `tests/capture-live.cjs`.
5. Retrospective: write `retrospectives/cycle-005-p3-detail-v1.json` conforming to `scripts/validate-cycle-retrospective.py` (pydantic v2) and validate it.

## DET-DOC — Documentation integration (llm-wiki)

1. Write wiki report `wiki/reports/2026-07-16-abyssal-surge-rts-kbm-direction.md` in `~/vaults/llm-wiki/`: RTS keyboard+mouse identity, per-stage tempo table, cycle-005 scope, evidence links.
2. Update wiki index queries section per vault conventions (obsidian-cli preferred, direct write fallback).
3. Record the direction in repo docs: `docs/game-production-coordination-brief.md` gains a cycle-005 section (append-only).

## Ownership

- game-engineering-lead: DET-RTS, DET-STAGE, DET-RES(wiring), DET-NARR
- resource-pipeline-lead: DET-RES(generation)
- adversarial-qa-lead: DET-QA (stop-ship veto)
- knowledge-ops-lead: DET-DOC

QA `FAIL` blocks commit of the affected surface. Operations release gate: all DET-QA items PASS before push to `main`.
