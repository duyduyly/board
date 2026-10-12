import fs from 'node:fs/promises';
import { stage } from '../assets/js/json/validator.js';
import { geometry, MIND, relationKind } from '../assets/js/graph/mind-map.js';
const p = stage(await fs.readFile('assets/data/mind-map-example.json', 'utf8')).project;
const children = new Map(p.cards.map((c) => [c.id, []]));
for (const r of p.relations)
  if (relationKind(r) === 'branch') children.get(r.source).push(r.target);
const levels = [],
  visit = (id, depth) => {
    (levels[depth] ||= []).push(p.cards.find((c) => c.id === id));
    for (const child of children.get(id)) visit(child, depth + 1);
  };
visit(p.extensions[MIND].rootId, 0);
const run = (bounded) => {
  const boxes = [];
  let radius = 0,
    previous = 0;
  for (const [depth, level] of levels.entries()) {
    const diag = Math.max(
      ...level.map((c) => {
        const s = geometry(p, c, 'mind').size;
        return Math.hypot(s.width, s.height);
      }),
    );
    radius = depth
      ? bounded
        ? Math.max(
            radius + (previous + diag) / 2 + 60,
            (diag + 60) / (2 * Math.sin(Math.PI / Math.max(2, level.length))),
          )
        : depth * 160
      : 0;
    for (const [i, c] of level.entries()) {
      const a = (2 * Math.PI * i) / level.length,
        s = geometry(p, c, 'mind').size;
      boxes.push({
        id: c.id,
        x: Math.cos(a) * radius - s.width / 2,
        y: Math.sin(a) * radius - s.height / 2,
        ...s,
      });
    }
    previous = diag;
  }
  let overlap = 0;
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      if (
        a.x < b.x + b.width &&
        b.x < a.x + a.width &&
        a.y < b.y + b.height &&
        b.y < a.y + a.height
      )
        overlap++;
    }
  return { overlap, boxes };
};
const report = {
  date: new Date().toISOString(),
  fixture: '12 mixed nodes, three root branches, four levels and detached node',
  naive: run(false),
  bounded: run(true),
  decision:
    'Sector angles weighted by subtree leaf sizes; depth rings use actual bounding diagonals, pair angle separation and depth clearance. Pack detached forests separately. Deterministic IDs and no force simulation/library.',
};
await fs.writeFile(
  'planning/mind-map-radial-prototype.json',
  JSON.stringify(report, null, 2) + String.fromCharCode(10),
);
console.log(
  JSON.stringify({
    naiveOverlaps: report.naive.overlap,
    boundedOverlaps: report.bounded.overlap,
    decision: report.decision,
  }),
);

const boxes = report.bounded.boxes;
const left = Math.min(...boxes.map((b) => b.x)) - 40,
  top = Math.min(...boxes.map((b) => b.y)) - 40;
const width = Math.max(...boxes.map((b) => b.x + b.width)) - left + 40,
  height = Math.max(...boxes.map((b) => b.y + b.height)) - top + 40;
const lines = p.relations
  .filter((r) => relationKind(r) === 'branch')
  .map((r) => {
    const a = boxes.find((b) => b.id === r.source),
      b = boxes.find((b) => b.id === r.target);
    return a && b
      ? '<path d="M ' +
          (a.x + a.width / 2) +
          ' ' +
          (a.y + a.height / 2) +
          ' L ' +
          (b.x + b.width / 2) +
          ' ' +
          (b.y + b.height / 2) +
          '" stroke="#347d68"/>'
      : '';
  })
  .join('');
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
  [left, top, width, height].join(' ') +
  '"><rect x="' +
  left +
  '" y="' +
  top +
  '" width="' +
  width +
  '" height="' +
  height +
  '" fill="#f5f7f5"/>' +
  lines +
  boxes
    .map(
      (b) =>
        '<rect x="' +
        b.x +
        '" y="' +
        b.y +
        '" width="' +
        b.width +
        '" height="' +
        b.height +
        '" rx="10" fill="#e0f0e7" stroke="#347d68"/><text x="' +
        (b.x + 12) +
        '" y="' +
        (b.y + 30) +
        '" font-family="sans-serif" font-size="16">' +
        b.id +
        '</text>',
    )
    .join('') +
  '</svg>';
await fs.writeFile('planning/design/radial-prototype.svg', svg);
