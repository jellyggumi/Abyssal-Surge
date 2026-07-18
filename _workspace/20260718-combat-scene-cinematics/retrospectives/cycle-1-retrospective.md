# Cycle 1 Retrospective — Combat Scene Cinematics

**Run ID:** `20260718-combat-scene-cinematics`
**Mode:** Stage 1 only (presentation/resource-completion sub-cycle; no Stage 2/3 balance or ops work this cycle — the request was scoped to sensory/production-value polish of an already-functional combat system).

## Gate table

| Gate | Verdict | Evidence |
|---|---|---|
| G1 (narrative consistency) | PASS (self-check, no new content) | `design/presentation-spec.md#g1-gate-self-check` |
| G2 (balance numbers) | Carry-forward, not touched | `qa/gate-measurements.md#g2` |
| G6 (technical stability) | **PASS** | `production/gate-reviews/stage1-g6.md` — 144/144 tests, live browser verification, independent code review with all findings fixed |
| G7 (core loop) | Carry-forward, not touched | `qa/gate-measurements.md` |
| G8 (novelty) | Not applicable (presentation polish, not new content) | `design/presentation-spec.md#novelty-g8` |

## What shipped
1. Pooled particle field (360-capacity, point-sprite, zero new assets) and real 3D positional Web Audio in the primary WebGL combat renderer — previously silent on both fronts.
2. Camera micro-shake and brief hit-stop on heavy impacts, correctly composing (not resetting) across overlapping pulses.
3. Movement feel: footstep dust, surge trail, ambient drifting motes.
4. Boss/unit/prop mesh silhouettes sharpened via bevel-only modifiers on 70 previously-untreated parts across all 15 shipped GLBs, matching the pack's existing flat-shaded low-poly idiom (subsurf explicitly tested and rejected as fighting the established art direction).
5. Re-rendered 8-directional sprite atlases for the Canvas 2D fallback from the beveled source meshes, keeping both render paths visually consistent.
6. Fixed a Critical defect (boss-defeat VFX was unreachable dead code — boss HP was never synced from campaign state into the renderer) plus two Major defects (camera-shake envelope reset spike; a silently-dropped rally-to-commander behavior) found by independent code review and confirmed live in the actual running game before being closed.

## What went well
- **The 5-agent harness structure held up under real parallelism.** Blender GLB work ran as a genuinely independent background lane (`BlenderBevelPass`) while VFX/audio/camera code proceeded in the foreground; both landed and reconciled cleanly.
- **QA broadcast discipline caught something unit tests alone could not.** The independent code-review pass found the boss-defeat dead-code defect because it read the actual call graph end-to-end (campaign-state → app.js → renderer), not just the renderer's own internal method contracts in isolation. The subsequent live-browser re-verification (real UI clicks, real boss health 8→5→2→0, prototype-patched `defeat()` confirming the exact `{isBoss:true}` transition) is the standard this harness should hold to for any "did the dramatic moment actually fire" claim going forward.
- **Concurrent third-party work was investigated, not reverted.** Mid-cycle, a separate contributor's changes appeared in the shared working tree (an `emitActionFeedback` refactor, a current-objective UI feature, and two real bug fixes unrelated to this session's scope). Rather than treat this as corruption, it was read in full, verified non-destructive, confirmed correct via the full test suite and a live smoke test, and integrated as legitimate parallel collaboration — matching the user's own "let's work in parallel" framing.
- **A cancelled subagent's incomplete report was independently re-verified rather than trusted or discarded.** `BlenderBevelPass` was cancelled mid-completion-report after 56 minutes, but its actual file changes were already committed. Every claim it would have made in that report (animation order, subsurf-zero, vertex/NaN integrity) was independently re-derived from the actual on-disk GLB files and a fresh headless-Blender inspection, catching that its own "animation reordering" concern was a false alarm from an isolated control test — not present in the real shipped exports.

## What was harder than expected
- **A subagent's self-reported findings, even careful ones, need independent re-verification before being trusted as gate evidence.** `BlenderBevelPass`'s animation-reordering concern turned out to not apply to the real shipped files, and its report was never delivered (cancelled mid-write) — the director had to reconstruct the full verification picture from scratch via direct GLB/`.blend` inspection. This cost real time but is exactly the harness's G6 "no adjective ever passes a gate" discipline working as intended.
- **The most impactful defect (boss-defeat dead code) was invisible to unit tests entirely** because the tests exercise `RealtimeBattle`'s methods directly with hand-built semantic objects, never the real `campaign-state.js` → `app.js` → renderer wiring a player's click actually traverses. This is a structural gap worth naming for future cycles: renderer-level unit tests prove a method behaves correctly *when called*; they cannot prove the method is ever *actually called* by the real integration. The fix (a live-browser playthrough exercising the real production code path) is now documented in `production/gate-reviews/stage1-g6.md` as the correct standard for any future "does this dramatic moment actually fire" claim.

## Unresolved risks / carried forward
- None newly introduced this cycle. Stage 4-10 boss reuse remains a documented resource-budget waiver from the prior cycle (`20260717-combat-resource-parity/design/presentation-spec.md`) — dedicated per-stage boss models remain future work, out of scope here.
- The zoom/wheel-event interaction did not respond to synthetic `WheelEvent`/mouse-wheel dispatch in the headless browser during final visual verification. This is very likely a headless-Chromium synthetic-event quirk (passive listener timing), not a regression — the underlying `updateCamera`/zoom code was not touched this cycle and all camera-shake unit tests pass. Not blocking, but worth a real-device spot-check before the next public beat if zoom interaction itself becomes a focus area.

## Next-cycle entry decision
**Stage 2 retune**, not a fresh Stage 1 concept shift. The combat scene's presentation layer is now feature-complete and verified for this scope (movement, collision, terrain, animation, controls, sound, hit effects, particle effects — the full list from the original request). A future cycle should enter at Stage 2 if further balance/core-loop work is desired, or treat this as the closing polish pass for the current release if no further scope is planned. `_workspace/20260718-combat-scene-cinematics/` remains intact as the studio's memory for either path.
