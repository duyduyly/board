import { download } from '../common/download.js';
import { filename } from '../json/validator.js';
import { brandLogo, wordLabels } from '../word-export/browser.js';
import { buildMarkdownZip, ZIP_MIME } from './index.js';

export async function exportMarkdownFile(project, { view }) {
  const name = filename(project.metadata.title).replace(/\.json$/, '');
  const { bytes, skippedImages } = buildMarkdownZip(project, {
    view,
    labels: wordLabels(),
    name,
    logo: await brandLogo(),
  });
  download(bytes, name + '.zip', ZIP_MIME);
  return { skippedImages };
}
