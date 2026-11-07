import { labelIcon } from './editor-icons.js';
﻿import { escapeHTML } from '../common/html.js';
import { t } from '../i18n/index.js';

export function createImageControls(onReplace) {
  const root = document.createElement('div');
  root.className = 'block-image-controls';
  root.hidden = true;
  const heading = document.createElement('strong');
  root.append(heading);
  const fields = {};
  for (const [key, type, translation] of [
    ['alt', 'text', 'imageAlt'],
    ['caption', 'text', 'imageCaption'],
    ['width', 'number', 'imageWidth'],
    ['height', 'number', 'imageHeight'],
    ['fit', 'select', 'imageFit'],
    ['alignment', 'select', 'imageAlignment'],
  ]) {
    const label = document.createElement('label');
    const caption = document.createElement('span');
    const input = document.createElement(type === 'select' ? 'select' : 'input');
    if (type !== 'select') input.type = type;
    if (type === 'number') {
      input.min = '1';
      input.max = '2000';
      input.step = '1';
    }
    if (key === 'fit')
      for (const value of ['', 'contain', 'cover', 'fill']) {
        const option = document.createElement('option');
        option.value = value;
        option.dataset.translation = value
          ? 'imageFit' + value[0].toUpperCase() + value.slice(1)
          : 'layoutDefault';
        input.append(option);
      }
    if (key === 'alignment')
      for (const [value, translation] of [
        ['', 'layoutDefault'],
        ['start', 'layoutStart'],
        ['center', 'layoutCenter'],
        ['end', 'layoutEnd'],
      ]) {
        const option = document.createElement('option');
        option.value = value;
        option.dataset.translation = translation;
        input.append(option);
      }
    input.dataset.imageControl = key;
    label.append(caption, input);
    // Keep the unfinished alignment control out of the UI until its Undo regression is resolved.
    if (key === 'alignment') {
      label.hidden = true;
      label.style.display = 'none';
    }
    root.append(label);
    fields[key] = { label, caption, input, translation };
  }
  let image = null;
  let figure = null;
  const captionComponent = () =>
    figure?.components().find((child) => child.get('tagName') === 'figcaption');
  for (const key of ['alt', 'width', 'height'])
    fields[key].input.onchange = () => {
      if (!image) return;
      const input = fields[key].input;
      if (
        key !== 'alt' &&
        input.value &&
        (!input.checkValidity() || !Number.isInteger(Number(input.value)))
      ) {
        input.reportValidity();
        return;
      }
      if (!input.value && key !== 'alt') image.removeAttributes(key);
      else image.addAttributes({ [key]: input.value });
    };
  fields.caption.input.onchange = () => {
    const caption = captionComponent();
    if (caption) caption.components(escapeHTML(fields.caption.input.value));
  };
  fields.fit.input.onchange = () => {
    if (!image) return;
    const style = { ...image.getStyle() };
    if (fields.fit.input.value) style['object-fit'] = fields.fit.input.value;
    else delete style['object-fit'];
    image.setStyle(style);
  };
  fields.alignment.input.onchange = () => {
    if (!image) return;
    const style = { ...image.getStyle() };
    const value = fields.alignment.input.value;
    if (value) {
      style.display = 'block';
      style['margin-left'] = value === 'start' ? '0' : 'auto';
      style['margin-right'] = value === 'end' ? '0' : 'auto';
    } else {
      delete style.display;
      delete style['margin-left'];
      delete style['margin-right'];
    }
    image.setStyle(style);
  };
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.dataset.imageReset = '';
  reset.onclick = () => {
    if (!image) return;
    image.removeAttributes('width');
    image.removeAttributes('height');
    const style = { ...image.getStyle() };
    delete style['object-fit'];
    image.setStyle(style);
    fields.width.input.value = fields.height.input.value = fields.fit.input.value = '';
  };
  const replace = document.createElement('button');
  replace.type = 'button';
  replace.dataset.imageReplace = '';
  replace.onclick = () => { if (image) onReplace(image); };
  root.append(replace, reset);
  return {
    root,
    select(component) {
      figure = component;
      while (figure && figure.get('tagName') !== 'figure') figure = figure.parent();
      image =
        component?.get('tagName') === 'img'
          ? component
          : figure?.components().find((child) => child.get('tagName') === 'img');
      root.hidden = !image;
      if (!image) return;
      const attrs = image.getAttributes();
      for (const key of ['alt', 'width', 'height']) fields[key].input.value = attrs[key] || '';
      fields.caption.label.hidden = !captionComponent();
      fields.caption.input.value = captionComponent()?.getEl()?.textContent || '';
      fields.fit.input.value = image.getStyle()['object-fit'] || '';
      const style = image.getStyle();
      const left = style['margin-left'];
      const right = style['margin-right'];
      fields.alignment.input.value = style.display === 'block'
        ? left === 'auto' && right === 'auto' ? 'center'
          : left === 'auto' && right === '0' ? 'end'
            : left === '0' && right === 'auto' ? 'start' : ''
        : '';
    },
    clear() {
      image = null;
      figure = null;
      root.hidden = true;
    },
    translate() {
      heading.textContent = t('propertiesImage');
      labelIcon(replace, 'imageReplace');
      labelIcon(reset, 'propertiesReset');
      for (const field of Object.values(fields)) {
        field.caption.textContent = t(field.translation);
        for (const option of field.input.querySelectorAll('option'))
          option.textContent = t(option.dataset.translation);
      }
    },
  };
}
