# Stat and Item Reward System Schema

The campaign offers one exclusive reward after each victory. Effects derive solely from the immutable reward trace, so a version-compatible saved campaign reproduces the same build after import. Rules v3 deliberately rejects v2 traces instead of replaying them under rebalance values.

---

## 1. Implemented reward catalog

Every nonterminal reward establishes a bounded build direction. Rewards improve readiness, tempo, damage, or counter tolerance; none removes the Hunt → Extract → Materialize → Capture → Possess/Domain/Assault stage gates.

### Stage 1 — Cinder Span

| Reward ID | Build | Effect in later stages | Trade-off |
|---|---|---|---|
| `ember-cohort` | Legion | Every Materialize raises 2 additional shades; base 2 becomes 4. | Reaches the L4/L5 body thresholds quickly; no damage, recovery, or timer benefit. |
| `rift-lens` | Burst | A possessed Assault gains +4 damage from Veil Citadel onward. | Fastest boss finish; requires an owned node and Possess. |
| `stillwater-hourglass` | Tempo | Every command cooldown is 20% shorter; the second Hunt automatically extracts 4 souls. | Saves a semantic action per soul cache but grants no direct damage or integrity. |
| `shadebreaker-brand` | Bulwark | Every boss counterblow loses 2 damage, floored at 1. | Protects exposed Assaults but does not shorten the fight. |

### Stage 2 — Veil Citadel

| Reward ID | Build | Effect in Echo Throne | Trade-off |
|---|---|---|---|
| `veil-vanguard` | Setup skip | Starts with four shades. | Skips the opening soul cycle, but L4 remains thin in Stage 3. |
| `anchor-shard` | Recovery | Restores 2 additional integrity on Stage 3 entry. | A failure buffer only; does not speed the boss kill. |
| `abyssal-banner` | Legion / aegis | Starts with 1 aegis and adds 1 shade to every Materialize; Domain adds its 2 aegis instead of replacing the entry charge. | Rewards a prepared army; it cannot skip the normal command gates. |

### Stage 3 — Echo Throne

`throne-echo` and `dawnless-crown` are terminal archive rewards. They close the campaign and do not alter a later combat stage.

---

## 2. Runtime stat contract

`getCampaignBenefits(state)` returns a pure immutable summary used by the boss-spec screen, battle control pad, and renderer:

```js
{
  maxIntegrity: 10,
  cooldownReduction: 0, // clamped to 0–0.5
  lensDamage: 0,
  vanguardLegion: 0,
  anchorRestore: 0,
  extraAssaultDamage: 0,
  counterReduction: 0,
  summonBonus: 0,
  autoExtract: false,
  initialAegis: 0,
  activeItemNames: []
}
```

The effect is derived, not copied into a save field. Save replay therefore recomputes it from fixed reward IDs; a rules-version mismatch is rejected before replay.

## 3. Combat and cooldown formulas

Each accepted action starts its own real-time timer:

$$\text{Cooldown}_{\text{active}} = \text{Cooldown}_{\text{base}} \times (1 - \text{cooldownReduction})$$

For example, Hunt has a base cooldown of 4.0 seconds. With the Stillwater Hourglass, it becomes $4.0 \times (1 - 0.20) = 3.2$ seconds. Its second Hunt also uses the ordinary extraction payload immediately: `hunted` resets to 0 and `souls` gains 4.

Boss counterblow after legion shielding and the thin-legion penalty is:

$$\text{Counter} = \max(1,\max(1,\text{base}-\lfloor\text{legion}/4\rfloor)+\text{thinPenalty}-\text{counterReduction})$$

An aegis negates a full counterblow. Lord's Domain restores 4 integrity and adds two aegis charges exactly once; Abyssal Banner retains its entry charge, producing three charges total.

## 4. Balance invariants

- One reward is selected after each victory; all alternatives are discarded for that campaign.
- Cooldown reduction is capped at 50%.
- Counter reduction cannot lower damage below 1.
- Legion capacity remains 10; Cohort/Banner change summon output, not slot limits.
- Stage 3's L5 threshold remains meaningful: Vanguard begins at L4, while Cohort + Banner reaches L5 after one Materialize.
- `applyBattleBreach(state)` consumes aegis before integrity. At zero integrity the stage becomes `defeat`, and the breach is retained in the save trace.
