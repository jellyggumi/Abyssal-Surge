# Shared Reference Bundle — Solo Warden RPG Concept Cycle

Read this once; do not re-fetch these sources. run-id: `20260723-solo-warden-rpg-concept`.
Full brief: `_workspace/20260723-solo-warden-rpg-concept/intake/production-brief.md` (read it first).

## Existing Abyssal Surge canon (DO NOT rename/fork — extend only)

- Protagonist: **Dusk Warden** (dark armor, teal/emerald spectral glow, cape). Existing shipped sprite:
  `assets/images/battle/dusk-warden-atlas.png` — realistic painted dark-fantasy style.
- Enemy faction sample: **Echo Rusher** (dark armor, orange/lava glow). Shipped sprite:
  `assets/images/battle/echo-rusher-atlas.png` — same realistic painted style.
- World nouns already in canon: **Echo Deep**, **Moonless Court**, **Cinder Span** (a stage/zone name
  used in README/tests), **Gate Zenith** (campaign-end zone per README).
- Core verb chain (bmad-gds worldview backbone, DO NOT invent a competing one):
  **hunt → extract → materialize → capture → assault**.
- Current product contract (docs/abyssal-command-defense-survivor-design.md — THE authority, cite it,
  never contradict it silently):
  - Mobile-first single-player defense-survivor. Player moves; basic attack auto-resolves.
  - Full-bleed Canvas battlefield; HUD edges only, never covers battlefield/enemies/danger zones.
  - XP thresholds -> run-scoped skill offer (pick 1, rest vanish, no persistence after run).
  - Elite kill -> extraction opportunity -> permanent companion (persists across runs/campaign).
  - Boss win -> next stage. Stage 10 boss win -> campaign complete.
  - Permanent companions and run-scoped skills are SEPARATE state; XP/level/skills/positions do not
    persist past a run, only companion unlocks do.
  - Deterministic fixed-timestep 60 Hz simulation, decoupled from render framerate.
  - Offline local-first save (browser local storage + JSON export/import). NO network/accounts/cloud
    sync/multiplayer.
  - Canvas 2D snapshot projection; render adapter reads only confirmed sim state, never authors it.
- Prior expansion survey already exists (`.survey/abyssal-command-systems-expansion/`) proposing a 90s
  "Cinder Span Command Feedback" slice: confirmed-event feedback hierarchy, explicit 3-choice growth,
  single-settlement Archive Return receipt (no background combat), seeded stage -> world caption handoff.
  THIS CYCLE'S RPG LAYER MUST RECONCILE WITH, NOT CONTRADICT, THAT SURVEY'S BOUNDARIES (no background
  combat simulation, no probabilistic/gacha rewards, single deterministic settlement per return).
- Verified tech stack: vanilla JS ES modules, Canvas 2D rendering (`battle-realtime-three.js` is
  Canvas-2D despite its filename — confirmed no WebGL/Three.js import or THREE.* symbol anywhere in it),
  static GitHub Pages deployment, Node test runner (`node --test`), Playwright browser contract tests.

## Source 1 — Solo Leveling (structural principles ONLY; no names/plot/art copied)

Web novel/webtoon/anime. STRUCTURAL PATTERN to borrow: a world where dimensional "Gates" connect to
dungeons; awakened people ("Hunters") enter dungeons ranked E-S, fight monsters, and gain power. Almost
all hunters grow through conventional means (gear, allies, guild rank). ONE hunter uniquely receives a
hidden "Player" system after a near-death double-dungeon event: a private status/quest interface that lets
him grow in a way no other hunter can, turning him from the weakest into the strongest through repeated
dungeon clears. Structural elements usable as INSPIRATION (not copy): gate/dungeon-as-content-unit,
hunter power ranks, a uniquely-growing protagonist against a cast that grows conventionally, extracted
monster/spirit allies serving the protagonist ("shadow soldiers" analog - already echoed by Abyssal's own
extraction->companion mechanic).

## Source 2 — Kingshot (structural principles ONLY; no names/UI/numbers copied)

Mobile SLG (Century Games). STRUCTURAL SYSTEMS:
- **Town/keep growth**: central keep level gates new buildings/features; barracks, research, resource
  buildings all level in parallel; construction time scales up, "speedup" items smooth the curve.
