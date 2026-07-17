# Architecture Contract — Offline Authority and Future Session Boundary

- **Status:** design contract; no backend, identity provider, or multiplayer service is live.
- **Date:** 2026-07-16
- **Audience/action:** enables an engineer to add an authenticated session service without moving deterministic rules into presentation code or treating a static browser client as authoritative.

## Scope and truth labels

| Label | Meaning |
|---|---|
| **[VERIFIED]** | Read from the current repository source or the 2026-07-16 revision intake. |
| **[DESIGN]** | Required integration boundary for a future implementation; it is not running now. |
| **[INFERENCE]** | A design consequence of verified facts, not a feature claim. |

This contract preserves the current local, single-player campaign. It does **not** enable accounts, cloud saves, WebSockets, ranked results, co-op, or anti-cheat today.

## Verified current architecture

1. **[VERIFIED] `campaign-state.js` is the only game authority.** It owns the rules version, the three stages—Cinder Span, Veil Citadel, Echo Throne—state shape, allowed actions, rewards, retries, battle breaches, and save-envelope replay validation. `createSaveEnvelope()` writes `{schema, schemaVersion, rulesVersion, trace}`; `restoreSaveEnvelope()` replays the trace through the same transitions and rejects incompatible or impossible events (`campaign-state.js:1-3, 294-528`).
2. **[VERIFIED] The player loop remains deterministic and ordered:** hunt → extract → materialize → capture → assault, with possession required in Stage 2 and one-use Lord's Domain available in Stage 3 before the relevant assault gate (`campaign-state.js:317-405, 476-489`).
3. **[VERIFIED] `CampaignStorage` is local cache and recovery only.** It attempts IndexedDB and falls back to localStorage, then in-memory storage; browser export/import serializes the same envelope and validates it before saving (`app.js:94-180, 782-786, 917-948`). It is not a remote canonical store.
4. **[VERIFIED] `BattleVisualizer` is presentation only.** Its header explicitly excludes engine-facing transitions. It renders tactical choreography and may emit a visual breach callback; `app.js` alone converts that callback into the recorded `applyBattleBreach()` transition. The visualizer does not own campaign state or save state (`battle-visualizer.js:1-15, 128-137`; `app.js:855-867`).
5. **[VERIFIED] The deployed product is a static GitHub Pages client.** As verified on 2026-07-17, the current Playwriter/release target is `https://jellyggumi.github.io/Abyssal-Surge/`; the release reflection records the repository rename, successful Pages deployment, and public campaign response there. The 2026-07-16 `https://jellyggumi.github.io/Abyssal-Command/` source-packet URL is historical provenance, not a current release endpoint (`qa/release-reflection-result.json:42-61`).

## Authority invariant

> A game-state transition is valid only when the pinned `campaign-state.js` rules accept it. Presentation, browser storage, imported files, and future transport adapters may request or persist a transition; none may define or silently alter it.

For the offline game, the browser executes that authority locally and persists a replayable trace. **[INFERENCE]** A client can reject invalid traces but cannot prove that a rules-valid trace was played by a person; it therefore cannot be authoritative for ranked or shared outcomes. Future multiplayer must move command validation and canonical revision assignment to a server-side runtime that imports the pinned rules package.

## Provider-neutral, Convex-first boundary [DESIGN]

The domain vocabulary below is provider-neutral. A first adapter may use Convex queries, mutations, subscriptions, and scheduled cleanup, but `campaign-state.js` must not import Convex, browser OIDC SDKs, or provider types. Keep the adapter behind a `GameSessionTransport` port so another authenticated server can provide the same contract later.

```text
Browser input / BattleVisualizer callback
             │  Command request only; never a client-written snapshot
             ▼
     GameSessionTransport (Convex-first adapter)
             ▼
        submitCommand (single authoritative mutation)
             │  authenticate → authorize → idempotency → revision check
             │  restore pinned rules envelope → apply transition → append event
             ▼
Session / Profile / RoomSnapshot / Presence / Command / GameEvent
             │
             ├── authoritative snapshot and event stream [future service]
             └── local CampaignStorage remains an offline cache/export path
```

### Required domain records

These records are a schema contract, not an existing database schema.

