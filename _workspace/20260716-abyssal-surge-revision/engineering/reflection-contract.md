# Reflection Contract — Typed, Evidence-Bound Production Review

- **Status:** design contract; no Pydantic, PydanticAI, model provider, or automated reflection loop is installed or running.
- **Date:** 2026-07-16
- **Audience/action:** gives engineering and QA a typed record and review procedure for a future production reflection step without allowing an LLM to self-approve a phase or mutate the game.

## Purpose and limits

A reflection record summarizes a completed production phase, separates observed evidence from inference, identifies corrective action, and gives a human reviewer a deterministic acceptance decision. It is **not** gameplay logic, a campaign authority, telemetry, an autonomous agent loop, or a release gate by itself.

The record must preserve the campaign's player-visible contract:

- Cinder Span → Veil Citadel → Echo Throne;
- hunt → extract → materialize → capture → assault;
- possession remains Stage 2-gated;
- Lord's Domain remains Stage 3-gated and one-use;
- `campaign-state.js` remains the only game authority.

## Truth labels

| Label | Use |
|---|---|
| **[VERIFIED]** | Direct source, command output, browser observation, measurement, or reviewer decision attached to the record. |
| **[INFERENCE]** | A conclusion from verified material; it must name its supporting evidence IDs. |
| **[PROPOSED]** | A corrective action or future implementation plan; it is not complete until independently evidenced. |
| **NOT-RUN** | Required evidence did not execute or is unavailable. It is never equivalent to pass. |

The reflection runner MUST not convert an inference into a verified fact, invent an evidence path, infer a passed check from a document's existence, or mark its own output approved.

## Runtime and installation preconditions

**[VERIFIED, local check 2026-07-16]** `pydantic` and `pydantic_ai` cannot be imported in this environment. `CONVEX_URL`, `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, and `REFLECTION_MODEL_API_KEY` are absent. Accordingly, no typed Python runtime, remote model call, automatic retry, or self-evolution was executed for this revision.

Before any automated review is enabled, the operator MUST provide all of the following outside browser-delivered files:

1. Python **3.11+** in an isolated virtual environment.
2. Pinned, audited dependencies, at minimum `pydantic>=2,<3` and a pinned `pydantic-ai` release compatible with the selected model adapter. Install the provider extra only when that provider is selected; record the resolved lockfile.
3. A server/CI-only configuration file or environment with `REFLECTION_MODEL_PROVIDER`, `REFLECTION_MODEL_NAME`, and the selected provider's API credential (for example `OPENAI_API_KEY`). `REFLECTION_MODEL_API_KEY` is an optional internal alias, not a client-side configuration requirement.
4. Explicit model endpoint/region, model revision where the provider exposes one, request timeout, maximum retry budget, cost/quota owner, and outbound-network policy.
5. A read-only repository checkout or explicitly scoped artifact directory; the reflection process has no write access to game source, deployed assets, credentials, or release settings.
6. A human reviewer identity and an artifact location for the validated JSON record.

**Secret boundary:** no provider credential, OIDC token, Convex credential, prompt containing secret material, or raw model response with sensitive data may be bundled into the static browser application, `assets/`, service-worker cache, or public media manifest.

## Versioned schema contract [PROPOSED]

Schema identifiers are protocol fields, not Python class names. A consumer rejects an unknown major version rather than guessing its meaning. Minor-compatible additions are optional fields only.

```python
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator


