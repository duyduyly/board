"""Build the transparent dog sprite strip for the pixel-dog mascot from the two motion sheets.

Dev-time asset tool only (not a product dependency). Requires: opencv-python, numpy, pillow.

Usage:
    python scripts/make-dog-sprites.py <walking_spritesheet.png> <running_spritesheet.png> [out-dir]
    walking: 16 frames, 4 columns x 4 rows, transparent background, grey floor shadow under each frame
    running: 12 frames, 4 columns x 3 rows, transparent background; the dog looks left in both
    out-dir: defaults to assets/images/dog

Output: dog-sprites.png (horizontal strip of N square frames, all facing right) and dog-idle.png.
Strip order (see WALK_COUNT / RUN_COUNT):
    0 stand/idle/turn, 1 jump (airborne gallop frame), 2..9 walk loop (8 frames), 10..15 run loop (6)
Both sheets are normalised to one dog size (stand frames match) and one ground line; every frame is
shifted so the dark torso sits in the same column, which keeps the body steady while the legs move.
All frames share one crop box. Per frame: drop the grey shadow, keep the largest component, fill
holes, feather alpha and pull edge colours inward so no halo shows on light or dark UI.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image

OUT_DEFAULT = "assets/images/dog"
FRAME_SIZE = 96
BOTTOM_MARGIN = 1
SIDE_MARGIN = 2
ALPHA_MIN = 128
GREY_SATURATION_MAX = 0.16  # shadow ~0.10; fur and paws are clearly more saturated
GREY_LUMA_MIN = 120  # dark ink outline is kept even when it is desaturated
GREY_ZONE_TOP = 0.6  # the shadow sits in the lower part of a cell; the pale tail tip up top must stay
DARK_LUMA_MAX = 70  # torso fur, used to align frames horizontally
WALK_GRID = (4, 4)  # columns, rows
RUN_GRID = (4, 3)
# Both loops keep the sheet order but take every second frame: fewer, longer-held frames read as a
# calmer, steadier gait (like the cat) than 16 or 12 near-identical poses.
WALK_FRAMES = list(range(1, 17, 2))
RUN_FRAMES = list(range(1, 13, 2))
JUMP_RUN_FRAME = 6  # fully stretched, airborne
WORK_SIZE = 720
GROUND_Y = 580
TORSO_X = 360


def cell(sheet, grid, number):
    cols, rows = grid
    row, col = divmod(number - 1, cols)
    h, w = sheet.shape[0] / rows, sheet.shape[1] / cols
    y0, y1 = int(round(row * h)), int(round((row + 1) * h))
    x0, x1 = int(round(col * w)), int(round((col + 1) * w))
    return sheet[y0:y1, x0:x1].copy()


def largest(mask):
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if count <= 1:
        return mask
    return (labels == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)


def fill_holes(mask):
    mask = mask.copy()
    count, labels = cv2.connectedComponents(1 - mask, connectivity=4)
    border = set(labels[0, :]) | set(labels[-1, :]) | set(labels[:, 0]) | set(labels[:, -1])
    for label in range(1, count):
        if label not in border:
            mask[labels == label] = 1
    return mask


def isolate_dog(rgba):
    rgb = rgba[..., :3].astype(np.float32)
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    saturation = (mx - mn) / np.maximum(mx, 1)
    luma = rgb.mean(axis=2)
    grey = (saturation < GREY_SATURATION_MAX) & (luma > GREY_LUMA_MIN)
    grey[: int(rgba.shape[0] * GREY_ZONE_TOP)] = False
    mask = ((rgba[..., 3] >= ALPHA_MIN) & ~grey).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    mask = fill_holes(largest(mask))
    alpha = cv2.GaussianBlur(cv2.erode(mask, np.ones((3, 3), np.uint8)).astype(np.float32), (0, 0), 0.8)
    known = cv2.erode(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))).astype(bool)
    color = rgba[..., :3].copy()
    for _ in range(5):
        sums = cv2.boxFilter(np.where(known[..., None], color, 0).astype(np.float32), -1, (3, 3), normalize=False)
        cnt = cv2.boxFilter(known.astype(np.float32), -1, (3, 3), normalize=False)
        fill = (cnt > 0) & ~known
        color[fill] = (sums / np.maximum(cnt, 1)[..., None])[fill].astype(np.uint8)
        known |= fill
    return np.dstack([color, (alpha * 255).astype(np.uint8)])


def premultiplied_resize(rgba, size):
    a = rgba[..., 3:4].astype(np.float32) / 255
    pm = np.dstack([rgba[..., :3].astype(np.float32) * a, a * 255])
    small = cv2.resize(pm, size, interpolation=cv2.INTER_AREA)
    sa = small[..., 3:4] / 255
    rgb = np.where(sa > 0.001, small[..., :3] / np.maximum(sa, 0.001), 0)
    return np.clip(np.dstack([rgb, small[..., 3]]), 0, 255).astype(np.uint8)


def shared_crop(frames):
    bounds = []
    for rgba in frames.values():
        ys, xs = np.where(rgba[..., 3] > 8)
        bounds.append((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    x0, y0 = min(b[0] for b in bounds), min(b[1] for b in bounds)
    x1, y1 = max(b[2] for b in bounds), max(b[3] for b in bounds)
    side = int(round(max(x1 - x0, y1 - y0) * FRAME_SIZE / (FRAME_SIZE - SIDE_MARGIN * 2)))
    top = int(round(y1 + side * BOTTOM_MARGIN / FRAME_SIZE - side))
    left = int(round((x0 + x1) / 2 - side / 2))
    return left, top, side


def crop(rgba, left, top, side):
    canvas = np.zeros((side, side, 4), np.uint8)
    sy0, sy1 = max(top, 0), min(top + side, rgba.shape[0])
    sx0, sx1 = max(left, 0), min(left + side, rgba.shape[1])
    canvas[sy0 - top : sy1 - top, sx0 - left : sx1 - left] = rgba[sy0:sy1, sx0:sx1]
    return canvas


def metrics(rgba):
    """Alpha bbox bottom/height and torso (dark fur) centroid x of one isolated frame."""
    ys, xs = np.where(rgba[..., 3] > 8)
    luma = rgba[..., :3].astype(np.float32).mean(axis=2)
    dark = (luma < DARK_LUMA_MAX) & (rgba[..., 3] > ALPHA_MIN)
    dx = np.where(dark)[1]
    return {"bottom": ys.max() + 1, "height": ys.max() + 1 - ys.min(), "torso_x": float(dx.mean())}


def place(rgba, scale, torso_x, bottom):
    """Scale about the origin, then put the torso column at TORSO_X and the stand bottom at GROUND_Y."""
    a = rgba[..., 3:4].astype(np.float32) / 255
    pm = np.dstack([rgba[..., :3].astype(np.float32) * a, a * 255])
    tx, ty = TORSO_X - scale * torso_x, GROUND_Y - scale * bottom
    matrix = np.float32([[scale, 0, tx], [0, scale, ty]])
    out = cv2.warpAffine(pm, matrix, (WORK_SIZE, WORK_SIZE), flags=cv2.INTER_LINEAR)
    sa = out[..., 3:4] / 255
    rgb = np.where(sa > 0.001, out[..., :3] / np.maximum(sa, 0.001), 0)
    return np.clip(np.dstack([rgb, out[..., 3]]), 0, 255).astype(np.uint8)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    out_dir = sys.argv[3] if len(sys.argv) > 3 else OUT_DEFAULT
    os.makedirs(out_dir, exist_ok=True)
    walk = np.array(Image.open(sys.argv[1]).convert("RGBA"))
    run = np.array(Image.open(sys.argv[2]).convert("RGBA"))
    walk_iso = {n: isolate_dog(cell(walk, WALK_GRID, n)) for n in [1] + WALK_FRAMES}
    run_numbers = sorted(set(RUN_FRAMES + [1, JUMP_RUN_FRAME]))
    run_iso = {n: isolate_dog(cell(run, RUN_GRID, n)) for n in run_numbers}
    walk_stand, run_stand = metrics(walk_iso[1]), metrics(run_iso[1])
    run_scale = walk_stand["height"] / run_stand["height"]  # same stand height in both sheets

    def put(iso, number, scale, stand):
        return place(iso[number], scale, metrics(iso[number])["torso_x"], stand["bottom"])

    placed = [put(walk_iso, 1, 1.0, walk_stand), put(run_iso, JUMP_RUN_FRAME, run_scale, run_stand)]
    placed += [put(walk_iso, n, 1.0, walk_stand) for n in WALK_FRAMES]
    placed += [put(run_iso, n, run_scale, run_stand) for n in RUN_FRAMES]
    left, top, side = shared_crop(dict(enumerate(placed)))
    out = [
        premultiplied_resize(np.ascontiguousarray(crop(f, left, top, side)[:, ::-1]), (FRAME_SIZE, FRAME_SIZE))
        for f in placed  # the source dog looks left, so mirror
    ]
    strip = np.concatenate(out, axis=1)
    Image.fromarray(strip, "RGBA").save(os.path.join(out_dir, "dog-sprites.png"))
    Image.fromarray(out[0], "RGBA").save(os.path.join(out_dir, "dog-idle.png"))
    print(f"strip {strip.shape[1]}x{strip.shape[0]}, {len(out)} frames of {FRAME_SIZE}, run scale {run_scale:.3f}, crop side {side} at ({left},{top})")


if __name__ == "__main__":
    main()
