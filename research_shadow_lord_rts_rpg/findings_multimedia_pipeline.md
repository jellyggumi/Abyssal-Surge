# Shadow Lord multimedia-pipeline readiness

**Assessment date:** 2026-07-16  
**Scope:** current repository evidence only. This is an inspection record, not approval to generate, call an API, publish media, or use third-party IP.

## Verdict

The static, mobile-first game now has a **usable 2D image/audio/MP4 delivery path**, including explicit browser fallbacks and an FFmpeg validator. It is **not ready** for runtime 3D meshes, rigged animation, Motion Previs control bundles, Vox/Atlas video automation, or a production narration release without a rights/provenance and format-completion slice.

The safe boundary is: generate or author media outside the deployed client, review it, record provenance and rights, validate its file format, then commit only approved static derivatives under `assets/`. GitHub Pages must never receive source credentials or generation clients.

## Evidence snapshot

| Surface | Current, observed evidence | Readiness |
| --- | --- | --- |
| Image key art | `assets/images/{cinder-span,veil-citadel,echo-throne}.png` exists. `assets/media-manifest.json:6-33` records `image/png`, GTI/private-Codex provenance, byte count, SHA-256, and no reference input. FFprobe measured each at **1672×941**. | Ready for static 2D use; rights evidence incomplete. |
| PWA icons | `assets/icons/icon-192.png` and `icon-512.png` exist; `assets/media-manifest.json:35-61` records FFmpeg crop/scale derivation from `cinder-span.png`. `manifest.json:17-27` and `apk/twa-manifest.json:12-13` consume them. | Ready. |
| Runtime SFX and ambience | `assets/audio/{extract,domain,ambient}.mp3` exists. Manifest identifies ElevenLabs sound generation at `:63-91`. FFprobe measured MP3 stereo, 22050 Hz: **2.456 s / 10,049 B**, **2.821 s / 11,512 B**, **12.069 s / 48,501 B** respectively. `app.js:23-26`, `:292-304`, and `:414-437` play them through browser `Audio`. | Ready for current SFX/loop ambience only. |
| Stage video | `assets/video/{cinder-span,veil-citadel,echo-throne}.mp4` exists and is mapped by `app.js:27-36`. Each inspected stage clip is **H.264, yuv420p, 960×540, 24 fps, 5 s**. | Ready as optional/muted stage atmosphere. |
| Campaign cinematic | `assets/video/shadow-lord-cinematic.mp4` exists; manifest `:135-152` records FFmpeg derivation from the three key images plus `ambient.mp3`. It is **H.264, 960×540, 24 fps, 13 s**, with AAC stereo 22050 Hz. `app.js:439-462` loads it only after the user presses the cinematic button. | Ready as optional playback. |
| Scene-0 drafts | `assets/video/scene_00_gate_opening*.mp4` and individual 3-second shot drafts exist. The canonical current runtime does not reference them. `docs/shadow-lord-rts-rpg-hybrid-design.md:503-514` treats them as workspace/review artifacts and reserves `v100` for a review-final asset. | Review artifacts, not deploy contract. |
| Cache/delivery | `sw.js:1-25` has a required core list and `OPTIONAL_MEDIA` list containing all current runtime image/audio/video files. The install event uses `Promise.allSettled` for optional media (`:39-47`). GitHub Pages archives `assets/` wholesale (`.github/workflows/static.yml:66-82`). | Ready for static delivery; no CI media-quality gate. |

## Current browser contract and fallbacks

### Stage media

`app.js:205-237` is the source-of-truth stage-media behavior:

1. It first creates an `Image` for the per-stage PNG and applies it as a CSS background only after `onload`.
2. It clears any old video source, and avoids a video load entirely if the stage has no source or `prefers-reduced-motion: reduce` matches.
3. Otherwise it uses a muted, inline `<video>` (`index.html:141-146`) with `preload="metadata"`; successful metadata/loading exposes and attempts playback.
4. If video errors, it hides/removes the video; the loaded PNG background remains when available.

This means a missing/unsupported MP4 degrades to static stage key art rather than a blank stage. The fallback is only as good as the PNG asset: a failed image load removes the background-image as well (`app.js:212-220`).

### Campaign cinematic

