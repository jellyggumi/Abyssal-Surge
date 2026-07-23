# Rollback runbook — Solo Warden RPG layer cycle

**Status: mechanism verified this session, never yet exercised in
production.** Every claim below is grounded in either the live
`.github/workflows/static.yml` pipeline or a real code-level test executed
this session (not a template guess) — see "Verification evidence" per
section.

## Trigger mechanism (verified against `.github/workflows/static.yml`)

The `workflow_dispatch` event on the "Defense survivor Pages release"
workflow accepts one required input, `rollback_revision` (full lowercase
40-character SHA). `resolve_revision` validates it's a real commit and,
for `workflow_dispatch` specifically, that it's an ancestor of
`origin/main` (`static.yml:52-60`) — this prevents rolling forward to an
unmerged/unreviewed SHA by mistake. Every downstream job (`engine_contract`
through `release_receipt`) then runs against that resolved SHA exactly
like a normal push, including a fresh `package_pages`/`deploy_pages` cycle
— **a rollback is a full re-run of every gate against the old commit, not
a partial revert.** If the old SHA fails any gate (e.g. it predates a fix
this cycle relied on), the rollback deploy itself fails closed; it does
not force-deploy a red build.

## When to roll back

- `deployed_smoke` or `release_receipt` fails on a fresh push and the
  failure is not fixable forward within an acceptable window.
- A shipped commit is later found to violate `main_constraint`/IP
  boundaries post-deploy (see `decision-log.md` D8/D13/D14 for this
  cycle's own examples of catching such issues — those were caught
  pre-commit, but the mechanism exists for the post-deploy case too).
- A shipped commit causes a measurable regression not caught by CI (e.g.
  a runtime behavior bug CI's fixed test corpus doesn't cover).

## CRITICAL — verified data-loss hazard when rolling back across this cycle's boundary

**This cycle (`233a9d0` onward) changed the local save schema.**
`campaign-state.js` added 3 keys to every campaign object:
`wardenProgress`, `ownedEquipmentIds`, `companionFormation`. Verified this
session via a real cross-version test (not simulated) — checked out the
actual pre-cycle commit (`2c39fce`) in an isolated `git worktree`, fed a
real new-build `serializeCampaign()` payload into that old commit's actual
`restoreCampaign()`:

```
OLD build restoreCampaign() result on NEW build save: NULL (REJECTED)
```

**Why:** `campaign-state.js`'s `validCampaign()` uses `hasOnlyKeys()` — a
strict validator that rejects *any* unrecognized key, not just missing
required ones. The pre-cycle build's `CURRENT_KEYS` list has no entry for
the 3 new keys, so it rejects the object outright rather than ignoring the
extra fields.

**What actually happens on rollback** (traced through `app.js`/
`defense-storage.js` this session, not assumed):

1. Player has played on the current (RPG-layer) build; their save in
   IndexedDB/localStorage has the new 14-key shape.
2. Operator triggers rollback to a pre-`233a9d0` SHA. Deploy succeeds
   (old code has no dependency on the new keys).
3. Player's browser loads the old app. `initialize()`
   (`app.js:1184-1198`) calls `storage.settleIdleReturn()` →
   `restoreCampaign()` on the existing save → returns `null` (per above).
4. `campaign = settlement.campaign ?? createCampaign()` — a **fresh,
   empty campaign is created in memory.** `initialize()` does **not**
   write anything to storage at this point (verified: no `storage.save()`
   call in the `initialize()` function body) — **the original save on
   disk is untouched and still recoverable at this exact moment.**
5. **The recovery window closes on the player's first action that calls
   `persistCampaign()`** — verified via a full grep of every call site
   (`app.js:411,419,430,441,452,463,510,526,878,1118`): starting a run,
   allocating a stat point, capturing a companion, finishing a stage, etc.
   All of these overwrite the storage slot with the fresh (empty)
   campaign, **permanently discarding the player's original save.**

**The reverse direction is safe and already tested.** A pre-cycle-shape
save loaded by the *current* build round-trips correctly —
`migrateCampaign()` (`campaign-state.js:147-158`) patches in default
values for any of the 6 progressively-added key groups
(`REWARD_KEYS`/`IDLE_KEYS`/`CURRENT_KEYS`) that are missing, verified
live this session and covered by
`tests/defense-campaign-adapter.test.mjs` and the 4-shape migration test
in `tests/campaign-state-rpg.test.mjs`. **Forward deploys are always
safe; only a rollback that crosses this cycle's boundary is not.**

### Mitigation if a rollback crossing this boundary is ever required

1. **Before triggering the rollback**, if at all possible, ship a
   forward-compatible patch to the *target* rollback commit first that
   widens `hasOnlyKeys`/`CURRENT_KEYS` to tolerate (ignore) the 3 new
   keys rather than rejecting them outright — this is a minimal, safe,
   additive change to old code and turns the hazard into a no-op.
2. If that's not possible in the required window, **communicate the
   recovery-window constraint explicitly**: players who don't interact
   with the deployed old build retain their save; the instant any of them
   perform a save-triggering action, that save is gone. There is no
   client-side warning for this today — it fails silently.
3. This hazard applies *only* to players who saved on a `233a9d0`+ build
   before the rollback. A rollback target that predates `233a9d0` and a
   player base that has never loaded a post-`233a9d0` build is unaffected.

## Standard rollback procedure

1. Identify the last known-good SHA (must be an ancestor of `origin/main`,
   per the workflow's own `git merge-base --is-ancestor` check).
2. If the target SHA predates `233a9d0` and any player may have saved on
   a post-`233a9d0` build, apply the mitigation above first, or explicitly
   accept the data-loss risk as a documented decision.
3. Trigger `workflow_dispatch` on "Defense survivor Pages release" with
   `rollback_revision` set to the target SHA.
4. Monitor the run through `release_receipt` — `all_gate_pass` in its
   JSON output (`results/release_receipt.json`) is the single
   authoritative pass/fail signal; a partial gate failure blocks
   `deploy_pages` from having run at all (the DAG is `resolve_revision` →
   `{engine_contract, release_closure, browser_contract}` →
   `package_pages` → `artifact_smoke` → `deploy_pages` →
   `deployed_smoke` → `release_receipt`, all `needs`-gated).
5. Confirm the live URL (`deploy_pages` job's `page_url` output) serves
   the expected `RESOLVED_SHA` via `version.json` (validated automatically
   by `scripts/validate-pages-version.mjs` in both `package_pages` and
   `artifact_smoke`).

## Recovery validation

There is currently no automated post-rollback save-integrity check. A
manual verification step (load the deployed rollback build, confirm
`storage.backend` initializes and an existing session's
`unlockedStageIndex`/`resolvedIds` are as expected if testable) is the
only available signal until such a check exists — flagged as a real gap,
not fabricated as already-covered.

## References

`campaign-state.js` (`validCampaign`/`migrateCampaign`/`hasOnlyKeys`),
`defense-storage.js` (`#decode`/`settleIdleReturn`), `app.js`
(`initialize`/`persistCampaign` call sites), `.github/workflows/static.yml`
(the actual pipeline this runbook describes),
`production/gate-reviews/stage3-review.md` (G6 finding that flagged this
document as missing).
