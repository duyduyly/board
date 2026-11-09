// Usage: node scripts/make-cat-sprites.mjs <source-image> [out-dir]
// Turns an AI-generated pixel-cat sheet (soft gray background, soft shadows, not grid-aligned)
// into a transparent sprite strip. Chromium (Playwright) only decodes/encodes PNG; all pixel work is plain JS.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DEFAULT = 'assets/images/cat';
const SATURATION_MIN = 40; // orange fur, cream and outline highlights are far from the gray background
const DARK_MAX = 120; // dark outline, eyes, whiskers
const SPECK_MIN_PIXELS = 60;
const MERGE_RADIUS = 4; // joins whiskers/tail tips to the body when grouping components
const COVERAGE_MIN = 0.4;
// Search window for the art pixel size: below 1.8 is JPEG-noise territory, above 3.2 matches pose spacing, not pixels.
const ART_PIXEL_RANGE = [1.8, 3.2];
const FRAME_SIZE = 48; // art pixels; shows 1:1 at 48 CSS px and 2:1 at 96
const FRAME_MARGIN = 1; // transparent art pixels kept below the feet and around the pose
const ROLES = ['idle', 'walk-a', 'walk-b', 'walk-c', 'turn', 'run', 'jump'];

// Source poses are numbered in reading order (top row, middle, bottom row).
// `flip` mirrors poses whose head looks left in the source so every frame faces right.
const POSE_PLAN = [
  { role: 'idle', source: 0, flip: false },
  { role: 'walk-a', source: 1, flip: true },
  { role: 'walk-b', source: 2, flip: true },
  { role: 'walk-c', source: 5, flip: true },
  { role: 'turn', source: 3, flip: false },
  { role: 'run', source: 4, flip: false },
  { role: 'jump', source: 4, flip: false },
];

const sourcePath = process.argv[2];
const outDir = path.resolve(process.argv[3] ?? OUT_DEFAULT);
if (!sourcePath) {
  console.error('Usage: node scripts/make-cat-sprites.mjs <source-image> [out-dir]');
  process.exit(1);
}

const luminance = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

async function withPage(run) {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    return await run(await browser.newPage());
  } finally {
    await browser.close();
  }
}

async function decodeImage(page, file) {
  const dataUrl = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  const decoded = await page.evaluate(async (url) => {
    const image = new window.Image();
    image.src = url;
    await image.decode();
    const canvas = new window.OffscreenCanvas(image.naturalWidth, image.naturalHeight);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { width, height } = canvas;
    return { width, height, data: Array.from(context.getImageData(0, 0, width, height).data) };
  }, dataUrl);
  return {
    width: decoded.width,
    height: decoded.height,
    data: Uint8ClampedArray.from(decoded.data),
  };
}

async function encodePng(page, { width, height, data }) {
  const dataUrl = await page.evaluate(
    ({ w, h, pixels }) => {
      const canvas = new window.OffscreenCanvas(w, h);
      const context = canvas.getContext('2d');
      context.putImageData(new window.ImageData(Uint8ClampedArray.from(pixels), w, h), 0, 0);
      return canvas.convertToBlob({ type: 'image/png' }).then(
        (blob) =>
          new Promise((resolve) => {
            const reader = new window.FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          }),
      );
    },
    { w: width, h: height, pixels: Array.from(data) },
  );
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

/** Foreground = everything not reachable from the border through non-ink pixels (drops soft shadows and halos). */
function extractForeground({ width, height, data }) {
  const isInk = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const [r, g, b] = [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
    const saturation = Math.max(r, g, b) - Math.min(r, g, b);
    isInk[i] = saturation >= SATURATION_MIN || luminance(r, g, b) < DARK_MAX ? 1 : 0;
  }
  const outside = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    const i = y * width + x;
    if (!isInk[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) push(x - 1, y);
    if (x < width - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < height - 1) push(x, y + 1);
  }
  return outside.map((flag) => 1 - flag);
}

/** Labels connected pieces after a small dilation so whiskers and tail tips stay with their cat. */
function findPoses(mask, width, height) {
  const near = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      for (let dy = -MERGE_RADIUS; dy <= MERGE_RADIUS; dy += 1) {
        for (let dx = -MERGE_RADIUS; dx <= MERGE_RADIUS; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) near[ny * width + nx] = 1;
        }
      }
    }
  }
  const label = new Int32Array(width * height).fill(-1);
  const poses = [];
  for (let start = 0; start < width * height; start += 1) {
    if (!near[start] || label[start] !== -1) continue;
    const id = poses.length;
    const pixels = [];
    const stack = [start];
    label[start] = id;
    while (stack.length) {
      const i = stack.pop();
      if (mask[i]) pixels.push(i);
      const x = i % width;
      const y = (i - x) / width;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const ni = ny * width + nx;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && near[ni] && label[ni] === -1) {
          label[ni] = id;
          stack.push(ni);
        }
      }
    }
    if (pixels.length >= SPECK_MIN_PIXELS) poses.push(describePose(pixels, width));
  }
  return sortReadingOrder(poses);
}

function describePose(pixels, width) {
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const i of pixels) {
    const x = i % width;
    const y = (i - x) / width;
    [left, right] = [Math.min(left, x), Math.max(right, x + 1)];
    [top, bottom] = [Math.min(top, y), Math.max(bottom, y + 1)];
  }
  // Body anchor = mean x of the lower half of the pose (legs/belly); tails and heads do not pull it.
  const lowerStart = top + (bottom - top) / 2;
  let sum = 0;
  let count = 0;
  for (const i of pixels) {
    const x = i % width;
    if ((i - x) / width >= lowerStart) {
      sum += x + 0.5;
      count += 1;
    }
  }
  return { pixels: new Set(pixels), left, top, right, bottom, anchorX: sum / count };
}

