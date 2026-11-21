import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32 as nodeCrc32 } from 'node:zlib';
import { crc32, zipStore } from '../assets/js/word-export/zip.js';
import {
  decodeBase64,
  fitImage,
  imageSize,
  EMU_PER_PIXEL,
} from '../assets/js/word-export/media.js';
import { readZip, readZipText } from './docx-zip-reader.mjs';

const text = (s) => new TextEncoder().encode(s);

test('crc32 khớp zlib.crc32', () => {
  const inputs = [
    new Uint8Array(),
    text('a'),
    text('123456789'),
    text('Xin chào Việt Nam'),
    Uint8Array.from({ length: 1000 }, (_, i) => i * 7),
  ];
  for (const input of inputs) assert.equal(crc32(input), nodeCrc32(input));
  assert.equal(crc32(text('123456789')), 0xcbf43926);
});

test('zipStore round-trip với tên UTF-8 và file rỗng', () => {
  const files = [
    { name: '[Content_Types].xml', data: text('<Types/>') },
    { name: 'word/tài-liệu.xml', data: text('Nội dung tiếng Việt') },
    { name: 'empty.txt', data: new Uint8Array() },
    { name: 'word/media/a.bin', data: Uint8Array.from({ length: 300 }, (_, i) => i) },
  ];
  const zip = zipStore(files);
  const read = readZip(zip);
  assert.deepEqual(
    [...read.keys()],
    files.map((f) => f.name),
  );
  for (const f of files) assert.deepEqual(read.get(f.name), f.data);
  assert.equal(readZipText(zip).get('word/tài-liệu.xml'), 'Nội dung tiếng Việt');
});

test('zipStore tất định và hỗ trợ zip rỗng', () => {
  const files = [{ name: 'a.txt', data: text('hello') }];
  assert.deepEqual(zipStore(files), zipStore(files));
  assert.equal(readZip(zipStore([])).size, 0);
});

const u32be = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16le = (n) => [n & 255, n >> 8];
const u24le = (n) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

const png = (w, h) =>
  Uint8Array.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...u32be(13),
    ...ascii('IHDR'),
    ...u32be(w),
    ...u32be(h),
    8,
    6,
    0,
    0,
    0,
  ]);

test('imageSize PNG', () => {
  assert.deepEqual(imageSize(png(640, 480), 'image/png'), { width: 640, height: 480 });
  assert.equal(imageSize(png(640, 480).subarray(0, 20), 'image/png'), null);
  assert.equal(imageSize(Uint8Array.from([1, 2, 3]), 'image/png'), null);
});

test('imageSize JPEG bỏ qua marker khác SOF', () => {
  const app0 = [0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46];
  const sof = (m) => [0xff, m, 0x00, 0x0b, 8, 300 >> 8, 300 & 255, 0, 200, 3, 0, 0];
  for (const marker of [0xc0, 0xc1, 0xc2]) {
    const bytes = Uint8Array.from([0xff, 0xd8, ...app0, ...sof(marker)]);
    assert.deepEqual(imageSize(bytes, 'image/jpeg'), { width: 200, height: 300 });
  }
  assert.equal(imageSize(Uint8Array.from([0xff, 0xd8, ...app0]), 'image/jpeg'), null);
  assert.equal(imageSize(Uint8Array.from([0xff, 0xd8, 0xff]), 'image/jpeg'), null);
});

test('imageSize GIF', () => {
  const gif = Uint8Array.from([...ascii('GIF89a'), ...u16le(33), ...u16le(17), 0, 0, 0]);
  assert.deepEqual(imageSize(gif, 'image/gif'), { width: 33, height: 17 });
  assert.equal(imageSize(gif.subarray(0, 8), 'image/gif'), null);
});

test('imageSize WebP VP8, VP8L, VP8X', () => {
  const riff = (chunk) => [...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP'), ...chunk];
  const vp8 = Uint8Array.from(
    riff([...ascii('VP8 '), 10, 0, 0, 0, 0, 0, 0, 0x9d, 0x01, 0x2a, ...u16le(320), ...u16le(240)]),
  );
  assert.deepEqual(imageSize(vp8, 'image/webp'), { width: 320, height: 240 });
  const bits = 100 - 1 + ((50 - 1) << 14);
  const vp8l = Uint8Array.from(
    riff([
      ...ascii('VP8L'),
      5,
      0,
      0,
      0,
      0x2f,
      bits & 255,
      (bits >> 8) & 255,
      (bits >> 16) & 255,
      (bits >>> 24) & 255,
    ]),
  );
  assert.deepEqual(imageSize(vp8l, 'image/webp'), { width: 100, height: 50 });
  const vp8x = Uint8Array.from(
    riff([...ascii('VP8X'), 10, 0, 0, 0, 0, 0, 0, 0, ...u24le(1999), ...u24le(999)]),
  );
  assert.deepEqual(imageSize(vp8x, 'image/webp'), { width: 2000, height: 1000 });
  assert.equal(imageSize(vp8x.subarray(0, 25), 'image/webp'), null);
  assert.equal(imageSize(vp8, 'image/bmp'), null);
});

test('decodeBase64', () => {
  assert.deepEqual(decodeBase64('AQID'), Uint8Array.from([1, 2, 3]));
  assert.equal(decodeBase64('').length, 0);
});

test('fitImage giới hạn bề rộng, giữ tỉ lệ, trả số nguyên dương', () => {
  const size = { width: 800, height: 400 };
  const emu = (w, h) => ({ cx: w * EMU_PER_PIXEL, cy: h * EMU_PER_PIXEL });
  assert.deepEqual(fitImage(size, { maxWidthPx: 400 }), emu(400, 200));
  assert.deepEqual(fitImage(size, { widthPx: 200, maxWidthPx: 400 }), emu(200, 100));
  assert.deepEqual(fitImage(size, { widthPx: 900, maxWidthPx: 400 }), emu(400, 200));
  assert.deepEqual(fitImage(size, { maxWidthPx: 1600 }), emu(800, 400));
  const tiny = fitImage({ width: 1000, height: 1 }, { widthPx: 3, maxWidthPx: 400 });
  assert.ok(Number.isInteger(tiny.cx) && Number.isInteger(tiny.cy) && tiny.cx > 0 && tiny.cy > 0);
});
