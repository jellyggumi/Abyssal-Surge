# Abyssal Surge defense-survival expansion — intake brief

- **game_type:** mobile-first single-player defense-survivor campaign
- **team_shape:** 13-role production studio (5 canonical roles + 8 specialist lanes; nearest whole-team approximation to 2.5×)
- **engine:** static browser/PWA, deterministic 60 Hz JavaScript rules, Canvas snapshot adapters
- **current_stage:** shipped 10-stage defense-survivor baseline; expansion slice is Stage 1 → Stage 10 compatible
- **next_public_beat:** playable defense-survival run with persistent elite extraction, item pickup, growth choices, stage rewards, cutscene overlays, procedural audio, and textured 2.5D actor motion
- **source_packet:** live repository + llm-wiki canonical gameplay review, hybrid design, mesh telemetry, and resource bible
- **main_constraint:** preserve Abyssal Surge canon and offline deterministic save contract; generated media must never become a runtime dependency
- **main_question:** can the existing automatic-combat survivor loop become a readable long-term defense campaign without introducing a second rules authority?

## Canon that remains fixed

Dusk Warden contains lunar-fracture Echo Deep matter for the Moonless Court. The player loop remains hunt → extract → materialize → capture → assault; Stage 2 adds possession and Stage 3 adds one-use Domain in the canonical reading. Current shipped source has ten stages and is authoritative for stage names, bosses, and deterministic rules.

## Scope decision

This cycle adds item drops, persistent stage rewards/achievements, explicit progress telemetry, cutscene copy, synthesized SFX/BGM, and GTI-derived isolated 2.5D sprite frames. It does not add network play, accounts, commerce, or a second realtime simulation.
