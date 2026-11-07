import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stage } from '../assets/js/json/validator.js';
import {
  DOCUMENT,
  documentIssues,
  documentHTML,
  documentText,
} from '../assets/js/graph/html-document.js';
test('document contract escapes code, validates nested BS5 structure and rejects executable payloads', () => {
  const doc = {
    version: 1,
    format: 'html-bs5',
    components: [
      {
        tag: 'div',
        attributes: { class: 'row g-3' },
        children: [
          {
            tag: 'pre',
            attributes: {},
            children: [
              {
                tag: 'code',
                attributes: { class: 'language-java' },
                children: ['<script>alert(1)</script>'],
              },
            ],
          },
        ],
      },
    ],
  };
  const card = { extensions: { [DOCUMENT]: doc } };
  assert.deepEqual(documentIssues(card), []);
  assert.match(documentHTML(doc), /&lt;script&gt;/);
  assert.match(documentText(doc), /<script>/);
  for (const bad of [
    { tag: 'script', attributes: {}, children: [] },
    { tag: 'img', attributes: { src: 'javascript:alert(1)' }, children: [] },
    { tag: 'p', attributes: { onclick: 'alert(1)' }, children: [] },
    { tag: 'p', attributes: { style: 'background-color:url(https://example.com)' }, children: [] },
  ]) {
    const candidate = structuredClone(card);
    candidate.extensions[DOCUMENT].components = [bad];
    assert.equal(documentIssues(candidate).length, 1);
  }
  const candidate = structuredClone(card);
  candidate.extensions[DOCUMENT].components[0].script = 'bad';
  assert.equal(documentIssues(candidate).length, 1);
});

test('plain text preserves inline phrases and separates blocks', () => {
  const doc = {
    components: [
      {
        tag: 'p',
        attributes: {},
        children: ['Hello ', { tag: 'strong', attributes: {}, children: ['world'] }, '!'],
      },
      {
        tag: 'p',
        attributes: {},
        children: ['Next', { tag: 'br', attributes: {}, children: [] }, 'line'],
      },
      { tag: 'img', attributes: { alt: 'Diagram' }, children: [] },
    ],
  };
  assert.equal(documentText(doc), 'Hello world!\nNext\nline\nDiagram');
});

test('malformed image sources are rejected as validation issues without throwing', () => {
  for (const src of [
    42,
    true,
    {},
    ['attachment:image'],
    null,
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'file:///x',
    'https://user:pass@example.com/a',
    'https://example.com/a b',
  ]) {
    const card = {
      extensions: {
        'card-atlas:images': {},
        [DOCUMENT]: {
          version: 1,
          format: 'html-bs5',
          components: [{ tag: 'img', attributes: { src }, children: [] }],
        },
      },
    };
    assert.deepEqual(documentIssues(card), [{ path: 'document', code: 'htmlDocument' }]);
  }
});

test('remote HTTP image references survive document validation without attachments', () => {
  for (const src of ['https://example.com/a.png?x=1&y=2', 'http://example.com/a.png']) {
    const card = {
      extensions: {
        [DOCUMENT]: {
          version: 1,
          format: 'html-bs5',
          components: [{ tag: 'img', attributes: { src }, children: [] }],
        },
      },
    };
    assert.deepEqual(documentIssues(card), []);
  }
});

test('image references cannot use inherited keys and void elements cannot hide children', () => {
  for (const node of [
    null,
    ...['toString', 'constructor', '__proto__'].map((id) => ({
      tag: 'img',
      attributes: { src: 'attachment:' + id },
      children: [],
    })),
    ...['br', 'hr', 'img'].map((tag) => ({
      tag,
      attributes: {},
      children: ['must not disappear'],
    })),
  ]) {
    const card = {
      extensions: {
        'card-atlas:images': {},
        [DOCUMENT]: {
          version: 1,
          format: 'html-bs5',
          components: [node],
        },
      },
    };
    assert.deepEqual(documentIssues(card), [{ path: 'document', code: 'htmlDocument' }]);
  }
});

test('project import rejects malformed document data without throwing or staging a project', () => {
  for (const node of [
    null,
    { tag: 'img', attributes: { src: 42 }, children: [] },
    { tag: 'img', attributes: { src: 'attachment:constructor' }, children: [] },
    { tag: 'br', attributes: {}, children: ['lost'] },
  ]) {
    const project = {
      version: '1.0',
      cards: [
        {
          id: 'a',
          title: 'A',
          content: '',
          extensions: {
            'card-atlas:images': {},
            [DOCUMENT]: { version: 1, format: 'html-bs5', components: [node] },
          },
        },
      ],
      relations: [],
    };
    const result = stage(JSON.stringify(project));
    assert.ok(result.errors.length > 0);
    assert.equal(result.project, undefined);
  }
});
