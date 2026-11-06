/* Saves settings and progress. Uses the page's claude.ai database when available (so it follows you
   between devices), and the browser's local storage otherwise. */
(function (root) {
  'use strict';
  const LS_KEY = 'js-memory-practice-v1';
  const DOC = 'progress/main';
  let data = { settings: {}, items: {}, codes: {}, memoryCode: null, updated: 0 };
  let db = null, docRef = null, timer = null, listeners = [], status = 'local';

  function readLocal() { try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function writeLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) {} }

  function merge(a, b) { // keep the newer copy
    if (!a) return b; if (!b) return a;
    return (a.updated || 0) >= (b.updated || 0) ? a : b;
  }

  async function init() {
    const local = readLocal();
    if (local) data = Object.assign(data, local);
    try {
      if (root.claude && typeof root.claude.use === 'function') {
        const loaded = await Promise.race([root.claude.use('db'), new Promise(r => setTimeout(() => r(null), 10000))]);
        if (loaded) {
          db = loaded;
          docRef = db.doc(DOC);
          const snap = await Promise.race([docRef.get(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))]);
          const remote = snap && (typeof snap.data === 'function' ? snap.data() : snap.data !== undefined ? snap.data : snap);
          if (remote && remote.updated) data = Object.assign({ settings: {}, items: {}, codes: {} }, merge(data, remote));
          status = 'synced';
        }
      }
    } catch (e) { status = 'local'; }
    emit();
    return data;
  }

  function save() {
    data.updated = Date.now();
    writeLocal();
    status = docRef ? 'saving' : 'local';
    emit();
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!docRef) return;
      try { await docRef.set(JSON.parse(JSON.stringify(data))); status = 'synced'; } catch (e) { status = 'local'; }
      emit();
    }, 1500);
  }

  function emit() { listeners.forEach(f => { try { f(status); } catch (e) {} }); }

  root.Store = {
    init,
    get data() { return data; },
    save,
    onStatus: (f) => listeners.push(f),
    get status() { return status; },
    item: (id) => data.items[id] || (data.items[id] = { status: 'new', attempts: 0, hints: 0, misses: 0 }),
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
