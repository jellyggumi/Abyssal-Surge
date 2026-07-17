# Abyssal Surge Presentation Specification

**Status:** Stage 1 preproduction contract. It defines the presentation to implement and recheck; it does not claim a changed build, generated media, or passed playtest.
**Audience:** implementers, narrative/audio producers, designers, and QA.
**Companion:** [`resource-bible.md`](resource-bible.md) is the canonical prompt, source-key-art, provenance, animation, and manifest matrix. This document owns player-facing behavior, pacing, accessibility, and review evidence.

## 1. Non-negotiable presentation promise

The player is the **Dusk Warden** directing a temporary legion through a lunar-fracture crisis. Presentation must make the action chain intelligible without adding a tutorial overlay that competes with the playfield:

```text
Hunt a threat → extract its soul pool → materialize shades → capture the named node
→ apply the stage power (possess in Stage 2; one-use Domain in Stage 3) → assault the boss gate.
```

The campaign rises from first command, to multi-node control, to one controlled comeback:

| Stage | Player-visible promise | Art/narration emphasis | Rule that cannot be hidden in art |
|---|---|---|---|
| 1 — Cinder Span | Make the first legion from recovered echoes. | ember bridge, ash spoor, a soul pool, then a formed line. | Capture one forge node before assaulting Cinder Warden. |
| 2 — Veil Citadel | Turn an enemy formation into a tactical opening. | two beacons and an empty stone sentinel receiving a violet command thread. | Possession is gated and two nodes must be held. |
| 3 — Echo Throne | Spend a finite moment of protection at the right time. | throne node, unstable domain arc, gate above black water. | Lord’s Domain is finite; it does not itself win the battle. |

The visuals are **original, non-pixel, painterly dark-fantasy concept art**: wet obsidian, drowned iron, charcoal negative space, abyss teal for allied binding, violet for control, and ember-gold/red only for pressure. No generic neon cyberpunk, copied franchises, logos, readable text in generated art, anime/chibi styling, or retro/pixel rendering. The exact per-stage UI palette stays in `battle-presentation.js`; generated art supports it rather than becoming a competing colour system.

## 2. Active seams and behavior contract

| Seam | Present behavior observed in source | Required presentation outcome | Fallback that must remain valid |
|---|---|---|---|
| Lobby map art (`index.html`) | Three stage images link the campaign progression. | A player can distinguish place and escalation at thumbnail scale. | stage title, badge, and route description remain sufficient without art. |
| Storyboard cards (`index.html`) | Five stills show opening, extraction, possession, Domain, and return. | A player understands the narrative arc before starting, without mistaking it for a required cinematic. | title and description communicate each beat; descriptive alt replaces generic current alt text when this surface is revised. |
| Stage transition (`app.js` `renderStageMedia`) | A key-art gradient is prepared; a 5-second muted MP4 is attempted unless reduced motion is active. | Stage mood arrives before the objective without masking the objective. | key art may fail; objective and narration remain readable with no visual prerequisite. |
| Narration (`NARRATION`, `typeNarration`) | Text is mirrored immediately into `#narration-sr`; visible text types at 45 ms/character and honours reduced motion. | One short Korean imperative explains the next player choice. | screen-reader status plus visible non-animated text; failed audio does not suppress copy. |
| Command pad | Each button has text, hotkey and an empty-alt decorative icon. | The icon reinforces one verb; state, cost, availability, and outcome are communicated in text/UI. | button remains usable and intelligible when the image fails. |
| Reward cards (`renderRewards`) | Image is added only for six IDs in `REWARD_ART_IDS`; error removes it. | A reward thumbnail names the doctrine without competing with its mechanical description. | reward name/description alone supports a correct choice. |
| Boss portrait (`BOSS_BY_STAGE`, `BOSS_ART`) | Portrait is decorative next to name, lore, HP, threat and counter information. | Threat personality and stage material are visible in both briefing and battle. | boss name/HP/lore remain authoritative. |
| Optional campaign cinematic (`playCinematic`) | On load error it explicitly says text campaign briefing remains complete. | It is a supplemental recap, never a gate to start or understand the game. | existing status message and text briefing. |

The configured release target for the current campaign is **`https://jellyggumi.github.io/Abyssal-Command/`**. `https://jellyggumi.github.io/Abyssal-Surge/` currently redirects to a journal and is not a valid playtest URL. This spec does not decide a repository rename or GitHub Pages configuration.

## 3. Korean narration direction and pacing

### 3.1 Voice and writing rules

