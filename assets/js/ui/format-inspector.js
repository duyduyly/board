import { t } from '../i18n/index.js';
import { textFields, fontFamilies } from '../graph/card-typography.js';
import { formatPropertyIcon } from './format-property-icons.js';

const tabIcons = {
  global: 'M4 5h16M4 12h16M4 19h16M9 3v4M15 10v4M10 17v4',
  text: 'M4 5V3h16v2M12 3v18M8 21h8',
  card: 'M4 4h16v16H4zM7 8h10M7 12h7',
  edge: 'M3 12h16M15 8l4 4-4 4',
};

export function createFormatInspector({ guard, guardGlobal, onSwitch, onTab, onGlobal, context, dirty, canDismiss }) {
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
        fontSize: String(field === 'title' ? 14.5 : field === 'summary' ? 11 : 9),
        fontFamily: 'system',
        color: '#23332d',
      },
    ]),
  );
  let globalBaseline = structuredClone(typography);
  let globalOptions = {};
  const globalDirty = () => Object.values(globalOptions).some(Boolean) ||
    JSON.stringify(typography) !== JSON.stringify(globalBaseline);
  function resetGlobal() {
    for (const field of textFields) Object.assign(typography[field], globalBaseline[field]);
    globalOptions = {};
  }
  function sync() {
    const selected = context();
    host.querySelector('h2').textContent = t('inspectorTitle');
    tabs.replaceChildren();
    for (const key of ['global', 'text', 'card', 'edge']) {
      const button = document.createElement('button');
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('aria-hidden', 'true');
      icon.classList.add('inspector-tab-icon');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', tabIcons[key]);
      icon.append(path);
      const label = t('inspector' + key);
      button.append(icon);
      button.setAttribute('aria-label', label);
      button.title = label;
      button.className = key === active ? 'active' : '';
      button.setAttribute('aria-pressed', String(key === active));
      button.disabled =
        ['text', 'card'].includes(key) && (selected.locked || selected.kind !== 'card');
      if (key === 'edge' && (selected.kind !== 'relation' || selected.locked))
        button.title = label + ': ' + t(selected.locked && selected.kind === 'relation' ? 'inspectorLockedRelationHint' : 'inspectorSelectRelationHint');
      button.onclick = async () => {
        if (key === active) {
          if (key === 'text' && !host.querySelector('#card-overview-editor')?.open) onTab(key);
          return;
        }
        if (!(await onSwitch(active, key))) return;
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
      ['cards', ['surface', 'typography']],
      ['arrows', ['routes', 'arrows']],
    ]) {
      const section = document.createElement('fieldset');
      section.className = 'inspector-config-group';
      const heading = document.createElement('legend');
      heading.insertAdjacentHTML('afterbegin', formatPropertyIcon(group));
      heading.append(document.createTextNode(t('inspectorGroup' + group)));
      section.append(heading);
      const scope = document.createElement('p');
      scope.className = 'inspector-scope';
      scope.textContent = t(group === 'cards' ? 'inspectorEligibleCards' : 'inspectorEligibleEdges')
        .replace('{count}', String(group === 'cards' ? selected.eligibleCards : selected.eligibleEdges));
      section.append(scope);
      for (const key of keys) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = key;
        input.checked = Boolean(globalOptions[key]);
        input.addEventListener('change', () => { globalOptions[key] = input.checked; });
        input.disabled =
          (key === 'routes' && selected.view === 'mind') ||
          (key === 'arrows' && (selected.kind !== 'relation' || selected.locked)) ||
          (key === 'surface' && (selected.kind !== 'card' || selected.locked));
        if (input.disabled) label.title = t(key === 'routes' ? 'inspectorRoutesMindHint' : key === 'arrows' ? 'inspectorNeedArrow' : 'inspectorNeedCard');
        label.append(input);
        label.insertAdjacentHTML('beforeend', formatPropertyIcon(key));
        label.append(document.createTextNode(t('inspectorBulk' + key)));
        section.append(label);
        if (key === 'typography') {
          const settings = document.createElement('fieldset');
          settings.className = 'bulk-typography-settings';
          settings.disabled = !input.checked;
          settings.hidden = !input.checked;
          input.onchange = () => {
            settings.disabled = !input.checked;
            settings.hidden = !input.checked;
          };
          const help = document.createElement('p');
          help.textContent = t('inspectorTypographyHint');
          settings.append(help);
          for (const field of textFields) {
            const heading = document.createElement('h4');
            heading.insertAdjacentHTML('afterbegin', formatPropertyIcon(field));
            heading.append(document.createTextNode(t(field === 'type' ? 'contentType' : field)));
            settings.append(heading);
            for (const property of ['fontSize', 'fontFamily', 'color']) {
              const row = document.createElement('label');
              row.insertAdjacentHTML('afterbegin', formatPropertyIcon(property));
              const propertyName = t(property === 'color' ? 'textColor' : property);
              row.title = propertyName;
              const accessibleName = document.createElement('span');
              accessibleName.className = 'format-property-name';
              accessibleName.textContent = propertyName;
              row.append(accessibleName);
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
                typography[field][property] = control.value;
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
    apply.type = 'submit';
    apply.className = 'primary';
    apply.textContent = t('apply');
    const actions = document.createElement('div');
    actions.className = 'inspector-global-actions';
    const state = document.createElement('span');
    state.className = 'format-draft-status';
    state.setAttribute('role', 'status');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = t('cancel');
    cancel.onclick = () => {
      resetGlobal();
      sync();
    };
    actions.append(state, apply, cancel);
    form.append(actions);
    const updateApply = () => {
      const eligible = { routes: selected.eligibleRoutes, arrows: selected.eligibleEdges, surface: selected.eligibleCards, typography: selected.eligibleCards };
      apply.disabled = ![...form.elements].some((element) => element.type === 'checkbox' && element.name && element.checked && eligible[element.name] > 0) || !form.checkValidity();
      state.textContent = t(globalDirty() ? 'editorUnsaved' : 'editorSaved');
    };
    form.addEventListener('input', updateApply);
    form.addEventListener('change', updateApply);
    updateApply();
    form.onsubmit = async (event) => {
      event.preventDefault();
      const profile = structuredClone(typography);
      for (const field of textFields) profile[field].fontSize = Number(profile[field].fontSize);
      const applied = await onGlobal(
        Object.fromEntries(
          [...form.elements]
            .filter((e) => e.type === 'checkbox' && e.name && !e.disabled)
            .map((e) => [e.name, e.checked]),
        ),
        profile,
      );
      if (applied) {
        globalBaseline = structuredClone(typography);
        globalOptions = {};
        if (!host.hidden) sync();
      }
    };
    global.append(form);
  }
  function show(key) {
    active = key;
    host.hidden = false;
    document.documentElement.classList.add('inspector-open');
    global.hidden = key !== 'global';
    document.querySelector('#inspector-text').hidden = key !== 'text';
    const selected = context();
    const edgeUnavailable = key === 'edge' && (selected.kind !== 'relation' || selected.locked);
    const edgeHint = document.querySelector('#inspector-edge-hint');
    edgeHint.hidden = !edgeUnavailable;
    edgeHint.textContent = t(selected.locked && selected.kind === 'relation' ? 'inspectorLockedRelationHint' : 'inspectorSelectRelationHint');
    document.querySelector('#inspector-fields').hidden = !['card', 'edge'].includes(key) || edgeUnavailable;
    sync();
  }
  function hide() {
    resetGlobal();
    onTab('closed');
    host.hidden = true;
    document.documentElement.classList.remove('inspector-open');
  }
  async function close() {
    if (closing) return;
    closing = true;
    try {
      if (globalDirty() && !(await guardGlobal())) return;
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
    if (dirty() || globalDirty()) {
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
    hasPending() {
      return !host.hidden && (globalDirty() || dirty());
    },
    async beforeSelectionChange() {
      if (host.hidden || (!globalDirty() && !dirty())) return true;
      await close();
      return host.hidden;
    },
    get active() {
      return active;
    },
  };
}
