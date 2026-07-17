# Abyssal RTS-RPG Presentation Trend Survey — Digest

**Scope:** five comparable primary product pages, observed **2026-07-16**. This is presentation research only; it does not create game code or production assets.

## Ranked comparison

| Rank | Reference | What to borrow | What not to borrow | Primary source |
|---:|---|---|---|---|
| 1 | SpellForce 3 Reforced | Give hero/party, army command, and campaign escalation one dark-fantasy frame. | 30+ hour scope, broad factions, or additional systems. | https://store.steampowered.com/app/311290/SpellForce_3_Reforced/ |
| 2 | Warcraft Rumble | Make resource → deploy → capture → boss a short, ordered command read; show capture as a forward advantage. | Collectible/service progression and bright tone. | https://warcraftrumble.blizzard.com/en-us/ |
| 3 | Dungeons 4 | Make a named dark commander visibly transform the world and command minions; use narration to frame escalation. | Comedy, dungeon-management scale, or a new economy. | https://www.kalypsomedia.com/product-page/dungeons-4 |
| 4 | The Riftbreaker | Differentiate action, base, and research states while keeping one survival loop. | Sci-fi setting and deep base-management cadence. | https://store.steampowered.com/app/780310/The_Riftbreaker/ |
| 5 | Clash Royale | Keep the end target and pre-battle command loadout readable on one screen. | PvP/card-game abstraction and monetization. | https://supercell.com/en/games/clashroyale/ |

**Provenance:** every URL above was checked by **direct page retrieval** from an official publisher, developer, or publisher-controlled storefront page on 2026-07-16.

## Frequency signal and bounded recommendation

- Named command anchors appear in **4/5** observed descriptions; an actionable resource/loadout before the objective appears in **5/5**. These counts describe the five pages, not player preference or market share.
- **Recommendation:** make the existing loop the presentation signature with one persistent **Command Transformation Strip** at every stage resolution: **Hunt → Extract → Materialize → Capture**. Each card names the target, shows one state-specific visual treatment, and states one tactical consequence. In Stage 2, Capture becomes **Possession**; in Stage 3, it becomes **Lord's Domain**; the final card opens the **Assault Gate**.
  - **Scenario use:** write one 8–16 word consequence line for each state card per stage; name target + next advantage.
  - **Resource use:** scope one GodTiboImagen-provenance still-key-art family for hunt threat, extracted essence, materialized vessel, and captured command mark. Reuse silhouette/accent/capture mark across each family and retain text/UI fallback identifiers. This survey does not authorize asset generation.

## Known limits

- None of the five observed primary pages describes this exact enemy-to-asset four-state recap; the novelty claim is bounded to this sample.
- No duration target is inferred from the sample; browser-session pacing remains a QA/playtest question.
- **Release target update:** the 2026-07-16 survey/source audit recorded `https://jellyggumi.github.io/Abyssal-Command/` as its live-game baseline. As verified by the 2026-07-17 release reflection, the current Playwriter/release target is `https://jellyggumi.github.io/Abyssal-Surge/`; this presentation survey does not independently assess that endpoint's runtime behavior.

## Validation

The repository-local Survey validator expected at `.agent-skills/survey/scripts/validate_survey_artifacts.py` is unavailable: no file named `validate_survey_artifacts.py` was found in this checkout. Structural validation was run instead against the three required survey files and required headings/provenance labels.

Full reusable artifacts:

- `.survey/abyssal-rts-rpg-presentation/triage.md`
- `.survey/abyssal-rts-rpg-presentation/context.md`
- `.survey/abyssal-rts-rpg-presentation/solutions.md`
