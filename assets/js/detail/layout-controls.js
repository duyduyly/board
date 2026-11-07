import { labelIcon } from './editor-icons.js';
﻿import { t } from '../i18n/index.js';

export function createLayoutControls() {
  const root = document.createElement('div');
  root.className = 'block-editor-layout';
  root.hidden = true;
  const heading = document.createElement('strong');
  root.append(heading);
  const controls = {};
  const definitions = [
    [
      'breakpoint',
      'layoutBreakpoint',
      [
        ['', 'layoutAll'],
        ['sm', 'layoutSmall'],
        ['md', 'layoutMedium'],
        ['lg', 'layoutLarge'],
        ['xl', 'layoutXLarge'],
        ['xxl', 'layoutXXLarge'],
      ],
    ],
    [
      'width',
      'layoutWidth',
      [
        ['', 'layoutAuto'],
        ...Array.from({ length: 12 }, (_, i) => [String(i + 1), String(i + 1) + '/12']),
      ],
    ],
    [
      'gap',
      'layoutGap',
      [['', 'layoutDefault'], ...Array.from({ length: 6 }, (_, i) => [String(i), String(i)])],
    ],
    [
      'align',
      'layoutAlign',
      [
        ['', 'layoutDefault'],
        ['start', 'layoutStart'],
        ['center', 'layoutCenter'],
        ['end', 'layoutEnd'],
      ],
    ],
  ];
  for (const [name, labelKey, options] of definitions) {
    const label = document.createElement('label');
    const caption = document.createElement('span');
    const select = document.createElement('select');
    select.dataset.layoutControl = name;
    for (const [value, key] of options) {
      const option = document.createElement('option');
      option.value = value;
      option.dataset.translation = key;
      select.append(option);
    }
    label.append(caption, select);
    root.append(label);
    controls[name] = { label, caption, select, labelKey };
  }
  let selected = null;
  const classes = () => selected?.getClasses() || [];
  const update = () => {
    if (!selected) return;
    const names = classes();
    const isRow = names.includes('row');
    const isColumn = names.some((name) => /^col(?:-(?:sm|md|lg|xl|xxl))?(?:-\d+)?$/.test(name));
    root.hidden = !(
      isRow ||
      isColumn ||
      names.includes('container') ||
      names.includes('container-fluid')
    );
    controls.breakpoint.label.hidden = controls.width.label.hidden = !isColumn;
    controls.gap.label.hidden = !isRow;
    controls.align.select.value =
      names.find((name) => /^text-(start|center|end)$/.test(name))?.slice(5) || '';
    controls.gap.select.value = names.find((name) => /^g-[0-5]$/.test(name))?.slice(2) || '';
    if (isColumn) {
      const match = names
        .map((name) => /^col(?:-(sm|md|lg|xl|xxl))?-(\d+)$/.exec(name))
        .find(Boolean);
      controls.breakpoint.select.value = match?.[1] || '';
      controls.width.select.value = match?.[2] || '';
    }
  };
  const setClasses = (remove, additions) => {
    if (!selected) return;
    selected.setClass([...classes().filter((name) => !remove(name)), ...additions.filter(Boolean)]);
  };
  const changeWidth = () => {
    const bp = controls.breakpoint.select.value;
    const width = controls.width.select.value;
    const prefix = `col${bp ? '-' + bp : ''}`;
    setClasses(
      (name) => name === prefix || new RegExp('^' + prefix + '-(?:[1-9]|1[0-2])$').test(name),
      [width ? `${prefix}-${width}` : prefix],
    );
  };
  controls.breakpoint.select.onchange = () => {
    const prefix = `col${controls.breakpoint.select.value ? '-' + controls.breakpoint.select.value : ''}-`;
    controls.width.select.value =
      classes()
        .find((name) => name.startsWith(prefix) && /^\d+$/.test(name.slice(prefix.length)))
        ?.slice(prefix.length) || '';
  };
  controls.width.select.onchange = changeWidth;
  controls.gap.select.onchange = () =>
    setClasses(
      (name) => /^g-[0-5]$/.test(name),
      [controls.gap.select.value === '' ? '' : 'g-' + controls.gap.select.value],
    );
  controls.align.select.onchange = () =>
    setClasses(
      (name) => /^text-(start|center|end)$/.test(name),
      [controls.align.select.value ? 'text-' + controls.align.select.value : ''],
    );
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.dataset.layoutReset = '';
  reset.onclick = () => {
    if (!selected) return;
    const wasColumn = classes().some((name) =>
      /^col(?:-(?:sm|md|lg|xl|xxl))?(?:-\d+)?$/.test(name),
    );
    setClasses(
      (name) =>
        /^col(?:-(?:sm|md|lg|xl|xxl))?(?:-\d+)?$/.test(name) ||
        /^g-[0-5]$/.test(name) ||
        /^text-(start|center|end)$/.test(name),
      [wasColumn ? 'col' : ''],
    );
    update();
  };
  root.append(reset);
  return {
    root,
    select(component) {
      selected = component;
      update();
    },
    clear() {
      selected = null;
      root.hidden = true;
    },
    translate() {
      heading.textContent = t('propertiesLayout');
      labelIcon(reset, 'propertiesReset');
      for (const { caption, select, labelKey } of Object.values(controls)) {
        caption.textContent = t(labelKey);
        for (const option of select.options)
          option.textContent = option.dataset.translation.startsWith('layout')
            ? t(option.dataset.translation)
            : option.dataset.translation;
      }
    },
  };
}
