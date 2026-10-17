/* IndexedDB queue for a camera-produced multipart payload when connectivity
   drops during the final sighting upload. */
(() => {
  'use strict';
  const DB_NAME = 'pawprint-offline';
  const STORE = 'sightings';
  const openDb = () => new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('INDEXEDDB_UNAVAILABLE'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('INDEXEDDB_OPEN_FAILED'));
  });
  const run = async (mode, callback) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = callback(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error('INDEXEDDB_TRANSACTION_FAILED')); };
    });
  };
  const serialize = form => [...form.entries()].map(([key, value]) => ({
    key, value: value instanceof Blob ? value : String(value), blob: value instanceof Blob,
    name: value instanceof File ? value.name : '',
  }));
  const restore = entries => {
    const form = new FormData();
    for (const entry of entries) {
      if (entry.blob) form.append(entry.key, entry.value, entry.name || 'pawprint.jpg');
      else form.append(entry.key, entry.value);
    }
    return form;
  };
  const queue = async form => {
    const id = String(form.get('idempotencyKey') || crypto.randomUUID());
    await run('readwrite', store => store.put({ id, entries: serialize(form), queuedAt: new Date().toISOString() }));
    window.dispatchEvent(new CustomEvent('pawprint-offline-queued', { detail: { id } }));
    return id;
  };
  const list = () => run('readonly', store => new Promise((resolve, reject) => {
    const request = store.getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error);
  }));
  const remove = id => run('readwrite', store => store.delete(id));
  const flush = async () => {
    if (!navigator.onLine || window.pawprintOfflineQueue?.flushing) return;
    window.pawprintOfflineQueue.flushing = true;
    try {
      for (const item of await list()) {
        try {
          const response = await fetch('/api/sightings', { method: 'POST', body: restore(item.entries), credentials: 'include' });
          if (response.ok) { await remove(item.id); window.notify?.('Offline pawprint synced successfully.'); }
          else if ([400, 401, 409, 422].includes(response.status)) {
            const payload = await response.json().catch(() => ({})); await remove(item.id);
            window.notify?.(payload.error === 'CAPTURE_SESSION_INVALID' ? 'The offline capture expired. Please take a new photo.' : 'An offline pawprint could not pass the safety check.');
          }
        } catch { break; }
      }
    } finally { window.pawprintOfflineQueue.flushing = false; }
  };
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const requestUrl = typeof input === 'string' ? input : input?.url || '';
    const isSighting = new URL(requestUrl, location.origin).pathname === '/api/sightings' && (init.method || 'GET').toUpperCase() === 'POST' && init.body instanceof FormData;
    if (!isSighting) return originalFetch(input, init);
    if (!navigator.onLine) {
      await queue(init.body);
      return new Response(JSON.stringify({ status: 'needs_review', queued: true, reason: 'OFFLINE_QUEUED' }), { status: 202, headers: { 'content-type': 'application/json' } });
    }
    try { return await originalFetch(input, init); }
    catch {
      await queue(init.body);
      return new Response(JSON.stringify({ status: 'needs_review', queued: true, reason: 'OFFLINE_QUEUED' }), { status: 202, headers: { 'content-type': 'application/json' } });
    }
  };
  window.pawprintOfflineQueue = { queue, flush, list, flushing: false };
  window.addEventListener('online', flush);
  window.addEventListener('pawprint-offline-queued', () => {
    window.notify?.('No connection. Your photo is queued and will sync when you are online.');
    document.querySelector('#captureModal [data-close-modal]')?.click();
  });
  window.addEventListener('load', () => setTimeout(flush, 400));
})();
