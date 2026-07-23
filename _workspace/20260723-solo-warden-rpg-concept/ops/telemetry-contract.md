# Telemetry contract — Solo Warden RPG layer

Scope: the 5 new event types `defense-run-simulation.js` began emitting in
this cycle (233a9d0), verified against 9/9 pass in
`tests/defense-observers-contract.test.mjs` plus a live browser smoke test
this session. All events flow through the same local, offline-only
`emit()` pipeline as every pre-existing event type — **nothing about the
transport, storage, or export boundary changed this cycle.** See the base
telemetry/observer architecture in `defense-telemetry.js` for the
unchanged contract (local IndexedDB/localStorage export only, no network
transport, no PII, no remote collection — this repo has never had a
telemetry backend and this cycle did not add one).

## New event types (verified against source, not inferred)

| Event | Emitted from | Payload fields | Trigger |
|---|---|---|---|
| `COMPANION_DAMAGED` | `defense-run-simulation.js:1163,1531` | `enemyId`\* or `owner`\*, `entityId`, `companionId`, `damage`, `hp`, `maxHp`, `policyId`\* | A companion actor (FRONT or BACK slot) takes damage from either enemy contact/ranged attack or a projectile |
| `COMPANION_DOWNED` | `defense-run-simulation.js:1166,1534` | `entityId`, `companionId`, `policyId`\* or `owner`\* | `COMPANION_DAMAGED` reduces a companion's `hp` to 0 while `status === "ACTIVE"`; status transitions to `"DOWNED"` (run-scoped, not permanent — see `campaign-state.js` `captureElite` for the permanent-roster boundary this never touches) |
| `BOSS_RALLY_WINDOW` | `defense-run-simulation.js:349` | `bossId`, `entityId`, `cooldownReductionBp` | Boss spawns while >=1 FRONT companion has `status === "ACTIVE"`; all active companions' cooldowns reduce by `BOSS_RALLY_COOLDOWN_REDUCTION` (20%, `rpg-catalog.js`) |
| `WARDENS_WARD_TRIGGERED` | `defense-run-simulation.js:455` | `entityId` (commander), `shield`, `hp` | Warden trait `wardensWard` (one-time, `wardensWardConsumed` gate) fires when commander integrity crosses its threshold ratio |
| `ECHO_WARDEN_AWAKENING_TRIGGERED` | `defense-run-simulation.js:462` | `entityId` (commander) | Warden trait `awakeningReset` (one-time, `awakeningResetConsumed` gate) fires at low-integrity threshold; resets all companion cooldowns |

\* `enemyId`/`owner` and `policyId` are mutually exclusive depending on
whether the damage source was a direct enemy contact attack or a fired
projectile — this asymmetry is pre-existing in the emit call sites (not
introduced this cycle) and is intentional: projectiles don't carry a live
`policyId` reference after the source enemy may have moved/died.

## Verification evidence

- Shape/emission correctness: `tests/defense-observers-contract.test.mjs`
  (9/9 pass, includes all 5 new types).
- Determinism: `tests/defense-run-simulation-rpg.test.mjs` — `getRunDigest`
  byte-identical across two `createDefenseRun` calls with identical seed
  and full RPG params (proves telemetry observation is side-effect-free on
  simulation state, per `defense-run-simulation.js`'s existing "rendering,
  telemetry, and audio observation leave the simulation digest unchanged"
  test).
- Live smoke: this session, growth-panel interactions in a real headless
  browser session confirmed events fire with correct field shapes end to
  end (stat allocation → `COMPANION_DAMAGED`-adjacent formation state
  changes observable in `getRunSnapshot().companions`).

## What this document does not cover

- Pre-existing event types (`ENEMY_SPAWNED`, `WEAPON_FIRED`, `TERMINAL`,
  etc.) — unchanged this cycle, not re-audited here.
- PM-forecast telemetry fields — this cycle has no PM lane; `pm/` was not
  populated for `20260723-solo-warden-rpg-concept` (see `task-manifest.md`
  scope note: this run started as Stage1-implementation-only, not a full
  15-lane brainstorm cycle).
- A remote telemetry backend — does not exist, was never proposed this
  cycle, and `campaign-state.js`/`defense-storage.js` remain 100%
  client-local (IndexedDB → localStorage → in-memory fallback chain,
  `defense-storage.js:84-121`).
