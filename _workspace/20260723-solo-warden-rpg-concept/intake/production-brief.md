# Production Brief — Solo Warden RPG Concept Cycle

run-id: `20260723-solo-warden-rpg-concept`

```yaml
game_type: 2.5D bird's-eye action-RPG, single-player, extends existing defense-survivor campaign
team_shape: 6-role harness (director, designer×3, pm×3, programmer×3, qa×3, ui-senior-developer×3) — tripled brainstorm lanes per user request, director synthesizes
engine: existing vanilla JS ES modules + Canvas 2D snapshot rendering, deterministic 60Hz simulation (defense-run-simulation.js pattern), static GitHub Pages; NO WebGL/Three.js currently in use despite battle-realtime-three.js filename (verified: imports only defense-catalog.js/battle-canvas-text.js, no THREE.* symbols)
current_stage: Stage 1 (Concept) — DOCUMENT ONLY this cycle, no shipped code changes
next_public_beat: Stage 1 concept GDD complete + G7/G1/G6-ops DRAFT gate review
source_packet:
  - https://ko.wikipedia.org/wiki/나_혼자만_레벨업 (Solo Leveling — structural principles only: gate/dungeon portal, hunter ranks, uniquely-growing protagonist via secret system, permanent power growth from clearing dungeons)
  - https://namu.wiki/w/Kingshot (Kingshot — structural principles only: town/keep growth via building levels, hero roster with role/skill/equipment growth, troop types with quality tiers, alliance-scale coordination, battle types: exploration [hero formation PvE], expedition [field deployment], rally [multi-party coordinated attack])
  - https://namu.wiki/w/롤플레잉_게임 (RPG genre — structural vocabulary: stat/스탯, inventory/인벤토리, skill tree/액티브·패시브 스킬, item grade/아이템 등급, class/역할군, roguelike/로그라이크)
  - user reference image: 2.5D side-view action combat, cel-shaded anime/painterly style (Hades-comparable), warm autumn palette, particle-heavy hit effects, minimal circular HUD icons — ART STYLE reference only; camera ANGLE differs from requested bird's-eye (see main_question)
main_constraint: |
  1. PRESERVE existing canon: Dusk Warden (protagonist), Echo Deep, Moonless Court, and the
     hunt → extract → materialize → capture → assault verb chain (README.md, docs/abyssal-command-defense-survivor-design.md).
     No renamed protagonist, no replacement worldview — this cycle DEEPENS existing lore, does not fork it.
  2. PRESERVE deterministic 60 Hz simulation separated from rendering; PRESERVE offline local-first save
     (JSON export/import); PRESERVE mobile full-bleed Canvas with edge-only HUD; PRESERVE reduced-motion
     and non-color-only signaling.
  3. NO REAL-MONEY MONETIZATION — the project's documented research boundary (.survey/abyssal-command-systems-expansion/{triage,context,solutions}.md)
     explicitly excludes ads/purchases/premium currency/accounts/cloud sync. The harness's game-pm role
     is templated for monetized mobile games; THIS CYCLE REINTERPRETS "revenue points" as a non-monetary
     ENGAGEMENT ECONOMY (time/skill/attention investment moments) and "reward bands" as EFFORT-PARITY
     (grind-heavy vs skill-heavy playstyles reach parity, not paid vs free). PM lanes must not invent a
     cash shop, gacha currency, or premium track — flag this reinterpretation explicitly in every PM artifact.
  4. External sources (Solo Leveling, Kingshot, RPG genre) are STRUCTURAL PRINCIPLE sources only, same
     research boundary already established for Moon Defence/Survivor.io/Archero in
     docs/abyssal-command-defense-survivor-design.md — no copied names, characters, art, UI, or numeric
     tables from these sources into Abyssal Surge content.
  5. Art direction PIVOT under evaluation: existing shipped sprites (dusk-warden-atlas.png, echo-rusher-atlas.png)
     are realistic painted dark-fantasy armor with atmospheric glow. User's reference image is flat
     cel-shaded anime style. This brief treats the cel-shaded pivot as the DEFAULT direction for this new
     RPG layer per explicit user request ("리소스 화풍은 이미지같이 애니메이션같이") — design lanes must
     record this as a stated art-direction decision, not an unexamined assumption, and flag the existing
     asset migration cost.
  6. Camera reconciliation: reference image is side-view 2.5D; user explicitly requests bird's-eye 2.5D
     with camera following the player. Treat the reference image as ART STYLE evidence (cel-shading, color,
     particle language) and the text instruction as CAMERA/PROJECTION evidence (bird's-eye, camera-follow)
     — these are two separate axes, not a contradiction to silently resolve one way.
main_question: |
  How do we synthesize (a) Solo Leveling's lone-hunter structural loop [gate/dungeon entry → clear →
  uniquely-growing permanent power, vs. other hunters who do not grow this way], (b) Kingshot's structural
  loop [stronghold growth via building levels → hero roster with role/skill/equipment → troop quality tiers
  → formation-based battle types], and (c) roguelike-RPG depth [stats, inventory, skill trees, character
  traits] into ONE coherent 2.5D bird's-eye, camera-follow, cel-shaded action-RPG design that EXTENDS
  (not forks) the existing Abyssal Command canon, deterministic 60 Hz engine contract, and offline/no-commerce
  boundary — concrete enough to hand directly to implementation without further discovery?
