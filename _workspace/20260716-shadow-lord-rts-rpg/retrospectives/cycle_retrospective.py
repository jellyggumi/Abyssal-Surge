"""Typed, local-only production retrospective validator (Pydantic v2)."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Annotated, ClassVar, Literal

from pydantic import BaseModel, Field, PositiveInt, StringConstraints, ValidationError, model_validator

RunId = Annotated[str, StringConstraints(pattern=r"^\d{8}-[a-z0-9-]+$")]
NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
EvidencePaths = Annotated[list[NonEmptyText], Field(min_length=1)]


class Waiver(BaseModel):
    reason: NonEmptyText
    expiry: datetime
    approved_by: Literal["game-production-director"]


class GateResult(BaseModel):
    gate_id: Literal["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"]
    verdict: Literal["PASS", "FIX", "REDO", "FAIL"]
    threshold: NonEmptyText
    measured_value: int | float | str | dict[str, int | float | str]
    measurement_method: NonEmptyText
    evidence_paths: EvidencePaths
    timestamp: datetime
    revision_loops: Annotated[int, Field(ge=0, le=2)]
    waiver: Waiver | None = None


class StageRetrospective(BaseModel):
    stage: Literal["stage-1", "stage-2", "stage-3"]
    entry_gate: Literal["pass", "fix", "redo", "not-run"]
    exit_gate: Literal["pass", "fix", "redo", "not-run"]
    outcome: NonEmptyText
    evidence_paths: EvidencePaths
    risks: list[NonEmptyText]


class Risk(BaseModel):
    id: NonEmptyText
    stage: Literal["stage-1", "stage-2", "stage-3", "cross-cycle"]
    severity: Literal["S1", "S2", "S3", "S4"]
    description: NonEmptyText
    mitigation: NonEmptyText
    owner: NonEmptyText
    status: Literal["open", "accepted", "resolved"]


class CycleRetrospectiveV1(BaseModel):
    """A validated retrospective is structural evidence, not an automatic gate pass."""

    CANONICAL_THRESHOLDS: ClassVar[dict[str, str]] = {
        "G1": "0 un-waived lore violations; 100% trace coverage",
        "G2": "100% mechanics; win rates 45–55%; TTK ±15%; no combo >1.3× median EV",
        "G3": "3 viable of 5; no >50% dominance",
        "G4": "median ≥4/5; feedback ≤100 ms; 0 unresolved S1/S2 readability",
        "G5": "paid/free delta ≤5 pp; reversal ≤30%; free parity 10–20 sessions",
        "G6": "telemetry, rollback, checklist; p95 ≤16.7 ms; long frames <0.5%; 30-min stable; input ≤100 ms",
        "G7": "30–180 s, ≥3 actions, ≥1 reward, repeat ≥70%",
        "G8": "≤2/5 comparable frequency; impression ≥4/5",
    }

    schema_version: Literal["1.0"]
    run_id: RunId
    cycle_number: PositiveInt
    source_design: Literal["docs/shadow-lord-rts-rpg-hybrid-design.md"]
    public_beat: NonEmptyText
    stages: Annotated[list[StageRetrospective], Field(min_length=3, max_length=3)]
    gates: Annotated[list[GateResult], Field(min_length=8, max_length=8)]
    open_s1_defect_ids: list[NonEmptyText]
    unresolved_risks: list[Risk]
    next_cycle_entry: Literal["stage-1-concept-shift", "stage-2-retune"]
    decision_log_path: str | None
    validated: bool
    validation_status: Literal["validated", "repaired", "failed"]
    repair_status: Literal["first_pass", "repaired", "failed"]

    @model_validator(mode="after")
    def validate_cross_field_invariants(self) -> "CycleRetrospectiveV1":
        if {item.stage for item in self.stages} != {"stage-1", "stage-2", "stage-3"}:
            raise ValueError("stages must contain stage-1, stage-2, and stage-3 exactly once")
        if {item.gate_id for item in self.gates} != set(self.CANONICAL_THRESHOLDS):
            raise ValueError("gates must contain G1 through G8 exactly once")
        if len({item.stage for item in self.stages}) != 3 or len({item.gate_id for item in self.gates}) != 8:
            raise ValueError("stage and gate identifiers must be unique")
        for gate in self.gates:
            if gate.threshold != self.CANONICAL_THRESHOLDS[gate.gate_id]:
                raise ValueError(f"{gate.gate_id} threshold must use the canonical contract text")
        if self.open_s1_defect_ids and any(gate.verdict == "PASS" for gate in self.gates):
            raise ValueError("a PASS is invalid while open S1 defects exist")
        if self.validation_status in {"validated", "repaired"} and not self.validated:
            raise ValueError("validated/repaired status requires validated=true")
        if self.validation_status == "failed" and self.validated:
            raise ValueError("failed status requires validated=false")
        if self.validation_status == "repaired" and self.repair_status != "repaired":
            raise ValueError("repaired validation status requires repaired repair_status")
        if self.validation_status == "failed" and self.repair_status != "failed":
            raise ValueError("failed validation status requires failed repair_status")
        if self.repair_status == "failed" and self.validation_status != "failed":
            raise ValueError("failed repair_status requires failed validation status")
        return self


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(f"usage: {Path(argv[0]).name} <retrospective.json>", file=sys.stderr)
        return 2
    try:
        payload = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
        retrospective = CycleRetrospectiveV1.model_validate(payload)
    except (OSError, json.JSONDecodeError, ValidationError, ValueError) as error:
        print(f"failed: {error}", file=sys.stderr)
        return 1
    print(f"{retrospective.validation_status}: {retrospective.run_id} cycle {retrospective.cycle_number}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
