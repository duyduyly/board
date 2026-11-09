import { test, expect } from '@playwright/test';

// Mèo pixel trang trí. Cổng tự động hóa: navigator.webdriver = true nên chỉ bật khi URL có ?cat=1.
// Chỉ đọc trạng thái qua evaluate. Hành vi tất định nhờ init script chạy TRƯỚC khi app khởi động:
// Math.random trả hằng số CHỈ cho call stack đi qua pixel-cat.js (phần còn lại của app giữ nguyên
// Math.random thật để id không va chạm). Giá trị hằng quyết định hành động (xem ACTION_WEIGHTS):
//   0.4 -> luôn "walk" không quay đầu; 0.8 -> luôn "run" không quay đầu.

const CAT_URL = '/?cat=1';
const WALK_RANDOM = 0.4;
const RUN_RANDOM = 0.8;
const DESKTOP_SIZE = 48;
const MOBILE_SIZE = 36;
const CAT_BOTTOM = 16;
const CAT_Z_INDEX = 30;
const TOAST_Z_INDEX = 1000;
const HOVER_PAUSE_MS = 1000;
const POSITION_EPSILON = 0.6;
const RECT_TOLERANCE = 0.5;

const project = {
  version: '1.0',
  metadata: { title: 'Pixel cat' },
  cards: ['a', 'b', 'c'].map((id, i) => ({
    id,
    title: id,
    summary: id + ' summary',
    content: '# ' + id,
    position: { x: 60 + i * 280, y: 80 },
    size: { width: 240, height: 140 },
    extensions: { 'card-atlas:node': { kind: 'card' } },
  })),
  relations: [],
  extensions: {},
};

const fakeCatRandom = (page, value) =>
  page.addInitScript((fixed) => {
    const real = Math.random.bind(Math);
    Math.random = () => ((new Error().stack || '').includes('pixel-cat.js') ? fixed : real());
  }, value);

