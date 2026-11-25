import {
  cardGroups,
  groupCardIds,
  groupTree,
  newGroupParent,
  parentOptions,
} from '../graph/card-groups.js';
import { isPinned } from '../graph/card-metadata.js';
import { t } from '../i18n/index.js';

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 500;

/** A labelled field stacked above its control, with an optional hint and live character count. */
function field(labelKey, control, { hintKey = '', optional = false, max = 0 } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'group-editor-field';
  const label = document.createElement('label');
  label.htmlFor = control.id;
  label.textContent = t(labelKey);
  if (optional) {
    const tag = document.createElement('span');
    tag.className = 'group-editor-optional';
    tag.textContent = t('optionalField');
    label.append(' ', tag);
  }
  wrap.append(label, control);
  const help = document.createElement('div');
  help.className = 'group-editor-help';
  if (hintKey) {
    const hint = document.createElement('span');
    hint.id = control.id + '-hint';
    hint.textContent = t(hintKey);
    control.setAttribute('aria-describedby', hint.id);
    help.append(hint);
  }
  if (max) {
    const count = document.createElement('span');
    count.className = 'group-editor-count';
    count.setAttribute('aria-hidden', 'true');
    const update = () => (count.textContent = control.value.length + '/' + max);
    control.addEventListener('input', update);
    update();
    help.append(count);
  }
  if (help.childNodes.length) wrap.append(help);
  return wrap;
}

/** A fieldset with a counted legend and a hint saying what unchecking does. */
function section(legendKey, count, hintKey) {
  const set = document.createElement('fieldset');
  set.className = 'group-editor-section';
  const legend = document.createElement('legend');
  legend.textContent = t(legendKey, { count });
  set.append(legend);
  if (hintKey) {
    const hint = document.createElement('p');
    hint.className = 'group-editor-hint';
    hint.textContent = t(hintKey);
    set.append(hint);
  }
  const list = document.createElement('div');
  list.className = 'group-members';
  set.append(list);
  return { set, list };
}

/** A checkbox row bound to a Set; unchecked items are dropped when the dialog is saved. */
function checkRow(value, text, set, onChange, badgeKey = '') {
  const label = document.createElement('label'),
    box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = set.has(value);
  box.value = value;
  box.onchange = () => {
    if (box.checked) set.add(value);
    else set.delete(value);
    onChange();
  };
  const name = document.createElement('span');
  name.textContent = text;
  label.append(box, name);
  if (badgeKey) {
    const badge = document.createElement('span');
    badge.className = 'group-editor-badge';
    badge.textContent = t(badgeKey);
    label.append(badge);
  }
  return label;
}

