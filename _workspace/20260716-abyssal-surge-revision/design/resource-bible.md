# Abyssal Surge Resource Bible

**Status:** Stage 1 preproduction contract — no media is generated or changed by this document.
**Audience:** art, narrative, frontend, QA, and release owners.
**Scope:** the active browser seams in `index.html`, `app.js`, `battle-visualizer.js`, `sw.js`, and `campaign-state.js`. This is a manifest-ready plan, not a claim that any proposed asset has passed generation or review.

## 1. Canon and source boundaries

Abyssal Surge is an original dark-fantasy RTS-RPG about a Dusk Warden binding unstable Echo Deep matter after a lunar fracture. The player-visible loop must remain legible in every image: **hunt → extract → materialize → capture → assault**; Stage 2 adds possession and Stage 3 adds one-use Lord's Domain before the assault gate. The scene progression is **Cinder Span → Veil Citadel → Echo Throne**.

The runtime truth is `campaign-state.js` (`STAGES` and `CONTENT_TRACE`) and the presentation seams are:

| Player surface | Exact current seam | Resource family | Content trace / rule it must clarify |
|---|---|---|---|
| Lobby map | `index.html` map-node images | stage key art | Stage 1 `AS-WV-011–013`; Stage 2 `AS-WV-024–026`; Stage 3 `AS-WV-035–037` |
| Stage briefing | `app.js` `IMAGE_BY_STAGE`, `renderStageMedia()` | stage key art under text gradient | stage objective remains text, so art must not encode a hidden rule |
| Briefing and tactical boss | `app.js` `BOSS_BY_STAGE`; `battle-visualizer.js` `BOSS_ART` | boss portraits | `AS-WV-014–015`, `AS-WV-027–028`, `AS-WV-038–039` |
| Command pad | `index.html` `[data-action]` image children | action UI art | available action and stage gating remain button text/disabled state |
| Reward choice | `app.js` `REWARD_ART_IDS`, `renderRewards()` | reward art | reward name and mechanical description remain the accessible decision content |
| Lobby story record | `index.html` storyboard cards | storyboard/narration stills | opening, extraction, possession, Domain, return to shrine |
| Stage atmosphere | `app.js` `VIDEO_BY_STAGE`, `#stage-transition-video` | stage video | optional atmosphere only; never the objective or state transition |
| Optional lobby movie | `app.js` `playCinematic()` | campaign video | optional; existing fallback text is the complete briefing |

