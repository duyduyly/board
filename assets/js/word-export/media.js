/** @typedef {{ width: number, height: number }} ImageSize */

/** EMU (English Metric Unit) trên một pixel ở 96 DPI. */
export const EMU_PER_PIXEL = 9525;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_IHDR_TAG_OFFSET = 12;
const PNG_SIZE_OFFSET = 16;
const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2]);
const JPEG_STANDALONE_MARKERS = new Set([
  0x01, 0xd8, 0xd9, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7,
]);
const GIF_SIZE_OFFSET = 6;
const WEBP_CHUNK_OFFSET = 12;
const WEBP_DATA_OFFSET = WEBP_CHUNK_OFFSET + 8;

/**
 * Giải mã base64 thành byte; chạy được ở Node và trình duyệt.
 * @param {string} s
 * @returns {Uint8Array}
 */
export function decodeBase64(s) {
  const binary = globalThis.atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @param {string} text
 * @returns {boolean}
 */
const hasAscii = (bytes, offset, text) => {
  if (offset + text.length > bytes.length) return false;
  for (let i = 0; i < text.length; i++) if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  return true;
};

/** @param {Uint8Array} bytes @returns {DataView} */
const viewOf = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.length);

/** @param {number} width @param {number} height @returns {ImageSize | null} */
const validSize = (width, height) => (width > 0 && height > 0 ? { width, height } : null);

/** @param {Uint8Array} bytes @returns {ImageSize | null} */
function pngSize(bytes) {
  if (bytes.length < PNG_SIZE_OFFSET + 8 || !PNG_SIGNATURE.every((b, i) => bytes[i] === b))
    return null;
  if (!hasAscii(bytes, PNG_IHDR_TAG_OFFSET, 'IHDR')) return null;
  const view = viewOf(bytes);
  return validSize(view.getUint32(PNG_SIZE_OFFSET), view.getUint32(PNG_SIZE_OFFSET + 4));
}

/** @param {Uint8Array} bytes @returns {ImageSize | null} */
function jpegSize(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = viewOf(bytes);
  let pos = 2;
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) return null;
    const marker = bytes[pos + 1];
    if (marker === 0xff) {
      pos += 1;
      continue;
    }
    if (JPEG_STANDALONE_MARKERS.has(marker)) {
      pos += 2;
      continue;
    }
    const length = view.getUint16(pos + 2);
    if (length < 2) return null;
    if (JPEG_SOF_MARKERS.has(marker)) {
      if (pos + 9 > bytes.length) return null;
      return validSize(view.getUint16(pos + 7), view.getUint16(pos + 5));
    }
    pos += 2 + length;
  }
  return null;
}

/** @param {Uint8Array} bytes @returns {ImageSize | null} */
function gifSize(bytes) {
  if (bytes.length < GIF_SIZE_OFFSET + 4 || !hasAscii(bytes, 0, 'GIF8')) return null;
  const view = viewOf(bytes);
  return validSize(
    view.getUint16(GIF_SIZE_OFFSET, true),
    view.getUint16(GIF_SIZE_OFFSET + 2, true),
  );
}

/** @param {Uint8Array} bytes @returns {ImageSize | null} */
function webpSize(bytes) {
  if (bytes.length < WEBP_DATA_OFFSET || !hasAscii(bytes, 0, 'RIFF') || !hasAscii(bytes, 8, 'WEBP'))
    return null;
  const data = WEBP_DATA_OFFSET;
  const view = viewOf(bytes);
  /** @param {number} at */
  const u24 = (at) => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
  if (hasAscii(bytes, WEBP_CHUNK_OFFSET, 'VP8 ')) {
    if (
      bytes.length < data + 10 ||
      bytes[data + 3] !== 0x9d ||
      bytes[data + 4] !== 0x01 ||
      bytes[data + 5] !== 0x2a
    )
      return null;
    return validSize(
      view.getUint16(data + 6, true) & 0x3fff,
      view.getUint16(data + 8, true) & 0x3fff,
    );
  }
  if (hasAscii(bytes, WEBP_CHUNK_OFFSET, 'VP8L')) {
    if (bytes.length < data + 5 || bytes[data] !== 0x2f) return null;
    const bits = view.getUint32(data + 1, true);
    return validSize((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (hasAscii(bytes, WEBP_CHUNK_OFFSET, 'VP8X')) {
    if (bytes.length < data + 10) return null;
    return validSize(u24(data + 4) + 1, u24(data + 7) + 1);
  }
  return null;
}

/**
 * Đọc kích thước pixel từ header ảnh; header hỏng/ngắn/lạ trả null.
 * @param {Uint8Array} bytes
 * @param {string} mimeType
 * @returns {ImageSize | null}
 */
export function imageSize(bytes, mimeType) {
  switch (mimeType) {
    case 'image/png':
      return pngSize(bytes);
    case 'image/jpeg':
    case 'image/jpg':
      return jpegSize(bytes);
    case 'image/gif':
      return gifSize(bytes);
    case 'image/webp':
      return webpSize(bytes);
    default:
      return null;
  }
}

/**
 * Tính kích thước EMU: dùng widthPx nếu có, giới hạn theo maxWidthPx, giữ tỉ lệ.
 * @param {ImageSize} size
 * @param {{ widthPx?: number, maxWidthPx: number }} options
 * @returns {{ cx: number, cy: number }}
 */
export function fitImage(size, { widthPx, maxWidthPx }) {
  const wanted = widthPx && widthPx > 0 ? widthPx : size.width;
  const width = Math.max(1, Math.min(wanted, maxWidthPx));
  const height = (width * size.height) / size.width;
  return {
    cx: Math.max(1, Math.round(width * EMU_PER_PIXEL)),
    cy: Math.max(1, Math.round(height * EMU_PER_PIXEL)),
  };
}
