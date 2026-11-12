export const IMAGE_NAMESPACE = 'card-atlas:images';
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DATA_IMAGE_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,/i;
export function validImageAttachment(image) {
  if (
    !image ||
    typeof image !== 'object' ||
    typeof image.name !== 'string' ||
    !image.name.trim() ||
    !IMAGE_MIME_TYPES.includes(image.mimeType) ||
    typeof image.data !== 'string'
  )
    return false;
  const data = image.data;
  if (!data || data.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return false;
  try {
    const head = globalThis.atob(data.slice(0, 64));
    const bytes = Array.from(head, (c) => c.charCodeAt(0));
    if (image.mimeType === 'image/png')
      return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
    if (image.mimeType === 'image/jpeg')
      return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (image.mimeType === 'image/webp')
      return head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP';
    return head.startsWith('GIF87a') || head.startsWith('GIF89a');
  } catch {
    return false;
  }
}
export function attachmentDataURL(image) {
  return validImageAttachment(image) ? 'data:' + image.mimeType + ';base64,' + image.data : null;
}
export function imageAttachmentIssues(card, path) {
  const images = card.extensions?.[IMAGE_NAMESPACE];
  if (images === undefined) return [];
  if (!images || typeof images !== 'object' || Array.isArray(images))
    return [{ path, code: 'imageAttachment' }];
  return Object.entries(images)
    .filter(([id, image]) => !/^[A-Za-z0-9_-]+$/.test(id) || !validImageAttachment(image))
    .map(([id]) => ({ path: path + '.' + id, code: 'imageAttachment' }));
}
export function imageReference(id, name) {
  const alt = name.replace(/[\[\]\\]/g, '\\$&').replace(/[\r\n]/g, ' ');
  return '![' + alt + '](attachment:' + id + ')';
}
/** Converts a base64 image data URL to an attachment; size is checked before decoding. */
export function imageFromDataURL(value, name, maxBytes = MAX_IMAGE_BYTES) {
  const compact = String(value).replace(/[ \t\n\f\r]+/g, '');
  const head = DATA_IMAGE_URL.exec(compact);
  if (!head) return { error: 'imageType' };
  const data = compact.slice(head[0].length);
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  if (Math.floor((data.length * 3) / 4) - padding > maxBytes) return { error: 'imageSize' };
  const image = { name, mimeType: head[1].toLowerCase(), data };
  return validImageAttachment(image) ? { image } : { error: 'imageData' };
}
