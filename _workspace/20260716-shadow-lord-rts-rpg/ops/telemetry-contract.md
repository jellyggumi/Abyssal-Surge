# Telemetry contract — semantic events only

**Navigation:** [production contract](../production/production-contract.md) · [architecture](../engineering/architecture-contract.md) · [G6 ledger](../qa/gate-measurements.md#g6-stage-1-operations-draft)

## Observed fact

PostHog documents named custom events/properties and funnel breakdowns; automatic UI capture is not a balance source. Sources: [capture events](https://posthog.com/docs/product-analytics/capture-events) and [funnels](https://posthog.com/docs/product-analytics/funnels).

## Stage 1 event decisions

| Event | Required properties | Decision supported |
|---|---|---|
| `run_started` | run_id, build_version, stage_id, lord_id, loadout_hash, state_schema | entry/dropoff |
| `soul_pool_created` | run_id, stage_id, elapsed_s, expires_at_s | extraction cadence |
| `arise_resolved` | run_id, result, role_id, capacity_before, capacity_after | slot/flow failure |
| `objective_captured` | run_id, objective_id, elapsed_s, owner_before, capacity_delta | map-control meaning |
| `stage_ended` | run_id, stage_id, result, elapsed_s, base_health, end_reason | difficulty/duration |
| `reward_chosen` | run_id, offer_ids, reward_id, campaign_node | reward distribution |
| `save_restored` / `save_conflict` | state_schema, save_source, migration_result, conflict_resolution | persistence reliability |

## Privacy and operation boundary

Use a random local run ID; do not record credentials, typed text, precise personal data, or third-party account identifiers. Analytics is diagnostic and does not become campaign authority. Stage 1 may retain events locally/offline; external telemetry endpoint approval is separate.

## Required dashboards later

1. `run_started → stage_ended → reward_chosen → stage2_started → stage3_ended`, by build/device/loadout.
2. Attempts, win rate, median duration, end reason, and reward-conditioned next-stage outcome.

G6 remains not-run until fields are implemented and mobile sessions measure performance, memory, input, rollback, and release checklist.