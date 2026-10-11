import { t } from '../i18n/index.js';
export function captureEditor(host) {
  const fields = [...host.querySelectorAll('[name]')].map((el) => ({
    name: el.name,
    start: el.selectionStart,
    end: el.selectionEnd,
    top: el.scrollTop,
    left: el.scrollLeft,
  }));
  return { fields, top: host.scrollTop, metadata: host.querySelector('.editor-metadata')?.open };
}
export function restoreEditor(host, state) {
  if (!state) return;
  for (const field of state.fields) {
    const el = host.querySelector('[name="' + CSS.escape(field.name) + '"]');
    if (!el) continue;
    if (typeof field.start === 'number') el.setSelectionRange(field.start, field.end);
    el.scrollTop = field.top;
    el.scrollLeft = field.left;
  }
  if (host.querySelector('.editor-metadata') && state.metadata !== undefined)
    host.querySelector('.editor-metadata').open = state.metadata;
  host.scrollTop = state.top;
}
export function addContents(host) {
  const headings = [...host.querySelectorAll('h1,h2,h3')].filter((h) => !h.closest('.diagram'));
  if (headings.length < 2) return;
  const nav = document.createElement('details');
  nav.className = 'document-contents';
  nav.open = true;
  const summary = document.createElement('summary');
  summary.textContent = t('contents');
  nav.append(summary);
  headings.forEach((h, index) => {
    h.id = 'document-heading-' + index;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = h.textContent;
    button.className = 'heading-' + h.tagName.toLowerCase();
    button.onclick = () => h.scrollIntoView({ block: 'start', behavior: 'smooth' });
    nav.append(button);
  });
  host.prepend(nav);
}
export function template(kind) {
  const vi = document.documentElement.lang === 'vi';
  const titles = vi
    ? {
        guide: ['Hướng dẫn', 'Mục tiêu', 'Điều kiện chuẩn bị', 'Các bước', 'Kiểm tra kết quả'],
        api: ['API', 'Mục đích', 'Request', 'Response', 'Lỗi thường gặp'],
        note: ['Ghi chú', 'Bối cảnh', 'Nội dung', 'Kết luận', 'Tham khảo'],
      }
    : {
        guide: ['Guide', 'Goal', 'Prerequisites', 'Steps', 'Verify results'],
        api: ['API', 'Purpose', 'Request', 'Response', 'Common errors'],
        note: ['Note', 'Context', 'Details', 'Conclusion', 'References'],
      };
  return (
    '\n\n# ' +
    titles[kind][0] +
    '\n\n' +
    titles[kind]
      .slice(1)
      .map((title) => '## ' + title + '\n\n')
      .join('')
  );
}
export function markdownDocument(card) {
  let body = card.content || '';
  const images = card.extensions?.['card-atlas:images'] || {};
  let size = body.length;
  body = body.replace(/attachment:([A-Za-z0-9_-]+)/g, (all, id) => {
    if (!images[id]) return all;
    const value = 'data:' + images[id].mimeType + ';base64,' + images[id].data;
    size += value.length - all.length;
    if (size > 10 * 1024 * 1024) throw new Error('Markdown image size');
    return value;
  });
  return '# ' + card.title + '\n\n' + (card.summary ? card.summary + '\n\n' : '') + body + '\n';
}
