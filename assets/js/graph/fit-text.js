import { safeArea, resizeShape, SHAPE_LIMITS } from './shape-registry.js';
// measure(width) reports overview height in graph pixels, never Markdown body height.
export function fitTextSize(shape, measure, { imageOnly = false, radius = 10 } = {}) {
  if (imageOnly) return resizeShape(shape, 240, 180);
  for (let width = 240; width <= SHAPE_LIMITS.maxWidth; width += 40) {
    for (let height = 64; height <= SHAPE_LIMITS.maxHeight; height += 16) {
      const size = resizeShape(shape, width, height);
      const area = safeArea(shape || 'rounded', size, 16, radius);
      const result = measure(area.width);
      if (result.width <= area.width + 0.5 && result.height <= area.height + 0.5) return size;
    }
  }
  return null;
}
