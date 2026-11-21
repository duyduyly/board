import { wordDocument } from './model.js';
import { docxParts } from './ooxml.js';
import { decodeBase64 } from './media.js';
import { zipStore } from './zip.js';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const EMBEDDABLE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif']);
const PNG_MIME_TYPE = 'image/png';

/**
 * @typedef {{ mimeType: string, bytes: Uint8Array }} ImageSource
 * @typedef {(bytes: Uint8Array, mimeType: string) => Promise<Uint8Array | null>} Transcode
 */

/** Every inline image of the model, once per key, wherever it is nested. @param {unknown} node */
export function collectImages(node, found = new Map()) {
  if (Array.isArray(node)) {
    for (const child of node) collectImages(child, found);
  } else if (node && typeof node === 'object') {
    const value = /** @type {Record<string, any>} */ (node);
    if (value.type === 'image' && typeof value.key === 'string') {
      if (!found.has(value.key)) found.set(value.key, value);
    } else {
      for (const child of Object.values(value)) collectImages(child, found);
    }
  }
  return found;
}

/** @returns {Promise<ImageSource | null>} null when the image cannot be embedded */
async function imageSource(image, transcode) {
  let bytes;
  try {
    bytes = decodeBase64(image.data);
  } catch {
    return null;
  }
  if (EMBEDDABLE_MIME_TYPES.has(image.mimeType)) return { mimeType: image.mimeType, bytes };
  if (!transcode) return null;
  try {
    const png = await transcode(bytes, image.mimeType);
    return png instanceof Uint8Array ? { mimeType: PNG_MIME_TYPE, bytes: png } : null;
  } catch {
    return null;
  }
}

/**
 * Builds the .docx bytes for a project. Pure: the caller supplies the browser-only transcoder.
 * @param {any} project
 * @param {{ view?: 'card' | 'mind', labels: any, transcode?: Transcode | null, logo?: ImageSource | null }} options
 * @returns {Promise<{ bytes: Uint8Array, skippedImages: number }>}
 */
export async function buildDocx(project, { view, labels, transcode = null, logo = null }) {
  const model = wordDocument(project, { view, labels });
  const images = new Map();
  for (const [key, image] of collectImages(model.blocks)) {
    const source = await imageSource(image, transcode);
    if (source) images.set(key, source);
  }
  const { files, skippedImages } = docxParts(model, { images, logo });
  return { bytes: zipStore(files), skippedImages };
}
