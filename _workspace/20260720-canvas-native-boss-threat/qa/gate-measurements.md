# Gate Measurements — 20260720-canvas-native-boss-threat

Measured by: focused automated tests, this packet only. Full G2/G3/G5/G8
adversarial-playtest gates are NOT claimed here — see production-brief §4.

| Gate | Claim | Measured value | Method | Evidence |
|---|---|---|---|---|
| G1 (worldview) | No lore violation introduced | 0 | boss-strike reuses existing worldview-neutral breach/counter vocabulary; no new proper nouns invented | `campaign-state.js` boss-strike branch |
| G6-ops (perf/regression) | Full existing suite stays green after the change | 463/463 pass, 0 fail | `node --test tests/*.test.mjs` | command run 2026-07-20, this session; raw TAP output captured in session transcript |
| G7 (core loop, partial) | boss-strike is a new ≥1-action loop element (approach → take/avoid damage → retreat/engage) | period ≈ cooldownSeconds (5–7s per stage), reward/punish event every cycle | data: `campaign-state.js` STAGES[*].bossPattern | not yet playtest-confirmed (no human/simulated repeat-rate session run in this packet) — FIX/NOT RUN for the repeat-rate proxy |
| New unit coverage | boss-strike reducer behavior | 6/6 new tests pass | `node --test tests/boss-strike.test.mjs` | `tests/boss-strike.test.mjs` |
| Regression: renderer texture-load contract | deck ground now requests 2 additional shared PBR loads (albedo+normal) alongside the 1 stage backdrop | 3 total, asserted by URL and colorSpace | `node --test tests/battle-realtime-three.test.mjs` (tests 1–2 updated) | diff to `tests/battle-realtime-three.test.mjs` |
| G2 (win-rate, farming cap) | Extraction cap (14/stage) does not break campaign completability | `optimal` and `greedy-economy` archetypes: 100% win rate, all 10 stages, `determinismDoubleRunIdentical: true` | `node scripts/run-campaign-balance-sim.mjs` | full JSON output captured in session transcript, 2026-07-20 |
| Exploit fuzzing | Farming-cap change introduces no new reachable exploit | 150,000 fuzzed ops, 26,683 accepted, `findings: []`, `findingsTotal: 0` | `node scripts/run-campaign-balance-sim.mjs` (`fuzz` section) | same run as above |
| New unit coverage | farming-cap reducer behavior (cap enforcement, capture/wave/terrain refunds, per-stage reset) | 4/4 new tests pass | `node --test tests/farming-cap.test.mjs` | `tests/farming-cap.test.mjs` |
| G6-ops (perf/regression, farming cap) | Full suite stays green after the farming-cap change | 467/467 pass, 0 fail | `node --test tests/*.test.mjs` | command run 2026-07-20, this session |

## Explicit NOT RUN

- G2 (win-rate/TTK bands with boss-strike damage folded in) — no adversarial archetype rotation was run against the new passive boss pressure; existing counter/assault balance numbers were deliberately left untouched, but the *net* difficulty change from boss-strike has not been measured against the 45–55% win-rate band.
- G3 (archetype diversity) — not evaluated against boss-strike.
- G5 (revenue/reward parity) — no monetization surface touched.
- G8 (novelty) — boss-strike / threat-ring is a plausible novelty candidate but has not been scored against the survey corpus in this packet.
