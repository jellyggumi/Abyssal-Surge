# Abyssal Surge — balance-sheet mirror

**Authority and status:** This is a documentation mirror of `campaign-state.js` `RULES_VERSION = abyssal-surge-rules-v3` and `BALANCE`; it makes **no balance-quality, win-rate, or TTK-pass claim**. Audit date: **2026-07-16**. Change numbers only in the authoritative source, then re-mirror here.

## Authoritative numeric knobs

| Key | Current value | Runtime meaning |
|---|---:|---|
| `counterBase` | `[1, 2, 8]` | Base boss counterblow by S1/S2/S3. |
| `shieldDivisor` | `4` | Counter shield reduction is `floor(legion / 4)`. |
| `thinMargin` | `2` | A legion is thin when `legion < stage.number + 2`. |
| `thinPenalty` | `1` | Added to a thin legion’s raw counter. |
| `rewardRestore` | `1` | Integrity restored on a stage reward choice, capped by max integrity. |
| `domainRestore` | `4` | Integrity restored by Lord's Domain. |
| `domainAegis` | `2` | Counterblows negated by Lord's Domain. |
| `soulsPerExtract` | `4` | Souls granted by Extract. |
| `materializeCost` | `2` | Souls consumed by Materialize. |
| `materializeSummon` | `2` | Base shades raised by Materialize. |
| `cohortSummonBonus` | `2` | Ember Cohort added shades per Materialize. |
| `vanguardLegion` | `4` | Veil Vanguard starting legion in Echo Throne. |
| `anchorRestore` | `2` | Anchor Shard entry integrity restoration for Echo Throne. |
| `hourglassCooldownReduction` | `0.2` | Stillwater Hourglass cooldown reduction; exposed benefit is clamped to 0–0.5. |
| `bannerSummonBonus` | `1` | Abyssal Banner added shades per Materialize. |
| `bannerInitialAegis` | `1` | Abyssal Banner aegis at stage entry. |
| `brandCounterReduction` | `2` | Bulwark Brand counter reduction, subject to the final floor of 1. |
| `assaultBase` | `[3, 3, 4]` | Base Assault damage by S1/S2/S3. |
| `possessDamage` | `1` | Assault damage added while possessed. |
| `lensDamage` | `4` | Rift Lens added damage on a possessed Assault. |
| `maxIntegrity` | `10` | Integrity cap. |

## Derived formulas (source translation, not a tuning recommendation)

```text
shield      = floor(legion / 4)
thin        = legion < stage.number + 2 ? 1 : 0
rawCounter  = max(1, counterBase[stage - 1] - shield) + thin
counter     = max(1, rawCounter - counterReduction)
assault     = assaultBase[stage - 1] + (possessed ? possessDamage + lensDamage : 0)
```

If `aegis > 0`, an Assault spends one aegis and takes no counterblow. Boss defeat takes precedence over a counter/defeat state on the same Assault. Stage capacity is initialized from `MIN_SLOTS = 10`; `MAX_SLOTS = 100` is also declared but is not an active capacity-upgrade rule in the current action transitions.

## Stage mirror

| Stage | Boss HP | Node goal | Required gates before Assault | Base Assault / base counter | Story trace |
|---|---:|---:|---|---:|---|
| Cinder Span | `8` | `1` | Capture one node | `3 / 1` | AS-WV-011–015, AS-WV-067, AS-WV-071 |
| Veil Citadel | `10` | `2` | Hold two nodes and Possess | `3 + 1 possessed / 2` | AS-WV-024–028, AS-WV-068, AS-WV-072 |
| Echo Throne | `17` | `1` | Capture throne node; Domain is available once but not an Assault prerequisite | `4 / 8` | AS-WV-035–039, AS-WV-069, AS-WV-073 |

## Earned reward mirror

| Awarded after | Reward | Current exact effect | Trace |
|---|---|---|---|
| S1 | Ember Cohort | Materialize raises 2 additional shades (base 2) for the remaining campaign. | AS-WV-016–017 |
| S1 | Rift Lens | Possession assaults deal +4 damage from Veil Citadel onward. | AS-WV-018–019 |
| S1 | Stillwater Hourglass | Reduces command cooldowns by 20%; the second Hunt immediately extracts the soul cache. | AS-WV-020–021 |
| S1 | Bulwark Brand | Reduces every boss counterblow by 2, never below 1. | AS-WV-022–023 |
| S2 | Veil Vanguard | Start Echo Throne with four shades already raised; skips setup but remains thin. | AS-WV-029–030 |
| S2 | Anchor Shard | Restore 2 additional integrity when entering Echo Throne. | AS-WV-031–032 |
| S2 | Abyssal Banner | Enter with 1 aegis; every Materialize raises 1 additional shade; Lord's Domain adds its 2 aegis. | AS-WV-033–034 |
| S3 | Throne Echo | Record the legion's final oath in the campaign archive. | AS-WV-040–041 |
| S3 | Dawnless Crown | Record a crown forged from the closed gate. | AS-WV-042–043 |

Exactly one offered reward is selected after each stage victory. This is earned in-campaign progression; no payment or entitlement conclusion is made here.

## Verification boundary and unknowns

- Source-level checks can confirm deterministic transitions and exact arithmetic. They do **not** prove a fair difficulty curve, player comprehension, real TTK, or voluntary-repeat rate.
- The Stage 1/2/3 loop targets in [core-loop.md](core-loop.md) are planning targets only: `75 / 100 / 120` seconds, each within the G7 30–180 second band. They require browser-session timestamps to validate.
- No new balance adjustment is authorized by this mirror. G2/G7 quantitative status: **NOT-RUN**.
