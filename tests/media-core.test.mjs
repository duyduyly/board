import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeVideoId, youtubeEmbedURL, VIDEO_CLASS } from '../assets/js/graph/youtube.js';
import {
  isSafeDiagramSource,
  MERMAID_SOURCE_LIMIT,
  MERMAID_MAX_DIAGRAMS,
} from '../assets/js/graph/diagram-policy.js';
import { isSafeDiagramSource as legacyPolicy } from '../scripts/legacy-mermaid-policy.js';
import { imageFromDataURL, MAX_IMAGE_BYTES } from '../assets/js/detail/attachments.js';

const ID = 'dQw4w9WgXcQ';
const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const PNG = b64([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const GIF = b64(Buffer.from('GIF89a....'));

test('youtubeVideoId accepts the four supported link forms', () => {
  assert.equal(VIDEO_CLASS, 'board-video');
  for (const href of [
    `https://www.youtube.com/watch?v=${ID}&t=5`,
    `https://youtu.be/${ID}?si=x`,
    `https://m.youtube.com/shorts/${ID}`,
    `http://youtube.com/embed/${ID}`,
  ])
    assert.equal(youtubeVideoId(href), ID, href);
});

test('youtubeVideoId rejects foreign hosts, bad ids, credentials, ports and schemes', () => {
  for (const href of [
    `https://evil.com/watch?v=${ID}`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=' + ID + 'X',
    `https://user:pw@www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com:8080/watch?v=${ID}`,
    `javascript:alert('${ID}')`,
    `ftp://youtu.be/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    'not a url',
    '',
  ])
    assert.equal(youtubeVideoId(href), null, href);
});

test('youtubeEmbedURL builds the nocookie player URL', () => {
  assert.equal(
    youtubeEmbedURL(ID),
    `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0`,
  );
});

test('diagram policy: legacy re-export, limits and blocking', () => {
  assert.equal(legacyPolicy, isSafeDiagramSource);
  assert.equal(MERMAID_SOURCE_LIMIT, 20000);
  assert.equal(MERMAID_MAX_DIAGRAMS, 20);
  assert.equal(isSafeDiagramSource('graph TD\n A-->B'), true);
  assert.equal(isSafeDiagramSource('graph TD\n click A "https://x"'), false);
  assert.equal(isSafeDiagramSource('%%{init: {}}%%\ngraph TD'), false);
});

test('imageFromDataURL converts a valid PNG and tolerates whitespace', () => {
  const spaced = PNG.slice(0, 8) + '\n  ' + PNG.slice(8);
  const result = imageFromDataURL(`data:image/png;base64,${spaced}`, 'a.png');
  assert.deepEqual(result, { image: { name: 'a.png', mimeType: 'image/png', data: PNG } });
});

test('imageFromDataURL reports type, data and size errors', () => {
  assert.deepEqual(imageFromDataURL(`data:image/svg+xml;base64,${PNG}`, 'a'), {
    error: 'imageType',
  });
  assert.deepEqual(imageFromDataURL('data:image/png;utf8,abc', 'a'), { error: 'imageType' });
  assert.deepEqual(imageFromDataURL(`data:image/png;base64,${GIF}`, 'a'), {
    error: 'imageData',
  });
  assert.deepEqual(imageFromDataURL('data:image/png;base64,@@@@', 'a'), { error: 'imageData' });
  assert.deepEqual(imageFromDataURL(`data:image/png;base64,${PNG}`, 'a', 4), {
    error: 'imageSize',
  });
});

test('imageFromDataURL checks size from base64 length before decoding', () => {
  const realAtob = globalThis.atob;
  let decoded = false;
  globalThis.atob = (...args) => {
    decoded = true;
    return realAtob(...args);
  };
  try {
    const huge = 'A'.repeat((MAX_IMAGE_BYTES / 3 + 10) * 4);
    const result = imageFromDataURL(`data:image/png;base64,${huge}`, 'big');
    assert.deepEqual(result, { error: 'imageSize' });
    assert.equal(decoded, false);
  } finally {
    globalThis.atob = realAtob;
  }
});
