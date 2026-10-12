import { escapeHTML as esc } from '../common/html.js';
import { download } from '../common/download.js';
import { t, issueMessage, dictionaries, getLocale } from '../i18n/index.js';
import { filename, LIMITS } from '../json/validator.js';
import { renderMarkdown } from '../detail/markdown.js';
import { IMAGE_NAMESPACE, attachmentDataURL } from '../detail/attachments.js';
import { decodeDocument, stageMarkdown, markdownCandidate } from '../detail/markdown-import.js';
import {
  assertProject,
  nodeFile,
  stageNode,
  excludedProjectNamespaces,
  extensionConflicts,
  mergeNode,
  updateNodeProject,
  addNodeProject,
  transferError,
} from '../json/node-transfer.js';

// Owns file/preview UI only. Session drafts, geometry and commands stay behind ports.
export function createDocumentTransfer({ context, isCurrent, useDraft, addNode, dialog, toast }) {
  let busy = false;
  const message = (error) =>
    error.issues?.length
      ? error.issues.map((issue) => issue.path + ': ' + issueMessage(issue)).join('\n')
      : t(Object.hasOwn(dictionaries[getLocale()], error.message) ? error.message : 'errorRead');
  async function run(action) {
    if (busy) return;
    busy = true;
    try {
      await action();
    } catch (error) {
      await dialog('transferErrorTitle', () => '<pre>' + esc(message(error)) + '</pre>', [
        ['close', 'cancel'],
      ]);
    } finally {
      busy = false;
    }
  }
  async function decodeImages(images) {
    for (const image of images) {
      const decoded = new Image();
      decoded.src = attachmentDataURL(image);
      try {
        await decoded.decode();
      } catch {
        throw transferError('errorImageAttachment');
      }
    }
  }
  function fresh(ctx) {
    if (!isCurrent(ctx)) throw transferError('transferChanged');
  }
  function preview(host, card) {
    const content = document.createElement('div');
    content.className = 'transfer-preview markdown';
    host.append(content);
    // The dialog builder returns a detached element; render after Feedback mounts it.
    Promise.resolve()
      .then(() =>
        renderMarkdown(content, card.content, {
          allowImages: false,
          images: card.extensions?.[IMAGE_NAMESPACE] || {},
          isCurrent: () => content.isConnected,
        }),
      )
      .catch(() => {
        if (content.isConnected) content.textContent = t('errorDiagram');
      });
  }
  const check = (id, text, checked, callback) => {
    const label = document.createElement('label');
    label.className = 'transfer-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = checked;
    input.onchange = () => callback(input.checked);
    label.append(input, document.createTextNode(text));
    return label;
  };
  function list(host, title, values) {
    if (!values.length) return;
    const block = document.createElement('div');
    block.className = 'transfer-warning';
    const heading = document.createElement('p');
    heading.textContent = title;
    const ul = document.createElement('ul');
    for (const value of values) {
      const li = document.createElement('li');
      li.textContent = value;
      ul.append(li);
    }
    block.append(heading, ul);
    host.append(block);
  }
  function selector(id, values, value, callback) {
    const label = document.createElement('label');
    label.className = 'transfer-option';
    label.textContent = t(id);
    const select = document.createElement('select');
    select.id = id;
    for (const [key, text] of values) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = t(text);
      select.append(option);
    }
    select.value = value;
    select.onchange = () => callback(select.value);
    label.append(select);
    return label;
  }
  function syncButton(disabled) {
    const button = document.querySelector('#modal [data-choice=accept]');
    if (button) button.disabled = disabled;
  }
  async function importMarkdown(file) {
    const ctx = context();
    if (!ctx) return;
    if (file.size > LIMITS.file) throw transferError('errorFileLimit');
    if (!/\.md$/i.test(file.name)) throw transferError('transferMarkdownFile');
    const staged = stageMarkdown(decodeDocument(await file.arrayBuffer()), ctx.current);
    await decodeImages(staged.embedded);
    fresh(ctx);
    let mode = 'replace',
      candidate = null,
      error = null;
    const body = () => {
      const host = document.createElement('div');
      host.innerHTML = '<p>' + esc(t('transferDraftNotice')) + '</p>';
      const refresh = () => {
        host.querySelector('.transfer-result')?.remove();
        const result = document.createElement('div');
        result.className = 'transfer-result';
        host.append(result);
        try {
          candidate = markdownCandidate(ctx.current, staged, mode);
          assertProject({
            ...ctx.draftProject,
            cards: ctx.draftProject.cards.map((c) => (c.id === ctx.id ? candidate : c)),
          });
          error = null;
          preview(result, candidate);
        } catch (e) {
          error = e;
          result.textContent = message(e);
        }
        syncButton(Boolean(error));
      };
      host.append(
        selector(
          'transfer-md-mode',
          [
            ['replace', 'transferReplace'],
            ['append', 'transferAppend'],
          ],
          mode,
          (value) => {
            mode = value;
            refresh();
          },
        ),
      );
      list(host, t('transferRelativeImages'), staged.missing);
      list(host, t('transferRemoteImages'), staged.remote);
      refresh();
      return host;
    };
    const choice = await dialog('transferMarkdownTitle', body, [
      ['cancel', 'cancel'],
      ['transferUseDraft', 'accept', true, () => Boolean(error)],
    ]);
    if (choice === 'accept' && candidate && !error) {
      fresh(ctx);
      useDraft(candidate);
      toast('transferDraftReady');
    }
  }
  async function exportNode() {
    const ctx = context();
    if (!ctx) return;
    let source = 'committed',
      includeUnused = true,
      acknowledged = false,
      output = null,
      error = null;
    const excluded = excludedProjectNamespaces(ctx.project);
    const body = () => {
      const host = document.createElement('div');
      host.innerHTML = '<p>' + esc(t('transferExportNotice')) + '</p>';
      const refresh = () => {
        host.querySelector('.transfer-result')?.remove();
        const result = document.createElement('div');
        result.className = 'transfer-result';
        host.append(result);
        try {
          const project = source === 'draft' ? ctx.draftProject : ctx.project;
          const card = project.cards.find((c) => c.id === ctx.id);
          output = nodeFile(project, card, { includeUnused, excludeUnknown: acknowledged });
          error = null;
          result.innerHTML =
            '<strong>' +
            esc(card.title) +
            '</strong><p>' +
            esc(card.summary) +
            '</p><p>' +
            esc(
              t('transferNodeSummary', {
                images: Object.keys(JSON.parse(output).cards[0].extensions?.[IMAGE_NAMESPACE] || {})
                  .length,
              }),
            ) +
            '</p>';
        } catch (e) {
          error = e;
          result.textContent = message(e);
        }
        syncButton(Boolean(error));
      };
      host.append(
        selector(
          'transfer-source',
          [
            ['committed', 'transferCommitted'],
            ['draft', 'transferDraft'],
          ],
          source,
          (value) => {
            source = value;
            refresh();
          },
        ),
      );
      host.append(
        check('transfer-unused', t('transferIncludeUnused'), includeUnused, (value) => {
          includeUnused = value;
          refresh();
        }),
      );
      list(host, t('transferUnknownProject'), excluded);
      if (excluded.length)
        host.append(
          check('transfer-acknowledge', t('transferExcludeAgree'), acknowledged, (value) => {
            acknowledged = value;
            refresh();
          }),
        );
      refresh();
      return host;
    };
    const choice = await dialog('transferExportTitle', body, [
      ['cancel', 'cancel'],
      ['transferDownloadNode', 'accept', true, () => Boolean(error)],
    ]);
    if (choice === 'accept' && output && !error) {
      fresh(ctx);
      download(
        output,
        filename(JSON.parse(output).cards[0].title).replace(/\.json$/, '.node.json'),
      );
      toast('transferNodeDownloaded');
    }
  }
  async function importNode(file) {
    const ctx = context();
    if (!ctx) return;
    if (file.size > LIMITS.file) throw transferError('errorFileLimit');
    const staged = stageNode(decodeDocument(await file.arrayBuffer()), file.size);
    const source = staged.project,
      incoming = source.cards[0];
    await decodeImages(Object.values(incoming.extensions?.[IMAGE_NAMESPACE] || {}));
    fresh(ctx);
    let mode = 'update',
      takeFormat = false,
      takeUnknown = false,
      acknowledged = false,
      candidate = null,
      error = null;
    const excluded = excludedProjectNamespaces(source);
    const conflicts = extensionConflicts(ctx.current, incoming);
    const body = () => {
      const host = document.createElement('div');
      host.innerHTML =
        '<p>' +
        esc(t('transferImportNotice')) +
        '</p><p><strong>' +
        esc(incoming.title) +
        '</strong></p>';
      const refresh = () => {
        host.querySelector('.transfer-result')?.remove();
        const result = document.createElement('div');
        result.className = 'transfer-result';
        host.append(result);
        try {
          if (excluded.length && !acknowledged) throw transferError('transferAcknowledge');
          const merged =
            mode === 'update'
              ? mergeNode(ctx.current, incoming, { takeFormat, takeUnknown })
              : { card: incoming, remapped: [] };
          candidate = merged.card;
          if (mode === 'update')
            updateNodeProject(ctx.draftProject, ctx.id, candidate, source, ctx.view, takeFormat);
          else {
            let previewId = incoming.id + '-preview';
            while (ctx.project.cards.some((c) => c.id === previewId)) previewId += '-new';
            addNodeProject(ctx.project, source, previewId, ctx.view, { x: 0, y: 0 });
          }
          error = null;
          result.innerHTML =
            '<p>' +
            esc(t(mode === 'update' ? 'transferKeepGeometry' : 'transferAddNotice')) +
            '</p>';
          if (mode === 'update') {
            const table = document.createElement('table');
            table.innerHTML =
              '<thead><tr><th>' +
              esc(t('transferField')) +
              '</th><th>' +
              esc(t('transferBefore')) +
              '</th><th>' +
              esc(t('transferAfter')) +
              '</th></tr></thead><tbody>' +
              ['title', 'summary', 'type', 'tags']
                .map(
                  (key) =>
                    '<tr><th>' +
                    esc(t(key)) +
                    '</th><td>' +
                    esc(String(ctx.current[key])) +
                    '</td><td>' +
                    esc(String(candidate[key])) +
                    '</td></tr>',
                )
                .join('') +
              '</tbody>';
            result.append(table);
            list(
              result,
              t('transferRemapped'),
              merged.remapped.map(([id, next]) => id + ' → ' + next),
            );
          }
          preview(result, mode === 'update' ? candidate : incoming);
        } catch (e) {
          error = e;
          result.textContent = message(e);
        }
        syncButton(Boolean(error));
        for (const id of ['transfer-format', 'transfer-unknown']) {
          const option = host.querySelector('#' + id);
          if (option) option.disabled = mode === 'add';
        }
      };
      host.append(
        selector(
          'transfer-node-mode',
          [
            ['update', 'transferUpdate'],
            ['add', 'transferAdd'],
          ],
          mode,
          (value) => {
            mode = value;
            refresh();
          },
        ),
      );
      host.append(
        check('transfer-format', t('transferTakeFormat'), takeFormat, (value) => {
          takeFormat = value;
          refresh();
        }),
      );
      list(host, t('transferConflicts'), conflicts);
      if (conflicts.length)
        host.append(
          check('transfer-unknown', t('transferTakeUnknown'), takeUnknown, (value) => {
            takeUnknown = value;
            refresh();
          }),
        );
      list(host, t('transferUnknownProject'), excluded);
      if (excluded.length)
        host.append(
          check('transfer-acknowledge', t('transferExcludeAgree'), acknowledged, (value) => {
            acknowledged = value;
            refresh();
          }),
        );
      refresh();
      return host;
    };
    const choice = await dialog('transferImportTitle', body, [
      ['cancel', 'cancel'],
      ['transferConfirmImport', 'accept', true, () => Boolean(error)],
    ]);
    if (choice !== 'accept' || error) return;
    fresh(ctx);
    if (mode === 'add') await addNode(source);
    else {
      useDraft(candidate, takeFormat ? source : null);
      toast('transferDraftReady');
    }
  }
  function mount(host) {
    const tools = document.createElement('details');
    tools.className = 'node-transfer-tools';
    tools.innerHTML =
      '<summary>' + esc(t('transferTools')) + '</summary><div class="node-transfer-actions"></div>';
    const actions = tools.querySelector('div');
    for (const [id, key, accept, action] of [
      ['import-markdown', 'transferImportMarkdown', '.md', importMarkdown],
      ['import-node', 'transferImportNode', '.json', importNode],
      ['export-node', 'transferExportNode', null, exportNode],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = id;
      button.textContent = t(key);
      actions.append(button);
      if (accept) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.hidden = true;
        input.id = id + '-file';
        input.onchange = () => {
          const file = input.files[0];
          input.value = '';
          if (file) run(() => action(file));
        };
        button.onclick = () => input.click();
        actions.append(input);
      } else button.onclick = () => run(action);
    }
    host.prepend(tools);
  }
  return { mount };
}
