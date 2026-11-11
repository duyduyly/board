import { t } from '../i18n/index.js';
import { escapeHTML } from '../common/html.js';
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
export function documentHeadings(host) {
  const headings = [...host.querySelectorAll('h1,h2,h3')].filter((h) => !h.closest('.diagram'));
  headings.forEach((h, index) => {
    h.id = 'document-heading-' + index;
  });
  return headings;
}
export function addContents(host) {
  const headings = documentHeadings(host);
  if (headings.length < 2) return;
  const nav = document.createElement('details');
  nav.className = 'document-contents';
  nav.open = true;
  const summary = document.createElement('summary');
  summary.textContent = t('contents');
  nav.append(summary);
  headings.forEach((h) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = h.textContent;
    button.className = 'heading-' + h.tagName.toLowerCase();
    button.onclick = () => h.scrollIntoView({ block: 'start', behavior: 'smooth' });
    nav.append(button);
  });
  host.prepend(nav);
}
function templateTitles(kind) {
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
  return titles[kind];
}
export function htmlTemplate(kind) {
  const titles = templateTitles(kind);
  if (!titles) return '';
  return (
    '<h1>' +
    escapeHTML(titles[0]) +
    '</h1>' +
    titles
      .slice(1)
      .map((title) => '<h2>' + escapeHTML(title) + '</h2><p>...</p>')
      .join('')
  );
}
