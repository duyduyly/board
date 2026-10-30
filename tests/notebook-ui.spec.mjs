import { test, expect } from '@playwright/test';

test('notebook theme preserves authored card appearance, model and measured typography', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  const card = (id, extensions = {}) => ({
    id,
    title: 'Đóng gói dữ liệu',
    summary: 'Giữ trạng thái bên trong và mở hành vi có kiểm soát.',
    content: '# Đóng gói\n\nNội dung Markdown giữ font dễ đọc.',
    position: { x: ['paper', 'authored', 'example', 'borderless'].indexOf(id) * 320, y: 100 },
    size: { width: 260, height: 260 },
    style: { backgroundColor: '#FFF2B0', textColor: '#23332D', borderColor: '#C8B76B' },
    extensions,
  });
  const project = {
    version: '1.0',
    metadata: { title: 'Sổ tay chì' },
    cards: [
      card('paper'),
      card('authored', {
        'card-atlas:typography': { title: { fontFamily: 'mono', fontSize: 20 } },
        'card-atlas:appearance': { radius: 24, shadow: 'none' },
      }),
      card('example', {
        'card-atlas:node': { kind: 'text' },
        'card-atlas:appearance': {
          shape: 'rectangle',
          radius: 0,
          backgroundTransparent: true,
          borderTransparent: true,
          shadow: 'none',
        },
      }),
      card('borderless', { 'card-atlas:appearance': { borderWidth: 0, shadow: 'none' } }),
    ],
    relations: [],
  };
  await page.locator('#file-input').setInputFiles({
    name: 'notebook.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.locator('[data-choice=apply]').click();
  const before = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    return { project: store.project, undo: store.undoStack.length };
  });
  const paper = page.locator('[data-id=paper]');
  await expect(page.locator('[data-map-view=card]')).toHaveCSS(
    'background-color',
    'rgb(69, 101, 78)',
  );
  expect(
    await paper.locator('h3').evaluate((el) => window.getComputedStyle(el).fontFamily),
  ).toContain('Segoe Print');
  expect(
    await page
      .locator('[data-id=authored] h3')
      .evaluate((el) => window.getComputedStyle(el).fontFamily),
  ).toContain('Consolas');
  await expect(page.locator('[data-id=authored]')).toHaveCSS('border-top-left-radius', '24px');
  await expect(page.locator('[data-id=authored]')).toHaveCSS('box-shadow', 'none');
  const decoration = await page
    .locator('[data-id=borderless]')
    .evaluate((el) => window.getComputedStyle(el, '::before').borderWidth);
  expect(decoration).toBe('0px');
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.locator('#theme-toggle').click();
    if (theme === 'dark')
      await expect(page.locator('[data-map-view=card]')).toHaveCSS(
        'background-color',
        'rgb(178, 203, 164)',
      );
    await expect(page.locator('[data-id=example]')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    expect(
      await page
        .locator('[data-id=example]')
        .evaluate((el) => window.getComputedStyle(el, '::before').content),
    ).toBe('none');
    await expect(page.locator('[data-id=example]')).toHaveCSS('border-radius', '0px');
    await page.locator('#locale').selectOption(theme === 'dark' ? 'en' : 'vi');
  }
  const measured = await page.evaluate(async () => {
    const { store } = await import('/assets/js/app.js');
    const { measureOverview } = await import('/assets/js/canvas/text-measure.js');
    return {
      sizes: store.project.cards.map((c) => measureOverview(c, null, 'card')),
      project: store.project,
      undo: store.undoStack.length,
    };
  });
  expect(measured.sizes.every((s) => s && s.width > 0 && s.height > 0)).toBe(true);
  expect(measured.project).toEqual(before.project);
  expect(measured.undo).toBe(before.undo);
  expect(errors).toEqual([]);
});
