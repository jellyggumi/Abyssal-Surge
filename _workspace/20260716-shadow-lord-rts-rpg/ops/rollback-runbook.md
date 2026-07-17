# Static Pages rollback runbook

**Status:** exercise record `NOT-RUN`. This runbook describes the recovery path implemented by the workflow; it does not prove that a recovery deployment has occurred.

**Evidence:** [Pages workflow](../../../.github/workflows/static.yml) · [release-closure checks](../../../tests/release-closure.test.mjs) · [Stage 3 requirement](../production/handoffs/stage-3.md) · [G6 ledger](../qa/gate-measurements.md#g6-stage-1-operations-draft)

## Recovery semantics

A rollback is a manual `workflow_dispatch` of `Deploy static content to Pages` with `rollback_revision` set to one exact, lowercase, 40-character commit SHA. The workflow:

- checks out that exact revision with full history;
- rejects a non-40-character or unresolved SHA, and rejects a SHA that is not an ancestor of `origin/main`;
- validates the committed static import closure at that revision;
- archives only the committed allowlist into the Pages artifact; and
- deploys that artifact to the `github-pages` environment.

This repoints the deployed static artifact only. It does **not** rewrite `main`, mutate a tag, or restore IndexedDB/local browser saves. The workflow serializes Pages deployments (`concurrency: pages`, `cancel-in-progress: false`), so wait for the selected run rather than assuming a later deployment was cancelled.

## Preconditions and stop conditions

1. Identify the known-good deployed revision from a prior retained deployment record; do not choose an unverified short SHA, branch name, tag, or local working tree.
2. Confirm the exact SHA is lowercase, 40 hexadecimal characters, resolves to a commit, and is an ancestor of the current remote `main`:

```bash
export ROLLBACK_SHA='<known-good full lowercase 40-character SHA>'
printf '%s' "$ROLLBACK_SHA" | grep -Eq '^[0-9a-f]{40}$'
test "$(git rev-parse --verify "${ROLLBACK_SHA}^{commit}")" = "$ROLLBACK_SHA"
git fetch origin main
git merge-base --is-ancestor "$ROLLBACK_SHA" origin/main
```

Stop if any command fails. Do not substitute a different revision without recording why the previous candidate was rejected.

## Dispatch and collect evidence

From the repository with GitHub CLI authorization, dispatch the workflow definition on `main`; the workflow itself checks out `rollback_revision` for the artifact:

```bash
gh workflow run static.yml --ref main -f rollback_revision="$ROLLBACK_SHA"
gh run list --workflow static.yml --limit 5
```

Record the workflow-run URL/ID, actor, dispatch time, full SHA, deployment URL, and the outcome of these workflow steps: **Validate pinned recovery revision**, **Guard committed static import closure**, **Build allowlisted Pages artifact**, and **Deploy to GitHub Pages**. If any step fails, retain its log and leave the recovery result `FAIL`; do not retry with a changed SHA as if it were the same exercise.

## Post-deployment check

Use the deployment URL reported by the workflow, then perform the current-browser protocol in [Playwriter verification](../engineering/tech-verification/playwriter.md) or retain an equivalent scoped browser capture. Confirm only what the capture shows: served revision/context, campaign entry, and browser errors. A client browser may retain its own local campaign state; do not treat a state mismatch as source rollback or delete local data to hide it.

## Required recovery record

```text
Rollback exercise: NOT-RUN | PASS | FAIL
workflow run URL/ID: <captured>
actor and dispatch time: <captured>
rollback_revision: <full SHA>
ancestor validation: <captured command/workflow result>
artifact/deployment URL: <captured>
workflow guard outcomes: <captured>
post-deploy browser evidence: <captured path or NOT-RUN>
local-save impact: no migration/destructive action performed | <observed>
```

Until an authorized dispatch and retained post-deploy capture fill this record, final G6 rollback evidence is `NOT-RUN`. See [release readiness](release-readiness.md) for the evidence that still blocks a release conclusion.
