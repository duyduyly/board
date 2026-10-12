import { escapeHTML as esc } from '../common/html.js';
import { downloadAsset } from '../common/download.js';
import { t } from '../i18n/index.js';
export function createFormatGuide({ dialog, toast }) {
  async function formatGuide() {
    const body = () => {
      const div = document.createElement('div');
      div.innerHTML =
        '<p>' +
        esc(t('formatBody')) +
        '</p><div class="guide-actions"><button id="schema-download">' +
        esc(t('downloadSchema')) +
        '</button><button id="example-download">' +
        esc(t('downloadExample')) +
        '</button><button id="mind-example-download">' +
        esc(t('mindExample')) +
        '</button><button id="copy-ai">' +
        esc(t('copyInstructions')) +
        '</button></div><pre>' +
        esc(t('aiGuide')) +
        '</pre><p>' +
        esc(t('mindGuide')) +
        '</p><p>' +
        esc(t('radialGuide')) +
        '</p><p>' +
        esc(t('transferGuide')) +
        '</p><div class="guide-actions"><button id="node-example-download">' +
        esc(t('transferExample')) +
        '</button><button id="shapes-example-download">' +
        esc(t('basicShapesExample')) +
        '</button><button id="extended-shapes-example-download">' +
        esc(t('extendedShapesExample')) +
        '</button></div>';
      for (const [selector, path, name] of [
        [
          '#extended-shapes-example-download',
          'assets/data/mixed-shapes-example.json',
          'mixed-shapes-example.json',
        ],
        [
          '#shapes-example-download',
          'assets/data/basic-shapes-example.json',
          'basic-shapes-example.json',
        ],
        ['#node-example-download', 'assets/data/node-transfer-example.json', 'example.node.json'],
        ['#mind-example-download', 'assets/data/mind-map-example.json', 'mind-map-example.json'],
        ['#schema-download', 'assets/data/project.schema.json', 'card-atlas.schema.json'],
        ['#example-download', 'assets/data/example.json', 'example-project.json'],
      ])
        div.querySelector(selector).onclick = async () => {
          try {
            await downloadAsset(path, name);
          } catch {
            toast('errorRead');
          }
        };
      div.querySelector('#copy-ai').onclick = async () => {
        try {
          await navigator.clipboard.writeText(t('aiGuide'));
          toast('copied');
        } catch {
          toast('copyFailed');
        }
      };
      return div;
    };
    await dialog('format', body, [['close', 'cancel']]);
  }
  return formatGuide;
}
