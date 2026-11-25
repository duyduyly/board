import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const FIXTURE = JSON.parse(
  fs.readFileSync(new URL('./fixtures/timeline-project.json', import.meta.url), 'utf8'),
);
const PINNED = 'task-08';
const UNSCHEDULED = ['task-29', 'task-30', 'task-31', 'task-32'];
const FAR_FUTURE = '2026-12-01';

/** Date a note shows on Timeline: its schedule, else the creation date on the note. */
function expectedDate(card) {
  const ext = card.extensions || {};
  return ext['card-atlas:schedule']?.start || ext['card-atlas:metadata']?.createdDate || null;
}
const DATED = FIXTURE.cards.filter(expectedDate);

const entries = (page) => page.locator('#timeline-view li.timeline-entry');
const entry = (page, id) => page.locator(`#timeline-view li.timeline-entry[data-card-id="${id}"]`);
const scroller = (page) => page.locator('#timeline-view .timeline-scroll');
const scrollLeft = (page) => scroller(page).evaluate((el) => el.scrollLeft);
const orderedIds = (page) => entries(page).evaluateAll((els) => els.map((el) => el.dataset.cardId));

async function openTimeline(page) {
  await page.goto('/');
  await page.locator('#file-input').setInputFiles({
    name: 'timeline.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(FIXTURE)),
  });
  const apply = page.locator('[data-choice=apply]');
  if (await apply.isVisible({ timeout: 1500 }).catch(() => false)) await apply.click();
  await expect(page.locator('#timeline-view')).toBeVisible();
  await expect(entries(page)).toHaveCount(DATED.length);
}