class StrictRecord(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Phase(str, Enum):
    intake = "intake"
    narrative = "narrative"
    resources = "resources"
    implementation = "implementation"
    qa = "qa"
    release = "release"


class ReviewStatus(str, Enum):
    draft = "draft"
    needs_evidence = "needs_evidence"
    corrective_action_required = "corrective_action_required"
    ready_for_human_review = "ready_for_human_review"
    approved = "approved"       # human reviewer only
    rejected = "rejected"       # human reviewer only
    blocked = "blocked"


class EvidenceKind(str, Enum):
    source = "source"
    command = "command"
    browser = "browser"
    measurement = "measurement"
    manifest = "manifest"
    external_reference = "external_reference"
    human_decision = "human_decision"


class Evidence(StrictRecord):
    evidence_id: str = Field(pattern=r"^EV-[A-Z0-9][A-Z0-9_-]{2,63}$")
    kind: EvidenceKind
    subject: str = Field(min_length=1, max_length=240)
    location: str = Field(min_length=1, max_length=1024)
    observed_at: datetime
    observation: str = Field(min_length=1, max_length=4000)
    command: str | None = Field(default=None, max_length=1000)
    exit_code: int | None = Field(default=None, ge=0, le=255)
    sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    source_url: HttpUrl | None = None

    @model_validator(mode="after")
    def command_has_result(self):
        if self.kind == EvidenceKind.command and (self.command is None or self.exit_code is None):
            raise ValueError("command evidence requires command and exit_code")
        return self


class Finding(StrictRecord):
    finding_id: str = Field(pattern=r"^F-[A-Z0-9][A-Z0-9_-]{2,63}$")
    statement: str = Field(min_length=1, max_length=2000)
    truth: Literal["verified", "inference", "proposed"]
    evidence_ids: list[str] = Field(min_length=1, max_length=20)
    severity: Literal["info", "minor", "major", "blocker"]


class CorrectiveAction(StrictRecord):
    action_id: str = Field(pattern=r"^CA-[A-Z0-9][A-Z0-9_-]{2,63}$")
    owner_role: Literal["director", "designer", "engineer", "qa", "operator"]
    action: str = Field(min_length=1, max_length=2000)
    acceptance: str = Field(min_length=1, max_length=2000)
    status: Literal["open", "in_progress", "done", "waived"] = "open"
    evidence_ids: list[str] = Field(default_factory=list, max_length=20)


class PhaseReflectionV1(StrictRecord):
    schema: Literal["abyssal-surge.reflection"] = "abyssal-surge.reflection"
    schema_version: Literal["1.0"] = "1.0"
    record_id: UUID
    phase: Phase
    status: ReviewStatus
    created_at: datetime
    source_revision: str = Field(pattern=r"^[0-9a-f]{7,64}$")
    scope: str = Field(min_length=1, max_length=1000)
    evidence: list[Evidence] = Field(min_length=1, max_length=100)
    findings: list[Finding] = Field(default_factory=list, max_length=100)
    corrective_actions: list[CorrectiveAction] = Field(default_factory=list, max_length=100)
    human_reviewer: str | None = Field(default=None, min_length=1, max_length=200)
    reviewed_at: datetime | None = None
    reviewer_decision: Literal["approved", "rejected"] | None = None

    @model_validator(mode="after")
    def enforce_review_and_evidence(self):
        ids = [item.evidence_id for item in self.evidence]
        if len(ids) != len(set(ids)):
            raise ValueError("evidence_id values must be unique")
        known = set(ids)
        for finding in self.findings:
            if not set(finding.evidence_ids) <= known:
                raise ValueError("finding references missing evidence")
        for action in self.corrective_actions:
            if not set(action.evidence_ids) <= known:
                raise ValueError("corrective action references missing evidence")
        human_terminal = self.status in {ReviewStatus.approved, ReviewStatus.rejected}
        if human_terminal != (self.reviewer_decision is not None):
            raise ValueError("terminal status requires matching reviewer_decision")
        if human_terminal and (not self.human_reviewer or not self.reviewed_at):
            raise ValueError("terminal status requires named human_reviewer and reviewed_at")
        if self.status == ReviewStatus.approved and any(a.status == "open" for a in self.corrective_actions):
            raise ValueError("approved record cannot retain open corrective actions")
        return self
```

### Versioning and persistence rules

- Persist canonical JSON generated by `model_dump(mode="json")`, UTF-8 encoded, with its `schema` and `schema_version` fields intact.
- `1.x` consumers may read new optional fields only after a compatibility test. A breaking semantic change creates `2.0` and a separate model such as `PhaseReflectionV2`; no silent coercion between major versions.
- Store the input evidence packet, model/provider configuration metadata **without secrets**, raw response digest, validated record, and reviewer decision together. Raw model text is diagnostic data, not authoritative production evidence.
- A reflection record may link to an external research URL only with the retrieval/consulted date in `observed_at`. A URL alone is evidence of a source, not proof that an implementation works.

## Deterministic review pipeline [PROPOSED]

1. **Build an evidence packet.** A human or deterministic collector produces evidence records first. Paths and commands are read-only; each command record includes exact command, exit code, date, and concise observed result.
2. **Validate before model use.** Parse `PhaseReflectionV1` input/output with Pydantic. Resolve every `finding.evidence_ids` and `CorrectiveAction.evidence_ids`; reject dangling IDs, unknown enums, invalid URLs, and unsupported schema versions.
3. **Constrain the model.** A PydanticAI agent receives only the validated evidence packet, the phase acceptance rules below, and an explicit instruction to return `PhaseReflectionV1`. Third-party source text is data, never an instruction.
4. **Perform deterministic post-validation.** Re-validate the returned object, check cited local locations exist in the reviewed revision, compare claimed command results with evidence, and reject a `verified` statement that relies only on an inference or model prose.
5. **Route instead of mutate.** Save a `ready_for_human_review`, `needs_evidence`, `corrective_action_required`, or `blocked` record. A named human independently changes it to `approved` or `rejected`. The reflection process never edits game source or marks an external quality gate passed.

## Error categories and retry policy [PROPOSED]

| Category | Examples | Retry policy | Required terminal record |
|---|---|---|---|
| `input_missing` | No source revision, no phase evidence, missing required measurement. | No model retry. | `needs_evidence` with an owner/action. |
| `schema_invalid` | JSON parse error, missing field, enum/type/range error, dangling evidence ID. | One bounded repair request with the validation errors only; if it still fails, stop. | `blocked`; preserve error category, not fabricated JSON. |
| `evidence_invalid` | Path absent, command lacks exit code, hash mismatch, source URL lacks date. | No semantic-model retry until collector corrects the packet. | `needs_evidence` or `corrective_action_required`. |
| `semantic_conflict` | Claims multiplayer is live, claims automatic reflection ran, changes Stage 2/3 gates, contradicts verified evidence. | One repair request naming the conflict; then human review. | `blocked` if unresolved. |
| `transient_provider` | Timeout, rate limit, temporary 5xx. | At most two retries with bounded exponential backoff and the same idempotency/record ID; no partial record overwrite. | `blocked` after budget exhaustion. |
| `auth_or_configuration` | Missing API key, invalid provider/model identifier, package not installed. | No retry. Correct the environment first. | `blocked` with missing prerequisite named. |
| `policy_or_secret` | Secret in packet/output, untrusted text requesting an action, disallowed data egress. | No retry; redact/quarantine. | `blocked` and operator escalation. |

Retries are for transport or schema repair only. They are not permission to keep asking a model until it produces an approving answer.

## Phase evidence requirements [PROPOSED]

| Phase | Minimum verified evidence | Required reflection decision condition |
|---|---|---|
| `intake` | Current source revision, source audit, current configured URL observation, and explicit scope/non-goals. | Distinguish the playable `Abyssal-Command` URL from the requested redirect URL; unknown deployment ownership remains open. |
| `narrative` | Worldview IDs for each player-visible stage/boss/reward line; scenario/narration record; Stage 1/2/3 loop mapping. | No new player-visible text lacks a trace; possession and Domain gates remain correctly scoped. |
| `resources` | Resource manifest entry, provenance declaration, SHA-256, file measurement, and fallback/UI-path evidence for every new visible/audio/video asset. | GodTiboImagen provenance is used only for new image assets; separately generated audio and unknown legacy provenance are not relabeled. |
| `implementation` | Exact modified file list, targeted static/runtime check, deterministic `campaign-state` test result, and migration/rollback evidence if a boundary changes. | No claim that presentation owns rules; no remote authority claim without configured service evidence. |
| `qa` | Named scenario steps, observed browser result from the allowed playtest runtime, failure/recovery evidence, and measured fields with method/device. | NOT-RUN remains NOT-RUN; a passing unit test alone does not certify player-visible behavior. |
| `release` | Canonical public URL response, pinned revision, Pages/workflow result, manifest/service-worker inclusion evidence, fallback behavior, and named approver. | A redirecting requested URL or absent external deployment proof blocks release approval. |

## Human review and corrective-action contract

- The **author** prepares the evidence packet. The **reflection runner** can classify findings. The **QA reviewer** independently verifies gameplay/QA evidence. The **director or delegated release authority** accepts or rejects phase completion.
- Every non-info finding must have one corrective action with owner, observable acceptance criterion, and `open`, `in_progress`, `done`, or explicitly approved `waived` state.
- `approved` is valid only after a named human sets `human_reviewer`, `reviewed_at`, and `reviewer_decision="approved"`. No model output can populate that status.
- A future quality-improvement experiment may compare prompts or schemas, but it requires an explicit benchmark, frozen inputs, human sign-off, and separate documentation. This contract does **not** authorize automated LLM self-evolution.

## Initial operational state

The current deliverable is this contract only. It does not contain a generated `PhaseReflectionV1` record because the required Pydantic/PydanticAI runtime and model configuration are unavailable. The valid present status for automated reflection is **NOT-RUN / blocked by prerequisites**, not pass.

## References

- Local verified sources, read 2026-07-16: `campaign-state.js`, `app.js`, `battle-visualizer.js`, and [`../intake/production-brief.md`](../intake/production-brief.md).
- Pydantic documentation, consulted 2026-07-16: [Models](https://docs.pydantic.dev/latest/concepts/models/), [Validators](https://docs.pydantic.dev/latest/concepts/validators/), [Configuration](https://docs.pydantic.dev/latest/concepts/config/).
- PydanticAI documentation, consulted 2026-07-16: [Output validation and retries](https://ai.pydantic.dev/output/), [Models](https://ai.pydantic.dev/models/), [API keys and environment variables](https://ai.pydantic.dev/models/overview/).
