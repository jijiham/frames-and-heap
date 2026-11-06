/* Shared by the browser worker and the Node tests: formats real JavaScript values exactly the way
   the tracer formats its own values, so outputs from the two can be compared line by line. */
function RunnerCoreFactory() {
  'use strict';
  function makeRandom(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fmtNum(n) { return Object.is(n, -0) ? '-0' : String(n); }
  function fmtPrim(v) {
    if (typeof v === 'number') return fmtNum(v);
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    return String(v);
  }
  function isErr(v) { return v instanceof Error || (v && typeof v === 'object' && Object.prototype.toString.call(v) === '[object Error]'); }
  function fmtInner(v, depth, seen) {
    if (typeof v === 'string') return "'" + v + "'";
    if (v === null || (typeof v !== 'object' && typeof v !== 'function')) return fmtPrim(v);
    if (typeof v === 'function') return 'ƒ ' + (v.name || 'anonymous') + '()';
    if (typeof v.__display === 'string') return v.__display;
    if (seen.has(v)) return '[Circular]';
    if (depth > 4) return Array.isArray(v) ? '[Array]' : '[Object]';
    seen.add(v);
    let s;
    if (Array.isArray(v)) {
      const parts = [];
      for (let i = 0; i < v.length; i++) parts.push(i in v ? fmtInner(v[i], depth + 1, seen) : 'empty');
      s = '[' + parts.join(', ') + ']';
    } else if (v instanceof Set) {
      s = 'Set(' + v.size + ') {' + Array.from(v).map(x => fmtInner(x, depth + 1, seen)).join(', ') + '}';
    } else if (isErr(v)) {
      s = v.name + ': ' + v.message;
    } else {
      const parts = [];
      for (const k of Object.keys(v)) parts.push((/^[A-Za-z_$][\w$]*$/.test(k) ? k : "'" + k + "'") + ': ' + fmtInner(v[k], depth + 1, seen));
      s = '{' + parts.join(', ') + '}';
    }
    seen.delete(v);
    return s;
  }
  function fmtTop(v) { return typeof v === 'string' ? v : fmtInner(v, 0, new Set()); }
  function tableText(cols, rows) {
    const head = ['(index)'].concat(cols);
    const lines = [head.join('\t')];
    for (const r of rows) lines.push([r.index].concat(cols.map(c => r.cells[c] === undefined ? '' : r.cells[c])).join('\t'));
    return lines.join('\n');
  }
  function tableOf(v) {
    if (!v || typeof v !== 'object') return null;
    const rows = [];
    const entries = Array.isArray(v) ? v.map((row, i) => [String(i), row]) : Object.keys(v).map(k => [k, v[k]]);
    const cols = [];
    for (const [index, row] of entries) {
      const cells = {};
      if (Array.isArray(row)) row.forEach((x, j) => { const k = String(j); if (!cols.includes(k)) cols.push(k); cells[k] = fmtInner(x, 1, new Set()); });
      else if (row && typeof row === 'object') for (const k of Object.keys(row)) { if (!cols.includes(k)) cols.push(k); cells[k] = fmtInner(row[k], 1, new Set()); }
      else { if (!cols.includes('Value')) cols.push('Value'); cells.Value = fmtInner(row, 1, new Set()); }
      rows.push({ index, cells });
    }
    return { cols, rows, text: tableText(cols, rows) };
  }
  // deep equality used by tests: arrays and plain objects by contents, everything else by ===
  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number' && a !== a && b !== b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false; return true; }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  function show(v) { return fmtInner(v, 0, new Set()); }
  return { makeRandom, fmtTop, fmtInner, show, tableOf, tableText, deepEqual };
}
(function (root) {
  const api = RunnerCoreFactory();
  api.factorySource = RunnerCoreFactory.toString();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RunnerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
