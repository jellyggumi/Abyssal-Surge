# Balance sheet v1 — Stage 1 design values

**Navigation:** [production contract](../production/production-contract.md) · [core loop](core-loop.md) · [Stage 2 handoff](../production/handoffs/stage-2.md)

## Status and source boundary

The values below are **decisions**, not observed balance results. They exist so implementation and later G2 simulation share one versioned source. No win-rate, TTK, or EV pass is asserted.

## Hard invariants

| Rule | Value | Verification owner |
|---|---:|---|
| Slot cap clamp | integer min **10**, max **100** | Engineering / G2 |
| Stage 1 starting capacity | 10 | Design |
| Soul-pool lifetime | 10 s after eligible Ash Echo defeat | QA |
| Arise target window | one active pool at a time | Engineering |
| Cinder Span target loop | 75 s | QA/G7 |
| Valid loop band | 30–180 s | QA/G7 |
| Stage 1 guardian shield | opens only after Sable Relay capture | QA |
| Rewards per completed stage | exactly 2 offered; exactly 1 selected | Engineering/QA |

## Original unit slot table

| Unit | Slots | Intended role | Stage 1 availability |
|---|---:|---|---|
| Shade | 1 | fast flank and pool reach | yes |
| Bulwark | 5 | guard/capture hold | yes |
| Riftblade | 10 | guardian shield break | yes, reward-gated |

`effective_capacity = clamp(floor(10 + relay_bonus + selected_reward_bonus), 10, 100)`. Stage 1 uses `relay_bonus = 2`; rewards may add **0 or 2**, never exceed the clamp.

## Stage 1 reward pair

| Reward ID | Effect | Exclusive with |
|---|---|---|
| `cinder-march` | Shades gain a one-time 15% capture-speed bonus next stage | `relay-ward` |
| `relay-ward` | Start Stage 2 with +2 capacity, still clamped 10–100 | `cinder-march` |

## Required Stage 2 numbers before G2/G5

TTK target, combat formula, per-role stats, cooldown/cost schedule, tech-node curve, possession duration, Domain cooldown/cost, reversal probability, five archetypes, and paid/free comparison cohorts are intentionally **unresolved**. [Stage 2 handoff](../production/handoffs/stage-2.md) makes them blocking deliverables.