import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import en from '../assets/js/i18n/en.js';
import vi from '../assets/js/i18n/vi.js';

const probeSource = `
  import { calendarDate, dateRange, setLocale } from './assets/js/i18n/index.js';
  setLocale(process.argv[1]);
  console.log(JSON.stringify([
    calendarDate('2026-03-08'),
    calendarDate('2026-12-31'),
    dateRange('2026-03-08', null),
    dateRange('2026-03-08', '2026-03-12'),
    calendarDate('not-a-date'),
    dateRange('2026-03-08', 'bad'),
  ]));
`;

function probe(timeZone, locale) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', probeSource, locale], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, TZ: timeZone },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('timeline i18n keys exist in both locales with equal placeholders', () => {
  const keys = Object.keys(vi).filter((key) => /^(timeline|schedule|errorSchedule)/.test(key));
  assert.ok(keys.length >= 30);
  assert.deepEqual(Object.keys(en).sort(), Object.keys(vi).sort());
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of keys) assert.deepEqual(placeholders(en[key]), placeholders(vi[key]), key);
  assert.equal(
    vi.timelineEventOrder,
    'Theo thứ tự sự kiện — khoảng cách không theo tỷ lệ thời gian',
  );
  assert.equal(en.timelineEventOrder, 'Event order — spacing is not to time scale');
  for (const guide of [vi.aiGuide, en.aiGuide])
    assert.match(guide, /card-atlas:schedule[\s\S]*card-atlas:timeline/);
});

test('calendar dates do not shift day across time zones', () => {
  for (const timeZone of ['UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/New_York']) {
    const [march8, dec31, single, range, invalid, badEnd] = probe(timeZone, 'en');
    assert.match(march8, /\b8\b.*2026/, timeZone);
    assert.match(dec31, /\b31\b.*2026/, timeZone);
    assert.equal(single, march8, timeZone);
    assert.match(range, /8.*12/, timeZone);
    assert.equal(invalid, 'not-a-date');
    assert.ok(badEnd.includes('–') && badEnd.includes('not') === false, timeZone);
  }
  const base = probe('UTC', 'vi');
  assert.deepEqual(probe('Pacific/Kiritimati', 'vi'), base);
  assert.deepEqual(probe('America/Los_Angeles', 'vi'), base);
});
