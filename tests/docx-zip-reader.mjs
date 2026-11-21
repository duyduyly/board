// Đọc ZIP store độc lập với assets/js/word-export/zip.js để kiểm chứng output.
import { crc32 } from 'node:zlib';
import { TextDecoder } from 'node:util';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_SIZE = 22;
const METHOD_STORE = 0;
const UTF8_FLAG = 0x0800;

/** @param {Uint8Array} bytes @returns {Map<string, Uint8Array>} */
export function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  let eocd = -1;
  for (let i = bytes.length - EOCD_SIZE; i >= 0; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('zip: EOCD not found');
  const count = view.getUint16(eocd + 10, true);
  let pos = view.getUint32(eocd + 16, true);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(pos, true) !== CENTRAL_SIGNATURE) throw new Error('zip: bad central header');
    const flags = view.getUint16(pos + 8, true);
    const method = view.getUint16(pos + 10, true);
    const crc = view.getUint32(pos + 16, true);
    const size = view.getUint32(pos + 20, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = new TextDecoder('utf-8', { fatal: true }).decode(
      bytes.subarray(pos + 46, pos + 46 + nameLength),
    );
    if (method !== METHOD_STORE) throw new Error(`zip: ${name} is not stored`);
    if (!(flags & UTF8_FLAG)) throw new Error(`zip: ${name} lacks UTF-8 flag`);
    if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE)
      throw new Error('zip: bad local header');
    const start =
      localOffset +
      30 +
      view.getUint16(localOffset + 26, true) +
      view.getUint16(localOffset + 28, true);
    const data = bytes.slice(start, start + size);
    if (crc32(data) !== crc) throw new Error(`zip: CRC mismatch for ${name}`);
    files.set(name, data);
    pos += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

/** @param {Uint8Array} bytes @returns {Map<string, string>} */
export function readZipText(bytes) {
  const decoder = new TextDecoder();
  return new Map([...readZip(bytes)].map(([name, data]) => [name, decoder.decode(data)]));
}
