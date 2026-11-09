"""Turn the hand-drawn logo GIF into a transparent animated WebP for the toolbar brand mark.

Dev-time asset tool only. Requires: pillow, numpy.
Usage: python scripts/make-logo-anim.py <logo.gif> [out-dir]   (out-dir defaults to assets/images/brand)

Output: logo-anim.webp (looping; the finished drawing is held for REST_MS before the loop restarts) and
logo-still.webp (the last frame). The GIF paper (near white) becomes transparent and the pencil strokes keep
their darkness as alpha, tinted with the app ink colour, so the mark works on light paper; dark theme
inverts it in CSS. All frames share one crop box so nothing jumps between frames.
"""
import os
import sys

import numpy as np
from PIL import Image

OUT_DEFAULT = "assets/images/brand"
INK = (32, 41, 37)  # --ink (#202925)
PAPER_LUMA = 252
ALPHA_GAIN = 1.25  # strokes read slightly bolder at toolbar size
OUT_WIDTH = 240
FRAME_MS = 260
REST_MS = 4000
CROP_PAD = 6


def to_alpha(frame):
    luma = np.array(frame.convert("L"), np.float32)
    alpha = np.clip((PAPER_LUMA - luma) / PAPER_LUMA * 255 * ALPHA_GAIN, 0, 255).astype(np.uint8)
    rgba = np.zeros((*alpha.shape, 4), np.uint8)
    rgba[..., :3] = INK
    rgba[..., 3] = alpha
    return rgba


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    out_dir = sys.argv[2] if len(sys.argv) > 2 else OUT_DEFAULT
    os.makedirs(out_dir, exist_ok=True)
    gif = Image.open(sys.argv[1])
    frames = []
    for index in range(gif.n_frames):
        gif.seek(index)
        frames.append(to_alpha(gif.convert("RGB")))
    ys, xs = zip(*[np.where(f[..., 3] > 12) for f in frames])
    y0, y1 = min(a.min() for a in ys), max(a.max() for a in ys) + 1
    x0, x1 = min(a.min() for a in xs), max(a.max() for a in xs) + 1
    box = (max(x0 - CROP_PAD, 0), max(y0 - CROP_PAD, 0), min(x1 + CROP_PAD, frames[0].shape[1]), min(y1 + CROP_PAD, frames[0].shape[0]))
    width = OUT_WIDTH
    height = round((box[3] - box[1]) * width / (box[2] - box[0]))
    images = [Image.fromarray(f, "RGBA").crop(box).resize((width, height), Image.LANCZOS) for f in frames]
    durations = [FRAME_MS] * (len(images) - 1) + [REST_MS]
    images[0].save(os.path.join(out_dir, "logo-anim.webp"), save_all=True, append_images=images[1:], duration=durations, loop=0, lossless=True, method=6)
    images[-1].save(os.path.join(out_dir, "logo-still.webp"), lossless=True, method=6)
    print(f"{len(images)} frames, {width}x{height}")


if __name__ == "__main__":
    main()
