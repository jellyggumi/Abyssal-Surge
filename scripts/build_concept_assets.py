#!/usr/bin/env python3
"""Build runtime-ready non-pixel 2D assets from manifest-proven GTI concept art.

This is a deterministic derivative pipeline: it never calls an image backend. The
source portrait and tactical key art are existing GTI assets recorded in
assets/media-manifest.json. It produces a transparent unit source, a 16-frame
4x4 atlas that plays at 16 fps, and a translucent tactical UI surface.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAGICK = ""
FRAME_SIZE = 256
GRID_SIZE = 4
ATLAS_PADDING = 2
ATLAS_TILE = FRAME_SIZE + ATLAS_PADDING * 2
ATLAS_SIZE = ATLAS_TILE * GRID_SIZE
FPS = 16
UNIT_SOURCE = ROOT / "assets/images/ui/boss-cinder-warden.png"
TACTICAL_SOURCE = ROOT / "assets/images/cinder-span.png"
UNIT_OUTPUT = ROOT / "assets/images/characters/dusk-legion-source.png"
ATLAS_OUTPUT = ROOT / "assets/images/characters/dusk-legion-atlas.png"
MANIFEST_OUTPUT = ROOT / "assets/images/characters/dusk-legion-atlas.json"
TACTICAL_OUTPUT = ROOT / "assets/images/ui/concept-tactical-surface.webp"
MEDIA_MANIFEST = ROOT / "assets/media-manifest.json"

# Frame ordering is stable: every facing direction has a bright and a dim
# idle pose. Mirroring and restrained rotation create readable direction cues
# without inventing an unsupported pixel-art grid.
DIRECTIONS = (
    (False, 0.0), (False, 2.0), (False, 4.0), (True, 4.0),
    (True, 0.0), (True, -2.0), (True, -4.0), (False, -4.0),
)


def run(*command: str) -> None:
    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode:
        raise SystemExit(f"ImageMagick failed: {' '.join(command)}\n{result.stderr.strip()}")


def identify_channels(path: Path) -> str:
    return subprocess.run(
        [MAGICK, "identify", "-format", "%[channels]", str(path)],
        check=True,
        text=True,
        capture_output=True,
    ).stdout.strip().lower()

def alpha_mean(path: Path) -> float:
    return float(subprocess.run(
        [MAGICK, str(path), "-alpha", "extract", "-format", "%[fx:mean]", "info:"],
        check=True,
        text=True,
        capture_output=True,
    ).stdout)

def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def update_media_manifest() -> None:
    if not MEDIA_MANIFEST.is_file():
        raise SystemExit(f"Missing media manifest: {MEDIA_MANIFEST.relative_to(ROOT)}")
    manifest = json.loads(MEDIA_MANIFEST.read_text(encoding="utf-8"))
    assets = manifest.get("assets")
    if not isinstance(assets, list):
        raise SystemExit("Media manifest assets must be a list.")

    known_sources = {asset.get("filename") for asset in assets if isinstance(asset, dict)}
    required_sources = {
        UNIT_SOURCE.relative_to(ROOT).as_posix(),
        TACTICAL_SOURCE.relative_to(ROOT).as_posix(),
    }
    if not required_sources <= known_sources:
        raise SystemExit("Concept asset source art must be registered in assets/media-manifest.json.")

    def record(path: Path, media_type: str, source: Path, derivation: str) -> dict[str, object]:
        relative_path = path.relative_to(ROOT).as_posix()
        source_path = source.relative_to(ROOT).as_posix()
        return {
            "filename": relative_path,
            "media_type": media_type,
            "bytes": path.stat().st_size,
            "generated_by": "scripts/build_concept_assets.py (no GTI invocation)",
            "source_key_art": [source_path],
            "source_assets": [source_path],
            "derivation": derivation,
            "sha256": sha256_file(path),
        }

    generated = {
        UNIT_OUTPUT.relative_to(ROOT).as_posix(): record(
            UNIT_OUTPUT,
            "image/png",
            UNIT_SOURCE,
            "Deterministic background removal and framing from an existing manifest-proven GTI portrait; no new GTI invocation.",
        ),
        ATLAS_OUTPUT.relative_to(ROOT).as_posix(): record(
            ATLAS_OUTPUT,
            "image/png",
            UNIT_SOURCE,
            "Deterministic 4x4 atlas of sixteen ordered 256px frames at 16 fps from the existing manifest-proven GTI portrait; no new GTI invocation.",
        ),
        TACTICAL_OUTPUT.relative_to(ROOT).as_posix(): record(
            TACTICAL_OUTPUT,
            "image/webp",
            TACTICAL_SOURCE,
            "Deterministic translucent tactical UI treatment from existing manifest-proven GTI key art; no new GTI invocation.",
        ),
    }
    updated_paths = set(generated)
    manifest["assets"] = [
        generated.get(asset.get("filename"), asset) if isinstance(asset, dict) else asset
        for asset in assets
    ] + [
        generated[path] for path in sorted(updated_paths - known_sources)
    ]
    MEDIA_MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def ensure_magick() -> None:
    global MAGICK
    MAGICK = shutil.which("magick") or ""
    if not MAGICK:
        raise SystemExit("ImageMagick 7 ('magick') is required to bake conceptual assets.")


def build_unit_source(output: Path) -> None:
    if not UNIT_SOURCE.is_file():
        raise SystemExit(f"Missing GTI source portrait: {UNIT_SOURCE.relative_to(ROOT)}")
    output.parent.mkdir(parents=True, exist_ok=True)
    run(
        MAGICK, str(UNIT_SOURCE),
        "-alpha", "off",
        "-bordercolor", "#111827", "-border", "1",
        "-alpha", "set", "-fuzz", "6%", "-fill", "none",
        "-draw", "color 0,0 floodfill",
        "+repage", "-shave", "1x1", "-trim", "+repage",
        "-resize", "236x236",
        "-gravity", "south", "-background", "none", "-extent", f"{FRAME_SIZE}x{FRAME_SIZE}",
        "-strip", str(output),
    )
    if "a" not in identify_channels(output):
        raise SystemExit("Dusk Legion source must retain an alpha channel after background removal.")
    coverage = alpha_mean(output)
    if coverage < 0.02 or coverage > 0.9:
        raise SystemExit("Dusk Legion source alpha coverage is invalid after background removal.")


def build_atlas(source: Path, output: Path) -> dict[str, object]:
    output.parent.mkdir(parents=True, exist_ok=True)
    frames: dict[str, dict[str, int]] = {}
    with tempfile.TemporaryDirectory(prefix="abyssal-surge-concept-atlas-") as directory:
        temp = Path(directory)
        tiles: list[Path] = []
        for facing, (flop, angle) in enumerate(DIRECTIONS):
            for phase, brightness in enumerate((96, 106)):
                frame = facing * 2 + phase
                tile = temp / f"frame-{frame:02d}.png"
                command = [MAGICK, str(source)]
                if flop:
                    command.append("-flop")
                command.extend((
                    "-background", "none", "-rotate", str(angle),
                    "-modulate", f"{brightness},100,100",
                    "-gravity", "center", "-extent", f"{FRAME_SIZE}x{FRAME_SIZE}",
                    "-gravity", "center", "-background", "none", "-extent", f"{ATLAS_TILE}x{ATLAS_TILE}",
                    "-strip", str(tile),
                ))
                run(*command)
                tiles.append(tile)
                frames[f"f{facing}-p{phase}"] = {
                    "x": ATLAS_PADDING + (frame % GRID_SIZE) * ATLAS_TILE,
                    "y": ATLAS_PADDING + (frame // GRID_SIZE) * ATLAS_TILE,
                    "width": FRAME_SIZE,
                    "height": FRAME_SIZE,
                    "pivotX": FRAME_SIZE // 2,
                    "pivotY": 224,
                    "facing": facing,
                    "phase": phase,
                }
        rows: list[Path] = []
        for row in range(GRID_SIZE):
            row_path = temp / f"row-{row}.png"
            run(MAGICK, *(str(tile) for tile in tiles[row * GRID_SIZE:(row + 1) * GRID_SIZE]), "+append", str(row_path))
            rows.append(row_path)
        run(MAGICK, *(str(row) for row in rows), "-append", "-strip", str(output))
    dimensions = subprocess.run(
        [MAGICK, "identify", "-format", "%w %h", str(output)],
        check=True,
        text=True,
        capture_output=True,
    ).stdout.strip()
    if dimensions != f"{ATLAS_SIZE} {ATLAS_SIZE}":
        raise SystemExit(f"Unexpected atlas dimensions for {output}: {dimensions}")
    if "a" not in identify_channels(output):
        raise SystemExit("Dusk Legion atlas must preserve alpha for faction tinting.")
    return {
        "version": 1,
        "page": {"url": "assets/images/characters/dusk-legion-atlas.png", "width": ATLAS_SIZE, "height": ATLAS_SIZE},
        "fps": FPS,
        "frameWidth": FRAME_SIZE,
        "frameHeight": FRAME_SIZE,
        "gutter": ATLAS_PADDING * 2,
        "frames": frames,
    }


def build_tactical_surface(output: Path) -> None:
    if not TACTICAL_SOURCE.is_file():
        raise SystemExit(f"Missing GTI source key art: {TACTICAL_SOURCE.relative_to(ROOT)}")
    output.parent.mkdir(parents=True, exist_ok=True)
    run(
        MAGICK, str(TACTICAL_SOURCE),
        "-resize", "1672x941^", "-gravity", "center", "-crop", "1672x941+0+0", "+repage",
        "-colorspace", "gray", "-fill", "#4cd7e8", "-colorize", "28",
        "-alpha", "set", "-channel", "A", "-evaluate", "set", "32%", "+channel",
        "-strip", "-quality", "92", str(output),
    )
    dimensions = subprocess.run(
        [MAGICK, "identify", "-format", "%w %h", str(output)],
        check=True,
        text=True,
        capture_output=True,
    ).stdout.strip()
    if dimensions != "1672 941" or "a" not in identify_channels(output):
        raise SystemExit("Tactical surface must be 1672x941 with alpha.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-root", type=Path, default=ROOT, help="Repository root; useful for isolated validation builds.")
    args = parser.parse_args()
    if args.output_root.resolve() != ROOT:
        raise SystemExit("This builder writes the tracked runtime paths under its repository root.")
    ensure_magick()
    build_unit_source(UNIT_OUTPUT)
    manifest = build_atlas(UNIT_OUTPUT, ATLAS_OUTPUT)
    MANIFEST_OUTPUT.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    build_tactical_surface(TACTICAL_OUTPUT)
    update_media_manifest()
    for path in (UNIT_OUTPUT, ATLAS_OUTPUT, MANIFEST_OUTPUT, TACTICAL_OUTPUT):
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
