# Abyssal Surge Revision — Production Brief

- **game_type:** Static, browser-local, single-player RTS-RPG campaign; three-stage deterministic core loop with optional cinematic presentation.
- **team_shape:** Game Studio Harness: director, designer, PM, programmer, QA.
- **engine:** Native ESM JavaScript; Canvas 2D battle visualizer; Three.js/WebGL liquid effect; GitHub Pages PWA.
- **current_stage:** Stage 1 — concept, presentation, animation/resources, core-build revision.
- **next_public_beat:** Correctly deployed Abyssal Surge-branded playable campaign, with scene narration/resource updates and a safe backend/multiplayer boundary ready for a later activation.
- **source_packet:** Historical 2026-07-16 Playwriter snapshot of `http://127.0.0.1:4174/` and `https://jellyggumi.github.io/Abyssal-Command/`; source audit of `index.html`, `app.js`, `campaign-state.js`, `battle-visualizer.js`, `liquid-ether.js`, `sw.js`, and `.github/workflows/static.yml`.
- **main_constraint:** The current Playwriter/release target is `https://jellyggumi.github.io/Abyssal-Surge/`. The 2026-07-17 release reflection records the repository rename to `jellyggumi/Abyssal-Surge`, successful Pages deployment, and campaign content at that endpoint; the 2026-07-16 Abyssal-Command URL is historical source-audit provenance, not a current target.
- **main_question:** Make the current single-player campaign richer and asset-led while preserving deterministic offline play; establish a typed, secret-safe persistence/multiplayer boundary without pretending a static client can be authoritative.

## Confirmed baseline

1. The historical 2026-07-16 source packet observed the live release title **Abyssal Command**; it is retained only as source-audit provenance.
2. The campaign stores progress in a versioned IndexedDB envelope and supports import/export locally.
3. Active gameplay uses `campaign-state.js`; `game-core.js` is a disconnected legacy rules engine still checked by the Pages workflow.
4. The Pages workflow publishes a strict static allowlist after JavaScript syntax and import-reference checks; generated assets must be committed and included in the artifact allowlist and service-worker cache contract.
5. Playwriter is the sole interactive playtest runtime for this cycle.

## Stage 1 acceptance

- Every new visible scenario, narration, image, sprite and scene-video reference has one source entry in the resource manifest and traces to the worldview.
- New optional media must never block the deterministic core loop; unavailable media must preserve a usable text/UI path.
- A typed reflection record exists for each completed production phase, with status, evidence and corrective action.
- The backend boundary neither embeds secrets in the static client nor claims authoritative multiplayer before a server/verifiable service is chosen.

## Production decisions

- Use GodTiboImagen as the sole generation provenance for game image assets.
- Follow PerfectPixel's staged identity/animation validation process, but generate concept-style non-pixel art at 16 fps.
- Use the webtoon-harness scenario discipline (world, tension curve, beat sheet, dialogue edit) for campaign narrative; do not produce a 50-panel webtoon unless the game requires one.
- The project owner selected GTI-derived local collage composites -> Vox/Atlas image-to-video for the concept film; execute it only after the Atlas Cloud credential, API availability, permitted use, and output ownership are verified, and retain the equivalent local FFmpeg fallback.
- Video compression targets quality-preserving local FFmpeg/CompressO settings and records before/after metrics.
