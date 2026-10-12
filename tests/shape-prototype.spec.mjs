import { test, expect } from '@playwright/test';
test('shape geometry prototype: zoom-safe SVG border, safe area and anchors', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { shapes, shapePoints, safeArea, shapeAnchor } =
      await import('/assets/js/graph/shape-registry.js');
    const host = document.createElement('div');
    host.id = 'shape-prototype';
    host.style.cssText =
      'position:fixed;inset:80px 20px 20px;background:#f5f7f5;z-index:1000;display:flex;flex-wrap:wrap;gap:12px;align-content:start';
    document.body.append(host);
    for (const shape of Object.keys(shapes)) {
      const size = { width: 280, height: 190 },
        points = shapePoints(shape, size),
        a = safeArea(shape, size),
        anchor = shapeAnchor(points, { x: 140, y: 95 }, { x: 1, y: 0 });
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '280');
      svg.setAttribute('height', '190');
      svg.innerHTML =
        '<polygon points="' +
        points.map((p) => p.x + ',' + p.y).join(' ') +
        '" fill="#E3EFE8" stroke="#28594B" stroke-width="2"/><rect x="' +
        a.x +
        '" y="' +
        a.y +
        '" width="' +
        a.width +
        '" height="' +
        a.height +
        '" fill="none" stroke="#7955A0"/><circle cx="' +
        anchor.x +
        '" cy="' +
        anchor.y +
        '" r="4" fill="#AC7026"/><text x="140" y="100" text-anchor="middle">' +
        shape +
        '</text>';
      host.append(svg);
    }
    return host.children.length;
  });
  expect(result).toBe(8);
  await page.screenshot({ path: 'planning/design/feedback-03-shape-prototype.png' });
  for (const scale of [0.1, 4]) {
    await page
      .locator('#shape-prototype svg')
      .evaluateAll(
        (els, s) => els.forEach((el) => (el.style.transform = 'scale(' + s + ')')),
        scale,
      );
    await expect(page.locator('#shape-prototype svg polygon')).toHaveCount(8);
  }
});
