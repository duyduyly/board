import { t } from '../i18n/index.js';
let preview = null,
  source = null,
  timer = null,
  dismissed = null,
  pointer = { x: 0, y: 0 },
  dismissedAt = null;
export function closeImagePreview() {
  clearTimeout(timer);
  preview?.remove();
  preview = null;
  source = null;
}
function dismiss() {
  dismissed = source;
  dismissedAt = { ...pointer };
  closeImagePreview();
}
function deferClose() {
  clearTimeout(timer);
  timer = setTimeout(closeImagePreview, 180);
}
function show(image) {
  if (!image.complete || !image.naturalWidth || source === image || dismissed === image) return;
  closeImagePreview();
  source = image;
  preview = document.createElement('section');
  preview.className = 'image-preview';
  preview.setAttribute('role', 'region');
  preview.setAttribute('aria-label', t('imagePreview'));
  const header = document.createElement('div');
  header.className = 'image-preview-header';
  const label = document.createElement('span');
  label.textContent = t('imagePreviewHint');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', t('close'));
  close.onclick = dismiss;
  header.append(label, close);
  const frame = document.createElement('div');
  frame.className = 'image-preview-frame';
  const copy = image.cloneNode(false);
  copy.className = 'image-preview-image';
  copy.removeAttribute('tabindex');
  copy.removeAttribute('aria-label');
  copy.loading = 'eager';
  copy.style.width = image.naturalWidth + 'px';
  copy.style.height = image.naturalHeight + 'px';
  frame.append(copy);
  preview.append(header, frame);
  document.body.append(preview);
  const width = Math.min(image.naturalWidth, window.innerWidth - 40);
  const height = Math.min(image.naturalHeight, window.innerHeight - 110);
  frame.style.width = width + 'px';
  frame.style.height = height + 'px';
  const rect = image.getBoundingClientRect();
  preview.style.left = Math.max(16, rect.left - width - 18) + 'px';
  preview.style.top = Math.max(16, Math.min(rect.top, window.innerHeight - height - 72)) + 'px';
  preview.onpointerenter = () => clearTimeout(timer);
  preview.onpointerleave = deferClose;
}
export function installImagePreview(host) {
  host.addEventListener(
    'load',
    (event) => {
      const image = event.target;
      if (
        image.matches?.('.markdown img') &&
        (image.matches(':hover') || document.activeElement === image)
      )
        show(image);
    },
    true,
  );
  document.addEventListener('pointermove', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    if (
      dismissed &&
      dismissedAt &&
      Math.hypot(pointer.x - dismissedAt.x, pointer.y - dismissedAt.y) > 4 &&
      event.target !== dismissed
    )
      dismissed = null;
  });
  host.addEventListener('pointerover', (event) => {
    const image = event.target.closest('.markdown img');
    if (image) {
      clearTimeout(timer);
      show(image);
    }
  });
  host.addEventListener('pointerout', (event) => {
    if (event.target === source && !preview?.contains(event.relatedTarget)) deferClose();
  });
  host.addEventListener('focusin', (event) => {
    if (event.target.matches('.markdown img')) show(event.target);
  });
  host.addEventListener('focusout', (event) => {
    if (event.target === source && !preview?.contains(event.relatedTarget)) deferClose();
  });
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && preview) {
        event.preventDefault();
        event.stopImmediatePropagation();
        dismiss();
      }
    },
    true,
  );
  document.addEventListener(
    'scroll',
    (event) => {
      if (preview && event.target !== preview && !preview.contains(event.target))
        closeImagePreview();
    },
    true,
  );
  window.addEventListener('resize', closeImagePreview);
}
