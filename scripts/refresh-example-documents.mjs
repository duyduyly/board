// Refreshes the gallery examples in place: adds one "Detail components" note that shows every
// document element the reader supports and updates the stale workspace guide. Idempotent.
// Usage: node scripts/refresh-example-documents.mjs
import fs from 'node:fs/promises';
import { stage } from '../assets/js/json/validator.js';
import { DOCUMENT, documentText } from '../assets/js/graph/html-document.js';

const SHOWCASE_ID_SUFFIX = '-detail-components';
const IMAGE_ID = 'board-logo';
const GAP = 80;
// "Me at the zoo": the first YouTube upload, a long-lived public video. Plays only after a click.
const VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const VIETNAMESE = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

const h = (tag, attributes = {}, ...children) => ({ tag, attributes, children: children.flat() });

const GUIDE = [
  'Note Board: select a note, then use Format on the right for text, tags, paper and arrows. Page settings apply only to existing unlocked elements.',
  'Double-click a note or use ↗ to read it. The reading tab has a contents rail, A−/A+ text size and ◐ theme; Edit opens the HTML block editor with a library of ready-made elements.',
  'Documents support Bootstrap tables, alerts, cards and columns, highlighted code, Mermaid diagrams, click-to-play YouTube video and attached images; open the "Detail components" note for a live sample.',
  'Groups: select notes and group them. A group can carry a description, receive arrows and nest up to three levels.',
  'Convert to Mind Map: choose a root note; outgoing links become branches, extra/cycle links stay references. Note Board positions remain unchanged.',
  'Mind Map: compact text/image nodes and curved branches. Double-click opens the same content. Use Arrange Mind Map for a layout preview.',
  'Ctrl+C / Ctrl+V copy and paste notes. The Export menu saves project JSON (re-importable), Word (.docx) or Markdown (.zip) for reading and printing.',
  'Apply saves and shows success feedback. Undo reverses a command. Export JSON to keep your work; examples are fresh copies when reopened.',
];

