import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const data = await page.evaluate(() => {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 280;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f7f5';
  ctx.fillRect(0, 0, 640, 280);
  ctx.fillStyle = '#28594b';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('English endings: pronunciation', 24, 44);
  ctx.fillStyle = '#e8f0fb';
  ctx.fillRect(24, 70, 286, 182);
  ctx.fillStyle = '#fff1df';
  ctx.fillRect(330, 70, 286, 182);
  ctx.fillStyle = '#23332d';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('-s / -es', 44, 111);
  ctx.fillText('-ed', 350, 111);
  ctx.font = '20px sans-serif';
  ctx.fillText('/s/   books', 44, 150);
  ctx.fillText('/z/   plays', 44, 187);
  ctx.fillText('/ɪz/  watches', 44, 224);
  ctx.fillText('/t/   worked', 350, 150);
  ctx.fillText('/d/   played', 350, 187);
  ctx.fillText('/ɪd/  wanted', 350, 224);
  return canvas.toDataURL('image/png').split(',')[1];
});
await fs.writeFile('tests/fixtures/english-endings.png', Buffer.from(data, 'base64'));
const project = JSON.parse(await fs.readFile('assets/data/english-endings-example.json', 'utf8'));
const card = project.cards.find((c) => c.id === 'english-overview');
card.extensions = {
  ...card.extensions,
  'card-atlas:images': {
    'image-endings-chart': { name: 'english-endings.png', mimeType: 'image/png', data },
  },
};
if (!card.content.includes('attachment:image-endings-chart'))
  card.content +=
    '\n\n## Bảng nhớ bằng ảnh\n\nẢnh này nằm trong file JSON, không cần tải từ website khác.\n\n![Bảng nhớ phát âm đuôi tiếng Anh](attachment:image-endings-chart)\n';
await fs.writeFile(
  'assets/data/english-endings-example.json',
  JSON.stringify(project, null, 2) + '\n',
);
console.log('Embedded PNG fixture and English example updated');
await browser.close();
