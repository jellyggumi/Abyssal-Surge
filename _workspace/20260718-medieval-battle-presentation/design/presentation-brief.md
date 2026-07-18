# Medieval Battle Presentation — Stage 1 Design Brief

## Decision

Add a **field-command overlay** as an isolated DOM/CSS presentation layer, attached only through the currently clean `index.html`. It makes the first active objective, hostile ingress, loss point, current order, and command consequence readable on the battle field without changing campaign rules, battle state, renderer input ownership, or the user's active work in `app.js`, `battle-realtime-three.js`, `battle-visualizer.js`, and `styles.css`.

This is a first-glance remedy, not a claim of renderer-level topology or touch group-rally parity. A later renderer seam is required for world-locked path previews and native touch group-rally.

## Evidence

- **Field-first composition:** Stronghold documents a central playfield with management and quick-view systems separated from it. Keep the tactical field central and decision detail at the edge. Source: <https://store.steampowered.com/manual/2140020>.
- **Cross-input command parity:** Age of Empires IV compresses RTS commands for controller input without discarding keyboard/mouse support. The overlay must use semantic buttons and existing command actions; it must not add a parallel ruleset. Source: <https://news.xbox.com/en-us/2023/08/22/age-of-empires-iv-console-edition/>.
- **Persistent fight-critical state:** Warcraft III makes health bars and cooldown numbers always-on while lower-priority telemetry is optional. The overlay keeps objective, integrity/loss point, hostile state, and selected command visible; verbose operations remain in existing details. Source: <https://news.blizzard.com/en-us/article/24167122/warcraft-iii-reforged-patch-notes-patch-2-0-0>.
- **Source-linked alerts:** Against the Storm adds nearby-source progress and navigation context. The overlay names each problem and its response route rather than showing abstract warning color alone. Source: <https://store.steampowered.com/news/app/1336490/view/677376450273219167>.
- **Accessibility constraint:** Every UI area must be operable with the gameplay input method. The overlay uses a native command proxy and never intercepts ordinary canvas navigation; it preserves keyboard, pointer, and touch activation that the existing button already supports. Source: <https://gameaccessibilityguidelines.com/ensure-that-all-areas-of-the-user-interface-can-be-accessed-using-the-same-input-method-as-the-gameplay/>.

## Stage 1 Screen Contract

### Persistent field layer

1. **Ashen Marches standard** — a top-left herald announces the current order, maps the state to the named command button, and invokes that button on activation.
2. **Breach watch** — a top-right iron plaque names the hostile source and battle pressure. It explicitly states that the gate/integrity is the loss point.
3. **Command route** — an SVG line joins the player-side ward to a passive objective landmark. It is a HUD diagram, not a renderer-world coordinate claim.
4. **Order consequence** — a bottom field placard says only the existing, visible consequence of the current command; it does not synthesize cooldowns, ETA, or battle-state facts.
5. **Material grammar** — weathered iron, ash, parchment, ember, heraldic banner silhouettes, and siege-gate/ward vocabulary. No copied game art, no new assets, no rename of existing game concepts.

### Input and motion invariants

- The overlay root is `pointer-events: none`; only the native command proxy is actionable.
- Proxy activation calls the existing `#action-${action}` button. It does not import private `app.js` state or synthesize canvas pointer events.
- `MutationObserver` watches the selected command state and source DOM text; render updates are batched with `requestAnimationFrame`.
- In `prefers-reduced-motion`, the command route and standard remain static. No unique state is encoded by motion.
- The module is defensive: unavailable field or command panel means no render and no exception.

## Explicit Non-goals

- No campaign-rule, cooldown, reward, unit-stat, or stage-transition changes.
- No map picking, 3D camera projection, renderer landmark replacement, or visual effect ownership changes.
- No native touch group-rally claim: it needs a renderer-supported mechanism, not synthetic right-click events.
- No resource queue, economy, minimap, or full topology simulator.

## Acceptance Criteria

