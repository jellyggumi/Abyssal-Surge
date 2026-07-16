# Design–PM negotiation record

**Navigation:** [production contract](../production/production-contract.md) · [revenue map](revenue-map.md) · [decision log](../production/decision-log.md)

| ID | Status | Decision | Rationale | Required evidence | Owner |
|---|---|---|---|---|---|
| N-01 | accepted | Stage 1 has no monetization | Fairness cannot be established in a static local-only slice | `pm/revenue-map.md` | PM + Design |
| N-02 | accepted | exactly two earned exclusive rewards | preserves a legible consequence without store pressure | reward choice event + campaign snapshot | PM + Engineering |
| N-03 | deferred | cloud continuity | only after demand and RLS policy review | RLS review + offline conflict test | PM + Ops |
| N-04 | deferred | invite-only co-op | only after deterministic authoritative-room reconnect proof | reconnect/desync/hibernation tests | PM + Engineering |

No unsigned revenue decision may move into an implementation backlog. Escalate a disputed value to the production director via the decision log.