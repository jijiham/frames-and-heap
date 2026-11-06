/* Frames and Heap: the app shell, Memory view, Practice view, Map and Settings. */
(function () {
  'use strict';
  const $ = (sel, el) => (el || document).querySelector(sel);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (label, cls, onClick, title) => { const b = h('button', 'btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; if (onClick) b.addEventListener('click', onClick); if (title) b.title = title; return b; };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  const DEFAULTS = {
    theme: 'solarized-auto', customBase: 'solarized-light', customColors: {}, fontSize: 16, codeFont: 'theme', bodyFont: 'theme', layout: 'side', splitMem: 0.42, splitPrac: 0.42,
    rules: 'main', addresses: true, predict: false, realCheck: true, seed: 42,
    hints: 'auto', memoryLinks: true, level: 'standard', randomTheme: 'off', suggestions: true, docsHover: true, playSpeed: 'normal',
    aiModel: 'opus-high', aiReview: 'ask', aiHints: 'ask', aiExplain: 'ask', aiExpert: 'ask', aiPractice: 'ask',
  };
  const COURSE = window.COURSES[0];
  const S = { view: 'memory', mem: { run: null, idx: 0, score: { right: 0, total: 0 }, q: null, returnTo: null, real: 'idle', realOut: null }, prac: { id: null, startedAt: 0, timer: null, pages: [] } };
  const settings = () => Store.data.settings;

  // ---------- flat item list ----------
  const ITEMS = [];
  for (const st of COURSE.stages) for (const u of st.units) {
    if (u.comingSoon) continue;
    if (u.read) ITEMS.push({ id: u.id + '-read', type: 'read', title: 'Read: ' + u.title, unit: u, stage: st });
    for (const it of u.items) ITEMS.push(Object.assign({ unit: u, stage: st }, it));
  }
  const byId = new Map(ITEMS.map(it => [it.id, it]));

  // ---------- theme ----------
  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false, addEventListener() {} };
  const fontLinks = { 'JetBrains Mono': 'JetBrains+Mono', 'Fira Code': 'Fira+Code', 'IBM Plex Mono': 'IBM+Plex+Mono', 'Source Code Pro': 'Source+Code+Pro' };
  function loadFont(name) {
    const fam = fontLinks[name];
    if (!fam || document.getElementById('font-' + fam)) return;
    const l = document.createElement('link'); l.id = 'font-' + fam; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + fam + ':wght@400;600&display=swap';
    document.head.appendChild(l);
  }
  function applyTheme() {
    const s = settings();
    if (s.randomTheme && s.randomTheme !== 'off' && !S.randomPicked) {
      S.randomPicked = true;
      const pool = Themes.ORDER.filter(id => s.randomTheme === 'all' || (s.randomTheme === 'dark') === !!Themes.T[id].dark);
      if (pool.length) s.theme = pool[Math.floor(Math.random() * pool.length)];
    }
    const cf = s.codeFont;
    if (cf && cf !== 'theme') loadFont(cf);
    const theme = Themes.resolve(s, darkQuery.matches);
    Themes.apply(theme, Object.assign({}, s, { codeFont: cf && cf !== 'theme' ? '"' + cf + '", Menlo, monospace' : 'theme' }));
    if (s.bodyFont && s.bodyFont !== 'theme') document.documentElement.style.setProperty('--font-body', s.bodyFont === 'System' ? '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' : s.bodyFont === 'Inter' ? 'Inter, -apple-system, system-ui, sans-serif' : '"' + s.bodyFont + '", Georgia, serif');
    document.body.classList.toggle('layout-side', s.layout === 'side');
    S.themeName = s.theme === 'solarized-auto' ? 'Solarized (' + (darkQuery.matches ? 'dark' : 'light') + ')' : theme.name;
    setTimeout(() => { refreshEditors(); redrawArrows(); updateStatus(); }, 30);
  }
  darkQuery.addEventListener && darkQuery.addEventListener('change', applyTheme);

  // ---------- shell ----------
  const VIEWS = ['memory', 'practice', 'map', 'tests', 'settings', 'guide'];
  function show(view) {
    if (!VIEWS.includes(view)) view = 'memory';
    S.view = view;
    for (const v of VIEWS) {
      $('#view-' + v).classList.toggle('on', v === view);
      $('#tab-' + v).setAttribute('aria-selected', v === view ? 'true' : 'false');
    }
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    if (view === 'map') renderMap();
    if (view === 'settings') renderSettings();
    if (view === 'guide') renderGuide();
    if (view === 'tests') renderTests();
    if (S.test) renderTestBar();
    if (view === 'practice' && !S.prac.rendered) renderPractice();
    setTimeout(() => { refreshEditors(); redrawArrows(); }, 0);
    updateStatus();
  }
  function refreshEditors() { [S.mem.editor, S.prac.editor, S.prac.exEditor].forEach(e => e && e.refresh()); }

  function updateStatus() {
    const left = $('#st-left'), mid = $('#st-mid'), real = $('#st-real'), save = $('#st-save'), theme = $('#st-theme');
    if (!left) return;
    if (S.view === 'memory' && S.mem.run) {
      const n = S.mem.run.steps.length;
      const step = S.mem.run.steps[S.mem.idx];
      left.textContent = n ? 'Step ' + (S.mem.idx + 1) + ' of ' + n + (step ? ', line ' + step.line : '') : 'No steps';
    } else if (S.view === 'practice') {
      const it = byId.get(S.prac.id);
      left.textContent = it ? it.title : '';
    } else left.textContent = COURSE.title;
    const done = ITEMS.filter(i => (Store.data.items[i.id] || {}).status === 'done').length;
    mid.textContent = S.view === 'memory' && settings().predict ? 'Predict: ' + S.mem.score.right + ' of ' + S.mem.score.total + ' right' : done + ' of ' + ITEMS.length + ' done';
    if (S.test) { const c = $('#tb-clock'); mid.textContent = 'Practice test' + (c && c.textContent ? ', ' + c.textContent : ''); }
    real.className = 'si right';
    if (S.view === 'memory' && settings().realCheck) {
      const r = S.mem.real;
      real.textContent = r === 'match' ? 'Real engine: matches' : r === 'differs' ? 'Real engine: output differs' : r === 'checking' ? 'Real engine: checking' : r === 'timeout' ? 'Real engine: stopped after 2 s' : '';
      if (r === 'match') real.classList.add('ok');
      if (r === 'differs' || r === 'timeout') real.classList.add('bad');
    } else real.textContent = '';
    save.textContent = Store.status === 'synced' ? 'Progress saved' : Store.status === 'saving' ? 'Saving' : 'Saved in this browser';
    theme.textContent = S.themeName || '';
  }

  // ---------- Memory view ----------
  const DEFAULT_CODE = 'function rename(person) {\n  person.name = "Bo";      // mutation: changes the caller\'s object\n  person = { name: "Cy" }; // reassignment: changes only this frame\n}\nconst a = { name: "Al" };\nrename(a);\nconsole.log(a.name);\n';

  function linkBtn(label, onClick, title) { const b = h('button', 'lnk', label); b.type = 'button'; b.addEventListener('click', onClick); if (title) b.title = title; return b; }
  function buildMemory() {
    const v = $('#view-memory');
    v.innerHTML = '';
    const top = h('p', 'mem-top');
    const ex = h('select', 'plain-select'); ex.setAttribute('aria-label', 'Load an example');
    ex.appendChild(new Option('Load an example…', ''));
    ex.appendChild(new Option('Reassignment and mutation', '__default'));
    for (const st of COURSE.stages) for (const u of st.units) if (u.example && !u.dom && !u.noRun) ex.appendChild(new Option(u.title, u.id));
    ex.addEventListener('change', () => {
      const val = ex.value; ex.value = '';
      if (!val) return;
      const code = val === '__default' ? DEFAULT_CODE : COURSE.stages.flatMap(st => st.units).find(u => u.id === val).example + '\n';
      S.mem.editor.setValue(code); retrace(true); saveMemCode();
    });
    top.appendChild(ex);
    const back = linkBtn('← back to the practice item', () => { const id = S.mem.returnTo; S.mem.returnTo = null; back.hidden = true; if (id) { S.prac.id = id; renderItem(); } show('practice'); });
    back.hidden = true; S.mem.backBtn = back;
    top.appendChild(back);
    const edHost = h('div', 'code-box editable mem-editor');
    const left = h('div', 'pane mem-left');
    left.append(top, edHost);
    const right = h('div', 'pane mem-right');
    const stepline = h('div', 'stepline');
    const num = h('h2', 'stephead', '');
    const nav = h('span', 'navlinks');
    const pred = linkBtn('predict', () => { settings().predict = !settings().predict; Store.save(); S.mem.q = null; pred.setAttribute('aria-pressed', String(settings().predict)); renderStep(); }, 'Guess each step before it shows');
    pred.setAttribute('aria-pressed', String(!!settings().predict));
    const next = linkBtn('next →', () => stepForward(), 'Right arrow');
    const playBtn = linkBtn('play', () => togglePlay(playBtn), 'Step through automatically');
    nav.append(linkBtn('first', () => go(0), 'Home'), linkBtn('← previous', () => go(S.mem.idx - 1), 'Left arrow'), next, linkBtn('last', () => go(Infinity), 'End'), playBtn, pred);
    stepline.append(num, nav);
    const range = h('input', 'scrub'); range.type = 'range'; range.min = '0'; range.value = '0'; range.setAttribute('aria-label', 'Step');
    range.addEventListener('input', () => go(+range.value));
    const rule = h('div', 'rulecard'); rule.setAttribute('aria-live', 'polite');
    const dh = h('div', 'diagram-host figure');
    const outLabel = h('p', 'lead', 'Printed so far');
    const out = h('pre', 'output'); out.setAttribute('aria-live', 'polite');
    right.append(stepline, range, rule, dh, outLabel, out);
    v.appendChild(makeSplit('mem', left, right, 'splitMem'));
    S.mem.el = { range, num, out, rule, dh, next };
    S.mem.editor = attachDocs(Editor.create(edHost, { value: Store.data.memoryCode || DEFAULT_CODE }));
    S.mem.editor.onChange(debounce(() => { retrace(false); saveMemCode(); }, 300));
  }
  // Two panes with a draggable divider between them; the left pane's share of the width is saved in settings[key].
  function makeSplit(cls, left, right, key) {
    const wrap = h('div', 'split ' + cls);
    const bar = h('div', 'divider');
    bar.setAttribute('role', 'separator'); bar.setAttribute('aria-orientation', 'vertical'); bar.title = 'Drag to resize. Double-click to reset.';
    wrap.append(left, bar, right);
    const setFrac = () => wrap.style.setProperty('--split', ((settings()[key] || DEFAULTS[key]) * 100).toFixed(2) + '%');
    const done = () => { Store.save(); refreshEditors(); redrawArrows(); };
    setFrac();
    bar.addEventListener('pointerdown', (e) => {
      e.preventDefault(); bar.setPointerCapture(e.pointerId); wrap.classList.add('dragging');
      const move = (ev) => { const r = wrap.getBoundingClientRect(); settings()[key] = Math.min(0.75, Math.max(0.2, (ev.clientX - r.left) / r.width)); setFrac(); };
      const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); wrap.classList.remove('dragging'); done(); };
      bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up);
    });
    bar.addEventListener('dblclick', () => { settings()[key] = DEFAULTS[key]; setFrac(); done(); });
    return wrap;
  }
  const saveMemCode = debounce(() => { Store.data.memoryCode = S.mem.editor.getValue(); Store.save(); }, 800);

  function retrace(reset) {
    const code = S.mem.editor.getValue();
    const wasAtEnd = S.mem.run && S.mem.idx >= S.mem.run.steps.length - 1;
    const r = Tracer.run(code, { seed: settings().seed });
    S.mem.parseError = r.parseError;
    if (r.parseError) { renderStep(); return; }
    S.mem.run = r;
    S.mem.q = null;
    const n = r.steps.length;
    if (reset) S.mem.idx = 0;
    else if (wasAtEnd) S.mem.idx = n - 1;
    S.mem.idx = Math.max(0, Math.min(S.mem.idx, n - 1));
    S.mem.el.range.max = String(Math.max(0, n - 1));
    renderStep();
    realCheck();
  }

  const realCheck = debounce(async () => {
    if (!settings().realCheck || !S.mem.run) { S.mem.real = 'idle'; updateStatus(); return; }
    const code = S.mem.editor.getValue();
    const run = S.mem.run;
    S.mem.real = 'checking'; updateStatus();
    const res = await Runner.runReal(code, { seed: settings().seed });
    if (S.mem.run !== run) return;
    if (res.timedOut) { S.mem.real = 'timeout'; S.mem.realOut = null; }
    else if (res.loadError) { S.mem.real = 'idle'; S.mem.realOut = null; }
    else {
      const realText = (res.output || []).map(o => o.text).join('\n');
      S.mem.realOut = res.output;
      S.mem.real = (run.unsupported || run.stoppedAtLimit) ? 'idle' : (realText === run.outputText ? 'match' : 'differs');
    }
    updateStatus(); renderRule();
  }, 500);

  function go(i) {
    const n = S.mem.run ? S.mem.run.steps.length : 0;
    S.mem.idx = Math.max(0, Math.min(i === Infinity ? n - 1 : i, n - 1));
    S.mem.q = null;
    renderStep();
  }

  function stepForward() {
    const run = S.mem.run; if (!run) return;
    if (S.mem.idx >= run.steps.length - 1) return;
    if (settings().predict) {
      if (!S.mem.q) { S.mem.q = makeQuestion(run, S.mem.idx); if (S.mem.q) { renderRule(); return; } }
      else if (!S.mem.q.answered) { renderRule(); return; }
    }
    go(S.mem.idx + 1);
  }

  function renderStep() {
    const run = S.mem.run;
    const ed = S.mem.editor;
    ed.clearMarks();
    if (S.mem.parseError) { ed.markLine(S.mem.parseError.line, 'line-error'); renderRule(); return; }
    if (!run || !run.steps.length) { S.mem.el.dh.innerHTML = ''; renderRule(); return; }
    const step = run.steps[S.mem.idx];
    const prev = S.mem.idx > 0 ? run.steps[S.mem.idx - 1] : null;
    S.mem.wrap = Diagram.render(S.mem.el.dh, step, prev, { showAddresses: settings().addresses });
    if (step.kind !== 'start' && step.kind !== 'end') { ed.mark(step.start, step.end, 'cm-step'); ed.markEnd(ed.lineAtIndex(step.end), '  ← ' + (step.kind === 'test' ? 'just checked' : step.kind === 'call' ? 'just called' : 'just ran')); ed.scrollToLine(step.line); }
    if (step.kind === 'error') ed.markLine(step.line, 'line-error');
    S.mem.el.range.value = String(S.mem.idx);
    S.mem.el.num.textContent = 'Step ' + (S.mem.idx + 1) + ' of ' + run.steps.length;
    renderOutput(run, step);
    renderRule();
    updateStatus();
  }

  function renderOutput(run, step) {
    const out = S.mem.el.out;
    out.innerHTML = '';
    const lines = run.output.slice(0, step.outCount);
    if (!lines.length) { out.appendChild(h('span', 'empty', 'nothing yet')); return; }
    for (const o of lines) {
      if (o.kind === 'table') out.appendChild(tableEl(o));
      else out.appendChild(h('div', 'line' + (o.kind === 'error' ? ' error' : ''), o.text));
    }
    out.scrollTop = out.scrollHeight;
  }
  function tableEl(o) {
    const t = h('table');
    const hr = h('tr'); hr.appendChild(h('th', null, '(index)')); o.cols.forEach(c => hr.appendChild(h('th', null, c))); t.appendChild(hr);
    o.rows.forEach(r => { const tr = h('tr'); tr.appendChild(h('th', null, r.index)); o.cols.forEach(c => tr.appendChild(h('td', null, r.cells[c] === undefined ? '' : r.cells[c]))); t.appendChild(tr); });
    return t;
  }

  function renderRule() {
    const card = S.mem.el.rule;
    card.innerHTML = '';
    const run = S.mem.run;
    if (S.mem.parseError) {
      const b = h('p', 'note bad'); b.textContent = 'Line ' + S.mem.parseError.line + ' has a syntax error: ' + S.mem.parseError.message + '. The diagram still shows the last version of your code that parsed.'; card.appendChild(b); return;
    }
    if (!run) return;
    if (run.unsupported) { const b = h('p', 'note'); b.textContent = 'The trace stops at line ' + run.unsupported.line + '. ' + run.unsupported.message + ' The steps before that line are shown.'; card.appendChild(b); }
    if (run.stoppedAtLimit) { const b = h('p', 'note'); b.textContent = 'The trace stopped after ' + run.steps.length.toLocaleString() + ' steps, either because a loop never ends or because the program is too long to trace step by step.'; card.appendChild(b); }
    if (S.mem.real === 'differs' && S.mem.realOut) {
      const b = h('p', 'note bad');
      b.textContent = 'Chrome\'s own JavaScript engine printed something different from this trace, so the diagram may be wrong for this code. Chrome printed: ' + S.mem.realOut.map(o => o.text).join(' / ');
      card.appendChild(b);
    }
    if (S.mem.q) { card.appendChild(questionEl(S.mem.q)); return; }
    if (settings().rules === 'off') return;
    const step = run.steps[S.mem.idx];
    if (!step) return;
    let lines = Tracer.describe(step);
    if (settings().rules === 'main') { const major = lines.filter(l => !l.minor); lines = major.length ? major : lines.slice(0, 1); }
    for (const l of lines) card.appendChild(h('p', 'txt', l.text));
  }

  // ---------- predict questions ----------
  function pathTo(snap, id, key) {
    // a readable path for slot `key` of object `id`, starting from a name in the newest frame
    const frames = snap.frames.filter(f => !f.builtin).slice().reverse();
    const seg = (k) => /^\d+$/.test(k) ? '[' + k + ']' : '.' + k;
    const found = new Map();
    const queue = [];
    for (const fr of frames) for (const e of fr.envs.slice().reverse()) for (const b of e.bindings) if (b.v.k === 'r' && !found.has(b.v.id)) { found.set(b.v.id, b.name); queue.push(b.v.id); }
    const heap = new Map(snap.heap.map(o => [o.id, o]));
    while (queue.length) {
      const oid = queue.shift(); const o = heap.get(oid); if (!o) continue;
      (o.items || []).forEach((x, i) => { if (x.k === 'r' && !found.has(x.id)) { found.set(x.id, found.get(oid) + '[' + i + ']'); queue.push(x.id); } });
      (o.props || []).forEach(p => { if (p.v.k === 'r' && !found.has(p.v.id)) { found.set(p.v.id, found.get(oid) + seg(p.key)); queue.push(p.v.id); } });
    }
    return (found.get(id) || 'a' + id) + seg(key);
  }
  function makeQuestion(run, idx) {
    const next = run.steps[idx + 1];
    if (!next) return null;
    const line = next.line;
    const evs = next.events;
    const created = new Set(evs.filter(e => e.rule === 'create').map(e => e.id));
    for (const ev of evs) {
      if (ev.rule === 'error') return { kind: 'choice', prompt: 'Line ' + line + ' throws an error. Which type is it?', choices: ['TypeError', 'ReferenceError', 'RangeError'], answer: (ev.text.match(/^(\w+Error)/) || [])[1] || 'TypeError' };
      if (ev.rule === 'output') return { kind: 'text', prompt: 'What does line ' + line + ' print?', answer: ev.text };
    }
    for (const ev of evs) {
      if ((ev.rule === 'declare' || ev.rule === 'reassign' || ev.rule === 'param') && ev.value) {
        if (ev.value.k === 'p') return { kind: 'text', prompt: 'After this step on line ' + line + ', what value does ' + ev.name + ' hold?', answer: ev.value.s };
        if (ev.value.k === 'r') return { kind: 'choice', prompt: 'After this step on line ' + line + ', ' + ev.name + ' holds an address. Is it the address of a new object or of one that already existed?', choices: ['A new object', 'One that already existed'], answer: created.has(ev.value.id) ? 'A new object' : 'One that already existed' };
      }
      if (ev.rule === 'mutate' && ev.value && ev.value.k === 'p' && !ev.via) return { kind: 'text', prompt: 'After line ' + line + ', what is ' + pathTo(next.snap, ev.id, ev.key) + '?', answer: ev.value.s };
      if (ev.rule === 'branch' || ev.rule === 'loop-test') return { kind: 'choice', prompt: 'Is the condition on line ' + line + ' true or false at this point?', choices: ['true', 'false'], answer: String(ev.result) };
      if (ev.rule === 'return' && ev.value && ev.value.k === 'p') return { kind: 'text', prompt: ev.fn + ' is about to return. What value does it return?', answer: ev.value.s };
    }
    return { kind: 'text', prompt: 'Which line runs next?', answer: String(line) };
  }
  function normAnswer(s) { return String(s).trim().replace(/\s+/g, ' ').replace(/"/g, "'").replace(/\s*([,:\[\]{}])\s*/g, '$1'); }
  function sameAnswer(a, b) {
    const x = normAnswer(a), y = normAnswer(b);
    if (x === y) return true;
    const strip = (s) => s.replace(/^'(.*)'$/, '$1');
    if (strip(x) === strip(y)) return true;
    if (!isNaN(+x) && !isNaN(+y) && x !== '' && +x === +y) return true;
    return false;
  }
  function questionEl(q) {
    const box = h('div', 'predict');
    box.appendChild(h('div', 'q', q.prompt));
    const ans = h('div', 'ans');
    const verdict = h('div', 'verdict');
    const answer = (val) => {
      if (q.answered) return;
      q.answered = true; q.given = val;
      const right = sameAnswer(val, q.answer);
      S.mem.score.total++; if (right) S.mem.score.right++;
      verdict.className = 'verdict ' + (right ? 'ok' : 'bad');
      verdict.textContent = right ? 'That\'s right.' : 'Not quite. The answer is ' + q.answer + '.';
      showBtn.hidden = false; showBtn.focus();
      updateStatus();
    };
    if (q.kind === 'choice') {
      q.choices.forEach(c => ans.appendChild(btn(c, 'sec', () => answer(c))));
    } else {
      const inp = h('input', 'field'); inp.type = 'text'; inp.setAttribute('aria-label', 'Your prediction'); inp.style.minWidth = '220px';
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') answer(inp.value); });
      ans.appendChild(inp);
      ans.appendChild(btn('Check', '', () => answer(inp.value)));
      setTimeout(() => inp.focus(), 0);
    }
    const skip = btn('Skip this one', 'sec small', () => { q.answered = true; go(S.mem.idx + 1); });
    ans.appendChild(skip);
    box.appendChild(ans);
    box.appendChild(verdict);
    const showBtn = btn('Show the step ▶', '', () => go(S.mem.idx + 1));
    showBtn.hidden = true;
    box.appendChild(showBtn);
    if (q.answered) { verdict.className = 'verdict ' + (sameAnswer(q.given, q.answer) ? 'ok' : 'bad'); verdict.textContent = sameAnswer(q.given, q.answer) ? 'That\'s right.' : 'Not quite. The answer is ' + q.answer + '.'; showBtn.hidden = false; }
    return box;
  }

  function redrawArrows() { if (S.mem.wrap && S.view === 'memory') Diagram.drawArrows(S.mem.wrap); }

  function openInMemory(code, returnTo) {
    if (S.view !== 'memory') show('memory');
    S.mem.editor.setValue(code);
    S.mem.returnTo = returnTo || null;
    S.mem.backBtn.hidden = !returnTo;
    retrace(true);
    saveMemCode();
    setTimeout(() => S.mem.editor.refresh(), 0);
  }

  // ---------- Practice ----------
  function itemStatus(id) { return (Store.data.items[id] || {}).status || 'new'; }
  function markFor(id) { const s = itemStatus(id); return s === 'done' ? '✓' : s === 'skipped' ? '–' : '○'; }

  function renderPractice() {
    S.prac.rendered = true;
    const v = $('#view-practice');
    v.innerHTML = '';
    const main = h('div', 'item-view');
    v.appendChild(main);
    S.prac.main = main; S.prac.tree = null;
    if (!S.prac.id) S.prac.id = Store.data.current && byId.has(Store.data.current) ? Store.data.current : ITEMS[0].id;
    renderItem();
  }
  function refreshTree() {
    if (!S.prac.tree) return;
    S.prac.tree.querySelectorAll('.item').forEach(b => {
      const m = b.querySelector('.mark'); const id = b.dataset.id;
      m.className = 'mark ' + itemStatus(id); m.textContent = markFor(id);
      b.setAttribute('aria-current', id === S.prac.id ? 'true' : 'false');
    });
  }
  function openItem(id) {
    if (S.test && S.test.items.includes(id)) { accrueItem(); S.test.cur = id; S.test.curSince = Date.now(); saveTest(); }
    else if (S.test) { accrueItem(); S.test.cur = null; }
    S.prac.id = id; if (!inTest(id)) Store.data.current = id; Store.save();
    if (!S.prac.rendered) { S.prac.rendered = true; const v = $('#view-practice'); v.innerHTML = ''; const main = h('div', 'item-view'); v.appendChild(main); S.prac.main = main; }
    if (S.view !== 'practice') show('practice');
    renderItem();
    if (S.test) renderTestBar();
  }
  function neighbor(d) { const i = ITEMS.findIndex(x => x.id === S.prac.id); return ITEMS[i + d] ? ITEMS[i + d].id : null; }
  function nextItem() { const n = neighbor(1); if (n) openItem(n); }

  function setStatus(id, status) {
    const r = Store.item(id);
    if (r.status === 'done' && status === 'skipped') return;
    r.status = status; r.t = Date.now();
    Store.save(); refreshTree(); updateStatus();
  }

  const UNIT_NO = new Map();
  { let k = 0; for (const st of COURSE.stages) for (const u of st.units) UNIT_NO.set(u, ++k); }

  function renderItem() {
    const it = byId.get(S.prac.id);
    const main = S.prac.main;
    if (!main || !it) return;
    main.innerHTML = '';
    (S.prac.pages || []).forEach(p => p.stop()); S.prac.pages = [];
    S.prac.editor = null; S.prac.exEditor = null;
    S.prac.startedAt = Date.now();
    // In the side-by-side layout the reading goes on the left and the code on the right, as on LeetCode.
    // In the one-column layout both halves are the same element, so everything stacks in reading order.
    const side = settings().layout === 'side';
    const L = h('div', 'pane prac-left');
    const R = side ? h('div', 'pane stack prac-right') : L;
    const crumb = h('p', 'crumb');
    const un = UNIT_NO.get(it.unit);
    crumb.appendChild(h('span', null, it.unit.synthetic ? it.unit.title : it.type === 'read' ? 'Unit ' + un : 'Unit ' + un + ': ' + it.unit.title));
    const st = itemStatus(it.id);
    if (st !== 'new' && !inTest(it.id)) crumb.appendChild(h('span', null, st === 'done' ? '✓ Done' : 'Skipped'));
    if (it.unit.synthetic && it.from) crumb.appendChild(h('span', null, 'Written by Claude from ' + it.from.map(id => byId.get(id) ? byId.get(id).title : 'an earlier item').join(', ')));
    if (inTest(it.id)) crumb.appendChild(h('span', null, 'Item ' + (S.test.items.indexOf(it.id) + 1) + ' of ' + S.test.items.length + ' in the practice test'));
    L.appendChild(crumb);
    L.appendChild(h('h1', null, it.type === 'read' ? it.unit.title : it.title));
    if (side) main.appendChild(makeSplit('prac', L, R, 'splitPrac'));
    else { const one = h('div', 'split one'); one.appendChild(L); main.appendChild(one); }
    if (it.type === 'read') renderRead(it, L, R);
    else if (it.type === 'trace') renderTrace(it, L, R);
    else renderWrite(it, L, R);
    if (st === 'skipped' && it.type !== 'read' && !inTest(it.id)) { const row = h('div', 'actions'); harderButton(it, row); if (row.children.length) L.appendChild(row); }
    const nav = h('p', 'navrow');
    const test = inTest(it.id);
    const p = test ? testNeighbor(-1) : neighbor(-1), n = test ? testNeighbor(1) : neighbor(1);
    nav.appendChild(p ? linkBtn('← previous', () => openItem(p)) : h('span'));
    nav.appendChild(test ? linkBtn('review and end', () => show('tests')) : linkBtn('contents', () => show('map')));
    nav.appendChild(n ? linkBtn('next →', () => { if (it.type === 'read') setStatus(it.id, 'done'); openItem(n); }) : test ? linkBtn('finish →', () => show('tests')) : h('span'));
    L.appendChild(nav);
    refreshTree();
    updateStatus();
    const m = document.querySelector('main'); if (m) m.scrollTop = 0;
  }

  function codeBox(parent, code, readOnly, tall) {
    const box = h('div', 'code-box' + (tall ? ' tall' : ''));
    parent.appendChild(box);
    const ed = attachDocs(Editor.create(box, { value: code, readOnly }));
    setTimeout(() => ed.refresh(), 0);
    return ed;
  }

  // A rounded panel on the right side, with an optional title line; returns the panel element.
  function panel(parent, title, cls) {
    const p = h('div', 'panel' + (cls ? ' ' + cls : ''));
    if (title) p.appendChild(h('div', 'panel-head', title));
    parent.appendChild(p);
    return p;
  }

  function renderRead(it, L, R) {
    for (const para of it.unit.read) { const p = h('p'); p.innerHTML = inline(para); L.appendChild(p); }
    const P = panel(R, 'Example');
    S.prac.exEditor = codeBox(P, it.unit.example, true);
    const acts = h('div', 'actions');
    if (settings().memoryLinks && !it.unit.dom && !it.unit.noRun) acts.appendChild(btn('Step through it in Memory', '', () => openInMemory(it.unit.example + '\n', it.id)));
    acts.appendChild(btn('Mark as read', 'sec', () => { setStatus(it.id, 'done'); nextItem(); }));
    P.appendChild(acts);
    if (it.unit.dom && !it.unit.noRun) pageBlock(panel(R, null, 'grow'), null, it.id).run(it.unit.example);
  }

  // hints
  function hintsBlock(it) {
    const wrap = h('div', 'hints');
    const rec = Store.item(it.id);
    let shown = 0;
    const list = h('div', 'hints');
    const b = btn('', 'sec', () => reveal());
    const update = () => { b.textContent = shown >= it.hints.length ? 'No more hints' : 'Hint ' + (shown + 1) + ' of ' + it.hints.length; b.disabled = shown >= it.hints.length; };
    function reveal() {
      if (shown >= it.hints.length) return;
      const d = h('div', 'hint'); d.innerHTML = '<b>Hint ' + (shown + 1) + '.</b> ' + inline(it.hints[shown]);
      list.appendChild(d); shown++; rec.hints = Math.max(rec.hints || 0, shown); Store.save(); update();
      if (inTest(it.id)) { S.test.hintsUsed[it.id] = Math.max(S.test.hintsUsed[it.id] || 0, shown); saveTest(); }
    }
    update();
    wrap.appendChild(list);
    const api = { button: b, reveal, list, get shown() { return shown; }, el: wrap };
    return api;
  }

  function expectedOutput(code) {
    const r = Tracer.run(code, { seed: 42 });
    return r.output.map(o => o.text);
  }
  function lineMatches(expected, given) {
    if (/^Uncaught (\w+)/.test(expected)) {
      const type = expected.match(/^Uncaught (\w+)/)[1];
      return given.toLowerCase().includes(type.toLowerCase());
    }
    return sameAnswer(expected, given);
  }

  // What the current item may show. A running practice test overrides the everyday settings.
  const inTest = (id) => !!(S.test && !S.test.done && S.test.items.includes(id || S.prac.id));
  const allowHints = () => inTest() ? S.test.opts.hints : settings().hints !== 'off';
  const allowMemory = () => inTest() ? S.test.opts.memory : settings().memoryLinks;
  const autoHints = () => !inTest() && settings().hints === 'auto';
  const deferFeedback = () => inTest() && S.test.opts.feedback === 'end';
  function nextInFlow() { return inTest() ? testNeighbor(1) : neighbor(1); }
  function goNext() { const n = nextInFlow(); if (n) openItem(n); else if (inTest()) showTestEnd(); }

  function traceCheck(it, text) {
    const exp = it.expect || expectedOutput(it.code);
    const given = String(text || '').replace(/\s+$/, '').split('\n').map(s => s.trim()).filter((s, i, arr) => !(s === '' && i === arr.length - 1));
    const wrong = [];
    const n = Math.max(exp.length, given.length);
    for (let i = 0; i < n; i++) if (exp[i] === undefined || given[i] === undefined || !lineMatches(exp[i], given[i])) wrong.push(i);
    return { exp, given, wrong, n, ok: !wrong.length };
  }

  function renderTrace(it, L, R) {
    const ask = h('p'); ask.innerHTML = inline(it.ask || 'What does this print? Write one line for each printed line.'); L.appendChild(ask);
    S.prac.exEditor = codeBox(panel(R, 'Program'), it.code, true);
    const AP = panel(R, 'Your answer', 'grow');
    const ta = h('textarea', 'field answer'); ta.setAttribute('aria-label', 'Your answer, one line per printed line'); ta.spellcheck = false;
    const rec = Store.item(it.id);
    const saved = inTest() ? S.test.answers[it.id] : rec.lastAnswer;
    if (saved) ta.value = saved;
    AP.appendChild(ta);
    const hints = hintsBlock(it);
    const result = h('div');
    const acts = h('div', 'actions');
    const check = btn(deferFeedback() ? 'Save answer' : 'Check', '', () => doCheck(), '⌘ Enter');
    acts.appendChild(check);
    if (allowHints() && !expert()) acts.appendChild(hints.button);
    const claudeBtn = btn('Ask Claude for a hint', 'sec', () => claudeHint(it, { answer: ta.value, wrong: lastWrong }, hints.list, claudeBtn));
    let lastWrong = '';
    acts.appendChild(btn('Skip', 'sec', () => { if (inTest()) S.test.skipped[it.id] = true; else setStatus(it.id, 'skipped'); goNext(); }));
    if (allowMemory() && !expert() && !it.noTrace) acts.appendChild(btn('Show the answer in Memory', 'sec', () => openInMemory(it.code + '\n', it.id)));
    AP.appendChild(acts);
    AP.appendChild(result);
    L.appendChild(hints.el);
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); doCheck(); } });
    ta.addEventListener('input', () => { if (inTest()) { S.test.answers[it.id] = ta.value; saveTest(); } });
    setTimeout(() => ta.focus(), 50);
    if (!inTest() && rec.status === 'done') showOk();
    function showOk() {
      result.innerHTML = '';
      const r = h('div', 'result ok'); r.appendChild(h('div', 'head', 'That\'s correct.'));
      const n = nextInFlow();
      if (n) { const a = h('div', 'actions'); a.style.marginTop = '6px'; a.appendChild(btn('Next item →', '', () => openItem(n))); r.appendChild(a); }
      result.appendChild(r);
      if (aiOn('aiExplain')) explainBlock(it, result, () => it.code);
      harderButton(it, r.querySelector('.actions') || r);
    }
    function doCheck() {
      if (inTest()) { S.test.answers[it.id] = ta.value; delete S.test.skipped[it.id]; saveTest(); }
      if (deferFeedback()) {
        result.innerHTML = '';
        result.appendChild(h('div', 'result', 'Your answer is saved, and it will be checked when the test ends.'));
        return;
      }
      const c = traceCheck(it, ta.value);
      rec.attempts = (rec.attempts || 0) + 1; rec.lastAnswer = ta.value;
      if (c.ok) {
        if (rec.attempts === 1 && !(rec.hints > 0)) rec.firstTry = true;
        if (inTest()) S.test.correct[it.id] = true;
        setStatus(it.id, 'done'); showOk(); return;
      }
      rec.misses = (rec.misses || 0) + 1; Store.save();
      result.innerHTML = '';
      const r = h('div', 'result bad');
      let head;
      if (c.given.length !== c.exp.length) head = 'Not yet. The program prints ' + c.exp.length + ' line' + (c.exp.length === 1 ? '' : 's') + ', and your answer has ' + c.given.length + '.';
      else head = 'Not yet. ' + (c.wrong.length === 1 ? 'Line ' + (c.wrong[0] + 1) + ' of your answer differs' : 'Lines ' + c.wrong.map(k => k + 1).join(', ').replace(/, ([^,]*)$/, ' and $1') + ' of your answer differ') + ' from what the program prints.';
      r.appendChild(h('div', 'head', head));
      lastWrong = c.given.length !== c.exp.length ? 'the answer has ' + c.given.length + ' lines and the program prints ' + c.exp.length : c.wrong.map(k => 'line ' + (k + 1)).join(', ');
      if (allowHints() && !acts.contains(hints.button)) acts.insertBefore(hints.button, acts.children[1] || null);
      if (allowHints() && aiOn('aiHints') && !acts.contains(claudeBtn)) acts.insertBefore(claudeBtn, hints.button.nextSibling);
      if ((!inTest() || S.test.opts.hints) && (!expert() || rec.misses >= 2)) {
        const reveal = btn('Show the answer', 'sec small', () => { r.appendChild(compareTable(c)); reveal.remove(); });
        const a = h('div', 'actions'); a.style.marginTop = '6px'; a.appendChild(reveal); r.appendChild(a);
      }
      result.appendChild(r);
      if (autoHints() && !expert() && hints.shown === 0) hints.reveal();
    }
  }
  function compareTable(c) {
    const cmp = h('div', 'cmp');
    cmp.append(h('span', 'h', 'Line'), h('span', 'h', 'Prints'), h('span', 'h', 'Yours'));
    for (let i = 0; i < c.n; i++) {
      cmp.appendChild(h('span', null, String(i + 1)));
      cmp.appendChild(h('span', null, c.exp[i] === undefined ? '' : c.exp[i]));
      cmp.appendChild(h('span', c.wrong.includes(i) ? 'wrong' : null, c.given[i] === undefined ? '(missing)' : c.given[i]));
    }
    return cmp;
  }

  // Runs an item's tests on some code in Chrome's engine. Isolated tests get their own worker and a shorter limit.
  async function runItemTests(it, code) {
    let parseErr = null;
    try { acorn.parse(code, { ecmaVersion: 2022 }); } catch (e) { parseErr = e; }
    if (parseErr) return { parseErr, rows: [], passed: 0, total: it.tests.length, logs: [] };
    const main = it.tests.filter(t => !t.isolate), iso = it.tests.filter(t => t.isolate);
    const ex = { dom: it.dom, prelude: it.prelude, storage: it.testStorage };
    const runs = [Runner.runReal(code, Object.assign({ tests: main, seed: settings().seed }, ex))].concat(iso.map(t => Runner.runReal(code, Object.assign({ tests: [t], seed: settings().seed, timeLimit: 1500 }, ex))));
    const res = await Promise.all(runs);
    const rows = [];
    const mainRes = res[0];
    main.forEach((t, i) => rows.push({ t, r: mainRes.timedOut ? { pass: false, error: 'The tests stopped after 2 seconds, which usually means a loop never ends.' } : mainRes.loadError ? { pass: false, error: mainRes.loadError } : (mainRes.tests[i] || { pass: false, error: mainRes.error || 'This test didn\'t run, because your code threw an error before reaching it.' }) }));
    iso.forEach((t, k) => { const rr = res[k + 1]; rows.push({ t, r: rr.timedOut ? { pass: false, error: 'This test stopped after 1.5 seconds, which means the call never finished.' } : (rr.tests[0] || { pass: false, error: rr.error || rr.loadError || 'This test didn\'t run.' }) }); });
    const logs = (mainRes.output || []).filter(o => o.kind !== 'error');
    return { rows, passed: rows.filter(x => x.r.pass).length, total: rows.length, logs };
  }

  // The live page for Stage 2 items: runs the code against the practice DOM in a worker that stays alive,
  // draws what it built, and passes clicks back. A new run replaces the old worker.
  // localStorage written by a practice page is kept per item in the real browser, so "Reload the page" shows
  // what survives a reload, the same way a real site's storage does.
  const PAGE_STORE_KEY = 'fh-page-storage-v1';
  const pageStore = {
    get(id) { try { return (JSON.parse(localStorage.getItem(PAGE_STORE_KEY) || '{}'))[id] || {}; } catch (e) { return {}; } },
    set(id, data) { try { const all = JSON.parse(localStorage.getItem(PAGE_STORE_KEY) || '{}'); all[id] = data; localStorage.setItem(PAGE_STORE_KEY, JSON.stringify(all)); } catch (e) {} },
  };
  function pageBlock(parent, prelude, storeId) {
    parent.appendChild(h('div', 'panel-head', 'The page'));
    let lastCode = '';
    const host = h('div', 'page-host'); parent.appendChild(host);
    const pacts = h('div', 'actions'); parent.appendChild(pacts);
    pacts.appendChild(btn('Reload the page', 'sec', () => api.run(lastCode)));
    pacts.appendChild(btn('Clear its storage', 'sec', () => { pageStore.set(storeId, {}); api.run(lastCode); }));
    const note = h('div'); parent.appendChild(note);
    const out = h('div'); parent.appendChild(out);
    let session = null;
    const view = Preview.mount(host, (msg) => session && session.send(msg));
    const logs = [];
    function update(d) {
      if (d.timedOut) { note.innerHTML = ''; note.appendChild(h('div', 'result bad', 'The page stopped responding for 2 seconds, which usually means a loop never ends, so it was stopped.')); return; }
      if (d.loadError) { note.innerHTML = ''; note.appendChild(h('div', 'result bad', d.loadError)); return; }
      if (d.page) view.draw(d.page);
      if (d.storage && storeId) pageStore.set(storeId, d.storage);
      for (const o of d.output || []) logs.push(o);
      note.innerHTML = '';
      const errs = logs.filter(o => o.kind === 'error');
      if (errs.length) note.appendChild(h('div', 'result bad', errs[errs.length - 1].text));
      out.innerHTML = '';
      const printed = logs.filter(o => o.kind !== 'error');
      if (printed.length) { out.appendChild(h('div', 'tests-head', 'What the page printed')); const m = h('div', 'mini-out'); m.textContent = printed.slice(-40).map(o => o.text).join('\n'); out.appendChild(m); }
    }
    const api = {
      run(code) {
        lastCode = code;
        if (session) session.stop();
        logs.length = 0;
        try { acorn.parse(code, { ecmaVersion: 2022 }); } catch (e) { return; }
        session = Runner.startPage(code, { prelude, seed: settings().seed, storage: storeId ? pageStore.get(storeId) : {}, onUpdate: update });
      },
      stop() { if (session) session.stop(); session = null; },
    };
    S.prac.pages.push(api);
    return api;
  }

  function renderWrite(it, L, R) {
    const spec = h('p', 'spec'); spec.innerHTML = inline(it.spec); L.appendChild(spec);
    const rec = Store.item(it.id);
    const starter = starterFor(it);
    const savedCode = inTest() ? S.test.codes[it.id] : Store.data.codes[it.id];
    const CP = panel(R, 'Code');
    const TP = panel(R, null, 'grow');
    const ed = codeBox(CP, savedCode != null ? savedCode : starter, false, true);
    S.prac.editor = ed;
    const hints = hintsBlock(it);
    const acts = h('div', 'actions');
    if (allowHints() && !expert()) acts.appendChild(hints.button);
    let lastFailures = '';
    const claudeBtn = btn('Ask Claude for a hint', 'sec', () => claudeHint(it, { code: ed.getValue(), failures: lastFailures }, hints.list, claudeBtn));
    claudeBtn.hidden = true;
    if (allowHints() && aiOn('aiHints')) acts.appendChild(claudeBtn);
    acts.appendChild(btn('Skip', 'sec', () => { if (inTest()) S.test.skipped[it.id] = true; else setStatus(it.id, 'skipped'); goNext(); }));
    acts.appendChild(btn('Reset code', 'sec', () => { ed.setValue(starter); if (inTest()) delete S.test.codes[it.id]; else delete Store.data.codes[it.id]; Store.save(); runTests(); if (page) page.run(ed.getValue()); }));
    if (allowMemory() && !it.dom) acts.appendChild(btn('Step through my code in Memory', 'sec', () => openInMemory(ed.getValue(), it.id)));
    let replayEl = null;
    if (!inTest()) acts.appendChild(btn('Replay', 'sec', () => { if (replayEl) { replayEl.remove(); replayEl = null; } else replayEl = replayPanel(it, CP, null); }, 'Replay how you wrote this'));
    CP.appendChild(acts);
    const hide = deferFeedback();
    const runState = h('div', 'panel-head tests-count', hide ? 'Tests' : 'Running the tests');
    TP.appendChild(runState);
    if (hide) TP.appendChild(h('p', 'reading', 'The results appear when the practice test ends.'));
    const testsEl = h('div', 'tests');
    TP.appendChild(testsEl);
    const result = h('div');
    TP.appendChild(result);
    const outEl = h('div'); TP.appendChild(outEl);
    const extras = h('div'); TP.appendChild(extras);
    let review = null, explained = false;
    const page = it.page ? pageBlock(panel(R, null), it.prelude, it.id) : null;
    L.appendChild(hints.el);
    let runId = 0;
    const saveCode = debounce(() => {
      if (inTest()) { S.test.codes[it.id] = ed.getValue(); delete S.test.skipped[it.id]; saveTest(); }
      else { Store.data.codes[it.id] = ed.getValue(); Store.save(); }
    }, 600);
    const codeChanged = () => { saveCode(); runSoon(); pageSoon(); };
    ed.onChange(codeChanged);
    const runSoon = debounce(() => runTests(), 450);
    const pageSoon = debounce(() => page && page.run(ed.getValue()), 600);
    async function runTests() {
      const code = ed.getValue();
      const my = ++runId;
      const out = await runItemTests(it, code);
      if (my !== runId) return;
      testsEl.innerHTML = ''; result.innerHTML = ''; outEl.innerHTML = '';
      if (out.parseErr) {
        if (!hide) runState.textContent = 'The tests did not run';
        const e = out.parseErr;
        const r = h('div', 'result bad'); r.appendChild(h('div', 'head', 'Line ' + (e.loc ? e.loc.line : '?') + ' has a syntax error: ' + e.message.replace(/\s*\(\d+:\d+\)$/, '') + '. The tests will run again once it\'s fixed.')); result.appendChild(r);
        return;
      }
      if (inTest()) { S.test.passed[it.id] = out.passed; saveTest(); }
      if (code.trim() !== starter.trim()) Replay.record(it.id, code, out.passed, out.total);
      lastFailures = out.rows.filter(x => !x.r.pass).map(x => x.t.name + ': ' + (x.r.error ? friendlyError(x.r.error) : 'expected ' + x.r.expected + ', got ' + x.r.got)).join('\n');
      claudeBtn.hidden = out.passed === out.total;
      if (out.logs.length) { const m = h('div', 'mini-out'); m.textContent = out.logs.map(o => o.text).join('\n'); outEl.appendChild(h('div', 'tests-head', 'What your code printed')); outEl.appendChild(m); }
      if (hide) return;
      for (const { t, r } of out.rows) {
        const row = h('div', 'test ' + (r.pass ? 'pass' : 'fail'));
        row.appendChild(h('span', 'm', r.pass ? '✓' : '✗'));
        row.appendChild(h('span', 'name', t.name));
        if (!r.pass) {
          const d = h('div', 'detail');
          if (r.error) d.textContent = friendlyError(r.error);
          else { d.appendChild(document.createTextNode('Expected ')); d.appendChild(h('code', null, String(r.expected))); d.appendChild(document.createTextNode(', but got ')); d.appendChild(h('code', null, String(r.got))); d.appendChild(document.createTextNode('.')); }
          row.appendChild(d);
          if (allowMemory() && !it.dom) { const a = h('div', 'detail'); a.appendChild(btn('Step through this test in Memory', 'sec', () => openInMemory(testProgram(code, t), it.id))); row.appendChild(a); }
        }
        testsEl.appendChild(row);
      }
      runState.textContent = out.passed === out.total ? (out.total === 1 ? 'The test passes' : 'All ' + out.total + ' tests pass') : out.passed + ' of ' + out.total + ' tests pass';
      if (out.passed === out.total) {
        const r = h('div', 'result ok');
        const a = h('div', 'actions');
        const n = nextInFlow(); if (n) a.appendChild(btn('Next item →', '', () => openItem(n)));
        if (aiOn('aiReview')) {
          if (!review) review = reviewBlock(it, extras, ed, codeChanged);
          if (settings().aiReview === 'auto') review.run();
          else a.appendChild(btn('Review my code with Claude', 'sec', () => review.run()));
        }
        r.appendChild(a);
        result.appendChild(r);
        if (aiOn('aiExplain') && !explained) { explained = true; explainBlock(it, extras, () => ed.getValue()); }
        harderButton(it, a);
        if (rec.status !== 'done') { if (!(rec.hints > 0)) rec.firstTry = true; setStatus(it.id, 'done'); }
      } else if (code.trim() !== starter.trim()) {
        rec.attempts = (rec.attempts || 0) + 1; Store.save();
        if (allowHints() && !acts.contains(hints.button)) acts.insertBefore(hints.button, acts.firstChild);
        if (autoHints() && !expert() && hints.shown === 0) autoHint();
      }
    }
    const autoHint = debounce(() => { if (hints.shown === 0) hints.reveal(); }, 2500);
    runTests();
    if (page) page.run(ed.getValue());
  }

  function friendlyError(e) {
    const m = String(e).match(/^ReferenceError: (\w+) is not defined/);
    if (m) return m[1] + ' isn\'t defined yet, so the tests can\'t call it. Write a function with that name.';
    return e;
  }
  function testProgram(code, t) {
    const helpers = '\n\n// Test: ' + t.name + ' (these helper lines aren\'t your code)\nfunction eq(actual, expected) { return actual; }\nfunction ok(cond) { return cond; }\n';
    return code.replace(/\s+$/, '') + helpers + (t.body ? '(function test() {\n' + t.body + '\n})();\n' : 'console.log(' + t.code + ');\n');
  }

  // ---------- Hover docs ----------
  const tip = (() => { const t = document.createElement('div'); t.className = 'doc-tip'; t.hidden = true; document.body.appendChild(t); return t; })();
  let tipTimer = null;
  tip.addEventListener('mouseenter', () => clearTimeout(tipTimer));
  tip.addEventListener('mouseleave', () => { tipTimer = setTimeout(() => { tip.hidden = true; }, 200); });
  function showTip(entry, x, y) {
    clearTimeout(tipTimer);
    tip.innerHTML = '';
    tip.appendChild(h('div', 'sig', entry[0]));
    tip.appendChild(h('div', null, entry[1]));
    const a = h('a', null, 'MDN reference'); a.href = entry[2]; a.target = '_blank'; a.rel = 'noopener';
    tip.appendChild(a);
    tip.hidden = false;
    const w = Math.min(380, window.innerWidth - 24);
    tip.style.maxWidth = w + 'px';
    tip.style.left = Math.max(8, Math.min(x + 12, window.innerWidth - w - 12)) + 'px';
    tip.style.top = Math.min(y + 18, window.innerHeight - 120) + 'px';
  }
  function attachDocs(ed) {
    if (!ed || !ed.cm) return ed;
    const cm = ed.cm, wrap = cm.getWrapperElement();
    let t = null;
    wrap.addEventListener('mousemove', (e) => {
      if (!settings().docsHover) return;
      clearTimeout(t);
      t = setTimeout(() => {
        const pos = cm.coordsChar({ left: e.clientX, top: e.clientY }, 'window');
        const tok = cm.getTokenAt({ line: pos.line, ch: pos.ch + 1 }, true);
        if (!tok || !/^[A-Za-z_$][\w$]*$/.test(tok.string) || pos.ch < tok.start || pos.ch >= tok.end) { tipTimer = setTimeout(() => { tip.hidden = true; }, 150); return; }
        const before = cm.getLine(pos.line).slice(0, tok.start).replace(/\s+$/, '');
        const dot = before.endsWith('.') ? '.' : '';
        const obj = dot ? (before.slice(0, -1).match(/([A-Za-z_$][\w$]*)$/) || [])[1] : null;
        const entry = Docs.lookup(tok.string, dot, obj);
        if (entry) showTip(entry, e.clientX, e.clientY); else tipTimer = setTimeout(() => { tip.hidden = true; }, 150);
      }, 300);
    });
    wrap.addEventListener('mouseleave', () => { clearTimeout(t); tipTimer = setTimeout(() => { tip.hidden = true; }, 250); });
    return ed;
  }

  // ---------- Expert mode ----------
  const expert = () => settings().level === 'expert' && !inTest();
  function starterFor(it) {
    if (!(expert() && it.type === 'fill')) return it.starter;
    const first = it.starter.split('\n')[0];
    return first + '\n  \n}\n';
  }

  // ---------- Replay of how you wrote an item ----------
  // Snapshots stay in this browser only, since they would make the synced progress too large.
  const REPLAY_KEY = 'fh-replay-v1';
  const Replay = {
    all() { try { return JSON.parse(localStorage.getItem(REPLAY_KEY) || '{}'); } catch (e) { return {}; } },
    get(id) { return this.all()[id] || []; },
    record(id, code, pass, total) {
      const all = this.all();
      const list = all[id] || (all[id] = []);
      const last = list[list.length - 1];
      if (last && last.code === code) { last.pass = pass; last.total = total; }
      else list.push({ t: Date.now(), code, pass, total });
      if (list.length > 300) list.splice(1, list.length - 300);
      try { localStorage.setItem(REPLAY_KEY, JSON.stringify(all)); }
      catch (e) { for (const k of Object.keys(all)) all[k] = all[k].filter((_, i, a) => i === 0 || i % 2 === 0 || i === a.length - 1); try { localStorage.setItem(REPLAY_KEY, JSON.stringify(all)); } catch (e2) {} }
    },
  };
  const PAUSE_MS = 20000;
  function replayPanel(it, parent, before) {
    const snaps = Replay.get(it.id);
    const panel = h('div', 'replay');
    parent.insertBefore(panel, before);
    if (snaps.length < 2) { panel.appendChild(h('p', null, 'There is nothing to replay yet. Snapshots are saved each time the tests run on new code.')); return panel; }
    const label = h('p', 'replay-label');
    const box = h('div', 'code-box');
    panel.append(label, box);
    const ed = Editor.create(box, { value: snaps[0].code, readOnly: true });
    setTimeout(() => ed.refresh(), 0);
    const range = h('input', 'scrub'); range.type = 'range'; range.min = '0'; range.max = String(snaps.length - 1); range.value = '0';
    const acts = h('div', 'actions');
    let timer = null, k = 0;
    const show = (i) => {
      k = i; range.value = String(i);
      const s = snaps[i];
      ed.setValue(s.code);
      const tests = s.total == null ? 'the code had a syntax error' : s.pass + ' of ' + s.total + ' tests passed';
      const gap = i > 0 ? s.t - snaps[i - 1].t : 0;
      label.textContent = 'Snapshot ' + (i + 1) + ' of ' + snaps.length + ', ' + fmtMs(s.t - snaps[0].t) + ' after the first one: ' + tests + '.' + (gap >= PAUSE_MS ? ' You paused for ' + fmtMs(gap) + ' before this version.' : '');
    };
    // The longest pauses, where you stopped to think, as links to the version you wrote after each one.
    const pauses = snaps.map((x, i) => ({ i, gap: i ? x.t - snaps[i - 1].t : 0 })).filter(p => p.gap >= PAUSE_MS).sort((a, b) => b.gap - a.gap).slice(0, 5).sort((a, b) => a.i - b.i);
    if (pauses.length) {
      const row = h('p', 'replay-pauses');
      row.appendChild(document.createTextNode('Longest pauses: '));
      pauses.forEach((p, k) => { if (k) row.appendChild(document.createTextNode(', ')); row.appendChild(linkBtn(fmtMs(p.gap) + ' before snapshot ' + (p.i + 1), () => show(p.i))); });
      panel.appendChild(row);
    }
    const play = btn('Play', '', () => {
      if (timer) { clearInterval(timer); timer = null; play.textContent = 'Play'; return; }
      if (k >= snaps.length - 1) show(0);
      play.textContent = 'Pause';
      timer = setInterval(() => { if (k >= snaps.length - 1) { clearInterval(timer); timer = null; play.textContent = 'Play'; return; } show(k + 1); }, { slow: 1200, normal: 600, fast: 250 }[settings().playSpeed] || 600);
    });
    range.addEventListener('input', () => show(+range.value));
    acts.append(play);
    panel.append(range, acts);
    show(0);
    return panel;
  }

  // ---------- Claude: hints, code review and explanation checks ----------
  const numbered = (code) => code.split('\n').map((l, i) => String(i + 1).padStart(3) + '  ' + l).join('\n');
  const modelName = () => ({ 'opus-high': 'Opus 5.5, high effort', 'opus-medium': 'Opus 5.5, medium effort', sonnet: 'Sonnet 5.5' })[settings().aiModel] || 'Opus 5.5, high effort';
  const aiOn = (key) => settings()[key] !== 'off' && !inTest();

  async function claudeHint(it, ctx, list, button) {
    button.disabled = true;
    const d = h('div', 'hint'); d.appendChild(h('b', null, 'Hint from Claude. ')); const body = h('span', null, 'Thinking…'); d.appendChild(body); list.appendChild(d);
    const seen = Array.from(list.querySelectorAll('.hint')).slice(0, -1).map(x => x.textContent).join('\n');
    const prompt = [
      'A learner is practicing JavaScript and is stuck. Give the single smallest hint that would get them unstuck.',
      'Rules: never write code, pseudo-code or a corrected line, and never state the answer or the printed output. Point them toward where to look or what to reconsider, in one or two sentences. You may refer to a line number. ' + AI.STYLE,
      'Exercise: ' + (it.spec || it.ask || 'Predict what this program prints, one line per printed line.'),
      it.type === 'trace' ? 'The program:\n' + numbered(it.code) + '\n\nTheir answer:\n' + ctx.answer + '\n\nWhich lines of their answer are wrong: ' + ctx.wrong : 'Their code:\n' + numbered(ctx.code) + '\n\nWhat happened when the tests ran:\n' + ctx.failures,
      seen ? 'Hints they have already seen, so say something more useful than these:\n' + seen : '',
      'Reply with the hint only.',
    ].filter(Boolean).join('\n\n');
    try {
      const r = await AI.ask(prompt, { model: settings().aiModel, onText: ({ text }) => { body.textContent = text; } });
      body.textContent = (r && r.text) || body.textContent;
      const rec = Store.item(it.id); rec.aiHints = (rec.aiHints || 0) + 1; Store.save();
    } catch (e) { body.textContent = AI.errorText(e); }
    button.disabled = false;
  }

  function reviewBlock(it, parent, ed, onApply) {
    const box = h('div', 'review');
    parent.appendChild(box);
    const head = h('div', 'panel-head', ''); head.hidden = true;
    box.appendChild(head);
    const state = { set textContent(v) { head.hidden = !v; head.textContent = v; } };
    const body = h('div'); box.appendChild(body);
    let lastCode = null;
    async function run() {
      const code = ed.getValue();
      if (code === lastCode) return;
      lastCode = code;
      body.innerHTML = '';
      state.textContent = modelName() + ' is reviewing your code';
      const prompt = [
        'You are a senior engineer with excellent taste reviewing a learner\'s JavaScript. The code already passes all of its tests. Suggest at most four edits that a top engineer would make: clearer names, simpler or more idiomatic modern JavaScript, removing redundancy, or handling an edge case the task implies. Every edit must keep all tests passing, must be small, and must be independent of the others. If the code is already excellent, return no edits.',
        'Task: ' + it.spec,
        'Tests it passes: ' + it.tests.map(t => t.name).join('; '),
        'Code:\n<code>\n' + code + '\n</code>',
        'Return JSON of the form {"summary": string, "edits": [{"title": string, "why": string, "find": string, "replace": string}]}. "find" must be copied exactly from the code, character for character including spaces and line breaks, and must occur exactly once. "replace" is the text that takes its place. "title" is a short label of at most eight words. "why" explains the reason in one to three sentences. "summary" gives your overall read of the code in one or two sentences. ' + AI.STYLE,
      ].join('\n\n');
      try {
        const r = await AI.ask(prompt, { model: settings().aiModel, json: true });
        if (ed.getValue() !== code) { lastCode = null; state.textContent = ''; return; }
        state.textContent = 'Code review from ' + modelName();
        const edits = (r && Array.isArray(r.edits) ? r.edits : []).filter(e => e && typeof e.find === 'string' && e.find && typeof e.replace === 'string' && code.split(e.find).length === 2);
        if (r && r.summary) body.appendChild(h('p', null, r.summary));
        if (!edits.length) body.appendChild(h('p', null, 'Claude has no edits to suggest for this code.'));
        for (const e of edits) {
          const card = h('div', 'edit');
          card.appendChild(h('div', 'edit-title', e.title || 'Suggested edit'));
          if (e.why) card.appendChild(h('p', null, e.why));
          const diff = h('pre', 'diff');
          for (const l of e.find.split('\n')) diff.appendChild(h('span', 'del', '- ' + l));
          for (const l of e.replace.split('\n')) diff.appendChild(h('span', 'add', '+ ' + l));
          card.appendChild(diff);
          const acts = h('div', 'actions');
          const apply = btn('Apply', '', () => {
            const cur = ed.getValue();
            if (cur.split(e.find).length !== 2) { note.textContent = 'This edit no longer matches your code, so it can\'t be applied.'; return; }
            ed.setValue(cur.replace(e.find, () => e.replace));
            lastCode = ed.getValue();
            apply.disabled = true; dismiss.disabled = true; note.textContent = 'Applied. The tests are running again.';
            const rec = Store.item(it.id); rec.reviewApplied = (rec.reviewApplied || 0) + 1; Store.save();
            onApply();
          });
          const dismiss = btn('Dismiss', 'sec', () => card.remove());
          const note = h('span');
          acts.append(apply, dismiss, note);
          card.appendChild(acts);
          body.appendChild(card);
        }
      } catch (e) { state.textContent = ''; lastCode = null; body.appendChild(h('p', null, AI.errorText(e))); }
    }
    return { run, el: box };
  }

  function explainBlock(it, parent, getCode) {
    const box = h('div', 'explain');
    parent.appendChild(box);
    const open = btn('Explain it to Claude', 'sec', () => { open.remove(); form.hidden = false; ta.focus(); });
    box.appendChild(open);
    const form = h('div'); form.hidden = true; box.appendChild(form);
    form.appendChild(h('div', 'tests-head', it.type === 'trace' ? 'Explain why the program prints what it prints' : 'Explain how your code works and why it is correct'));
    const ta = h('textarea', 'field answer'); ta.setAttribute('aria-label', 'Your explanation'); form.appendChild(ta);
    const acts = h('div', 'actions'); form.appendChild(acts);
    const out = h('div'); form.appendChild(out);
    const go = btn('Check my explanation', '', async () => {
      if (!ta.value.trim()) return;
      go.disabled = true; out.innerHTML = ''; out.appendChild(h('p', null, 'Claude is reading your explanation.'));
      const prompt = [
        'A learner finished this JavaScript exercise and then explained it in their own words, possibly by dictation, so ignore transcription slips. Judge whether the explanation shows real understanding of why it works, focusing on the memory model (frames, values, addresses, mutation versus reassignment) and the control flow where they matter.',
        'Exercise: ' + (it.spec || it.ask || 'Predict what this program prints.'),
        (it.type === 'trace' ? 'Program:\n' : 'Their code:\n') + numbered(getCode()),
        'Their explanation:\n' + ta.value,
        'Return JSON of the form {"verdict": "solid" | "partly right" | "not yet", "right": [string], "missing": [string], "question": string}. "right" lists up to three things they explained correctly and "missing" up to three things that were wrong, vague or missing, each stated with the correct idea. "question" is one follow-up question that tests the weakest part, or an empty string when the explanation is solid. ' + AI.STYLE,
      ].join('\n\n');
      try {
        const r = await AI.ask(prompt, { model: settings().aiModel, json: true });
        out.innerHTML = '';
        out.appendChild(h('p', 'verdict-line', 'Claude\'s verdict: ' + (r.verdict || 'no verdict') + '.'));
        if (r.right && r.right.length) { out.appendChild(h('p', null, 'What you explained well:')); const ul = h('ul'); r.right.forEach(x => ul.appendChild(h('li', null, x))); out.appendChild(ul); }
        if (r.missing && r.missing.length) { out.appendChild(h('p', null, 'What was wrong or missing:')); const ul = h('ul'); r.missing.forEach(x => ul.appendChild(h('li', null, x))); out.appendChild(ul); }
        if (r.question) out.appendChild(h('p', null, 'A question to check the weakest part: ' + r.question));
        const rec = Store.item(it.id); rec.explained = r.verdict; Store.save();
      } catch (e) { out.innerHTML = ''; out.appendChild(h('p', null, AI.errorText(e))); }
      go.disabled = false;
    });
    acts.appendChild(go);
    return box;
  }

  // ---------- Practice written by Claude ----------
  // New items live in their own unit at the end of Contents. A generated trace is kept only when the tracer can
  // run it and Chrome's engine prints the same thing, so its answer key and Memory diagram are both right.
  // A generated write item is kept only when Claude's hidden reference solution passes every test and the
  // starter fails at least one; the reference is then thrown away.
  const GEN_UNIT = { id: 'gen', title: 'Practice written by Claude', items: [], synthetic: true };
  const GEN_STAGE = { id: 'sg', title: 'Practice written by Claude', units: [GEN_UNIT], synthetic: true };
  function addGenerated(it) {
    if (byId.has(it.id)) return;
    it.unit = GEN_UNIT; it.stage = GEN_STAGE;
    GEN_UNIT.items.push(it); ITEMS.push(it); byId.set(it.id, it);
  }
  function loadGenerated() { for (const it of Store.data.generated || []) addGenerated(Object.assign({}, it)); }
  function saveGenerated(it) {
    const plain = Object.assign({}, it); delete plain.unit; delete plain.stage;
    Store.data.generated = (Store.data.generated || []).concat(plain);
    addGenerated(it); Store.save();
  }
  const GEN_RULES = 'Use only plain JavaScript from these topics: let and const, numbers and strings, if, for, while, for...of, functions and arrow functions, arrays and their methods, objects, closures and recursion. Do not use classes, async code, timers, regular expressions, the DOM, imports or try/catch.';

  async function validTrace(code) {
    const r = Tracer.run(code, { seed: 42 });
    if (r.parseError || r.unsupported || r.stoppedAtLimit || !r.output.length || r.output.length > 8) return null;
    const real = await Runner.runReal(code, { seed: 42 });
    const a = r.output.map(o => o.text).join('\n'), b = (real.output || []).map(o => o.text).join('\n');
    return a === b ? r.output.map(o => o.text) : null;
  }

  async function generateTraces(sources, count, note) {
    const examples = sources.map(it => 'Item "' + it.title + '" (' + (it.tags || []).join(', ') + '):\n' + (it.code || it.spec)).join('\n\n');
    const prompt = [
      'You write practice for a learner studying how JavaScript programs run: frames, values, addresses, mutation versus reassignment, and control flow. ' + note,
      'Write ' + count + ' new trace exercises. Each is a short program of 4 to 14 lines that prints 1 to 5 lines with console.log, built to test the same ideas as the items below from a new angle, with a realistic trap where a learner who half understands the idea would predict the wrong output.',
      GEN_RULES,
      'The items the learner had trouble with:\n' + examples,
      'Return JSON of the form {"items": [{"title": string, "code": string, "hints": [string, string, string], "tags": [string]}]}. The title is at most six words. The three hints go from a nudge about where to look, to the mechanism at work, to a description of the reasoning; none of them may state the printed output or contain code. ' + AI.STYLE,
    ].join('\n\n');
    const r = await AI.ask(prompt, { model: settings().aiModel, json: true });
    const made = [];
    for (const x of (r && r.items) || []) {
      if (!x || typeof x.code !== 'string' || !Array.isArray(x.hints)) continue;
      const out = await validTrace(x.code);
      if (!out) continue;
      const it = { type: 'trace', id: 'g' + Date.now().toString(36) + made.length, title: String(x.title || 'A new trace').slice(0, 60), code: x.code, hints: x.hints.slice(0, 3).map(String), tags: Array.isArray(x.tags) ? x.tags.map(String) : [], from: sources.map(s => s.id) };
      saveGenerated(it); made.push(it);
    }
    return made;
  }

  async function generateHarderWrite(src) {
    const prompt = [
      'You write practice for a learner studying JavaScript. They just finished or skipped the exercise below. Write one harder version that practices the same skill with one more real complication, such as an extra edge case, a second dimension, or a rule that interacts with the first.',
      src.dom ? 'The exercise runs against a browser DOM; tests may use document, click(el), rightClick(el), press(key), type(input, text), submit(form), tick(ms) to advance timers, and await flush() to let promises settle.' : GEN_RULES,
      'The original exercise:\n' + src.spec + (src.starter ? '\n\nIts starter:\n' + src.starter : ''),
      'Example tests from the original, to show the test format:\n' + src.tests.slice(0, 3).map(t => t.body ? 'name: ' + t.name + '\nbody:\n' + t.body : 'name: ' + t.name + '\ncode: ' + t.code).join('\n\n'),
      'Return JSON of the form {"title": string, "spec": string, "starter": string, "tests": [{"name": string, "body": string}], "hints": [string, string, string], "reference": string}. "spec" describes the task fully in two to five sentences, using backticks around code names. "starter" is only the empty function signature or signatures. Each test "body" is JavaScript statements that end by returning eq(actual, expected) or ok(condition, got, expected), and there are 4 to 6 tests. "reference" is a correct solution, used only to check the tests and never shown. The hints never contain code. ' + AI.STYLE,
    ].join('\n\n');
    const r = await AI.ask(prompt, { model: settings().aiModel, json: true });
    if (!r || typeof r.spec !== 'string' || !Array.isArray(r.tests) || typeof r.reference !== 'string' || typeof r.starter !== 'string') throw new Error('Claude\'s answer was missing parts.');
    const tests = r.tests.filter(t => t && typeof t.body === 'string' && t.name).slice(0, 8).map(t => ({ name: String(t.name), body: t.body }));
    if (tests.length < 3) throw new Error('Claude wrote too few tests.');
    const opts = { tests, seed: 42, dom: src.dom, prelude: src.prelude, storage: src.testStorage };
    const good = await Runner.runReal(r.reference, opts);
    if (!good.tests || good.tests.length !== tests.length || !good.tests.every(t => t.pass)) throw new Error('Claude\'s own solution failed its tests, so the item was thrown away.');
    const bad = await Runner.runReal(r.starter, opts);
    if (bad.tests && bad.tests.length === tests.length && bad.tests.every(t => t.pass)) throw new Error('The empty starter already passed the tests, so the item was thrown away.');
    const it = { type: 'write', id: 'g' + Date.now().toString(36), title: String(r.title || 'Harder: ' + src.title).slice(0, 60), spec: r.spec, starter: r.starter.endsWith('\n') ? r.starter : r.starter + '\n', tests, hints: (r.hints || []).slice(0, 3).map(String), tags: src.tags || [], dom: src.dom, page: src.page, prelude: src.prelude, from: [src.id] };
    if (it.hints.length < 3) while (it.hints.length < 3) it.hints.push('Reread the spec and list each rule it states, then check your code against them one at a time.');
    saveGenerated(it);
    return it;
  }

  function harderButton(it, parent) {
    if (!aiOn('aiExpert') || it.unit.synthetic && it.type === 'write' && (it.from || []).length > 1) return;
    const note = h('span');
    const b = btn('Harder version from Claude', 'sec', async () => {
      b.disabled = true; note.textContent = 'Claude is writing it and checking it.';
      try {
        if (it.type === 'trace') {
          const made = await generateTraces([it], 2, 'The learner already answered this trace, so make the new ones clearly harder: more steps, a subtler trap, or two ideas interacting.');
          if (!made.length) throw new Error('None of Claude\'s programs passed the checks, so try again.');
          openItem(made[0].id);
        } else openItem((await generateHarderWrite(it)).id);
      } catch (e) { note.textContent = e.code ? AI.errorText(e) : e.message; b.disabled = false; }
    });
    parent.append(b, note);
  }

  // ---------- Suggestions aimed at misses ----------
  function suggestions() {
    const out = [], weakTags = new Map();
    for (const it of practiceItems()) {
      const r = Store.data.items[it.id];
      if (!r) continue;
      let reason = null, score = 0;
      if (r.status === 'skipped') { reason = 'You skipped it.'; score = 2; }
      else if (r.status !== 'done' && (r.attempts > 0 || r.misses > 0)) { reason = 'You started it and haven\'t finished it.'; score = 3; }
      else if (r.misses >= 2) { reason = 'You missed it ' + r.misses + ' times before getting it right.'; score = 2; }
      else if (r.hints >= 2) { reason = 'You used ' + r.hints + ' hints on it.'; score = 1.5; }
      else if (r.misses === 1) { reason = 'You missed it once.'; score = 1; }
      if (!reason) continue;
      out.push({ id: it.id, reason, score, t: r.t || 0 });
      for (const tag of it.tags || []) if (!weakTags.has(tag)) weakTags.set(tag, it);
    }
    const seen = new Set(out.map(o => o.id));
    for (const [tag, src] of weakTags) {
      const rel = practiceItems().find(i => !seen.has(i.id) && itemStatus(i.id) === 'new' && (i.tags || []).includes(tag));
      if (rel) { seen.add(rel.id); out.push({ id: rel.id, reason: 'It practices the same idea as ' + src.title + ', which gave you trouble.', score: 0.5, t: 0 }); }
    }
    return out.sort((a, b) => b.score - a.score || b.t - a.t).slice(0, 6);
  }

  // ---------- Memory autoplay ----------
  function togglePlay(btnEl) {
    if (S.mem.play) { clearInterval(S.mem.play); S.mem.play = null; btnEl.textContent = 'play'; return; }
    const run = S.mem.run; if (!run) return;
    if (S.mem.idx >= run.steps.length - 1) go(0);
    btnEl.textContent = 'pause';
    S.mem.play = setInterval(() => {
      const r = S.mem.run;
      if (!r || S.mem.idx >= r.steps.length - 1 || S.view !== 'memory') { clearInterval(S.mem.play); S.mem.play = null; btnEl.textContent = 'play'; return; }
      stepForward();
    }, { slow: 1200, normal: 600, fast: 250 }[settings().playSpeed] || 600);
  }

  // ---------- Practice tests ----------
  // A test is a fixed list of items with its own clock, its own saved answers and code, and its own rules for hints,
  // Memory and feedback. Everyday practice progress is untouched until the test ends and is scored.
  const TEST_DEFAULTS = { preset: 'grid4', unit: 'u6', stage: 's1', kinds: { trace: true, fill: true, write: true }, count: 5, order: 'in', limit: 30, hints: false, memory: false, feedback: 'live', timeUp: 'continue', hidePaused: true, picked: [] };
  const PRESETS = [['grid4', 'The four grid functions'], ['mock', 'One unseen app'], ['unit', 'One unit'], ['stage', 'One stage'], ['missed', 'Items you missed or skipped'], ['pick', 'Items you choose']];
  const GRID4 = ['u6w3', 'u6w4', 'u6w1', 'u6w2'];
  const testSetup = () => { Store.data.testSetup = Object.assign({}, TEST_DEFAULTS, Store.data.testSetup || {}); return Store.data.testSetup; };
  const practiceItems = () => ITEMS.filter(i => i.type !== 'read');
  function missedIds() {
    return practiceItems().filter(i => { const r = Store.data.items[i.id] || {}; return r.status === 'skipped' || (r.misses > 0) || (r.attempts > 0 && r.status !== 'done') || r.hints > 0; }).map(i => i.id);
  }
  function testPool(st) {
    let ids;
    if (st.preset === 'grid4') return GRID4.slice();
    if (st.preset === 'mock') { const apps = practiceItems().filter(i => i.unit.id === 'u21'); return [apps[Math.floor(Math.random() * apps.length)].id]; }
    if (st.preset === 'pick') return practiceItems().map(i => i.id).filter(id => st.picked.includes(id));
    if (st.preset === 'unit') ids = practiceItems().filter(i => i.unit.id === st.unit).map(i => i.id);
    else if (st.preset === 'stage') ids = practiceItems().filter(i => i.stage.id === st.stage).map(i => i.id);
    else ids = missedIds();
    ids = ids.filter(id => st.kinds[byId.get(id).type]);
    if (st.order === 'shuffle') for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    if (st.count !== 'all') ids = ids.slice(0, st.count);
    return ids;
  }
  function presetName(st) {
    if (st.preset === 'unit') { const u = COURSE.stages.flatMap(x => x.units).find(x => x.id === st.unit); return 'Unit ' + UNIT_NO.get(u) + ': ' + u.title; }
    if (st.preset === 'stage') return COURSE.stages.find(x => x.id === st.stage).title;
    if (st.preset === 'mock') return 'Mock live round';
    return PRESETS.find(p => p[0] === st.preset)[1];
  }

  const clockMs = () => !S.test ? 0 : S.test.elapsed + (S.test.paused ? 0 : Date.now() - S.test.runSince);
  const fmtMs = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60; return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0'); };
  const saveTest = debounce(() => { if (!S.test) return; S.test.savedElapsed = clockMs(); Store.data.activeTest = S.test; Store.save(); }, 400);
  function accrueItem() {
    if (!S.test || S.test.paused || !S.test.cur) return;
    const now = Date.now();
    S.test.itemMs[S.test.cur] = (S.test.itemMs[S.test.cur] || 0) + (now - S.test.curSince);
    S.test.curSince = now;
  }
  function testNeighbor(d) { const i = S.test.items.indexOf(S.prac.id); return i < 0 ? S.test.items[0] : S.test.items[i + d] || null; }

  function startTest() {
    const st = testSetup();
    const items = testPool(st);
    if (!items.length) return;
    const now = Date.now();
    S.test = {
      name: presetName(st), items, startedAt: now, elapsed: 0, runSince: now, paused: false, cur: items[0], curSince: now,
      opts: { hints: st.hints, memory: st.memory, feedback: st.feedback, timeUp: st.timeUp, hidePaused: st.hidePaused, limitMs: st.limit ? st.limit * 60000 : 0 },
      itemMs: {}, answers: {}, codes: {}, passed: {}, correct: {}, skipped: {}, hintsUsed: {}, hideClock: false, timeUpShown: false,
    };
    S.lastResult = null;
    saveTest();
    startTicker();
    S.prac.id = items[0];
    if (!S.prac.rendered) renderPractice(); else renderItem();
    show('practice');
    renderTestBar();
  }
  function startTicker() { clearInterval(S.testTick); S.testTick = setInterval(tick, 1000); }
  function tick() {
    if (!S.test) { clearInterval(S.testTick); return; }
    renderClock();
    const lim = S.test.opts.limitMs;
    if (lim && !S.test.paused && clockMs() >= lim && !S.test.timeUpShown) {
      S.test.timeUpShown = true; saveTest();
      if (S.test.opts.timeUp === 'end') endTest();
      else renderTestBar();
    }
    if (Date.now() % 10000 < 1000) saveTest();
  }
  function pauseTest() {
    if (!S.test || S.test.paused) return;
    accrueItem();
    S.test.elapsed = clockMs(); S.test.paused = true; saveTest(); renderTestBar();
  }
  function resumeTest() {
    if (!S.test || !S.test.paused) return;
    const now = Date.now();
    S.test.paused = false; S.test.runSince = now; S.test.curSince = now; saveTest(); renderTestBar();
  }

  function renderTestBar() {
    const bar = $('#testbar');
    const m = $('main');
    if (!S.test) { bar.hidden = true; m.classList.remove('test-paused'); $('#pause-cover').hidden = true; updateStatus(); return; }
    bar.hidden = false;
    bar.innerHTML = '';
    bar.appendChild(h('span', 'tb-name', S.test.name));
    const nums = h('span', 'tb-items');
    S.test.items.forEach((id, k) => {
      const answered = S.test.answers[id] || S.test.codes[id] != null;
      const b = linkBtn(String(k + 1) + (answered ? ' ✓' : ''), () => openItem(id), byId.get(id).title);
      b.setAttribute('aria-pressed', String(id === S.prac.id && S.view === 'practice'));
      nums.appendChild(b);
    });
    bar.appendChild(nums);
    const clock = h('span', 'tb-clock'); clock.id = 'tb-clock'; bar.appendChild(clock);
    const acts = h('span', 'tb-acts');
    acts.appendChild(linkBtn(S.test.paused ? 'Resume' : 'Pause', () => S.test.paused ? resumeTest() : pauseTest()));
    if (S.test.opts.limitMs) acts.appendChild(linkBtn('Add 5 minutes', () => { S.test.opts.limitMs += 5 * 60000; if (clockMs() < S.test.opts.limitMs) S.test.timeUpShown = false; saveTest(); renderTestBar(); }));
    acts.appendChild(linkBtn(S.test.hideClock ? 'Show the clock' : 'Hide the clock', () => { S.test.hideClock = !S.test.hideClock; saveTest(); renderTestBar(); }));
    acts.appendChild(linkBtn('Review and end', () => show('tests')));
    bar.appendChild(acts);
    const paused = S.test.paused && S.test.opts.hidePaused;
    m.classList.toggle('test-paused', paused);
    $('#pause-cover').hidden = !paused;
    renderClock();
  }
  function renderClock() {
    const el = $('#tb-clock');
    if (!el || !S.test) return;
    const t = clockMs(), lim = S.test.opts.limitMs;
    el.classList.remove('over');
    if (S.test.hideClock) el.textContent = S.test.paused ? 'Paused' : '';
    else if (!lim) el.textContent = fmtMs(t) + (S.test.paused ? ', paused' : '');
    else if (t <= lim) el.textContent = fmtMs(lim - t) + ' left' + (S.test.paused ? ', paused' : '');
    else { el.textContent = fmtMs(t - lim) + ' over the limit' + (S.test.paused ? ', paused' : ''); el.classList.add('over'); }
    updateStatus();
  }

  async function endTest() {
    if (!S.test) return;
    accrueItem();
    const t = S.test;
    t.elapsed = clockMs(); t.paused = true;
    clearInterval(S.testTick);
    const rows = [];
    for (const id of t.items) {
      const it = byId.get(id);
      const row = { id, title: it.title, type: it.type, ms: t.itemMs[id] || 0, hints: t.hintsUsed[id] || 0 };
      if (it.type === 'trace') {
        const ans = t.answers[id];
        if (!ans || !ans.trim()) row.result = t.skipped[id] ? 'Skipped' : 'Not answered';
        else { const c = traceCheck(it, ans); row.ok = c.ok; row.result = c.ok ? 'Correct' : 'Incorrect'; row.answer = ans; }
      } else {
        const code = t.codes[id];
        if (code == null || code.trim() === it.starter.trim()) row.result = t.skipped[id] ? 'Skipped' : 'Not answered';
        else {
          const out = await runItemTests(it, code);
          row.ok = !out.parseErr && out.passed === out.total;
          row.result = out.parseErr ? 'Syntax error' : row.ok ? 'All ' + out.total + ' tests pass' : out.passed + ' of ' + out.total + ' tests pass';
          row.code = code;
        }
      }
      if (row.ok) { const r = Store.item(id); if (r.status !== 'done') { r.status = 'done'; r.t = Date.now(); } }
      rows.push(row);
    }
    const entry = { at: t.startedAt, name: t.name, rows, ms: t.elapsed, limitMs: t.opts.limitMs, ok: rows.filter(r => r.ok).length, opts: t.opts };
    const slim = Object.assign({}, entry, { rows: entry.rows.map(r => Object.assign({}, r, { code: undefined, answer: undefined })) });
    Store.data.tests = [slim].concat(Store.data.tests || []).slice(0, 40);
    Store.data.activeTest = null;
    S.test = null; S.lastResult = entry;
    Store.save();
    renderTestBar();
    if (S.prac.rendered) renderItem();
    show('tests');
  }
  function discardTest() {
    clearInterval(S.testTick);
    S.test = null; Store.data.activeTest = null; Store.save();
    renderTestBar(); if (S.prac.rendered) renderItem(); renderTests();
  }
  function showTestEnd() { show('tests'); }

  function resultTable(entry) {
    const table = h('table', 'grid-table');
    const head = h('tr'); ['', 'Item', 'Result', 'Time', 'Hints used'].forEach(x => head.appendChild(h('th', null, x)));
    const th = h('thead'); th.appendChild(head); table.appendChild(th);
    const tb = h('tbody');
    entry.rows.forEach((r, k) => {
      const tr = h('tr');
      tr.appendChild(h('td', 'num', String(k + 1)));
      const td = h('td'); td.appendChild(linkBtn(r.title, () => openItem(r.id))); tr.appendChild(td);
      tr.appendChild(h('td', r.ok ? 'ok' : r.result === 'Skipped' || r.result === 'Not answered' ? 'dim' : 'bad', r.result));
      tr.appendChild(h('td', 'num', fmtMs(r.ms)));
      tr.appendChild(h('td', 'num', String(r.hints)));
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    return table;
  }
  function summarySentence(entry) {
    const n = entry.rows.length;
    let s = 'You got ' + entry.ok + ' of ' + n + ' item' + (n === 1 ? '' : 's') + ' right in ' + fmtMs(entry.ms);
    if (entry.limitMs) s += entry.ms <= entry.limitMs ? ', inside the ' + Math.round(entry.limitMs / 60000) + '-minute limit.' : ', which is ' + fmtMs(entry.ms - entry.limitMs) + ' over the ' + Math.round(entry.limitMs / 60000) + '-minute limit.';
    else s += '.';
    return s;
  }

  function renderTests() {
    const v = $('#view-tests');
    v.innerHTML = '';
    const pin = h('div', 'page testpage'); v.appendChild(pin);
    if (S.test) {
      pin.appendChild(h('h1', null, S.test.name));
      const p = h('p'); p.textContent = 'The test is ' + (S.test.paused ? 'paused' : 'running') + ', and ' + fmtMs(clockMs()) + ' has passed' + (S.test.opts.limitMs ? ' of the ' + Math.round(S.test.opts.limitMs / 60000) + ' minutes.' : '.'); pin.appendChild(p);
      const table = h('table', 'grid-table');
      const head = h('tr'); ['', 'Item', 'Status', 'Time so far'].forEach(x => head.appendChild(h('th', null, x)));
      const th = h('thead'); th.appendChild(head); table.appendChild(th);
      const tb = h('tbody');
      accrueItem();
      S.test.items.forEach((id, k) => {
        const tr = h('tr');
        tr.appendChild(h('td', 'num', String(k + 1)));
        const td = h('td'); td.appendChild(linkBtn(byId.get(id).title, () => openItem(id))); tr.appendChild(td);
        const answered = (S.test.answers[id] && S.test.answers[id].trim()) || S.test.codes[id] != null;
        tr.appendChild(h('td', answered ? null : 'dim', S.test.skipped[id] ? 'Skipped' : answered ? 'Answered' : 'Not answered yet'));
        tr.appendChild(h('td', 'num', fmtMs(S.test.itemMs[id] || 0)));
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      pin.appendChild(table);
      const acts = h('div', 'actions');
      acts.appendChild(btn('Return to the test', '', () => { openItem(S.prac.id && S.test.items.includes(S.prac.id) ? S.prac.id : S.test.items[0]); }));
      acts.appendChild(btn('End the test and see results', 'sec', () => endTest()));
      const discard = btn('Discard the test', 'sec', () => { discard.hidden = true; really.hidden = false; });
      const really = btn('Discard it without scoring', 'sec', () => discardTest()); really.hidden = true;
      acts.append(discard, really);
      pin.appendChild(acts);
      return;
    }
    if (S.lastResult) {
      pin.appendChild(h('h1', null, 'Results: ' + S.lastResult.name));
      pin.appendChild(h('p', null, summarySentence(S.lastResult)));
      pin.appendChild(resultTable(S.lastResult));
      pin.appendChild(h('h2', null, 'Start another test'));
    } else pin.appendChild(h('h1', null, 'Practice tests'));

    const st = testSetup();
    const rerender = () => { Store.save(); renderTests(); };
    setRow(pin, 'Items', seg(PRESETS, st.preset, (v2) => { st.preset = v2; if (v2 === 'mock') { st.limit = 45; st.hints = false; st.memory = false; } rerender(); }));
    if (st.preset === 'unit') {
      const sel = h('select', 'plain-select');
      for (const u of COURSE.stages.flatMap(x => x.units)) if (!u.comingSoon) sel.appendChild(new Option('Unit ' + UNIT_NO.get(u) + ': ' + u.title, u.id));
      sel.value = st.unit; sel.addEventListener('change', () => { st.unit = sel.value; rerender(); });
      setRow(pin, 'Unit', sel);
    }
    if (st.preset === 'stage') {
      const sel = h('select', 'plain-select');
      for (const x of COURSE.stages) if (!x.comingSoon) sel.appendChild(new Option(x.title, x.id));
      sel.value = st.stage; sel.addEventListener('change', () => { st.stage = sel.value; rerender(); });
      setRow(pin, 'Stage', sel);
    }
    if (st.preset === 'pick') {
      const box = h('div', 'pick');
      for (const u of COURSE.stages.flatMap(x => x.units).filter(x => !x.comingSoon)) {
        const grp = h('div', 'pick-unit');
        grp.appendChild(h('div', 'pick-title', 'Unit ' + UNIT_NO.get(u) + ': ' + u.title));
        for (const it of practiceItems().filter(i => i.unit === u)) {
          const l = h('label'); const c = h('input'); c.type = 'checkbox'; c.checked = st.picked.includes(it.id);
          c.addEventListener('change', () => { st.picked = c.checked ? st.picked.concat(it.id) : st.picked.filter(x => x !== it.id); Store.save(); updatePreview(); });
          l.append(c, document.createTextNode(' ' + it.title)); grp.appendChild(l);
        }
        box.appendChild(grp);
      }
      pin.appendChild(box);
    }
    if (['unit', 'stage', 'missed'].includes(st.preset)) {
      const kinds = h('div', 'seg');
      [['trace', 'Trace'], ['fill', 'Fill in'], ['write', 'Write']].forEach(([k, label]) => {
        const b = h('button', null, label); b.type = 'button'; b.setAttribute('aria-pressed', String(!!st.kinds[k]));
        b.addEventListener('click', () => { st.kinds[k] = !st.kinds[k]; if (!Object.values(st.kinds).some(Boolean)) st.kinds[k] = true; rerender(); });
        kinds.appendChild(b);
      });
      setRow(pin, 'Kinds of item', kinds);
      setRow(pin, 'How many', seg([[3, '3'], [5, '5'], [8, '8'], [10, '10'], ['all', 'All']], st.count, (v2) => { st.count = v2; rerender(); }));
      setRow(pin, 'Order', seg([['in', 'In course order'], ['shuffle', 'Shuffled']], st.order, (v2) => { st.order = v2; rerender(); }));
    }
    const lim = h('div', 'row');
    lim.appendChild(seg([[0, 'None'], [10, '10'], [20, '20'], [30, '30'], [45, '45'], [60, '60'], [90, '90']], st.limit, (v2) => { st.limit = v2; num.value = v2 || ''; Store.save(); }));
    const num = h('input', 'field'); num.type = 'number'; num.min = '1'; num.style.width = '70px'; num.value = st.limit || ''; num.setAttribute('aria-label', 'Minutes');
    num.addEventListener('change', () => { st.limit = Math.max(0, parseInt(num.value, 10) || 0); rerender(); });
    lim.append(num, document.createTextNode('minutes'));
    setRow(pin, 'Time limit', lim);
    setRow(pin, 'When time runs out', seg([['continue', 'Keep going and count overtime'], ['end', 'End the test']], st.timeUp, (v2) => { st.timeUp = v2; Store.save(); }));
    setRow(pin, 'Hints', seg([[false, 'Off'], [true, 'Allowed']], st.hints, (v2) => { st.hints = v2; Store.save(); }));
    setRow(pin, 'Step-through in Memory', seg([[false, 'Off'], [true, 'Allowed']], st.memory, (v2) => { st.memory = v2; Store.save(); }));
    setRow(pin, 'Test results', seg([['live', 'As you go'], ['end', 'Only at the end']], st.feedback, (v2) => { st.feedback = v2; Store.save(); }));
    setRow(pin, 'While paused', seg([[true, 'Hide the item'], [false, 'Keep it visible']], st.hidePaused, (v2) => { st.hidePaused = v2; Store.save(); }));
    const preview = h('p', 'preview'); pin.appendChild(preview);
    const go = btn('Start the test', '', () => startTest());
    const acts = h('div', 'actions'); acts.appendChild(go); pin.appendChild(acts);
    function updatePreview() {
      const ids = st.preset === 'mock' ? ['mock'] : testPool(Object.assign({}, st, { order: 'in' }));
      go.disabled = !ids.length;
      preview.textContent = !ids.length ? (st.preset === 'missed' ? 'You haven\'t missed or skipped any items yet, so this test would be empty.' : 'Choose at least one item to start a test.')
        : st.preset === 'mock' ? 'The test is one of the three apps in Unit 21, picked at random when it starts, so you won\'t know which until then.'
        : 'The test has ' + ids.length + ' item' + (ids.length === 1 ? '' : 's') + (st.order === 'shuffle' && st.preset !== 'grid4' && st.preset !== 'pick' ? ', drawn in a shuffled order from: ' : ': ') + ids.map(id => byId.get(id).title).join(', ') + '.';
    }
    updatePreview();

    const past = Store.data.tests || [];
    if (past.length) {
      pin.appendChild(h('h2', null, 'Past tests'));
      const table = h('table', 'grid-table');
      const head = h('tr'); ['Date', 'Test', 'Right', 'Time'].forEach(x => head.appendChild(h('th', null, x)));
      const th = h('thead'); th.appendChild(head); table.appendChild(th);
      const tb = h('tbody');
      for (const e of past) {
        const tr = h('tr');
        tr.appendChild(h('td', null, new Date(e.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })));
        const td = h('td'); td.appendChild(linkBtn(e.name, () => { S.lastResult = e; renderTests(); $('main').scrollTop = 0; })); tr.appendChild(td);
        tr.appendChild(h('td', 'num', e.ok + ' of ' + e.rows.length));
        tr.appendChild(h('td', 'num', fmtMs(e.ms) + (e.limitMs && e.ms > e.limitMs ? ' (over)' : '')));
        tb.appendChild(tr);
      }
      table.appendChild(tb);
      pin.appendChild(table);
    }
  }

  // ---------- Map ----------
  function renderMap() {
    const v = $('#view-map');
    v.innerHTML = '';
    const col = h('div', 'page contents');
    v.appendChild(col);
    col.appendChild(h('h1', null, COURSE.title));
    const cont = ITEMS.find(i => itemStatus(i.id) === 'new');
    if (cont) { const p = h('p'); p.appendChild(linkBtn('Continue with ' + cont.unit.title + ': ' + cont.title.replace(/^Read: .*/, 'Read') + ' →', () => openItem(cont.id))); col.appendChild(p); }
    const sug = settings().suggestions ? suggestions() : [];
    if (sug.length) {
      col.appendChild(h('h2', null, 'Worth another look'));
      const grid = h('div', 'sug');
      for (const x of sug) { const it = byId.get(x.id); grid.appendChild(h('span')).appendChild(linkBtn(it.title, () => openItem(x.id))); grid.appendChild(h('span', 'sug-why', (it.unit.synthetic ? 'From Claude. ' : 'Unit ' + UNIT_NO.get(it.unit) + '. ') + x.reason)); }
      col.appendChild(grid);
      if (settings().aiPractice !== 'off') {
        const row = h('div', 'actions');
        const note = h('span');
        const b = btn('Write new practice on these with Claude', 'sec', async () => {
          b.disabled = true; note.textContent = 'Claude is writing three traces, and each is checked against Chrome before it is kept.';
          try {
            const made = await generateTraces(sug.slice(0, 4).map(x => byId.get(x.id)), 3, 'The learner missed, skipped or needed hints on these items.');
            note.textContent = made.length ? made.length + ' new item' + (made.length === 1 ? '' : 's') + ' added under Practice written by Claude, at the end of Contents.' : 'None of Claude\'s programs passed the checks, so try again.';
            if (made.length) renderMap();
          } catch (e) { note.textContent = AI.errorText(e); }
          b.disabled = false;
        });
        row.append(b, note); col.appendChild(row);
      }
    }
    let n = 0;
    for (const st of COURSE.stages) {
      col.appendChild(h('h2', null, st.title));
      const grid = h('div', 'toc');
      for (const u of st.units) {
        n++;
        grid.appendChild(h('span', 'toc-n', n + '.'));
        const items = ITEMS.filter(i => i.unit === u);
        if (u.comingSoon) { grid.appendChild(h('span', 'soon', u.title)); grid.appendChild(h('span')); grid.appendChild(h('span')); continue; }
        const done = items.filter(i => itemStatus(i.id) === 'done').length;
        grid.appendChild(h('span')).appendChild(linkBtn(u.title, () => openItem(items[0].id)));
        grid.appendChild(h('span', 'toc-count', done + ' of ' + items.length));
        const sub = h('span', 'toc-items');
        for (const it of items) {
          const st2 = itemStatus(it.id);
          const b = linkBtn((st2 === 'done' ? '✓ ' : st2 === 'skipped' ? '– ' : '') + (it.type === 'read' ? 'Read' : it.title), () => openItem(it.id));
          b.classList.add('toc-item', st2);
          sub.appendChild(b);
        }
        grid.appendChild(sub);
      }
      col.appendChild(grid);
    }
    if (GEN_UNIT.items.length) {
      col.appendChild(h('h2', null, GEN_STAGE.title));
      const grid = h('div', 'sug');
      for (const it of GEN_UNIT.items) {
        const st2 = itemStatus(it.id);
        grid.appendChild(h('span')).appendChild(linkBtn((st2 === 'done' ? '✓ ' : st2 === 'skipped' ? '– ' : '') + it.title, () => openItem(it.id)));
        grid.appendChild(h('span', 'sug-why', (it.type === 'trace' ? 'Trace' : 'Write') + ', from ' + (it.from || []).map(id => byId.get(id) ? byId.get(id).title : 'an earlier item').join(', ') + '.'));
      }
      col.appendChild(grid);
    }
  }

  // ---------- Settings ----------
  function seg(options, value, onPick) {
    const s = h('div', 'seg'); s.setAttribute('role', 'group');
    options.forEach(([val, label]) => { const b = h('button', null, label); b.type = 'button'; b.setAttribute('aria-pressed', String(val === value)); b.addEventListener('click', () => { onPick(val); s.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }); s.appendChild(b); });
    return s;
  }
  function setRow(parent, label, control) {
    const r = h('div', 'set');
    r.appendChild(h('span', 'lbl', label));
    r.appendChild(control); parent.appendChild(r);
    return r;
  }
  function changed(rerender) { Store.save(); if (rerender === 'mem') { renderStep(); } if (rerender === 'theme') applyTheme(); if (rerender === 'prac' && S.prac.rendered) renderItem(); updateStatus(); }

  function renderSettings() {
    const v = $('#view-settings');
    v.innerHTML = '';
    const pin = h('div', 'page settings'); v.appendChild(pin);
    const s = settings();
    pin.appendChild(h('h2', 'set-h', 'Layout'));
    setRow(pin, 'Memory and Practice', seg([['side', 'Side by side'], ['column', 'One column']], s.layout, (v2) => { s.layout = v2; changed('theme'); if (S.prac.rendered) renderItem(); }));

    pin.appendChild(h('h2', 'set-h', 'Theme'));
    const sw = h('div', 'swatches');
    const customBox = h('div', 'custom');
    const addSwatch = (id, name, t) => {
      const b = h('button', 'swatch'); b.type = 'button'; b.setAttribute('aria-pressed', String(s.theme === id));
      const top = h('div', 'sw-top'); top.style.background = t.bg; top.style.color = t.fg;
      top.innerHTML = '<span style="color:' + t.kw + '">const</span> a = [<span style="color:' + t.num + '">1</span>, <span style="color:' + t.str + '">"x"</span>];';
      if (t.codeFont) top.style.fontFamily = t.codeFont;
      b.appendChild(top);
      b.appendChild(h('div', 'sw-name', name));
      b.title = t.author || '';
      b.addEventListener('click', () => { s.theme = id; changed('theme'); sw.querySelectorAll('.swatch').forEach(x => x.setAttribute('aria-pressed', String(x === b))); customBox.hidden = id !== 'custom'; });
      sw.appendChild(b);
    };
    addSwatch('solarized-auto', 'Solarized, follows your Mac', Themes.T[darkQuery.matches ? 'solarized-dark' : 'solarized-light']);
    for (const id of Themes.ORDER) addSwatch(id, Themes.T[id].name, Themes.T[id]);
    addSwatch('custom', 'Custom', Themes.resolve(Object.assign({}, s, { theme: 'custom' }), false));
    pin.appendChild(sw);
    customBox.hidden = s.theme !== 'custom';
    const baseSel = h('select', 'plain-select'); Themes.ORDER.forEach(id => baseSel.appendChild(new Option(Themes.T[id].name, id))); baseSel.value = s.customBase || 'solarized-light';
    baseSel.addEventListener('change', () => { s.customBase = baseSel.value; s.customColors = {}; changed('theme'); renderSettings(); });
    setRow(customBox, 'Based on', baseSel);
    const cg = h('div', 'colors');
    const base = Themes.resolve(Object.assign({}, s, { theme: 'custom' }), false);
    for (const [k, label] of Themes.EDITABLE) {
      const l = h('label'); const inp = h('input'); inp.type = 'color'; inp.value = (base[k] || '#000000').slice(0, 7);
      inp.addEventListener('input', () => { s.customColors = Object.assign({}, s.customColors, { [k]: inp.value }); changed('theme'); });
      l.appendChild(inp); l.appendChild(document.createTextNode(label)); cg.appendChild(l);
    }
    customBox.appendChild(cg);
    // A theme code is the custom theme as text, so it can be copied to another browser or shared.
    const codeRow = h('div', 'row'); codeRow.style.marginTop = '8px';
    const codeField = h('input', 'field'); codeField.style.width = '360px'; codeField.setAttribute('aria-label', 'Theme code');
    codeField.value = JSON.stringify({ base: s.customBase, colors: s.customColors || {} });
    const copy = btn('Copy theme code', 'sec small', () => { codeField.select(); try { navigator.clipboard.writeText(codeField.value); copyNote.textContent = 'Copied.'; } catch (e) { copyNote.textContent = 'Select the code and copy it.'; } });
    const load = btn('Use pasted code', 'sec small', () => {
      try { const t = JSON.parse(codeField.value); if (!Themes.T[t.base]) throw new Error(); s.customBase = t.base; s.customColors = Object.fromEntries(Object.entries(t.colors || {}).filter(([k, v]) => /^#[0-9a-fA-F]{3,8}$/.test(v))); s.theme = 'custom'; changed('theme'); renderSettings(); }
      catch (e) { copyNote.textContent = 'That isn\'t a theme code from this site.'; }
    });
    const copyNote = h('span');
    codeRow.append(codeField, copy, load, copyNote);
    setRow(customBox, 'Theme code', codeRow);
    pin.appendChild(customBox);
    setRow(pin, 'Random theme on each visit', seg([['off', 'Off'], ['light', 'Light themes'], ['dark', 'Dark themes'], ['all', 'All themes']], s.randomTheme || 'off', (v2) => { s.randomTheme = v2; changed(); }));

    pin.appendChild(h('h2', 'set-h', 'Text'));
    setRow(pin, 'Reading text size', seg([[15, '15'], [16, '16'], [17, '17'], [18, '18'], [20, '20']], s.fontSize, (v2) => { s.fontSize = v2; changed('theme'); }));
    const bf = h('select', 'plain-select'); [['theme', 'Theme default'], ['System', 'System sans-serif'], ['Georgia', 'Georgia'], ['Charter', 'Charter'], ['Iowan Old Style', 'Iowan Old Style']].forEach(([v2, l]) => bf.appendChild(new Option(l, v2)));
    bf.value = s.bodyFont || 'theme'; bf.addEventListener('change', () => { s.bodyFont = bf.value; changed('theme'); });
    setRow(pin, 'Text font', bf);
    const cf = h('select', 'plain-select'); [['theme', 'Theme default'], ['JetBrains Mono', 'JetBrains Mono'], ['Menlo', 'Menlo'], ['PT Mono', 'PT Mono'], ['SF Mono', 'SF Mono'], ['JetBrains Mono', 'JetBrains Mono'], ['Fira Code', 'Fira Code'], ['IBM Plex Mono', 'IBM Plex Mono'], ['Source Code Pro', 'Source Code Pro']].forEach(([v2, l]) => cf.appendChild(new Option(l, v2)));
    cf.value = s.codeFont || 'theme'; cf.addEventListener('change', () => { s.codeFont = cf.value; changed('theme'); });
    setRow(pin, 'Code font', cf);

    pin.appendChild(h('h2', 'set-h', 'Memory'));
    setRow(pin, 'Rule sentences', seg([['off', 'Off'], ['main', 'Main'], ['all', 'All']], s.rules, (v2) => { s.rules = v2; changed('mem'); }));
    setRow(pin, 'Addresses', seg([[true, 'On'], [false, 'Off']], s.addresses, (v2) => { s.addresses = v2; changed('mem'); }));
    setRow(pin, 'Predict', seg([[false, 'Off'], [true, 'On']], s.predict, (v2) => { s.predict = v2; S.mem.q = null; changed('mem'); }));
    setRow(pin, 'Check with Chrome', seg([[true, 'On'], [false, 'Off']], s.realCheck, (v2) => { s.realCheck = v2; changed(); }));
    const seed = h('input', 'field'); seed.type = 'number'; seed.value = s.seed; seed.style.width = '80px'; seed.addEventListener('change', () => { s.seed = (+seed.value) | 0; changed(); retrace(false); });
    setRow(pin, 'Random seed', seed);

    pin.appendChild(h('h2', 'set-h', 'Practice'));
    setRow(pin, 'Hints', seg([['auto', 'After a miss'], ['click', 'On click'], ['off', 'Off']], s.hints, (v2) => { s.hints = v2; changed('prac'); }));
    setRow(pin, 'Step-through buttons', seg([[true, 'On'], [false, 'Off']], s.memoryLinks, (v2) => { s.memoryLinks = v2; changed('prac'); }));
    setRow(pin, 'Strictness', seg([['standard', 'Standard'], ['expert', 'Strict']], s.level, (v2) => { s.level = v2; changed('prac'); }));
    setRow(pin, 'Suggestions in Contents', seg([[true, 'On'], [false, 'Off']], s.suggestions, (v2) => { s.suggestions = v2; changed(); }));
    setRow(pin, 'Docs on hover', seg([[true, 'On'], [false, 'Off']], s.docsHover, (v2) => { s.docsHover = v2; changed(); }));
    setRow(pin, 'Replay and autoplay speed', seg([['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], s.playSpeed, (v2) => { s.playSpeed = v2; changed(); }));

    pin.appendChild(h('h2', 'set-h', 'Claude'));
    setRow(pin, 'Model', seg([['opus-high', 'Opus 5.5, high effort'], ['opus-medium', 'Opus 5.5, medium effort'], ['sonnet', 'Sonnet 5.5']], s.aiModel, (v2) => { s.aiModel = v2; changed(); }));
    setRow(pin, 'Code review', seg([['off', 'Off'], ['ask', 'When I ask'], ['auto', 'Automatically when the tests pass']], s.aiReview, (v2) => { s.aiReview = v2; changed('prac'); }));
    setRow(pin, 'Hints from Claude', seg([['off', 'Off'], ['ask', 'When I ask']], s.aiHints, (v2) => { s.aiHints = v2; changed('prac'); }));
    setRow(pin, 'Explanation check', seg([['off', 'Off'], ['ask', 'When I ask']], s.aiExplain, (v2) => { s.aiExplain = v2; changed('prac'); }));
    setRow(pin, 'Harder versions', seg([['off', 'Off'], ['ask', 'When I ask']], s.aiExpert, (v2) => { s.aiExpert = v2; changed('prac'); }));
    setRow(pin, 'Practice aimed at misses', seg([['off', 'Off'], ['ask', 'When I ask']], s.aiPractice, (v2) => { s.aiPractice = v2; changed(); }));

    pin.appendChild(h('h2', 'set-h', 'Progress'));
    const resetWrap = h('div', 'row');
    const reset = btn('Reset', 'sec small', () => { reset.hidden = true; confirmB.hidden = false; cancel.hidden = false; });
    const confirmB = btn('Erase progress', 'small', () => { Store.data.items = {}; Store.data.codes = {}; Store.save(); S.prac.rendered = false; renderSettings(); updateStatus(); }); confirmB.hidden = true;
    const cancel = btn('Cancel', 'sec small', () => { reset.hidden = false; confirmB.hidden = true; cancel.hidden = true; }); cancel.hidden = true;
    resetWrap.append(reset, confirmB, cancel);
    setRow(pin, 'Item status and saved code', resetWrap);
  }

  // ---------- Guide ----------
  const GUIDE = [
    ['Memory', [
      ['Type or paste JavaScript', 'The diagram redraws as you type.'],
      ['← and →', 'Step backward and forward through the program.'],
      ['Home and End', 'Jump to the first or the last step.'],
      ['play', 'Steps through the program automatically, at the speed set in Settings.'],
      ['predict', 'Asks you a question about each step before showing it.'],
      ['Arrows', 'Each arrow is an address, and a1, a2 and so on name the objects they point to.'],
      ['Thick outline', 'Marks an object created in this step. A shaded row marks a name or entry that changed in this step.'],
      ['Dashed box', 'A frame that a closure keeps alive after its call has ended.'],
      ['Red note', 'Chrome\'s own engine printed something different from the trace.'],
      ['The line between the two sides', 'Drag it to resize the sides, and double-click it to reset them.'],
    ]],
    ['Practice', [
      ['Trace', 'Type what the program prints, one line for each printed line, and press ⌘ Enter to check.'],
      ['Fill in and Write', 'The tests run again each time you stop typing.'],
      ['Hint', 'Shows the next hint. Each item has three, and each is more specific than the one before.'],
      ['Skip', 'Marks the item skipped and moves on. Any item can be opened at any time from Contents.'],
      ['Ask Claude for a hint', 'Appears after a miss. Claude reads your code or answer and gives the smallest hint that would unblock you, without code.'],
      ['Review my code with Claude', 'Appears once the tests pass. Claude suggests up to four edits a senior engineer would make, each with its reason, and Apply makes that one edit and reruns the tests.'],
      ['Explain it to Claude', 'Appears once an item is done. You explain the solution in your own words, typed or dictated, and Claude says what you got right and what was missing.'],
      ['Replay', 'Plays back the versions of your code saved each time the tests ran, with how many tests passed at each point.'],
      ['Hover over a name', 'Shows a one-sentence description of a method or keyword, with a link to its MDN page.'],
      ['Strict', 'A setting under Practice: fill-in items start from a blank function, hints appear only after a miss, and a trace answer can be shown only after two misses.'],
      ['Harder version from Claude', 'Appears once an item is done or skipped. Claude writes a harder version of it, which is kept only if it passes this site\'s checks, and opens it in the Practice written by Claude unit.'],
      ['Step through in Memory', 'Opens the item, or a failing test, on the Memory tab. Stage 2 items use the page, which the Memory diagram doesn\'t draw, so they show a live preview of the page instead.'],
      
    ]],
    ['Practice tests', [
      ['Items', 'The four grid functions, one unseen app picked at random for a mock live round, one unit, one stage, the items you missed or skipped, or items you pick yourself.'],
      ['Time limit', 'None, a preset number of minutes or your own. When it runs out, the test either keeps going and counts overtime or ends, whichever you chose.'],
      ['During the test', 'Pause and resume, add five minutes, hide the clock, and jump between items with the numbers in the bar under the tabs.'],
      ['Results', 'Each item\'s result, time and hints used, with every past test listed below the setup.'],
    ]],
    ['Contents', [['Continue', 'Opens the first item you haven\'t finished or skipped.'], ['Worth another look', 'Items you skipped, missed or needed several hints on, and untouched items that practice the same idea.']]],
    ['Settings', [['Every setting', 'Takes effect as soon as you change it.'], ['Custom theme', 'Starts from any theme and changes its colors one by one. Its theme code copies the whole theme as text, to paste into another browser.'], ['Random theme', 'Picks a light, dark or any theme each time the page opens.']]],
    ['Saving', [['Progress and code', 'Saved automatically, to your claude.ai account when the site runs as a claude.ai artifact and to this browser otherwise.']]],
  ];
  function renderGuide() {
    const v = $('#view-guide');
    v.innerHTML = '';
    const pin = h('div', 'page guide'); v.appendChild(pin);
    // One table for every section, so the two columns line up all the way down.
    const table = h('table', 'keys');
    for (const [title, rows] of GUIDE) {
      const tb = h('tbody');
      const hr = h('tr', 'sec'); const th = h('th', null, title); th.colSpan = 2; hr.appendChild(th); tb.appendChild(hr);
      for (const [k, d] of rows) { const tr = h('tr'); tr.append(h('td', 'k', k), h('td', 'd', d)); tb.appendChild(tr); }
      table.appendChild(tb);
    }
    pin.appendChild(table);
  }

  // ---------- keyboard ----------
  document.addEventListener('keydown', (e) => {
    if (S.view !== 'memory') return;
    const t = e.target;
    if (t && (t.closest('.CodeMirror') || t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); stepForward(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(S.mem.idx - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(Infinity); }
  });
  window.addEventListener('resize', debounce(redrawArrows, 80));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  // ---------- boot ----------
  function migrate() {
    const st = Store.data.settings;
    // v3: back to the full-width editor layout with Solarized and the system font, keeping any theme picked by hand.
    if (!st.v || st.v < 3) {
      if (!st.theme || st.theme === 'book') st.theme = 'solarized-auto';
      st.bodyFont = 'theme'; st.codeFont = 'theme'; st.layout = 'side';
    }
    // v5: reading text at 16px, the size MDN, javascript.info, Are.na and Monkeytype use for most of their text.
    if (!st.v || st.v < 5) { st.fontSize = 16; st.v = 5; Store.save(); }
  }
  async function boot() {
    loadGenerated();
    for (const v of VIEWS) $('#tab-' + v).addEventListener('click', () => show(v));
    $('#resume-btn').addEventListener('click', () => resumeTest());
    Store.data.settings = Object.assign({}, DEFAULTS, Store.data.settings || {});
    migrate();
    applyTheme();
    buildMemory();
    retrace(true);
    show(location.hash.slice(1) || 'memory');
    Store.onStatus(updateStatus);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawArrows);
    // sync with the page's database when it becomes available
    await Store.init();
    Store.data.settings = Object.assign({}, DEFAULTS, Store.data.settings || {});
    migrate();
    applyTheme();
    if (Store.data.memoryCode && Store.data.memoryCode !== S.mem.editor.getValue() && !S.mem.returnTo) { S.mem.editor.setValue(Store.data.memoryCode); retrace(false); }
    loadGenerated();
    // A test that was running when the page closed comes back paused, with the time it had when last saved.
    const at = Store.data.activeTest;
    if (at && at.items && at.items.length && !S.test) {
      S.test = at; S.test.paused = true; S.test.elapsed = at.savedElapsed != null ? at.savedElapsed : at.elapsed || 0;
      startTicker();
    }
    if (S.prac.rendered) { S.prac.rendered = false; if (S.view === 'practice') renderPractice(); }
    if (S.view === 'tests') renderTests();
    // Views drawn before the saved data arrived hold the old settings object, so draw them again.
    if (S.view === 'settings') renderSettings();
    if (S.view === 'map') renderMap();
    if (S.view === 'guide') renderGuide();
    renderTestBar();
    updateStatus();
  }
  // Load whatever was saved locally first so the page opens in your state, then sync.
  try { const s = localStorage.getItem('js-memory-practice-v1'); if (s) Object.assign(Store.data, JSON.parse(s)); } catch (e) {}
  if (!window.acorn) {
    document.getElementById('app').innerHTML = '<div style="padding:24px">The JavaScript parser didn\'t load. Check your internet connection and reload the page.</div>';
    return;
  }
  boot();
})();
