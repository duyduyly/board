import { t } from '../i18n/index.js';
import { download } from '../common/download.js';
import { filename } from '../json/validator.js';
import { buildDocx, DOCX_MIME } from './index.js';

export function wordLabels() {
  return {
    ungrouped: t('wordUngrouped'),
    links: t('wordLinks'),
    type: t('wordType'),
    tags: t('wordTags'),
    legacySource: t('wordLegacySource'),
    mermaidSource: t('wordMermaidSource'),
    remoteImage: t('wordRemoteImage'),
    image: t('wordImage'),
    group: t('wordGroup'),
    contents: t('wordContents'),
    contentsHint: t('wordContentsHint'),
    contentsTip: t('wordContentsTip'),
  };
}

// Word cannot embed WebP, so it is re-encoded to PNG locally; a failure drops only that image.
async function transcodeToPng(bytes, mimeType) {
  try {
    const bitmap = await window.createImageBitmap(new Blob([bytes], { type: mimeType }));
    try {
      const canvas =
        typeof window.OffscreenCanvas === 'function'
          ? new window.OffscreenCanvas(bitmap.width, bitmap.height)
          : Object.assign(document.createElement('canvas'), {
              width: bitmap.width,
              height: bitmap.height,
            });
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      const blob = canvas.convertToBlob
        ? await canvas.convertToBlob({ type: 'image/png' })
        : await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

const LOGO_URL = new URL('../../images/brand/logo-word.png', import.meta.url);
/** @type {Promise<{ mimeType: string, bytes: Uint8Array } | null> | null} */
let logoPromise = null;

// Same-origin brand logo; the export still succeeds without it.
async function loadLogo() {
  try {
    const response = await fetch(LOGO_URL);
    if (!response.ok) return null;
    return { mimeType: 'image/png', bytes: new Uint8Array(await response.arrayBuffer()) };
  } catch {
    return null;
  }
}

export function brandLogo() {
  logoPromise ??= loadLogo().then((logo) => {
    if (!logo) logoPromise = null;
    return logo;
  });
  return logoPromise;
}

export async function exportWordFile(project, { view }) {
  const { bytes, skippedImages } = await buildDocx(project, {
    view,
    labels: wordLabels(),
    transcode: transcodeToPng,
    logo: await brandLogo(),
  });
  download(bytes, filename(project.metadata.title).replace(/\.json$/, '.docx'), DOCX_MIME);
  return { skippedImages };
}