function sortReadingOrder(poses) {
  const rowOf = (pose) => Math.round((pose.top + pose.bottom) / 2 / 80);
  return [...poses].sort((a, b) => rowOf(a) - rowOf(b) || a.left - b.left);
}

/** Estimates the source size of one art pixel from the periodicity of horizontal/vertical edge energy. */
function estimateArtPixel({ width, height, data }, mask) {
  const luma = (x, y) =>
    luminance(
      data[(y * width + x) * 4],
      data[(y * width + x) * 4 + 1],
      data[(y * width + x) * 4 + 2],
    );
  const energyX = new Float64Array(width);
  const energyY = new Float64Array(height);
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      if (!mask[y * width + x]) continue;
      energyX[x] += Math.abs(luma(x + 1, y) - luma(x, y));
      energyY[y] += Math.abs(luma(x, y + 1) - luma(x, y));
    }
  }
  const strength = (energy, period) => {
    let [re, im, total] = [0, 0, 0];
    energy.forEach((value, index) => {
      const phase = (2 * Math.PI * index) / period;
      re += value * Math.cos(phase);
      im += value * Math.sin(phase);
      total += value;
    });
    return Math.hypot(re, im) / total;
  };
  let best = { period: 0, score: -1 };
  for (let period = ART_PIXEL_RANGE[0]; period <= ART_PIXEL_RANGE[1]; period += 0.02) {
    const score = strength(energyX, period) + strength(energyY, period);
    if (score > best.score) best = { period, score };
  }
  return best.period;
}

function renderFrame(source, pose, plan, size, artPixel) {
  const frame = new Uint8ClampedArray(size * size * 4);
  const { width, data } = source;
  const footY = pose.bottom;
  const centerCol = size / 2;
  const footRow = size - FRAME_MARGIN;
  for (let fy = 0; fy < size; fy += 1) {
    for (let fx = 0; fx < size; fx += 1) {
      // Cell rectangle in source space; mirrored around the body anchor when the pose faces left.
      let x0 = pose.anchorX + (fx - centerCol) * artPixel;
      let x1 = x0 + artPixel;
      if (plan.flip) [x0, x1] = [2 * pose.anchorX - x1, 2 * pose.anchorX - x0];
      const y0 = footY + (fy - footRow) * artPixel;
      const y1 = y0 + artPixel;
      let [covered, total, r, g, b] = [0, 0, 0, 0, 0];
      for (let y = Math.round(y0); y < Math.round(y1); y += 1) {
        for (let x = Math.round(x0); x < Math.round(x1); x += 1) {
          total += 1;
          const i = y * width + x;
          if (x < 0 || y < 0 || x >= width || !pose.pixels.has(i)) continue;
          covered += 1;
          [r, g, b] = [r + data[i * 4], g + data[i * 4 + 1], b + data[i * 4 + 2]];
        }
      }
      if (!total || covered / total < COVERAGE_MIN) continue;
      const o = (fy * size + fx) * 4;
      [frame[o], frame[o + 1], frame[o + 2], frame[o + 3]] = [
        r / covered,
        g / covered,
        b / covered,
        255,
      ];
    }
  }
  return frame;
}

/** Source pixels a pose needs: wide side measured from the body anchor (frames are centred on it). */
function poseExtent(pose) {
  const half = Math.max(pose.anchorX - pose.left, pose.right - pose.anchorX);
  return Math.max(2 * half, pose.bottom - pose.top);
}

const outputs = await withPage(async (page) => {
  const source = await decodeImage(page, sourcePath);
  const mask = extractForeground(source);
  const poses = findPoses(mask, source.width, source.height);
  if (poses.length !== 7) throw new Error(`Expected 7 poses, found ${poses.length}`);
  const size = FRAME_SIZE;
  const estimated = estimateArtPixel(source, mask);
  // Never resample finer than the detected grid, but grow the cell when the biggest pose would not fit.
  const fitting = Math.max(...poses.map(poseExtent)) / (size - 2 * FRAME_MARGIN);
  const artPixel = Math.max(estimated, fitting);
  console.log(
    `source ${source.width}x${source.height}, estimated art pixel ${estimated.toFixed(2)} px, used ${artPixel.toFixed(2)} px, frame ${size}`,
  );
  poses.forEach((pose, index) => {
    console.log(`pose ${index}: bbox ${pose.left},${pose.top}..${pose.right},${pose.bottom}`);
  });

  const strip = new Uint8ClampedArray(size * ROLES.length * size * 4);
  let idle = null;
  POSE_PLAN.forEach((plan, column) => {
    const frame = renderFrame(source, poses[plan.source], plan, size, artPixel);
    if (plan.role === 'idle') idle = frame;
    for (let y = 0; y < size; y += 1) {
      strip.set(
        frame.subarray(y * size * 4, (y + 1) * size * 4),
        (y * size * ROLES.length + column * size) * 4,
      );
    }
    console.log(
      `frame ${column} ${plan.role} <- source pose ${plan.source}${plan.flip ? ' (flipped)' : ''}`,
    );
  });
  return {
    sprites: await encodePng(page, { width: size * ROLES.length, height: size, data: strip }),
    idle: await encodePng(page, { width: size, height: size, data: idle }),
  };
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'cat-sprites.png'), outputs.sprites);
fs.writeFileSync(path.join(outDir, 'cat-idle.png'), outputs.idle);
console.log(`wrote ${outDir}`);
