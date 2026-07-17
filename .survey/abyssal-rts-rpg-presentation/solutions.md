# Solution Landscape: Abyssal Surge Presentation

## Solution List

| Rank | Name | Approach | Strengths for Abyssal Surge | Weaknesses / limits | Notes |
|---:|---|---|---|---|---|
| 1 | SpellForce 3 Reforced | Dark-fantasy RTS/RPG campaign with hero, party, factions, army-building, and a voiced campaign. | Closest campaign-hybrid reference: gives a named protagonist/party and large-scale command a shared narrative frame. | Its 30+ hour campaign and broad system set are not a browser-session pacing model. | Use as the **Scenario** reference for named actors, escalation, and command consequences — not for scope. |
| 2 | Warcraft Rumble | Mobile action strategy with explicit resource → deploy → capture → counter → boss language. | Closest command-readability reference; the official page groups the loop into four short instructions: gather/deploy, capture, counterplay, and boss defeat, then connects capture to forward deployment. | Bright, collectible presentation and service progression do not fit the dark-fantasy campaign. | Use as the **Resource/UX** reference for objective hierarchy, state icons, and compact after-action payoffs. |
| 3 | Dungeons 4 | Evil-overlord fantasy strategy framed around a named subordinate, minions, powers, resource conversion, world transformation, and campaign narration. | Strongest tonal/structural analogue for Lord's Domain: the player commands a dark force whose resource changes the world. | Comedic dungeon-management tone and larger map scale are not a direct fit. | Use as the **Scenario** reference for showing the world visibly changed by command, not for its humor or density. |
| 4 | The Riftbreaker | Action-RPG/base-building survival loop with weapons, research, and hordes. | Demonstrates that hero action, base state, research, and survival can be described as one legible loop. | Sci-fi setting and longer base-management cadence are off-tone and too deep for this campaign. | Use as a **Resource** reference for distinguishable action/base/research states. |
| 5 | Clash Royale | Fast real-time battle deck against a tower-defeat objective. | Demonstrates a single-screen, easily named win target and pre-battle command loadout. | PvP/card-battle abstraction has no campaign transformation or dark-fantasy narrative continuity. | Use only as a pacing/readability floor; do not copy its economy or presentation. |

**Evidence provenance:** direct page retrieval from the five primary URLs in `context.md`, observed 2026-07-16.

## Solutions

The comparison is intentionally compositional rather than prescriptive: no single reference meets the target's dark-fantasy story, RTS-RPG identity, local deterministic loop, and browser-session cadence. The recommended direction is therefore **SpellForce's narrative command anchor + Warcraft Rumble's explicit state/action hierarchy + Dungeons 4's visible world transformation**, constrained to the existing four verbs and three stages.

## Categories

| Category | References | Reusable presentation lesson | Explicit non-goal |
|---|---|---|---|
| RTS-RPG campaign identity | SpellForce 3 Reforced; The Riftbreaker | A player-controlled lead/hero and strategic layer can be named in the same campaign sentence. | Add a party-management, tech-tree, or full base-building subsystem. |
| Dark-overlord transformation | Dungeons 4 | Give the commander, resource, minions, and transformed space distinct roles in the visible story. | Adopt comedy, dungeon-management density, or a separate economy. |
| Command readability | Warcraft Rumble; Clash Royale | Name the next action, objective, and resulting advantage with one visual priority order. | Imitate collectible monetization, PvP ladders, or card-game economy. |
| Session pacing | Warcraft Rumble; Clash Royale | Keep a battle's target and resolution visible without opening secondary screens. | Reduce the existing three-stage campaign to disconnected three-minute matches. |

## What People Actually Use

Only official product behaviour is counted here; no assumption is made about what players prefer.

- **SpellForce 3 Reforced:** hero/party customisation, faction command, army-building, and a voiced campaign are presented as one RTS/RPG experience.
- **The Riftbreaker:** base construction, weapon crafting, research, and survival combat are presented as one action-RPG/strategy loop.
- **Dungeons 4:** an evil commander directs minions; the player gains Evilness, transforms the Overworld, and follows a narrated campaign.
- **Warcraft Rumble:** gold/resource acquisition leads to Mini deployment; captured Guard Towers/Meeting Stones move the deployment position closer to the objective; a boss ends the encounter.
- **Clash Royale:** a selected battle deck acts in fast real-time matches against a tower-defeat objective.

## Frequency Ranking

The following are counts of the **five observed official descriptions**, not market-share or player-preference statistics.

