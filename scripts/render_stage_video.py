#!/usr/bin/env python3
"""Render an Abyssal Surge stage transition MP4 from a generated PNG key-art image.

Render settings are intentionally fixed for runtime compatibility: H.264, yuv420p,
960x540, 24 fps, `-preset medium`, and `-crf 20`; faststart is enabled for web delivery.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

WIDTH = 960
HEIGHT = 540
FPS = 24
DEFAULT_DURATION = 5.0
DEFAULT_CRF = 20
DEFAULT_PRESET = "medium"
VALID_PRESETS = ("ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow")


class VideoRenderError(RuntimeError):
    """A source image, render invocation, or encoded output is invalid."""


def run_checked(command: list[str], label: str) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(command, check=False, capture_output=True, text=True)
    except FileNotFoundError as error:
        raise VideoRenderError(f"Required executable not found: {command[0]}") from error
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip().splitlines()
        summary = detail[-1] if detail else "no diagnostic output"
        raise VideoRenderError(f"{label} failed: {summary}")
    return result


def require_png(path: Path) -> None:
    if path.suffix.lower() != ".png":
        raise VideoRenderError("Key art must be a PNG file")
    try:
        size = path.stat().st_size
    except OSError as error:
        raise VideoRenderError(f"Could not inspect key art: {error.strerror or error}") from error
    if size < 8:
        raise VideoRenderError("Key art is too small to be a PNG")
    with path.open("rb") as handle:
        if handle.read(8) != b"\x89PNG\r\n\x1a\n":
            raise VideoRenderError("Key art does not contain a valid PNG signature")


def has_faststart(path: Path) -> bool:
    """Return whether the top-level moov atom precedes media data in an MP4 file."""
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
                        raise VideoRenderError("MP4 atom has an incomplete extended size")
                    atom_size = int.from_bytes(extended_size, "big")
                    header_size = 16
                elif atom_size == 0:
                    atom_size = file_size - offset
                if atom_size < header_size or offset + atom_size > file_size:
                    raise VideoRenderError("MP4 atom has an invalid size")
                positions.setdefault(atom_type, offset)
                offset += atom_size
    except OSError as error:
        raise VideoRenderError(f"Could not inspect MP4 atom layout: {error.strerror or error}") from error
    return b"moov" in positions and b"mdat" in positions and positions[b"moov"] < positions[b"mdat"]


def probe_video(path: Path) -> dict[str, object]:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name,width,height,pix_fmt,avg_frame_rate,r_frame_rate:format=format_name,duration,size",
        "-of",
        "json",
        str(path),
    ]
    result = run_checked(command, "ffprobe validation")
    try:
        probe = json.loads(result.stdout)
        stream = probe["streams"][0]
        format_info = probe["format"]
        duration = float(format_info["duration"])
        size = int(format_info["size"])
    except (KeyError, IndexError, ValueError, json.JSONDecodeError) as error:
        raise VideoRenderError("ffprobe did not return a usable video stream") from error

    mismatches: list[str] = []
    expected = {"codec_name": "h264", "width": WIDTH, "height": HEIGHT, "pix_fmt": "yuv420p"}
    for key, value in expected.items():
        if stream.get(key) != value:
            mismatches.append(f"{key}={stream.get(key)!r} (expected {value!r})")
    frame_rate = stream.get("avg_frame_rate") or stream.get("r_frame_rate")
    if frame_rate != f"{FPS}/1":
        mismatches.append(f"frame_rate={frame_rate!r} (expected '{FPS}/1')")
    if size <= 0 or duration <= 0:
        mismatches.append("encoded video has no bytes or duration")
    if "mp4" not in format_info.get("format_name", "").split(","):
        mismatches.append(f"format_name={format_info.get('format_name')!r} (expected MP4 container)")
    if not has_faststart(path):
        mismatches.append("moov atom does not precede mdat (faststart required)")
    if mismatches:
        raise VideoRenderError("Video validation failed: " + "; ".join(mismatches))
    return {
        "path": str(path),
        "bytes": size,
        "duration_seconds": duration,
        "codec": stream["codec_name"],
        "width": stream["width"],
        "height": stream["height"],
        "pixel_format": stream["pix_fmt"],
        "fps": frame_rate,
        "faststart": True,
    }


def render(args: argparse.Namespace) -> None:
    source = Path(args.input)
    output = Path(args.output)
    if output.suffix.lower() != ".mp4":
        raise VideoRenderError("Output must use an explicit .mp4 filename")
    require_png(source)
    plan = {
        "mode": "dry-run" if args.dry_run else "render",
        "input": str(source),
        "output": str(output),
        "codec": "libx264",
        "pixel_format": "yuv420p",
        "resolution": f"{WIDTH}x{HEIGHT}",
        "fps": FPS,
        "duration_seconds": args.duration,
        "crf": args.crf,
        "preset": args.preset,
        "faststart": True,
    }
    if args.dry_run:
        print(json.dumps(plan))
        return

    output.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix=f".{output.stem}.", suffix=".partial.mp4", dir=output.parent, delete=False
        ) as temporary:
            temporary_path = Path(temporary.name)
        filter_graph = (
            f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,"
            f"pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p"
        )
        command = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-loop",
            "1",
            "-framerate",
            str(FPS),
            "-i",
            str(source),
            "-t",
            str(args.duration),
            "-vf",
            filter_graph,
            "-r",
            str(FPS),
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            args.preset,
            "-crf",
            str(args.crf),
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(temporary_path),
        ]
        run_checked(command, "ffmpeg render")
        validated = probe_video(temporary_path)
        os.replace(temporary_path, output)
        validated["path"] = str(output)
        validated.update({"crf": args.crf, "preset": args.preset, "faststart": True})
        print(json.dumps(validated))
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def validate(args: argparse.Namespace) -> None:
    print(json.dumps({"mode": "validate", **probe_video(Path(args.input))}))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Render or validate an Abyssal Surge stage transition MP4. Render uses H.264 yuv420p "
            "960x540 at 24 fps, CRF 20/preset medium by default, with faststart."
        )
    )
    subcommands = parser.add_subparsers(dest="command", required=True)

    render_command = subcommands.add_parser("render", help="Render an MP4 from generated PNG key art")
    render_command.add_argument("--input", required=True, help="Generated source PNG key art")
    render_command.add_argument("--output", required=True, help="Explicit destination .mp4 filename")
    render_command.add_argument("--duration", type=float, default=DEFAULT_DURATION, help="Still-image duration in seconds")
    render_command.add_argument("--crf", type=int, default=DEFAULT_CRF, help="libx264 constant-rate factor (default: 20)")
    render_command.add_argument("--preset", choices=VALID_PRESETS, default=DEFAULT_PRESET, help="libx264 preset (default: medium)")
    render_command.add_argument("--dry-run", action="store_true", help="Validate inputs and print the ffmpeg plan without rendering")
    render_command.set_defaults(handler=render)

    validate_command = subcommands.add_parser("validate", help="Validate an MP4 with ffprobe; performs no rendering or network access")
    validate_command.add_argument("--input", required=True, help="Existing .mp4 video")
    validate_command.set_defaults(handler=validate)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if getattr(args, "duration", DEFAULT_DURATION) <= 0:
        parser.error("--duration must be positive")
    if not 0 <= getattr(args, "crf", DEFAULT_CRF) <= 51:
        parser.error("--crf must be between 0 and 51")
    try:
        args.handler(args)
    except VideoRenderError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
