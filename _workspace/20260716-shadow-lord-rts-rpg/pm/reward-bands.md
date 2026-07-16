# Reward bands

**Navigation:** [production contract](../production/production-contract.md) · [balance sheet](../design/balance-sheet.md) · [negotiation record](negotiation-record.md)

## Stage 1 reward contract

| Band | Reward | Player-visible effect | Constraint |
|---|---|---|---|
| Tactical tempo | Cinder March | one-time 15% capture-speed bonus in Stage 2 | exclusive with Relay Ward |
| Capacity | Relay Ward | +2 starting capacity in Stage 2 | hard clamp 10–100; exclusive with Cinder March |

**Decision:** every completion offers exactly these two options and persists exactly one ID. No random roll, purchase, or hidden third option is allowed.

## Stage 2/3 handoff

- Compare next-stage win rate, pick share, duration, and failure mode for each reward before changing it.
- Do not infer imbalance from pick share alone.
- Future reward bands need an explicitly signed fairness review and G2/G5 evidence.