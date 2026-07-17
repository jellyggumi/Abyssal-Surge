# Stage Video Compression Decision

## Local-only tooling

`scripts/compress_stage_video.py` is the opt-in FFmpeg path for existing stage MP4s. It validates MP4/H.264/yuv420p compatibility, positive even dimensions, duration and byte count, a full FFmpeg decode, and `moov` before `mdat` (`faststart`). Compression uses explicit `libx264` CRF and preset settings rather than a target bitrate, requires the output to be a separate new path, and keeps it only after the web gate, matching dimensions/duration, an SSIM comparison, and measurable byte reduction pass.

It does not call Vox or Atlas. Provider-backed generation remains conditional on separately supplied provider credentials and a credential-backed result.

## 2026-07-16 measured candidate

Command:

```sh
python3 scripts/compress_stage_video.py compress \
  --input assets/video/cinder-span.mp4 \
  --output /tmp/abyssal-surge-cinder-span-crf24-slow.mp4 \
  --crf 24
```

Result retained only at that opt-in, non-production path:

| Metric | Shipped source | Candidate |
| --- | ---: | ---: |
| Bytes | 134,439 | 131,886 |
| Difference | — | -2,553 bytes (-1.899%) |
| Duration | 5.0 s | 5.0 s |
| Codec / pixel format | H.264 / yuv420p | H.264 / yuv420p |
| Dimensions | 960x540 | 960x540 |
| Faststart / decode | yes / passed | yes / passed |
| SSIM (all channels) | — | 0.997974 (minimum 0.995000) |

The shipped asset was not overwritten or linked into the release. The candidate is an explicit review/copy decision because the measured reduction is small; production replacement is not justified automatically.
