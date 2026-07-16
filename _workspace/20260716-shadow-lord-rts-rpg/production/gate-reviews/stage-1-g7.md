# Stage 1 G7 review — discovered core loop

**Navigation:** [production contract](../production-contract.md) · [core loop](../../design/core-loop.md) · [test plan](../../qa/test-plan.md)

- **Canonical threshold:** one numeric 30–180 s loop, ≥3 actions, ≥1 reward, voluntary repeat proxy ≥70%.
- **Decision:** Cinder Span target loop = 75 s; actions are move/target, Arise, deploy/order/capture; reward is a persisted exclusive choice.
- **Current status:** `NOT-RUN`. The 75 s model is not a measured completion or repeat rate.
- **Required evidence:** 10 voluntary repeat sessions with raw duration/actions/reward/repeat choice, build ID, timestamp, and any defects.

## Exit record

| Value | Entry | Exit requirement | Observed result |
|---|---:|---:|---|
| Loop duration | no session | 30–180 s median | target 75 s only |
| Actions | no session | ≥3 | 4 modeled |
| Reward event | no session | ≥1 | 1 modeled |
| Repeat proxy | no session | ≥70% | not-run |