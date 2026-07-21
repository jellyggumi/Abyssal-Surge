# Deterministic Field-Interaction Scenarios

**Command:** `node --test tests/campaign-state.test.mjs`  
**Observed:** 53 passed, 0 failed, 2026-07-21.  
**Boundary:** These are deterministic game-state scenarios exercised through the public campaign API. They are not a claim of ten human browser playthroughs.

| ID | Input / scenario | Verified outcome |
| --- | --- | --- |
| PS-001 | Clear each wave | Every wave emits its deterministic chest; only the boss-exposing clear emits the automatic event. |
| PS-002 | Click chest target | Only the exact pending chest ID is accepted; duplicate collection is rejected. |
| PS-003 | Apply attack field buff then issue assault | The next mouse-issued assault is increased and consumes one charge. |
| PS-004 | Apply defense field buff during breach | One breach damage is nullified and the charge is consumed. |
| PS-005 | Combine reward/HASTE cooldown modifiers | Reduction is capped at 40% and reads do not consume the effect. |
| PS-006 | Take a boss strike under invulnerability | The strike is blocked before defense or integrity mutation. |
| PS-007 | Take a proximity boss strike under evasion | Exactly one strike is avoided without spending unrelated defenses. |
| PS-008 | Take a boss strike under debuff | Damage is reduced by one and the effect retires at zero charges. |
| PS-009 | Clear waves consecutively | Exactly one pending chest remains and stale mouse target is retired. |
| PS-010 | Save, replay, retry | Deterministic field history is preserved while transient chest/effects reset. |

The same command also verifies all ten stage encounter schedules finish inside the configured 235–250 second wave band. It does not measure human completion time or active-renderer frame budget.
