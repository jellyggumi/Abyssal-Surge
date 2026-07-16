# Static-client architecture and persistence contract

**Navigation:** [production contract](../production/production-contract.md) · [telemetry](../ops/telemetry-contract.md) · [Stage 3 handoff](../production/handoffs/stage-3.md)

## Observed facts

GitHub Pages serves static files; IndexedDB provides asynchronous structured browser storage; Cache stores request/response entries and requires explicit version/purge handling. Sources: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [Cache](https://developer.mozilla.org/en-US/docs/Web/API/Cache).

## Decisions now

- Canonical local state: IndexedDB `campaignSnapshots` (versioned full snapshot) plus `runEvents` and `rewardChoices` records.
- Snapshot envelope includes `state_schema`, `campaign_id`, `stage_id`, reward IDs, capacity, payload checksum/version, and `saved_at`.
- Write protocol: validate next state → write candidate transaction → confirm → retain previous known-good snapshot until replacement is confirmed. On quota/write failure, show recovery UI and retain the prior valid snapshot.
- localStorage holds only settings, last-opened slot, and a recovery pointer. Cache/Service Worker holds only build-versioned shell/assets.
- Export/import uses an explicit versioned envelope; invalid import never replaces valid local state.

## Explicitly later

- **Cloud save:** optional account-backed versioned envelopes after approved Auth/RLS policy, conflict UX, and cross-account isolation test. IndexedDB remains offline cache.
- **Co-op:** invite-only 2-player simulation only after an external authoritative room accepts intent inputs and persists deterministic state/reconnect handling. Client results are never authoritative.
- **APK:** packaging route/device requirements are unchosen; it is a post-Stage-3 release milestone, not an acceptance result.

## State transition safety

All mutation paths must be deterministic and named by [core loop](../design/core-loop.md). Save/load/export/import must operate on the same envelope schema. No anonymous analytics or cache record may become authoritative campaign state.