| Record | Minimum immutable/validated fields | Purpose and authority |
|---|---|---|
| `Profile` | `profileId`, `subject`, `displayName`, `createdAt`, `updatedAt`, `schemaVersion` | Maps a verified OIDC subject to optional minimal display data. `subject` is server-derived, never accepted from the browser. |
| `Session` | `sessionId`, `rulesVersion`, `mode`, `ownerProfileId`, `memberProfileIds`, `status`, `createdAt`, `updatedAt` | Names one offline-sync or invite-only room. `mode` begins with `offline-sync`; no public matchmaking is implied. |
| `RoomSnapshot` | `sessionId`, `revision`, `rulesVersion`, `envelope`, `updatedAt`, `stateHash` | Canonical serialized envelope and monotonically increasing revision. It is written only by `submitCommand`. `stateHash` is SHA-256 of a canonical JSON serialization defined by the implementation, not an unverified client hash. |
| `Presence` | `sessionId`, `profileId`, `connectionId`, `lastSeenAt`, `expiresAt` | Ephemeral connection indication only. It must not grant membership, issue commands, or determine a game result. |
| `Command` | `commandId`, `sessionId`, `actorProfileId`, `expectedRevision`, `kind`, `payload`, `receivedAt`, `outcome`, `resultRevision` | Idempotency/audit record. Its actor is server-derived. Do not store secrets or a full client state payload. |
| `GameEvent` | `eventId`, `sessionId`, `revision`, `commandId`, `kind`, `rulesVersion`, `traceEvent`, `occurredAt` | Append-only accepted-transition audit event. `traceEvent` matches a supported save-trace event, not arbitrary presentation telemetry. |

**Privacy boundary [DESIGN]:** retain only session data required for the feature; do not upload local campaigns merely because an account exists. Define retention, deletion/export handling, and access policies before enabling `Profile` or `Session`. Presence is short-lived and must expire automatically.

### Single authoritative command contract

All future state-changing requests use exactly one server-side operation:

```ts
// Domain transport, not a claim about an installed Convex API.
type CommandKind =
  | { type: "start" }
  | { type: "action"; action: "hunt" | "extract" | "materialize" | "capture" | "possess" | "domain" | "assault" }
  | { type: "reward"; rewardId: string }
  | { type: "retry" }
  | { type: "battle-breach" };

type SubmitCommandInput = {
  sessionId: string;             // server-validated session identifier
  commandId: string;             // UUID/ULID; idempotency key scoped to session
  expectedRevision: number;      // non-negative integer
  command: CommandKind;
};

type SubmitCommandResult = {
  accepted: boolean;
  code: "accepted" | "duplicate" | "unauthenticated" | "forbidden" | "not-found"
      | "rules-version-mismatch" | "revision-conflict" | "invalid-command" | "terminal-session";
  message: string;               // safe player-facing explanation; no server internals
  revision: number;              // existing revision on non-accepted outcomes
  snapshot?: { rulesVersion: string; envelope: unknown; stateHash: string };
  eventId?: string;
};
```

`submitCommand(input)` MUST execute atomically in this order:

1. Resolve the caller identity from the verified server/OIDC context. Reject `unauthenticated`; do not accept `actorProfileId`, `subject`, or room membership from input.
2. Load `Session`; confirm the caller is a current member and the session is command-accepting. Reject `forbidden`, `not-found`, or `terminal-session` without mutation.
3. Look up `(sessionId, commandId)`. If present for the same actor and payload, return its stored result (`duplicate`); if reused with different content, reject it as `invalid-command` and record an abuse signal outside the game trace.
4. Load `RoomSnapshot`, require exact `rulesVersion === RULES_VERSION`, and require `expectedRevision === snapshot.revision`. On conflict return the current revision plus a safe resync snapshot; do not replay against stale client state.
5. Validate the command union. Restore `snapshot.envelope` through the pinned server-side `restoreSaveEnvelope()`, map only the declared command type to `startCampaign`, `applyAction`, `chooseReward`, `retryStage`, or `applyBattleBreach`, and require `result.accepted === true`.
6. Build a fresh envelope with `createSaveEnvelope(result.state)`, increment revision by exactly one, calculate the canonical `stateHash`, write `RoomSnapshot`, write the `Command` result, and append exactly one `GameEvent` in one transaction.
7. Publish the returned snapshot/event only after the transaction commits. A transport failure before commit must leave no new event; a failure after commit is retried through the same `commandId`.

