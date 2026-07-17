# ADR: staged multiplayer, database, and media-production boundary

- **Status:** accepted for the static campaign
- **Date:** 2026-07-16
- **Audience/action:** production and engineering use this record to decide when a service or new media pipeline may enter scope.

## Context

The published campaign is a deterministic, offline GitHub Pages game. Its versioned save envelope is replay-validated locally and already supports JSON export/import. That validation rejects invalid traces, but cannot prove that a rules-valid trace was played by a person; it is not an authority or anti-cheat service. The measured 32-event restore mean was 0.349 ms and the adversarial 200-event compressed share envelope was 679 characters.[^research]

## Decision

| Phase | Accepted scope | Explicit boundary |
|---|---|---|
| **P0 — now** | Local deterministic campaign state plus existing export/import recovery. Optional friend sharing remains non-authoritative. | No database, account, telemetry service, WebSocket, cloud save, ranked result, or anti-cheat claim. |
| **P1 — after demonstrated demand** | Supabase **profiles only**, with opt-in accounts and RLS enabled and tested for every exposed table.[^supabase] | No automatic migration of local campaign traces or saves to the cloud; no collection of raw event traces by default. Demand must be evidenced and accepted by product authority before implementation. |
| **P2 — invite-only co-op** | A Cloudflare Worker with one Durable Object room is the smallest acceptable authoritative server: it owns room membership, validates accepted actions against the pinned rules version, and publishes canonical room state.[^cloudflare] | Release only after reconnect, desync, hibernation, abuse, and invitation-expiry behavior are evidenced. GitHub Pages remains the client host; the Worker is a separately operated service. |
| **Deferred** | Nakama is deferred until high-trust or fair multiplayer actually requires its broader server/matchmaking and operational surface. | It is not a P0/P1 substitute and is not selected merely to label client validation as authoritative. |

## Privacy and data minimization

- **Default is local-first:** P0 retains campaign data in the browser and lets the player explicitly export/import it; a share code is not a user account.[^storage]
- **P1 minimum data:** an opt-in account identifier, display profile fields needed for the feature, and the minimum server-side authorization metadata. Do not upload campaign traces, device identifiers, contact lists, or analytics payloads by default.
- **Before P1 release:** document the purpose of every stored field, the retention/deletion path, export/delete request handling, consent/copy, and incident owner. Prove row isolation with RLS tests using at least two identities and an unauthenticated request.
- **Before P2 release:** keep invite and room identifiers short-lived, minimize server logs, set a retention policy, and ensure authorization is evaluated server-side rather than trusting client-submitted outcomes.

## Release gates

1. **P0:** exported and imported envelopes must restore only compatible schema/rules versions; invalid input must fail through the existing recovery UX. No shared trace may unlock a global reward or ranking.
2. **P1:** product-demand evidence and external authority approval; data inventory and privacy review; RLS policy and isolation proof; account deletion/export workflow; offline and conflict behavior acceptance; operations ownership for provider availability and quotas.
3. **P2:** the P1 gates still apply, plus authoritative action validation, invite-only access tests, reconnect/desync/hibernation evidence, abuse/rate-limit plan, service monitoring, rollback/runbook, and a clear statement that the co-op service—not the static client—owns the canonical result.

## Production-media policy (prospective only)

- New **non-sprite stills** use GodTiboImagen.
- Future **concept-style sprites** use the PerfectPixel methodology at 16 fps.
- Video-pipeline migrations remain pending until source-approved renders are supplied; no migration is implied by a prompt, an existing video, or an unsourced output.
- Audio remains a separately generated, source-approved asset process; existing audio is not certified by this prospective policy.
- This policy is not retroactive: existing resources are not asserted to meet it.
- Blender MCP probes timed out and `blender --version` is unavailable in this production environment. No mesh, rigging, animation, or other Blender result is claimed by this record.

## Consequences

This preserves the static campaign's zero-service P0 while making the authority boundary explicit. P1 adds privacy and operational duties even for profiles. P2 adds a separately deployed, monitored service; it is intentionally blocked until the stated evidence exists. Nakama remains an evaluated future option rather than an unsupported dependency.

## Sources

[^research]: Internal deep-research evidence: [DB & multiplayer verification](../engineering/tech-verification/db-multiplayer.md), §§1–6 (local replay limits, measurements, phased options, and failure modes).
[^supabase]: Supabase, [pricing](https://supabase.com/pricing) — supplied research source for hosted-service limits; the evidence record requires RLS before any static-client database exposure.
[^cloudflare]: Cloudflare, [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) — supplied research source for Durable Object operating limits.
[^storage]: MDN, [Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — supplied research source for browser-local storage behavior.