`index.html:35-39` declares the cinematic as optional, muted, `playsinline`, controllable, and `preload="none"`. `app.js:439-462` waits for the user’s button press, attempts muted play, exposes native controls if autoplay is rejected, and on error hides the video with the text fallback: **“Cinematic unavailable. Text campaign briefing remains complete.”**

### Audio

Action SFX are best-effort: `app.js:292-304` resets and plays a single `Audio` instance, swallowing rejected playback. Ambient audio is explicit user interaction (`app.js:414-437`), loops with `preload="none"`, and changes the control text to **“Ambient sound unavailable”** on error. This is appropriate for browser gesture restrictions but does not implement narration, volume preferences, captions, or an audio accessibility setting.

### Offline and reduced motion

- Core application files are required during service-worker install; optional media cache failures do not prevent installation (`sw.js:39-47`).
- Same-origin GET media is cache-first when present (`sw.js:58-75`); uncached optional media still requires a network response on first use.
- `styles.css:247-250` suppresses CSS motion under reduced motion. `app.js:226` also skips stage video under the same preference.
- `index.html:213` provides only a JavaScript-required `<noscript>` message; it is not a playable media fallback.

## Tool and production-path assessment

| Path | Source-backed capability | Safe integration boundary | Blockers / missing proof |
| --- | --- | --- | --- |
| **God Tibo Imagen (`gti`)** | Existing key art is explicitly recorded as `generated_by: "gti via private-codex"` in `assets/media-manifest.json:6-33`. Local inspection also found `gti` and Codex auth available. The active design stores five concept-prompt topics in `docs/shadow-lord-rts-rpg-hybrid-design.md:492-502`. | Use as an **offline concept/key-art producer** only. Select a human-approved PNG, record provider, prompt/revision, model/version if known, source references, rights review, SHA-256, and intended destination before committing it. The current raster path accepts PNG key art and `scripts/render_stage_video.py` can make a deployable stage MP4 from it. | The manifest records generator and hashes, but no license grant, model version, prompt record for the supplied key art, human approval, or commercial-use confirmation. The manifest’s “Original” derivation is not legal clearance. Do not use copyrighted character names, logos, screenshots, or reference art as generation inputs without rights. |
| **Blender / Blender MCP meshes** | Repository inspection found **no tracked `.blend`, `.glb`, `.gltf`, `.fbx`, `.dae`, or `.obj` files**, no rig/armature/OpenPose/camera-motion metadata, and no browser 3D loader. The read-only Blender object-summary MCP request timed out after 30 seconds, so it does not establish an accessible live scene or mesh inventory. | Blender can safely remain an **external pre-render tool**: render a reviewed PNG or H.264 MP4 derivative, then process it through the existing static asset contract. | Mesh availability is unconfirmed; local `blender` executable was not found in the prior prerequisite probe. No WebGL/Three.js/Babylon integration exists, no model/texture budget exists, and no runtime fallback for a mesh exists. A direct mesh/rig integration is blocked. |
| **Motion Previs Studio / animation or rigging** | The repository contains no Motion Previs project, no ControlNet/OpenPose export, no pose/depth/camera JSON, no Blender importer, and no runtime control-layer consumer. The active design describes image-sequence cinematics rather than rigged gameplay animation (`docs/shadow-lord-rts-rpg-hybrid-design.md:325-358`). | Use Motion Previs only as an **offline previs/reference pass**. Its selected final output must be flattened to the established PNG or H.264 MP4 contract; do not ship raw control bundles to this static browser. | There is no production specification for skeleton, rig, frame data, control layers, licensing of input clips, or mobile GPU/runtime cost. The current MP4 supports atmosphere; it does not demonstrate a playable animation/rig system. |
| **ElevenLabs SFX** | `scripts/generate_game_audio.py:1-176` implements an explicit ElevenLabs sound-generation path to `https://api.elevenlabs.io/v1/sound-generation`, writes only an explicit `.mp3` output, checks MP3 signatures, rejects redirects, redacts header values in HTTP errors, and uses atomic writes. Existing runtime SFX manifest entries cite ElevenLabs. | Suitable for **authorized offline SFX generation** from original prompts, followed by format/provenance validation and human review. Keep credentials in a selected ignored env file or process environment only. | Generation consumes remote API quota. There is no license/terms evidence, per-asset approval, loudness target, or browser-volume preference in source. The runtime only maps `extract` and `domain`; other action effects intentionally have no audio mapping. |
| **Gemini narration** | `scripts/generate_game_audio.py:179-240` calls the Gemini preview TTS endpoint, validates `audio/L16`, converts network-endian PCM to a mono WAV, and requires an explicit `.wav` output. The command has `--dry-run` that does not read credentials or send requests (`:217-281`). | Suitable only as an **offline narration source** after an authorized run. A release artifact needs a reviewed transcode, captions/transcript, a runtime source map, and controls before it becomes player-facing. | No generated narration asset is present, no runtime narration element exists, no captions/transcript format is wired, and the PWA optional-media list does not name a narration track. The endpoint/model is preview-labelled in source; it must not be assumed stable without a fresh, authorized validation. |
| **Vox/Atlas-style video** | No repository file, environment variable, provider client, or Atlas/Vox configuration was found. The installed Vox Director skill describes a cloud-keyed workflow, but that is agent tooling—not a repository dependency or an approved provider integration. | Do not integrate it into GitHub Pages or client JS. At most, use it later as an authorized external production tool and bring back only rights-cleared reviewed H.264/AAC MP4 derivatives. | It requires a separate cloud API key and spends external credits; neither authorization nor source configuration is present. There is no per-shot source-rights record, brand/voice clearance, caption contract, or mobile playback acceptance proof. |
| **FFmpeg / Remotion / Shotstack alternatives** | The design explicitly selects **Manual-finish hybrid**: first-pass FFmpeg/Remotion, then manual colour/logo/sound finish (`docs/shadow-lord-rts-rpg-hybrid-design.md:330-342`). It documents `staticFile()`, `TransitionSeries`, FFmpeg `xfade`, `scale/pad`, `acrossfade`, H.264/yuv420p output, and a conceptual Shotstack template path (`:344-364`, `:451-482`). `scripts/render_stage_video.py:1-238` is an implemented FFmpeg path. | **FFmpeg is the current production-ready path.** Remotion is a design-approved but uninstalled/unimplemented option. Shotstack remains a documented future API/template option, not an integration. | The design recommends both 1920×1080 24/30 fps cinematic targets (`:383-389`) and the runtime’s 960×540/24 fps implementation. A single final distribution profile is not yet frozen. Remotion/Shotstack have no package/config, renderer, tests, or credentials in this repo. |
| **Compression / validation** | `scripts/render_stage_video.py:1-238` fixes deployed stage output to **H.264, yuv420p, 960×540, 24 fps, CRF 20, medium preset, faststart**. `probe_video()` checks codec, dimensions, pixel format, frame rate, positive length/size, MP4 container, and `moov` before `mdat` (`:86-135`). It writes through a temporary file then atomically replaces the destination (`:161-211`). | Use the provided renderer/validator for still-image stage outputs. It is safe to validate existing files without network access. Existing videos match the H.264/960×540/24 fps contract. | There is no repository-wide media byte budget, duration budget, audio loudness target, image optimizer, WebP/AVIF policy, CI invocation of `validate`, or validation for MP4 audio stream/caption tracks. `compresso`, pngquant, jpegoptim, and gifski were not present locally in the prerequisite check. |

