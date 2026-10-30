import fs from 'node:fs/promises';
import { stage } from '../assets/js/json/validator.js';
import { geometry, nodeStyle, setGeometry } from '../assets/js/graph/mind-map.js';
import { radialLayout, applyLayout } from '../assets/js/graph/radial-layout.js';
import { isPinned } from '../assets/js/graph/card-metadata.js';

const catalog = JSON.parse(await fs.readFile('assets/data/template-catalog.json', 'utf8'));
const marker = '\n\n## Workspace guide';
const guide =
  marker +
  '\n\n- Note Board: select a note, then use Format on the right for text, tags, paper and arrows. Page settings apply only to existing unlocked elements.\n- Double-click a note or image to read or edit its Markdown. Fenced code with a language such as java or json is syntax highlighted.\n- Convert to Mind Map: choose a root note; outgoing links become branches, extra/cycle links stay references. Note Board positions remain unchanged.\n- Mind Map: compact text/image nodes and curved branches. Double-click opens the same Markdown. Use Arrange Mind Map for a layout preview.\n- Apply saves and shows success feedback. Undo reverses a command. Export JSON to keep your work; examples are fresh copies when reopened.\n';
const square = new Set(['personal', 'architecture', 'roadmap', 'journal']);
const colors = ['#FFF2B0', '#E3EFE8', '#E8F0FB', '#F4E4EF'];
const mindTemplates = [
  [
    'mind-knowledge',
    'Bản đồ kiến thức',
    [
      'Chủ đề đang học',
      'Hiểu bản chất',
      'Giải thích bằng lời mình',
      'Ví dụ cụ thể',
      'Ghi nhớ',
      'Tự kiểm tra không nhìn tài liệu',
      'Lịch ôn cách quãng',
      'Áp dụng',
      'Bài tập nhỏ',
      'Phản hồi và sửa lỗi',
    ],
  ],
  [
    'mind-project',
    'Kế hoạch dự án',
    [
      'Mục tiêu dự án',
      'Phạm vi',
      'Kết quả cần bàn giao',
      'Tiêu chí hoàn thành',
      'Triển khai',
      'Công việc tiếp theo',
      'Rủi ro và phương án',
      'Phát hành',
      'Kiểm thử thực tế',
      'Theo dõi phản hồi',
    ],
  ],
];
for (const [id, title, names] of mindTemplates) {
  const parents = [null, 0, 1, 1, 0, 4, 4, 0, 7, 7];
  const cards = names.map((name, i) => ({
    id: id + '-' + i,
    title: name,
    summary: i
      ? 'Ghi một ý chính; nhấp đúp để bổ sung chi tiết.'
      : 'Bắt đầu từ chủ đề trung tâm rồi khám phá ba nhánh.',
    type: i ? 'idea' : 'topic',
    tags: [id],
    content:
      '# ' +
      name +
      '\n\n## Ý chính\n\nViết lời giải thích ngắn bằng ngôn ngữ của bạn.\n\n## Bước tiếp theo\n\n- [ ] Thêm một ví dụ hoặc hành động cụ thể.' +
      (i === 3 ? '\n\n```json\n{"idea": "one clear example", "reviewed": false}\n```' : ''),
    position: { x: (i % 4) * 360, y: Math.floor(i / 4) * 360 },
    size: { width: 260, height: 260 },
    style: {
      backgroundColor: colors[i % colors.length],
      textColor: '#23332D',
      borderColor: '#8CA694',
    },
    extensions: {
      'card-atlas:node': { kind: 'card' },
      'card-atlas:typography': { title: { fontSize: 20 }, summary: { fontSize: 14 } },
    },
  }));
  const relations = parents.flatMap((parent, i) =>
    parent === null
      ? []
      : [
          {
            id: id + '-r' + i,
            source: cards[parent].id,
            target: cards[i].id,
            extensions: {
              'card-atlas:edge': { route: 'curved' },
              'card-atlas:mind-map': { kind: 'branch' },
            },
          },
        ],
  );
  const p = {
    version: '1.0',
    metadata: {
      title,
      description: 'Mind Map với ba nhánh rõ ràng, nội dung chi tiết dùng chung với Note Board.',
    },
    cards,
    relations,
    extensions: { 'card-atlas:mind-map': { rootId: cards[0].id } },
  };
  await fs.writeFile('assets/data/templates/' + id + '.json', JSON.stringify(p, null, 2) + '\n');
}

