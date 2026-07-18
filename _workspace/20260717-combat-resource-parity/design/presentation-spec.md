# Combat Resource Parity — Presentation / Resource Decision (Stages 4-10)

**Status:** Design decision made and implemented this cycle by the director acting in the designer role, given the well-scoped nature of the defect (asset-identity correction, not new concept work). Documented here for traceability per the harness artifact contract.

## Problem

Abyssal Surge ships 10 campaign stages but only 3 authored boss GLBs (`cinder-warden`, `veil-tactician`, `gate-sovereign`) and 3 terrain GLBs. Stages 4-10 were designed (per code comments already in `battle-realtime-three.js`) to reuse these three sets, with "per-stage identity com[ing] from the presentation palette, heightfield, and 2D boss portraits" — but a stage-number clamp bug meant this reuse never actually activated; instead every stage past 3 rendered as Echo Throne/Gate Sovereign outright, which is a straightforward G1 (narrative consistency) violation: the HUD names one boss, the field shows another.

## Decision

1. **Terrain reuse is kept as originally designed** (`STAGE_ASSETS[4..10].terrain`), now actually reachable after the clamp fix. Terrain carries no boss-identity claim — the resource-bible's stage key art (7 unique backdrop PNGs, already shipped) and unique per-stage palette (`battle-presentation.js`, already complete for all 10 stages) carry the location identity instead.
2. **Boss identity is corrected two ways, both zero-new-asset:**
   - **WebGL renderer:** the reused boss GLB mesh is now tinted at instantiation with the stage's own `palette.hostile` color (55% color lerp + emissive glow) via a new `applyBossIdentityTint()` method, so a Cinder Warden mesh reused for Stage 8 does not read as visually identical to Stage 1's Cinder Warden — distinct color signature per stage, cheap (one material clone pass on a single boss instance), no perf regression.
   - **Canvas 2D fallback:** extended `BOSS_ART` (stages 4-10 → their own shipped boss portrait PNGs, e.g. `boss-tide-warden.png`) so the accessible/reduced-motion path shows the *correct* unique boss art, not a reused field piece.
3. **Waiver, not silent pass:** this is a resource-budget compromise, explicitly recorded (not claimed as full narrative fidelity). Dedicated GLB models per stage-4-10 boss remain the correct long-term fix and are out of this cycle's scope (no generation budget/approval was requested or given).

## G1 gate self-check

| Check | Result |
|---|---|
| 0 un-waived lore violations | Reuse is now visually distinguished (tint + correct 2D portrait) and explicitly documented as a resource-budget compromise, not silently passed off as authored content. |
| 100% shipped strings/effects trace to worldview | Stage names, boss names, HP, and lore text were already correct (`BOSS_SPEC`, `CONTENT_TRACE` in `campaign-state.js`) — only the *visual* mismatch is addressed this cycle. |

## Novelty / G8

Not applicable — this cycle is a resource-parity bugfix, not new content. No novelty claim is made.
