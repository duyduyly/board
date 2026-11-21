/** @typedef {{ name: string, data: Uint8Array }} ZipFile */

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const VERSION_NEEDED = 20;
const UTF8_FLAG = 0x0800;
const METHOD_STORE = 0;
// Ngày/giờ DOS cố định (1980-01-01 00:00) để output tất định.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_RECORD_SIZE = 22;
const MAX_ENTRIES = 0xffff;
const MAX_SIZE = 0xffffffff;

const encoder = new TextEncoder();

/** @type {Uint32Array} */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * CRC-32 (IEEE 802.3) của một dãy byte.
 * @param {Uint8Array} bytes
 * @returns {number} giá trị không dấu 32 bit
 */
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Đóng gói các file thành ZIP không nén (store), không zip64.
 * @param {ZipFile[]} files
 * @returns {Uint8Array}
 */
export function zipStore(files) {
  if (files.length > MAX_ENTRIES) throw new RangeError('zip: too many entries');
  const entries = files.map((file) => ({
    name: encoder.encode(file.name),
    data: file.data,
    crc: crc32(file.data),
    offset: 0,
  }));
  let total = END_RECORD_SIZE;
  for (const e of entries) {
    if (e.data.length > MAX_SIZE) throw new RangeError('zip: file too large');
    total += LOCAL_HEADER_SIZE + CENTRAL_HEADER_SIZE + 2 * e.name.length + e.data.length;
  }
  if (total > MAX_SIZE) throw new RangeError('zip: archive too large');

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  let pos = 0;
  for (const e of entries) {
    e.offset = pos;
    view.setUint32(pos, LOCAL_HEADER_SIGNATURE, true);
    view.setUint16(pos + 4, VERSION_NEEDED, true);
    view.setUint16(pos + 6, UTF8_FLAG, true);
    view.setUint16(pos + 8, METHOD_STORE, true);
    view.setUint16(pos + 10, DOS_TIME, true);
    view.setUint16(pos + 12, DOS_DATE, true);
    view.setUint32(pos + 14, e.crc, true);
    view.setUint32(pos + 18, e.data.length, true);
    view.setUint32(pos + 22, e.data.length, true);
    view.setUint16(pos + 26, e.name.length, true);
    out.set(e.name, pos + LOCAL_HEADER_SIZE);
    out.set(e.data, pos + LOCAL_HEADER_SIZE + e.name.length);
    pos += LOCAL_HEADER_SIZE + e.name.length + e.data.length;
  }
  const centralStart = pos;
  for (const e of entries) {
    view.setUint32(pos, CENTRAL_HEADER_SIGNATURE, true);
    view.setUint16(pos + 4, VERSION_NEEDED, true);
    view.setUint16(pos + 6, VERSION_NEEDED, true);
    view.setUint16(pos + 8, UTF8_FLAG, true);
    view.setUint16(pos + 10, METHOD_STORE, true);
    view.setUint16(pos + 12, DOS_TIME, true);
    view.setUint16(pos + 14, DOS_DATE, true);
    view.setUint32(pos + 16, e.crc, true);
    view.setUint32(pos + 20, e.data.length, true);
    view.setUint32(pos + 24, e.data.length, true);
    view.setUint16(pos + 28, e.name.length, true);
    // extra, comment, disk start, thuộc tính file để 0 (buffer đã zero sẵn)
    view.setUint32(pos + 42, e.offset, true);
    out.set(e.name, pos + CENTRAL_HEADER_SIZE);
    pos += CENTRAL_HEADER_SIZE + e.name.length;
  }
  view.setUint32(pos, END_SIGNATURE, true);
  view.setUint16(pos + 8, entries.length, true);
  view.setUint16(pos + 10, entries.length, true);
  view.setUint32(pos + 12, pos - centralStart, true);
  view.setUint32(pos + 16, centralStart, true);
  return out;
}
