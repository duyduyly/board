import { IMAGE_MIME_TYPES, validImageAttachment } from './attachments.js';
export async function readImageFile(file, maxBytes) {
  if (!file || !IMAGE_MIME_TYPES.includes(file.type) || file.size > maxBytes) throw Error('image');
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(Error('read'));
    reader.readAsDataURL(file);
  });
  const image = { name: file.name, mimeType: file.type, data };
  if (!validImageAttachment(image)) throw Error('image');
  const decoded = new Image();
  decoded.src = 'data:' + image.mimeType + ';base64,' + data;
  await decoded.decode();
  return image;
}