- **Voice:** calm, low, ceremonial field command. The Warden receives an instruction; the narrator does not praise the player, over-explain lore, or promise a power the rules do not grant.
- **Syntax:** place first, pressure second, imperative last. Use Korean nouns already exposed by the UI—`영혼`, `실체화`, `점거`, `빙의`, `군주의 영역`, `총공격`—to make narration and controls reinforce one another.
- **Density:** two short clauses by default; three only when Stage 2 must establish possession plus the dual-node condition. No line should introduce more than one mechanical requirement that is not already visible on the objective/checklist.
- **Accessibility:** visible narration is mirrored into the status text before its typewriter playback. Audio is optional accompaniment, not the only delivery of content.

### 3.2 Locked copy intent and current timing

The table describes the current configured strings rather than authorizing a source edit. `typing target` is derived from the actual 45 ms per character setting; inter-line hold is the configured delay. A natural voice performance may be shorter, but it must begin no later than the matching visible line and must not delay input.

| Trigger | Current Korean lines | Intent / player decision | Visible pacing | Audio import requirement |
|---|---|---|---|---|
| New campaign | `심연의 문이 열렸다.` / `그림자 군주여, 일어나라.` | premise and call to command; no mechanical instruction yet | 45 ms/char, 1.4 s hold each | `narr-intro.mp3`; Korean script ID `AS-NAR-INTRO`; narrator/source/provenance recorded separately from GTI |
| Cinder Span | `잿빛 교량, 신더 스팬.` / `재의 메아리를 사냥하고 영혼을 거두어라.` | introduces hunt then extract; materialize/capture stay in objective/checklist | 45 ms/char, 2.0 s hold | `narr-stage1.mp3`; script ID `AS-NAR-01` |
| Veil Citadel | `장막 성채, 베일 시타델.` / `빙의의 힘이 깨어난다.` / `두 거점을 동시에 장악하라.` | call out Stage 2 novelty and dual-node requirement in order | 45 ms/char, 1.7 s hold | `narr-stage2.mp3`; script ID `AS-NAR-02` |
| Echo Throne | `메아리 왕좌.` / `군주의 영역을 펼쳐 게이트 소버린을 무너뜨려라.` | frame Domain as a means to the assault; it is not a victory announcement | 45 ms/char, 2.0 s hold | `narr-stage3.mp3`; script ID `AS-NAR-03` |
| Victory | `침묵한 문 앞에서,` / `그림자 군단이 왕좌에 오른다.` | closure after the state is already complete | 45 ms/char, 1.4 s hold | `narr-victory.mp3`; script ID `AS-NAR-WIN` |
| Defeat | `군단의 닻이 끊어졌다.` / `다시, 일어나라.` | recoverable loss; invitation to retry without blame | 45 ms/char, 1.4 s hold | `narr-defeat.mp3`; script ID `AS-NAR-LOSS` |

**Audio truthfulness.** GodTiboImagen is image-only in this production plan. Narration and SFX are separately importable chatbot/audio-source outputs; their manifest records provider, model/voice, source script, date, checksum, language, key-art linkage and human approval. No audio may carry GTI provenance. The existing audio-generation script requires explicit credentials and selected output paths; that is a safe import boundary, not evidence that a voice has been generated or approved.

## 4. Resource handoff required by this spec

This condensed table is intentionally redundant with the resource bible so a presentation implementer can see exactly which media type is optional. The resource bible has the complete per-file prompt and input-reference requirements.

| Family / exact filename pattern | Media / source key art | Prompt family | Duration/fps | Player-facing fallback / accessibility |
|---|---|---|---|---|
| `assets/images/{cinder-span,veil-citadel,echo-throne}.png` | `image/png`; each is the matching stage source plate | `AS-GTI-STG-01..03` | still | title, region, objective and narration survive absent image; supply descriptive map/briefing alt |
| `assets/images/ui/boss-{cinder-warden,veil-tactician,gate-sovereign}.png` | `image/png`; linked to its stage plate | `AS-GTI-BOS-01..03` | still | decorative alt only because adjacent boss text exists; HP/threat/lore never in image only |
| `assets/images/ui/action-{hunt,extract,materialize,capture,possess,domain,assault}.png` | `image/png`; source plate matches action’s stage | `AS-GTI-ACT-01..07` | static; optional 8-frame 16-fps enhancement | button text, hotkey, availability and action feedback remain correct without icon |
| `assets/images/ui/reward-{ember-cohort,rift-lens,veil-vanguard,anchor-shard,throne-echo,dawnless-crown}.png` | `image/png`; stage key art input | `AS-GTI-RWD-01..06` | still | reward name/effect text remains decision content; three currently unmapped rewards remain text-only |
| `assets/images/storyboard/scene_{00,01,03,04,07}_*_v01.jpg` | `image/jpeg`; stage key art input | `AS-GTI-NAR-00/01/03/04/07` | still; optional 16-frame 16-fps overlay only | card title/description and a meaningful equivalent alt communicate beat |
| `assets/video/{cinder-span,veil-citadel,echo-throne}.mp4` | `video/mp4`; corresponding GTI still | `AS-GTI-STG-01..03` | 5.00 s / 24 fps | suppressed for `prefers-reduced-motion`, failure, or no media; background/key text remains |
| `assets/video/abyssal-surge-cinematic.mp4` | `video/mp4`; approved GTI storyboard stills | `AS-GTI-NAR-*` | record final cut duration/fps | explicit optional control, native controls, captions/transcript; text briefing stays complete |

