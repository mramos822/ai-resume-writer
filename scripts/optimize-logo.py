"""Shrinks a logo PNG to about 200 KB without visible loss: scales it to 1000 px wide at most and keeps the most colors that fit.

Usage: python scripts/optimize-logo.py <source.png> <output.png> [max_kb=200]
"""
import os
import sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
limit = int(sys.argv[3]) * 1024 if len(sys.argv) > 3 else 200 * 1024

im = Image.open(src).convert("RGBA")
for width in (1000, 900, 800, 700, 600, 500):
    w = min(width, im.width)
    h = round(im.height * w / im.width)
    small = im.resize((w, h), Image.LANCZOS)
    for colors in (256, 192, 128):
        small.quantize(colors=colors, method=Image.FASTOCTREE, dither=Image.NONE).save(out, optimize=True)
        if os.path.getsize(out) <= limit:
            print(f"{out}: {w}x{h}, {colors} colors, {os.path.getsize(out) // 1024} KB")
            sys.exit(0)
print("could not reach the size limit; the last try is saved", out)
