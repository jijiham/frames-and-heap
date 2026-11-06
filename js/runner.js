/* Runs code in the browser's real JavaScript engine inside a Web Worker, with a time limit.
   Used for the real-engine check in Memory and for the tests in Practice. */
(function (root) {
  'use strict';
  const TIME_LIMIT_MS = 2000;

  // extra.dom adds the practice DOM and the test helpers click, rightClick and listenerCount.
  // extra.prelude is code that runs first in an outer scope, so the user's code can use or shadow its functions.
  // extra.session keeps the worker alive after the first run and dispatches events the page sends to it.
  // The browser-side setup for Stage 2 and later: the practice DOM, timers that run on a simulated clock, a
  // localStorage that lives in the worker, a fetch that answers from a few fixed JSON endpoints, and test helpers.
  // Tests move the clock with tick(ms), let promises settle with flush(), and act with click, rightClick, press,
  // type, submit and listenerCount.
  const API = {
    '/api/words': ['apple', 'brick', 'crane', 'drift', 'eagle', 'flame', 'grape', 'house'],
    '/api/scores': [{ name: 'Ada', score: 42 }, { name: 'Bo', score: 35 }, { name: 'Cy', score: 51 }],
    '/api/board': { rows: 5, cols: 5, mines: [[0, 1], [2, 2], [4, 0]] },
    '/api/todos': [{ text: 'Read the spec', done: true }, { text: 'Write the tests', done: false }],
  };
  function envSource(extra) {
    return [
      root.DomCore.factorySource,
      'const __DOM = DomFactory();',
      'const document = __DOM.makeDocument(); self.document = document; self.window = self;',
      'const __real = { setInterval: self.setInterval.bind(self) };',
      'const __T = { now: 0, next: 1, list: [] };',
      'self.setTimeout = (fn, ms, ...a) => { const id = __T.next++; __T.list.push({ id, at: __T.now + Math.max(0, +ms || 0), every: 0, fn: () => fn(...a) }); return id; };',
      'self.setInterval = (fn, ms, ...a) => { const id = __T.next++; const every = Math.max(1, +ms || 0); __T.list.push({ id, at: __T.now + every, every, fn: () => fn(...a) }); return id; };',
      'self.clearTimeout = self.clearInterval = (id) => { __T.list = __T.list.filter(t => t.id !== id); };',
      'self.requestAnimationFrame = (fn) => self.setTimeout(() => fn(__T.now), 16); self.cancelAnimationFrame = self.clearTimeout;',
      'function __runDue(until) {',
      '  let ran = 0;',
      '  for (;;) {',
      '    let due = null;',
      '    for (const t of __T.list) if (t.at <= until && (!due || t.at < due.at || (t.at === due.at && t.id < due.id))) due = t;',
      '    if (!due) break;',
      '    __T.now = due.at;',
      '    if (due.every) due.at += due.every; else __T.list.splice(__T.list.indexOf(due), 1);',
      '    try { due.fn(); } catch (e) { __out.push({ kind: "error", text: "Uncaught " + __errText(e) }); }',
      '    if (++ran > 20000) { __T.list = []; throw new Error("More than 20,000 timer callbacks ran at once, so the timers were stopped."); }',
      '  }',
      '  __T.now = Math.max(__T.now, until);',
      '  return ran;',
      '}',
      'function tick(ms) { return __runDue(__T.now + (+ms || 0)); }',
      'async function flush() { for (let i = 0; i < 40; i++) await null; }',
      'async function __drain() { for (let k = 0; k < 400; k++) { await flush(); if (!__T.list.length || __T.now > 10000) return; __runDue(Math.min(...__T.list.map(t => t.at))); } }',
      'const __ls = new Map(Object.entries(' + JSON.stringify(extra.storage || {}) + '));',
      'self.localStorage = { getItem: (k) => __ls.has(String(k)) ? __ls.get(String(k)) : null, setItem: (k, v) => { __ls.set(String(k), String(v)); }, removeItem: (k) => { __ls.delete(String(k)); }, clear: () => { __ls.clear(); }, key: (i) => [...__ls.keys()][i] ?? null, get length() { return __ls.size; } };',
      'const __API = ' + JSON.stringify(API) + ';',
      'self.fetch = (url) => new Promise((resolve) => {',
      '  const path = String(url).replace(/^https?:\\/\\/[^/]+/, "");',
      '  const body = __API[path];',
      '  if (body === undefined) resolve({ ok: false, status: 404, url: String(url), json: async () => { throw new SyntaxError("Unexpected token \'N\', \\"Not found\\" is not valid JSON"); }, text: async () => "Not found" });',
      '  else { const text = JSON.stringify(body); resolve({ ok: true, status: 200, url: String(url), json: async () => JSON.parse(text), text: async () => text }); }',
      '});',
      'function click(el) { return __DOM.dispatch(el, "click", { button: 0 }); }',
      'function rightClick(el) { return __DOM.dispatch(el, "contextmenu", { button: 2 }); }',
      'function press(key) { return __DOM.dispatch(document.body, "keydown", { key }); }',
      'function type(input, text) { input.value = text; return __DOM.dispatch(input, "input", {}); }',
      'function submit(form) { return __DOM.dispatch(form, "submit", {}); }',
      'function listenerCount(el, type) { return __DOM.listenerCount(el, type); }',
    ].join('\n');
  }

  // extra.dom adds the browser-side setup above, and extra.storage seeds its localStorage.
  // extra.prelude is code that runs first in an outer scope, so the user's code can use or shadow its functions.
  // extra.drain runs pending timers and promises before reporting, for programs whose output comes later.
  // extra.session keeps the worker alive after the first run, drives the timers in real time, and turns
  // messages from the page into DOM events. Tests run after the user's code, in its scope, and may be async.
  function buildSource(userCode, tests, seed, extra) {
    extra = extra || {};
    const testLines = (tests || []).map((t) => {
      const fn = t.body ? 'async () => {\n' + t.body + '\n}' : 'async () => (' + t.code + ')';
      return '__test(' + JSON.stringify(t.name) + ', ' + fn + ');';
    }).join('\n');
    const report = 'postMessage({ output: __out, error: __error, tests: __results' + (extra.dom ? ', page: __DOM.serialize(document.body), storage: Object.fromEntries(__ls)' : '') + ' });';
    return [
      root.RunnerCore.factorySource,
      'const __RC = RunnerCoreFactory();',
      'const __out = []; const __results = []; const __tests = []; let __error = null;',
      'Math.random = __RC.makeRandom(' + (seed | 0) + ');',
      'const __log = (...a) => { __out.push({ kind: "log", text: a.map(__RC.fmtTop).join(" ") }); };',
      'self.console = { log: __log, info: __log, warn: __log, error: __log, table: (v) => { const t = __RC.tableOf(v); if (t) __out.push({ kind: "table", text: t.text, cols: t.cols, rows: t.rows }); else __log(v); } };',
      'function eq(actual, expected) { return { pass: __RC.deepEqual(actual, expected), got: __RC.show(actual), expected: __RC.show(expected) }; }',
      'function ok(cond, got, expected) { return { pass: !!cond, got: got === undefined ? String(!!cond) : __RC.show(got), expected: expected === undefined ? "true" : String(expected) }; }',
      'function __errText(e) { return e && e.name && e.message !== undefined ? e.name + ": " + e.message : __RC.fmtTop(e); }',
      'function __test(name, fn) { __tests.push([name, fn]); }',
      extra.dom ? envSource(extra) : '',
      '(async () => {',
      'try { await (async function () {',
      extra.prelude || '',
      '\n;await (async function () {',
      userCode,
      '\n;',
      testLines,
      '})(); })(); } catch (e) { __error = "Uncaught " + __errText(e); __out.push({ kind: "error", text: __error }); }',
      extra.drain && extra.dom ? 'await __drain();' : '',
      'for (const [name, fn] of __tests) { try { const r = await fn(); __results.push({ name, pass: !!(r && r.pass), got: r && r.got, expected: r && r.expected, note: r && r.note }); } catch (e) { __results.push({ name, pass: false, error: __errText(e) }); } }',
      extra.session ? [
        'function __post() { postMessage({ output: __out.splice(0), error: __error, page: __DOM.serialize(document.body), storage: Object.fromEntries(__ls) }); }',
        'self.onmessage = (e) => {',
        '  const m = e.data, el = m.nid === "body" ? document.body : __DOM.byNid(m.nid);',
        '  if (el) { try { if ("value" in m) el.value = m.value; __DOM.dispatch(el, m.type, { button: m.button, key: m.key }); } catch (err) { __out.push({ kind: "error", text: "Uncaught " + __errText(err) }); } }',
        '  __post();',
        '};',
        'let __last = Date.now(), __beat = 0;',
        '__real.setInterval(() => { const now = Date.now(); let ran = 0; try { ran = __runDue(__T.now + (now - __last)); } catch (e) { __out.push({ kind: "error", text: "Uncaught " + __errText(e) }); ran = 1; } __last = now; if (ran) __post(); else if (++__beat % 10 === 0) postMessage({ beat: 1 }); }, 30);',
        '__post();',
      ].join('\n') : report,
      '})();',
    ].join('\n');
  }

  // Returns a promise of { output, error, tests, timedOut, loadError }
  function runReal(userCode, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      let worker, url, done = false;
      const finish = (r) => { if (done) return; done = true; clearTimeout(timer); try { worker && worker.terminate(); } catch (e) {} try { url && URL.revokeObjectURL(url); } catch (e) {} resolve(r); };
      const timer = setTimeout(() => finish({ output: [], error: null, tests: [], timedOut: true }), opts.timeLimit || TIME_LIMIT_MS);
      try {
        const src = buildSource(userCode, opts.tests, opts.seed == null ? 42 : opts.seed, { dom: opts.dom, prelude: opts.prelude, drain: opts.drain, storage: opts.storage });
        url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        worker = new Worker(url);
        worker.onmessage = (e) => finish(e.data);
        worker.onerror = (e) => { e.preventDefault && e.preventDefault(); finish({ output: [], error: null, tests: [], loadError: e.message || 'The code could not run.' }); };
      } catch (e) {
        finish({ output: [], error: null, tests: [], loadError: 'This browser blocked the test runner: ' + e.message });
      }
    });
  }

  // A long-lived page: runs the code once, sends the page tree, then turns clicks into DOM events.
  // If the worker goes quiet for longer than the time limit, it is stopped and the page reports why.
  function startPage(userCode, opts) {
    opts = opts || {};
    let worker = null, url = null, timer = null, dead = false;
    const watch = () => { clearTimeout(timer); timer = setTimeout(() => { stop(); opts.onUpdate && opts.onUpdate({ timedOut: true }); }, opts.timeLimit || TIME_LIMIT_MS); };
    function stop() { dead = true; clearTimeout(timer); try { worker && worker.terminate(); } catch (e) {} try { url && URL.revokeObjectURL(url); } catch (e) {} }
    try {
      const src = buildSource(userCode, [], opts.seed == null ? 42 : opts.seed, { dom: true, session: true, prelude: opts.prelude, storage: opts.storage });
      url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      worker = new Worker(url);
      worker.onmessage = (e) => { watch(); if (!dead && !e.data.beat) opts.onUpdate && opts.onUpdate(e.data); };
      worker.onerror = (e) => { e.preventDefault && e.preventDefault(); clearTimeout(timer); opts.onUpdate && opts.onUpdate({ loadError: e.message || 'The code could not run.' }); };
      watch();
    } catch (e) {
      opts.onUpdate && opts.onUpdate({ loadError: 'This browser blocked the page runner: ' + e.message });
    }
    return {
      send(msg) { if (dead || !worker) return; worker.postMessage(msg); },
      stop,
    };
  }

  root.Runner = { runReal, buildSource, startPage, API };
})(typeof globalThis !== 'undefined' ? globalThis : this);
