# Production Task Manifest — Combat Scene Cinematics

| task | owner | stage.phase | artifact | gate | status | beat |
|---|---|---|---|---|---|---|
| Ground combat-scene state; identify presentation gaps vs functional systems | director | Stage 1 / intake | `intake/production-brief.md` | — | complete | Correct scope before parallel dispatch |
| Add pooled particle field + spatial Web Audio to primary WebGL renderer | programmer (self, Lane B) | Stage 1 / core build | `engineering/vfx-audio-implementation.md`, `battle-realtime-three.js` | G6 | complete | Combat feels alive, not silent |
| Add camera shake + hit-stop on heavy impacts | programmer (self, Lane B) | Stage 1 / core build | `battle-realtime-three.js` | G6 | complete | Impacts are legible |
| Add movement feel: footstep dust, surge trail, ambient drifting motes | programmer (self, Lane B) | Stage 1 / core build | `battle-realtime-three.js` | G6 | complete | Field reads as alive at rest |
| Sharpen boss/unit/prop mesh silhouettes via bevel-only modifiers (70 parts, 14 GLBs, subsurf explicitly rejected) | 3D artist (subagent `BlenderBevelPass`, Lane A) | Stage 1 / core build | `assets/models/abyssal-command/*.glb`, `abyssal-command-resource-pack.blend` | G6 | complete | Concept-fitting polygon detail without breaking established flat-shaded art direction |
| Re-render 8-directional sprite atlases for Canvas 2D fallback from beveled source meshes | 3D artist (subagent `BlenderBevelPass`, Lane A) | Stage 1 / core build | `assets/images/battle/glb/*.png`, `manifest.json`, `assets/media-manifest.json` | G6 | complete | Fallback path matches primary renderer's sharpened geometry |
| Investigate and reconcile concurrent third-party working-tree changes (action-feedback refactor, current-objective UI, browser-test fixes) | director (self) | Stage 1 / reconciliation | `qa/gate-measurements.md#concurrent-work` | G6 | complete | No data loss, no silent revert of collaborator work |
| Independent verification: GLB node/animation/material integrity, subsurf-zero confirmation, vertex/NaN check, isolated part renders | director (self) | Stage 1 / gate review | this manifest, session transcript | G6 | complete | Trust but verify subagent's cancelled-mid-task claims |
| Full automated test suite (combined state: Lane A + Lane B + third-party) | director (self) | Stage 1 / gate review | `node --test tests/*.test.mjs` output | G6 | complete — 131/131 pass | Zero regression across all concurrent work |
| Live browser smoke test (fresh campaign → combat entry → action dispatch → particle/audio instrumentation) | director (self) | Stage 1 / gate review | session transcript, `/tmp/as-final-combat-view.png` | G6 | complete — 0 console errors | Proof beyond unit tests that the feature works in the real running app |
| Independent code review of source diff (VFX/audio/camera/UI/tests) | code reviewer (subagent `CombatVfxReview`) | Stage 1 / gate review | subagent report | G6 | in_progress | Second pair of eyes before claiming done |
| Write cycle retrospective and gate review | director (self) | Stage 1 / gate review | `retrospectives/cycle-1-retrospective.md`, `production/gate-reviews/stage1-g6.md` | G6 | pending | Close the loop; decide next-cycle entry point |

## Immutable constraints for this cycle
- No new 3D character models or terrain layouts — refinement of the existing `abyssal-command-low-poly` pack only.
- Bevel-only geometry treatment; subsurf explicitly rejected (fights the established flat-shaded PBR art direction).
- No new binary VFX/audio assets shipped — particle field is procedural (point-sprite, no textures), audio is oscillator-synthesized tones plus reuse of the 7 already-shipped `assets/audio/*.mp3` action cues.
- The running browser is exercised through the headless browser tool only; no manual/GUI interaction.
- Stage evidence must include real file, command, or browser-session evidence; unknowns remain explicit.
