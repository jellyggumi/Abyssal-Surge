# Abyssal Surge worldview and content inventory

**Navigation:** [production contract](../production/production-contract.md) · [resource manifest](../engineering/resource-manifest.md) · [campaign state](../../../campaign-state.js)

## Scope and source of truth

Abyssal Surge is an original, offline three-stage campaign. The deterministic public data in `campaign-state.js` is the source of truth for player-visible stage, boss, and reward text. Every value below maps to `STAGES[*].trace`, then to `CONTENT_TRACE` by its durable `AS-WV-*` ID.

The browser presentation has matching boss lore in `app.js` for its three boss panels. That presentation text is recorded below so the source inventory remains auditable; the campaign mechanics, values, and reward effects remain defined only by `campaign-state.js`.

## Original canon

| ID | Entity | Canonical statement | Runtime use |
|---|---|---|---|
| AS-WV-001 | Abyssal Surge | A lunar fracture releases Echo Deep matter into abandoned coastal districts. | Campaign premise |
| AS-WV-002 | Moonless Court | A small wardens’ order that contains breaches. | Faction context |
| AS-WV-003 | Dusk Warden | The player’s silent field commander binds unstable echoes. | Player identity |
| AS-WV-004 | Ash Echo | Hostile residue leaves a brief soul pool after defeat. | Hunt and extraction loop |
| AS-WV-005 | Sable Relay | A damaged ward stabilizes a small district when captured. | Stage 1 node context |
| AS-WV-006 | Rift Guardian | A breach-grown sentinel protects a sealed route. | Supporting encounter concept |
| AS-WV-007 | Veil Citadel | A mobile fortress whose mirrors distort command links. | Stage 2 location context |
| AS-WV-008 | Echo Throne | The fracture’s command nexus. | Stage 3 location context |
| AS-WV-009 | Arise | A field command binds an available soul pool into a temporary legion unit. | Core action |
| AS-WV-010 | Lord’s Domain | A brief ward delays allied collapse. | Stage 3 comeback action |

## Runtime content trace map

| ID | Runtime entity | Field | Exact player-visible value |
|---|---|---|---|
| AS-WV-011 | `cinder-span` | stage name | Cinder Span |
| AS-WV-012 | `cinder-span` | stage region | The ember bridge above the drowned forge |
| AS-WV-013 | `cinder-span` | stage description | Hunt the rift spoor, extract its shade, materialize a legion, seize the forge node, then break the Cinder Warden. |
| AS-WV-014 | `cinder-span` | boss name | Cinder Warden |
| AS-WV-015 | `cinder-span` | boss description | The forge bridge's ashbound sentinel breaks intruders against the drowned iron. |
| AS-WV-016 | `ember-cohort` | reward name | Ember Cohort |
| AS-WV-017 | `ember-cohort` | reward description | +12 legion slots for the remaining campaign. |
| AS-WV-018 | `rift-lens` | reward name | Rift Lens |
| AS-WV-019 | `rift-lens` | reward description | Possession strikes deal +1 damage from Veil Citadel onward. |
| AS-WV-020 | `stillwater-hourglass` | reward name | Stillwater Hourglass |
| AS-WV-021 | `stillwater-hourglass` | reward description | Reduce battle-control cooldowns by 20% for the remaining campaign. |
| AS-WV-022 | `shadebreaker-brand` | reward name | Shadebreaker Brand |
| AS-WV-023 | `shadebreaker-brand` | reward description | Assaults deal +1 damage for the remaining campaign. |
| AS-WV-024 | `veil-citadel` | stage name | Veil Citadel |
| AS-WV-025 | `veil-citadel` | stage region | A fortress of listening stone |
| AS-WV-026 | `veil-citadel` | stage description | Carry your first boon, hold both signal nodes, possess a sentinel, and defeat the tactician who commands the veil. |
| AS-WV-027 | `veil-citadel` | boss name | Veil Tactician |
| AS-WV-028 | `veil-citadel` | boss description | A tactician of listening stone that turns every uncovered route into a killing field. |
| AS-WV-029 | `veil-vanguard` | reward name | Veil Vanguard |
| AS-WV-030 | `veil-vanguard` | reward description | Begin Echo Throne with a four-shade vanguard already raised. |
| AS-WV-031 | `anchor-shard` | reward name | Anchor Shard |
| AS-WV-032 | `anchor-shard` | reward description | Enter Echo Throne with 2 integrity restored. |
| AS-WV-033 | `abyssal-banner` | reward name | Abyssal Banner |
| AS-WV-034 | `abyssal-banner` | reward description | Enter the next stage with 1 aegis and materialize 1 additional shade each time. |
| AS-WV-035 | `echo-throne` | stage name | Echo Throne |
| AS-WV-036 | `echo-throne` | stage region | The gate above the last remembered sea |
| AS-WV-037 | `echo-throne` | stage description | Carry both boons, secure the throne node, invoke the one-use Lord's Domain comeback, and unmake the Gate Sovereign. |
| AS-WV-038 | `echo-throne` | boss name | Gate Sovereign |
| AS-WV-039 | `echo-throne` | boss description | The final gate's remembered ruler, holding back the last abyssal tide. |
| AS-WV-040 | `throne-echo` | reward name | Throne Echo |
| AS-WV-041 | `throne-echo` | reward description | Records the legion's final oath in the campaign archive. |
| AS-WV-042 | `dawnless-crown` | reward name | Dawnless Crown |
| AS-WV-043 | `dawnless-crown` | reward description | Records a crown forged from the closed gate. |

## Content boundary

- All public names, locations, characters, artwork, audio, dialogue, effects, and scenarios are original Abyssal Surge content.
- A player-visible stage, boss, or reward field without a durable `AS-WV-*` reference is a content-inventory defect.
- Reward effects apply only to the active campaign state. This inventory does not claim cross-campaign progression, a permanent reward system, or a passed quality gate.

## Evidence status

This document establishes traceability, not a G1 result. Any G1 or G2–G8 status must be supported by its own recorded audit evidence.