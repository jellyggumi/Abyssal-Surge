# Game Production Coordination Brief

## Scope
- **Game / build stage:** concept → first playable vertical slice. *Abyssal Surge* is an original, asynchronous real-time tactical survival/territory game: the player descends into an abyssal breach, extracts a core, and returns before the surge consumes the zone.
- **Engine / platform context:** web first (desktop browser), then mobile web/PWA. One shared account, input model, economy, and deterministic combat simulation; desktop uses mouse/keyboard and mobile uses tap/hold command groups.
- **Team shape:** solo developer (assumed from the current repository).
- **Next public beat:** internal playable in six weeks, inferred because there is no current build or announced release beat.
- **Confidence:** medium. The source pages establish the reference qualities, not a production-ready feature list.

## Primary mode
- **concept-to-milestone**

## What matters most now
- The desired fantasy is not “be strong immediately”; it is an **earned, legible ascent from fragile survivor to singular commander**. The Solo Leveling reference establishes a lone weak hunter receiving a system, daily/urgent quests, boss gates, class transition, and a later shadow-army scale. Abyssal Surge must preserve the *shape* of that escalation while using original setting, names, art, characters, and narrative.
- The Littlewargame reference supports a readable RTS backbone: gather resources, build production/tech structures, field a small countered army, and claim map space. Its browser-first clarity is more valuable than copying its unit list or balance values.
- Web/mobile parity makes input complexity the main constraint. A many-hotkey, high-APM RTS is out of scope; tactical pauses, command presets, and compact squad control are required from the first slice.
- The vertical slice must prove one repeatable growth loop before adding multiplayer, procedural story chapters, a large tech tree, or broad unit variety.

## Recommended next artifact
- **milestone-brief:** “The First Surge” vertical slice: a 10–15 minute solo run where an underpowered diver clears one breach, earns a visible rank increase, unlocks one command ability, and defeats an extraction boss.

## Priority decisions
| Decision | Why now | Owner | Risk if delayed |
|---|---|---|---|
| Lock the growth curve | It governs combat numbers, rewards, UI, and enemy pacing. | Design/engineering | Random upgrades will feel flat rather than transformative. |
| Select one core combat grammar | The slice needs either direct hero control plus squads or pure squad command, not both. | Design | Mobile controls and AI become unstable. |
| Define the 15-minute slice | A fixed start, midpoint power spike, and boss makes playtesting meaningful. | Solo developer | Content expands before the core loop is validated. |
| Establish browser/mobile control parity | Controls must be tested on touch before interfaces harden. | Engineering/UX | Desktop-only conventions cause a costly mobile rewrite. |

## Immediate next steps
1. Implement the slice loop: **scavenge essence → choose one of three system directives → defeat a guarded node → extract or press deeper**. Failure retains account knowledge/unlocks but loses run resources; success grants rank XP and a permanent command-slot upgrade.
2. Author a five-rung power curve with explicit before/after behavior: **Rung 0 Scavenger** (one diver, evade), **Rung 1 Awakened** (one active ability), **Rung 2 Binder** (one summoned/converted ally), **Rung 3 Warden** (three-unit squad and area command), **Rung 4 Sovereign** (temporary elite army surge). Each rung must add a new decision, not only damage.
3. Build one enemy ecosystem—swarm, armored sentinel, ranged disruptor, and breach guardian—with simple counters. Use a visible threat meter so escalating power is matched by escalating danger.
4. Run ten desktop and ten mobile internal sessions. Acceptance checks: a new player reaches Rung 2 within six minutes, recognizes the Rung 2 power change without explanation, completes one boss attempt, and can issue every required command with no hidden gesture.

## Specialist handoffs
- **Skill:** task-planning  
  **Why:** Turn the locked “First Surge” milestone into a two-week engineering/design backlog only after the control grammar and five-rung curve are approved.  
  **What packet to pass:** this brief, the selected combat grammar, a wireframe of desktop/mobile commands, and numeric targets for each rung.
- **Skill:** game-demo-feedback-triage  
  **Why:** After the internal playable, determine whether players feel an earned ascent versus a stats-only ramp.  
  **What packet to pass:** session recordings, rung timestamps, death/extraction outcomes, and verbatim player answers to “when did you feel powerful?”

## What not to do yet
- Do not use Solo Leveling characters, terminology, plot events, visual designs, or its “shadow” identity; retain only the high-level progression principle in an original abyssal-fiction frame.
- Do not build ranked PvP, guilds, a map editor, or a full RTS building tree before the First Surge loop meets the playtest checks.
- Do not equate mobile support with a reduced desktop UI; both targets need the same strategic choices through different affordances.

## Research basis
- [[research/sources/solo-leveling.html]] — fetched source page; progression reference: unique system access, quests, bosses, job transition, and later army-scale escalation.
- [[research/sources/littlewargame.html]] — fetched source page; RTS reference: browser-delivered resource, building, unit-production, and counterplay loop.
- [[research/sources/link-manifest.json]] — parsed manifest of every unique direct-page link (241 from the Solo Leveling page; 55 from the littlewargame page). It is an index for bounded follow-up research, not an endorsement of linked claims.

## Cycle 005 — RTS keyboard+mouse detail integration (2026-07-16)
- **Confirmed direction (project owner, recorded in C004-D-024 → executed as C005-D-001):** Abyssal Surge is a real-time strategy game operated with keyboard AND mouse, shipped web-first then packaged to APK. Run folder: `_workspace/20260716-stage5-rts-detail-cycle-005-v1/`.
- **Controls (DET-RTS):** keyboard `s`/`b`/`d`/`r` shortcuts stay with visible `<kbd>` hints on all 5 stages; mouse keeps pointer-first command buttons and gains a NEW battlefield lane click that issues a contextual STRIKE whose spawn x-origin follows the click position (clamped 0–20%). Both input paths route through the single deterministic `recordCommand()` pipeline — no second command path. No drag selection this cycle.
- **Stage differentiation (DET-STAGE):** per-stage real-time presets in `app.js` only (semantic core `game-core.js` untouched) — foeAttackCooldown 3.5/3.2/3.0/2.8/2.5s and unit speed 33.3/33.3/36/36/40 %/s for stages 1–5 (Immediate Pressure / Continuing Obligation / Boundless Consequence / Competing Responsibility / Accountable Stewardship). Balance guard: the adaptive scripted driver must still clear all 5 stages.
- **Resources (DET-RES):** two `gti`-generated concept-style unit sprites (`assets/images/unit_strike.png`, `unit_brace.png`, ≤256px, dark-fantasy oil-painting theme) wired into `spawnUnit()` with SVG fallback; existing 16 ElevenLabs audio assets reused, no new API spend.
- **Narrative (DET-NARR):** typing animation stays ≤45ms/char and click-skippable; stage-intro narration (`narr_intro_1..5.mp3`) regression-checked; backdrop cross-fade kept, no new video assets.
- **QA gate (DET-QA):** Playwright-only playtests (vertical slice, 5-stage E2E, browser playtest incl. a lane-click spawn assertion), refreshed screenshot evidence, and a validated `retrospectives/cycle-005-p3-detail-v1.json`. QA holds stop-ship veto; all DET-QA items must PASS before push to `main`.
- **Knowledge ops (DET-DOC):** direction and tempo tables recorded in llm-wiki at `wiki/reports/2026-07-16-abyssal-surge-rts-kbm-direction.md` (index updated) plus this section.
