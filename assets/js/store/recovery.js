const FLAG = 'card-atlas:recovery-enabled';
const DB = 'card-atlas-recovery';
export function recoveryEnabled() {
  try {
    return localStorage.getItem(FLAG) === 'yes';
  } catch {
    return false;
  }
}
async function database() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('blocked'));
  });
}
async function transact(mode, callback) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', mode);
      const request = callback(tx.objectStore('snapshots'));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function readRecovery() {
  if (!recoveryEnabled()) return null;
  return transact('readonly', (store) => store.get('current'));
}
export async function saveRecovery(snapshot) {
  if (!recoveryEnabled()) return;
  const text = JSON.stringify(snapshot);
  if (new TextEncoder().encode(text).length > 20 * 1024 * 1024) throw new Error('size');
  await transact('readwrite', (store) => store.put(snapshot, 'current'));
}
export function enableRecovery() {
  localStorage.setItem(FLAG, 'yes');
}
export async function disableRecovery() {
  localStorage.removeItem(FLAG);
  await new Promise((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(DB);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('blocked'));
  });
}