export function refreshMindGeometry(p) {
  for (const card of p.cards) {
    if (isPinned(card)) continue;
    const image = ['image', 'image-text'].includes(nodeStyle(card).kind);
    const shape = card.extensions?.['card-atlas:appearance']?.shape;
    const root = p.extensions?.['card-atlas:mind-map']?.rootId === card.id;
    setGeometry(
      p,
      card.id,
      'mind',
      'size',
      image
        ? { width: 280, height: 210 }
        : shape && !['rectangle', 'rounded', 'square'].includes(shape)
          ? { width: 280, height: 220 }
          : { width: root ? 320 : 280, height: 140 },
    );
  }
  if (p.extensions?.['card-atlas:mind-map']?.rootId) applyLayout(p, radialLayout(p));
}

for (const item of catalog) {
  if (item.id === 'showcase') continue; // Its own generator owns the six specialized learning layouts.
  const p = JSON.parse(await fs.readFile(item.path, 'utf8'));
  if (square.has(item.id))
    p.cards.forEach((card, i) => {
      card.size = { width: 260, height: 260 };
      card.position = {
        x: item.id === 'architecture' ? i * 380 : (i % 2) * 380,
        y: item.id === 'architecture' ? 0 : Math.floor(i / 2) * 360,
      };
      card.style = {
        backgroundColor: colors[i % colors.length],
        textColor: '#23332D',
        borderColor: '#B8B488',
      };
      card.extensions ||= {};
      card.extensions['card-atlas:typography'] = {
        title: { fontSize: 20 },
        summary: { fontSize: 14 },
      };
    });
  if (item.id === 'personal') {
    const descriptions = [
      'Capture one thought before deciding where it belongs.',
      'Turn a rough idea into a question you can explore.',
      'Choose one small action you can finish today.',
      'Recall what worked and what you will change next.',
    ];
    p.cards.forEach((card, i) => {
      card.summary = descriptions[i];
    });
  }
  const prompts = {
    journal: [
      [
        'What should I be able to explain without looking?',
        'Write one question you want to answer. Define what a correct explanation must include.',
      ],
      [
        'Keep a source and a short explanation in your own words.',
        'Record the source link or page. Separate a quote from your explanation and list what remains unclear.',
      ],
      [
        'Close the source, try a problem, then check your answer.',
        'Write a practice prompt. Attempt it without notes, compare against the source, and explain any gap.',
      ],
      [
        'Use mistakes to choose the next practice and review date.',
        'Record the mistake, the corrected reasoning, and a new attempt. Choose a manual date to revisit the question.',
      ],
    ],
    roadmap: [
      [
        'Describe one concrete outcome and the evidence of success.',
        'Define who benefits, the deliverable, and observable acceptance criteria. Keep the scope small enough to review.',
      ],
      [
        'Break the outcome into milestones and dependencies.',
        'List the next milestones, their prerequisites, and the main constraint. Pick the first actionable step.',
      ],
      [
        'Work on one small deliverable and record blockers.',
        'Write the next action, the expected result, and any blocker. Attach notes or a compact code example as evidence.',
      ],
      [
        'Compare the result with the goal, then choose an improvement.',
        'Check each acceptance criterion against evidence. Keep feedback, unfinished work, and the next iteration explicit.',
      ],
    ],
  };
  if (prompts[item.id])
    p.cards.forEach((card, i) => {
      card.summary = prompts[item.id][i][0];
      card.content =
        '# ' +
        card.title +
        '\n\n' +
        prompts[item.id][i][1] +
        '\n\n## Your notes\n\n- [ ] Replace this prompt with your own material.';
    });
  for (const card of p.cards)
    card.content = (card.content || '').replaceAll('Card Map', 'Note Board');
  for (const relation of p.relations)
    if (relation.extensions?.['card-atlas:edge']?.route === 'orthogonal') {
      relation.extensions['card-atlas:edge'].modes = {
        ...relation.extensions['card-atlas:edge'].modes,
        card: 'auto',
      };
    }
  p.cards[0].content = (p.cards[0].content || '').split(marker)[0] + guide;
  refreshMindGeometry(p);
  const result = stage(JSON.stringify(p));
  if (result.errors.length) throw Error(item.id + JSON.stringify(result.errors));
  await fs.writeFile(item.path, JSON.stringify(p, null, 2) + '\n');
}