## Rights and IP constraints

1. **The product text is internally inconsistent on IP position.** `docs/shadow-lord-rts-rpg-hybrid-design.md:22,47-50` expressly bases the design on *Solo Leveling* and names a protagonist, while `README.md:6` and `index.html:18` label the web game as an **original** Shadow Lord RTS-RPG. The original-name positioning is not evidence of a license to use the referenced IP.
2. `research_shadow_lord_rts_rpg/findings_web_delivery.md:111-114` already requires license/attribution validity for every asset and prohibits unlicensed copyrighted characters/assets from Android distribution.
3. No current source provides a franchise license, character/name/logo authorization, voice consent, music/SFX commercial license, provider commercial-use terms, or a human approval record. Therefore, the only source-backed safe direction is **original world, character, visual, audio, and narration material** with a per-asset provenance and rights record.
4. `assets/media-manifest.json` is a valuable integrity inventory (bytes, SHA-256, derivation) but is not sufficient rights clearance. Extend its governed process—not necessarily its schema—with: source/provider, model/version, input/reference rights, generated date, approver, license/terms reference, restricted-use flag, final destination, and revision.
5. Never send local credentials, provider responses, private Codex authentication, or copyrighted reference material to the browser, Pages artifact, service-worker cache list, public manifest, test screenshots, or logs.

