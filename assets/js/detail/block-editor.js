import { t, getLocale } from '../i18n/index.js';
import vi from '../../vendor/grapes-vi.js';
import { DOCUMENT, documentHTML, documentText, documentIssues } from '../graph/html-document.js';
import { parseDocument, legacySourceKeys } from './html-content.js';
import { safeStyle, safeURL } from '../graph/html-document.js';
import { attachmentDataURL } from './attachments.js';
import { readImageFile } from './image-file.js';
import { createLayoutControls } from './layout-controls.js';
import { createComponentControls } from './component-controls.js';
import { createCodeControls } from './code-controls.js';
import { createImageControls } from './image-controls.js';
import { createHTMLImport } from './html-import.js';
import { createEditorGuide } from './editor-guide.js';
import { createElementLibrary } from './element-library.js';
import { htmlTemplate } from './writing.js';
import { formatHTML } from './html-formatter.js';
import { softBreaks } from './source-soft-breaks.js';
const local = (file) => new URL('../../vendor/' + file, import.meta.url).href;
import { labelIcon } from './editor-icons.js';

export async function mountBlockEditor(
  host,
  card,
  onChange,
  isCurrent,
  onPendingChange = () => {},
) {
  const [{ default: grapesjs }, codeMirror] = await Promise.all([
    import('../../vendor/grapesjs-entry.js'),
    import('../../vendor/codemirror-entry.js'),
  ]);
  if (!isCurrent() || !host.isConnected) return null;
  if (!document.querySelector('[data-grapes-style]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = local('grapes.min.css');
    css.dataset.grapesStyle = '';
    document.head.append(css);
  }
  const tools = document.createElement('div');
  tools.className = 'block-editor-tools';
  tools.inert = true;
  host.setAttribute('aria-busy', 'true');
  const notice = document.createElement('p');
  notice.className = 'block-editor-notice';
  notice.setAttribute('role', 'status');
  const legacyStatus = document.createElement('p');
  legacyStatus.className = 'block-editor-legacy-status';
  legacyStatus.setAttribute('role', 'status');
  const updateLegacyStatus = (doc) => {
    const origins = new Set();
    const visit = (nodes) => {
      for (const node of nodes) {
        if (typeof node === 'string') continue;
        if (legacySourceKeys[node.attributes?.['data-origin']])
          origins.add(node.attributes['data-origin']);
        visit(node.children || []);
      }
    };
    visit(doc.components);
    legacyStatus.textContent = [...origins].map((origin) => t(legacySourceKeys[origin])).join(' · ');
  };
  updateLegacyStatus(card.extensions[DOCUMENT]);
  const canvas = document.createElement('div');
  canvas.className = 'block-editor-canvas';
  const modeBar = document.createElement('div');
  modeBar.className = 'block-editor-mode';
  modeBar.inert = true;
  modeBar.setAttribute('role', 'group');
  const visualButton = document.createElement('button');
  const sourceButton = document.createElement('button');
  const sourceSearch = document.createElement('button');
  const sourceFormat = document.createElement('button');
  const sourceImport = document.createElement('button');
  for (const button of [visualButton, sourceButton, sourceSearch, sourceFormat, sourceImport]) button.type = 'button';
  sourceImport.dataset.editorImport = '';
  sourceImport.hidden = true;
  // Import review and help panels stay reachable in both editing modes.
  const panels = document.createElement('div');
  panels.className = 'block-editor-panels';
  visualButton.dataset.editorMode = 'visual';
  sourceButton.dataset.editorMode = 'html';
  sourceSearch.dataset.editorSearch = '';
  sourceFormat.dataset.editorFormat = '';
  sourceSearch.hidden = true;
  sourceFormat.hidden = true;
  const source = document.createElement('textarea');
  const sourceHost = document.createElement('div');
  sourceHost.className = 'block-editor-source';
  sourceHost.hidden = true;
  const sourceHint = document.createElement('p');
  sourceHint.className = 'block-editor-source-hint';
  source.className = 'block-editor-source';
  source.spellcheck = false;
  source.hidden = true;
  sourceHint.hidden = true;
  modeBar.append(visualButton, sourceButton, sourceSearch, sourceFormat, sourceImport);
  host.append(modeBar, tools, panels, notice, legacyStatus, canvas, sourceHint, sourceHost);
  const editor = grapesjs.init({
    container: canvas,
    height: '580px',
    storageManager: false,
    telemetry: false,
    cssIcons: '',
    i18n: { locale: getLocale(), detectLocale: false, messages: { vi } },
    noticeOnUnload: false,
    fromElement: false,
    canvas: { styles: [local('bootstrap.min.css'), new URL('../../css/document-content.css', import.meta.url).href] },
    assetManager: { upload: false, assets: [] },
    panels: { defaults: [] },
    styleManager: { sectors: [] },
    parser: {
      optionsHtml: { allowScripts: false, allowUnsafeAttr: false, allowUnsafeAttrValue: false },
    },
  });
  const images = structuredClone(card.extensions?.['card-atlas:images'] || {});
  // Edit the whole list as one rich-text surface so Enter creates a sibling item.
  editor.Components.addType('editable-list', {
    extend: 'text',
    isComponent: (element) =>
      ['UL', 'OL'].includes(element.tagName) ? { type: 'editable-list' } : false,
  });
  // Table cells and callouts hold their text directly, which GrapesJS does not make editable by itself.
  editor.Components.addType('editable-cell', {
    extend: 'text',
    isComponent: (element) =>
      ['TD', 'TH'].includes(element.tagName) ? { type: 'editable-cell' } : false,
    model: { defaults: { draggable: 'tr' } },
  });
  editor.Components.addType('editable-callout', {
    extend: 'text',
    isComponent: (element) =>
      element.tagName === 'DIV' && element.classList?.contains('alert')
        ? { type: 'editable-callout' }
        : false,
  });
  editor.Components.addType('image', {
    model: { defaults: { editable: false, traits: [] } },
    view: { events: { dblclick: () => {} } },
  });
  const showAttachment = (component) => {
    if (component.get('tagName') !== 'img') return;
    const src = component.getAttributes().src || component.get('src') || '';
    if (src.startsWith('attachment:')) {
      const url = attachmentDataURL(images[src.slice(11)]);
      if (url) component.getEl()?.setAttribute('src', url);
    }
  };
  editor.on('component:mount', showAttachment);
  editor.on('component:update:src', (component) => window.queueMicrotask(() => showAttachment(component)));
  editor.on('undo redo', () => {
    window.setTimeout(() => {
      if (!isCurrent() || mode !== 'visual') return;
      for (const component of editor.getWrapper().find('img')) {
        const src = component.getAttributes().src;
        if (src && component.get('src') !== src)
          editor.UndoManager.skip(() => component.set('src', src));
        showAttachment(component);
      }
      sync();
    }, 0);
  });
  const blocks = {
    blockParagraph: '<p>...</p>',
    blockHeading: '<h2>...</h2>',
    blockContainer: '<div class="container"><p>...</p></div>',
    blockRow: '<div class="row g-3"><div class="col"><p>...</p></div></div>',
    blockColumn: '<div class="col-md-6"><p>...</p></div>',
    blockColumns:
      '<div class="row g-3"><div class="col-md-6"><p>...</p></div><div class="col-md-6"><p>...</p></div></div>',
    blockCard:
      '<div class="card"><div class="card-body"><h3 class="card-title">...</h3><p class="card-text">...</p></div></div>',
    blockAlert: '<div class="alert alert-info">...</div>',
    blockBadge: '<span class="badge text-bg-primary">...</span>',
    blockTable:
      '<table class="table table-bordered"><tbody><tr><th>...</th><th>...</th></tr><tr><td>...</td><td>...</td></tr></tbody></table>',
    blockCode: '<pre><code class="language-java">// Java</code></pre>',
    blockList: '<ul><li>...</li></ul>',
    blockQuote: '<blockquote>...</blockquote>',
    blockOrderedList: '<ol><li>...</li></ol>',
    blockDivider: '<hr>',
    blockButton: '<a class="btn btn-primary" href="#">...</a>',
  };
  // Containers whose children are blocks; a new block goes right after the selected block inside them.
  const BLOCK_PARENTS = new Set(['div', 'section', 'article', 'aside', 'header', 'footer', 'td', 'th']);
  /** Adds content after the selected block (inside a selected div), then reveals it. */
  const insertBlock = (content) => {
    const selected = editor.getSelected();
    let added;
    if (selected?.get('tagName') === 'div') added = selected.append(content);
    else {
      let anchor = selected;
      while (
        anchor?.parent() &&
        anchor.parent() !== editor.getWrapper() &&
        !BLOCK_PARENTS.has(anchor.parent().get('tagName'))
      )
        anchor = anchor.parent();
      added = anchor?.parent()
        ? anchor.parent().append(content, { at: anchor.index() + 1 })
        : editor.addComponents(content);
    }
    const first = [added].flat()[0];
    if (!first) return null;
    // Selecting a new div would nest the next block inside it, so only leaf blocks get selected.
    if (first.get('tagName') !== 'div') editor.select(first);
    first.getEl()?.scrollIntoView({ block: 'nearest' });
    return first;
  };
  const groups = {};
  for (const key of ['editorGroupText', 'editorGroupLayout', 'editorGroupComponents', 'editorGroupActions']) {
    const group = document.createElement('div');
    group.className = 'block-editor-group';
    group.dataset.editorGroup = key;
    group.setAttribute('role', 'group');
    const heading = document.createElement('span');
    heading.className = 'block-editor-group-title';
    group.append(heading);
    tools.append(group);
    groups[key] = group;
  }
  const groupFor = (key) =>
    ['blockParagraph', 'blockHeading', 'blockList', 'blockOrderedList', 'blockQuote', 'blockDivider', 'blockCode'].includes(key)
      ? groups.editorGroupText
      : ['blockContainer', 'blockRow', 'blockColumn', 'blockColumns'].includes(key)
        ? groups.editorGroupLayout
        : groups.editorGroupComponents;
  for (const [key, html] of Object.entries(blocks)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.blockLabel = key;
    labelIcon(button, key);
    button.onclick = () => insertBlock(html);
    groupFor(key).append(button);
  }
  for (const [key, command] of [
    ['blockUndo', 'core:undo'],
    ['blockRedo', 'core:redo'],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.blockLabel = key;
    labelIcon(button, key);
    button.onclick = () => {
      liveText.clear();
      editor.runCommand(command);
    };
    groups.editorGroupActions.append(button);
  }
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/png,image/jpeg,image/webp,image/gif';
  file.hidden = true;
  const imageButton = document.createElement('button');
  imageButton.type = 'button';
  imageButton.dataset.blockLabel = 'insertImage';
  labelIcon(imageButton, 'insertImage');
  imageButton.onclick = () => file.click();
  file.onchange = async () => {
    const imageFile = file.files[0];
    file.value = '';
    if (!imageFile) return;
    try {
      const image = await readImageFile(imageFile, 10 * 1024 * 1024);
      if (!isCurrent() || mode !== 'visual') return;
      notice.textContent = '';
      const id = 'image-' + window.crypto.randomUUID();
      images[id] = image;
      insertBlock({
        tagName: 'figure',
        components: [
          {
            type: 'image',
            tagName: 'img',
            attributes: { src: 'attachment:' + id, alt: image.name },
          },
          { type: 'text', tagName: 'figcaption', components: image.name },
        ],
      });
    } catch {
      notice.textContent = t('errorImageAttachment');
    }
  };
  groups.editorGroupComponents.append(imageButton, file);
  const templateSelect = document.createElement('select');
  templateSelect.dataset.htmlTemplate = '';
  for (const value of ['', 'guide', 'api', 'note']) {
    const option = document.createElement('option');
    option.value = value;
    option.dataset.templateKey = value
      ? 'template' + value[0].toUpperCase() + value.slice(1)
      : 'templateLabel';
    templateSelect.append(option);
  }
  templateSelect.onchange = () => {
    if (templateSelect.value) insertBlock(htmlTemplate(templateSelect.value));
    templateSelect.value = '';
  };
  groups.editorGroupActions.append(templateSelect);
  const linkControls = document.createElement('div');
  linkControls.className = 'block-editor-link';
  linkControls.hidden = true;
  const linkLabel = document.createElement('label');
  const linkInput = document.createElement('input');
  linkInput.type = 'text';
  linkInput.placeholder = 'https://';
  linkLabel.append(linkInput);
  const linkApply = document.createElement('button');
  linkApply.type = 'button';
  const linkLabelText = document.createElement('span');
  linkLabel.prepend(linkLabelText);
  linkControls.append(linkLabel, linkApply);
  tools.append(linkControls);
  const layoutControls = createLayoutControls();
  tools.append(layoutControls.root);
  const componentControls = createComponentControls();
  tools.append(componentControls.root);
  const codeControls = createCodeControls();
  tools.append(codeControls.root);
  const replaceFile = document.createElement('input');
  replaceFile.type = 'file';
  replaceFile.accept = file.accept;
  replaceFile.hidden = true;
  replaceFile.dataset.imageReplaceFile = '';
  let replaceTarget = null;
  const imageControls = createImageControls((image) => {
    replaceTarget = image;
    replaceFile.click();
  });
  replaceFile.onchange = async () => {
    const imageFile = replaceFile.files[0];
    const target = replaceTarget;
    replaceFile.value = '';
    replaceTarget = null;
    if (!imageFile || !target) return;
    try {
      const image = await readImageFile(imageFile, 10 * 1024 * 1024);
      if (!isCurrent() || mode !== 'visual') return;
      let ancestor = target;
      while (ancestor && ancestor !== editor.getWrapper()) ancestor = ancestor.parent();
      if (!ancestor) return;
      const id = 'image-' + window.crypto.randomUUID();
      images[id] = image;
      target.set('src', 'attachment:' + id);
      target.getEl()?.setAttribute('src', attachmentDataURL(image));
      notice.textContent = '';
    } catch {
      if (isCurrent()) notice.textContent = t('errorImageAttachment');
    }
  };
  imageControls.root.append(replaceFile);
  tools.append(imageControls.root);
  const htmlImport = createHTMLImport(
    (html) => (mode === 'html' ? insertSource(html) : insertBlock(html)),
    images,
  );
  const htmlButton = document.createElement('button');
  htmlButton.type = 'button';
  htmlButton.dataset.blockLabel = 'htmlImportTitle';
  labelIcon(htmlButton, 'htmlImportTitle');
  htmlButton.onclick = htmlImport.show;
  groups.editorGroupActions.append(htmlButton);
  sourceImport.onclick = htmlImport.show;
  panels.append(htmlImport.root);
  // Samples go through the same review as pasted HTML before they enter the document.
  const guide = createEditorGuide({ onInsert: htmlImport.fromClipboard });
  // Ready-made elements for visual mode: click inserts after the selection, dragging drops in place.
  // The drop is resolved here instead of by GrapesJS blocks, whose drop position is off inside the dialog.
  let draggedElement = null;
  const library = createElementLibrary({
    onInsert: (html) => insertBlock(html),
    onDragStart: (html) => {
      draggedElement = html;
    },
    onDragEnd: () => {
      draggedElement = null;
      editor.Canvas.getDocument()?.querySelector('[data-drop-line]')?.remove();
    },
  });
  groups.editorGroupActions.append(library.button);
  panels.append(library.root);
  // The AI prompt and the samples belong to HTML code mode, next to find and format.
  guide.promptButton.hidden = true;
  guide.samplesButton.hidden = true;
  modeBar.append(guide.promptButton, guide.samplesButton);
  panels.append(guide.root);
  linkApply.onclick = () => {
    const component = editor.getSelected();
    if (component?.get('tagName') !== 'a') return;
    const url = linkInput.value.trim();
    if (!safeURL(url)) {
      notice.textContent = t('blockLinkInvalid');
      linkInput.focus();
      return;
    }
    component.addAttributes({ href: url });
    const element = component.getEl();
    for (const [id] of liveText) {
      const parent = editor.Canvas.getDocument().getElementById(id);
      if (parent?.contains(element)) liveText.set(id, parent.innerHTML);
    }
    sync();
    notice.textContent = '';
  };
  editor.setComponents(documentHTML(card.extensions[DOCUMENT]));
  // Never persist framework project/session data or trust model script properties.
  let ready = false;
  const liveText = new Map();
  let mode = 'visual';
  let currentDocument = structuredClone(card.extensions[DOCUMENT]);
  let visualCanonicalBaseline = structuredClone(currentDocument);
  const visualSignature = () => editor.getHtml() + '\n' + editor.getCss();
  let visualBaseline = visualSignature();
  let visualDocumentBaseline = documentHTML(parseDocument(editor.getHtml()).document);
  let sourceBaseline = '';
  const hasPending = () => mode === 'html' && source.value !== sourceBaseline;
  // Selecting a block opens its property panel above the canvas. Scroll the enclosing panel by the
  // same amount so the block stays under the pointer; otherwise the second click of a double-click
  // lands somewhere else and the block never enters text editing.
  const scroller = (() => {
    for (let node = host.parentElement; node; node = node.parentElement)
      if (['auto', 'scroll'].includes(window.getComputedStyle(node).overflowY)) return node;
    return null;
  })();
  let toolsHeight = tools.offsetHeight;
  const keepCanvasInPlace = () => {
    const height = tools.offsetHeight;
    const delta = height - toolsHeight;
    toolsHeight = height;
    if (delta && scroller && ready && mode === 'visual') scroller.scrollTop += delta;
  };
  // Selection changes call this synchronously (before the next click); the observer covers the rest.
  const toolsObserver = new window.ResizeObserver(keepCanvasInPlace);
  toolsObserver.observe(tools);
  // Panels opening above the canvas move it; GrapesJS must re-read its position or drops land off target.
  const panelsObserver = new window.ResizeObserver(() => {
    if (ready && mode === 'visual') editor.refresh();
  });
  panelsObserver.observe(panels);
  editor.on('destroy', () => {
    toolsObserver.disconnect();
    panelsObserver.disconnect();
  });
  const canSave = () => {
    if (!hasPending()) return true;
    if (new TextEncoder().encode(source.value).length > 1000000) return false;
    const parsed = parseDocument(source.value);
    return !parsed.removed.length && !documentIssues({
      extensions: { [DOCUMENT]: parsed.document, 'card-atlas:images': images },
    }).length;
  };
  let settingSource = false;
  const languageCompartment = new codeMirror.Compartment();
  const sourcePhrases = () => codeMirror.EditorState.phrases.of(Object.fromEntries([
    ['Find', 'cmFind'], ['Replace', 'cmReplace'], ['next', 'cmNext'],
    ['previous', 'cmPrevious'], ['all', 'cmAll'], ['match case', 'cmCase'],
    ['regexp', 'cmRegexp'], ['by word', 'cmWord'], ['replace', 'cmReplaceNext'],
    ['replace all', 'cmReplaceAll'], ['close', 'cmClose'], ['Go to line', 'cmGoto'],
    ['go', 'cmGo'], ['current match', 'cmMatch'], ['on line', 'cmOnLine'],
    ['replaced match on line $', 'cmReplacedLine'], ['replaced $ matches', 'cmReplacedCount'],
    ['Diagnostics', 'cmDiagnostics'], ['No diagnostics', 'cmNoDiagnostics'], ['Completions', 'cmCompletions'],
  ].map(([phrase, key]) => [phrase, t(key)])));
  const sourceView = new codeMirror.EditorView({
    doc: '',
    parent: sourceHost,
    extensions: [
      codeMirror.basicSetup,
      codeMirror.html(),
      softBreaks(codeMirror),
      languageCompartment.of(sourcePhrases()),
      codeMirror.lintGutter(),
      codeMirror.linter((view) => {
        const diagnostics = [];
        codeMirror.syntaxTree(view.state).iterate({
          enter(node) {
            if (node.type.isError && diagnostics.length < 50)
              diagnostics.push({
                from: node.from,
                to: Math.min(view.state.doc.length, Math.max(node.to, node.from + 1)),
                severity: 'warning',
                message: t('cmSyntaxError'),
              });
          },
        });
        return diagnostics;
      }),
      codeMirror.EditorView.lineWrapping,
      codeMirror.EditorView.updateListener.of((update) => {
        if (!update.docChanged || settingSource) return;
        source.value = update.state.doc.toString();
        source.oninput?.();
      }),
    ],
  });
  sourceView.contentDOM.dataset.editorSource = '';
  const setSource = (value) => {
    source.value = value;
    settingSource = true;
    sourceView.dispatch({
      changes: { from: 0, to: sourceView.state.doc.length, insert: value },
      annotations: codeMirror.Transaction.addToHistory.of(false),
    });
    settingSource = false;
  };
  const insertSource = (html) => {
    const { from, to } = sourceView.state.selection.main;
    sourceView.dispatch({
      changes: { from, to, insert: html },
      selection: { anchor: from + html.length },
      userEvent: 'input.paste',
    });
    sourceView.focus();
  };
  sourceSearch.onclick = () => codeMirror.openSearchPanel(sourceView);
  sourceFormat.onclick = () => {
    const result = formatHTML(sourceView.state.doc.toString());
    if (!result.ok) {
      notice.textContent = t('htmlFormatUnsupported');
      return;
    }
    if (!result.changed) {
      notice.textContent = t('htmlFormatUnchanged');
      return;
    }
    sourceView.dispatch({ changes: { from: 0, to: sourceView.state.doc.length, insert: result.html }, userEvent: 'input.format' });
    notice.textContent = t('htmlFormatSuccess');
    sourceView.focus();
  };
  let richTextSelection = null;
  const sync = () => {
    if (!ready || !isCurrent()) return;
    const body = new window.DOMParser().parseFromString(editor.getHtml(), 'text/html').body;
    let liveChanged = false;
    for (const [id, html] of liveText) {
      const element = body.querySelector('#' + window.CSS.escape(id));
      if (element) {
        const before = documentHTML(parseDocument(element.innerHTML).document);
        const after = documentHTML(parseDocument(html).document);
        if (before !== after) liveChanged = true;
        element.innerHTML = html;
      }
    }
    if (!liveChanged && visualSignature() === visualBaseline) return;
    for (const rule of editor.Css.getAll().models) {
      if (rule.get('mediaText') || rule.get('state')) continue;
      const style = safeStyle(
        Object.entries(rule.getStyle())
          .map(([key, value]) => key + ':' + value)
          .join(';'),
      );
      if (!style) continue;
      try {
        for (const element of body.querySelectorAll(rule.selectorsToString()))
          element.style.cssText += ';' + style;
      } catch {
        /* Ignore unsupported selectors. */
      }
    }
    const result = parseDocument(body.innerHTML);
    if (!liveChanged && documentHTML(result.document) === visualDocumentBaseline) {
      if (documentHTML(currentDocument) !== documentHTML(visualCanonicalBaseline)) {
        currentDocument = structuredClone(visualCanonicalBaseline);
        updateLegacyStatus(currentDocument);
        onChange(currentDocument, documentText(currentDocument), images);
      }
      return;
    }
    currentDocument = result.document;
    updateLegacyStatus(result.document);
    onChange(result.document, documentText(result.document), images);
  };
  const setMode = (next) => {
    mode = next;
    const code = next === 'html';
    tools.hidden = code;
    canvas.hidden = code;
    sourceHost.hidden = !code;
    sourceSearch.hidden = !code;
    sourceFormat.hidden = !code;
    sourceImport.hidden = !code;
    guide.promptButton.hidden = !code;
    guide.samplesButton.hidden = !code;
    if (!code) guide.close();
    else library.close();
    sourceHint.hidden = !code;
    visualButton.setAttribute('aria-pressed', String(!code));
    sourceButton.setAttribute('aria-pressed', String(code));
    notice.textContent = '';
  };
  const applySource = () => {
    if (!hasPending()) return true;
    if (new TextEncoder().encode(source.value).length > 1000000) {
      notice.textContent = t('htmlImportTooLarge');
      return false;
    }
    const parsed = parseDocument(source.value);
    const issues = documentIssues({
      extensions: { [DOCUMENT]: parsed.document, 'card-atlas:images': images },
    });
    if (parsed.removed.length || issues.length) {
      notice.textContent = parsed.removed.length
        ? t('htmlCodeRejected') + ': ' + [...new Set(parsed.removed)].join(', ')
        : t('htmlImportInvalid');
      return false;
    }
    ready = false;
    liveText.clear();
    editor.setComponents(documentHTML(parsed.document));
    visualBaseline = visualSignature();
    visualDocumentBaseline = documentHTML(parseDocument(editor.getHtml()).document);
    visualCanonicalBaseline = structuredClone(parsed.document);
    ready = true;
    currentDocument = parsed.document;
    updateLegacyStatus(parsed.document);
    sourceBaseline = source.value;
    onChange(parsed.document, documentText(parsed.document), images);
    return true;
  };
  const flushVisual = async () => {
    for (const editable of editor.Canvas.getDocument().querySelectorAll(
      '[contenteditable="true"][id]',
    ))
      liveText.set(editable.id, editable.innerHTML);
    const selected = editor.getSelected();
    if (selected?.view) await editor.RichTextEditor.disable(selected.view);
    sync();
  };
  visualButton.onclick = () => {
    if (mode === 'visual' || !applySource()) return;
    setMode('visual');
    editor.refresh();
    onPendingChange();
  };
  sourceButton.onclick = async () => {
    if (mode === 'html') return;
    await flushVisual();
    setSource(documentHTML(currentDocument));
    sourceBaseline = source.value;
    setMode('html');
    sourceView.requestMeasure();
    sourceView.focus();
  };
  source.oninput = () => {
    notice.textContent = hasPending() && !canSave() ? t('htmlCodeRejected') : '';
    onPendingChange();
  };
  setMode('visual');
  editor.on('load', () => {
    ready = true;
    const frame = editor.Canvas.getDocument();
    const rememberSelection = () => {
      const selection = frame.getSelection();
      const anchor = selection?.anchorNode;
      const element = anchor?.nodeType === 1 ? anchor : anchor?.parentElement;
      if (selection?.rangeCount && element?.closest('[contenteditable="true"]'))
        richTextSelection = selection.getRangeAt(0).cloneRange();
    };
    frame.addEventListener('selectionchange', rememberSelection);
    frame.addEventListener('keyup', rememberSelection, true);
    frame.addEventListener('focusout', rememberSelection, true);
    const captureInput = (event) => {
      if (event.isComposing) return;
      const editable = event.target.closest('[contenteditable="true"]');
      if (editable?.id) {
        liveText.set(editable.id, editable.innerHTML);
        sync();
      }
    };
    frame.addEventListener('input', captureInput, true);
    // Enter in a paragraph or heading starts a new paragraph block; Shift+Enter keeps a line break.
    /** Moves the text after the caret into a new paragraph after `component` and starts editing it. */
    const splitParagraph = async (component) => {
      const editable = component.getEl();
      const caret = frame.getSelection().getRangeAt(0);
      caret.deleteContents();
      const tail = frame.createRange();
      tail.setStart(caret.endContainer, caret.endOffset);
      tail.setEnd(editable, editable.childNodes.length);
      const holder = frame.createElement('div');
      holder.append(tail.extractContents());
      // Splitting inside inline formatting leaves empty clones (for example <strong></strong>) on both sides.
      for (const side of [holder, editable])
        for (const node of [...side.querySelectorAll('*')].reverse())
          if (!node.textContent && !node.matches('img,br') && !node.querySelector('img,br'))
            node.remove();
      liveText.set(editable.id, editable.innerHTML);
      const rest = documentHTML(parseDocument(holder.innerHTML).document);
      const [next] = [
        component
          .parent()
          .append({ type: 'text', tagName: 'p', components: rest }, { at: component.index() + 1 }),
      ].flat();
      // Editing moves on only after the old block has closed its rich-text session.
      await component.view?.disableEditing?.();
      editor.select(next);
      await next.view?.onActive?.();
      // The rich-text editor resets the caret shortly after it opens; wait so ours is the last word.
      await new Promise((resolve) => window.setTimeout(resolve, RTE_SETTLE_MS));
      const element = next.getEl();
      const start = frame.createRange();
      start.setStart(element, 0);
      start.collapse(true);
      const selection = frame.getSelection();
      selection.removeAllRanges();
      selection.addRange(start);
      element.focus();
      element.scrollIntoView({ block: 'nearest' });
      return next;
    };
    // Keys typed while editing moves to the new paragraph are replayed there, so fast typing is not lost.
    const RTE_SETTLE_MS = 40;
    let handover = null;
    frame.addEventListener(
      'keydown',
      (event) => {
        if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
        if (handover) {
          // Other keys are dropped for these few milliseconds rather than applied out of order.
          if (['Shift', 'CapsLock'].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          const split = event.key === 'Enter' && !event.shiftKey;
          if (split || event.key.length === 1) handover.push(event.key);
          return;
        }
        if (event.key !== 'Enter' || event.shiftKey) return;
        const editable = event.target.closest?.('[contenteditable="true"]');
        const component = editor.getSelected();
        if (
          !editable ||
          !/^(P|H[1-6])$/.test(editable.tagName) ||
          component?.getEl() !== editable ||
          !component.parent() ||
          !frame.getSelection()?.rangeCount
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        handover = [];
        void (async () => {
          try {
            let current = await splitParagraph(component);
            while (handover.length && isCurrent()) {
              const key = handover.shift();
              if (key === 'Enter') current = await splitParagraph(current);
              else frame.execCommand('insertText', false, key);
            }
          } finally {
            handover = null;
            sync();
          }
        })();
      },
      true,
    );
    frame.addEventListener('compositionend', captureInput, true);
    frame.addEventListener(
      'paste',
      (event) => {
        const data = event.clipboardData;
        if (!data) return;
        event.preventDefault();
        const html = data.getData('text/html');
        if (html) htmlImport.fromClipboard(html);
        else frame.execCommand('insertText', false, data.getData('text/plain'));
      },
      true,
    );
    // Dropping a library element: find the block under the pointer and insert before or after it.
    const dropPlace = (event) => {
      const hit = frame.elementFromPoint(event.clientX, event.clientY);
      let parent = editor.getWrapper();
      let block = null;
      for (;;) {
        const child = parent.components().find((item) => item.getEl()?.contains(hit));
        if (!child) break;
        block = child;
        if (!BLOCK_PARENTS.has(child.get('tagName'))) break;
        parent = child;
      }
      if (!block) return { parent: editor.getWrapper(), at: editor.getWrapper().components().length };
      // An empty container takes the element inside it.
      if (BLOCK_PARENTS.has(block.get('tagName')) && !block.components().length)
        return { parent: block, at: 0, rect: block.getEl().getBoundingClientRect(), after: false };
      const rect = block.getEl().getBoundingClientRect();
      const after = event.clientY > rect.top + rect.height / 2;
      return { parent: block.parent(), at: block.index() + (after ? 1 : 0), rect, after };
    };
    frame.addEventListener(
      'dragover',
      (event) => {
        if (!draggedElement) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        const place = dropPlace(event);
        let line = frame.querySelector('[data-drop-line]');
        if (!line) {
          line = frame.createElement('div');
          line.setAttribute('data-drop-line', '');
          frame.body.append(line);
        }
        const view = frame.defaultView;
        const top = place.rect
          ? (place.after ? place.rect.bottom : place.rect.top) + view.scrollY
          : frame.body.scrollHeight - 2;
        line.style.cssText =
          'position:absolute;left:0;right:0;height:3px;pointer-events:none;z-index:10;background:var(--doc-ink);top:' +
          (top - 1) +
          'px';
      },
      true,
    );
    frame.addEventListener(
      'drop',
      (event) => {
        if (draggedElement) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const place = dropPlace(event);
          frame.querySelector('[data-drop-line]')?.remove();
          const [first] = [place.parent.append(draggedElement, { at: place.at })].flat();
          draggedElement = null;
          if (first) {
            if (first.get('tagName') !== 'div') editor.select(first);
            first.getEl()?.scrollIntoView({ block: 'nearest' });
          }
          return;
        }
        if (
          event.dataTransfer?.types.some((type) => ['text/html', 'text/uri-list'].includes(type)) ||
          event.dataTransfer?.files.length
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          notice.textContent = t('blockPastePlain');
        }
      },
      true,
    );
    frame.addEventListener(
      'click',
      (event) => {
        if (event.target.closest('a')) event.preventDefault();
      },
      true,
    );
    // The block toolbar is redrawn for every selection; label it whenever its buttons change.
    const blockToolbar = host.querySelector('.gjs-toolbar');
    if (blockToolbar) {
      const toolbarObserver = new window.MutationObserver(labelBlockToolbar);
      toolbarObserver.observe(blockToolbar, { childList: true, subtree: true });
      editor.on('destroy', () => toolbarObserver.disconnect());
    }
    tools.inert = false;
    modeBar.inert = false;
    host.removeAttribute('aria-busy');
  });
  editor.on('update', sync);
  // GrapesJS draws the selected block's toolbar without names; label it for pointer and screen reader.
  const blockToolbarLabels = {
    'tlb-move': 'blockMove',
    'tlb-clone': 'blockClone',
    'tlb-delete': 'blockDelete',
  };
  const labelBlockToolbar = () => {
    const definitions = editor.getSelected()?.get('toolbar') || [];
    host.querySelectorAll('.gjs-toolbar-item').forEach((item, index) => {
      const command = definitions[index]?.command;
      const key = typeof command === 'string' ? blockToolbarLabels[command] : 'blockSelectParent';
      if (!key) return;
      item.title = t(key);
      item.setAttribute('aria-label', t(key));
      item.setAttribute('role', 'button');
    });
  };
  const translateBlockNames = () => {
    editor.I18n.addMessages({
      [getLocale()]: {
        domComponents: {
          names: {
            '': t('blockTypeBlock'),
            text: t('blockTypeText'),
            image: t('blockTypeImage'),
            link: t('blockTypeLink'),
            table: t('blockTypeTable'),
            row: t('blockTypeRow'),
            cell: t('blockTypeCell'),
            'editable-list': t('blockTypeList'),
          },
        },
      },
    });
  };
  translateBlockNames();
  editor.on('component:selected', (component) => {
    layoutControls.select(component);
    componentControls.select(component);
    codeControls.select(component);
    imageControls.select(component);
    if (component.is('image')) component.set({ editable: false, traits: [] });
    const isLink = component.get('tagName') === 'a';
    linkControls.hidden = !isLink;
    if (isLink) linkInput.value = component.getAttributes().href || '';
    keepCanvasInPlace();
  });
  editor.on('component:deselected', () => {
    linkControls.hidden = true;
    layoutControls.clear();
    componentControls.clear();
    codeControls.clear();
    imageControls.clear();
    keepCanvasInPlace();
  });
  const translateLinkControls = () => {
    linkLabelText.textContent = t('blockLinkAddress');
    labelIcon(linkApply, 'blockLinkApply');
  };
  const richTextLabels = {
    Bold: 'blockBold',
    Italic: 'blockItalic',
    Underline: 'blockUnderline',
    'Strike-through': 'blockStrike',
    Link: 'blockLink',
    'Wrap for style': 'blockWrap',
  };
  const translateRichTextControls = () => {
    for (const action of host.querySelectorAll('.gjs-rte-action')) {
      const key = action.dataset.localeKey || richTextLabels[action.title];
      if (!key) continue;
      action.dataset.localeKey = key;
      action.title = t(key);
      action.setAttribute('aria-label', t(key));
      action.setAttribute('role', 'button');
      action.tabIndex = 0;
    }
  };
  editor.on('load', translateRichTextControls);
  host.addEventListener('keydown', (event) => {
    if (event.target.matches('.gjs-rte-action') && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (richTextSelection?.commonAncestorContainer.isConnected) {
        const frame = editor.Canvas.getDocument();
        const selection = frame.getSelection();
        frame.defaultView.focus();
        selection.removeAllRanges();
        selection.addRange(richTextSelection);
      }
      event.target.click();
    }
  });
  translateLinkControls();
  layoutControls.translate();
  componentControls.translate();
  codeControls.translate();
  imageControls.translate();
  htmlImport.translate();
  guide.translate();
  library.translate();
  const translateModes = () => {
    modeBar.setAttribute('aria-label', t('editorMode'));
    labelIcon(visualButton, 'editorVisual');
    labelIcon(sourceButton, 'editorHTML');
    labelIcon(sourceSearch, 'cmFind');
    labelIcon(sourceFormat, 'htmlFormat');
    labelIcon(sourceImport, 'htmlImportTitle');
    source.setAttribute('aria-label', t('editorHTML'));
    sourceView.contentDOM.setAttribute('aria-label', t('editorHTML'));
    sourceView.dispatch({ effects: languageCompartment.reconfigure(sourcePhrases()) });
    sourceHint.textContent = t('editorHTMLHint');
    templateSelect.setAttribute('aria-label', t('templateLabel'));
    for (const option of templateSelect.options) option.textContent = t(option.dataset.templateKey);
    for (const group of Object.values(groups)) {
      group.setAttribute('aria-label', t(group.dataset.editorGroup));
      group.querySelector('.block-editor-group-title').textContent = t(group.dataset.editorGroup);
    }
  };
  translateModes();
  host.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      if (event.target.closest('.cm-editor')) return;
      if (event.target.matches('input, textarea, select')) return;
      event.preventDefault();
      event.stopPropagation();
      const frame = editor.Canvas.getDocument();
      const editable = frame.querySelector('[contenteditable="true"]');
      if (editable && event.target.closest('.gjs-rte-toolbar')) {
        editable.focus();
        frame.execCommand(event.shiftKey ? 'redo' : 'undo');
        return;
      }
      liveText.clear();
      editor.runCommand(event.shiftKey ? 'core:redo' : 'core:undo');
    }
  });
  return {
    destroy: () => { sourceView.destroy(); editor.destroy(); },
    hasPending,
    canSave,
    recoveryState: () => (mode === 'html' ? { mode: 'html', source: source.value } : null),
    restoreRecovery: (state) => {
      if (state?.mode !== 'html' || typeof state.source !== 'string') return;
      sourceBaseline = documentHTML(currentDocument);
      setSource(state.source);
      setMode('html');
      onPendingChange();
    },
    flush: async () => {
      if (mode === 'html') return applySource();
      await flushVisual();
      return true;
    },
    translate: () => {
      editor.I18n.setLocale(getLocale());
      translateBlockNames();
      labelBlockToolbar();
      translateLinkControls();
      layoutControls.translate();
      componentControls.translate();
      codeControls.translate();
      imageControls.translate();
      htmlImport.translate();
      guide.translate();
      library.translate();
      translateModes();
      translateRichTextControls();
      for (const button of tools.querySelectorAll('[data-block-label]'))
        labelIcon(button, button.dataset.blockLabel);
    },
  };
}
