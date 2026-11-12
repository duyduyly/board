import { t } from '../i18n/index.js';
import { VIDEO_CLASS, youtubeEmbedURL, youtubeVideoId } from '../graph/youtube.js';

const PLAYER_ALLOW = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
const PLAYER_SANDBOX = 'allow-scripts allow-same-origin allow-presentation allow-popups';

function element(doc, tag, className) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  return node;
}

function placeholder(doc, link, id) {
  const title = link.textContent.trim();
  const figure = element(doc, 'figure', 'board-video-frame');
  figure.dataset.videoId = id;
  const play = element(doc, 'button', 'board-video-play');
  play.type = 'button';
  play.setAttribute('aria-label', t('videoPlay').replace('{title}', title));
  play.textContent = title;
  const note = element(doc, 'figcaption', 'board-video-note');
  note.textContent = t('videoNetworkNotice') + ' ';
  const open = element(doc, 'a');
  open.href = link.href;
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  open.textContent = t('videoOpenYouTube');
  note.append(open);
  figure.append(play, note);
  return figure;
}

/**
 * Replaces valid `a.board-video` links in the reading frame with click-to-play placeholders.
 * The player itself lives in `host` (the parent of the reading iframe), laid over the placeholder,
 * because the sandboxed reading document cannot run or embed the YouTube player.
 * @param {HTMLIFrameElement} frame the reading iframe
 * @param {Document} doc the reading iframe document
 * @param {HTMLElement} host positioned element that contains `frame`
 * @returns {{ relayout(): void, dispose(): void }}
 */
export function mountVideoPlayers(frame, doc, host) {
  for (const link of doc.querySelectorAll('a.' + VIDEO_CLASS)) {
    const id = youtubeVideoId(link.getAttribute('href') || '');
    if (!id) continue;
    const parent = link.parentElement;
    const alone = parent?.tagName === 'P' && parent.childNodes.length === 1;
    (alone ? parent : link).replaceWith(placeholder(doc, link, id));
  }

  /** @type {Map<HTMLElement, { box: HTMLElement, player: HTMLElement }>} play button -> open player */
  const open = new Map();

  // The player covers the 16:9 play button only, so the caption below it stays readable.
  const place = (box, rect) => {
    box.style.left = frame.offsetLeft + frame.clientLeft + rect.left + 'px';
    box.style.top = frame.offsetTop + frame.clientTop + rect.top + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
  };

  const relayout = () => {
    const rects = [...open.keys()].map((button) => button.getBoundingClientRect());
    [...open.values()].forEach(({ box }, index) => place(box, rects[index]));
  };

  const close = (button) => {
    const entry = open.get(button);
    if (!entry) return;
    entry.box.remove();
    open.delete(button);
    button.removeAttribute('tabindex');
    button.focus();
  };

  const play = (button) => {
    const existing = open.get(button);
    if (existing) {
      existing.player.focus();
      return;
    }
    const figure = button.closest('figure');
    const box = element(document, 'div', 'reading-video-player');
    box.style.position = 'absolute';
    const player = element(document, 'iframe');
    player.src = youtubeEmbedURL(figure.dataset.videoId);
    player.title = t('videoPlayerTitle');
    player.allow = PLAYER_ALLOW;
    player.allowFullscreen = true;
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    player.setAttribute('sandbox', PLAYER_SANDBOX);
    const closeButton = element(document, 'button', 'reading-video-close');
    closeButton.type = 'button';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', t('videoClose'));
    closeButton.title = t('videoClose');
    closeButton.addEventListener('click', () => close(button));
    // Escape closes the video only; without this the Detail dialog behind it would close too.
    box.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close(button);
    });
    box.append(player, closeButton);
    open.set(button, { box, player });
    // The covered play button leaves the Tab order while its player is open.
    button.tabIndex = -1;
    host.append(box);
    place(box, button.getBoundingClientRect());
    player.focus();
  };

  const onClick = (event) => {
    const button = event.target.closest?.('.board-video-play');
    if (button) play(button);
  };
  doc.addEventListener('click', onClick);

  return {
    relayout,
    dispose() {
      doc.removeEventListener('click', onClick);
      for (const [button, { box }] of open) {
        box.remove();
        button.removeAttribute('tabindex');
      }
      open.clear();
    },
  };
}
