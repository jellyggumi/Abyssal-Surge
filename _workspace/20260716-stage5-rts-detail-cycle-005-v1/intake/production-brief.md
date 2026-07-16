---
run_id: 20260716-stage5-rts-detail-cycle-005-v1
owner: game-production-director
created_at: 2026-07-16T05:32:00Z
immutable: true
status: frozen
predecessor_run: 20260715-stage1-cycle-004-v1
external_approval: user mandate 2026-07-16 (project owner, verbatim in chat) — RTS keyboard+mouse confirmation, per-detail directives, Stage 5 completion
baseline_pin:
  app_js_sha256: 17a3b8ccdaa7ef6f34254a7ab08d13f6c08504f1aabfe9b942740c1f882c4fb5
  deployed_commit: fb23184
  live_url: https://jellyggumi.github.io/Abyssal-Surge/
---
# Production brief — Cycle 005 (Stage 5 RTS detail integration)

## Product identity (user-confirmed)

Abyssal Surge is a **real-time strategy (RTS) game** for web (GitHub Pages) and later APK port, operated with **keyboard AND mouse**. 2.5D dark-fantasy stewardship theme. Free, no-P2W, no accounts; browser-local persistence.

## Confirmed shipped baseline

- 5 stages playable E2E (deterministic semantic core `game-core.js` + real-time RTS layer `app.js`).
- RTS surface: battlefield lane, unit spawn/traverse, Foe charge bar, tactical telemetry monitor, keyboard shortcuts (s/b/d/r), pointer command buttons.
- Assets: knight/void avatars, 5 stage backdrops, lobby/victory/defeat art, 16 ElevenLabs audio files (BGM/SFX/narration).
- Tests: `tests/stage1-vertical-slice.test.mjs`, `tests/playtest-5-stages.test.mjs`, `tests/playtest-browser.cjs` (Playwright E2E), `tests/capture-live.cjs` (visual evidence).

## Cycle 005 goal

Execute the user's per-detail directives (see `production/task-manifest.md`) to deepen the RTS experience across all 5 stages without breaking the deterministic core, then verify via Playwright and record retrospectives.

## Non-goals

- No change to `game-core.js` reducer semantics (replay/settlement invariants preserved).
- No accounts, telemetry egress, monetization, or P2W surface.
- No cycle-004 record edits.
