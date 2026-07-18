# Medieval Battle Presentation — Stage 3 Follow-on Manifest

## Cycle

- **Run ID:** `20260718-medieval-battle-presentation`
- **Operating mode:** Stage 3 presentation / play-impact refinement.
- **Next public beat:** A Stage 1 battlefield where issuing the current order is acknowledged without obscuring or taking ownership of tactical input, including at 360px and under reduced motion.
- **Entry decision:** Continue from the completed additive field-command baseline. Do not reopen Stage 2: this cycle changes no balance, core loop, rewards, stage transitions, or campaign persistence.

## Immutable constraints

1. `campaign-state.js` and the existing `app.js` command handlers remain the sole owners of accepted action state, cooldowns, traces, and persistence.
2. The overlay is passive except for the already-existing native command proxy. No synthetic canvas event, new command, shortcut, touch-rally path, or parallel control path is permitted.
3. No renderer seam is opened in this cycle. World-locked routes, target picks, breach markers, and native touch group-rally remain deferred.
4. Dynamic copy must come only from the current command button or existing public HUD nodes. No cooldown, ETA, reward, damage, or outcome claim may be invented.
5. A scoped G1/G4/G6 PASS is never a full-game gate pass; missing human, telemetry, rollback, and soak evidence remains `NOT SCORED`.

## Work items

| ID | Stage | Owner | Status | Player-visible contract | Files allowed | Gate linkage | Verification |
|---|---|---|---|---|---|---|---|
| P1 | 3 | game-programmer + game-qa | **verified PASS** | **Order Seal:** an enabled field-proxy activation displays one passive `Order relayed — {command}` receipt derived from that exact existing command, while the proxy updates to the next engine-selected objective. | `battle-field-command-overlay.js`, `battle-field-command-overlay.css`, focused overlay/browser tests | scoped G1, G4, G6 | `qa/gate-measurements.md` — 2026-07-18 Order Seal P1 focused evidence addendum |
| P2 | 3 | game-programmer + game-qa | **verified PASS** | **Compact Consequence:** at 360px the current command's existing consequence remains visible for one line while the 48px proxy and blank-canvas input reachability persist. | `battle-field-command-overlay.css`, focused browser tests | scoped G1, G4, G6 | `qa/gate-measurements.md` — 2026-07-18 Compact Consequence P2 verification addendum |

## PASS / FIX protocol

- **P1 PASS:** the receipt reflects the one native proxy action, creates no second input target, does not mutate rules or traces beyond the native action, and the proxy follows the next marked command in a real browser.
- **P1 FIX:** stale/mismatched receipt, duplicate/parallel action, canvas interception, client error, or absent focused evidence.
- **P2 PASS:** compact consequence is visually nonempty, the proxy is at least 48×48 CSS px and owns its center hit-test point, a blank field point still targets the canvas, reduced-motion retains critical copy, and P1 remains green.
- **P2 FIX:** horizontal overflow, hidden/missing consequence, new hit target, input ownership break, animation-dependent state, P1 regression, client error, or absent focused evidence.

## Evidence record

After each PASS/FIX decision, update `qa/gate-measurements.md` with the exact command, observed result, scope, and missing full-gate evidence. At cycle close, write `retrospectives/cycle-2-retrospective.md` with measured results, unresolved risks, and the next-stage entry decision.