const TEXT = {
  en: {
    title: 'Detail components',
    summary: 'Every element a note document can show: open it to see the reader.',
    lead: 'A sample of every element the reader supports. Edit it, or copy pieces into your own notes.',
    text: 'Text and inline styles',
    inline: [
      'Body text with ',
      h('strong', {}, 'bold'),
      ', ',
      h('em', {}, 'italic'),
      ', ',
      h('u', {}, 'underline'),
      ', ',
      h('s', {}, 'strikethrough'),
      ', H',
      h('sub', {}, '2'),
      'O, x',
      h('sup', {}, '2'),
      ', inline ',
      h('code', {}, 'code'),
      ' and a ',
      h('a', { href: '#lists' }, 'link'),
      '.',
    ],
    quote: 'Good notes explain why, not only what.',
    lists: 'Lists',
    bullets: ['Capture the idea', 'Add one example', 'Link related notes'],
    nested: ['Nested item', 'Another level'],
    steps: ['Read', 'Summarise', 'Review later'],
    callouts: 'Callouts',
    info: ['💡 Tip: ', 'use alerts to highlight one key idea.'],
    warning: ['⚠️ Common mistake: ', 'a callout for every paragraph hides the important one.'],
    success: ['✅ Summary: ', 'keep callouts short.'],
    table: 'Table',
    caption: 'Plan by week',
    head: ['Item', 'Owner', 'Status'],
    rows: [
      ['Outline', 'An', 'Done'],
      ['Draft', 'Bình', 'In progress'],
    ],
    merged: 'Merged cell across two columns',
    cards: 'Cards and columns',
    cardA: ['Do', 'Write one idea per note.'],
    cardB: ["Don't", 'Paste a whole chapter into one note.'],
    listGroup: ['Read the brief', 'Agree on scope'],
    code: 'Code',
    diagram: 'Mermaid diagram',
    mermaid:
      'flowchart LR\n  A["Capture"] --> B{"Clear?"}\n  B -->|yes| C["Link notes"]\n  B -->|no| D["Rewrite"]\n  D --> B',
    video: 'Video',
    videoLink: 'Play the sample video (needs internet)',
    image: 'Image',
    imageCaption: 'An image attached to this note, stored inside the project JSON.',
    styled: 'Utility classes and inline style',
    box: 'Theme box with Bootstrap utility classes.',
    inlineBox: 'Paragraph with a simple inline style.',
  },
  vi: {
    title: 'Thành phần Detail',
    summary: 'Mọi phần tử tài liệu của note có thể hiển thị: mở để xem tab đọc.',
    lead: 'Mẫu của mọi phần tử mà tab đọc hỗ trợ. Hãy sửa thử hoặc chép từng phần sang note của bạn.',
    text: 'Chữ và định dạng trong dòng',
    inline: [
      'Văn bản có ',
      h('strong', {}, 'in đậm'),
      ', ',
      h('em', {}, 'in nghiêng'),
      ', ',
      h('u', {}, 'gạch chân'),
      ', ',
      h('s', {}, 'gạch ngang'),
      ', H',
      h('sub', {}, '2'),
      'O, x',
      h('sup', {}, '2'),
      ', ',
      h('code', {}, 'code'),
      ' và một ',
      h('a', { href: '#lists' }, 'liên kết'),
      '.',
    ],
    quote: 'Ghi chú tốt giải thích vì sao, không chỉ là cái gì.',
    lists: 'Danh sách',
    bullets: ['Ghi lại ý tưởng', 'Thêm một ví dụ', 'Nối với note liên quan'],
    nested: ['Mục lồng nhau', 'Thêm một cấp'],
    steps: ['Đọc', 'Tóm tắt', 'Ôn lại sau'],
    callouts: 'Hộp nhấn mạnh',
    info: ['💡 Mẹo: ', 'dùng alert để làm nổi một ý chính.'],
    warning: ['⚠️ Lỗi hay gặp: ', 'đoạn nào cũng đặt hộp thì ý quan trọng bị chìm.'],
    success: ['✅ Tóm lại: ', 'giữ hộp nhấn mạnh ngắn gọn.'],
    table: 'Bảng',
    caption: 'Kế hoạch theo tuần',
    head: ['Hạng mục', 'Phụ trách', 'Trạng thái'],
    rows: [
      ['Dàn ý', 'An', 'Xong'],
      ['Bản nháp', 'Bình', 'Đang làm'],
    ],
    merged: 'Ô gộp qua hai cột',
    cards: 'Thẻ và cột',
    cardA: ['Nên', 'Mỗi note một ý.'],
    cardB: ['Không nên', 'Dán cả một chương vào một note.'],
    listGroup: ['Đọc yêu cầu', 'Thống nhất phạm vi'],
    code: 'Code',
    diagram: 'Sơ đồ Mermaid',
    mermaid:
      'flowchart LR\n  A["Ghi lại"] --> B{"Đã rõ?"}\n  B -->|có| C["Nối note"]\n  B -->|chưa| D["Viết lại"]\n  D --> B',
    video: 'Video',
    videoLink: 'Phát video mẫu (cần internet)',
    image: 'Hình ảnh',
    imageCaption: 'Ảnh đính kèm note, lưu ngay trong file JSON của dự án.',
    styled: 'Class tiện ích và style trong dòng',
    box: 'Hộp màu theo theme bằng class tiện ích Bootstrap.',
    inlineBox: 'Đoạn văn có style đơn giản trong dòng.',
  },
};

