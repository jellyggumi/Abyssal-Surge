#!/usr/bin/env python3
"""Quantize UI sprite PNGs to palette mode (256 colors, alpha preserved)."""
import glob
import os
import sys

from PIL import Image

OUT = "assets/images/ui"

def main():
    total = 0
    over = []
    for f in sorted(glob.glob(f"{OUT}/*.png")):
        im = Image.open(f).convert("RGBA")
        q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE,
                        dither=Image.Dither.FLOYDSTEINBERG)
        q.save(f, optimize=True)
        size = os.path.getsize(f)
        total += size
        if size > 300 * 1024:
            over.append(os.path.basename(f))
        print(f"{os.path.basename(f):28s} {size // 1024}KB")
    print(f"TOTAL {total / 1024 / 1024:.2f}MB")
    print(f"OVER300KB {over if over else 'none'}")
    return 1 if over else 0

if __name__ == "__main__":
    sys.exit(main())
