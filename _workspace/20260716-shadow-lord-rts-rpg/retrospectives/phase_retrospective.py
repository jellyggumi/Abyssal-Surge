"""Per-phase self-improvement retrospective (pydantic-ai methodology).

Each production phase writes one typed JSON record. The schema forces the
reflection to be actionable: every phase must name at least one improvement
action, and every action names the phase that must consume it. The runner
aggregates records and prints the carry-forward queue — unapplied actions
that the next phase MUST read before starting. Validation failure exits 1,
so a malformed retrospective cannot silently count as reflection.

Usage:
  python3 phase_retrospective.py validate <record.json>
  python3 phase_retrospective.py carry-forward <records-dir>
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints, ValidationError, model_validator

RunId = Annotated[str, StringConstraints(pattern=r"^\d{8}-[a-z0-9-]+$")]
NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]

Phase = Literal[
    "research",
    "asset-production",
    "incident-response",
    "ui-integration",
    "balance-retune",
    "live-playtest",
    "optimization",
    "ship",
]


class Metric(BaseModel):
    name: NonEmptyText
    value: float
    unit: NonEmptyText
    method: NonEmptyText  # command or session that produced the number


class ImprovementAction(BaseModel):
    action: NonEmptyText
    owner: NonEmptyText
    apply_in_phase: Phase
    applied: bool = False
    evidence_when_applied: str | None = None

    @model_validator(mode="after")
    def applied_needs_evidence(self) -> "ImprovementAction":
        if self.applied and not self.evidence_when_applied:
            raise ValueError("an applied action must cite evidence_when_applied")
        return self


class PhaseRetrospective(BaseModel):
    """Typed reflection record. Valid structure is necessary, not sufficient:
    the carry-forward queue only drains when a later record marks the action
    applied WITH evidence."""

    schema_version: Literal[1] = 1
    run_id: RunId
    phase: Phase
    completed_at: datetime
    went_well: Annotated[list[NonEmptyText], Field(min_length=1)]
    went_wrong: list[NonEmptyText]
    metrics: list[Metric]
    improvement_actions: Annotated[list[ImprovementAction], Field(min_length=1)]
    evidence_paths: Annotated[list[NonEmptyText], Field(min_length=1)]

    @model_validator(mode="after")
    def wrong_demands_action(self) -> "PhaseRetrospective":
        # a phase that reports failures must convert them into learning:
        # at least one action must exist (open OR applied-with-evidence).
        # A fully-applied action list is the ideal outcome, not a violation.
        if self.went_wrong and not self.improvement_actions:
            raise ValueError("went_wrong entries require at least one improvement action")
        return self


def validate_file(path: Path) -> PhaseRetrospective:
    record = PhaseRetrospective.model_validate_json(path.read_text(encoding="utf-8"))
    return record


def carry_forward(directory: Path) -> int:
    records: list[PhaseRetrospective] = []
    failures = 0
    for file in sorted(directory.glob("phase-*.json")):
        try:
            records.append(validate_file(file))
        except ValidationError as error:
            failures += 1
            print(f"INVALID {file.name}: {error.errors()[0]['msg']}", file=sys.stderr)
    open_actions = [
        (r.phase, a)
        for r in records
        for a in r.improvement_actions
        if not a.applied
    ]
    print(f"records: {len(records)} valid, {failures} invalid")
    print(f"carry-forward queue ({len(open_actions)} open):")
    for source_phase, action in open_actions:
        print(f"  [{source_phase} → {action.apply_in_phase}] {action.action} (owner: {action.owner})")
    return 1 if failures else 0


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2
    command, target = argv[1], Path(argv[2])
    if command == "validate":
        try:
            record = validate_file(target)
        except ValidationError as error:
            print(f"INVALID: {error}", file=sys.stderr)
            return 1
        print(f"validated: {record.run_id} {record.phase} ({len(record.improvement_actions)} actions)")
        return 0
    if command == "carry-forward":
        return carry_forward(target)
    print(f"unknown command: {command}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
