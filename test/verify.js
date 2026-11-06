const vm = require('vm');
global.acorn = require('/opt/node-tools/node_modules/acorn');
require('../site/js/runner-core.js');
require('../site/js/dom-core.js');
require('../site/js/runner.js');
const T = require('../site/js/interp.js');
require('../site/js/course-js.js');
const refs = require('./refs.js');
async function realRun(code, tests, timeout, extra) {
  const src = globalThis.Runner.buildSource(code, tests, 42, extra);
  let res = null;
  const c = { setInterval, setTimeout, clearInterval, clearTimeout }; c.self = c; c.postMessage = d => { if (!d.beat) res = d; };
  vm.createContext(c);
  try { vm.runInContext(src, c, { timeout: timeout || 3000 }); } catch (e) { return { timedOut: /timed out/.test(e.message), loadError: e.message }; }
  for (let i = 0; i < 2000 && !res; i++) await new Promise(r => setImmediate(r));
  return res || { timedOut: true, output: [], tests: [] };
}
(async () => {
let fails = 0, n = 0;
for (const course of COURSES) for (const st of course.stages) for (const u of st.units) {
  if (u.example && !u.dom && !u.noRun) { const r = T.run(u.example); const real = await realRun(u.example); const a = r.output.map(o=>o.text).join('\n'), b = real.output.map(o=>o.text).join('\n'); if (a !== b || r.unsupported) { fails++; console.log('EXAMPLE MISMATCH', u.id, JSON.stringify(a), JSON.stringify(b), r.unsupported); } }
  for (const it of u.items || []) {
    n++;
    if (it.type === 'trace' && it.expect) {
      const real = await realRun(it.code, [], 3000, { dom: true, drain: true });
      const b = (real.output || []).map(o => o.text).join('\n');
      if (b !== it.expect.join('\n')) { fails++; console.log('EXPECT MISMATCH', it.id, JSON.stringify(b), JSON.stringify(it.expect)); }
      else console.log('ok', it.id, 'expected output matches Chrome |', b.replace(/\n/g, ' / '));
      continue;
    }
    if (it.type === 'trace') {
      const r = T.run(it.code);
      const real = await realRun(it.code);
      const a = r.output.map(o => o.text).join('\n');
      const b = (real.output || []).map(o => o.text).join('\n');
      if (a !== b || r.unsupported || r.stoppedAtLimit) { fails++; console.log('TRACE MISMATCH', it.id, '\n tracer:', JSON.stringify(a), '\n real:  ', JSON.stringify(b), r.unsupported || '', r.stoppedAtLimit ? 'LIMIT' : ''); }
      else console.log('ok', it.id, r.steps.length + ' steps |', a.replace(/\n/g, ' / '));
    } else {
      const ref = refs[it.id];
      if (!ref) { console.log('NO REF', it.id); fails++; continue; }
      const main = it.tests.filter(t => !t.isolate), iso = it.tests.filter(t => t.isolate);
      const ex = { dom: it.dom, prelude: it.prelude, storage: it.testStorage };
      const res = await realRun(ref, main, 3000, ex);
      const isoRes = []; for (const t of iso) isoRes.push(await realRun(ref, [t], 3000, ex));
      const all = (res.tests || []).concat(...isoRes.map(r => r.tests || []));
      const bad = all.filter(t => !t.pass);
      if (bad.length || all.length !== it.tests.length) { fails++; console.log('TEST FAIL', it.id, JSON.stringify(bad), all.length, it.tests.length, res.loadError || ''); }
      else console.log('ok', it.id, all.length + ' tests pass with reference');
      // starter should fail at least one test, and must not crash the harness
      const st0 = await realRun(it.starter, main, 2000, ex);
      if (!st0 || st0.loadError) console.log('  starter load problem', it.id, st0 && st0.loadError);
      else if (!(st0.tests || []).some(t => !t.pass)) console.log('  WARNING starter passes everything', it.id);
      // tracer can run the reference too
      const tr = T.run(ref + '\n' + (it.type === 'write' || it.type === 'fill' ? '' : ''));
      if (tr.unsupported || tr.parseError) console.log('  tracer cannot run ref', it.id, tr.unsupported || tr.parseError);
    }
  }
}
console.log('\nitems', n, 'failures', fails);
})();
