# Defense-survival gameplay contract

## Player loop

1. Move through the full-bleed field while basic attacks and companions auto-target.
2. Defeat waves to collect XP and trigger a deterministic three-choice growth offer.
3. Defeat the stage elite, then use the bounded extraction window to bind its companion permanently.
4. Collect the stage item drop; the item modifies the current run only.
5. Survive until the authored boss gate, defeat the boss, choose one stage reward, and unlock the next stage.
6. The final-stage reward completes the campaign and records a stage-clear achievement.

## State ownership

- `defense-run-simulation.js` owns ticks, enemies, item effects, growth, elite extraction, terminal outcomes, and event ordering.
- `campaign-state.js` owns persistent companions, reward collection, and stage-clear achievements.
- `app.js` owns input, presentation overlays, reward selection UI, audio lifecycle, and persistence calls.
- Renderers remain passive snapshot adapters; they never mutate campaign or run state.

## Items and rewards

- Elite defeats drop one deterministic item per stage; collection emits `ITEM_COLLECTED`.
- Item effects are explicit numeric deltas: damage, max integrity, pickup range, or cooldown reduction.
- Boss victory exposes three authored reward IDs; selecting a reward records it once in campaign storage.
- Missing reward selection in legacy callers defaults to the first authored reward to preserve API compatibility.

## Progress and quality signals

Every snapshot exposes elapsed seconds, defeated count, extracted elite count, items collected, skills learned, and achievement IDs. Cutscene/audio cues consume events but cannot affect outcomes. Reduced-motion mode retains text, status, and reward semantics while removing decorative animation.
