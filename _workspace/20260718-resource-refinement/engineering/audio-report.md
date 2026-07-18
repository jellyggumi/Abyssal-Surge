# Audio Resource Refinement Report

- Run: `20260718-resource-refinement`
- Operating mode: Stage 1 resource/presentation refinement
- Scope: procedural audio generation, runtime cue/event wiring, scene audio lifecycle, PWA cache inventory, and provenance
- Network/provider use: none. No provider key was read and no network generation request was made.

## Delivered assets

| Asset | Runtime role | Delivery facts | Loudness probe | SHA-256 |
|---|---|---|---|---|
| `assets/audio/breach-alert.mp3` | Accepted encounter `breach` alarm | MP3, 44.1 kHz, mono, 128 kbps CBR, 2,429 ms, 39,331 bytes | $-14.42$ LUFS-I, $-3.51$ dBTP | `53029cb65a9427cfa07165d0bb47f800f2d03a5a99c9ed5dfac6affd285f8f00` |
| `assets/audio/wave-spawn.mp3` | Accepted encounter `start-wave` signal | MP3, 44.1 kHz, mono, 128 kbps CBR, 1,541 ms, 25,120 bytes | $-14.62$ LUFS-I, $-2.95$ dBTP | `8a82db32f7bc0aa6500c861a51660da79d92847ad5ccd23ee7396d5b59c3b427` |
| `assets/audio/battle-bgm.mp3` | User-enabled battle music layer | MP3, 44.1 kHz, stereo, 128 kbps CBR, 24,033 ms, 384,983 bytes | $-18.05$ LUFS-I, $-5.30$ dBTP, LRA $4.20$ | `8ee2f7e0c8d8289a3ff9c52170a53d036569376df20a0de97af146eb8c326a4d` |

The delivered files total 449,434 bytes. All 20 shipped MP3 files total 1,369,716 bytes (1.306 MiB), below the 4 MiB active-audio hard budget. The generator rejects near-silent procedural PCM before transcoding; the decoded MP3 loudness probes above independently establish audible signal and headroom.

## Local procedural provenance

`scripts/generate_game_audio.py procedural` is the explicit credential-free generation path. It streams deterministic 16-bit PCM to a temporary WAV, checks for a non-trivial peak, transcodes atomically with ffmpeg/libmp3lame, and validates the promoted 44.1 kHz MP3 against the role's channel, duration, bitrate, and byte limits. It refuses replacement unless `--replace` is supplied.

Generation commands:

```sh
python3 scripts/generate_game_audio.py procedural --cue-id breach-alert --output assets/audio/breach-alert.mp3
python3 scripts/generate_game_audio.py procedural --cue-id wave-spawn --output assets/audio/wave-spawn.mp3
python3 scripts/generate_game_audio.py procedural --cue-id battle-bgm --output assets/audio/battle-bgm.mp3
```

Recipes are canonical in `PROCEDURAL_CUES` and copied verbatim into each `assets/media-manifest.json` record:

- `breach-alert`: swept 620 Hz siren and second harmonic, 92 Hz sub impact, deterministic xorshift grit, attack/release envelope.
- `wave-spawn`: quadratic 110–420 Hz chirp, 68 Hz portal impact, 740 Hz confirmation partial, deterministic xorshift grit.
- `battle-bgm`: stereo phase-aligned 55/82.5/110 Hz drones, alternating 165/220 Hz overtones, two-second 52 Hz pulse, and loop-edge crossfade.

## Runtime contract

`app.js` maps `start-wave` to `wave-spawn` and `breach` to `breach-alert` only after `applyEncounterEvent` accepts the event. Playback therefore remains presentation-only and cannot modify `campaign-state.js` results. The encounter promise queue serializes reducer application before cue dispatch, rejected duplicate events produce no authored cue, a 150 ms same-cue guard suppresses immediate duplicate playback, and one reusable cue player prevents overlapping detached audio instances.

Battle music preserves the existing user gesture/autoplay contract. Enabling BGM in the lobby sets user intent; entering a live battle swaps `bgm-theme.mp3` to `battle-bgm.mp3` and resumes only when the user had enabled music. `bgmSceneRun` rejects stale async play completions. `stopBattle()` pauses and unloads the current one-shot cue and stage ambience, resets the ambience control, and returns enabled music to `bgm-theme.mp3`; it does not leave battle audio running in the lobby.

Browser evidence from a clean local HTTP session:

- Lobby after explicit BGM click: source `assets/audio/bgm-theme.mp3`, `paused=false`, toggle `aria-pressed=true`.
- Live battle after `전투 개시`: source `assets/audio/battle-bgm.mp3`, `data-audio-scene=battle`, `paused=false`, toggle still pressed.
- After the declared preparation path and accepted first `start-wave`, the page called `play()` with `assets/audio/wave-spawn.mp3`; the resource timing entry was `http://127.0.0.1:4199/assets/audio/wave-spawn.mp3`, and campaign status was `정찰 웨이브가 전장에 도달했습니다.` Subsequent declared waves each emitted one signal at approximately 14-second intervals; these were distinct accepted waves, not duplicate dispatches.
- After `사령부로 돌아가기`: lobby visible, campaign screen hidden, source restored to `assets/audio/bgm-theme.mp3`, `data-audio-scene=lobby`, enabled music continued, and stage ambience was reset to `aria-pressed=false`.

The breach cue uses the same accepted-event dispatch branch as the browser-observed wave cue. The deterministic local battle run cleared all three waves before an enemy breach, so no fabricated breach playback claim is made; the static integration check below verifies the `breach -> breach-alert` branch and asset/cache/manifest identity.

## Cache and manifest

`sw.js` lists all three new MP3s in `OPTIONAL_MEDIA`. `assets/media-manifest.json` contains one record per asset with generator, prompt/procedure, delivery facts, byte size, and SHA-256. A targeted consistency check confirmed every new path exists, appears once in `app.js`, appears once in the service-worker media inventory, and has matching manifest bytes, role, bitrate, and digest.

## Local verification

Only audio-local and directly affected syntax/integration checks were run; no project-wide test suite was run.

```sh
python3 scripts/generate_game_audio.py validate --input assets/audio/breach-alert.mp3 --role sfx
python3 scripts/generate_game_audio.py validate --input assets/audio/wave-spawn.mp3 --role sfx
python3 scripts/generate_game_audio.py validate --input assets/audio/battle-bgm.mp3 --role music
```

Results: all returned `"valid": true`. Observed delivery facts are the values in the asset table; SFX limits were 500–3,000 ms, mono, 128 kbps, and at most 100 KiB. Music limits were 10,000–60,000 ms, stereo, 128 kbps, and at most 1 MiB.

```sh
ffmpeg -hide_banner -nostats -i assets/audio/<asset>.mp3 \
  -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null -
node --check app.js
node --check sw.js
python3 -m py_compile scripts/generate_game_audio.py
python3 -m json.tool assets/media-manifest.json
```

Results: the loudness/true-peak observations are recorded above; both JavaScript syntax checks, Python compilation, and manifest JSON parsing exited 0. The targeted path/role/hash/byte/bitrate integration assertions passed for all three assets.
