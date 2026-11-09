import { test, expect } from '@playwright/test';

// R4: card icons are pencil-style SVG masks on ::before. Asserts the hit area, token colours,
// graphic contrast (UI-04), focus ring, local-only assets and the pinned-card states.

const card = (id, x, y, extensions = {}) => ({
  id,
  title: id,
  summary: `${id} summary`,
  content: `# ${id}`,
  position: { x, y },
  size: { width: 240, height: 160 },
  extensions: { 'card-atlas:node': { kind: 'card' }, ...extensions },
});
const project = {
  version: '1.0',
  metadata: { title: 'Pencil icons' },
  cards: [
    card('plain', 40, 60),
    card('pinned', 400, 60, { 'card-atlas:metadata': { pinned: true } }),
  ],
  relations: [],
};
const ICON_FILES = [
  'icons/card-open.svg',
  'icons/connector.svg',
  'icons/resize.svg',
  'pushpin.svg',
  'pushpin-red.svg',
];
const GRAPHIC_CONTRAST = 3;
const SELECT_INSET = 8;
const LOCAL_HOST = '127.0.0.1';
const ICONS = [
  { name: 'open', selector: '.card-open', mask: 'card-open.svg' },
  { name: 'connector', selector: '.connector', mask: 'connector.svg' },
  { name: 'resize', selector: '.resize-handle', mask: 'resize.svg' },
];

async function load(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'icons.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  await expect(page.locator('.graph-card')).toHaveCount(2);
  await page.locator('[data-action=fit]').click();
}

async function select(page, id) {
  const box = await page.locator(`.graph-card[data-id=${id}]`).boundingBox();
  await page.mouse.click(box.x + SELECT_INSET, box.y + SELECT_INSET);
  await expect(page.locator(`.graph-card[data-id=${id}]`)).toHaveClass(/selected/);
}

async function setTheme(page, theme) {
  if ((await page.locator('html').getAttribute('data-theme')) !== theme)
    await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

// Read-only measurement of one control and its ::before in the page.
const measure = (page, id, selector) =>
  page.evaluate(
    ([cardId, sel]) => {
      const parse = (c) => c.match(/[\d.]+/g).map(Number);
      const lum = ([r, g, b]) => {
        const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const ratio = (a, b) => {
        const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const el = document.querySelector(`.graph-card[data-id=${cardId}]`);
      const c = el.querySelector(sel);
      const b = c.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      const before = window.getComputedStyle(c, '::before');
      const own = window.getComputedStyle(c);
      const paint = parse(before.backgroundColor).slice(0, 3);
      // The glyph sits on the control's own surface, or on the card for the borderless open button.
      const surface = parse(
        sel === '.card-open' ? window.getComputedStyle(el).backgroundColor : own.backgroundColor,
      ).slice(0, 3);
      const opacity = Number(own.opacity);
      const blended = paint.map((v, i) => v * opacity + surface[i] * (1 - opacity));
      return {
        hit: Boolean(hit && c.contains(hit)),
        beforeSize: [parseFloat(before.width), parseFloat(before.height)],
        maskImage: before.maskImage || before.webkitMaskImage,
        ownMask: own.maskImage,
        paint: before.backgroundColor,
        contrast: ratio(blended, surface),
        glyphFill: own.webkitTextFillColor,
        text: c.textContent,
      };
    },
    [id, selector],
  );

for (const theme of ['light', 'dark'])
  test(`${theme}: pencil icons keep hit area, token paint and graphic contrast`, async ({
    page,
  }) => {
    await load(page);
    await setTheme(page, theme);
    await select(page, 'plain');
    for (const icon of ICONS) {
      const m = await measure(page, 'plain', icon.selector);
      expect(m.hit, `${icon.name} centre hit`).toBe(true);
      expect(m.beforeSize[0], `${icon.name} mask width`).toBeGreaterThan(0);
      expect(m.beforeSize[1], `${icon.name} mask height`).toBeGreaterThan(0);
      expect(m.maskImage, `${icon.name} mask`).toContain(icon.mask);
      expect(m.ownMask, `${icon.name} button is not masked`).toBe('none');
      expect(m.paint, `${icon.name} paint`).not.toBe('rgba(0, 0, 0, 0)');
      expect(m.contrast, `${icon.name} contrast ${m.contrast}`).toBeGreaterThanOrEqual(
        GRAPHIC_CONTRAST,
      );
    }
    const open = await measure(page, 'plain', '.card-open');
    expect(open.text).toBe('↗');
    expect(open.glyphFill).toBe('rgba(0, 0, 0, 0)');
  });

test('pencil icons show a visible focus ring and make no external request', async ({ page }) => {
  const foreign = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('data:') && new URL(r.url()).hostname !== LOCAL_HOST)
      foreign.push(r.url());
  });
  await load(page);
  await select(page, 'plain');
  for (const icon of ICONS) {
    const control = page.locator(`.graph-card[data-id=plain] ${icon.selector}`);
    await control.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(control).toBeFocused();
    const ring = await control.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), mask: s.maskImage };
    });
    expect(ring.style, `${icon.name} outline`).not.toBe('none');
    expect(ring.width, `${icon.name} outline width`).toBeGreaterThan(0);
    expect(ring.mask, `${icon.name} outline is not clipped by a mask`).toBe('none');
  }
  for (const file of ICON_FILES) {
    const res = await page.request.get(`/assets/images/${file}`);
    expect(res.status(), file).toBe(200);
    expect(res.headers()['content-type'], file).toContain('image/svg+xml');
  }
  expect(foreign).toEqual([]);
});

test('pinned card hides its connector and the pinned pin differs from the plain one', async ({
  page,
}) => {
  await load(page);
  const pin = (id) => page.locator(`.graph-card[data-id=${id}] .card-pin`);
  await expect(pin('plain')).toHaveAttribute('aria-pressed', 'false');
  await expect(pin('pinned')).toHaveAttribute('aria-pressed', 'true');
  const image = (id) => pin(id).evaluate((el) => window.getComputedStyle(el).backgroundImage);
  expect(await image('plain')).toContain('pushpin.svg');
  expect(await image('pinned')).toContain('pushpin-red.svg');
  await select(page, 'pinned');
  const hidden = await page
    .locator('.graph-card[data-id=pinned] .connector')
    .evaluateAll((els) => els.every((el) => window.getComputedStyle(el).display === 'none'));
  expect(hidden).toBe(true);
  await select(page, 'plain');
  await expect(page.locator('.graph-card[data-id=plain] .connector')).toBeVisible();
});