## Exact current asset formats

| Asset class | Observed format | Runtime role |
| --- | --- | --- |
| Key art | PNG, 1672×941; 2.34–2.75 MB each | campaign-map `<img>` and loaded CSS stage fallback background |
| PWA icons | PNG, 192px and 512px | web manifest and later TWA metadata |
| SFX/ambience | MP3, stereo 22050 Hz | `Audio` action cues and explicit ambient loop |
| Stage atmosphere | MP4/H.264/yuv420p, 960×540, 24 fps, 5 s | muted/inline optional stage video over PNG fallback |
| Campaign cinematic | MP4/H.264/yuv420p, 960×540, 24 fps, 13 s; AAC stereo 22050 Hz soundtrack | user-triggered muted inline video with native controls |
| Gemini narration draft output | WAV, mono 16-bit PCM, provider-returned sample rate | not currently deployed or referenced by runtime |
| Mesh/rig/control bundle | none | unsupported by current browser application |

## Blockers before a broader production batch

1. **Rights gate:** resolve the Solo Leveling-derived design text versus the product’s original-IP position before any asset generation or marketing release. Do not generate/lookalike named-character content absent a license.
2. **Provenance gate:** current GTI and pre-existing video entries lack complete rights/model/prompt/approval provenance; the source says some renderer details remain unrecorded (`assets/media-manifest.json:3`).
3. **Narration release gate:** implement a caption/transcript, player controls, localization, output transcode choice, volume preference, and an explicit runtime asset mapping before generating narration for release.
4. **3D/rig gate:** decide whether gameplay remains 2D/static-video first. A mesh/rig feature needs a separate renderer, asset format, mobile GPU/memory budget, loading/error fallback, and Playwriter evidence.
5. **Video profile gate:** reconcile the design’s 1920×1080 cinematic recommendation with the deployed 960×540/24 fps mobile contract; determine whether cinematic assets are stream/download optional or precached.
6. **Automation gate:** no build workflow invokes `render_stage_video.py` or audio/media validators. Generated media remains a reviewed pre-commit deliverable, not CI-generated content.
7. **Vox/third-party API gate:** no Atlas/Vox/Shotstack authorization or repository integration exists. Treat all such tools as external offline production systems until a separate provider/risk/rights decision approves one.

## Recommended next slice

Keep Stage 1 presentation 2D and static-media-first. The smallest safe slice is:

1. Freeze the three currently deployed stage PNG/MP4 and three audio files as the baseline resource manifest.
2. Add approval/provenance fields or an adjacent reviewed record for the existing assets, without inventing provider rights.
3. Run only local format validation against current MP4/MP3 candidates; do not make network calls.
4. Define one distribution profile and one browser accessibility packet: reduced-motion behavior, video/missing-media fallback, audio enable/volume, transcript/caption policy, and mobile network budget.
5. Use Playwriter—not the existing Playwright harness—to verify: first-use stage image fallback, reduced-motion video suppression, missing-video fallback to image, optional-cinematic error message, ambient-audio error state, and cached offline replay.

Only after that proof should the team authorize a new GTI, ElevenLabs, Gemini, Blender, Motion Previs, Vox, Remotion, or Shotstack production batch.

## Inspection evidence

No generator, audio/video API, compression render, formatter, linter, project-wide test, browser test, or application/docs edit was run for this assessment. The following read-only checks grounded it:

- target reads of `app.js`, `index.html`, `sw.js`, `manifest.json`, `apk/twa-manifest.json`, `.github/workflows/static.yml`, `scripts/render_stage_video.py`, `scripts/generate_game_audio.py`, `assets/media-manifest.json`, and the active game-design document;
- `ffprobe` inspection of every current image/audio/video asset;
- tracked-file checks for mesh and rig/control-bundle extensions (no matching production assets);
- a read-only Blender MCP object-summary attempt, which timed out and therefore provides **no positive scene/mesh claim**.
