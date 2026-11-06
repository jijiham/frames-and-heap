/* Draws one tracer snapshot as frames and objects with arrows, following Python Tutor's layout:
   frames on the left, objects on the right, arrays as rows of numbered cells, arrows for addresses. */
(function (root) {
  'use strict';

  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  function valueKey(v) { return v ? JSON.stringify(v) : ''; }

  function prevMaps(prev) {
    const bind = new Map(), slot = new Map(), objs = new Set(), envs = new Set();
    if (!prev) return null;
    const s = prev.snap;
    for (const fr of s.frames) for (const e of fr.envs) { envs.add(e.id); for (const b of e.bindings) bind.set(e.id + '.' + b.name, valueKey(b.v)); }
    for (const e of s.captured) { envs.add(e.id); for (const b of e.bindings) bind.set(e.id + '.' + b.name, valueKey(b.v)); }
    for (const o of s.heap) {
      objs.add(o.id);
      if (o.items) o.items.forEach((x, i) => slot.set(o.id + '[' + i, valueKey(x)));
      if (o.props) o.props.forEach(p => slot.set(o.id + '.' + p.key, valueKey(p.v)));
    }
    return { bind, slot, objs, envs };
  }

  function valueCell(v, opts) {
    const span = h('span', 'val');
    switch (v.k) {
      case 'p': span.classList.add('v-' + v.t); span.textContent = v.s; break;
      case 'r': {
        span.classList.add('ref');
        span.dataset.ref = String(v.id);
        const dot = h('span', 'dot');
        span.appendChild(dot);
        if (opts.showAddresses) span.appendChild(h('span', 'addr', 'a' + v.id));
        break;
      }
      case 'u': span.classList.add('v-tdz'); span.textContent = 'uninitialized'; break;
      case 'hole': span.classList.add('v-hole'); span.textContent = 'empty'; break;
      case 'bi': span.classList.add('v-bi'); span.textContent = v.s; break;
    }
    return span;
  }

  function bindingRow(env, b, pm, opts) {
    const row = h('div', 'brow');
    row.appendChild(h('span', 'bname', b.name));
    const cell = h('span', 'bval');
    cell.appendChild(valueCell(b.v, opts));
    row.appendChild(cell);
    if (pm) {
      const k = env.id + '.' + b.name;
      if (!pm.bind.has(k) || pm.bind.get(k) !== valueKey(b.v)) row.classList.add('changed');
    }
    return row;
  }

  function envBody(env, pm, opts, isBase) {
    const box = h('div', isBase ? 'env base' : 'env nested');
    if (!isBase) box.appendChild(h('div', 'env-label', env.label));
    for (const b of env.bindings) box.appendChild(bindingRow(env, b, pm, opts));
    return box;
  }

  function renderFrames(snap, step, pm, opts) {
    const col = h('div', 'dg-frames');
    for (const fr of snap.frames) {
      if (fr.builtin) { col.appendChild(h('div', 'frame builtin', fr.name)); continue; }
      const box = h('div', 'frame');
      if (fr.id === step.frameId) box.classList.add('current');
      if (pm && fr.envs.length && !pm.envs.has(fr.envs[0].id)) box.classList.add('new');
      box.appendChild(h('div', 'frame-title', fr.name));
      fr.envs.forEach((e, i) => {
        if (i === 0 || e.bindings.length) box.appendChild(envBody(e, pm, opts, i === 0));
      });
      if (fr.thisVal) {
        const row = h('div', 'brow special');
        row.appendChild(h('span', 'bname', 'this'));
        const c = h('span', 'bval'); c.appendChild(valueCell(fr.thisVal, opts)); row.appendChild(c);
        box.appendChild(row);
      }
      if (fr.ret) {
        const row = h('div', 'brow special changed');
        row.appendChild(h('span', 'bname', 'Return value'));
        const c = h('span', 'bval'); c.appendChild(valueCell(fr.ret, opts)); row.appendChild(c);
        box.appendChild(row);
      }
      col.appendChild(box);
    }
    return col;
  }

  function objBox(o, pm, opts) {
    const box = h('div', 'obj k-' + o.kind);
    box.dataset.obj = String(o.id);
    const isNew = pm && !pm.objs.has(o.id);
    if (isNew) box.classList.add('new');
    if (o.kind === 'array' || o.kind === 'set') {
      if (!o.items.length) { box.appendChild(h('div', 'obj-empty', o.kind === 'set' ? 'empty Set' : 'empty array')); }
      else {
        const t = h('div', 'cells');
        o.items.forEach((x, i) => {
          const c = h('div', 'cell');
          if (o.kind === 'array') c.appendChild(h('div', 'idx', String(i)));
          const v = h('div', 'cv'); v.appendChild(valueCell(x, opts)); c.appendChild(v);
          if (pm && !isNew && (!pm.slot.has(o.id + '[' + i) || pm.slot.get(o.id + '[' + i) !== valueKey(x))) c.classList.add('changed');
          t.appendChild(c);
        });
        box.appendChild(t);
      }
    }
    if (o.kind === 'function') {
      const sig = h('div', 'fn-sig');
      sig.textContent = (o.arrow ? '' : 'function ') + (o.name || '') + '(' + (o.params || '') + ')' + (o.arrow ? ' =>' : '');
      box.appendChild(sig);
      const row = h('div', 'brow scope');
      row.appendChild(h('span', 'bname', 'made in'));
      const c = h('span', 'bval');
      if (o.scopeEnv != null) {
        const ref = h('span', 'val ref scope-ref');
        ref.dataset.ref = 'env' + o.scopeEnv;
        ref.appendChild(h('span', 'dot'));
        ref.appendChild(h('span', 'scope-name', o.scopeLabel));
        c.appendChild(ref);
      } else c.appendChild(h('span', 'scope-name', o.scopeLabel || 'Global frame'));
      row.appendChild(c);
      box.appendChild(row);
    }
    if ((o.kind === 'object' || o.kind === 'function') && o.props && o.props.length) {
      const t = h('div', 'props');
      for (const p of o.props) {
        const row = h('div', 'brow');
        row.appendChild(h('span', 'bname', p.key));
        const c = h('span', 'bval'); c.appendChild(valueCell(p.v, opts)); row.appendChild(c);
        if (pm && !isNew && (!pm.slot.has(o.id + '.' + p.key) || pm.slot.get(o.id + '.' + p.key) !== valueKey(p.v))) row.classList.add('changed');
        t.appendChild(row);
      }
      box.appendChild(t);
    } else if (o.kind === 'object') {
      box.appendChild(h('div', 'obj-empty', 'no keys'));
    }
    // As in Python Tutor, the label sits above the object.
    const phrase = o.isError ? 'Error object' : o.kind === 'array' ? 'array, length ' + o.items.length : o.kind === 'set' ? 'Set' : o.kind === 'function' ? 'function' : 'object';
    const wrapper = h('div', 'objwrap');
    wrapper.appendChild(h('div', 'caption', (opts.showAddresses ? 'a' + o.id + ' ' : '') + phrase + (isNew ? ', new' : '')));
    wrapper.appendChild(box);
    return wrapper;
  }

  function capturedBox(e, pm, opts) {
    const box = h('div', 'obj captured');
    box.dataset.obj = 'env' + e.id;
    for (const b of e.bindings) box.appendChild(bindingRow(e, b, pm, opts));
    if (e.parentId != null) {
      const row = h('div', 'brow scope');
      row.appendChild(h('span', 'bname', 'outer'));
      const c = h('span', 'bval');
      const ref = h('span', 'val ref scope-ref'); ref.dataset.ref = 'env' + e.parentId; ref.appendChild(h('span', 'dot'));
      c.appendChild(ref); row.appendChild(c); box.appendChild(row);
    }
    const wrapper = h('div', 'objwrap');
    wrapper.appendChild(h('div', 'caption', 'the frame of ' + e.label + ', kept alive by a closure'));
    wrapper.appendChild(box);
    return wrapper;
  }

  function layoutHeap(snap) {
    // assign columns by distance from the frames
    const nodes = new Map();
    for (const o of snap.heap) nodes.set(String(o.id), { kind: 'obj', o, out: [] });
    for (const e of snap.captured) nodes.set('env' + e.id, { kind: 'env', e, out: [] });
    const refOf = (v) => v && v.k === 'r' ? String(v.id) : null;
    for (const [, n] of nodes) {
      if (n.kind === 'obj') {
        const o = n.o;
        (o.items || []).forEach(x => { const r = refOf(x); if (r) n.out.push(r); });
        (o.props || []).forEach(p => { const r = refOf(p.v); if (r) n.out.push(r); });
        if (o.kind === 'function' && o.scopeEnv != null && nodes.has('env' + o.scopeEnv)) n.out.push('env' + o.scopeEnv);
      } else {
        n.e.bindings.forEach(b => { const r = refOf(b.v); if (r) n.out.push(r); });
        if (n.e.parentId != null) n.out.push('env' + n.e.parentId);
      }
    }
    const depth = new Map();
    const order = new Map();
    const queue = [];
    const seen = (r) => { if (!order.has(r)) order.set(r, order.size); };
    for (const fr of snap.frames) {
      for (const e of fr.envs) for (const b of e.bindings) { const r = refOf(b.v); if (r && nodes.has(r) && !depth.has(r)) { depth.set(r, 0); seen(r); queue.push(r); } }
      [fr.ret, fr.thisVal].forEach(v => { const r = refOf(v); if (r && nodes.has(r) && !depth.has(r)) { depth.set(r, 0); seen(r); queue.push(r); } });
    }
    while (queue.length) {
      const id = queue.shift();
      for (const t of nodes.get(id).out) if (nodes.has(t) && !depth.has(t)) { depth.set(t, depth.get(id) + 1); seen(t); queue.push(t); }
    }
    for (const [id] of nodes) seen(id);
    const cols = [];
    for (const [id, n] of nodes) {
      const d = depth.has(id) ? depth.get(id) : (cols.length ? cols.length - 1 : 0);
      (cols[d] = cols[d] || []).push({ id, n });
    }
    // within a column, objects appear in the order the frames reach them (Python Tutor's rule), which keeps arrows from crossing
    return cols.filter(Boolean).map(c => c.sort((a, b) => order.get(a.id) - order.get(b.id)));
  }

  function render(container, step, prev, opts) {
    opts = opts || {};
    container.innerHTML = '';
    const wrap = h('div', 'dg');
    const svgNS = 'http://www.w3.org/2000/svg';
    const pm = prevMaps(prev);
    const snap = step.snap;
    const cols = h('div', 'dg-cols');
    cols.appendChild(renderFrames(snap, step, pm, opts));
    const heapCol = h('div', 'dg-heap');
    const layers = h('div', 'dg-layers');
    const layout = layoutHeap(snap);
    for (const col of layout) {
      const c = h('div', 'dg-layer');
      for (const { n } of col) c.appendChild(n.kind === 'obj' ? objBox(n.o, pm, opts) : capturedBox(n.e, pm, opts));
      layers.appendChild(c);
    }
    heapCol.appendChild(layers);
    cols.appendChild(heapCol);
    wrap.appendChild(cols);
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'dg-arrows');
    svg.setAttribute('aria-hidden', 'true');
    wrap.appendChild(svg);
    container.appendChild(wrap);
    drawArrows(wrap);
    return wrap;
  }

  function drawArrows(wrap) {
    const svg = wrap.querySelector('svg.dg-arrows');
    if (!svg) return;
    const svgNS = 'http://www.w3.org/2000/svg';
    const base = wrap.getBoundingClientRect();
    svg.setAttribute('width', wrap.scrollWidth);
    svg.setAttribute('height', wrap.scrollHeight);
    svg.innerHTML = '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ah"/></marker><marker id="ahc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ahc"/></marker></defs>';
    wrap.querySelectorAll('.ref[data-ref]').forEach(src => {
      const target = wrap.querySelector('[data-obj="' + src.dataset.ref + '"]');
      if (!target) return;
      // start just right of the reference (dot plus its address label) so the line never crosses the label
      const a = src.getBoundingClientRect(), b = target.getBoundingClientRect();
      const x1 = a.right - base.left + 3, y1 = a.top + a.height / 2 - base.top;
      let x2 = b.left - base.left - 1, y2 = b.top - base.top + 14;
      let dir = 1;
      if (x2 < x1) { x2 = b.right - base.left + 1; dir = -1; }
      const dx = Math.max(28, Math.abs(x2 - x1) / 2);
      const p = document.createElementNS(svgNS, 'path');
      p.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + (x1 + dx) + ',' + y1 + ' ' + (x2 - dir * dx) + ',' + y2 + ' ' + x2 + ',' + y2);
      const changed = src.closest('.changed') || src.classList.contains('scope-ref') && false;
      p.setAttribute('class', 'arrow' + (changed ? ' hot' : '') + (src.classList.contains('scope-ref') ? ' scope' : ''));
      p.setAttribute('marker-end', changed ? 'url(#ahc)' : 'url(#ah)');
      svg.appendChild(p);
    });
  }

  root.Diagram = { render, drawArrows };
})(typeof globalThis !== 'undefined' ? globalThis : this);