**Provenance rule.** Any *new or replacement image* uses GodTiboImagen (GTI) only. Existing images are not retroactively relabeled: the present `assets/media-manifest.json` records GTI/private-Codex provenance for the three key art files, but does not record every UI/storyboard file. A generation record must name the GTI provider mode, exact prompt ID, input files and hashes, output hash, reviewer, and date. GTI uses a private, unsupported Codex backend; generation is therefore an offline-build input, never a runtime dependency ([GTI upstream README](https://github.com/NomaDamas/god-tibo-imagen), accessed 2026-07-16).

## 2. Final visual direction

### 2.1 One world, three pressure states

- **Material:** rain-dark iron, drowned masonry, wet obsidian, soot, broken ward geometry, and translucent Echo Deep residue. Avoid glossy sci-fi panels, photoreal military equipment, copied character silhouettes, logos, readable text, watermarks, or UI baked into art.
- **Light:** nearly-black charcoal ground; cold abyss teal (`#70e5d0` family) for allied binding; violet (`#ab68ff` family) for possession/domain; restrained ember gold/red (`#ffb85c` / `#ff7f79` families) for hostile pressure. The actual per-stage palette in `battle-presentation.js` remains the UI authority.
- **Rendering:** high-fidelity, non-pixel, painterly concept art; hard silhouette separation, practical texture, controlled film grain, and a readable focal subject at thumbnail size. It is not anime, chibi, cartoon, retro-16, or pixel art.
- **Camera grammar:** stage key art = wide 16:9 place; boss = vertical 4:5 threat portrait; action/reward = square centered visual noun; storyboard = 3:2 narrative frame; atmospheric video = slow, stable crop from the approved stage still.

| Stage | Pressure / palette | Required landmark | Loop legibility | Forbidden ambiguity |
|---|---|---|---|---|
| Cinder Span | ember against abyss teal; first incursion | suspended forge bridge over a drowned iron foundry | ash spoor → soul pool → first raised shades → one forge node | do not make the Warden or bridge resemble a generic fire demon dungeon |
| Veil Citadel | desaturated teal/indigo with violet listening-runes | mobile stone citadel with two signal beacons | two nodes and a possessed sentinel must read as the tactical advantage | do not show a third node or imply possession is mind control of a human civilian |
| Echo Throne | royal violet, cold blue, thin dawnless gold | gate above the last remembered sea, throne-node in foreground | one Domain surge protects the force before the gate assault | do not make Domain look permanent, unlimited, or like a victory state |

### 2.2 GTI prompt construction

Every prompt below resolves as **BASE + SUBJECT**. Supply the listed reference inputs with GTI `--image`; `AS-ID-*` sheets are workroom reference sheets, not runtime assets. The founding three stage plates intentionally have no earlier art input; their first accepted version becomes the visual reference for all downstream work.

```text
BASE = Original Abyssal Surge dark-fantasy RTS-RPG concept art, non-pixel painterly
production illustration, rain-dark obsidian and drowned iron, abyss-teal spectral light,
restrained ember-red accents, violet ward geometry, high silhouette clarity, tactile
materials, cinematic but readable composition, no text, no logo, no watermark, no UI,
no borrowed franchise characters, not anime, not cartoon, not chibi, not pixel art,
not retro 16-bit, anatomically coherent.
```

**Required negative prompt for all GTI requests:** `text, letters, logo, watermark, frame, user interface, duplicate subject, extra limbs, malformed hands, cartoon, anime, chibi, pixel art, retro 16-bit, oversaturated neon, blurry focal subject`.

**Reference-sheet protocol.** Before dependent images, curate `AS-ID-WORLD-01` (2048×2048) from accepted key art: material swatches, teal/violet/ember values, ward geometry, Dusk Warden cloak/armor, ally shade silhouette, and no text. Curate one vertical `AS-ID-BOS-0N` sheet per boss (front, 3/4, profile, equipment close-up, 5 swatches). These sheets are a controlled input ledger, not an excuse to reuse a third-party style.

## 3. Manifest-ready image matrix

`duration/fps` is `—` for still images. `Static fallback` is the behavior when the listed file fails to load; mechanics and labels must remain usable. `Status` is deliberately not a production-complete claim.

### 3.1 Stage key art and boss portraits

| ID / filename | Media / target dimensions | GTI prompt ID — subject | Required input references | Source key art / duration-fps | Static fallback and accessibility | Status |
|---|---|---|---|---|---|---|
| `AS-IMG-STG-01` `assets/images/cinder-span.png` | `image/png`, 2048×1152 source; current 1672×941 | `AS-GTI-STG-01` — **Cinder Span:** wide low-angle ember bridge above a drowned forge, ash spoor leading toward one damaged relay, Dusk Warden silhouette at lower third | none for founding plate; after approval make `AS-ID-WORLD-01` | self / — | gradient plus stage title, region and objective remain; descriptive alt: “Cinder Span, an ember bridge above the drowned forge.” | Current seam; regeneration specified |
| `AS-IMG-STG-02` `assets/images/veil-citadel.png` | `image/png`, 2048×1152 source; current 1672×941 | `AS-GTI-STG-02` — fortress of listening stone crossing a rain-dark void, **two** separate signal beacons, violet surveillance runes, a sentinel-shaped silhouette | `assets/images/cinder-span.png`, `AS-ID-WORLD-01` | self / — | title/objective remain; alt: “Veil Citadel, a stone fortress between two signal beacons.” | Current seam; regeneration specified |
| `AS-IMG-STG-03` `assets/images/echo-throne.png` | `image/png`, 2048×1152 source; current 1672×941 | `AS-GTI-STG-03` — gate above the last remembered sea, throne node foreground, unstable violet domain halo, distant Sovereign gate | `assets/images/veil-citadel.png`, `AS-ID-WORLD-01` | self / — | title/objective remain; alt: “Echo Throne, a gate above a black sea with a throne node.” | Current seam; regeneration specified |
| `AS-IMG-BOS-01` `assets/images/ui/boss-cinder-warden.png` | `image/png`, 1024×1536 master; crop/export 409×512 | `AS-GTI-BOS-01` — Cinder Warden bust, ashbound iron sentinel, ember fissures and drowned-forge chain, stern readable profile | `assets/images/cinder-span.png`, `AS-ID-WORLD-01`, `AS-ID-BOS-01` after first approval | `cinder-span.png` / — | boss name, HP and lore remain text; decorative `<img alt="">` is correct only beside that text | Current seam in spec/battle canvas |
| `AS-IMG-BOS-02` `assets/images/ui/boss-veil-tactician.png` | `image/png`, 1024×1536 master; crop/export 341×512 | `AS-GTI-BOS-02` — Veil Tactician bust, listening-stone mask, hooded relay cables, two beacon reflections in the stone | `assets/images/veil-citadel.png`, `AS-ID-WORLD-01`, `AS-ID-BOS-02` | `veil-citadel.png` / — | same text fallback; portrait must not be the only signal that Stage 2 requires possession | Current seam in spec/battle canvas |
| `AS-IMG-BOS-03` `assets/images/ui/boss-gate-sovereign.png` | `image/png`, 1024×1536 master; crop/export 409×512 | `AS-GTI-BOS-03` — Gate Sovereign bust, remembered ruler fused with a broken gate arch, dawnless metal crown, violet sea-light | `assets/images/echo-throne.png`, `AS-ID-WORLD-01`, `AS-ID-BOS-03` | `echo-throne.png` / — | same text fallback; do not imply the Sovereign is defeated before assault | Current seam in spec/battle canvas |

### 3.2 Action UI art

| Filename | Media / target dimensions | GTI prompt ID — subject | Required input references | Source key art / duration-fps | Static fallback and accessibility |
|---|---|---|---|---|---|
| `assets/images/ui/action-hunt.png` | `image/png`, 1024² master → 512² runtime | `AS-GTI-ACT-01` — spectral tracking eye over ash spoor, one outward teal pulse | `cinder-span.png`, `AS-ID-WORLD-01` | `cinder-span.png` / — | command name, hotkey H, cost/cooldown text remain the action; empty icon alt |
| `assets/images/ui/action-extract.png` | `image/png`, 1024² → 512² | `AS-GTI-ACT-02` — sealed soul pool lifting as one teal ribbon through an iron ward | `cinder-span.png`, `AS-ID-WORLD-01` | `cinder-span.png` / — | name/hotkey E and disabled state remain authoritative |
| `assets/images/ui/action-materialize.png` | `image/png`, 1024² → 512² | `AS-GTI-ACT-03` — two shadow legion forms coalescing from a single soul knot, no extra unit count implied | `cinder-span.png`, `AS-ID-WORLD-01` | `cinder-span.png` / — | name/hotkey M and resource text remain authoritative |
| `assets/images/ui/action-capture.png` | `image/png`, 1024² → 512² | `AS-GTI-ACT-04` — dark standard anchored in one glowing forge-node, teal control ring | `cinder-span.png`, `AS-ID-WORLD-01` | `cinder-span.png` / — | name/hotkey C and checklist state remain authoritative |
| `assets/images/ui/action-possess.png` | `image/png`, 1024² → 512² | `AS-GTI-ACT-05` — violet command thread entering an empty stone sentinel helm | `veil-citadel.png`, `AS-ID-WORLD-01` | `veil-citadel.png` / — | name/hotkey P and stage gate explain availability; no human body horror |
| `assets/images/ui/action-domain.png` | `image/png`, 1024² → 512² | `AS-GTI-ACT-06` — finite violet ward dome from a crowned seal, visibly one brief surge | `echo-throne.png`, `AS-ID-WORLD-01` | `echo-throne.png` / — | name/hotkey D and one-use state remain authoritative |
| `assets/images/ui/action-assault.png` | `image/png`, 1024² → 512² | `AS-GTI-ACT-07` — coordinated teal-and-ember strike line against a gate, forward motion not a victory explosion | `echo-throne.png`, `AS-ID-WORLD-01` | `echo-throne.png` / — | name/hotkey A and boss HP remain authoritative |

### 3.3 Reward art

Only six reward IDs currently have an art seam: `REWARD_ART_IDS` in `app.js`. `stillwater-hourglass`, `shadebreaker-brand`/`Bulwark Brand`, and `abyssal-banner` intentionally have **no image load** today; their name and description are the correct fallback until an implementation adds a mapped resource.

| Filename | Media / target dimensions | GTI prompt ID — subject | Required input references | Source key art / duration-fps | Static fallback and accessibility |
|---|---|---|---|---|---|
| `assets/images/ui/reward-ember-cohort.png` | `image/png`, 1536×1024 master → 512² crop | `AS-GTI-RWD-01` — compact ember-lit shade cohort banner, clearly a formation not a new character | `cinder-span.png`, `AS-ID-WORLD-01` | `cinder-span.png` / — | reward name/effect text remains full decision content; empty art alt |
| `assets/images/ui/reward-rift-lens.png` | `image/png`, 1536×1024 → 512² | `AS-GTI-RWD-02` — cracked teal-violet focusing lens in drowned iron setting | `cinder-span.png`, `AS-ID-WORLD-01` | `cinder-span.png` / — | text declares possession damage; icon must not imply universal damage |
| `assets/images/ui/reward-veil-vanguard.png` | `image/png`, 1536×1024 → 512² | `AS-GTI-RWD-03` — four poised shade vanguard silhouettes under a veil beacon | `veil-citadel.png`, `AS-ID-WORLD-01` | `veil-citadel.png` / — | text declares four starting shades and thin-legion caveat |
| `assets/images/ui/reward-anchor-shard.png` | `image/png`, 1536×1024 → 512² | `AS-GTI-RWD-04` — black anchor shard with a restrained teal repair seam | `veil-citadel.png`, `AS-ID-WORLD-01` | `veil-citadel.png` / — | text declares integrity restoration; icon must not look like an extra life |
| `assets/images/ui/reward-throne-echo.png` | `image/png`, 1536×1024 → 512² | `AS-GTI-RWD-05` — low throne resonance ring, a recorded oath moving over black water | `echo-throne.png`, `AS-ID-WORLD-01` | `echo-throne.png` / — | text declares archive effect; no gameplay-stat promise in art |
| `assets/images/ui/reward-dawnless-crown.png` | `image/png`, 1536×1024 → 512² | `AS-GTI-RWD-06` — fractured gate-forged crown in cold gold/violet, no royal face | `echo-throne.png`, `AS-ID-WORLD-01` | `echo-throne.png` / — | text declares archive effect; no victory-state implication before selection |

### 3.4 Storyboard / narration stills

| Filename | Media / target dimensions | GTI prompt ID — subject | Required input references | Source key art / duration-fps | Static fallback and accessible text |
|---|---|---|---|---|---|
| `assets/images/storyboard/scene_00_opening_gate_v01.jpg` | `image/jpeg`, 1536×1024 master → 3:2 card | `AS-GTI-NAR-00` — lunar fracture opening over a drowned coastal ward, Dusk Warden small but readable | `cinder-span.png`, `AS-ID-WORLD-01` | `cinder-span.png` / — | card title/description: gate opens; alt should be equivalent, not generic “Opening Gate” |
| `assets/images/storyboard/scene_01_soul_pool_v01.jpg` | `image/jpeg`, 1536×1024 | `AS-GTI-NAR-01` — defeated Ash Echo leaving one black-teal soul pool, ward ready for extraction | `cinder-span.png`, `AS-ID-WORLD-01` | `cinder-span.png` / — | text explains hunt/extract/materialize; alt describes the soul pool |
| `assets/images/storyboard/scene_03_possession_action_v01.jpg` | `image/jpeg`, 1536×1024 | `AS-GTI-NAR-03` — violet command line locks into an empty stone sentinel while two nodes glow beyond | `veil-citadel.png`, `AS-ID-WORLD-01` | `veil-citadel.png` / — | text explains possession; alt must not call it a character death |
| `assets/images/storyboard/scene_04_domain_shift_v01.jpg` | `image/jpeg`, 1536×1024 | `AS-GTI-NAR-04` — one brief violet domain arc covers the legion at the throne node | `echo-throne.png`, `AS-ID-WORLD-01` | `echo-throne.png` / — | text explains temporary Domain; alt says it is temporary |
| `assets/images/storyboard/scene_07_return_ui_v01.jpg` | `image/jpeg`, 1536×1024 | `AS-GTI-NAR-07` — quiet return to a black-water shrine, legion standard reflected in a sealed gate | `echo-throne.png`, `AS-ID-WORLD-01` | `echo-throne.png` / — | text explains return/archive; no permanent-progression claim beyond implementation |

## 4. Animated UI and narration treatment (manual PerfectPixel-style methodology)

PerfectPixel is **not** a source provider for this work: its supported styles are pixel/chibi/cartoon/retro16 and it has no GodTibo provider. Do not run or cite `ppgen` as satisfying GTI provenance. Borrow only its disciplined sequence—identity lock, numbered frames, alpha check, contact sheet, manifest, and review ledger—then execute the concept-art sequence manually from GTI stills and compositing.

| Animated family | Timeline at 16 fps | Expected source/export dimensions | Identity and composition requirement | Runtime fallback |
|---|---|---|---|---|
| Action confirmation flare | 8 frames / 0.50 s: F00 idle, F01–02 gather, F03 command-read, F04 peak, F05–06 dissipate, F07 clear | 512×512 RGBA per frame; 4×2 contact sheet/atlas 2048×1024 | lock action icon silhouette against `AS-ID-WORLD-01`; transparent outside smoke/rune, premultiplied-alpha preview against `#0e1218` and white | existing static `action-*.png`, text state, CSS effect, and audio cue |
| Possession / Domain narration overlay | 16 frames / 1.00 s: 4-frame settle, 4-frame glyph travel, 2-frame peak, 6-frame fade | 960×540 RGBA per frame; 4×4 atlas/contact sheet 3840×2160; no video alpha assumed | preserve sentinel or gate placement from the matched stage key art; overlay cannot obscure narration/objective | stage still plus typed Korean narration and status text |
| Stage atmosphere | no animated sprite requirement; use 5.00 s MP4 at 24 fps through the existing renderer | 2048×1152 GTI PNG input → 960×540 H.264/yuv420p output | movement is a stable crop/slow hold, never a generated character-performance substitute | stage still background and complete text briefing |

### Required animation validation ledger

Create one JSON/CSV row per output animation **before** it can be packaged. Required fields:

```text
resource_id, runtime_filename, source_key_art, gti_prompt_id, gti_provider,
input_reference_filenames, input_reference_sha256, raw_output_sha256,
identity_sheet_id, frame_count, fps, duration_ms, frame_dimensions,
alpha_background=transparent, alpha_edge_preview_dark, alpha_edge_preview_light,
contact_sheet_filename, atlas_filename, first_last_frame_match,
readability_at_48px, reduced_motion_fallback, alt_or_status_copy,
human_reviewer, review_date, verdict, corrective_action
```

Acceptance is concrete: exactly 8 or 16 numbered PNG frames; `duration_ms = frame_count / 16 × 1000`; all canvas corners have alpha 0; no checkerboard/green-screen imitation; subject centre varies by ≤4% of frame width across a loop; 48px action icon retains a unique silhouette; first/last-frame discontinuity is not visible in the contact-sheet flip; and the reduced-motion path preserves the identical action/status outcome. Failed rows stay `rejected` and are not copied into `assets/`.

## 5. Stage video matrix and choice gate

| Runtime filename | Media / duration-fps | Source key art / prompt | Baseline render and validation | Fallback / accessibility |
|---|---|---|---|---|
| `assets/video/cinder-span.mp4` | `video/mp4`, H.264, 960×540, 5.00 s, 24 fps | `assets/images/cinder-span.png` / `AS-GTI-STG-01` | `scripts/render_stage_video.py` render then validate | hide video; retain key-art gradient, narration and objective |
| `assets/video/veil-citadel.mp4` | same contract | `assets/images/veil-citadel.png` / `AS-GTI-STG-02` | same | same |
| `assets/video/echo-throne.mp4` | same contract | `assets/images/echo-throne.png` / `AS-GTI-STG-03` | same | same |
| `assets/video/abyssal-surge-cinematic.mp4` | optional campaign video; duration/fps must be recorded per cut | approved GTI storyboard stills / `AS-GTI-NAR-*` | FFmpeg assembly/validation first; not a gameplay dependency | `playCinematic()` already reports unavailable and preserves the text campaign briefing |

**Baseline is fixed:** `python3 scripts/render_stage_video.py render --input <approved-stage.png> --output <stage>.mp4` produces a 960×540, 24 fps, 5-second, H.264/yuv420p, faststart MP4 at CRF 20/medium by default; `validate --input <stage>.mp4` is the local ffprobe-backed proof. The currently observed active stage files are all 960×540, H.264, 24 fps, 5.000 s.

**Optional motion-provider gate:** The project owner selected **GTI-derived local collage composites -> Vox/Atlas image-to-video** on 2026-07-16. It remains a conditional execution route: a named owner must verify credentials, API availability, permitted use, output ownership, and an MP4 that passes the same local validator before any billable request. It cannot replace GTI still provenance, the FFmpeg baseline, local validation, or the static fallback.

## 6. Audio and narration import boundary

GTI cannot generate audio. Narration/SFX must be separately generated or recorded through a selected chatbot/audio source, then imported with explicit `provider`, `model/voice`, prompt/script ID, language, generated date, source-key-art linkage, checksum, loudness review, and human approval. It must never be recorded in the image manifest as “generated by GodTiboImagen.” The existing `scripts/generate_game_audio.py` makes remote calls only for explicitly selected providers and refuses missing credentials; its result is an import candidate, not proof of narrative approval.

For prerecorded audio/video, plan captions, visual description, and transcript with the media rather than after export, following W3C WAI’s guidance ([Making Audio and Video Media Accessible](https://www.w3.org/WAI/media/av/), accessed 2026-07-16; page updated 2024-09-17). Captions include meaningful non-speech audio; descriptive transcript covers visual information needed to understand the scene.

## 7. Packaging and acceptance checklist

A resource is ready to add to `assets/media-manifest.json` only when it has: exact runtime filename; MIME type; byte count; SHA-256; source key art; prompt ID; GTI provenance for images; input-reference hashes; dimensions; duration/fps where applicable; accessibility copy; runtime fallback; and human verdict. A subsequent implementation must also add its URL to the static workflow allowlist/service-worker optional media list as applicable; this document makes no source or cache change.

Unknowns remain explicit: no GTI generation run, alpha extraction, voice choice, Vox/Atlas credentials, image byte budget, or human/Playwriter review has been performed by this artifact.