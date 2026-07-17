# Reward bands — earned progression and G5 default guardrails

**Owner:** game-pm
**Gate:** G5 (Revenue–balance synergy)
**Current verdict:** **NOT-RUN.** The release has no paid items, paid progression, shop, account, entitlement, or paid/free cohort. The values below are harness defaults and future rejection thresholds; they are not a claimed simulation result or commercial projection.

## Machine-readable G5 default block

```yaml
# G5 defaults retained for any separately approved future proposal.
# They do not make a non-existent paid flow valid or applicable to this release.
gate: G5
status: NOT-RUN
scope: "Current static browser-local release is deliberately non-monetized; all commercial projection is out of scope."
comeback:
  reversal_probability_max: 0.30
  activation_cap: "1 per Echo Throne run; earned Lord's Domain only"
  current_paths:
    - campaign-milestone-earned
  paid_path: "not implemented and prohibited for gameplay"
  required_if_commercialization_is_proposed:
    - free-milestone-path
    - no-paid-gameplay-path
steady:
  current_progression: "stage-victory reward choice; no paid shortcut exists"
  paid_shortcut: "not implemented and prohibited"
  parity_sessions_band: [10, 20]
  parity_status: "not applicable until a separate proposal defines a cosmetic-only, non-gameplay comparison; not measured"
fairness:
  paid_free_winrate_delta_max_pp: 5
  current_paid_free_delta: "not measurable: no paid cohort or paid gameplay path"
  required_paid_gameplay_delta: 0
  verification_owner: QA
  verification_status: NOT-RUN
commercial_boundary:
  paid_gameplay_power: prohibited
  browser_only_score_or_inventory_entitlements: prohibited
  allowed_future_paid_content: "cosmetic presentation only, after separate approval"
```

`required_paid_gameplay_delta: 0` is the product boundary: a paid gameplay path is rejected outright, rather than being tolerated up to the harness's general 5 percentage-point cap. The `5` percentage-point default remains recorded because the Game Studio schema requires it and because QA must reject any future proposal that breaches it; it is not permission to sell power.

## Current earned reward tracks

The campaign reward state is a single post-victory selection recorded locally. A reward is offered only when the active stage is in `reward` status; `chooseReward` validates the stage offer, stores one reward ID, then advances or completes the campaign (`campaign-state.js:408-432`). No random roll, purchase, account balance, premium currency, inventory store, or alternate paid selection is present.

| Track | Earn condition | Player-visible result | Numeric balance band / invariant | Commercial rule |
|---|---|---|---|---|
| Cinder Span doctrine | Defeat Cinder Warden; choose one of four | Ember Cohort, Rift Lens, Stillwater Hourglass, or Bulwark Brand | Exactly one choice; carries to later stages; next-stage integrity restore `+1` capped by max integrity `10` | Earned only; cannot be paid, rerolled, duplicated, or skipped |
| Veil Citadel doctrine | Defeat Veil Tactician; choose one of three | Veil Vanguard, Anchor Shard, or Abyssal Banner | Exactly one choice; carries to Echo Throne; next-stage integrity restore `+1` plus selected Anchor `+2` when applicable, capped at `10` | Earned only; cannot be paid, rerolled, duplicated, or skipped |
| Echo Throne conclusion | Defeat Gate Sovereign; choose one of two | Throne Echo or Dawnless Crown archive record | Exactly one choice; no forward combat stage and no combat modifier | Earned only; no paid archive unlock |
| Lord's Domain comeback | In Echo Throne, hold throne node and activate Domain | One recovery/defense response before the assault finish | One use per run; integrity `+4`, aegis `2`; cannot activate before Stage 3 or without node | Earned core-system action; never a paid revive, refill, or extra use |

The visible reward names and effects are traced in `campaign-state.js:37-109`; the governing constants are in `campaign-state.js:8-30`. These values are implementation facts, not a measured balance certification.

## Reward-effect limits and current balance intent

| Reward or system | Current effect | Non-commercial progression intent | Fairness constraint |
|---|---|---|---|
| Ember Cohort | Materialize gains `+2` shades beyond base `2` | Reward mastery of Cinder Span with a legion route | Never purchaseable; test against other Stage 1 doctrines under equal inputs |
| Rift Lens | Possession assault gains `+4` damage in Stage 2 onward | Reward a burst route that requires the Veil Citadel possession gate | Never unlockable before/without earned selection; never purchaseable |
| Stillwater Hourglass | `20%` cooldown reduction and auto-extract after second Hunt | Reward tempo-route execution in hunt/extract/materialize/capture loop | Never purchaseable; test that timing benefit does not bypass objective gates |
| Bulwark Brand | Counterblow reduced by `2`, minimum `1` | Reward defensive route | Never purchaseable; test counter floor and alternate doctrine viability |
| Veil Vanguard | Start Echo Throne with `4` legion | Reward final-stage setup route | Never purchaseable; still must satisfy node, Domain, and assault requirements |
| Anchor Shard | Echo Throne entry integrity `+2` | Reward recovery route | Never purchaseable; capped by max integrity `10` |
| Abyssal Banner | Entry aegis `1`, Materialize `+1`, Domain still adds `2` aegis | Reward sustained-legion route | Never purchaseable; one Domain use remains invariant |
| Throne Echo / Dawnless Crown | Campaign archive record only | Let the player close the story without a combat-power reward | Never purchaseable and never converted to a gameplay inventory benefit |
| Lord's Domain | `+4` integrity and `2` aegis once | Earned late-stage recovery, not a paid revive | Activation cap of one per Echo Throne run; reversal probability must be `<= 0.30` when QA measures it |

## G5 verification contract for a future proposal

A later cosmetic-only proposal must satisfy every item below before it can be considered. This list creates no implementation task in the current release.

1. **Boundary audit:** static analysis and runtime trace demonstrate zero reads of cosmetic ownership from gameplay reducer, campaign save, import/export, replay, score, reward selection, or action guard.
2. **Gameplay parity:** a cosmetic/default A/B run uses identical seed, input sequence, stage choices, event trace, and final state. Any state difference is a rejection; no “minor power” exception exists.
3. **G5 harness defaults:** QA measures equal-skill paid/default cohorts only if a meaningful non-gameplay cohort can be defined; paid/free win-rate delta must be at most `5` pp, and any positive gameplay advantage is independently rejected by the zero-power boundary.
4. **Comeback control:** Lord's Domain remains one earned activation per Echo Throne run and measured instant-reversal probability must be `<= 0.30`. A cosmetic may not grant an activation, modify its recovery/aegis, alter its cooldown, or appear as a post-defeat offer.
5. **Steady progression:** the `10–20` session parity default is **not applicable today** because there is no paid shortcut and no commercial progression. If a future design tries to introduce a shortcut, it is rejected as gameplay power rather than tuned into this band.
6. **Signoff:** the designer and PM add a role-signed entry to `negotiation-record.md`; QA attaches a method, command/session reference, timestamp, and observed result in `qa/gate-measurements.md#g5`. Until then, G5 remains NOT-RUN.

## Explicit non-goals

- No store UI, price, currency, checkout, subscription, advertisement reward, loot box, battle pass, premium skip, paid revive, booster, reroll, inventory purchase, or revenue forecast.
- No paid manipulation of browser-local save state, whether direct, hidden behind a cosmetic flag, or restored through import/export.
- No claim that the default thresholds have been simulated or passed in this cycle.