## 5. Motion, animation, and media requirements

### 5.1 16-fps composited art

If implementation adds animated action or narration effects, use the manual GTI-to-composite method from `resource-bible.md`, not PerfectPixel output:

- action confirmation: 8 transparent PNG frames at **16 fps** (0.50 s), 512×512 each, 4×2 2048×1024 atlas/contact sheet;
- narration overlay: 16 transparent PNG frames at **16 fps** (1.00 s), 960×540 each, 4×4 3840×2160 atlas/contact sheet;
- identity lock: curate world/boss reference sheets first; every generated still, alpha matte, frame number, hash, and reviewer goes in the validation ledger;
- validation: transparent corners, no fake checkerboard/green screen, coherent first/last frame, subject-centre drift ≤4%, action silhouette readable at 48 CSS px, and a no-motion equivalent outcome.

PerfectPixel methodology is limited to the validation discipline (identity lock, frame count, alpha, manifest and human review). Its pixel/chibi/cartoon/retro16 style scope and lack of a GodTibo provider make it unsuitable as the generator or provenance source here.

### 5.2 Motion safety

- Respect `prefers-reduced-motion`: current stage-video playback is already withheld and typewriter motion becomes immediate text. New motion must preserve that behavior.
- Treat all new action art as decorative reinforcement; never make a timing window, target, resource amount, or failure state discoverable only through motion, colour, or sound.
- Auto-playing visual media longer than five seconds presented beside interactive content needs a pause/stop/hide mechanism unless essential. The 5-second stage clips should not be extended without adding a user control; the optional cinematic already uses native controls. This follows [W3C WCAG 2.2 SC 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html), accessed 2026-07-16.
- Do not create full-screen flashes at more than three flashes per second; use a low-area, low-contrast glyph expansion or a still status change instead.
- For narrated/cinematic media, supply synchronized captions that include meaningful non-speech audio plus a descriptive transcript when the visual carries narrative information, as described by [W3C WAI media guidance](https://www.w3.org/WAI/media/av/), accessed 2026-07-16 (updated 2024-09-17).

## 6. Stage video generation decision gates

### 6.1 Baseline: local FFmpeg renderer and validator

The selected baseline is the existing `scripts/render_stage_video.py`, which accepts an approved PNG stage still and locally renders H.264/yuv420p at **960×540, 24 fps, 5.0 seconds**, CRF 20, medium preset, with `faststart`. Example execution for a future production run:

```sh
python3 scripts/render_stage_video.py render \
  --input assets/images/cinder-span.png \
  --output assets/video/cinder-span.mp4
python3 scripts/render_stage_video.py validate \
  --input assets/video/cinder-span.mp4
```

The validator’s JSON is the required local evidence for codec, dimension, fps, duration and faststart before the MP4 is eligible for the manifest. Existing active stage MP4s were inspected as H.264, 960×540, 24 fps, 5.000 s; their historical renderer provenance is incomplete for Cinder Span/Veil Citadel, so the next replacement must use the baseline and record it.

### 6.2 Optional motion-video branch: Vox/Atlas

Vox/Atlas is a **conditional experiment**, not a selected dependency. It may be attempted only if all of the following are logged before submitting a generation request:

1. a named owner verifies credentials without committing them, current provider availability, allowed content/use terms, and output ownership/retention;
2. the source still is an approved GTI key art image from the resource matrix, and the motion prompt contains no third-party character/style reference;
3. the output can be exported locally as an MP4 and passes `render_stage_video.py validate` or an equivalent validator that proves the same codec/dimension/fps/duration/faststart contract;
4. a human compares the motion output to the source key art for identity drift, misleading tactical content, flashing, and caption/transcript coverage;
5. the existing FFmpeg still-based MP4 and text/key-art fallback remain packageable, so a provider outage cannot block offline play.

If any gate is missing or fails, use the FFmpeg baseline. No Atlas credentials were verified by this artifact.

## 7. Concrete human / Playwriter recheck rubric

**Run target:** `https://jellyggumi.github.io/Abyssal-Command/` after the relevant implementation is deployed, plus the local Playwriter-served build. Record browser URL, viewport, date, build tag, relevant media response/error, screenshot/video evidence and tester initials. Do not use the redirecting `Abyssal-Surge` URL as evidence.

| Check | Playwriter/human procedure | Pass evidence | Fail condition / corrective action |
|---|---|---|---|
| Route and lobby identity | Open the target URL; observe heading, three map nodes, optional-cinematic control and five storyboard cards. | URL stays on the active game; Cinder/Veil/Throne order and card copy are visible without needing a cinematic. | wrong redirect, hidden/misordered stage, or card only understandable from image → fix routing/copy/alt before visual polish. |
| Stage art and briefing fallback | Start a new run, inspect Cinder Span; repeat after inducing a failed image/video request in the Playwriter session if supported. | title, region, objective, narration text and start/boss controls remain actionable; failed video/image removes only decoration. | art failure hides objective, blocks buttons, or changes state → fix load/error path. |
| Core-loop narration | Play to each stage using the deterministic actions; at each entry compare Korean narration with objective/checklist and available commands. | Stage 1 cues hunt/extract, Stage 2 cues possession + two nodes, Stage 3 cues Domain then assault; no line promises a different effect. | copy contradicts rules, introduces a hidden prerequisite, or cannot be read before input → revise script or pacing. |
| Action/reward art semantics | At 48 CSS px inspect each action icon; reach reward choice where possible and compare each thumbnail with its exact name/effect. | seven verbs are individually recognisable; six mapped rewards appear only as supportive imagery; text alone yields correct decision. | duplicate/ambiguous silhouette, art implies a false mechanic, or text depends on image → regenerate/revise mapping. |
| Boss continuity | Visit each boss specification and battle view. Compare portrait material, stage key art and stage palette. | Cinder/Veil/Sovereign are distinct, match their stage, and boss HP/threat/lore stays text-readable. | portrait obscures data, changes boss identity between views, or gives a future-stage spoiler → replace/crop. |
| Reduced motion | Enable `prefers-reduced-motion` in the Playwriter/browser environment, reload each stage. | stage MP4 is hidden; narration becomes immediate visible text; core loop and feedback remain usable. | video/typewriter still runs or a state is communicated only through motion → correct media gate. |
| Keyboard and screen-reader text | Tab through start, stage controls, command buttons, reward choices, audio/media controls; trigger a stage narration and inspect `#narration-sr`. | focus order is visible; button names/hotkeys remain meaningful; status contains the full narration before/while visual typing occurs. | focus trap, unlabeled control, or status only has partial copy → correct semantic control/text mirror. |
| Media controls and captions | Play the optional cinematic; verify native pause/volume controls. If voiced/captioned output is integrated, compare caption timing and descriptive transcript to the cut list. | cinematic remains optional; control works; captions include speech and meaningful SFX; transcript conveys visual beat. | playback blocks campaign, captions omit meaningful audio, or visual-only event changes understanding → fix player/captions/transcript. |
| Frame/flash review | Review every 16-fps contact sheet and stage video with a human at normal speed and frame advance. | ledger contains 8/16 exact frames, alpha checks, hash, source art, reviewer and fallback; no unsafe high-frequency flash. | fake transparency, identity drift, loop jump, >3 Hz bright flash, or missing ledger → reject asset, do not package. |

A gate passes only when each applicable row has recorded evidence. A passing local image load is not proof that offline cache, Pages packaging, narration audio, or the optional cinematic is correct; those remain separate checks.

## 8. Implementation handoff and explicit unknowns

When media is actually added/replaced, implementation must update the source mapping, media manifest, static deployment allowlist, service-worker optional-media list, and any needed alt/caption/transcript source in the same change. The deterministic rules and browser-local state must not wait for a generated image, video, audio provider, or network response.

Unresolved by design: the selected narration voice/chatbot provider, GTI provider availability at production time, final image byte budgets, Vox/Atlas credential verification, exact cinematic cut list, human art review, Playwriter evidence, caption/transcript files, and release URL rename decision. None is represented as complete here.