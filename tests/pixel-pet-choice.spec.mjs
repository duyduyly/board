import { test, expect } from '@playwright/test';

// Chọn thú cưng (mèo/chó/tắt). Cổng tự động hóa: navigator.webdriver = true nên chỉ bật khi URL có ?cat=1.
// Chỉ thao tác control hiển thị (menu ? và select) và đọc trạng thái qua evaluate.

const LABELS = {
  vi: { label: 'Thú cưng', options: ['Mèo', 'Chó', 'Tắt'] },
  en: { label: 'Pet', options: ['Cat', 'Dog', 'Off'] },
};
const VIEWPORT = { width: 1000, height: 800 };
const CAT_SIZE = 48;

const openMenu = async (page) => {
  if (!(await page.locator('#project-menu').evaluate((e) => e.open)))
    await page.locator('#quick-help').click();
  await expect(page.locator('#project-menu')).toHaveJSProperty('open', true);
};
const choose = async (page, value) => {
  await openMenu(page);
  await page.locator('#pet-choice').selectOption(value);
};
const storageSnapshot = (page) =>
  page.evaluate(async () => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    idb: (await window.indexedDB.databases()).map((d) => d.name).sort(),
  }));

test.describe('pet choice', () => {
  test.use({ viewport: VIEWPORT });

  test('default is the cat and the select reflects it', async ({ page }) => {
    await page.goto('/?cat=1');
    await expect(page.locator('.pixel-cat')).toHaveCount(1);
    await expect(page.locator('.pixel-cat')).toHaveAttribute('data-pet', 'cat');
    await openMenu(page);
    await expect(page.locator('#pet-choice')).toHaveValue('cat');
  });

  test('choosing Dog swaps the cat for one dog with the dog sprite; Off removes it; Cat returns', async ({
    page,
  }) => {
    const sprites = [];
    page.on('response', (r) => {
      if (r.url().includes('dog-sprites')) sprites.push(r);
    });
    await page.goto('/?cat=1');
    await expect(page.locator('.pixel-cat[data-pet=cat]')).toHaveCount(1);

    await choose(page, 'dog');
    await expect(page.locator('.pixel-cat[data-pet=dog]')).toHaveCount(1);
    await expect(page.locator('.pixel-cat')).toHaveCount(1);
    await expect(page.locator('.pixel-cat-layer')).toHaveCount(1);
    await expect(page.locator('.pixel-cat-sprite')).toHaveAttribute('data-render', 'smooth');
    expect(sprites.length).toBeGreaterThan(0);
    for (const response of sprites) {
      expect(response.status()).toBe(200);
      expect(new URL(response.url()).origin).toBe(new URL(page.url()).origin);
    }
    const smooth = await page
      .locator('.pixel-cat-sprite')
      .evaluate((el) => window.getComputedStyle(el).imageRendering);
    expect(smooth).toBe('auto');

    await choose(page, 'off');
    await expect(page.locator('.pixel-cat')).toHaveCount(0);
    await expect(page.locator('.pixel-cat-layer')).toHaveCount(0);

    await choose(page, 'cat');
    await expect(page.locator('.pixel-cat[data-pet=cat]')).toHaveCount(1);
    await expect(page.locator('.pixel-cat')).toHaveCount(1);
    const crisp = await page
      .locator('.pixel-cat-sprite')
      .evaluate((el) => window.getComputedStyle(el).imageRendering);
    expect(crisp).toBe('pixelated');
  });

  test('?pet= sets the starting pet; unknown values fall back to the cat; off mounts nothing', async ({
    page,
  }) => {
    await page.goto('/?cat=1&pet=dog');
    await expect(page.locator('.pixel-cat[data-pet=dog]')).toHaveCount(1);
    await openMenu(page);
    await expect(page.locator('#pet-choice')).toHaveValue('dog');

    await page.goto('/?cat=1&pet=elephant');
    await expect(page.locator('.pixel-cat[data-pet=cat]')).toHaveCount(1);

    await page.goto('/?cat=1&pet=off');
    await page.waitForTimeout(600);
    await expect(page.locator('.pixel-cat')).toHaveCount(0);
    await openMenu(page);
    await expect(page.locator('#pet-choice')).toHaveValue('off');
  });

  test('the dog is bigger than the cat and stays inside the viewport after switching', async ({
    page,
  }) => {
    await page.goto('/?cat=1');
    await choose(page, 'dog');
    await expect(page.locator('.pixel-cat[data-pet=dog]')).toHaveCount(1);
    const box = await page.locator('.pixel-cat').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, bottom: r.bottom, w: r.width };
    });
    expect(box.left).toBeGreaterThanOrEqual(-0.5);
    expect(box.right).toBeLessThanOrEqual(VIEWPORT.width + 0.5);
    expect(box.bottom).toBeLessThanOrEqual(VIEWPORT.height + 0.5);
    expect(box.w).toBeGreaterThan(CAT_SIZE);
  });

  test('the dog walk and run loops play only their own frames after the stand and jump frames', async ({
    page,
  }) => {
    await page.goto('/?cat=1&pet=dog');
    const sprite = page.locator('.pixel-cat[data-pet=dog] .pixel-cat-sprite');
    await expect(sprite).toHaveCount(1);
    const sheet = await sprite.evaluate((el) => {
      const layer = el.closest('.pixel-cat-layer');
      return Number(window.getComputedStyle(layer).getPropertyValue('--cat-frames'));
    });
    expect(sheet).toBe(16);
    // Wait for a walking pose, then sample which frame index is shown for a while.
    const seen = await sprite.evaluate(
      (el) =>
        new Promise((resolve) => {
          const size = el.getBoundingClientRect().width;
          const frames = new Set();
          let walked = false;
          const started = performance.now();
          const sample = () => {
            // The pose attribute flips one frame before the CSS animation attaches.
            if (
              (el.dataset.pose === 'walk' || el.dataset.pose === 'run') &&
              el.getAnimations().length > 0
            ) {
              walked = true;
              const x = parseFloat(window.getComputedStyle(el).backgroundPositionX);
              frames.add(Math.round(-x / size));
            }
            if (performance.now() - started > 14000 || (walked && frames.size >= 8))
              resolve([...frames].sort((a, b) => a - b));
            else window.requestAnimationFrame(sample);
          };
          sample();
        }),
    );
    expect(seen.length).toBeGreaterThanOrEqual(5);
    for (const index of seen) {
      expect(index).toBeGreaterThanOrEqual(2);
      expect(index).toBeLessThanOrEqual(15);
    }
  });

  for (const loc of ['vi', 'en']) {
    test(`labels follow the locale (${loc}) including options`, async ({ page }) => {
      await page.goto('/?cat=1');
      await page.locator('#locale').selectOption(loc);
      await openMenu(page);
      await expect(page.locator('label.pet-choice > span')).toHaveText(LABELS[loc].label);
      await expect(page.locator('#pet-choice option')).toHaveText(LABELS[loc].options);
      const other = loc === 'vi' ? 'en' : 'vi';
      await page.locator('#locale').selectOption(other);
      await expect(page.locator('#pet-choice option')).toHaveText(LABELS[other].options);
      // The chosen value survives a locale change.
      await expect(page.locator('#pet-choice')).toHaveValue('cat');
    });
  }

  test('the select is a labelled native control operable by keyboard', async ({ page }) => {
    await page.goto('/?cat=1');
    await openMenu(page);
    await expect(page.getByLabel('Thú cưng')).toHaveCount(1);
    await page.locator('#pet-choice').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.pixel-cat[data-pet=dog]')).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.pixel-cat')).toHaveCount(0);
  });

  test('changing the pet writes nothing to local/session storage or IndexedDB', async ({
    page,
  }) => {
    await page.goto('/?cat=1');
    await openMenu(page);
    const before = await storageSnapshot(page);
    for (const value of ['dog', 'off', 'cat'])
      await page.locator('#pet-choice').selectOption(value);
    expect(await storageSnapshot(page)).toEqual(before);
  });

  for (const theme of ['light', 'dark']) {
    for (const loc of ['vi', 'en']) {
      test(`menu with the pet row fits at 1000x800 (${theme}, ${loc})`, async ({ page }) => {
        await page.goto('/?cat=1');
        await page.locator('#locale').selectOption(loc);
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await page.locator('#theme-toggle').click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await openMenu(page);
        const body = page.locator('#project-menu .project-menu-body');
        const box = await body.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(VIEWPORT.width);
        expect(box.y + box.height).toBeLessThanOrEqual(VIEWPORT.height);
        expect(await body.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(false);
        const row = await page.locator('label.pet-choice').boundingBox();
        expect(row.x).toBeGreaterThanOrEqual(box.x);
        expect(row.x + row.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
        await expect(page.locator('#pet-choice')).toBeVisible();
      });
    }
  }

  test('health: switching pets raises no page errors, console errors or external requests', async ({
    page,
  }) => {
    const errors = [];
    const external = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (!['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol.startsWith('http'))
        external.push(r.url());
    });
    await page.goto('/?cat=1');
    for (const value of ['dog', 'cat', 'off', 'dog']) {
      await choose(page, value);
      await page.waitForTimeout(300);
    }
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
});
