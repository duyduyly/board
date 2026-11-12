import { test, expect } from '@playwright/test';
import { locale } from './ui-driver.mjs';

const ID = 'dQw4w9WgXcQ';
const ID2 = 'aqz-KE-bpKQ';
const YOUTUBE_HOST = /^https?:\/\/[^/]*(youtube(-nocookie)?\.com|youtu\.be)\//;
const EDGE_TOLERANCE = 2;

const video = (href, title) =>
  '<p><a class="board-video" href="' + href + '">' + title + '</a></p>';
const watch = (id) => 'https://www.youtube.com/watch?v=' + id;
const filler = '<p>Dòng đệm để vùng đọc có thể cuộn.</p>'.repeat(40);

/** Blocks real network access to YouTube and records every request leaving the app origin. */
async function guardNetwork(page, baseURL) {
  const origin = new URL(baseURL).origin;
  const youtube = [];
  const external = [];
  await page.route(YOUTUBE_HOST, (route) => {
    youtube.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>fake</title>' });
  });
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith(origin) || url.startsWith('data:') || url.startsWith('blob:')) return;
    if (!YOUTUBE_HOST.test(url)) external.push(url);
  });
  return { youtube, external };
}

async function importHtml(page, html, lang = 'vi') {
  await page.goto('/');
  if (lang !== 'vi') await locale(page, lang);
  await page.locator('[data-template=personal]').click();
  await page.locator('[data-palette-kind=card]').click();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(1).click();
  await page.locator('[data-block-label=htmlImportTitle]').click();
  await page.locator('[data-html-source]').fill(html);
  await page.locator('[data-html-review]').click();
  await expect(page.locator('[data-html-result]')).toBeVisible();
  await page.locator('[data-html-accept]').click();
  await page.locator('#panel-body [type=submit]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
}

async function openOverview(page) {
  await page.locator('.graph-card.selected, .graph-card').last().focus();
  await page.keyboard.press('Enter');
  await page.locator('#panel-tabs button').nth(0).click();
  await expect(page.locator('iframe.html-document-frame')).toBeVisible();
}

async function setup(page, html, lang) {
  await importHtml(page, html, lang);
  await openOverview(page);
}

const reading = (page) => page.frameLocator('iframe.html-document-frame');
const playButtons = (page) => reading(page).locator('button.board-video-play');
const players = (page) => page.locator('.reading-video-player');

async function expectBoxesMatch(page, playerIndex, buttonIndex = playerIndex) {
  const button = await playButtons(page).nth(buttonIndex).boundingBox();
  const player = await players(page).nth(playerIndex).boundingBox();
  expect(button).not.toBeNull();
  expect(player).not.toBeNull();
  for (const edge of ['x', 'y', 'width', 'height'])
    expect(Math.abs(player[edge] - button[edge])).toBeLessThanOrEqual(EDGE_TOLERANCE);
}

const expectMatched = (page, index = 0, buttonIndex = index) =>
  expect
    .poll(async () => {
      const button = await playButtons(page).nth(buttonIndex).boundingBox();
      const player = await players(page).nth(index).boundingBox();
      if (!button || !player) return Infinity;
      return Math.max(...['x', 'y', 'width', 'height'].map((k) => Math.abs(player[k] - button[k])));
    })
    .toBeLessThanOrEqual(EDGE_TOLERANCE);

test('placeholder is 16:9 and nothing is requested before play', async ({ page, baseURL }) => {
  const net = await guardNetwork(page, baseURL);
  await setup(page, video(watch(ID), 'Bài hát'));
  const button = playButtons(page);
  await expect(button).toHaveCount(1);
  await expect(button).toHaveText('Bài hát');
  await expect(button).toHaveAttribute('aria-label', 'Phát video: Bài hát');
  const box = await button.boundingBox();
  expect(box.width / box.height).toBeGreaterThan(1.7);
  expect(box.width / box.height).toBeLessThan(1.8);
  await expect(reading(page).locator('figure.board-video-frame')).toHaveAttribute(
    'data-video-id',
    ID,
  );
  await expect(players(page)).toHaveCount(0);
  expect(net.youtube).toEqual([]);
  expect(net.external).toEqual([]);
});

test('clicking play opens exactly one nocookie player and one YouTube request', async ({
  page,
  baseURL,
}) => {
  const net = await guardNetwork(page, baseURL);
  await setup(page, video(watch(ID), 'Bài hát'));
  await playButtons(page).click();
  await expect(players(page)).toHaveCount(1);
  const iframe = players(page).locator('iframe');
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/' + ID + '?autoplay=1&rel=0',
  );
  await expect(iframe).toHaveAttribute('title', 'Trình phát YouTube');
  await expect.poll(() => net.youtube.length).toBe(1);
  expect(net.youtube[0]).toContain('youtube-nocookie.com/embed/' + ID);
  expect(net.external).toEqual([]);
});

