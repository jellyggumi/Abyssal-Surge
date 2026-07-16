---
run_id: 20260716-stage5-rts-detail-cycle-007-v1
owner: game-production-director
created_at: 2026-07-16T16:50:00Z
artifact_version: v1
immutable: true
status: recorded
---
# Worktree co-op incident + protocol note

## Detected peer session (2026-07-16 16:43 KST evidence)

- Run: `_workspace/rts-hero-rework-20260716-a/` (abyssal-game-studio harness,
  P0-P2 artifacts, last write `systems/simulator-evidence-v1.md` @16:43:04).
- Process: Codex `remote-control` (PID 10288/11044) — a separate agent session.
- Same single git worktree (`git worktree list` → one entry, main @ 9fd1586).

## Incident

28 TRACKED files (cycle-004 messages/ops/qa/production, cycle-005/006 intake/
production/retrospectives incl. validators) were found deleted UNSTAGED while
this session's runtime edits were intact. Deletion source: not this session;
consistent with a peer-side cleanup/git operation. Per artifact-contract
(immutable, append-only run records) and as owner of those runs, this session
restored all 28 via `git restore` at 16:47. No peer-run files
(`rts-hero-rework-20260716-a/`) were touched by the restore (verified: restore
list contained only cycle-004/005/006 paths; peer folder is untracked and
unaffected by index restore).

## Co-op protocol (proposed, recorded to shared memory)

1. Ownership: peer owns `_workspace/rts-hero-rework-20260716-a/**` exclusively;
   this session owns root runtime closure (app.js, sw.js, styles.css,
   index.html, manifest.json, assets/, tests/, .github/workflows/static.yml,
   apk/, docs/) and `_workspace/20260716-stage5-rts-detail-cycle-00[5-7]-v1/**`.
2. No destructive cross-scope git ops (checkout/clean/restore/rm on paths
   outside own scope). Commits: single-writer — this session commits/pushes the
   runtime; peer's P3 (engineering on app.js) is gate-blocked in its own
   manifest and MUST re-coordinate (or move to a separate `git worktree`)
   before that gate opens.
3. Escalation channel: `.omc/state/shared-memory/orca-abyssal-surge/` keys.
