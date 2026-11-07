const choices = {
  'appearance-align': {
    left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
    center: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
    right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  },
  'appearance-shadow': {
    none: '<rect x="5" y="5" width="13" height="13" rx="2"/><path d="M4 20 20 4"/>',
    soft: '<rect x="4" y="4" width="13" height="13" rx="2"/><path d="M8 20h10a2 2 0 0 0 2-2V8"/>',
  },
  line: {
    solid: '<path d="M3 12h18"/>',
    dashed: '<path d="M3 12h18" stroke-dasharray="5 3"/>',
    dotted: '<path d="M3 12h18" stroke-dasharray="1 3"/>',
  },
  arrow: {
    none: '<path d="M3 12h18"/>',
    start: '<path d="M3 12h18M7 8l-4 4 4 4"/>',
    end: '<path d="M3 12h18M17 8l4 4-4 4"/>',
    both: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  },
};

// The native select remains the form's source of truth; icon buttons dispatch the
// same input event used by the existing draft, validation and preview pipeline.
export function installFormatChoiceIcons(form) {
  const controls = [];
  for (const [name, icons] of Object.entries(choices)) {
    const select = form.elements[name];
    if (!select || select.tagName !== 'SELECT') continue;
    const label = select.closest('label');
    const labelText =
      label.querySelector('.format-property-name')?.textContent ||
      [...label.childNodes]
        .filter((node) => node.nodeType === 3)
        .map((node) => node.textContent.trim())
        .join(' ');
    const group = document.createElement('span');
    group.className = 'format-icon-choices';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', labelText);
    const buttons = [];
    for (const option of select.options) {
      if (!Object.hasOwn(icons, option.value)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.formatChoice = option.value;
      button.setAttribute('aria-label', `${labelText}: ${option.textContent}`);
      button.title = option.textContent;
      button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[option.value]}</svg>`;
      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (select.disabled || option.disabled || select.value === option.value) return;
        select.value = option.value;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      };
      group.append(button);
      buttons.push({ button, option });
    }
    if (!buttons.length) continue;
    select.classList.add('format-icon-native');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    label.append(group);
    const sync = () => {
      for (const { button, option } of buttons) {
        button.disabled = select.disabled || option.disabled;
        button.setAttribute('aria-pressed', String(select.value === option.value));
      }
    };
    select.addEventListener('input', sync);
    select.addEventListener('change', sync);
    sync();
    controls.push(sync);
  }
  return () => controls.forEach((sync) => sync());
}