- **Base defense** (this axis was OMITTED from this bundle's initial summary — root cause of a gap fixed
  in `production/decision-log.md` D9, see `design/UNIFIED-GDD.md` §1.4 "저지선 구역" for the resulting
  deterministic-settlement design; any future cycle reading this bundle must not repeat the omission):
  official app description states the game is structured around "Defend Against Invasions... upgrade your
  defenses" as a SEPARATE pillar from hero recruitment, not merely a growth-flavor label.
- **Heroes**: each has role/troop-type/skill-kit; growth splits across shards, XP, gear, skill mats;
  hero good-for-exploration != good-for-large-scale-expedition (loadout specialization, not one BiS hero).
- **Troops**: infantry/cavalry/archer analogs with type match-ups; higher-tier troops are more efficient
  than lower-tier; troop LOSSES in real battle reduce effective power (attrition, not just a static number).
- **Alliance**: cooperative structure — members help build/research speed, coordinate rallies, hold
  territory; alliance activity level materially changes pacing.
- **Battle types** (map to Abyssal's single-player context as PvE-only structural analogs):
  - *Exploration*: place heroes directly into a formation (front row / back row), fight staged PvE content;
    hero composition + skill timing matters more than raw power; auto-battle resolves the turn but
    formation/composition is the strategic layer.
  - *Expedition*: field-deploy a formation (heroes + troop-type ratio) to a target; troop-type ratio and
    hero buffs matter more than the raw power number; scouting available before commit.
  - *Rally*: multiple parties combine forces against a strong single target (structural analog for Abyssal:
    could map to a companion-formation "boss rally" - multiple permanent companions joining one assault
    formation against an elite/boss, NOT multiplayer).

## Source 3 — RPG genre vocabulary (structural terms ONLY)

Standard roguelike/RPG system vocabulary confirmed from genre reference: **스탯(stat)**, **인벤토리
(inventory)**, **액티브/패시브 스킬(active/passive skill)**, **스킬트리(skill tree)**, **아이템 등급
(item grade/rarity tier)**, **역할군(role: 탱커/딜러/힐러 = tank/damage/healer analogs)**, **로그라이크
(roguelike: procedural/run-based structure with permanent meta-progression between runs)** — this last
term is a structural match for Abyssal's EXISTING run-scoped-skill + permanent-companion split; the RPG
layer should deepen it (permanent STATS/INVENTORY/TRAITS on companions, not just unlock flags) rather than
replace it.

## Art direction (user-specified pivot — record as explicit decision)

User reference image: 2.5D SIDE-VIEW combat scene, cel-shaded/flat-shaded anime style (Hades-comparable),
warm autumn-forest background with layered painterly foliage, dynamic light-trail particle effects on
hits, minimal circular portrait + resource-pip HUD in top-left corner, health/resource bars with clean
geometric fill. Existing shipped Abyssal sprites are photorealistic painted dark-fantasy armor with
atmospheric volumetric glow (different style family entirely).

DECISION RECORDED: this cycle's new RPG layer targets the cel-shaded/anime style as the forward direction
per explicit user instruction ("리소스 화풍은 이미지같이 애니메이션같이" = "resource art style like the
image, anime-like"). Existing photoreal assets are a migration-cost item, not a blocker — design/programmer
lanes should note migration cost, not block concept work on it.

CAMERA: user explicitly wants BIRD'S-EYE (top-down/high-angle) 2.5D with camera following the player
character, in a "3D world" (3D-authored assets projected in 2.5D) — this is a DIFFERENT camera axis than
the reference image's side view. Treat style (cel-shading, palette, particle language) and camera
(bird's-eye, follow-cam, 3D-authored-to-2.5D-projected) as two independent design axes.

## No-commerce reinterpretation (mandatory for PM lanes)

Project boundary explicitly excludes real-money monetization (.survey/abyssal-command-systems-expansion/).
PM lanes MUST reinterpret harness template vocabulary:
- "revenue point" -> **engagement point** (a moment where player TIME/SKILL/ATTENTION is invested for a
  meaningful choice, e.g. companion recruit slot, formation rebuild, stat-point allocation)
- "comeback spike / 일발역전" -> **skill-comeback moment** (a build/formation choice that lets a
  behind player close the gap through PLAY, not purchase)
- "paid/free parity" -> **playstyle parity** (grind-heavy vs skill-heavy vs completionist playstyles reach
  comparable power within a stated session band)
- Do not invent gacha currency, premium track, ads, or account systems in any artifact.
