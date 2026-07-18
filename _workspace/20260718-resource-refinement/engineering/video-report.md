# Video refinement report

## Release decision

- Runtime representative: `assets/video/abyssal-surge-cinematic.mp4` only.
- The `scene_00_to_07_cinematic_v10x.mp4` packages remain experiments and were not promoted, referenced by `app.js`, or added as the representative cache path.
- Final profile: H.264 High, 960×540, 24/1 fps, yuv420p, 19.02 s, AAC-LC stereo 22.05 kHz, MP4 faststart.
- Final size: 2,252,481 bytes, below the 8 MiB cinematic budget.

## Refinement and provenance

The previous representative was already H.264/yuv420p/960×540/faststart but was 30/1 fps. It had SHA-256 `579390bdedf030b08b4d9e5a6d28aa84cfdb7439327425ec47d3d0a2c4701b51` and size 2,363,629 bytes.

It was conformed locally with FFmpeg 7.1.1/libx264 through `scripts/compress_stage_video.py` using:

```text
scale=960:540:force_original_aspect_ratio=decrease,
pad=960:540:(ow-iw)/2:(oh-ih)/2:color=black,
fps=24,format=yuv420p
```

```text
python3 scripts/compress_stage_video.py compress \
  --input assets/video/abyssal-surge-cinematic.mp4 \
  --output /tmp/abyssal-surge-cinematic-24fps.mp4 \
  --crf 21 --preset slow --min-ssim 0.99 --min-savings-percent 0
```

Encoding settings were CRF 21, preset slow, AAC 192k, and `-movflags +faststart`. The output retained the 19.02 s montage and measured SSIM All=0.992958 against the source conformed to the same 24 fps timebase. It saved 111,148 bytes (4.70243%). Final SHA-256: `b84ccfa905e2be365f6def1df3a5f4553e6d74468c413c1a7c8edbab9ed8b95a`.

`assets/video/abyssal-surge-cinematic.ko.vtt` was replaced with three non-overlapping cues matching the actual representative montage rather than the unrelated 3:09 eight-scene experiment. Its last cue ends at 19.020 s. Final SHA-256: `24bb88b029f1bea837f437f2f2567ed2701babcc476746d4042bb482dfcc09af`.

`assets/media-manifest.json` records the exact source hash, recipe, quality score, bytes, and final hashes for the MP4 and VTT. `scripts/compress_stage_video.py` now rejects any validation target that is not exactly 960×540/24 fps and conforms recompression outputs to that contract. The existing independent validator in `scripts/render_stage_video.py` also accepted the final representative without modification.

## Runtime integration

- `index.html` declares `assets/images/cinder-span.png` as the poster, keeps the Korean caption track, includes an explicit MP4 fallback link, and carries a three-beat visual transcript aligned to 00:00–00:19.02.
- `app.js` reports loading, ready, playing, paused, ended, and unavailable states. It recovers from a media error on a subsequent play request and keeps the transcript available when video loading fails.
- `sw.js` cache version is `abyssal-surge-static-v38`; both the representative MP4 and VTT remain optional cached media.
- The cinematic stays optional, muted on programmatic start, `playsinline`, and controllable with native video controls. Presentation changes do not write campaign state or change game outcomes.

## Local verification

Only targeted video/runtime checks were run; no project-wide test suite was run.

1. `python3 -m py_compile scripts/render_stage_video.py scripts/compress_stage_video.py`
   - PASS: no syntax errors.
2. `python3 scripts/compress_stage_video.py validate --input assets/video/abyssal-surge-cinematic.mp4`
   - PASS: H.264 High, 960×540, yuv420p, 24/1 fps, 19.02 s, 2,252,481 bytes, faststart, full decode validated.
3. `python3 scripts/render_stage_video.py validate --input assets/video/abyssal-surge-cinematic.mp4`
   - PASS: H.264, 960×540, yuv420p, 24/1 fps, faststart.
4. `ffmpeg -hide_banner -loglevel error -xerror -i assets/video/abyssal-surge-cinematic.mp4 -map 0:v:0 -map 0:a:0 -f null -`
   - PASS: complete video and audio decode, no output or errors.
5. WebVTT timeline check
   - PASS: 3 cues, monotonic and non-overlapping, first start 0.0 s, final end 19.02 s, all within the video duration.
6. `node --check app.js` and `node --check sw.js`
   - PASS: no JavaScript syntax errors.
7. Browser runtime at `http://localhost:4178/` in Chromium
   - Initial play PASS: visible, playing, muted, 19.02 s, intrinsic 960×540; poster and MP4 path resolved; VTT `readyState=2`.
   - Pause PASS: paused status announced and external play button re-enabled.
   - End PASS: ended status announced at 19.02 s and replay enabled.
   - Forced missing-source error PASS: video hidden, source cleared, unavailable status announced, transcript toggle and MP4 fallback link remained available.
   - Recovery PASS: next play request loaded and played the canonical MP4; caption track returned to `readyState=2`.
   - Cache PASS: one service-worker registration; `abyssal-surge-static-v38` contains the MP4 as `video/mp4` and VTT as `text/vtt; charset=utf-8`.
8. Manifest record check
   - PASS: on-disk byte counts and SHA-256 values exactly match both canonical MP4 and VTT records.
