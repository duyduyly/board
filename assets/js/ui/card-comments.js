import { t, number, dateTime } from '../i18n/index.js';
import { cardComments, commentBlocks, COMMENT_LIMITS } from '../graph/card-comments.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function blockNode(block) {
  if (block.type === 'paragraph') {
    const p = element('p');
    block.lines.forEach((line, index) => {
      if (index) p.append(document.createElement('br'));
      p.append(line);
    });
    return p;
  }
  const list = element(block.ordered ? 'ol' : 'ul');
  if (block.ordered && block.start !== undefined) list.start = block.start;
  for (const item of block.items) list.append(element('li', '', item));
  return list;
}

export function createCardComments({ onAdd, onRemove }) {
  // Chữ chưa gửi theo note, chỉ trong phiên; sống qua các lần mount lại.
  const pending = new Map();
  // Focus cần đặt sau lần mount kế tiếp (app dựng lại panel sau khi lệnh thành công).
  let nextFocus = null;
  // Thông báo hiện trong Detail sau lần mount kế tiếp; toast chung nằm dưới dialog modal.
  let nextStatus = '';

  function mount(host, { card, locked }) {
    const refocusTyping =
      host.contains(document.activeElement) && document.activeElement?.id === 'card-comment-text';
    const items = [...cardComments(card)].reverse();
    const section = element('section', 'card-comments');
    section.setAttribute('aria-labelledby', 'card-comments-title');
    const title = element('h3', '', t('commentsTitle') + ' (' + number(items.length) + ')');
    title.id = 'card-comments-title';
    title.tabIndex = -1;
    const status = element('p', 'card-comment-status', nextStatus);
    status.setAttribute('role', 'status');
    status.hidden = !nextStatus;
    nextStatus = '';
    section.append(title, status);

    let area = null,
      addButton = null,
      lengthText = null,
      errorText = null;
    if (locked) section.append(element('p', 'card-comments-locked', t('commentPinned')));
    else {
      const composer = element('div', 'card-comment-composer');
      const label = element('label', '', t('commentInputLabel'));
      label.htmlFor = 'card-comment-text';
      area = element('textarea');
      area.id = 'card-comment-text';
      area.name = 'comment-text';
      area.rows = 3;
      area.placeholder = t('commentPlaceholder');
      area.value = pending.get(card.id) || '';
      const actions = element('div', 'card-comment-actions');
      lengthText = element('span', 'card-comment-length');
      lengthText.setAttribute('aria-live', 'polite');
      addButton = element('button', 'card-comment-add', t('commentAdd'));
      addButton.type = 'button';
      errorText = element('p', 'card-comment-error');
      errorText.setAttribute('role', 'alert');
      actions.append(
        element('span', 'card-comment-hint', t('commentAddHint')),
        lengthText,
        addButton,
      );
      composer.append(label, area, actions, errorText);
      section.append(composer);
    }

    if (!items.length) section.append(element('p', 'card-comments-empty', t('commentsEmpty')));
    else {
      const list = element('ol', 'card-comment-list');
      for (const comment of items) {
        const row = element('li', 'card-comment');
        row.dataset.commentId = comment.id;
        const head = element('div', 'card-comment-head');
        const time = element('time', '', dateTime(comment.createdAt));
        time.dateTime = comment.createdAt;
        head.append(time);
        if (!locked) {
          const remove = element('button', 'card-comment-delete', t('commentDelete'));
          remove.type = 'button';
          remove.setAttribute(
            'aria-label',
            t('commentDeleteLabel', { time: dateTime(comment.createdAt) }),
          );
          head.append(remove);
        }
        const body = element('div', 'card-comment-body');
        for (const block of commentBlocks(comment.text)) body.append(blockNode(block));
        row.append(head, body);
        list.append(row);
      }
      section.append(list);
    }

    function refresh() {
      if (!area) return;
      const length = area.value.length,
        full = items.length >= COMMENT_LIMITS.items,
        tooLong = length > COMMENT_LIMITS.text;
      lengthText.textContent = t('commentLength', {
        count: number(length),
        max: number(COMMENT_LIMITS.text),
      });
      area.disabled = full;
      addButton.disabled = full || tooLong || !area.value.trim();
      const message = full
        ? t('commentLimitReached', { max: number(COMMENT_LIMITS.items) })
        : tooLong
          ? t('commentTooLong', { max: number(COMMENT_LIMITS.text) })
          : '';
      errorText.textContent = message;
      errorText.hidden = !message;
    }

    function submit() {
      if (!area || addButton.disabled) return;
      const text = area.value;
      nextFocus = { type: 'textarea' };
      // onAdd commits and re-mounts synchronously, so the draft must be gone before the new mount reads it.
      pending.delete(card.id);
      if (onAdd(card.id, text)) return;
      pending.set(card.id, text);
      nextFocus = null;
    }

    section.addEventListener('click', (event) => {
      const target = event.target;
      if (target.closest('.card-comment-add')) submit();
      const remove = target.closest('.card-comment-delete');
      if (!remove) return;
      const row = remove.closest('.card-comment');
      nextFocus = {
        type: 'delete',
        index: [...section.querySelectorAll('.card-comment')].indexOf(row),
      };
      nextStatus = t('commentDeleted');
      if (onRemove(card.id, row.dataset.commentId)) return;
      nextFocus = null;
      nextStatus = '';
    });
    section.addEventListener('input', (event) => {
      if (event.target !== area) return;
      if (area.value) pending.set(card.id, area.value);
      else pending.delete(card.id);
      refresh();
    });
    section.addEventListener('keydown', (event) => {
      if (event.target === area && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        submit();
      } else if (
        event.target !== area &&
        (event.ctrlKey || event.metaKey) &&
        ['z', 'y'].includes(event.key.toLowerCase())
      )
        // Undo/Redo re-render the panel; keep keyboard users inside the comment section.
        nextFocus = { type: 'title' };
    });

    host.replaceChildren(section);
    refresh();
    const focus = nextFocus;
    nextFocus = null;
    if (focus?.type === 'textarea' || (!focus && refocusTyping)) {
      area?.focus();
      area?.setSelectionRange(area.value.length, area.value.length);
    } else if (focus?.type === 'delete') {
      const buttons = section.querySelectorAll('.card-comment-delete');
      (buttons[Math.min(focus.index, buttons.length - 1)] || title).focus();
    } else if (focus?.type === 'title') title.focus();
  }

  return { mount, clear: () => pending.clear() };
}
