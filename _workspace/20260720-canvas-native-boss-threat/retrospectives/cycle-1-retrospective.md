# Cycle 1 Retrospective — 20260720-canvas-native-boss-threat

## What shipped (verified)
- Every stage boss now auto-attacks ("boss-strike") anyone lingering inside its
  declared `bossPattern.triggerRange`, independent of player commands,
  possession, exposure, or wave state — closing the "커맨드가 직접 타격을 줄
  수 없어야" / "특정 범위 자동공격" gap. 10/10 stages carry typed data
  (melee/ranged/aoe), verified by `tests/boss-strike.test.mjs`.
- A visible danger ring communicates the boss's threat range and brightens as
  its cooldown empties — a direct, player-facing readability improvement, not
  just a code comment.
- The shared battlefield deck (every walkable tile, every stage) now carries a
  real void-obsidian PBR albedo+normal texture instead of a flat tint, per the
  faction/material language already specified in
  `_workspace/20260718-resource-refinement/design/presentation-spec.md` but
  never wired into the live renderer.
- Full existing regression suite (463 tests) stays green; 2 tests were
  legitimately updated (not weakened) to assert the 2 new texture-load
  requests by URL/colorSpace instead of asserting only the old count.

## What was NOT touched, and why
- The unlimited-Hunt farming loop's numeric caps were left alone. Changing
  `souls`/`hunted` yield formulas risks the exact-value assertions already
  covering the 10-stage balance and `run-campaign-balance-sim.mjs`; a
  responsible cap requires the QA exploit-hunt → designer retune → PM
  reward-band pass this session did not run.
- Stage pacing (~5 minutes, full skill/strategy system) is unchanged; current
  wave schedules top out at 58–74s of scripted spawns plus prep time.

## Next-cycle entry decision
Enter Stage 2 (retune) of a **new** cycle, not Stage 1 concept shift: the
boss-strike mechanic and deck texture are structurally sound and tested: the
remaining work is QA adversarial measurement (does boss-strike push any
matchup outside 45–55% win rate?) and a designer/PM pass on farming caps and
stage-length pacing. Do not re-litigate the canvas-required engagement model —
it was already correct in the existing `getCommandReadiness`/"out-of-range"
architecture and this cycle only completed the boss's half of it.
