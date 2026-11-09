// Bong bóng hội thoại của thú cưng: thỉnh thoảng hỏi thăm người dùng bằng câu có sẵn (không AI, không API).
// Logic chọn câu/độ trễ là hàm thuần; controller nhận ports (speak, getPet, t) và không biết model/store (CC-12).

import { pickInRange } from './pixel-cat.js';

export const PET_CHAT_CONFIG = {
  enabled: true,
  intervalMinutes: [7, 15],
  bubbleDuration: [4000, 6000],
  /** Chỉ nói khi người dùng vừa thao tác trong khoảng này; im lặng khi bỏ máy. */
  activeWindowMs: 120000,
  /** Khi chưa đủ điều kiện (đang gõ, tab ẩn, bỏ máy) thử lại sau khoảng này thay vì bỏ cả lượt. */
  retryMs: 30000,
  pauseOnHiddenTab: true,
  pauseWhileTyping: true,
  clickToTalk: true,
};

const MINUTE_MS = 60000;
const LINE_COUNT = 6;
/** Tiếng kêu nằm trong chính câu nói trong từ điển: mèo là "Mew", chó là "Gâu" (vi) / "Woof" (en). */
export const PET_LINE_KEYS = {
  cat: Array.from({ length: LINE_COUNT }, (_, i) => `petCatLine${i + 1}`),
  dog: Array.from({ length: LINE_COUNT }, (_, i) => `petDogLine${i + 1}`),
};

/** Độ trễ (ms) tới lần nói tự động kế tiếp. */
export function nextDelayMs(config, random = Math.random) {
  return Math.round(pickInRange(random, config.intervalMinutes) * MINUTE_MS);
}

/** Chọn một key câu nói, tránh lặp lại câu vừa nói. */
export function pickLineKey(pet, random = Math.random, previous = null) {
  const keys = PET_LINE_KEYS[pet] ?? [];
  const pool = keys.length > 1 ? keys.filter((key) => key !== previous) : keys;
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))] : null;
}

/** Phần tử đang nhận chữ gõ: input/textarea/select hoặc vùng contenteditable (kể cả trình soạn thảo trong Detail). */
export function isTypingTarget(node) {
  if (!node || node.nodeType !== 1) return false;
  if (node.isContentEditable) return true;
  const tag = node.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  return !['button', 'checkbox', 'radio', 'range', 'file', 'color', 'submit', 'reset'].includes(
    node.type,
  );
}

/**
 * @param {{
 *   getPet: () => string,
 *   speak: (text: string, durationMs: number, pause: boolean) => boolean,
 *   t: (key: string) => string,
 *   config?: Partial<typeof PET_CHAT_CONFIG>,
 *   random?: () => number,
 *   doc?: Document,
 *   now?: () => number,
 *   timers?: { set: typeof setTimeout, clear: typeof clearTimeout },
 * }} ports
 */
export function createPetChat({
  getPet,
  speak,
  t,
  config: overrides,
  random = Math.random,
  doc = document,
  now = () => Date.now(),
  timers = { set: (...args) => setTimeout(...args), clear: (id) => clearTimeout(id) },
}) {
  const config = { ...PET_CHAT_CONFIG, ...overrides };
  let timer = 0;
  let previousKey = null;
  let lastActivity = now();

  const touch = () => {
    lastActivity = now();
  };
  const blocked = () =>
    (config.pauseOnHiddenTab && doc.hidden) ||
    (config.pauseWhileTyping && isTypingTarget(doc.activeElement)) ||
    now() - lastActivity > config.activeWindowMs;

  function say(pause = false) {
    const key = pickLineKey(getPet(), random, previousKey);
    if (!key) return false;
    const spoken = speak(t(key), Math.round(pickInRange(random, config.bubbleDuration)), pause);
    if (spoken) previousKey = key;
    return spoken;
  }

  function schedule(delay) {
    timers.clear(timer);
    timer = timers.set(fire, delay);
  }

  function fire() {
    if (blocked() || !say(true)) return schedule(config.retryMs);
    schedule(nextDelayMs(config, random));
  }

  if (config.enabled) {
    for (const type of ['pointerdown', 'keydown']) doc.addEventListener(type, touch, true);
    schedule(nextDelayMs(config, random));
  }

  return {
    /** Bấm vào thú: nói ngay một câu (không dừng thú, thú đang nhảy). */
    click() {
      if (config.clickToTalk) say(false);
    },
    destroy() {
      timers.clear(timer);
      for (const type of ['pointerdown', 'keydown']) doc.removeEventListener(type, touch, true);
    },
  };
}
