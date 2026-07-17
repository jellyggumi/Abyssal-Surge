# Context: Abyssal Surge Presentation

## Workflow Context

Abyssal Surge is a three-stage, deterministic, browser-local RTS-RPG campaign. The player-facing contract is not a generic skirmish: each stage must show a readable causal chain from **hunt** through **extract**, **materialize**, and **capture**, then carry the altered command state forward. Stage 2 adds possession; Stage 3 exposes Lord's Domain; the final assault gate must read as the consequence of prior capture rather than a disconnected boss button.

The comparables divide into two useful presentation families:

1. **Campaign-hybrid anchors:** SpellForce 3 Reforced explicitly combines RTS/RPG, a hero/party, army-building, and a voiced campaign; The Riftbreaker combines action-RPG, base-building, weapons, research, and survival; Dungeons 4 frames an evil commander, named subordinate, resource transformation, minions, and campaign narration. These support a dark-fantasy campaign's identity and causal fiction.
2. **Short-session command anchors:** Warcraft Rumble names a compact loop — resource, deploy, capture, counter, boss — around mobile action strategy; Clash Royale presents a battle deck and fast real-time tower objective. These support at-a-glance command readability, but not Abyssal Surge's long-form story tone.

**Evidence provenance:** direct page retrieval, official product pages, observed 2026-07-16. See the source register below.

## Affected Users

| Role | Responsibility | Skill Level |
|------|----------------|-------------|
| First-time campaign player | Read the immediate objective, understand why a capture matters, and finish a deterministic stage without external instruction. | Mixed; must work at a glance. |
| Returning player | Recognize persistent command-state changes across Cinder Span, Veil Citadel, and Echo Throne. | Familiar with the core loop. |
| Scenario author | Stage the hunt/extract/materialize/capture sequence, possession, Lord's Domain, and assault gate as one causal arc. | Domain expert. |
| Resource/visual designer | Produce a minimal set of distinct still/motion states that map to named gameplay states and preserve dark-fantasy tone. | Domain expert. |
| QA reviewer | Verify that text/UI remains understandable when optional media is unavailable and that each displayed asset traces to a state. | Mixed technical/design. |

## Current Workarounds

1. Use verbose objective copy to explain a state change after it has occurred; this risks separating story comprehension from the live command decision.
2. Treat capture as a generic reward toast rather than a visible transformation with a named role and next tactical consequence.
3. Borrow dense PC RTS framing for every stage; that preserves genre texture but competes with browser/mobile-web session readability.
4. Use a cinematic as the sole explanation; the production brief correctly disallows optional media from blocking the deterministic text/UI path.

## Adjacent Problems

- **Narrative continuity:** possession and Lord's Domain must be legible as distinct player powers, not two labels for the same escalation.
- **Resource contract:** every visible scene, narration image, sprite, and scene-video reference needs a source entry and a state/worldview trace.
- **Pacing:** a compact stage must still resolve with a clear verb, target, and payoff before the next stage starts.
- **Reliability:** the requested Abyssal-Surge Pages URL is not the active game URL; presentation guidance must not imply a deployed rebrand.

## User Voices

No player testimony was collected in this bounded primary-source survey. The following are product-facing task statements, **not** evidence of player sentiment:

- “Gather Resources and Deploy Minis” and “Capture objectives like Guard Towers and Meeting Stones” — Blizzard, *Warcraft Rumble* official page (direct page retrieval, observed 2026-07-16).
- “Build your Battle Deck and outsmart the enemy in fast real-time battles” — Supercell, *Clash Royale* official page (direct page retrieval, observed 2026-07-16).
- “SpellForce 3 - The perfect blend between RTS and RPG!” — THQ Nordic product page (direct page retrieval, observed 2026-07-16).

## Source Register

| Reference | Primary source URL | What was directly observed | Provenance |
|-----------|--------------------|-----------------------------|------------|
| SpellForce 3 Reforced | https://store.steampowered.com/app/311290/SpellForce_3_Reforced/ | Official description calls it an RTS/RPG blend and lists a hero, party, army-building, factions, and a fully voiced 30+ hour campaign. | direct page retrieval — publisher-controlled Steam product page, observed 2026-07-16 |
| The Riftbreaker | https://store.steampowered.com/app/780310/The_Riftbreaker/ | Official description states base-building, survival, Action-RPG elements, hacking/slashing hordes, weapons, and research. | direct page retrieval — developer/publisher Steam product page, observed 2026-07-16 |
| Dungeons 4 | https://www.kalypsomedia.com/product-page/dungeons-4 | Official page states a named evil commander/subordinate, Dungeon-to-Overworld command, Evilness transformation, minions, powers, and a narrated campaign. | direct page retrieval — publisher product page, observed 2026-07-16 |
| Warcraft Rumble | https://warcraftrumble.blizzard.com/en-us/ | Official page describes mobile action strategy, campaign maps/dungeons, leader-driven armies, resource/deploy, capture, counter, and boss steps. | direct page retrieval — Blizzard official page, observed 2026-07-16 |
| Clash Royale | https://supercell.com/en/games/clashroyale/ | Official page describes a battle deck, fast real-time battles, and tower defeat as the compact objective. | direct page retrieval — Supercell official page, observed 2026-07-16 |