export function createGroupEditor({ dialog, toast, project, onApply }) {
  return async function editGroup(id, ids = []) {
    const original = project();
    const group = cardGroups(original).find((g) => g.id === id);
    const members = group?.cardIds || ids;
    // Where a new group goes: top level, or inside the group its notes already share.
    const place = group ? null : newGroupParent(original, members);
    if (!group && (members.length < 2 || place.issue)) {
      toast(members.length < 2 ? 'groupSelectCards' : place.issue);
      return;
    }
    const groupTitle = (groupId) => cardGroups(original).find((g) => g.id === groupId)?.title || '';
    const subgroups = group ? groupTree(original).children.get(group.id) || [] : [];
    const options = group ? parentOptions(original, group.id) : [];
    let parentId = group?.parentId || null;
    const card = (cardId) => original.cards.find((c) => c.id === cardId);
    const cardTitle = (cardId) => card(cardId)?.title || cardId;
    let title = group?.title || t('newGroup');
    let description = group?.description || '';
    const selected = new Set(members);
    const links = group?.links || [];
    const keptLinks = new Set(links.map((link) => link.id));
    // A group may keep only subgroups, but it must not end up with nothing inside.
    const blocked = () => !title.trim() || (!selected.size && !subgroups.length);
    let status = null;
    const refresh = () => {
      const save = document.querySelector('[data-choice=save-group]');
      if (save) save.disabled = blocked();
      // Say why saving is unavailable instead of only greying the button out (UX-28).
      if (status)
        status.textContent = !title.trim()
          ? t('groupNameRequired')
          : !selected.size && !subgroups.length
            ? t(group?.parentId ? 'groupNeedsMemberNested' : 'groupNeedsMember')
            : '';
    };
    const body = () => {
      const host = document.createElement('div');
      host.className = 'group-editor';

      const name = document.createElement('input');
      name.type = 'text';
      name.id = 'group-name';
      name.name = 'group-name';
      name.value = title;
      name.maxLength = TITLE_MAX;
      name.required = true;
      name.autocomplete = 'off';
      name.oninput = () => {
        title = name.value;
        refresh();
      };
      name.onkeydown = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          document.querySelector('[data-choice=save-group]')?.click();
        }
      };
      const area = document.createElement('textarea');
      area.id = 'group-description';
      area.name = 'group-description';
      area.value = description;
      area.maxLength = DESCRIPTION_MAX;
      area.rows = 3;
      area.oninput = () => {
        description = area.value;
      };
      host.append(
        field('groupName', name),
        field('groupDescription', area, {
          hintKey: 'groupDescriptionHint',
          optional: true,
          max: DESCRIPTION_MAX,
        }),
      );
      if (group) {
        const parent = document.createElement('select');
        parent.id = 'group-parent';
        parent.name = 'group-parent';
        for (const [value, text] of [
          ['', t('groupParentNone')],
          ...options.map((g) => [g.id, g.title]),
        ]) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = text;
          option.selected = value === (parentId || '');
          parent.append(option);
        }
        parent.onchange = () => {
          parentId = parent.value || null;
        };
        host.append(field('groupParent', parent, { hintKey: 'groupParentHint' }));
      }

      // Creating shows who will be grouped; editing lets members be taken out.
      const people = section(
        'groupMembersTitle',
        members.length,
        group
          ? group.parentId
            ? 'groupMembersNestedHint'
            : 'groupMembersHint'
          : place.parentId
            ? ''
            : 'groupMembersCreateHint',
      );
      if (!group && place.parentId) {
        const hint = document.createElement('p');
        hint.className = 'group-editor-hint';
        hint.textContent = t('groupMembersSubgroupHint', { title: groupTitle(place.parentId) });
        people.list.before(hint);
      }
      for (const member of members) {
        const badge = isPinned(card(member)) ? 'groupPinnedBadge' : '';
        if (group)
          people.list.append(checkRow(member, cardTitle(member), selected, refresh, badge));
        else {
          const row = document.createElement('div');
          row.className = 'group-editor-item';
          row.textContent = cardTitle(member);
          if (badge) {
            const tag = document.createElement('span');
            tag.className = 'group-editor-badge';
            tag.textContent = t(badge);
            row.append(tag);
          }
          people.list.append(row);
        }
      }
      host.append(people.set);

      if (subgroups.length) {
        const nested = section('groupSubgroupsTitle', subgroups.length, 'groupSubgroupsHint');
        for (const child of subgroups) {
          const row = document.createElement('div');
          row.className = 'group-editor-item';
          row.textContent = groupTitle(child);
          const tag = document.createElement('span');
          tag.className = 'group-editor-badge';
          const count = groupCardIds(original, child).length;
          tag.textContent = t(count === 1 ? 'groupNoteCountOne' : 'groupNoteCount', { count });
          row.append(tag);
          nested.list.append(row);
        }
        host.append(nested.set);
      }

      if (links.length) {
        const arrows = section('groupLinksTitle', links.length, 'groupLinksHint');
        arrows.set.classList.add('group-links-section');
        arrows.list.classList.add('group-links-list');
        for (const link of links)
          arrows.list.append(
            checkRow(
              link.id,
              t('groupLinkFrom', { title: cardTitle(link.source) }),
              keptLinks,
              () => {},
            ),
          );
        host.append(arrows.set);
      }

      status = document.createElement('p');
      status.className = 'group-editor-status';
      status.setAttribute('role', 'status');
      const tip = document.createElement('p');
      tip.className = 'group-editor-tip';
      tip.textContent = t('groupMoveHint');
      host.append(status, tip);
      refresh();
      // A new group starts with a placeholder name; select it so typing replaces it.
      if (!group) window.queueMicrotask(() => name.isConnected && name.select());
      return host;
    };
    const choice = await dialog(group ? 'groupEdit' : 'groupCreate', body, [
      ['cancel', 'cancel'],
      [group ? 'groupSave' : 'groupCreate', 'save-group', true, blocked],
    ]);
    if (choice !== 'save-group' || project() !== original) return;
    onApply(group?.id || null, {
      title: title.trim(),
      description: description.trim(),
      cardIds: members.filter((member) => selected.has(member)),
      linkIds: [...keptLinks],
      ...(group ? { parentId } : {}),
    });
  };
}