async function load(page, { url = CAT_URL, random = null } = {}) {
  if (random !== null) await fakeCatRandom(page, random);
  await page.goto(url);
  await page.locator('#file-input').setInputFiles({
    name: 'cat.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('.graph-card')).not.toHaveCount(0);
}

const catState = (page) =>
  page.evaluate(() => {
    const cat = document.querySelector('.pixel-cat');
    const sprite = document.querySelector('.pixel-cat-sprite');
    const r = cat.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      top: r.top,
      width: r.width,
      pose: sprite.dataset.pose,
      dir: sprite.dataset.dir,
      viewport: document.documentElement.clientWidth,
      viewportHeight: window.innerHeight,
    };
  });

const sample = async (page, count, intervalMs) => {
  const states = [];
  for (let i = 0; i < count; i++) {
    states.push(await catState(page));
    await page.waitForTimeout(intervalMs);
  }
  return states;
};

const layoutRects = (page) =>
  page.evaluate(() => {
    const rect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const root = document.documentElement;
    return {
      scrollWidth: root.scrollWidth,
      scrollHeight: root.scrollHeight,
      clientWidth: root.clientWidth,
      toolbar: rect('.toolbar'),
      canvas: rect('#canvas-region'),
      palette: rect('#shape-library'),
      sidebar: rect('.sidebar'),
      zoom: rect('.zoom-controls'),
    };
  });

test.describe('pixel cat', () => {
  test('gate: no cat under webdriver without ?cat=1', async ({ page }) => {
    await load(page, { url: '/' });
    expect(await page.evaluate(() => navigator.webdriver)).toBe(true);
    await page.waitForTimeout(800);
    await expect(page.locator('.pixel-cat')).toHaveCount(0);
    await expect(page.locator('.pixel-cat-layer')).toHaveCount(0);
  });

  test('gate: ?cat=1 mounts exactly one decorative cat with a same-origin sprite', async ({
    page,
  }) => {
    const sprites = [];
    page.on('response', (r) => {
      if (r.url().includes('cat-sprites')) sprites.push(r);
    });
    await load(page);
    await expect(page.locator('.pixel-cat')).toHaveCount(1);
    expect(sprites.length).toBeGreaterThan(0);
    for (const response of sprites) {
      expect(response.status()).toBe(200);
      expect(new URL(response.url()).origin).toBe(new URL(page.url()).origin);
    }
    await expect(page.locator('.pixel-cat-layer')).toHaveAttribute('aria-hidden', 'true');
    const attrs = await page.locator('.pixel-cat').evaluate((cat) => ({
      tabindex: cat.getAttribute('tabindex'),
      role: cat.getAttribute('role'),
      label: cat.getAttribute('aria-label'),
      layerTab: cat.closest('.pixel-cat-layer').getAttribute('tabindex'),
      focusable: !!cat.querySelector('a[href],button,input,select,textarea,[tabindex]'),
    }));
    expect(attrs).toEqual({
      tabindex: null,
      role: null,
      label: null,
      layerTab: null,
      focusable: false,
    });
  });

  test('keyboard: Tab through the whole page never focuses the cat', async ({ page }) => {
    await load(page);
    await page.locator('.pixel-cat').waitFor();
    const reached = new Set();
    let insideCat = false;
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        return { inCat: !!el?.closest('.pixel-cat-layer'), tag: el?.tagName, id: el?.id };
      });
      insideCat ||= info.inCat;
      reached.add(info.tag + '#' + info.id);
    }
    expect(reached.size).toBeGreaterThan(5);
    expect(insideCat).toBe(false);
  });

  test('layout: cat adds no layout change, no horizontal scroll, correct overlay styles', async ({
    page,
    browser,
  }) => {
    await load(page, { url: '/' });
    const without = await layoutRects(page);

    const catPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await load(catPage);
      await catPage.locator('.pixel-cat').waitFor();
      const withCat = await layoutRects(catPage);
      expect(withCat.scrollWidth).toBe(without.scrollWidth);
      expect(withCat.scrollHeight).toBe(without.scrollHeight);
      expect(withCat.scrollWidth).toBeLessThanOrEqual(withCat.clientWidth);
      for (const key of ['toolbar', 'canvas', 'palette', 'sidebar', 'zoom']) {
        expect(withCat[key], key).not.toBeNull();
        for (const side of ['x', 'y', 'w', 'h'])
          expect(
            Math.abs(withCat[key][side] - without[key][side]),
            `${key}.${side}`,
          ).toBeLessThanOrEqual(RECT_TOLERANCE);
      }

      const styles = await catPage.evaluate(() => {
        const css = (selector) => {
          const s = window.getComputedStyle(document.querySelector(selector));
          return { position: s.position, pointerEvents: s.pointerEvents, zIndex: s.zIndex };
        };
        const toast = window.getComputedStyle(document.querySelector('#toast'));
        const z = (selector) =>
          Number(window.getComputedStyle(document.querySelector(selector)).zIndex);
        return {
          layer: css('.pixel-cat-layer'),
          cat: css('.pixel-cat'),
          toastZ: Number(toast.zIndex),
          dockZ: z('#format-inspector'),
          toolbarZ: z('.toolbar'),
        };
      });
      expect(styles.layer.position).toBe('fixed');
      expect(styles.layer.pointerEvents).toBe('none');
      expect(Number(styles.layer.zIndex)).toBe(CAT_Z_INDEX);
      expect(styles.cat.pointerEvents).toBe('auto');
      expect(CAT_Z_INDEX).toBeLessThan(styles.toastZ);
      // The pet must sit below the Format dock and the toolbar/menu, never over their buttons.
      expect(CAT_Z_INDEX).toBeLessThan(styles.dockZ);
      expect(CAT_Z_INDEX).toBeLessThan(styles.toolbarZ);
      expect(styles.toastZ).toBe(TOAST_Z_INDEX);
    } finally {
      await catPage.close();
    }
  });

  test('does not block other controls: zoom and Fit work while the cat is near the bottom', async ({
    page,
  }) => {
    // Walk deterministic; cat bottom band is 16..64px, zoom controls sit elsewhere or are clicked
    // by real mouse at their own centre (hit-test must reach the button, not the layer).
    await load(page, { random: WALK_RANDOM });
    await page.locator('.pixel-cat').waitFor();
    const controls = page.locator('.zoom-controls button:not([disabled])');
    const count = await controls.count();
    expect(count).toBeGreaterThan(2);
    for (let i = 0; i < count; i++) {
      const hit = await controls.nth(i).evaluate((button) => {
        const r = button.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return {
          reaches: button === top || button.contains(top),
          inLayer: !!top?.closest('.pixel-cat-layer'),
        };
      });
      // The cat may legitimately sit over a button for a moment; the layer itself must never.
      if (hit.inLayer) continue;
      expect(hit.reaches).toBe(true);
    }
    const before = await page.locator('#zoom-value').innerText();
    // Playwright waits for the hit target, so a cat parked over the button only delays the click.
    await page.locator('[data-action=zoom-in]').click();
    await expect.poll(() => page.locator('#zoom-value').innerText()).not.toBe(before);
    await page.locator('[data-action=fit]').click();
    await expect(page.locator('#zoom-value')).toBeVisible();
  });

  test('motion: cat changes pose and stays inside the viewport (walk, run, edges, flip)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 560, height: 800 });
    await load(page, { random: RUN_RANDOM });
    await page.locator('.pixel-cat').waitFor();
    // The turn pose lasts ~180ms, shorter than the sampling interval, so every pose is recorded
    // by a read-only MutationObserver instead of being caught by chance between samples.
    await page.evaluate(() => {
      const sprite = document.querySelector('.pixel-cat-sprite');
      window.__catPoses = new Set([sprite.dataset.pose]);
      new window.MutationObserver(() => window.__catPoses.add(sprite.dataset.pose)).observe(
        sprite,
        {
          attributes: true,
          attributeFilter: ['data-pose'],
        },
      );
    });
    const states = await sample(page, 60, 250);
    const poses = new Set(await page.evaluate(() => [...window.__catPoses]));
    expect(poses.has('run')).toBe(true);
    expect(poses.has('turn')).toBe(true);
    for (const s of states) {
      expect(s.left).toBeGreaterThanOrEqual(-RECT_TOLERANCE);
      expect(s.right).toBeLessThanOrEqual(s.viewport + RECT_TOLERANCE);
      expect(Math.abs(s.bottom - (s.viewportHeight - CAT_BOTTOM))).toBeLessThanOrEqual(
        RECT_TOLERANCE,
      );
    }
    // Direction must match actual movement between consecutive samples while running.
    let checked = 0;
    for (let i = 1; i < states.length; i++) {
      const moved = states[i].left - states[i - 1].left;
      if (states[i].pose === 'run' && states[i - 1].pose === 'run' && Math.abs(moved) > 8) {
        if (states[i].dir === states[i - 1].dir) {
          expect(moved > 0 ? 'right' : 'left').toBe(states[i].dir);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(3);
    expect(new Set(states.map((s) => s.dir)).size).toBe(2);
    expect(
      Math.max(...states.map((s) => s.left)) - Math.min(...states.map((s) => s.left)),
    ).toBeGreaterThan(100);
  });

  test('responsive: resize 1440 -> 1000 -> 600 keeps the cat inside; mobile size is 36', async ({
    page,
  }) => {
    await load(page, { random: WALK_RANDOM });
    await page.locator('.pixel-cat').waitFor();
    expect((await catState(page)).width).toBe(DESKTOP_SIZE);
    for (const [width, size] of [
      [1000, DESKTOP_SIZE],
      [600, MOBILE_SIZE],
      [1440, DESKTOP_SIZE],
    ]) {
      await page.setViewportSize({ width, height: 800 });
      await expect.poll(async () => (await catState(page)).width).toBe(size);
      for (const s of await sample(page, 4, 150)) {
        expect(s.left).toBeGreaterThanOrEqual(-RECT_TOLERANCE);
        expect(s.right).toBeLessThanOrEqual(s.viewport + RECT_TOLERANCE);
      }
    }
  });

  test('fixed: scrolling the page and panning the canvas does not move the cat vertically', async ({
    page,
  }) => {
    await load(page, { random: WALK_RANDOM });
    await page.locator('.pixel-cat').waitFor();
    const before = await catState(page);
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, 600);
    await page.mouse.wheel(300, 0);
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(300);
    const after = await catState(page);
    expect(Math.abs(after.bottom - before.bottom)).toBeLessThanOrEqual(RECT_TOLERANCE);
    expect(after.bottom).toBeLessThanOrEqual(after.viewportHeight - CAT_BOTTOM + RECT_TOLERANCE);
  });

  test('interaction: click makes the cat jump and land back on the same bottom line', async ({
    page,
  }) => {
    await load(page, { random: WALK_RANDOM });
    await page.locator('.pixel-cat').waitFor();
    const start = await catState(page);
    await page.mouse.move(start.left + start.width / 2, start.top + start.width / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(async () => (await catState(page)).pose, { timeout: 500 }).toBe('jump');
    const airborne = await page.evaluate(() => {
      const r = document.querySelector('.pixel-cat-body').getBoundingClientRect();
      return { bottom: r.bottom };
    });
    expect(airborne.bottom).toBeLessThanOrEqual(start.bottom + RECT_TOLERANCE);
    // Jump lasts 300-500ms (+ slack for CPU load); afterwards the cat is back on the floor.
    await expect.poll(async () => (await catState(page)).pose, { timeout: 1500 }).not.toBe('jump');
    await page.waitForTimeout(100);
    const landed = await page.evaluate(() => {
      const r = document.querySelector('.pixel-cat-body').getBoundingClientRect();
      return { bottom: r.bottom };
    });
    expect(Math.abs(landed.bottom - start.bottom)).toBeLessThanOrEqual(RECT_TOLERANCE);
    // Behaviour continues (walk with the fixed random) and the cat moves again.
    await page.mouse.move(5, 5);
    const resumed = await sample(page, 8, 250);
    expect(new Set(resumed.map((s) => s.pose)).has('walk')).toBe(true);
  });

  test('interaction: hover pauses the cat but resumes within ~1.2s even if the pointer stays', async ({
    page,
  }) => {
    await load(page, { random: WALK_RANDOM });
    await page.locator('.pixel-cat').waitFor();
    // Wait until the initial idle is over and the cat is walking.
    await expect.poll(async () => (await catState(page)).pose, { timeout: 8000 }).toBe('walk');
    const s = await catState(page);
    await page.mouse.move(s.left + s.width / 2 + 2, s.top + s.width / 2);
    await expect.poll(async () => (await catState(page)).pose, { timeout: 400 }).toBe('idle');
    const paused = await catState(page);
    await page.waitForTimeout(400);
    expect(Math.abs((await catState(page)).left - paused.left)).toBeLessThanOrEqual(
      POSITION_EPSILON,
    );
    // Pointer is still on (or near) the cat; movement must resume after HOVER_PAUSE_MS.
    await expect
      .poll(async () => (await catState(page)).pose, { timeout: HOVER_PAUSE_MS + 700 })
      .toBe('walk');
    await page.waitForTimeout(500);
    expect(Math.abs((await catState(page)).left - paused.left)).toBeGreaterThan(3);
  });

  test('reduced motion: cat stays idle and still, and no cat rAF loop runs', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      // Read-only probe: count rAF callbacks created by the cat's walk/run tick.
      window.__catTicks = 0;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => {
        if (String(cb).includes('segment.')) window.__catTicks++;
        return raf(cb);
      };
    });
    await load(page, { random: WALK_RANDOM });
    await page.locator('.pixel-cat').waitFor();
    const first = await catState(page);
    const states = await sample(page, 8, 500);
    for (const s of states) {
      expect(s.pose).toBe('idle');
      expect(Math.abs(s.left - first.left)).toBeLessThanOrEqual(POSITION_EPSILON);
    }
    expect(await page.evaluate(() => window.__catTicks)).toBe(0);
    await expect(page.locator('.pixel-cat-layer')).toHaveClass(/is-still/);
  });

  test('reduced motion toggled live: cat freezes, then moves again', async ({ page }) => {
    await load(page, { random: WALK_RANDOM });
    await expect.poll(async () => (await catState(page)).pose, { timeout: 8000 }).toBe('walk');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () => (await catState(page)).pose, { timeout: 1000 }).toBe('idle');
    const frozen = await catState(page);
    await page.waitForTimeout(1200);
    expect(Math.abs((await catState(page)).left - frozen.left)).toBeLessThanOrEqual(
      POSITION_EPSILON,
    );
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(async () => (await catState(page)).pose, { timeout: 4000 }).toBe('walk');
  });

  test('hidden tab: cat halts when the page becomes hidden', async ({ context, page }) => {
    await load(page, { random: WALK_RANDOM });
    await expect.poll(async () => (await catState(page)).pose, { timeout: 8000 }).toBe('walk');
    // A real visibilitychange is only produced when another page is brought to front.
    const other = await context.newPage();
    await other.goto('about:blank');
    await other.bringToFront();
    const hidden = await page.evaluate(() => document.hidden).catch(() => false);
    test.skip(
      !hidden,
      'Headless Chromium does not hide a page when another tab is brought to front; ' +
        'no real UI path to a hidden document, so this case is not asserted (core unit test covers it).',
    );
    await expect.poll(async () => (await catState(page)).pose, { timeout: 1000 }).toBe('idle');
    await other.close();
  });

  test('health: no page errors, console errors or cross-origin requests', async ({ page }) => {
    const errors = [];
    const external = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol.startsWith('http'))
        external.push(r.url());
    });
    await load(page, { random: RUN_RANDOM });
    await page.locator('.pixel-cat').waitFor();
    await page.setViewportSize({ width: 600, height: 800 });
    const start = await catState(page);
    await page.mouse.click(start.left + start.width / 2, start.top + start.width / 2);
    await page.waitForTimeout(4000);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('layering: the pet never covers the Format dock, so Apply stays clickable', async ({
    page,
  }) => {
    // 700px wide: the 379px dock overlaps most of the pet's walking range.
    await page.setViewportSize({ width: 700, height: 800 });
    await load(page, { random: WALK_RANDOM });
    await page.locator('.pixel-cat').waitFor();
    await page.locator('[data-id=a] [data-overview-field=title]').click();
    await expect(page.locator('#format-inspector')).toBeVisible();
    let overlaps = 0;
    for (let i = 0; i < 70; i++) {
      const hit = await page.evaluate(() => {
        const cat = document.querySelector('.pixel-cat').getBoundingClientRect();
        const dock = document.querySelector('#format-inspector').getBoundingClientRect();
        const left = Math.max(cat.left, dock.left);
        const right = Math.min(cat.right, dock.right);
        const top = Math.max(cat.top, dock.top);
        const bottom = Math.min(cat.bottom, dock.bottom);
        if (right <= left || bottom <= top) return null;
        const el = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
        return { insidePet: Boolean(el && el.closest('.pixel-cat-layer')) };
      });
      if (hit) {
        overlaps++;
        expect(hit.insidePet).toBe(false);
      }
      await page.waitForTimeout(100);
    }
    // The assertion is only meaningful if the pet really walked under the dock.
    expect(overlaps).toBeGreaterThan(0);
  });
});
