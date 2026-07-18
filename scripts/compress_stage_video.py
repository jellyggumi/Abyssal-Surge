#!/usr/bin/env python3
"""Validate or opt-in recompress an Abyssal Surge stage MP4 with FFmpeg.

The compressor never overwrites its input or an existing output. It keeps an output
only when it remains web-decodable, has faststart, meets the explicit SSIM threshold,
and saves the requested minimum number of bytes.

Vox/Atlas is intentionally not part of this local-only tool. Any provider-backed
video generation requires separately supplied provider credentials and output.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_CRF = 18
DEFAULT_PRESET = "slow"
DEFAULT_MIN_SSIM = 0.9950
WIDTH = 960
HEIGHT = 540
FPS = 24
DEFAULT_MIN_SAVINGS_PERCENT = 1.0
VALID_PRESETS = (
    "ultrafast",
    "superfast",
    "veryfast",
    "faster",
    "fast",
    "medium",
    "slow",
    "slower",
    "veryslow",
)


class VideoToolError(RuntimeError):
    """An FFmpeg operation or web-video gate failed."""


def run_checked(command: list[str], label: str) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(command, check=False, capture_output=True, text=True)
    except FileNotFoundError as error:
        raise VideoToolError(f"Required executable not found: {command[0]}") from error
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip().splitlines()
        summary = detail[-1] if detail else "no diagnostic output"
        raise VideoToolError(f"{label} failed: {summary}")
    return result


def has_faststart(path: Path) -> bool:
    """Return whether the top-level moov atom precedes media data in an MP4."""
    try:
        file_size = path.stat().st_size
        positions: dict[bytes, int] = {}
        with path.open("rb") as handle:
            offset = 0
            while offset + 8 <= file_size:
                handle.seek(offset)
                atom_size = int.from_bytes(handle.read(4), "big")
                atom_type = handle.read(4)
                header_size = 8
                if atom_size == 1:
                    extended_size = handle.read(8)
                    if len(extended_size) != 8:
                        raise VideoToolError("MP4 atom has an incomplete extended size")
                    atom_size = int.from_bytes(extended_size, "big")
                    header_size = 16
                elif atom_size == 0:
                    atom_size = file_size - offset
                if atom_size < header_size or offset + atom_size > file_size:
                    raise VideoToolError("MP4 atom has an invalid size")
                positions.setdefault(atom_type, offset)
                offset += atom_size
    except OSError as error:
        raise VideoToolError(f"Could not inspect MP4 atom layout: {error.strerror or error}") from error
    return b"moov" in positions and b"mdat" in positions and positions[b"moov"] < positions[b"mdat"]


def ensure_file(path: Path) -> None:
    if path.suffix.lower() != ".mp4":
        raise VideoToolError("Input must be an .mp4 file")
    try:
        if not path.is_file() or path.stat().st_size <= 0:
            raise VideoToolError("Input must be a non-empty regular file")
    except OSError as error:
        raise VideoToolError(f"Could not inspect input: {error.strerror or error}") from error


def probe_video(path: Path, *, decode: bool = True, require_contract: bool = True) -> dict[str, object]:
    ensure_file(path)
    result = run_checked(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=index,codec_type,codec_name,profile,pix_fmt,width,height,avg_frame_rate,r_frame_rate:format=format_name,duration,size",
            "-of",
            "json",
            str(path),
        ],
        "ffprobe validation",
    )
    try:
        data = json.loads(result.stdout)
        streams = data["streams"]
        stream = next(item for item in streams if item.get("codec_type") == "video")
        format_info = data["format"]
        duration = float(format_info["duration"])
        bytes_count = int(format_info["size"])
        width = int(stream["width"])
        height = int(stream["height"])
    except (KeyError, StopIteration, TypeError, ValueError, json.JSONDecodeError) as error:
        raise VideoToolError("ffprobe did not return a usable video stream") from error

    mismatches: list[str] = []
    if "mp4" not in str(format_info.get("format_name", "")).split(","):
        mismatches.append(f"format_name={format_info.get('format_name')!r} (expected MP4 container)")
    if stream.get("codec_name") != "h264":
        mismatches.append(f"codec={stream.get('codec_name')!r} (expected H.264)")
    if stream.get("pix_fmt") != "yuv420p":
        mismatches.append(f"pixel_format={stream.get('pix_fmt')!r} (expected yuv420p)")
    if width <= 0 or height <= 0 or width % 2 or height % 2:
        mismatches.append(f"dimensions={width}x{height} (expected positive even dimensions)")
    frame_rate = stream.get("avg_frame_rate") or stream.get("r_frame_rate")
    if require_contract and (width, height) != (WIDTH, HEIGHT):
        mismatches.append(f"dimensions={width}x{height} (expected {WIDTH}x{HEIGHT})")
    if require_contract and frame_rate != f"{FPS}/1":
        mismatches.append(f"frame_rate={frame_rate!r} (expected '{FPS}/1')")
    if bytes_count <= 0 or duration <= 0:
        mismatches.append("encoded video has no bytes or duration")
    if not has_faststart(path):
        mismatches.append("moov atom does not precede mdat (faststart required)")
    if decode:
        run_checked(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-xerror", "-i", str(path), "-map", "0:v:0", "-f", "null", "-"],
            "FFmpeg decode validation",
        )
    if mismatches:
        raise VideoToolError("Web-video validation failed: " + "; ".join(mismatches))

    frame_rate = stream.get("avg_frame_rate") or stream.get("r_frame_rate")
    return {
        "path": str(path),
        "bytes": bytes_count,
        "duration_seconds": duration,
        "codec": stream["codec_name"],
        "profile": stream.get("profile"),
        "width": width,
        "height": height,
        "pixel_format": stream["pix_fmt"],
        "fps": frame_rate,
        "faststart": True,
        "decode_validated": decode,
    }


def compute_ssim(source: Path, output: Path) -> float:
    result = run_checked(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "info",
            "-i",
            str(source),
            "-i",
            str(output),
            "-filter_complex",
            (
                f"[0:v:0]fps={FPS},scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,"
                f"pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,"
                "format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[source];"
                "[1:v:0]settb=AVTB,setpts=PTS-STARTPTS[encoded];"
                "[source][encoded]ssim=shortest=1[ssim]"
            ),
            "-map",
            "[ssim]",
            "-f",
            "null",
            "-",
        ],
        "SSIM quality comparison",
    )
    match = re.search(r"All:([0-9.]+)", result.stderr)
    if match is None:
        raise VideoToolError("FFmpeg did not report an SSIM score")
    return float(match.group(1))


def validate(args: argparse.Namespace) -> None:
    report = probe_video(Path(args.input), decode=not args.skip_decode_check)
    print(json.dumps({"mode": "validate", **report}, sort_keys=True))


def compress(args: argparse.Namespace) -> None:
    source = Path(args.input)
    output = Path(args.output)
    ensure_file(source)
    if output.suffix.lower() != ".mp4":
        raise VideoToolError("Output must use an explicit .mp4 filename")
    try:
        if source.resolve() == output.resolve():
            raise VideoToolError("Refusing to overwrite input; choose a separate opt-in output path")
    except OSError as error:
        raise VideoToolError(f"Could not resolve output path: {error.strerror or error}") from error
    if output.exists():
        raise VideoToolError("Refusing to overwrite an existing output")

    source_report = probe_video(source, require_contract=False)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(prefix=f".{output.stem}.", suffix=".partial.mp4", dir=output.parent, delete=False) as temporary:
            temporary_path = Path(temporary.name)
        run_checked(
            [
                "ffmpeg",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                str(source),
                "-map",
                "0:v:0",
                "-map",
                "0:a?",
                "-vf",
                (
                    f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,"
                    f"pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,"
                    f"fps={FPS},format=yuv420p"
                ),
                "-c:v",
                "libx264",
                "-preset",
                args.preset,
                "-crf",
                str(args.crf),
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                args.audio_bitrate,
                "-movflags",
                "+faststart",
                str(temporary_path),
            ],
            "FFmpeg compression",
        )
        output_report = probe_video(temporary_path)
        duration_delta = abs(float(source_report["duration_seconds"]) - float(output_report["duration_seconds"]))
        if duration_delta > 0.05:
            raise VideoToolError(f"Compression changed duration by {duration_delta:.3f}s (maximum 0.050s)")
        ssim = compute_ssim(source, temporary_path)
        input_bytes = int(source_report["bytes"])
        output_bytes = int(output_report["bytes"])
        savings_bytes = input_bytes - output_bytes
        savings_percent = (savings_bytes / input_bytes) * 100
        if ssim < args.min_ssim:
            raise VideoToolError(f"SSIM {ssim:.6f} is below required {args.min_ssim:.6f}")
        if savings_percent < args.min_savings_percent:
            raise VideoToolError(
                f"Size savings {savings_percent:.3f}% is below required {args.min_savings_percent:.3f}%"
            )
        os.replace(temporary_path, output)
        report = {
            "mode": "compress",
            "input": source_report,
            "output": {**output_report, "path": str(output)},
            "quality": {
                "crf": args.crf,
                "preset": args.preset,
                "audio_bitrate": args.audio_bitrate,
                "ssim_all": ssim,
                "minimum_ssim": args.min_ssim,
            },
            "savings": {
                "bytes": savings_bytes,
                "percent": savings_percent,
                "minimum_percent": args.min_savings_percent,
            },
        }
        print(json.dumps(report, sort_keys=True))
        temporary_path = None
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Locally validate or opt-in conform/recompress stage MP4s to H.264/yuv420p, "
            "960x540 at 24 fps, with SSIM and faststart gates."
        )
    )
    subcommands = parser.add_subparsers(dest="command", required=True)

    validate_command = subcommands.add_parser("validate", help="Validate MP4 web compatibility and FFmpeg decode")
    validate_command.add_argument("--input", required=True, help="Stage MP4 to validate")
    validate_command.add_argument("--skip-decode-check", action="store_true", help="Skip the full FFmpeg decode check")
    validate_command.set_defaults(handler=validate)

    compress_command = subcommands.add_parser("compress", help="Write a separate output only when quality and size gates pass")
    compress_command.add_argument("--input", required=True, help="Existing stage MP4 to recompress")
    compress_command.add_argument("--output", required=True, help="New opt-in .mp4 destination; must not exist")
    compress_command.add_argument("--crf", type=int, default=DEFAULT_CRF, help="Explicit libx264 CRF quality setting (default: 18)")
    compress_command.add_argument("--preset", choices=VALID_PRESETS, default=DEFAULT_PRESET, help="libx264 speed/compression preset (default: slow)")
    compress_command.add_argument("--audio-bitrate", default="192k", help="AAC bitrate for an optional audio stream (default: 192k)")
    compress_command.add_argument("--min-ssim", type=float, default=DEFAULT_MIN_SSIM, help="Minimum All-channel SSIM (default: 0.9950)")
    compress_command.add_argument("--min-savings-percent", type=float, default=DEFAULT_MIN_SAVINGS_PERCENT, help="Required byte reduction (default: 1.0)")
    compress_command.set_defaults(handler=compress)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if getattr(args, "crf", DEFAULT_CRF) < 0 or getattr(args, "crf", DEFAULT_CRF) > 51:
        parser.error("--crf must be between 0 and 51")
    if getattr(args, "min_ssim", DEFAULT_MIN_SSIM) <= 0 or getattr(args, "min_ssim", DEFAULT_MIN_SSIM) > 1:
        parser.error("--min-ssim must be greater than 0 and at most 1")
    if getattr(args, "min_savings_percent", DEFAULT_MIN_SAVINGS_PERCENT) < 0:
        parser.error("--min-savings-percent must be non-negative")
    try:
        args.handler(args)
    except VideoToolError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
