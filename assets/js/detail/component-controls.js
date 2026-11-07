import { labelIcon } from './editor-icons.js';
import { t } from '../i18n/index.js';

const variants = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'];
const tableOptions = ['striped', 'bordered', 'hover', 'sm'];

export function createComponentControls() {
  const root = document.createElement('div');
  root.className = 'block-component-controls';
  root.hidden = true;
  const heading = document.createElement('strong');
  root.append(heading);
  const label = document.createElement('label');
  const caption = document.createElement('span');
  const select = document.createElement('select');
  select.dataset.componentVariant = '';
  for (const value of ['', ...variants]) {
    const option = document.createElement('option');
    option.value = value;
    option.dataset.translation = value
      ? 'componentColor' + value[0].toUpperCase() + value.slice(1)
      : 'layoutDefault';
    select.append(option);
  }
  label.append(caption, select);
  root.append(label);
  const checks = document.createElement('div');
  checks.className = 'block-table-options';
  for (const value of tableOptions) {
    const item = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.tableOption = value;
    const text = document.createElement('span');
    text.dataset.translation = 'componentTable' + value[0].toUpperCase() + value.slice(1);
    item.append(input, text);
    checks.append(item);
  }
  root.append(checks);
  let component = null;
  let selectedCell = null;
  let tableHasMerged = false;
  let tableIrregular = false;
  let prefix = '';
  const cellsIn = (row) =>
    row.components().models.filter((cell) => ['td', 'th'].includes(cell.get('tagName')));
  const rowsIn = (table) =>
    table.find('tr').filter((row) => {
      let parent = row.parent();
      while (parent && parent.get('tagName') !== 'table') parent = parent.parent();
      return parent === table;
    });
  const makeAction = (key, data) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset[data] = '';
    button.dataset.translationKey = key;
    return button;
  };
  const addRow = document.createElement('button');
  addRow.type = 'button';
  addRow.dataset.tableAddRow = '';
  addRow.onclick = () => {
    if (!selectedCell || addRow.disabled) return;
    const row = selectedCell.parent();
    const section = row?.parent();
    if (row?.get('tagName') !== 'tr' || !section) return;
    const cells = cellsIn(row);
    const index = section.components().indexOf(row);
    if (index < 0 || !cells.length) return;
    section.append(
      {
        tagName: 'tr',
        components: cells.map((cell) => ({ tagName: cell.get('tagName'), components: '' })),
      },
      { at: index + 1 },
    );
    deleteRow.disabled = false;
  };
  const deleteRow = makeAction('tableDeleteRow', 'tableDeleteRow');
  const addColumn = makeAction('tableAddColumn', 'tableAddColumn');
  const deleteColumn = makeAction('tableDeleteColumn', 'tableDeleteColumn');
  const mergeRight = makeAction('tableMergeRight', 'tableMergeRight');
  const rightCell = () => {
    if (!selectedCell || selectedCell.parent()?.get('tagName') !== 'tr') return null;
    const cells = cellsIn(selectedCell.parent());
    const index = cells.indexOf(selectedCell);
    return index < 0 ? null : cells[index + 1];
  };
  const canMergeRight = () => {
    const right = rightCell();
    return (
      !!right &&
      right.get('tagName') === selectedCell.get('tagName') &&
      Object.keys(right.getAttributes()).length === 0
    );
  };
  mergeRight.onclick = () => {
    if (!selectedCell || mergeRight.disabled || !canMergeRight()) return;
    const right = rightCell();
    const content = right.components().models.map((child) => child.clone());
    if (selectedCell.components().length && content.length) selectedCell.append({ tagName: 'br' });
    selectedCell.append(content);
    selectedCell.addAttributes({ colspan: '2' });
    right.remove();
    mergeRight.disabled = true;
    for (const button of [addRow, deleteRow, addColumn, deleteColumn]) button.disabled = true;
  };
  deleteRow.onclick = () => {
    if (!selectedCell || deleteRow.disabled) return;
    selectedCell.parent().remove();
    selectedCell = null;
    for (const button of [addRow, deleteRow, addColumn, deleteColumn, mergeRight])
      button.disabled = true;
  };
  addColumn.onclick = () => {
    if (!selectedCell || addColumn.disabled) return;
    const rows = rowsIn(component);
    const index = cellsIn(selectedCell.parent()).indexOf(selectedCell);
    if (index < 0) return;
    for (const row of rows) {
      const anchor = cellsIn(row)[index];
      row.append(
        { tagName: anchor.get('tagName'), components: '' },
        { at: row.components().indexOf(anchor) + 1 },
      );
    }
    deleteColumn.disabled = false;
  };
  deleteColumn.onclick = () => {
    if (!selectedCell || deleteColumn.disabled) return;
    const rows = rowsIn(component);
    const index = cellsIn(selectedCell.parent()).indexOf(selectedCell);
    if (index < 0) return;
    for (const row of rows) cellsIn(row)[index].remove();
    selectedCell = null;
    for (const button of [addRow, deleteRow, addColumn, deleteColumn, mergeRight])
      button.disabled = true;
  };
  root.append(addRow, deleteRow, addColumn, deleteColumn, mergeRight);
  const names = () => component?.getClasses() || [];
  const setClasses = (remove, add) =>
    component.setClass([...names().filter((name) => !remove(name)), ...add.filter(Boolean)]);
  select.onchange = () => {
    if (!component || !prefix) return;
    setClasses(
      (name) => variants.some((variant) => name === prefix + variant),
      [select.value ? prefix + select.value : ''],
    );
  };
  checks.onchange = (event) => {
    if (!component || !event.target.dataset.tableOption) return;
    const name = 'table-' + event.target.dataset.tableOption;
    setClasses((entry) => entry === name, [event.target.checked ? name : '']);
  };
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.dataset.componentReset = '';
  reset.onclick = () => {
    if (!component) return;
    const defaults = { 'alert-': 'info', 'text-bg-': 'primary', 'btn-': 'primary', 'border-': '' };
    setClasses(
      (name) =>
        variants.some((value) => name === prefix + value) ||
        tableOptions.some((value) => name === 'table-' + value),
      [prefix && defaults[prefix] ? prefix + defaults[prefix] : ''],
    );
    select.value = defaults[prefix] || '';
    for (const input of checks.querySelectorAll('input')) input.checked = false;
  };
  root.append(reset);
  return {
    root,
    select(value) {
      selectedCell = value;
      while (selectedCell && !['td', 'th'].includes(selectedCell.get('tagName')))
        selectedCell = selectedCell.parent();
      component = value;
      while (
        component &&
        component.get('tagName') !== 'table' &&
        !component
          .getClasses()
          .some((name) => ['alert', 'badge', 'btn', 'card', 'table'].includes(name))
      )
        component = component.parent();
      const list = names();
      prefix = list.includes('alert')
        ? 'alert-'
        : list.includes('badge')
          ? 'text-bg-'
          : list.includes('btn')
            ? 'btn-'
            : list.includes('card')
              ? 'border-'
              : '';
      const table = component?.get('tagName') === 'table' || list.includes('table');
      const cells = table ? component.find('td, th') : [];
      const merged = cells.some((cell) => {
        const attrs = cell.getAttributes();
        return Number(attrs.colspan || 1) !== 1 || Number(attrs.rowspan || 1) !== 1;
      });
      const rows = table ? rowsIn(component) : [];
      const widths = rows.map((row) => cellsIn(row).length);
      const regular =
        widths.length > 0 && widths[0] > 0 && widths.every((width) => width === widths[0]);
      tableHasMerged = merged;
      tableIrregular = !regular;
      root.hidden = !prefix && !table;
      label.hidden = !prefix;
      checks.hidden = !table;
      addRow.hidden = !table;
      addRow.disabled = !selectedCell || merged;
      addRow.title = t(merged ? 'tableMergedHint' : 'tableAddRow');
      for (const button of [deleteRow, addColumn, deleteColumn]) button.hidden = !table;
      deleteRow.disabled = !selectedCell || merged || rows.length <= 1;
      addColumn.disabled = !selectedCell || merged || !regular;
      deleteColumn.disabled = !selectedCell || merged || !regular || widths[0] <= 1;
      mergeRight.hidden = !table;
      mergeRight.disabled = !selectedCell || merged || !regular || !canMergeRight();
      mergeRight.title = t(
        merged
          ? 'tableMergedHint'
          : !regular
            ? 'tableIrregularHint'
            : mergeRight.disabled
              ? 'tableMergeRightHint'
              : 'tableMergeRight',
      );
      for (const button of [deleteRow, addColumn, deleteColumn])
        button.title = t(
          merged
            ? 'tableMergedHint'
            : !regular
              ? 'tableIrregularHint'
              : button.dataset.translationKey,
        );
      select.value = variants.find((v) => list.includes(prefix + v)) || '';
      for (const input of checks.querySelectorAll('input'))
        input.checked = list.includes('table-' + input.dataset.tableOption);
    },
    clear() {
      component = null;
      selectedCell = null;
      root.hidden = true;
    },
    translate() {
      heading.textContent = t('propertiesComponent');
      labelIcon(reset, 'propertiesReset');
      labelIcon(addRow, 'tableAddRow');
      for (const button of [deleteRow, addColumn, deleteColumn]) {
        labelIcon(button, button.dataset.translationKey);
        if (tableHasMerged) button.title = t('tableMergedHint');
        else if (tableIrregular && button !== deleteRow) button.title = t('tableIrregularHint');
      }
      labelIcon(mergeRight, 'tableMergeRight');
      mergeRight.title = t(
        tableHasMerged
          ? 'tableMergedHint'
          : tableIrregular
            ? 'tableIrregularHint'
            : mergeRight.disabled
              ? 'tableMergeRightHint'
              : 'tableMergeRight',
      );
      if (tableHasMerged) addRow.title = t('tableMergedHint');
      caption.textContent = t('componentVariant');
      for (const element of root.querySelectorAll('[data-translation]'))
        element.textContent = t(element.dataset.translation);
    },
  };
}