test('player box follows the play button after play, font scale, viewport change and scroll', async ({
  page,
  baseURL,
}) => {
  await guardNetwork(page, baseURL);
  await setup(page, filler + video(watch(ID), 'Bài hát') + filler);
  await playButtons(page).scrollIntoViewIfNeeded();
  await playButtons(page).click();
  await expect(players(page)).toHaveCount(1);
  await expectBoxesMatch(page, 0);

  await page.locator('#reading-text-larger').click();
  await expectMatched(page);

  await page.setViewportSize({ width: 1000, height: 800 });
  await expectMatched(page);

  const before = await playButtons(page).boundingBox();
  await page.locator('.panel-body').first().hover();
  await page.mouse.wheel(0, 120);
  await expect
    .poll(async () => (await playButtons(page).boundingBox())?.y ?? before.y)
    .not.toBe(before.y);
  await expectMatched(page);
});

for (const [name, key] of [
  ['Enter', 'Enter'],
  ['Space', 'Space'],
]) {
  test('keyboard ' + name + ' on the play button opens the player', async ({ page, baseURL }) => {
    await guardNetwork(page, baseURL);
    await setup(page, video(watch(ID), 'Bài hát'));
    await playButtons(page).focus();
    await page.keyboard.press(key);
    await expect(players(page)).toHaveCount(1);
    await expect(players(page).locator('iframe')).toHaveAttribute('src', new RegExp(ID));
  });
}

test('close button removes the player and returns focus to the play button', async ({
  page,
  baseURL,
}) => {
  await guardNetwork(page, baseURL);
  await setup(page, video(watch(ID), 'Bài hát'));
  await playButtons(page).click();
  const close = page.locator('.reading-video-close');
  await expect(close).toHaveAttribute('aria-label', 'Đóng video');
  await close.click();
  await expect(players(page)).toHaveCount(0);
  const focusedIsPlay = await page
    .locator('iframe.html-document-frame')
    .evaluate((frame) =>
      frame.contentDocument.activeElement?.classList.contains('board-video-play'),
    );
  expect(focusedIsPlay).toBe(true);
});

test('two videos play independently and each player matches its own button', async ({
  page,
  baseURL,
}) => {
  const net = await guardNetwork(page, baseURL);
  await setup(page, video(watch(ID), 'Một') + video(watch(ID2), 'Hai'));
  await expect(playButtons(page)).toHaveCount(2);
  await playButtons(page).nth(1).click();
  await expect(players(page)).toHaveCount(1);
  await expect(players(page).first().locator('iframe')).toHaveAttribute('src', new RegExp(ID2));
  await playButtons(page).nth(0).click();
  await expect(players(page)).toHaveCount(2);
  await expect(players(page).nth(1).locator('iframe')).toHaveAttribute('src', new RegExp(ID));
  const buttons = [
    await playButtons(page).nth(0).boundingBox(),
    await playButtons(page).nth(1).boundingBox(),
  ];
  for (const player of [players(page).nth(0), players(page).nth(1)]) {
    const src = await player.locator('iframe').getAttribute('src');
    const button = src.includes(ID2) ? buttons[1] : buttons[0];
    const box = await player.boundingBox();
    for (const edge of ['x', 'y', 'width', 'height'])
      expect(Math.abs(box[edge] - button[edge])).toBeLessThanOrEqual(EDGE_TOLERANCE);
  }
  expect(net.youtube).toHaveLength(2);
});

