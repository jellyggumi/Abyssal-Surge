#!/usr/bin/env python3
"""Validate immutable Cycle 006 Retrospective v1 JSON records with Pydantic v2."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

AUTHORIZED_RUN_ID = "20260716-stage5-rts-detail-cycle-006-v1"
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]

EvidencePath = Annotated[str, Field(pattern=r"^/", min_length=2)]
Sha256 = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]


class StrictRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class InputHash(StrictRecord):
    path: EvidencePath
    sha256: Sha256


class Claim(StrictRecord):
    claim_id: Annotated[str, Field(pattern=r"^C006-RETRO-\d{3}$")]
    category: Literal["observation", "boundary", "verification"]
    statement: Annotated[str, Field(min_length=1, max_length=1200)]
    evidence_paths: Annotated[list[EvidencePath], Field(min_length=1, max_length=8)]


class Assumption(StrictRecord):
    assumption_id: Annotated[str, Field(pattern=r"^ASM-\d{3}$")]
    statement: Annotated[str, Field(min_length=1, max_length=1000)]
    validation_boundary: Annotated[str, Field(min_length=1, max_length=1000)]


class Blocker(StrictRecord):
    blocker_id: Annotated[str, Field(pattern=r"^BLK-\d{3}$")]
    category: Literal["integration", "process", "evidence"]
    status: Literal["blocked", "resolved"]
    cause: Annotated[str, Field(min_length=1, max_length=1000)]
    unblock_condition: Annotated[str, Field(min_length=1, max_length=1000)]


class NextAction(StrictRecord):
    action_id: Literal["C006-NEXT-001"]
    phase: Literal["cutscene-budget-and-apk-packaging"]
    owners: Annotated[
        list[Literal["game-production-director", "game-engineering-lead"]],
        Field(min_length=2, max_length=2),
    ]
    scope: Annotated[str, Field(min_length=1, max_length=500)]
    prohibited_work: Annotated[list[str], Field(min_length=1, max_length=8)]


class ValidationMetrics(StrictRecord):
    validation_sample_count: Annotated[int, Field(ge=1, le=1000)]
    first_pass_success: bool
    retry_rate: Annotated[float, Field(ge=0.0, le=1.0)]
    field_error_rate: Annotated[float, Field(ge=0.0, le=1.0)]

    @model_validator(mode="after")
    def require_consistent_first_pass_metrics(self) -> "ValidationMetrics":
        if self.first_pass_success and (self.retry_rate != 0.0 or self.field_error_rate != 0.0):
            raise ValueError("first_pass_success requires zero retry_rate and zero field_error_rate")
        return self


class PydanticAIIntegration(StrictRecord):
    adapter_status: Literal["available_not_executed"]
    probe_command: Literal[".venv/bin/python -m pip show pydantic-ai"]
    observed_version: Annotated[str, Field(pattern=r"^2\.\d+\.\d+$")]
    provider_call_executed: Literal[False]
    agent_run_executed: Literal[False]


class DetailDirectiveState(StrictRecord):
    det6_title: Literal["completed_verified"]
    det6_foe: Literal["completed_verified"]
    det6_unit: Literal["completed_verified"]
    det6_qa: Literal["passed"]
    det6_doc: Literal["completed"]


class ReflectionResult(StrictRecord):
    status: Literal["validated", "repaired", "failed"]
    pydantic_version: Annotated[str, Field(pattern=r"^2\.\d+\.\d+$")]
    metrics: ValidationMetrics


class CycleRetrospectiveV1(StrictRecord):
    schema_version: Literal["cycle-retrospective/v1"]
    artifact_path: EvidencePath
    run_id: Literal[AUTHORIZED_RUN_ID]
    cycle_index: Literal[6]
    process_phase: Literal["P3-design-alignment"]
    status: Literal["final"]
    owner: Literal["retrospective-validator"]
    created_at: Annotated[str, Field(pattern=r"^2026-07-16T\d{2}:\d{2}:\d{2}Z$")]
    input_artifacts: Annotated[list[EvidencePath], Field(min_length=3, max_length=12)]
    input_hashes: Annotated[list[InputHash], Field(min_length=3, max_length=12)]
    decision_ids: Annotated[list[Literal["C006-D-001"]], Field(min_length=1, max_length=1)]
    detail_directive_state: DetailDirectiveState
    claims: Annotated[list[Claim], Field(min_length=3, max_length=12)]
    assumptions: Annotated[list[Assumption], Field(min_length=1, max_length=6)]
    blockers: Annotated[list[Blocker], Field(min_length=0, max_length=6)]
    next_action: NextAction
    pydantic_ai_integration: PydanticAIIntegration
    reflection_result: ReflectionResult

    @model_validator(mode="after")
    def require_repo_paths(self) -> "CycleRetrospectiveV1":
        root = str(REPOSITORY_ROOT)
        for group_name, paths in (
            ("input_artifacts", self.input_artifacts),
            ("claim evidence", [p for c in self.claims for p in c.evidence_paths]),
        ):
            for p in paths:
                rp = Path(p)
                if not str(rp).startswith(root):
                    raise ValueError(f"{group_name} path outside repository: {p}")
                if not rp.exists():
                    raise ValueError(f"{group_name} path does not exist: {p}")
        return self

    @model_validator(mode="after")
    def require_hash_pairs(self) -> "CycleRetrospectiveV1":
        declared = {h.path for h in self.input_hashes}
        artifacts = set(self.input_artifacts)
        if declared != artifacts:
            raise ValueError("input_hashes paths must exactly match input_artifacts")
        import hashlib

        for h in self.input_hashes:
            actual = hashlib.sha256(Path(h.path).read_bytes()).hexdigest()
            if actual != h.sha256:
                raise ValueError(f"hash mismatch for {h.path}")
        return self


def main(argv: list[str] | None = None) -> int:
    arguments = sys.argv[1:] if argv is None else argv
    if len(arguments) != 1:
        print("usage: cycle-006-retrospective-validator-v1.py RETROSPECTIVE.json", file=sys.stderr)
        return 2
    source = Path(arguments[0])
    try:
        record = CycleRetrospectiveV1.model_validate_json(source.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, ValidationError) as error:
        print(f"INVALID {source}: {error}", file=sys.stderr)
        return 1
    print(
        f"VALID schema={record.schema_version} run_id={record.run_id} "
        f"phase={record.process_phase} reflection_status={record.reflection_result.status}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
