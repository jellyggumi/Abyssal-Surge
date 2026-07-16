#!/usr/bin/env python3
"""Replace fake checkerboard / green-screen backgrounds with a solid dark color.

The image generator baked a literal transparency-checkerboard (alt. ~232/252 gray)
or a green screen into the icons instead of a real alpha channel. Per spec fallback,
composite everything onto one consistent dark abyssal background (#0E1218).

Method: classify border-reachable "background-like" pixels (light neutral gray OR
green-screen green) via BFS flood fill from all border pixels, then paint the mask
with the dark solid. Non-background pixels adjacent to the mask are blended 45%
toward the dark color to suppress checkerboard halos on soft edges.
"""
import glob
import os
import sys
from collections import deque

from PIL import Image

DARK = (14, 18, 24)  # #0E1218 abyssal near-black
OUT = "assets/images/ui"


def is_bg(px):
    r, g, b = px[0], px[1], px[2]
    # light neutral gray (checkerboard tiles, incl. dither noise)
    if min(r, g, b) >= 180 and max(r, g, b) - min(r, g, b) <= 34:
        return True
    # green screen
    if g >= 165 and r <= 135 and b <= 135:
        return True
    return False


def fix(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    mask = bytearray(w * h)  # 1 = background
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg(px[x, y]) and not mask[y * w + x]:
                mask[y * w + x] = 1
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(px[x, y]) and not mask[y * w + x]:
                mask[y * w + x] = 1
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not mask[ny * w + nx] and is_bg(px[nx, ny]):
                mask[ny * w + nx] = 1
                q.append((nx, ny))

    n_bg = sum(mask)
    # paint background
    for y in range(h):
        base = y * w
        for x in range(w):
            if mask[base + x]:
                px[x, y] = DARK
    # feather: blend edge-adjacent artwork pixels 45% toward dark
    edge = []
    for y in range(h):
        base = y * w
        for x in range(w):
            if mask[base + x]:
                continue
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h and mask[ny * w + nx]:
                    edge.append((x, y))
                    break
    for x, y in edge:
        r, g, b = px[x, y]
        px[x, y] = (
            int(r * 0.55 + DARK[0] * 0.45),
            int(g * 0.55 + DARK[1] * 0.45),
            int(b * 0.55 + DARK[2] * 0.45),
        )

    q_im = im.quantize(colors=256, method=Image.Quantize.MEDIANCUT,
                       dither=Image.Dither.FLOYDSTEINBERG)
    q_im.save(path, optimize=True)
    return n_bg, w * h, os.path.getsize(path)


def main():
    total = 0
    over = []
    for f in sorted(glob.glob(f"{OUT}/*.png")):
        n_bg, n_px, size = fix(f)
        total += size
        if size > 300 * 1024:
            over.append(os.path.basename(f))
        print(f"{os.path.basename(f):28s} bg={100 * n_bg // n_px}% {size // 1024}KB")
    print(f"TOTAL {total / 1024 / 1024:.2f}MB")
    print(f"OVER300KB {over if over else 'none'}")
    return 1 if over else 0


if __name__ == "__main__":
    sys.exit(main())
