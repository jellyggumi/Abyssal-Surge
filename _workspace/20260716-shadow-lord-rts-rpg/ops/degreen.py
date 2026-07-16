#!/usr/bin/env python3
"""Suppress enclosed green-screen residue missed by border flood fill.

greenness = g - max(r, b). Legit teal keeps b ~ g so greenness stays low;
pure green screen scores ~120-240. Pixels blend toward DARK proportionally.
"""
import os
import sys

from PIL import Image

DARK = (14, 18, 24)
FILES = sys.argv[1:]


def degreen(path):
    im = Image.open(path).convert("RGB")
    px = im.load()
    w, h = im.size
    n = 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            greenness = g - max(r, b)
            if greenness > 16:
                t = min(1.0, greenness / 90.0)
                px[x, y] = (
                    int(r * (1 - t) + DARK[0] * t),
                    int(g * (1 - t) + DARK[1] * t),
                    int(b * (1 - t) + DARK[2] * t),
                )
                n += 1
    q = im.quantize(colors=256, method=Image.Quantize.MEDIANCUT,
                    dither=Image.Dither.FLOYDSTEINBERG)
    q.save(path, optimize=True)
    print(f"{os.path.basename(path):28s} degreened={n}px {os.path.getsize(path) // 1024}KB")


for f in FILES:
    degreen(f)