async function setTheme(page, theme) {
  if ((await page.locator('html').getAttribute('data-theme')) !== theme)
    await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

// The global app toolbar itself overflows at 820px with or without Timeline (also on Note Board), so
// the page-level check starts at 1000px; the Timeline surface and its toolbar are checked everywhere.
async function noHorizontalOverflow(page, { pageLevel }) {
  const overflow = await page.evaluate(() => {
    const view = document.querySelector('#timeline-view');
    const bar = view.querySelector('.timeline-toolbar');
    return {
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      view: view.scrollWidth - view.clientWidth,
      toolbar: bar.scrollWidth - bar.clientWidth,
    };
  });
  if (pageLevel) expect(overflow.page).toBeLessThanOrEqual(0);
  expect(overflow.view).toBeLessThanOrEqual(0);
  expect(overflow.toolbar).toBeLessThanOrEqual(0);
}

test.describe('Timeline interaction', () => {
  test('layout: no overlapping cards, horizontal scroll and jump buttons', async ({ page }) => {
    await openTimeline(page);
    await expect(page.locator('#timeline-view .timeline-mode-note')).toHaveText(
      'Theo thứ tự sự kiện — khoảng cách không theo tỷ lệ thời gian',
    );
    await expect(page.locator('.timeline-count')).toContainText(String(DATED.length));
    expect(DATED.length + UNSCHEDULED.length).toBeGreaterThanOrEqual(30);
    await expect(page.locator('details.timeline-unscheduled')).toBeVisible();
    await expect(page.locator('details.timeline-unscheduled li')).toHaveCount(UNSCHEDULED.length);

    const boxes = await page
      .locator('#timeline-view .timeline-card')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
    expect(boxes).toHaveLength(DATED.length);
    for (let i = 0; i < boxes.length; i += 1)
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap =
          a.left < b.right - 1 &&
          b.left < a.right - 1 &&
          a.top < b.bottom - 1 &&
          b.top < a.bottom - 1;
        expect(overlap, `cards ${i} and ${j} overlap`).toBe(false);
      }

    expect(await scroller(page).evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    const bar = (action) => page.locator(`#timeline-view [data-timeline-action=${action}]`);
    await bar('end').click();
    expect(await scrollLeft(page)).toBeGreaterThan(0);
    await bar('start').click();
    expect(await scrollLeft(page)).toBe(0);
    await bar('today').click();
    await expect.poll(() => scrollLeft(page)).toBeGreaterThan(0);
  });

  test('entries are ordered by date', async ({ page }) => {
    await openTimeline(page);
    const ids = await orderedIds(page);
    const dateOf = new Map(DATED.map((card) => [card.id, expectedDate(card)]));
    expect(new Set(ids)).toEqual(new Set(DATED.map((card) => card.id)));
    const dates = ids.map((id) => dateOf.get(id));
    expect(dates).toEqual([...dates].sort());
    for (const id of UNSCHEDULED) await expect(entry(page, id)).toHaveCount(0);
  });

  test('title opens Detail and closing returns focus to the title', async ({ page }) => {
    await openTimeline(page);
    const title = entry(page, 'task-03').locator('button.timeline-title');
    await title.click();
    await expect(page.locator('#detail-panel')).toBeVisible();
    await page.locator('#detail-panel [data-action=close]').click();
    await expect(page.locator('#detail-panel')).not.toBeVisible();
    await expect(title).toBeFocused();
  });

  test('schedule editor validates, applies, clears and undoes in one step', async ({ page }) => {
    await openTimeline(page);
    const popup = page.locator('#card-schedule-editor');
    const dateButton = (id) => entry(page, id).locator('button.timeline-date');
    const before = await orderedIds(page);

    await dateButton('task-01').click();
    await expect(popup).toBeVisible();
    await page.locator('#schedule-start').fill('2026-06-10');
    await page.locator('#schedule-end').fill('2026-06-01');
    await popup.locator('button[type=submit]').click();
    await expect(popup.locator('[role=alert]')).toBeVisible();
    await expect(popup).toBeVisible();
    expect(await orderedIds(page)).toEqual(before);

    await page.locator('#schedule-start').fill(FAR_FUTURE);
    await page.locator('#schedule-end').fill('');
    await popup.locator('button[type=submit]').click();
    await expect(popup).not.toBeVisible();
    await expect(entry(page, 'task-01')).toHaveAttribute('data-date-source', 'schedule');
    expect((await orderedIds(page)).at(-1)).toBe('task-01');

    await page.locator('[data-action=undo]').first().click();
    expect(await orderedIds(page)).toEqual(before);

    // A note whose date comes from the note: schedule it, then clear to fall back to the note date.
    await expect(entry(page, 'task-26')).toHaveAttribute('data-date-source', 'card-date');
    await dateButton('task-26').click();
    await page.locator('#schedule-start').fill(FAR_FUTURE);
    await popup.locator('button[type=submit]').click();
    await expect(entry(page, 'task-26')).toHaveAttribute('data-date-source', 'schedule');
    await dateButton('task-26').click();
    await popup.locator('[data-schedule-clear]').click();
    await expect(popup).not.toBeVisible();
    await expect(entry(page, 'task-26')).toHaveAttribute('data-date-source', 'card-date');
    expect(await orderedIds(page)).toEqual(before);
  });

  test('status chip changes status through the shared popover and undoes', async ({ page }) => {
    await openTimeline(page);
    const chip = entry(page, 'task-01').locator('button.timeline-status-chip');
    await expect(entry(page, 'task-01')).toHaveAttribute('data-card-status', 'new');
    await chip.click();
    const popover = page.locator('#card-status-popover');
    await expect(popover).toBeVisible();
    await popover.locator('[data-status=done]').click();
    await expect(entry(page, 'task-01')).toHaveAttribute('data-card-status', 'done');
    await page.locator('[data-action=undo]').first().click();
    await expect(entry(page, 'task-01')).toHaveAttribute('data-card-status', 'new');
  });

  test('pinned note shows a toast and opens no editor', async ({ page }) => {
    await openTimeline(page);
    // Pinned controls are aria-disabled; the click still reaches the app, which explains the lock.
    await entry(page, PINNED).locator('button.timeline-date').click({ force: true });
    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator('#toast')).toContainText('ghim');
    await expect(page.locator('#card-schedule-editor')).not.toBeVisible();
    await entry(page, PINNED).locator('button.timeline-status-chip').click({ force: true });
    await expect(page.locator('#card-status-popover')).not.toBeVisible();
  });

  test('status filter narrows entries and can be cleared', async ({ page }) => {
    await openTimeline(page);
    const select = page.locator('#timeline-status-filter');
    await select.selectOption('done');
    const doneIds = DATED.filter(
      (card) => card.extensions['card-atlas:status']?.value === 'done',
    ).map((card) => card.id);
    await expect(entries(page)).toHaveCount(doneIds.length);
    for (const li of await entries(page).all())
      await expect(li).toHaveAttribute('data-card-status', 'done');
    await expect(page.locator('.timeline-count')).toContainText(String(doneIds.length));
    await select.selectOption('');
    await expect(entries(page)).toHaveCount(DATED.length);
  });

  test('keyboard moves between titles and Enter opens Detail', async ({ page }) => {
    await openTimeline(page);
    const titles = page.locator('#timeline-view li.timeline-entry button.timeline-title');
    await titles.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(titles.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(titles.first()).toBeFocused();
    await page.keyboard.press('End');
    await expect(titles.last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(titles.first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#detail-panel')).toBeVisible();
  });

  test('reveal on the board selects the right note', async ({ page }) => {
    await openTimeline(page);
    await entry(page, 'task-05').locator('button.timeline-reveal').click();
    await expect(page.locator('#timeline-view')).toBeHidden();
    await expect(page.locator('.graph-card[data-id=task-05]')).toHaveClass(/selected/);
  });

  test('search from Timeline scrolls to the entry', async ({ page }) => {
    await openTimeline(page);
    await page.locator('#timeline-view [data-timeline-action=start]').click();
    await page.locator('[data-action=search]').click();
    await page.locator('#search').fill('Task 24');
    await page.locator('.card-row[data-card-id="task-24"]').click();
    await expect(page.locator('#timeline-view')).toBeVisible();
    const title = entry(page, 'task-24').locator('button.timeline-title');
    await expect(title).toBeInViewport();
    expect(await scrollLeft(page)).toBeGreaterThan(0);
  });

  for (const theme of ['light', 'dark'])
    for (const locale of ['vi', 'en'])
      test(`no horizontal overflow in ${theme}/${locale} at 1440, 1000 and 820px`, async ({
        page,
      }) => {
        await openTimeline(page);
        await page.locator('#locale').selectOption(locale);
        await setTheme(page, theme);
        for (const width of [1440, 1000, 820]) {
          await page.setViewportSize({ width, height: 900 });
          await expect(entries(page).first()).toBeVisible();
          await noHorizontalOverflow(page, { pageLevel: width >= 1000 });
        }
      });
});