function showcaseDocument(x) {
  const cell = (tag, text, attributes = {}) => h(tag, attributes, text);
  const card = ([title, body], border) =>
    h(
      'div',
      { class: 'col-md-6' },
      h(
        'div',
        { class: 'card h-100 ' + border },
        h(
          'div',
          { class: 'card-body' },
          h('h5', { class: 'card-title' }, title),
          h('p', { class: 'card-text mb-0' }, body),
        ),
      ),
    );
  return {
    version: 1,
    format: 'html-bs5',
    components: [
      h('h1', {}, x.title),
      h('p', { class: 'lead' }, x.lead),
      h('h2', {}, x.text),
      h('p', {}, x.inline),
      h('blockquote', {}, h('p', {}, x.quote)),
      h('h2', {}, x.lists),
      h(
        'ul',
        {},
        x.bullets.map((item, i) =>
          i === 1
            ? h(
                'li',
                {},
                item,
                h(
                  'ul',
                  {},
                  x.nested.map((n) => h('li', {}, n)),
                ),
              )
            : h('li', {}, item),
        ),
      ),
      h(
        'ol',
        {},
        x.steps.map((item) => h('li', {}, item)),
      ),
      h('h2', {}, x.callouts),
      h('div', { class: 'alert alert-info' }, h('strong', {}, x.info[0]), x.info[1]),
      h('div', { class: 'alert alert-warning' }, h('strong', {}, x.warning[0]), x.warning[1]),
      h('div', { class: 'alert alert-success' }, h('strong', {}, x.success[0]), x.success[1]),
      h('h2', {}, x.table),
      h(
        'table',
        {},
        h('caption', {}, x.caption),
        h(
          'thead',
          {},
          h(
            'tr',
            {},
            x.head.map((text) => cell('th', text, { scope: 'col' })),
          ),
        ),
        h(
          'tbody',
          {},
          x.rows.map(([first, ...rest]) =>
            h(
              'tr',
              {},
              cell('th', first, { scope: 'row' }),
              rest.map((t) => cell('td', t)),
            ),
          ),
          h('tr', {}, cell('td', x.merged, { colspan: '2' }), cell('td', '—')),
        ),
      ),
      h(
        'table',
        { class: 'table table-bordered table-sm' },
        h(
          'thead',
          { class: 'table-light' },
          h(
            'tr',
            {},
            x.head.map((text) => cell('th', text, { scope: 'col' })),
          ),
        ),
        h(
          'tbody',
          {},
          x.rows.map((row) =>
            h(
              'tr',
              {},
              row.map((t) => cell('td', t)),
            ),
          ),
        ),
      ),
      h('h2', {}, x.cards),
      h(
        'div',
        { class: 'row g-3 mb-3' },
        card(x.cardA, 'border-success-subtle'),
        card(x.cardB, 'border-danger-subtle'),
      ),
      h(
        'ul',
        { class: 'list-group mb-3' },
        x.listGroup.map((item, i) =>
          h(
            'li',
            { class: 'list-group-item' },
            h('span', { class: 'badge text-bg-primary me-2' }, String(i + 1)),
            item,
          ),
        ),
      ),
      h('h2', {}, x.code),
      h(
        'pre',
        {},
        h(
          'code',
          { class: 'language-javascript' },
          'const notes = cards.filter((card) => card.tags.includes("review"));\nconsole.log(notes.length);',
        ),
      ),
      h(
        'pre',
        {},
        h('code', { class: 'language-json' }, '{ "title": "Inbox", "tags": ["personal"] }'),
      ),
      h('h2', {}, x.diagram),
      h('pre', {}, h('code', { class: 'language-mermaid' }, x.mermaid)),
      h('h2', {}, x.video),
      h('p', {}, h('a', { class: 'board-video', href: VIDEO_URL }, x.videoLink)),
      h('h2', {}, x.image),
      h(
        'figure',
        { class: 'text-center' },
        h('img', {
          class: 'img-fluid rounded',
          src: 'attachment:' + IMAGE_ID,
          alt: 'Card Atlas logo',
        }),
        h('figcaption', { class: 'small text-body-secondary' }, x.imageCaption),
      ),
      h('h2', {}, x.styled),
      h(
        'div',
        {
          class:
            'p-3 mb-3 rounded border border-success-subtle bg-success-subtle text-success-emphasis',
        },
        x.box,
      ),
      h('p', { style: 'background-color:#e3f0e9;color:#255c49;padding:12px' }, x.inlineBox),
    ],
  };
}

