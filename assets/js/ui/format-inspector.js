import { t } from '../i18n/index.js';
import { textFields, fontFamilies } from '../graph/card-typography.js';

export function createFormatInspector({ guard, onTab, onGlobal, context, dirty, canDismiss }) {
  const host = document.querySelector('#format-inspector');
  const tabs = document.querySelector('#inspector-tabs');
  const global = document.querySelector('#inspector-global');
  let active = 'global';
  let closing = false;
  let suppressClick = false;
  const typography = Object.fromEntries(
    textFields.map((field) => [
      field,
      {
        fontSize: field === 'title' ? 14.5 : field === 'summary' ? 11 : 9,
        fontFamily: 'system',
        color: '#23332d',
      },
    ]),
  );
  function sync() {
    const selected = context();
    host.querySelector('h2').textContent = t('inspectorTitle');
    tabs.replaceChildren();
    for (const key of ['global', 'text', 'card', 'edge']) {
      const button = document.createElement('button');
      button.textContent = t('inspector' + key);
      button.className = key === active ? 'active' : '';
      button.disabled =
        key !== 'global' &&
        (selected.locked ||
          (key === 'edge' ? selected.kind !== 'relation' : selected.kind !== 'card'));
      button.onclick = async () => {
        if (!(await guard())) return;
        show(key);
        onTab(key);
      };
      tabs.append(button);
    }
    global.replaceChildren();
    const hint = document.createElement('p');
    hint.textContent = t('inspectorGlobalHint');
    global.append(hint);
    const form = document.createElement('form');
    for (const [group, keys] of [
      ['arrows', ['routes', 'arrows']],
      ['cards', ['surface', 'typography']],
    ]) {
      const section = document.createElement('fieldset');
      section.className = 'inspector-config-group';
      const heading = document.createElement('legend');
      heading.textContent = t('inspectorGroup' + group);
      section.append(heading);
      for (const key of keys) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = key;
        input.disabled =
          (key === 'routes' && selected.view === 'mind') ||
          (key === 'arrows' && selected.kind !== 'relation') ||
          (key === 'surface' && selected.kind !== 'card');
        label.append(input, document.createTextNode(t('inspectorBulk' + key)));
        section.append(label);
        if (key === 'typography') {
          const settings = document.createElement('fieldset');
          settings.className = 'bulk-typography-settings';
          settings.disabled = true;
          settings.hidden = true;
          input.onchange = () => {
            settings.disabled = !input.checked;
            settings.hidden = !input.checked;
          };
          const help = document.createElement('p');
          help.textContent = t('inspectorTypographyHint');
          settings.append(help);
          for (const field of textFields) {
            const heading = document.createElement('h4');
            heading.textContent = t(field === 'type' ? 'contentType' : field);
            settings.append(heading);
            for (const property of ['fontSize', 'fontFamily', 'color']) {
              const row = document.createElement('label');
              row.textContent = t(property === 'color' ? 'textColor' : property);
              const control = document.createElement(
                property === 'fontFamily' ? 'select' : 'input',
              );
              control.name = 'bulk-' + field + '-' + property;
              if (property === 'fontFamily') {
                for (const font of Object.keys(fontFamilies))
                  control.append(new window.Option(t('font' + font), font));
              } else if (property === 'fontSize') {
                control.type = 'number';
                control.min = '8';
                control.max = '72';
                control.step = 'any';
                control.required = true;
              } else control.type = 'color';
              control.value = typography[field][property];
              control.oninput = () => {
                typography[field][property] =
                  property === 'fontSize' ? Number(control.value) : control.value;
              };
              row.append(control);
              settings.append(row);
            }
          }
          section.append(settings);
        }
      }
      form.append(section);
    }
    const apply = document.createElement('button');
    apply.className = 'primary';
    apply.textContent = t('apply');
    form.append(apply);
    form.onsubmit = async (event) => {
      event.preventDefault();
      await onGlobal(
        Object.fromEntries(
          [...form.elements]
            .filter((e) => e.type === 'checkbox' && e.name)
            .map((e) => [e.name, e.checked]),
        ),
        structuredClone(typography),
      );
    };
    global.append(form);
  }
  function show(key) {
    active = key;
    host.hidden = false;
    document.documentElement.classList.add('inspector-open');
    global.hidden = key !== 'global';
    document.querySelector('#inspector-text').hidden = key !== 'text';
    document.querySelector('#inspector-fields').hidden = !['card', 'edge'].includes(key);
    sync();
  }
  function hide() {
    onTab('closed');
    host.hidden = true;
    document.documentElement.classList.remove('inspector-open');
  }
  async function close() {
    if (closing) return;
    closing = true;
    try {
      if (await guard()) hide();
    } finally {
      closing = false;
    }
  }
  function dismissOutside(event) {
    if (
      host.hidden ||
      host.contains(event.target) ||
      document.querySelector('dialog:modal') ||
      !canDismiss()
    )
      return;
    if (dirty()) {
      // One click asks about the draft; it must not also run an outside command.
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = event.type === 'pointerdown';
      void close();
    } else {
      // Close synchronously so a deliberate outside control can run normally.
      hide();
    }
  }
  document.addEventListener(
    'pointerdown',
    (event) => {
      suppressClick = false;
      if (event.button === 0) dismissOutside(event);
    },
    true,
  );
  document.addEventListener(
    'click',
    (event) => {
      if (suppressClick && !document.querySelector('dialog:modal')) {
        suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (event.detail === 0) dismissOutside(event);
    },
    true,
  );
  document.querySelector('#inspector-close').onclick = close;
  async function activate(key) {
    if (!(await guard())) return;
    show(key);
    onTab(key);
  }
  return {
    activate,
    show,
    sync,
    close,
    get active() {
      return active;
    },
  };
}
