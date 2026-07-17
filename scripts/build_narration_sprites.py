#!/usr/bin/env python3
"""Build deterministic 4x4 narrator atlases from the existing GTI boss portraits.

This is a local ImageMagick derivative pipeline. It never calls GTI or any remote
provider, and it preserves the three source portraits unchanged.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TILE_SIZE = 256
GRID_SIZE = 4
ATLAS_SIZE = TILE_SIZE * GRID_SIZE
SOURCES = {
    "boss-cinder-warden-atlas.png": "assets/images/ui/boss-cinder-warden.png",
    "boss-veil-tactician-atlas.png": "assets/images/ui/boss-veil-tactician.png",
    "boss-gate-sovereign-atlas.png": "assets/images/ui/boss-gate-sovereign.png",
}
# Row-major frames 0-15. Small, ordered camera/light changes keep the concept-art
# portrait recognizable while giving CSS sixteen unique idle-loop tiles at 16 fps.
FRAMES = (
    (-2.0, -4, 2, 98, 106), (-1.5, -2, 1, 100, 104), (-1.0, 0, 0, 102, 102), (-0.5, 2, -1, 104, 100),
    (0.0, 4, -2, 105, 98), (0.5, 3, -1, 106, 96), (1.0, 2, 0, 105, 97), (1.5, 0, 1, 103, 99),
    (2.0, -2, 2, 101, 102), (1.5, -4, 2, 99, 105), (1.0, -3, 1, 98, 107), (0.5, -1, 0, 97, 108),
    (0.0, 1, -1, 98, 108), (-0.5, 3, -2, 100, 106), (-1.0, 2, -1, 101, 104), (-1.5, 0, 0, 100, 103),
)


def run(*command: str) -> None:
    subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def ensure_magick() -> str:
    magick = shutil.which("magick")
    if not magick:
        raise SystemExit("ImageMagick 7 ('magick') is required to build narrator sprite atlases.")
    return magick


def build_atlas(magick: str, source: Path, output: Path) -> None:
    if not source.is_file():
        raise SystemExit(f"Missing source portrait: {source}")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="abyssal-surge-atlas-") as temp_dir:
        temp = Path(temp_dir)
        tiles: list[Path] = []
        for frame, (angle, offset_x, offset_y, brightness, saturation) in enumerate(FRAMES):
            tile = temp / f"tile-{frame:02d}.png"
            run(
                magick, str(source),
                "-resize", "264x264^",
                "-gravity", "center", "-extent", "264x264",
                "-modulate", f"{brightness},{saturation},100",
                "-background", "#111827", "-rotate", str(angle),
                "-gravity", "center", "-crop", f"{TILE_SIZE}x{TILE_SIZE}{offset_x:+d}{offset_y:+d}", "+repage",
                "-strip", str(tile),
            )
            tiles.append(tile)
        rows: list[Path] = []
        for row in range(GRID_SIZE):
            row_file = temp / f"row-{row}.png"
            run(magick, *(str(tile) for tile in tiles[row * GRID_SIZE:(row + 1) * GRID_SIZE]), "+append", str(row_file))
            rows.append(row_file)
        run(magick, *(str(row) for row in rows), "-append", "-strip", str(output))
    result = subprocess.run([magick, "identify", "-format", "%w %h", str(output)], check=True, text=True, capture_output=True).stdout
    if result.strip() != f"{ATLAS_SIZE} {ATLAS_SIZE}":
        raise SystemExit(f"Unexpected atlas dimensions for {output}: {result.strip()}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "assets/images/ui/narration-atlases")
    args = parser.parse_args()
    magick = ensure_magick()
    for filename, source_name in SOURCES.items():
        output = args.output_dir / filename
        build_atlas(magick, ROOT / source_name, output)
        print(f"{output.relative_to(ROOT)}: {GRID_SIZE}x{GRID_SIZE} tiles, {TILE_SIZE}px each, 16 fps")


if __name__ == "__main__":
    main()
