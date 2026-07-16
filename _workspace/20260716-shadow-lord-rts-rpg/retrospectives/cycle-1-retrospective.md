# Cycle 1 retrospective — evidence-ready template

**Navigation:** [production contract](../production/production-contract.md) · [validator](cycle_retrospective.py) · [minimal valid example](minimal-valid-retrospective.json)

## Status

This is a closure template, not evidence that the campaign has passed a gate. Install the declared Pydantic v2 dependency, then serialize the final record as JSON and validate it with:

```text
python -m pip install -r _workspace/20260716-shadow-lord-rts-rpg/retrospectives/requirements.txt
python _workspace/20260716-shadow-lord-rts-rpg/retrospectives/cycle_retrospective.py _workspace/20260716-shadow-lord-rts-rpg/retrospectives/<final>.json
```

## Required reflection

| Area | Record |
|---|---|
| Run/public beat | run ID, cycle number, shipped/next public beat |
| Each stage | entry/exit verdict, outcome, evidence paths, risks |
| G1–G8 | canonical threshold, measured value, method, evidence, timestamp, revision loops, waiver |
| Defects/risks | open S1 IDs, severity/owner/mitigation/status |
| Decision | `stage-1-concept-shift` or `stage-2-retune` with reason |
| Validation | `validated`, `repaired`, or `failed`; matching `validated` boolean and repair status |

## Closure rule

A schema-valid document is **not** a production pass. Gate pass remains contingent on the reviewed evidence values specified in [production contract](../production/production-contract.md).