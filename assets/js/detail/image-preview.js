import { t } from '../i18n/index.js';
import { dialogSurface } from '../ui/dialog-surface.js';
let preview = null,
  source = null,
  surface = null;
export function closeImagePreview() {
  surface?.close();
  preview?.remove();
  preview = null;
  source = null;
  surface = null;
}
function show(image) {
  if (!image.complete || !image.naturalWidth || !image.currentSrc) return;
  if (source === image) return;
  closeImagePreview();
  source = image;
  preview = document.createElement('dialog');
  preview.className = 'image-preview';
  preview.setAttribute('aria-label', t('imagePreview'));
  const header = document.createElement('div');
  header.className = 'image-preview-header';
  const label = document.createElement('span');
  label.textContent = image.alt || t('imagePreview');
  const fit = document.createElement('button');
  fit.textContent = t('imageFitView');
  const actual = document.createElement('button');
  actual.textContent = '100%';
  actual.setAttribute('aria-label', t('imageActualSize'));
  const close = document.createElement('button');
  close.textContent = '×';
  close.setAttribute('aria-label', t('close'));
  const frame = document.createElement('div');
  frame.className = 'image-preview-frame';
  frame.tabIndex = 0;
  frame.setAttribute('aria-label', t('imagePreview'));
  const copy = document.createElement('img');
  copy.className = 'image-preview-image';
  copy.alt = image.alt;
  copy.src = image.currentSrc;
  copy.width = image.naturalWidth;
  copy.height = image.naturalHeight;
  const mode = (full) => {
    preview.classList.toggle('actual-size', full);
    fit.setAttribute('aria-pressed', String(!full));
    actual.setAttribute('aria-pressed', String(full));
    frame.scrollTop = 0;
    frame.scrollLeft = 0;
  };
  fit.onclick = () => mode(false);
  actual.onclick = () => mode(true);
  close.onclick = closeImagePreview;
  copy.onerror = () => {
    frame.textContent = t('errorImageAttachment');
  };
  frame.append(copy);
  header.append(label, fit, actual, close);
  preview.append(header, frame);
  document.body.append(preview);
  surface = dialogSurface(preview, {
    onRequestClose: closeImagePreview,
    fallback: () => document.querySelector('#panel-title'),
  });
  mode(false);
  surface.show(close);
}
export function installImagePreview(host) {
  const enhance = () => {
    for (const image of host.querySelectorAll('.markdown img')) {
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', t('openImage') + ': ' + (image.alt || t('imagePreview')));
    }
  };
  new window.MutationObserver(enhance).observe(host, { childList: true, subtree: true });
  host.addEventListener('click', (e) => {
    const image = e.target.closest('.markdown img');
    if (image) show(image);
  });
  host.addEventListener('keydown', (e) => {
    if (e.target.matches('.markdown img') && ['Enter', ' '].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      show(e.target);
    }
  });
}