function refreshGuide(doc) {
  const components = doc.components;
  const at = components.findIndex((n) => n.tag === 'h2' && n.children[0] === 'Workspace guide');
  if (at >= 0 && components[at + 1]?.tag === 'ul')
    components[at + 1] = h(
      'ul',
      {},
      GUIDE.map((item) => h('li', {}, item)),
    );
  // Markdown-era task markers were imported as literal "[ ] " text.
  const fixMarkers = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.tag === 'li' && node.children[0] === '[ ] ') node.children.splice(0, 1, '☐ ');
    node.children?.forEach(fixMarkers);
  };
  components.forEach(fixMarkers);
  return at >= 0;
}

const right = (boxes) => Math.max(...boxes.map((b) => b.x + b.width / 2));
const top = (boxes) => Math.min(...boxes.map((b) => b.y - b.height / 2));

const logo = (await fs.readFile('assets/images/brand/logo-word.png')).toString('base64');
const catalog = JSON.parse(await fs.readFile('assets/data/template-catalog.json', 'utf8'));
for (const entry of catalog) {
  const project = JSON.parse(await fs.readFile(entry.path, 'utf8'));
  const guideCard = project.cards.find(
    (c) => c.extensions?.[DOCUMENT] && refreshGuide(c.extensions[DOCUMENT]),
  );
  for (const c of project.cards)
    if (c.extensions?.[DOCUMENT]) c.content = documentText(c.extensions[DOCUMENT]);

  const base = guideCard ?? project.cards[0];
  const id = base.id + SHOWCASE_ID_SUFFIX;
  project.cards = project.cards.filter((c) => c.id !== id);
  const language = VIETNAMESE.test(project.cards.map((c) => c.title).join(' ')) ? 'vi' : 'en';
  const x = TEXT[language];
  const size = { ...base.size };
  const boxes = project.cards.map((c) => ({ ...c.position, ...c.size }));
  const doc = showcaseDocument(x);
  project.cards.push({
    id,
    title: x.title,
    summary: x.summary,
    type: 'note',
    tags: ['example'],
    position: { x: right(boxes) + GAP + size.width / 2, y: top(boxes) + size.height / 2 },
    size,
    style: { ...base.style },
    content: documentText(doc),
    extensions: {
      ...(base.extensions['card-atlas:typography'] && {
        'card-atlas:typography': base.extensions['card-atlas:typography'],
      }),
      ...(base.extensions['card-atlas:node'] && { 'card-atlas:node': { kind: 'card' } }),
      [DOCUMENT]: doc,
      'card-atlas:images': {
        [IMAGE_ID]: { name: 'card-atlas-logo.png', mimeType: 'image/png', data: logo },
      },
    },
  });

  // In a Mind Map board a loose note would show as detached, so hang the sample off the root.
  const branchId = 'branch-' + id;
  project.relations = project.relations.filter((r) => r.id !== branchId);
  const mind = project.extensions?.['card-atlas:views']?.mindMap;
  const rootId = project.extensions?.['card-atlas:mind-map']?.rootId;
  if (mind?.positions && rootId)
    project.relations.push({
      id: branchId,
      source: rootId,
      target: id,
      label: '',
      extensions: { 'card-atlas:mind-map': { kind: 'branch' } },
    });
  if (mind?.positions) {
    const sizes = mind.sizes ?? {};
    const mindBoxes = Object.entries(mind.positions).map(([key, p]) => ({
      ...p,
      ...(sizes[key] ?? { width: 280, height: 140 }),
    }));
    const mindSize = sizes[base.id] ?? { width: 280, height: 140 };
    delete mind.positions[id];
    mind.positions[id] = {
      x: right(mindBoxes) + GAP + mindSize.width / 2,
      y: top(mindBoxes) + mindSize.height / 2,
    };
    mind.sizes = { ...sizes, [id]: mindSize };
  } else if (mind?.sizes) mind.sizes[id] = mind.sizes[base.id] ?? { width: 280, height: 140 };

  const result = stage(JSON.stringify(project));
  if (result.errors.length)
    throw new Error(entry.path + ': ' + JSON.stringify(result.errors?.slice(0, 3)));
  await fs.writeFile(entry.path, JSON.stringify(project, null, 2) + '\n');
  console.log(entry.id, language, guideCard ? 'guide updated' : 'no guide', '+', id);
}
