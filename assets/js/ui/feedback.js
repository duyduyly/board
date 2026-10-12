import { query as $ } from '../common/dom.js';
import { escapeHTML as esc } from '../common/html.js';
import { t, getLocale, setLocale } from '../i18n/index.js';
export function createFeedback({ onLocaleChange }) {
  let modalState = null,
    toastTimer = null;
  function toast(key) {
    clearTimeout(toastTimer);
    $('#toast').textContent = t(key);
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => ($('#toast').hidden = true), 5000);
  }
  function dialog(titleKey, body, buttons) {
    if (modalState) throw Error('dialog already open');
    return new Promise((resolve) => {
      modalState = { titleKey, body, buttons, resolve };
      renderModal();
      $('#modal').showModal();
    });
  }
  function renderModal() {
    if (!modalState) return;
    const { titleKey, body, buttons } = modalState;
    $('#modal-content').innerHTML =
      '<div class="modal-inner"><h2>' +
      esc(t(titleKey)) +
      '</h2><select id="modal-locale" aria-label="Tiếng Việt / English"><option value="vi">Tiếng Việt</option><option value="en">English</option></select><div class="modal-body"></div><div class="modal-actions"></div></div>';
    $('#modal-locale').value = getLocale();
    $('#modal-locale').onchange = (e) => {
      $('#locale').value = e.target.value;
      setLocale(e.target.value);
      onLocaleChange();
      renderModal();
    };
    const result = body();
    const host = $('.modal-body');
    if (typeof result === 'string') host.innerHTML = result;
    else host.append(result);
    for (const [key, value, primary = false, disabled = false] of buttons) {
      const b = document.createElement('button');
      b.textContent = t(key);
      b.disabled = typeof disabled === 'function' ? disabled() : disabled;
      b.className = primary ? 'primary' : '';
      b.dataset.choice = value;
      b.onclick = () => finishDialog(value);
      $('.modal-actions').append(b);
    }
  }
  function finishDialog(value) {
    const state = modalState;
    if (!state) return;
    modalState = null;
    $('#modal').close();
    state.resolve(value);
  }
  $('#modal').addEventListener('cancel', (e) => {
    e.preventDefault();
    finishDialog('cancel');
  });
  async function showMessage(titleKey, message) {
    if (modalState) return;
    return dialog(titleKey, () => '<pre>' + esc(message()) + '</pre>', [['close', 'cancel']]);
  }

  return {
    toast,
    dialog,
    renderModal,
    finishDialog,
    showMessage,
    get state() {
      return modalState;
    },
  };
}
