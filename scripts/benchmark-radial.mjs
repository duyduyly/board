import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4173');
await page.locator('.toolbar [data-action=new]').click();
await page.locator('[data-choice=create]').click();
const requestedView = process.argv[2] || 'mind';
const reportPrefix = process.argv[3] || 'mind-map-phase2';
const screenshotPrefix = reportPrefix === 'mind-map-phase2' ? 'radial' : reportPrefix;
const withShapes = process.argv.includes('--shapes');
const result = await page.evaluate(
  async ({ requestedView, withShapes }) => {
    const { store, adapter } = await import('/assets/js/app.js');
    const { stage } = await import('/assets/js/json/validator.js');
    const cards = Array.from({ length: 500 }, (_, i) => ({
      id: 'bench-' + i,
      title: 'Component ' + i,
      summary: 'Representative system component',
      type: i % 2 ? 'service' : 'module',
      tags: ['benchmark'],
      content:
        i === 0
          ? '# Documentation\n\n' + 'x'.repeat(99980)
          : '# Responsibilities\n\n' + 'Representative documentation. '.repeat(30),
      position: { x: (i % 25) * 320, y: Math.floor(i / 25) * 220 },
      size: { width: 260, height: 140 },
      style: { backgroundColor: '#e0f0e7', textColor: '#202925', borderColor: '#28594b' },
    }));
    cards[1].content =
      '# Flow\n\n' +
      String.fromCharCode(96).repeat(3) +
      'mermaid\nflowchart LR\n A --> B\n' +
      String.fromCharCode(96).repeat(3);
    const relations = Array.from({ length: 2000 }, (_, i) => ({
      id: 'edge-' + i,
      source: 'bench-' + (i % 500),
      target: 'bench-' + (((i % 500) + 1 + Math.floor(i / 500) * 7) % 500),
      label: 'uses',
      type: 'dependency',
      description: '',
      style: { color: '#64748b', line: 'solid', arrow: 'end' },
    }));
    const landscape = document.createElement('canvas');
    landscape.width = 320;
    landscape.height = 140;
    const portrait = document.createElement('canvas');
    portrait.width = 140;
    portrait.height = 320;
    for (const canvas of [landscape, portrait]) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#d9eade';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#28594b';
      ctx.font = '18px sans-serif';
      ctx.fillText('Embedded image', 10, 40);
    }
    for (const [i, c] of cards.entries()) {
      const kind = ['card', 'text', 'image', 'image-text'][i % 4];
      c.extensions = { 'card-atlas:node': { kind } };
      if (withShapes)
        c.extensions['card-atlas:appearance'] = {
          shape: [
            'rectangle',
            'rounded',
            'square',
            'circle',
            'ellipse',
            'diamond',
            'triangle',
            'hexagon',
          ][i % 8],
          titleFontSize: 18,
          sizeMode: 'manual',
        };
      if (['image', 'image-text'].includes(kind)) {
        c.extensions['card-atlas:node'].coverImageId = 'cover';
        c.extensions['card-atlas:images'] = {
          cover: {
            name: 'benchmark.png',
            mimeType: 'image/png',
            data: (i % 2 ? portrait : landscape).toDataURL('image/png').split(',')[1],
          },
        };
      }
    }
    for (let i = 1; i < 500; i++) {
      relations[i - 1].source = 'bench-' + Math.floor((i - 1) / 4);
      relations[i - 1].target = 'bench-' + i;
      relations[i - 1].extensions = { 'card-atlas:mind-map': { kind: 'branch' } };
    }
    const text = JSON.stringify({
      version: '1.0',
      metadata: { title: 'Benchmark', description: '' },
      canvas: { zoom: 1, position: { x: 0, y: 0 } },
      cards,
      relations,
      extensions: { 'card-atlas:mind-map': { rootId: 'bench-0' } },
    });
    const start = performance.now();
    const parsed = stage(text);
    if (parsed.errors.length) throw Error(JSON.stringify(parsed.errors));
    store.replace(parsed.project);
    if (requestedView === 'mind') {
      const control = document.querySelector('#map-view');
      control.value = 'mind';
      control.dispatchEvent(new Event('change'));
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const importMs = performance.now() - start;
    const layoutStart = performance.now();
    if (requestedView === 'mind') document.querySelector('[data-action=layout]').click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const layoutPreviewMs = performance.now() - layoutStart;
    const { layoutPreview } = await import('/assets/js/app.js');
    const layoutOverlaps = layoutPreview?.result.overlaps || 0;
    const warnings = layoutPreview?.result.warnings || [];
    if (requestedView === 'mind') document.querySelector('[data-action=layout-apply]').click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const layoutApplyMs = performance.now() - layoutStart - layoutPreviewMs;
    const selections = [];
    for (let i = 2; i < 7; i++) {
      document.querySelector('[data-action=close]').click();
      await Promise.resolve();
      document.querySelector('[data-action=search]').click();
      await Promise.resolve();
      const t = performance.now();
      document.querySelector('.card-row[data-card-id="bench-' + i + '"]').click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      selections.push(performance.now() - t);
    }
    document.querySelector('[data-action=close]').click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const fps = [];
    const startPan = performance.now();
    let previous = startPan;
    await new Promise((resolve) => {
      const frame = (now) => {
        const delta = now - previous;
        previous = now;
        if (delta > 0) fps.push(1000 / delta);
        adapter.cy.pan({ x: 50 + Math.sin(now / 300) * 120, y: 50 + Math.cos(now / 300) * 80 });
        if (now - startPan < 10000) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    fps.sort((a, b) => a - b);
    return {
      layoutPreviewMs,
      layoutApplyMs,
      layoutOverlaps,
      warnings,
      cards: cards.length,
      relations: relations.length,
      bytes: new TextEncoder().encode(text).length,
      importMs,
      overviewMs: Math.max(...selections),
      overviewSamplesMs: selections,
      panMedianFps: fps[Math.floor(fps.length / 2)],
      panDurationMs: performance.now() - startPan,
      frames: fps.length,
    };
  },
  { requestedView, withShapes },
);
const report = {
  view: requestedView,
  shapes: withShapes ? '8 basic shapes' : 'legacy',
  date: new Date().toISOString(),
  browser: await browser.version(),
  os: os.type() + ' ' + os.release(),
  cpu: os.cpus()[0]?.model,
  memoryGiB: Math.round(os.totalmem() / 1024 ** 3),
  viewport: '1440x900',
  measurement:
    'Warm loaded app; JSON parse+validate+normalize+replace+two animation frames. Overview measured on five cards; canvas pan animates for 10s. No human preview/dialog time.',
  ...result,
};
report.targets = {
  import: result.importMs <= 3000,
  overview: result.overviewMs <= 200,
  pan: result.panMedianFps >= 45,
  layout: result.layoutPreviewMs <= 3000,
  overlap: result.layoutOverlaps === 0,
};
await fs.writeFile(
  'planning/' + reportPrefix + '-benchmark-' + requestedView + '.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
await page.waitForTimeout(250);
await page.screenshot({
  path: 'planning/design/' + screenshotPrefix + '-benchmark-' + requestedView + '.png',
});
await browser.close();