**Non-negotiable:** the mutation accepts commands, not `CampaignState`, a browser save envelope, damage totals, reward effects, revision values to assign, or a declared winner. `BattleVisualizer` callbacks must become an explicit `battle-breach` command; visual animation never directly alters `RoomSnapshot`.

### Convex-first adapter responsibilities [DESIGN]

| Boundary | Convex-first responsibility | Provider-neutral requirement |
|---|---|---|
| Read model | Query session/snapshot/event data permitted to the authenticated caller. | Caller access is checked server-side; browser reads cannot bypass policy. |
| Command path | One Convex mutation implementing `submitCommand`. | One transaction produces one canonical revision or no mutation. |
| Live projection | Subscribe to accepted snapshot/event updates. | Subscription is a projection; it cannot authorize or apply a transition locally. |
| Presence | Store TTL/heartbeat metadata separately from state. | Presence expiry cannot change campaign state. |
| Rules execution | Bundle/import a version-pinned deterministic rules module in server runtime. | Identical rules version is validated before replay; a new rules version has an explicit migration/season policy. |
| Offline continuity | Browser may queue commands with `commandId` and resubmit after reconnect. | On revision conflict, fetch canonical snapshot and require an explicit rebase/retry; never merge state fields. |

## Activation prerequisites — currently unavailable

This boundary remains documentation until all of these are supplied and verified:

1. **Convex:** a provisioned project/deployment URL, server deployment credentials, generated client bindings, schema/index definitions, and a server-side package/runtime that can import the pinned deterministic rules module.
2. **OIDC:** issuer discovery URL, audience, client ID, approved redirect/logout URLs, JWKS validation configuration, subject-to-Profile mapping, and verified token validation in the chosen backend. No browser token or provider key is an authority substitute.
3. **Access and operations:** Session membership/invitation policy, rate limits, retention/deletion/export policy, monitoring owner, incident/rollback runbook, and a separate secret store for deployment credentials.
4. **Rules compatibility:** a published mapping from `RULES_VERSION` to the server rules artifact/hash, tests for replay parity, and an approved policy for old save/session versions.
5. **Evidence:** two-identity authorization tests, unauthenticated rejection, duplicate-command idempotency, stale-revision conflict/resync, reconnect, desync, abuse/rate-limit, and rollback evidence.

The local environment check on 2026-07-16 found no `CONVEX_URL`, `OIDC_ISSUER_URL`, or `OIDC_CLIENT_ID` configuration. No Convex project, OIDC configuration, or authenticated command service is therefore asserted to exist.

## Implementation sequence and gates [DESIGN]

1. Extract the deterministic rules module into a server-importable package **without changing its public local behavior**; retain `campaign-state.js` as the game rules source.
2. Implement adapter schema and `submitCommand` transaction with no multiplayer UI enabled.
3. Prove replay parity using accepted traces for all three stages, including Stage 2 possession, Stage 3 one-use Domain, and invalid assault gates.
4. Add auth and two-identity authorization tests; do not fall back to a client-provided profile ID.
5. Add opt-in session UI only after service availability, privacy, reconnect, and rollback gates pass.

A failure at any activation gate leaves the shipped game in its verified local-first mode: CampaignStorage plus manual export/import. It must not be represented as degraded authoritative multiplayer.

## References

- Local source: `campaign-state.js`, `app.js`, `battle-visualizer.js`, `sw.js` (read 2026-07-16).
- Revision intake: [`../intake/production-brief.md`](../intake/production-brief.md) (read 2026-07-16).
- Existing research evidence: [`../../20260716-shadow-lord-rts-rpg/engineering/tech-verification/db-multiplayer.md`](../../20260716-shadow-lord-rts-rpg/engineering/tech-verification/db-multiplayer.md) (read 2026-07-16).
- External implementation references, consulted 2026-07-16: [Convex authentication](https://docs.convex.dev/auth), [Convex mutations](https://docs.convex.dev/functions/mutation-functions), [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html), [GitHub Pages static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
