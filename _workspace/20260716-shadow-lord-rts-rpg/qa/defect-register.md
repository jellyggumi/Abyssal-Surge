# Defect register

**Navigation:** [production contract](../production/production-contract.md) · [test plan](test-plan.md) · [gate reviews](../production/gate-reviews/stage-1-g1.md)

| ID | Severity | Stage | Status | Reproduction | Gate impact | Owner |
|---|---|---|---|---|---|---|
| none recorded | — | — | **No execution evidence yet** | Build/session not attached | no pass may rely on this placeholder | QA |

## Severity rule

- **S1:** data loss, inaccessible campaign completion, third-party-IP leak, or a state-machine corruption. Blocks all affected pass verdicts.
- **S2:** objective/action unreadable, incorrect reward persistence, or mobile control failure. Blocks affected gate.
- **S3/S4:** non-blocking polish/tracking; must still be dispositioned before release.

Every real row needs build ID, exact steps, expected/actual outcome, evidence path, owner, and fixed/deferred status.