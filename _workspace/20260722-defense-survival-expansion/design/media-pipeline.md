# Media and presentation pipeline

## Image provenance

New character art is generated with `gti` (GodTiboImagen private Codex backend), then cleaned into per-cell RGBA frames with a border-connected matte. Runtime assets are `assets/images/battle/dusk-warden-frame-00..03.png` and `assets/images/battle/echo-rusher-frame-00..03.png`. The original white-background GTI sources remain beside the cleaned frames for review. The images are not treated as PerfectPixel provider output.

## PerfectPixel discipline

The installed `ppgen` binary is used as the animation-contract reference (`-dump` catalog, 4-frame/8-frame identity checks). Its current provider surface is `gemini|openrouter|fal|byteplus`; it does not advertise `god-tibo-imagen`, so no unsupported provider call is claimed. Frame numbering, fixed 627×627 cells, and 2×2 contact-sheet identity are retained.

## Runtime motion

The passive renderer uses the current tick modulo four to select a frame, projects the actor onto an isometric ground ellipse, applies a bounded hover/bob, and falls back to procedural circles if image loading or `drawImage` is unavailable. This is a 2.5D visual layer only.

## Audio

`defense-audio.js` uses Web Audio oscillators for offline-safe BGM and cue synthesis. It has no network or binary asset dependency. `assets/audio/defense-audio-manifest.json` documents cue IDs, semantic events, and reduced-motion behavior. Audio nodes are disposed on session stop.

## Blender / VFX / cutscene boundary

Blender MCP was attempted but timed out before scene state could be observed; no unverified mesh or rig mutation is claimed. Existing staged Blender manifests remain untouched. Cutscene overlays and VFX pulses are authored in the browser presentation layer and are always optional over the text contract. The existing Vox concept film is retained as a reference/playback artifact; no new Atlas billable request is made without credentials.