test('invalid links stay plain links and valid URL forms become players', async ({
  page,
  baseURL,
}) => {
  await guardNetwork(page, baseURL);
  const html =
    video('https://example.com/watch?v=' + ID, 'Host lạ') +
    video(watch('short'), 'Id sai') +
    video('https://youtu.be/' + ID, 'Dạng ngắn') +
    video('https://www.youtube.com/shorts/' + ID, 'Shorts') +
    video('https://www.youtube.com/embed/' + ID, 'Embed');
  await setup(page, html);
  await expect(playButtons(page)).toHaveCount(3);
  await expect(reading(page).locator('figure.board-video-frame')).toHaveCount(3);
  for (const title of ['Dạng ngắn', 'Shorts', 'Embed'])
    await expect(playButtons(page).filter({ hasText: title })).toHaveCount(1);
  for (const title of ['Host lạ', 'Id sai']) {
    const link = reading(page).locator('a').filter({ hasText: title });
    await expect(link).toHaveCount(1);
    await expect(reading(page).locator('button').filter({ hasText: title })).toHaveCount(0);
  }
});

test('English locale labels the play button, note and close button in English', async ({
  page,
  baseURL,
}) => {
  await guardNetwork(page, baseURL);
  await setup(page, video(watch(ID), 'Song'), 'en');
  await expect(playButtons(page)).toHaveAttribute('aria-label', 'Play video: Song');
  const note = reading(page).locator('figcaption.board-video-note');
  await expect(note).toContainText('YouTube');
  await expect(note).not.toContainText('Mở trên YouTube');
  await expect(note.locator('a')).toHaveText('Open on YouTube');
  await playButtons(page).click();
  await expect(page.locator('.reading-video-close')).toHaveAttribute('aria-label', 'Close video');
  await expect(players(page).locator('iframe')).toHaveAttribute('title', 'YouTube player');
});

test('switching tabs or closing Detail while playing leaves no orphan player', async ({
  page,
  baseURL,
}) => {
  await guardNetwork(page, baseURL);
  await setup(page, video(watch(ID), 'Bài hát'));
  await playButtons(page).click();
  await expect(players(page)).toHaveCount(1);
  await page.locator('#panel-tabs button').nth(1).click();
  await expect(players(page)).toHaveCount(0);
  await page.locator('#panel-tabs button').nth(0).click();
  await expect(playButtons(page)).toHaveCount(1);
  await expect(players(page)).toHaveCount(0);
  await playButtons(page).click();
  await expect(players(page)).toHaveCount(1);
  await page.locator('[data-action=close]').click();
  await expect(page.locator('#detail-panel')).not.toBeVisible();
  await expect(players(page)).toHaveCount(0);
});

test('Escape on the open player closes the video only and keeps Detail open', async ({
  page,
  baseURL,
}) => {
  await guardNetwork(page, baseURL);
  await setup(page, video(watch(ID), 'Bài hát'));
  await playButtons(page).click();
  await page.locator('.reading-video-close').focus();
  await page.keyboard.press('Escape');
  await expect(players(page)).toHaveCount(0);
  await expect(page.locator('#detail-panel')).toBeVisible();
  const focusedIsPlay = await page
    .locator('iframe.html-document-frame')
    .evaluate((frame) =>
      frame.contentDocument.activeElement?.classList.contains('board-video-play'),
    );
  expect(focusedIsPlay).toBe(true);
});

test('the covered play button leaves the Tab order while its player is open', async ({
  page,
  baseURL,
}) => {
  await guardNetwork(page, baseURL);
  await setup(page, video(watch(ID), 'Bài hát'));
  await expect(playButtons(page)).not.toHaveAttribute('tabindex', '-1');
  await playButtons(page).click();
  await expect(playButtons(page)).toHaveAttribute('tabindex', '-1');
  await page.locator('.reading-video-close').click();
  await expect(playButtons(page)).not.toHaveAttribute('tabindex', '-1');
});
