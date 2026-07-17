# Resource manifest — Abyssal Surge runtime content

**Navigation:** [worldview inventory](../design/worldview.md) · [production contract](../production/production-contract.md) · [campaign state](../../../campaign-state.js)

## Contract

`campaign-state.js` owns deterministic stage text and reward effects. Its `CONTENT_TRACE` export maps every player-visible stage, boss, and reward field to an `AS-WV-*` source entity. This manifest maps those content IDs to the runtime asset paths that present them. A blank asset cell means the live browser presents the text as a standard reward card without a content-specific image.

## Stage presentation

| Content IDs | Runtime entity | Browser assets |
|---|---|---|
| AS-WV-011..013 | `cinder-span` stage name, region, description | `assets/images/cinder-span.png`; `assets/video/cinder-span.mp4` |
| AS-WV-024..026 | `veil-citadel` stage name, region, description | `assets/images/veil-citadel.png`; `assets/video/veil-citadel.mp4` |
| AS-WV-035..037 | `echo-throne` stage name, region, description | `assets/images/echo-throne.png`; `assets/video/echo-throne.mp4` |

## Boss presentation

| Content IDs | Runtime entity | Browser asset |
|---|---|---|
| AS-WV-014..015 | Cinder Warden name and description | `assets/images/ui/boss-cinder-warden.png` |
| AS-WV-027..028 | Veil Tactician name and description | `assets/images/ui/boss-veil-tactician.png` |
| AS-WV-038..039 | Gate Sovereign name and description | `assets/images/ui/boss-gate-sovereign.png` |

## Reward presentation

| Content IDs | Runtime reward | Browser asset |
|---|---|---|
| AS-WV-016..017 | `ember-cohort` | `assets/images/ui/reward-ember-cohort.png` |
| AS-WV-018..019 | `rift-lens` | `assets/images/ui/reward-rift-lens.png` |
| AS-WV-020..021 | `stillwater-hourglass` | — |
| AS-WV-022..023 | `shadebreaker-brand` | — |
| AS-WV-029..030 | `veil-vanguard` | `assets/images/ui/reward-veil-vanguard.png` |
| AS-WV-031..032 | `anchor-shard` | `assets/images/ui/reward-anchor-shard.png` |
| AS-WV-033..034 | `abyssal-banner` | — |
| AS-WV-040..041 | `throne-echo` | `assets/images/ui/reward-throne-echo.png` |
| AS-WV-042..043 | `dawnless-crown` | `assets/images/ui/reward-dawnless-crown.png` |

## Asset rules

- All listed assets are original Abyssal Surge material. External or third-party art, audio, names, logos, screenshots, extracted assets, recognizable-copy prompts, and derivative character silhouettes are prohibited.
- Asset cache keys include a build/content version; Cache API is never campaign state.
- The asset manifest documents the current browser presentation only. It does not imply permanent progression, unimplemented reward art, an APK build, or any G1–G8 pass.