1. **Named command anchor — 4/5:** SpellForce (custom hero/party), Riftbreaker (player-facing action-RPG operator), Dungeons 4 (Absolute Evil/Thalya), and Warcraft Rumble (Leaders) explicitly foreground a leader or role. Clash Royale foregrounds the battle deck and towers instead.
2. **Resource or loadout made actionable before the win condition — 5/5:** SpellForce builds an army; Riftbreaker builds/crafts/researches; Dungeons 4 gains Evilness and commands minions; Warcraft Rumble gathers gold and deploys; Clash Royale builds/upgrades a Battle Deck. The mechanism differs, but each page makes player preparation/action a visible precondition of the objective.
3. **Concrete end target — 4/5:** Warcraft Rumble names the enemy boss, Clash Royale names enemy towers, Dungeons 4 names Overworld transformation, and Riftbreaker names survival. SpellForce instead foregrounds the broader campaign and mass battles rather than one compact objective.
4. **Explicitly voiced/narrated campaign framing — 2/5:** SpellForce names a fully voiced campaign; Dungeons 4 names a narrated campaign. The Riftbreaker has a named Campaign Mode and protagonist but its cited copy does not state narration or a voiced campaign; Warcraft Rumble and Clash Royale emphasize action/match loops.

## Key Gaps

- None of the five primary pages describes Abyssal Surge's exact adversary-to-command conversion chain: **hunt → extract → materialize → capture**. The closest components are Dungeons 4's Evilness/world transformation and Warcraft Rumble's capture-to-forward-deployment loop.
- No observed reference combines a short-session objective presentation with a dark-fantasy, narrated RTS-RPG arc at Abyssal Surge's deliberately small three-stage scale.
- The comparative pages do not establish a universal session-length target for browser play. Duration remains an implementation/playtest unknown, not a survey conclusion.

## Contradictions

- **Campaign richness vs. immediate readability:** SpellForce's narrative/party/faction depth serves long-form progression; Warcraft Rumble and Clash Royale reduce the visible decision space. Abyssal Surge must keep only the current core loop and explain it more clearly, rather than importing either extreme.
- **Transformation fantasy vs. local determinism:** Dungeons 4 makes world change expansive; Abyssal Surge must convey its captured-state change in local UI/text and optional media without requiring online world state or new simulation systems.
- **Optional media vs. necessary understanding:** cinematic storytelling is useful, but the production brief requires text/UI to remain fully usable if optional media is unavailable.

## Key Insight

**Bounded novelty opportunity — the Command Transformation Strip.** Use one persistent, four-state visual/narrative strip at each stage resolution: **Hunt → Extract → Materialize → Capture**. Each state carries (1) a named target, (2) one concrete tactical consequence, and (3) a distinct world/resource treatment. On Stage 2, the Capture card becomes **Possession**; on Stage 3, it becomes **Lord's Domain**; the final card opens the **Assault Gate**.

Why this is supported: named command anchors appear in **4/5** references and actionable resource/loadout-to-objective loops appear in **5/5**. Within these five observed primary descriptions, none presents this exact four-state enemy-to-asset recap; that bounded absence creates room to make Abyssal Surge's existing loop, not a new mechanic, its memorable presentation signature.

**Recommendation for Scenario:** script one 8–16 word consequence line for each of the four state cards per stage; each line must name the target and the next command advantage. Do not add dialogue that explains mechanics the strip already shows.

**Recommendation for Resources:** plan one GodTiboImagen-provenance still-key-art composition per state family (hunt threat, extracted essence, materialized vessel, captured command mark), with text/UI fallback identifiers. Reuse the same silhouette, accent color, and capture mark across the four cards so the transformation reads as one asset lineage. The survey does not authorize generating those assets.

## Curated Sources

1. SpellForce 3 Reforced — https://store.steampowered.com/app/311290/SpellForce_3_Reforced/ — direct page retrieval, publisher-controlled product page, observed 2026-07-16.
2. Warcraft Rumble — https://warcraftrumble.blizzard.com/en-us/ — direct page retrieval, Blizzard official page, observed 2026-07-16.
3. Dungeons 4 — https://www.kalypsomedia.com/product-page/dungeons-4 — direct page retrieval, Kalypso Media official page, observed 2026-07-16.
4. The Riftbreaker — https://store.steampowered.com/app/780310/The_Riftbreaker/ — direct page retrieval, developer/publisher product page, observed 2026-07-16.
5. Clash Royale — https://supercell.com/en/games/clashroyale/ — direct page retrieval, Supercell official page, observed 2026-07-16.
