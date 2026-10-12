import test from 'node:test';
import assert from 'node:assert/strict';
import { fitTextSize } from '../assets/js/graph/fit-text.js';
import { validate, blank, serialize, stage } from '../assets/js/json/validator.js';
import { newCard, ProjectStore } from '../assets/js/store/project-store.js';
import {
  shapes,
  shapePoints,
  shapeFrame,
  safeArea,
  hitShape,
  shapeAnchor,
  resizeShape,
} from '../assets/js/graph/shape-registry.js';
test('basic outlines share hit area, inscribed ratios and edge anchors at all zooms', () => {
  for (const shape of Object.keys(shapes))
    for (const zoom of [0.1, 1, 4]) {
      const size = { width: 280, height: 190 },
        points = shapePoints(shape, size),
        frame = shapeFrame(shape, size),
        area = safeArea(shape, size);
      const center = { x: 140, y: 95 };
      assert.ok(hitShape(points, center), shape);
      assert.ok(!hitShape(points, { x: -1, y: -1 }));
      for (const p of [
        { x: area.x, y: area.y },
        { x: area.x + area.width, y: area.y + area.height },
      ])
        assert.ok(hitShape(points, p), shape);
      const anchor = shapeAnchor(points, center, { x: 1, y: 0 });
      assert.ok(anchor.x >= center.x && anchor.x <= size.width);
      assert.ok(!hitShape(points, { x: (anchor.x * zoom + 1) / zoom, y: anchor.y }));
      if (shapes[shape].ratio)
        assert.ok(Math.abs(frame.width / frame.height - shapes[shape].ratio) < 1e-9);
    }
});
test('Fit text uses overview bounds, ratio and image policy, and fails without fitting', () => {
  const text = fitTextSize('triangle', (width) => ({ width, height: Math.ceil(500 / width) * 90 }));
  assert.ok(text);
  assert.ok(Math.abs(text.width / text.height - 2 / Math.sqrt(3)) < 1e-9);
  assert.equal(
    fitTextSize('circle', (width) => ({ width: width + 10, height: 2000 })),
    null,
  );
  assert.deepEqual(
    fitTextSize(
      'rectangle',
      () => {
        throw Error('image should not measure text');
      },
      { imageOnly: true },
    ),
    { width: 240, height: 180 },
  );
});
test('typed shape/font/sizeMode rejects unsafe input and round-trips atomic history', () => {
  const p = blank(),
    c = newCard({ x: 0, y: 0 }, 'Title');
  p.cards.push(c);
  for (const shape of Object.keys(shapes)) {
    c.extensions = { 'card-atlas:appearance': { shape, titleFontSize: 72, sizeMode: 'fit' } };
    assert.deepEqual(validate(p).errors, []);
    assert.equal(
      stage(serialize(p)).project.cards[0].extensions['card-atlas:appearance'].shape,
      shape,
    );
  }
  for (const bad of [
    { shape: 'star' },
    { shape: 'url(evil)' },
    { shape: null },
    { sizeMode: 'auto' },
    { titleFontSize: 73 },
    { titleFontSize: 11 },
    { path: 'M0 0' },
    { css: 'position:fixed' },
  ]) {
    c.extensions = { 'card-atlas:appearance': bad };
    assert.ok(validate(p).errors.length);
  }
  delete c.extensions;
  const store = new ProjectStore();
  store.replace(p);
  store.commit((d) => {
    d.cards[0].extensions = {
      'card-atlas:appearance': { shape: 'circle', titleFontSize: 72, sizeMode: 'fit' },
    };
    d.cards[0].size = { width: 600, height: 600 };
  });
  assert.equal(store.undoStack.length, 1);
  store.undo();
  assert.deepEqual(store.project, p);
  store.redo();
  assert.equal(store.project.cards[0].size.height, 600);
});
test('resize bounds and ratios remain valid for negative, huge and tiny pointer deltas', () => {
  for (const shape of Object.keys(shapes))
    for (const v of [-999, 0, 10, 400, 9999]) {
      const size = resizeShape(shape, v, v * 2);
      assert.ok(size.width >= 96 && size.width <= 1200 && size.height >= 64 && size.height <= 1000);
      if (shapes[shape].ratio)
        assert.ok(Math.abs(size.width / size.height - shapes[shape].ratio) < 1e-9);
    }
});
test('ratio resize follows the edited axis, and large rounded corners protect text', () => {
  assert.deepEqual(resizeShape('circle', 200, 400, 'width'), { width: 200, height: 200 });
  assert.deepEqual(resizeShape('circle', 400, 180, 'height'), { width: 180, height: 180 });
  const size = { width: 280, height: 190 },
    area = safeArea('rounded', size, 16, 100),
    points = shapePoints('rounded', size, 100);
  assert.ok(hitShape(points, { x: area.x, y: area.y }));
  assert.ok(hitShape(points, { x: area.x + area.width, y: area.y + area.height }));
});
