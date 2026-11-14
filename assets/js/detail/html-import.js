import { t } from '../i18n/index.js';
import { DOCUMENT, documentHTML, documentIssues } from '../graph/html-document.js';
import { parseDocument } from './html-content.js';
import { MAX_IMAGE_BYTES, imageFromDataURL } from './attachments.js';
import { decodeImage } from './image-file.js';
import { LIMITS } from '../json/validator.js';

const MAX_HTML_BYTES = 1000000;
const DATA_IMAGE_PAYLOAD = /data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=\s]*/gi;
const imageExtension = { 'image/jpeg': 'jpg' };

/** @param {(html: string) => void} insert adds reviewed HTML to the document being edited */
export function createHTMLImport(insert, images) {
  const root = document.createElement('section');
  root.className = 'block-html-import';
  root.hidden = true;
  const heading = document.createElement('strong');
  const label = document.createElement('label');
  const caption = document.createElement('span');
  const source = document.createElement('textarea');
  source.rows = 7;
  source.dataset.htmlSource = '';
  label.append(caption, source);
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.html,.htm,text/html';
  file.dataset.htmlFile = '';
  // The native control cannot be translated, so a labelled button opens it instead.
  file.hidden = true;
  const fileButton = document.createElement('button');
  fileButton.type = 'button';
  fileButton.dataset.htmlFileButton = '';
  fileButton.onclick = () => file.click();
  const review = document.createElement('button');
  review.type = 'button';
  review.dataset.htmlReview = '';
  const result = document.createElement('div');
  result.dataset.htmlResult = '';
  result.hidden = true;
  const warning = document.createElement('p');
  warning.setAttribute('role', 'status');
  const preview = document.createElement('pre');
  preview.dataset.htmlPreview = '';
  result.append(warning, preview);
  const accept = document.createElement('button');
  accept.type = 'button';
  accept.dataset.htmlAccept = '';
  accept.disabled = true;
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.dataset.htmlCancel = '';
  const actions = document.createElement('div');
  actions.className = 'block-html-import-actions';
  actions.append(fileButton, review, accept, cancel);
  root.append(heading, label, file, result, actions);
  let staged = null;
  let stagedImages = {};
  let run = 0;
  const invalidate = () => {
    run += 1;
    staged = null;
    stagedImages = {};
    result.hidden = true;
    accept.disabled = true;
  };
  source.oninput = invalidate;
  const show = () => {
    root.hidden = false;
    source.focus();
  };
  file.onchange = async () => {
    const chosen = file.files[0];
    file.value = '';
    if (!chosen) return;
    if (chosen.size > LIMITS.file) {
      warning.textContent = t('htmlImportTooLarge');
      result.hidden = false;
      accept.disabled = true;
      return;
    }
    source.value = await chosen.text();
    invalidate();
    if (oversize(source.value)) {
      warning.textContent = t('htmlImportTooLarge');
      result.hidden = false;
    }
  };
  const oversize = (text) => {
    const total = new TextEncoder().encode(text).length;
    const payload = new TextEncoder().encode(
      (text.match(DATA_IMAGE_PAYLOAD) || []).join(''),
    ).length;
    return total > LIMITS.file || total - payload > MAX_HTML_BYTES;
  };
  const dataImageHook = (pending) => {
    const ids = new Map();
    return (value, alt) => {
      const compact = value.replace(/\s+/g, '');
      if (ids.has(compact)) return { src: 'attachment:' + ids.get(compact) };
      const name = alt.trim();
      const parsedImage = imageFromDataURL(compact, name || 'image', MAX_IMAGE_BYTES);
      if (!parsedImage.image)
        return {
          removed: t(
            parsedImage.error === 'imageSize'
              ? 'htmlImportImageTooLarge'
              : 'htmlImportImageInvalid',
          ),
        };
      const { image } = parsedImage;
      if (!name)
        image.name = 'image.' + (imageExtension[image.mimeType] || image.mimeType.slice(6));
      const id = 'image-' + window.crypto.randomUUID();
      ids.set(compact, id);
      pending[id] = image;
      return { src: 'attachment:' + id };
    };
  };
  const stage = async () => {
    invalidate();
    const token = run;
    result.hidden = false;
    if (oversize(source.value)) {
      warning.textContent = t('htmlImportTooLarge');
      return;
    }
    const pending = {};
    const parsed = parseDocument(source.value, { dataImage: dataImageHook(pending) });
    const failed = new Set();
    await Promise.all(
      Object.entries(pending).map(([id, image]) => decodeImage(image).catch(() => failed.add(id))),
    );
    if (token !== run) return;
    for (const id of failed) delete pending[id];
    const available = { ...images, ...pending };
    const missing = [];
    const visit = (nodes) => {
      for (const node of nodes) {
        if (typeof node === 'string') continue;
        const id = node.attributes.src?.startsWith('attachment:') && node.attributes.src.slice(11);
        if (node.tag === 'img' && id && (!Object.hasOwn(available, id) || !available[id])) {
          delete node.attributes.src;
          missing.push(failed.has(id) ? t('htmlImportImageInvalid') : 'img src');
        }
        visit(node.children);
      }
    };
    visit(parsed.document.components);
    const removed = [...parsed.removed, ...missing];
    if (
      documentIssues({
        extensions: { [DOCUMENT]: parsed.document, 'card-atlas:images': available },
      }).length
    ) {
      warning.textContent = t('htmlImportInvalid');
      return;
    }
    staged = parsed.document;
    stagedImages = pending;
    const attached = Object.keys(pending).length;
    warning.textContent =
      (removed.length
        ? t('htmlImportRemoved') + ': ' + [...new Set(removed)].join(', ')
        : t('htmlImportClean')) +
      (attached
        ? (removed.length ? '. ' : ' ') +
          t('htmlImportImagesAttached').replace('{count}', String(attached))
        : '');
    preview.textContent = documentHTML(staged);
    accept.disabled = false;
  };
  review.onclick = stage;
  accept.onclick = () => {
    if (!staged) return;
    Object.assign(images, stagedImages);
    insert(documentHTML(staged));
    root.hidden = true;
    source.value = '';
    invalidate();
  };
  cancel.onclick = () => {
    root.hidden = true;
    source.value = '';
    invalidate();
  };
  return {
    root,
    show,
    fromClipboard(html) {
      source.value = html;
      show();
      stage();
    },
    translate() {
      heading.textContent = t('htmlImportTitle');
      caption.textContent = t('htmlImportSource');
      fileButton.textContent = t('htmlImportFile');
      review.textContent = t('htmlImportReview');
      accept.textContent = t('htmlImportAccept');
      cancel.textContent = t('cancel');
      file.setAttribute('aria-label', t('htmlImportFile'));
    },
  };
}
