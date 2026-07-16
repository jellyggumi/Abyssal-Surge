---
run_id: 20260716-stage5-rts-detail-cycle-007-v1
owner: game-production-director
created_at: 2026-07-16T17:00:00Z
artifact_version: v2
supersedes: worktree-coop-note.md (v1)
immutable: true
status: recorded
---
# Worktree co-op note v2 — attribution correction + isolation decision

## Correction to v1

v1 attributed the 28-file tracked deletion to "peer-side cleanup (consistent
with)". That attribution exceeds the evidence. Corrected finding: **deletion
source unknown; verified only that it was NOT this session** (this session's
tool transcript contains no deletion of those paths, and they existed at commit
9fd1586). Known concurrent actors sharing the worktree: one Codex
remote-control session (rts-hero-rework-20260716-a) plus any background
processes. No process-level audit trail exists to assign responsibility.

## Isolation decision (advisory-driven)

A manifest/ownership boundary is coordination, not isolation. Because the
worktree is shared and cross-run status churn was already observed:

1. Cycle 007's COMPLETED work is snapshotted to git (commit + push) immediately
   — committed history is the only artifact store that working-tree churn
   cannot destroy.
2. FUTURE cycles of this production line will run in a dedicated
   `git worktree add ../Abyssal-Surge-cycle-008 -b cycle-008` (or pause the
   peer), exchanging work through commits/PRs rather than shared-tree edits.
3. Shared-memory key `worktree-coop-protocol-20260716` updated to v2 wording.