1. In Stage 1, the active command is visible in the battle field, the objective has a readable consequence, and one activation route reaches the existing command button.
2. The breach watch visibly identifies the hostile state and the gate/integrity loss point.
3. A command-state change changes the overlay's current-order text and button destination without rule-state mutation outside the existing button handler.
4. Canvas pointer interactions still reach `#battle-canvas-3d` outside the explicit proxy button.
5. At 360px width, field labels remain readable and the proxy target is at least 48 CSS pixels in both dimensions.
6. Reduced-motion mode retains all objective, hostile, loss-point, and consequence text without animation.
7. The overlay stylesheet/module are part of the service worker's core asset list, or their absence degrades safely without breaking the battle screen.

## Deferred Renderer Seam

Expose either native long-press group-rally or a documented custom event from `battle-realtime-three.js`; only then add a touch Rally mode. World-locked routes, boss/objective picks, and breach markers also belong to that renderer seam.

## Stage 3 Follow-on Cycle — Two Verified Presentation Slices

**Entry stage:** Stage 3 — presentation and play-impact only. The prior overlay subset review does
not reopen combat balance, progression, save persistence, or renderer authority.

**Cycle bounds:** Both slices must keep `campaign-state.js` and the existing `app.js` action
handler as the sole owners of accepted actions. They must not add an action, a shortcut, a
cooldown/reward/ETA claim, a canvas gesture, a world-coordinate contract, or a second animation
loop. Their only dynamic command facts come from the existing command button and public HUD text.

### Iteration 1 — Order Seal

**Player promise:** After an enabled field proxy invokes its existing command button, the field
shows one passive, persistent receipt: `Order relayed — {current command name}`. It proves only
that the proxy relayed its native button activation; it does **not** assert that a cooldown,
target, encounter, or transition completed.

- The receipt derives its action/name from the same `activeCommand` and command `<strong>` already
  used by the proxy. It is initially absent and replaces, rather than stacks with, the previous
  receipt after the next proxy action.
- It is visible text with `role="status"` / polite live announcement, but is not focusable and
  has no pointer events. `.ashen-field-command__activate` remains the overlay's only actionable
  control.
- The existing `MutationObserver` must still advance the proxy's name, consequence, `data-action`,
  and accessible name when the engine changes the current objective. The receipt records the
  issued command while the proxy points at the next command.
- At 360px the receipt has one readable line without horizontal overflow or a second hit target.
  Under reduced motion it remains static; no animation may encode its state.

**Acceptance proof:** In the real Stage 1 browser flow, proxy Hunt appends exactly one existing
`{ kind: "action", action: "hunt" }` trace event and exposes the Hunt receipt. After the normal
objective changes to Extract, focusing the same proxy and pressing Enter invokes exactly one
existing Extract command. Canvas input outside the proxy remains canvas-owned.

### Iteration 2 — Compact Consequence

**Player promise:** At 360 CSS pixels, the field keeps a visible one-line consequence from the
current command's existing `<small>` copy. The hostile/ward/current-objective panels and the
48px-or-larger proxy remain reachable; the compact view may hide only secondary pressure prose.

- Reuse the current consequence text; do not synthesize a tactical explanation or duplicate a
  control. If constrained, visual truncation may shorten ornamentation but the proxy's accessible
  name must retain the full existing command name and consequence.
- The compact rule changes presentation CSS only. It neither calls the renderer nor changes
  campaign state, action availability, the public save trace, or fallback behavior.
- In reduced-motion mode, objective, hostile, ward/integrity, visible consequence, and proxy
  accessible name remain nonempty with no overlay animation or transition.

**Acceptance proof:** A fresh 360px Stage 1 browser context proves the proxy is visible, owns its
center hit-test point, measures at least 48px on both axes, and leaves a sampled blank battlefield
point owned by `#battle-canvas-3d`. A reduced-motion context proves the same critical field copy
without a continuous overlay frame loop or browser errors.

### Evidence and gate discipline

Each iteration requires its own test result, real-browser observation, and scoped G1/G4/G6 verdict
in `qa/gate-measurements.md`; a later slice cannot borrow earlier evidence for new behavior.
Full G1, G4, and G6 remain **NOT SCORED** unless a whole-game worldview trace, human immersion /
latency evidence, and telemetry/rollback/performance-soak evidence are actually collected.