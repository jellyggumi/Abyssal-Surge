# Abyssal Surge worldview and G1 content inventory

**Navigation:** [production contract](../production/production-contract.md) · [concept](concept.md) · [G1 measurement](../qa/gate-measurements.md#g1)

## G1 decision

**Gate:** narrative consistency. **Stage 1 exit threshold:** 0 un-waived lore violations and 100% of shipped player-visible strings, effects, and scenarios trace to this document. A missing trace is a failure, not an implied approval.

## Original canon

| Element | Canonical statement | Stage use |
|---|---|---|
| Abyssal Surge | A lunar fracture releases Echo Deep matter into abandoned coastal districts. | Campaign premise |
| Moonless Court | A small wardens’ order that contains, rather than conquers, breaches. | Player faction |
| Dusk Warden | The player’s silent field commander who binds unstable echoes. | Lord identity |
| Ash Echo | A hostile residue that leaves a brief soul pool after defeat. | Stage 1 hunt/extraction |
| Sable Relay | A damaged municipal ward that stabilizes a small district when captured. | Stage 1 tech node |
| Rift Guardian | A breach-grown sentinel protecting the Relay’s sealed route. | Stage 1 boss |
| Veil Citadel | A mobile fortress whose mirrors distort command links. | Stage 2 location |
| Echo Throne | The fracture’s command nexus, held by the Gate Sovereign. | Stage 3 location/boss |
| Arise | A field command that binds an available soul pool into a temporary legion unit. | Core action |
| Lord’s Domain | A brief, bounded ward that delays allied collapse. | Stage 3 comeback |

## Prohibited public content

- No third-party character names, organizations, locations, visual marks, dialogue, sound cues, plot events, or “inspired by” promotional claims.
- No untraceable ability name, unit name, reward, enemy, UI string, icon, VFX, SFX, or scenario objective.
- No transfer of the source draft’s named roster into Abyssal Surge.

## Content trace format

Every public-facing item must record `inventory_id`, `stage_id`, `medium`, `owner`, and `reviewed_at` in the implementation-facing resource manifest. Stage 1 inventory IDs are `AS-WV-001` through `AS-WV-010` in the table above.

## Known evidence status

- **Observed:** no runtime/asset audit is included in this packet.
- **Decision:** the G1 review remains `NOT-RUN` until an implementation content inventory is attached; this document alone cannot prove a shipped build is compliant.