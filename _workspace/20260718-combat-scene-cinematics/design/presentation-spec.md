# Combat Scene Cinematics — Presentation Decision

**Status:** Design decision made and implemented this cycle by the director acting in the designer role (presentation-layer polish work, not new mechanical concept). Documented here for traceability per the harness artifact contract.

## Problem

The primary WebGL combat renderer (`RealtimeBattle`) had complete movement, collision, terrain, animation, and control systems, but zero particle effects and zero spatial/positional audio — every combat action, clash, defeat, and breach was visually and aurally silent beyond the character animation clip itself and a flat non-positional `<audio>` cue at the UI layer. The Canvas 2D fallback (used for reduced-motion/accessibility) already had a mature procedural particle+spatial-audio system the primary renderer had no equivalent of. Boss/hero source meshes also had inconsistent edge treatment — some parts (e.g. `guard-body`, `sovereign-torso`) already carried bevel modifiers giving them a sharpened, intentional-looking silhouette; many other parts across all three boss/unit rigs had zero edge treatment, reading as flat-shaded but visually "raw" against the pack's own established idiom.

## Decision

1. **VFX/audio: pooled particle field + positional Web Audio, not a pre-baked sprite/sample system.** A 360-capacity pooled `ParticleField` (point-sprite, no per-frame allocation) and a `SpatialAudio` class (oscillator-synthesized tones with `PannerNode` 3D positioning, reusing the 7 existing shipped `assets/audio/*.mp3` action cues for sample playback) were added directly to `RealtimeBattle`. This keeps the WebGL renderer's zero-asset-dependency character (no new binary VFX/audio assets shipped) while giving every combat event — player actions, melee clashes, defeats, breaches, wave-clears, movement, ambient — a spatial audio+particle signature tied to its actual 3D world position, panned/attenuated by the live orbit camera's listener focus.
2. **Camera feel: additive shake + brief hit-stop, not a scripted cutscene system.** `shakeCamera()`/`triggerHitStop()` compose additively on top of the existing orbit/zoom camera math rather than replacing it — heavy impacts (boss defeat, boss-exposed assault) get a readable "impact frame" without any cutscene infrastructure or camera-state takeover.
3. **Bevel-only geometry refinement, subsurf explicitly rejected.** Tested and confirmed: Catmull-Clark subdivision smooths the pack's intentionally flat-shaded, faceted low-poly silhouette into an organic style that fights the established `abyssal-command-low-poly` art direction (`resource-manifest.md` names this pack's rendering intent explicitly: "Flat-shaded PBR GLB resources"). Bevel-only modifiers (matching the technique already present on select parts) were applied to the 70 previously-untreated mesh parts across all units/bosses/props/terrain, sharpening edge definition without altering the faceted read. `clamp_overlap` verified to keep terrain-critical thin-slab bounding boxes (Echo Throne steps, asserted to ±0.01 tolerance by an existing test) byte-identical.
4. **No new characters, no new terrain layouts.** Entirely within the existing 15-asset resource pack; this is a refinement pass, not new content generation.

## G1 gate self-check

| Check | Result |
|---|---|
| 0 un-waived lore violations | No narrative content changed — VFX/audio/bevel work is purely sensory presentation of existing, already-canonical combat events. |
| 100% shipped strings/effects trace to worldview | No new strings. Particle colors reuse each stage's existing presentation palette (`ally`/`accent`/`hostile`); no new color language introduced. |

## Novelty / G8

Not applicable — this cycle sharpens delivery of existing mechanics/content; no new mechanical or narrative novelty claim is made.

## Concurrent work note

See `qa/gate-measurements.md#concurrent-work` — a "current objective" command-button highlight UI feature landed concurrently from a separate contributor in this shared repo. It is a UX-clarity affordance (visually marks the next legal command in the fixed hunt→extract→materialize→...→assault sequence), not a presentation-direction change, and required no design-decision arbitration.
