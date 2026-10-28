import { cardGroups } from '../graph/card-groups.js';
import { t } from '../i18n/index.js';
import { escapeHTML as esc } from '../common/html.js';
import { labelField } from './forms.js';

export function createGroupEditor({ dialog, toast, project, onApply }) {
  return async function editGroup(id, ids = []) {
    const original = project();
    const group = cardGroups(original).find((g) => g.id === id);
    const members = group?.cardIds || ids;
    if (
      !group &&
      (members.length < 2 ||
        members.some((id) => cardGroups(original).some((g) => g.cardIds.includes(id))))
    ) {
      toast(members.length < 2 ? 'groupSelectCards' : 'groupAlreadyAssigned');
      return;
    }
    let title = group?.title || t('newGroup');
    let selected = new Set(members);
    const body = () => {
      const host = document.createElement('div');
      host.className = 'group-editor';
      host.innerHTML =
        labelField('groupName', 'group-name', title) +
        '<p>' +
        esc(t('groupMoveHint')) +
        '</p><div class="group-members"></div>';
      const input = host.querySelector('input');
      input.maxLength = 120;
      input.required = true;
      input.onkeydown = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          document.querySelector('[data-choice=save-group]')?.click();
        }
      };
      input.oninput = () => {
        title = input.value;
        document.querySelector('[data-choice=save-group]').disabled =
          !title.trim() || !selected.size;
      };
      if (group)
        for (const member of members) {
          const label = document.createElement('label'),
            box = document.createElement('input');
          box.type = 'checkbox';
          box.checked = true;
          box.value = member;
          box.onchange = () => {
            if (box.checked) selected.add(member);
            else selected.delete(member);
            document.querySelector('[data-choice=save-group]').disabled =
              !title.trim() || !selected.size;
          };
          label.append(
            box,
            document.createTextNode(original.cards.find((c) => c.id === member).title),
          );
          host.querySelector('.group-members').append(label);
        }
      return host;
    };
    const choice = await dialog(group ? 'groupEdit' : 'groupCreate', body, [
      ['cancel', 'cancel'],
      ['apply', 'save-group', true],
    ]);
    if (choice !== 'save-group' || project() !== original) return;
    onApply(
      group?.id || null,
      title.trim(),
      members.filter((member) => selected.has(member)),
    );
  };
}
