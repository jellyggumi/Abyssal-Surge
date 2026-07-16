# Abyssal Surge concept — original-only

**Navigation:** [production contract](../production/production-contract.md) · [worldview](worldview.md) · [core loop](core-loop.md)

## Player promise
Command a compact shadow legion while personally crossing a fractured abyssal city. Each victory creates a brief extraction opportunity; converting it into a unit changes the next tactical decision immediately.

## Observed facts

- Comparable compact strategy games use a readable resource → deployment → map-control → boss/reward cadence; this is documented in [QA benchmark notes](../qa/benchmark-notes.md).
- The source research recommends a small pre-stage loadout rather than a full tech tree before the three-stage chain is proven.

## Decisions

- The game’s original setting is **Abyssal Surge**: the Moonless Court seals fractures between the human coast and the Echo Deep.
- The player is the **Dusk Warden**, not an adaptation of any external protagonist.
- Original roles: **Shade** (1 slot, fast skirmisher), **Bulwark** (5 slots, guard), **Riftblade** (10 slots, elite breaker). All names, silhouettes, dialogue, VFX, and lore must remain original.
- The campaign is a deterministic three-stage single-player chain. A reward is chosen once per completed stage from two mutually exclusive options.

## Stage 1 beat: Cinder Span

1. Locate and defeat three Ash Echoes.
2. Target the resulting soul pool before its 10-second expiry.
3. Invoke **Arise** to materialize a unit if capacity exists.
4. Capture the Sable Relay to unlock Guardian access.
5. Break the Rift Guardian’s shield and defeat it.

The completion state carries `stage1_reward_id` into Stage 2. Failure preserves the valid campaign snapshot and exposes retry; it never silently overwrites a prior reward.

## Non-goals

- No copied third-party IP, naming, or plot.
- No PvP, social graph, account economy, payment surface, or fully modeled tech tree in Stage 1.
- No claim that a design target is a player-tested outcome.

## Stage 2–3 continuation

- **Veil Citadel:** possession becomes a bounded tactical action; two nodes must be held concurrently before the tactical boss is vulnerable.
- **Echo Throne:** Lord’s Domain is a capped emergency action with cooldown/cost limits defined before G2/G5 evaluation; the Gate Sovereign closes the campaign.

## Gate use

This concept is the trace source for G1. Any proposed player-visible addition must be added to [worldview inventory](worldview.md) before implementation.