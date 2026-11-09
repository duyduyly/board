import { test, expect } from '@playwright/test';

// Bong bóng hỏi thăm của thú cưng. Cổng tự động hóa: chỉ bật khi URL có ?cat=1.
// Chỉ bấm vào thú bằng chuột thật; lượt tự động 7-15 phút được kiểm bằng test lõi với timer giả.

const VIEWPORT = { width: 1000, height: 800 };
const BUBBLE = '.pixel-cat-bubble';

const clickPet = async (page) => {
  const box = await page.locator('.pixel-cat').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.up();
};

test.describe('pet chat bubble', () => {
  test.use({ viewport: VIEWPORT });

  for (const [pet, sound] of [
    ['cat', /^Mew/],
    ['dog', /^Gâu/],
  ]) {
    test(`clicking the ${pet} shows a bubble that starts with its own sound and fades away`, async ({
      page,
    }) => {
      await page.goto(`/?cat=1&pet=${pet}`);
      await page.locator('.pixel-cat').waitFor();
      await clickPet(page);
      const bubble = page.locator(BUBBLE);
      await expect(bubble).toHaveCount(1);
      await expect(bubble).toHaveText(sound);
      await expect(bubble).toHaveClass(/is-open/);
      const rect = await bubble.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, width: r.width };
      });
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(VIEWPORT.width);
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.width).toBeLessThanOrEqual(222);
      await expect(bubble).toHaveCSS('pointer-events', 'none');
      await expect(page.locator(BUBBLE)).toHaveCount(0, { timeout: 8000 });
    });
  }

  test('the dog speaks Woof in English', async ({ page }) => {
    await page.goto('/?cat=1&pet=dog');
    await page.locator('#locale').selectOption('en');
    await page.locator('.pixel-cat').waitFor();
    await clickPet(page);
    await expect(page.locator(BUBBLE)).toHaveText(/^Woof/);
  });

  test('the bubble does not block controls and adds no layout change or horizontal scroll', async ({
    page,
  }) => {
    await page.goto('/?cat=1&pet=dog');
    await page.locator('.pixel-cat').waitFor();
    const before = await page.evaluate(() => document.documentElement.scrollWidth);
    await clickPet(page);
    await expect(page.locator(BUBBLE)).toHaveCount(1);
    const after = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(after).toBe(before);
    expect(after).toBeLessThanOrEqual(VIEWPORT.width);
  });

  test('without ?cat=1 under automation there is no pet and no bubble', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.pixel-cat')).toHaveCount(0);
    await expect(page.locator(BUBBLE)).toHaveCount(0);
  });
});
