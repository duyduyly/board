// Session-only shortcut. Never receives project content or a store reference.
export function installChatGPTLauncher() {
  const launcher = document.querySelector('#chatgpt-launcher');
  const toggle = document.querySelector('#chatgpt-visible');
  const menu = document.querySelector('#project-menu');
  toggle.addEventListener('change', () => {
    launcher.hidden = !toggle.checked;
  });
  document.querySelector('#chatgpt-hide').addEventListener('click', () => {
    toggle.checked = false;
    launcher.hidden = true;
    menu.querySelector(':scope > summary').focus();
  });
  document.querySelector('#chatgpt-open').addEventListener('click', () => {
    const width = Math.min(480, window.screen.availWidth);
    const height = Math.min(820, window.screen.availHeight);
    const left = (window.screen.availLeft || 0) + window.screen.availWidth - width;
    const top = window.screen.availTop || 0;
    // noopener intentionally returns null even on success; do not infer blocking from it.
    // A normal new-tab link remains available in the project menu.
    window.open(
      'https://chatgpt.com/',
      '_blank',
      `popup,noopener,noreferrer,resizable=yes,scrollbars=yes,width=${width},height=${height},left=${left},top=${top}`,
    );
  });
}
