# Core loop contract

**Navigation:** [production contract](../production/production-contract.md) · [balance sheet](balance-sheet.md) · [G7 review](../production/gate-reviews/stage-1-g7.md)

## G7 rule and Stage 1 target

**Gate threshold:** at least one numeric loop with a 30–180 second period, ≥3 actions, ≥1 reward event, and voluntary repeat-rate proxy ≥70%. **Decision:** Stage 1 models a **75-second** target loop. **Observed:** no playtest has measured it yet; repeat rate is `not-run`.

## Cinder Span loop

| Target time | Player action | Deterministic transition | Feedback/reward |
|---:|---|---|---|
| 0–15 s | move/target an Ash Echo | eligible enemy defeated | soul pool spawns with 10 s expiry |
| 15–25 s | invoke Arise on pool | capacity checked, then pool consumed or expires | one Shadow unit materializes or an accessible failure message appears |
| 25–55 s | deploy/order legion to Sable Relay | capture progress rises only while friendly presence holds | relay grants +2 capacity and unlocks guardian shield break |
| 55–75 s | focus/break Rift Guardian | guardian defeated after shield state opens | completion, two-reward offer, one persisted choice |

### Required semantic actions

`move`, `target`, `arise`, `deploy`, `capture`, `select_reward`, `retry`, `save`, `load`, `export`, and `import` are the public action vocabulary. Keyboard and touch mappings must invoke the same action names; no control scheme may bypass a state transition.

### State-machine boundaries

`HUNT → POOL_ACTIVE → MATERIALIZE_OR_EXPIRE → RELAY_CONTEST → GUARDIAN_OPEN → REWARD_CHOICE → STAGE_2_READY`

- `POOL_ACTIVE` expires exactly once after 10 seconds.
- `MATERIALIZE` rejects a full capacity without consuming the pool; the player may free capacity or wait for expiry.
- `REWARD_CHOICE` rejects zero or multiple selections.
- Stage completion writes a versioned campaign snapshot before Stage 2 becomes playable.

## Stage chain

| Stage | Carry input | New tactic | Exit |
|---|---|---|---|
| 1 Cinder Span | new campaign | extraction + capture | `stage1_reward_id` |
| 2 Veil Citadel | Stage 1 reward | possession; hold two nodes | `stage2_reward_id` |
| 3 Echo Throne | Stage 2 reward | bounded Lord’s Domain | Gate Sovereign defeated |

## G7 evidence procedure

QA records 10 voluntary repeats from a stable build: loop duration, actions completed, reward reached, and repeat/stop choice. Pass requires median duration 30–180 s and repeat proxy ≥70%; otherwise the director marks `FIX` or `REDO` in the linked review.