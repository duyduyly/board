import { test, expect } from '@playwright/test';

// R4 / CA-UI-03/04/05: the bundled OFL handwriting face is for chrome headings only.
// Card titles (canvas and Detail title) and user-named group legends keep --hand-font so measured
// text and Fit stay unchanged; chrome headings use letter-spacing 0 because the face is narrow.

const FONT = 'Patrick Hand';
const SAMPLE =
  'Tiếng Việt: Ắ Ặ Ẫ Ể Ễ Ộ Ợ Ữ Ỹ ạ ả ấ ầ ẩ ẫ ậ ắ ằ ẳ ẵ ặ ẹ ẻ ẽ ế ề ể ễ ệ ỉ ị ọ ỏ ố ồ ổ ỗ ộ ớ ờ ở ỡ ợ ụ ủ ứ ừ ử ữ ự ỳ ỵ ỷ ỹ đ Đ';
const SHOT_DIR = process.env.T06_SHOTS;

const family = (page, selector) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => window.getComputedStyle(el).fontFamily);

const style = (page, selector, prop) =>
  page
    .locator(selector)
    .first()
    .evaluate((el, name) => window.getComputedStyle(el)[name], prop);

const fits = (page, selector) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => el.scrollWidth <= el.clientWidth + 1);

test('bundled handwriting font loads locally and only chrome headings use it', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  const base = new URL(page.url()).origin;

  expect(await family(page, '.home-page h1')).toContain(FONT);
  expect(await style(page, '.home-page h1', 'letterSpacing')).toBe('normal');
  await page.evaluate((name) => document.fonts.load(`32px '${name}'`), FONT);
  const faces = await page.evaluate(() =>
    [...document.fonts].map((face) => ({ family: face.family, status: face.status })),
  );
  expect(faces.find((face) => face.family.replace(/["']/g, '') === FONT)?.status).toBe('loaded');
  expect(requests.some((url) => url.endsWith('/assets/fonts/PatrickHand-Regular.ttf'))).toBe(true);

  await page.locator('[data-template=personal]').click();
  await expect(page.locator('.graph-card').first()).toBeVisible();
  expect(await family(page, '#shape-library > h2')).toContain(FONT);
  expect(await style(page, '#shape-library > h2', 'letterSpacing')).toBe('normal');
  const cardHeading = '.graph-card > h3, .graph-card > .shape-content > h3';
  expect(await family(page, cardHeading)).not.toContain(FONT);
  expect(await style(page, cardHeading, 'letterSpacing')).not.toBe('normal');

  await page.locator('.card-open').first().click();
  await expect(page.locator('#detail-panel')).toBeVisible();
  // Detail title is the card title: same face, weight and spacing as before the font change.
  const detailTitle = '.detail-panel > .panel-header > h2';
  expect(await family(page, detailTitle)).not.toContain(FONT);
  expect(await style(page, detailTitle, 'fontWeight')).toBe('700');
  expect(await style(page, detailTitle, 'letterSpacing')).toBe('-0.5px');
  for (const selector of [
    '#detail-panel input',
    '#detail-panel textarea',
    '#detail-panel button',
  ]) {
    if (await page.locator(selector).count())
      expect(await family(page, selector), selector).not.toContain(FONT);
  }

  const external = requests.filter((url) => !url.startsWith(base) && !url.startsWith('data:'));
  expect(external).toEqual([]);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 800 },
]) {
  for (const locale of ['vi', 'en']) {
    test(`chrome headings do not overflow at ${viewport.width}x${viewport.height} ${locale}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await page.locator('#locale').selectOption(locale);
      expect(await fits(page, '.home-page h1')).toBe(true);
      await page.locator('[data-template=personal]').click();
      await expect(page.locator('.graph-card').first()).toBeVisible();
      expect(await fits(page, '#shape-library > h2')).toBe(true);
      await page.locator('.card-open').first().click();
      await expect(page.locator('#detail-panel')).toBeVisible();
      expect(await fits(page, '.detail-panel > .panel-header > h2')).toBe(true);
      if (SHOT_DIR)
        await page.screenshot({ path: `${SHOT_DIR}/detail-${viewport.width}-${locale}.png` });
    });
  }
}

for (const theme of ['light', 'dark']) {
  test(`Vietnamese diacritics render in the heading font (${theme})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    if (theme === 'dark') {
      await page.locator('#theme-toggle').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    }
    await page.evaluate(
      ([name, text]) => document.fonts.load(`32px '${name}'`, text),
      [FONT, SAMPLE],
    );
    // Presentation-only probe: the sample replaces the heading text in the DOM, nothing else.
    await page.locator('.home-page h1').evaluate((el, text) => (el.textContent = text), SAMPLE);
    expect(
      await page.evaluate(
        ([name, text]) => document.fonts.check(`32px '${name}'`, text),
        [FONT, SAMPLE],
      ),
    ).toBe(true);
    const box = await page.locator('.home-page h1').boundingBox();
    expect(box.width).toBeGreaterThan(200);
    if (SHOT_DIR)
      await page
        .locator('.home-page h1')
        .screenshot({ path: `${SHOT_DIR}/vi-sample-${theme}.png` });
  });
}