// Geometry-based local thumbnails reflect each entry's initial view.
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c],
  );
for (const item of catalog) {
  const p = JSON.parse(await fs.readFile(item.path, 'utf8'));
  const mind = item.view === 'mind';
  const boxes = new Map(
    p.cards.map((c) => [c.id, { ...geometry(p, c, mind ? 'mind' : 'card'), card: c }]),
  );
  const list = [...boxes.values()];
  const left = Math.min(...list.map((b) => b.position.x)) - 80,
    top = Math.min(...list.map((b) => b.position.y)) - 80;
  const width = Math.max(...list.map((b) => b.position.x + b.size.width)) - left + 80,
    height = Math.max(...list.map((b) => b.position.y + b.size.height)) - top + 80;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="${left} ${top} ${width} ${height}"><rect x="${left}" y="${top}" width="${width}" height="${height}" fill="#f8f5ec"/>`,
  ];
  for (const edge of p.relations) {
    const a = boxes.get(edge.source),
      b = boxes.get(edge.target);
    const x = a.position.x + a.size.width / 2,
      y = a.position.y + a.size.height / 2,
      xx = b.position.x + b.size.width / 2,
      yy = b.position.y + b.size.height / 2;
    svg.push(
      `<path d="M${x},${y} ${mind ? `C${x + (xx - x) * 0.5},${y - 70} ${xx - (xx - x) * 0.5},${yy + 70} ${xx},${yy}` : `L${xx},${yy}`}" fill="none" stroke="#719a88" stroke-width="5"/>`,
    );
  }
  for (const b of list) {
    const c = b.card,
      x = b.position.x,
      y = b.position.y,
      w = b.size.width,
      h = b.size.height;
    const image = c.extensions?.['card-atlas:images']?.[nodeStyle(c).coverImageId];
    const appearance = c.extensions?.['card-atlas:appearance'];
    const fill = mind
      ? '#ffffff'
      : appearance?.backgroundTransparent
        ? 'none'
        : esc(c.style?.backgroundColor || '#FFF2B0');
    const stroke = !mind && appearance?.borderTransparent ? 'none' : '#809f90';
    svg.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${mind ? 22 : 2}" fill="${fill}" stroke="${stroke}" stroke-width="3"/>`,
    );
    if (image)
      svg.push(
        `<image x="${x + 12}" y="${y + 12}" width="${w - 24}" height="${h - 55}" href="data:${image.mimeType};base64,${image.data}"/>`,
      );
    svg.push(
      `<text x="${x + 14}" y="${y + (image ? h - 18 : 38)}" fill="#23332d" font-family="sans-serif" font-size="${Math.min(24, w / 15)}" font-weight="600">${esc(c.title.slice(0, 33))}</text>`,
    );
    if (!mind && !image && h >= 220)
      svg.push(
        `<text x="${x + 14}" y="${y + 78}" fill="#52675d" font-family="sans-serif" font-size="14">${esc((c.summary || '').slice(0, 34))}</text>`,
      );
  }
  svg.push('</svg>');
  await fs.writeFile(item.preview, svg.join('\n') + '\n');
}
console.log('Refreshed', catalog.length, 'library entries and local previews');
