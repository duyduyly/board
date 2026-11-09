import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PET_CHAT_CONFIG,
  PET_LINE_KEYS,
  createPetChat,
  isTypingTarget,
  nextDelayMs,
  pickLineKey,
} from '../assets/js/ui/pet-chat.js';
import { bubbleShift } from '../assets/js/ui/pixel-cat.js';
import vi from '../assets/js/i18n/vi.js';
import en from '../assets/js/i18n/en.js';

const MINUTE = 60000;

test('nextDelayMs stays inside the configured 7-15 minute window', () => {
  assert.equal(
    nextDelayMs(PET_CHAT_CONFIG, () => 0),
    7 * MINUTE,
  );
  assert.equal(
    nextDelayMs(PET_CHAT_CONFIG, () => 1),
    15 * MINUTE,
  );
});

test('pickLineKey never repeats the previous line and stays within the pet lines', () => {
  for (const pet of ['cat', 'dog']) {
    for (const previous of PET_LINE_KEYS[pet]) {
      for (const r of [0, 0.5, 0.999]) {
        const key = pickLineKey(pet, () => r, previous);
        assert.ok(PET_LINE_KEYS[pet].includes(key));
        assert.notEqual(key, previous);
      }
    }
  }
  assert.equal(pickLineKey('bird'), null);
});

test('cat lines say Mew and dog lines say Gâu/Woof, never swapped, in both locales', () => {
  for (const key of PET_LINE_KEYS.cat) {
    assert.match(vi[key], /^Mew/);
    assert.match(en[key], /^Mew/);
    assert.doesNotMatch(vi[key] + en[key], /Gâu|Woof/);
  }
  for (const key of PET_LINE_KEYS.dog) {
    assert.match(vi[key], /^Gâu/);
    assert.match(en[key], /^Woof/);
    assert.doesNotMatch(vi[key] + en[key], /Mew/);
  }
});

test('lines make no claim about task progress', () => {
  for (const key of [...PET_LINE_KEYS.cat, ...PET_LINE_KEYS.dog])
    assert.doesNotMatch(vi[key] + en[key], /xong rồi|sắp xong|almost done|finished/i);
});

test('bubbleShift keeps the bubble inside the viewport and is zero when it already fits', () => {
  assert.equal(bubbleShift(500, 48, 200, 1000), 0);
  assert.equal(bubbleShift(0, 48, 200, 1000), 8 - (24 - 100));
  const right = bubbleShift(952, 48, 200, 1000);
  assert.equal(976 - 100 + right + 200, 1000 - 8);
  assert.equal(bubbleShift(10, 48, 2000, 300), 8 - (34 - 1000));
});

test('isTypingTarget is true for text fields and contenteditable only', () => {
  assert.equal(isTypingTarget({ nodeType: 1, tagName: 'INPUT', type: 'text' }), true);
  assert.equal(isTypingTarget({ nodeType: 1, tagName: 'TEXTAREA' }), true);
  assert.equal(isTypingTarget({ nodeType: 1, tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isTypingTarget({ nodeType: 1, tagName: 'INPUT', type: 'checkbox' }), false);
  assert.equal(isTypingTarget({ nodeType: 1, tagName: 'BUTTON' }), false);
  assert.equal(isTypingTarget(null), false);
});

function harness(overrides = {}) {
  const calls = [];
  const queue = [];
  const listeners = new Map();
  let clock = 0;
  const doc = {
    hidden: false,
    activeElement: null,
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
  };
  const timers = {
    set: (fn, delay) => {
      queue.push({ fn, delay });
      return queue.length;
    },
    clear: () => {},
  };
  const chat = createPetChat({
    getPet: () => 'dog',
    speak: (text, duration, pause) => (calls.push({ text, duration, pause }), true),
    t: (key) => key,
    random: () => 0,
    doc,
    now: () => clock,
    timers,
    ...overrides,
  });
  const fire = () => queue.pop().fn();
  return { calls, queue, doc, listeners, chat, fire, advance: (ms) => (clock += ms) };
}

test('scheduled chat speaks with a pause, then schedules the next one 7 minutes later', () => {
  const h = harness();
  assert.equal(h.queue.at(-1).delay, 7 * MINUTE);
  h.fire();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].pause, true);
  assert.match(h.calls[0].text, /^petDogLine/);
  assert.equal(h.queue.at(-1).delay, 7 * MINUTE);
});

test('chat waits while typing, on a hidden tab or when the user is away, and retries soon', () => {
  const h = harness();
  h.doc.activeElement = { nodeType: 1, tagName: 'TEXTAREA' };
  h.fire();
  assert.equal(h.calls.length, 0);
  assert.equal(h.queue.at(-1).delay, PET_CHAT_CONFIG.retryMs);
  h.doc.activeElement = null;
  h.doc.hidden = true;
  h.fire();
  assert.equal(h.calls.length, 0);
  h.doc.hidden = false;
  h.advance(PET_CHAT_CONFIG.activeWindowMs + 1);
  h.fire();
  assert.equal(h.calls.length, 0);
  h.listeners.get('keydown')();
  h.fire();
  assert.equal(h.calls.length, 1);
});

test('click talks immediately without pausing the pet; disabled config stays silent', () => {
  const h = harness();
  h.chat.click();
  assert.equal(h.calls[0].pause, false);
  const off = harness({ config: { enabled: false } });
  assert.equal(off.queue.length, 0);
  assert.equal(off.listeners.size, 0);
  const noClick = harness({ config: { clickToTalk: false } });
  noClick.chat.click();
  assert.equal(noClick.calls.length, 0);
});

test('a failed speak (pet off or jumping) does not consume the line and retries', () => {
  const h = harness({ speak: () => false });
  h.fire();
  assert.equal(h.queue.at(-1).delay, PET_CHAT_CONFIG.retryMs);
});

test('destroy removes the activity listeners', () => {
  const h = harness();
  h.chat.destroy();
  assert.equal(h.listeners.size, 0);
});
