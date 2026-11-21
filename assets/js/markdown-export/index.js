import { wordDocument } from '../word-export/model.js';
import { collectImages } from '../word-export/index.js';
import { decodeBase64 } from '../word-export/media.js';
import { zipStore } from '../word-export/zip.js';
import { markdownDocument } from './markdown.js';

export const ZIP_MIME = 'application/zip';

const IMAGE_DIR = 'images/';
const LOGO_PATH = IMAGE_DIR + 'card-atlas-logo.png';
const IMAGE_NUMBER_DIGITS = 3;
const EXTENSIONS = /** @type {Record<string, string>} */ ({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
});
const encoder = new TextEncoder();

/**
 * Builds a .zip holding `<name>.md` and an `images/` folder with the attached images and the
 * board logo. The same document model as the Word export decides order, headings and links. Pure.
 * @param {any} project
 * @param {{ view?: 'card' | 'mind', labels: any, name: string, logo?: { bytes: Uint8Array } | null }} options
 * @returns {{ bytes: Uint8Array, skippedImages: number }}
 */
export function buildMarkdownZip(project, { view, labels, name, logo = null }) {
  const model = wordDocument(project, { view, labels });
  /** @type {Map<string, string>} */
  const paths = new Map();
  const images = [];
  for (const [key, image] of collectImages(model.blocks)) {
    const extension = EXTENSIONS[image.mimeType];
    if (!extension) continue;
    let bytes;
    try {
      bytes = decodeBase64(image.data);
    } catch {
      continue;
    }
    const number = String(paths.size + 1).padStart(IMAGE_NUMBER_DIGITS, '0');
    const path = IMAGE_DIR + 'image-' + number + '.' + extension;
    paths.set(key, path);
    images.push({ name: path, data: bytes });
  }
  const { text, skippedImages } = markdownDocument(model, {
    images: paths,
    logoPath: logo ? LOGO_PATH : null,
  });
  const files = [
    { name: name + '.md', data: encoder.encode(text) },
    ...(logo ? [{ name: LOGO_PATH, data: logo.bytes }] : []),
    ...images,
  ];
  return { bytes: zipStore(files), skippedImages };
}
