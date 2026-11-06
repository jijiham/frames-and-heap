/* Tracer interpreter: runs a subset of JavaScript one statement at a time and records
   a snapshot of every frame and heap object after each step. Uses Acorn (global `acorn`). */
(function (root) {
  'use strict';
  const acornLib = root.acorn || (typeof require === 'function' ? require('acorn') : null);

  const MAX_STEPS = 2500;
  const MAX_DEPTH = 160;
  const HOLE = { hole: true };

  // ---------- seeded random (mulberry32), shared with the real-engine runner ----------
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

  // ---------- errors ----------
  class Thrown { constructor(value) { this.value = value; } }          // a JS value thrown by the program
  class Unsupported extends Error { constructor(msg, node) { super(msg); this.node = node; } }
  class StepLimit extends Error {}

  // ---------- heap objects ----------
  class Obj {
    constructor(ctx, kind) {
      // built-in objects are never drawn, so they get their own numbering and user objects start at a1
      this.id = kind === 'builtin' ? -(++ctx.nextBuiltinId) : ++ctx.nextObjId;
      this.kind = kind; // object | array | function | builtin | set
      if (kind === 'array') this.items = [];
      else if (kind === 'set') this.values = [];
      this.props = new Map();
      ctx.allObjs.push(this);
    }
  }

  class Env {
    constructor(ctx, kind, label, parent, callId) {
      this.id = ++ctx.nextEnvId;
      this.kind = kind; // builtin | global | function | block | loop
      this.label = label;
      this.parent = parent;
      this.vars = new Map(); // name -> {value, decl, init}
      this.callId = callId;
    }
  }

  function isObj(v) { return v instanceof Obj; }
  // property order as in real engines: integer-like keys ascending, then other keys in insertion order
  function orderedEntries(map) {
    const ints = [], rest = [];
    for (const e of map) { if (/^(0|[1-9]\d*)$/.test(e[0]) && Number(e[0]) < 4294967295) ints.push(e); else rest.push(e); }
    ints.sort((a, b) => Number(a[0]) - Number(b[0]));
    return ints.concat(rest);
  }

  function typeOf(v) {
    if (v === null) return 'object';
    if (isObj(v)) return (v.kind === 'function' || v.kind === 'builtin') ? 'function' : 'object';
    return typeof v;
  }

  // ---------- formatting (mirrors fmtReal in runner.js) ----------
  function fmtNum(n) { return Object.is(n, -0) ? '-0' : String(n); }
  function fmtInner(v, depth, seen) {
    if (v === HOLE) return 'empty';
    if (typeof v === 'string') return "'" + v + "'";
    if (!isObj(v)) return fmtPrim(v);
    return fmtObj(v, depth, seen);
  }
  function fmtPrim(v) {
    if (typeof v === 'number') return fmtNum(v);
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    return String(v);
  }
  function fmtObj(o, depth, seen) {
    if (o.kind === 'function' || o.kind === 'builtin') return 'ƒ ' + (o.name || 'anonymous') + '()';
    if (seen.has(o)) return '[Circular]';
    if (depth > 4) return o.kind === 'array' ? '[Array]' : '[Object]';
    seen.add(o);
    let s;
    if (o.kind === 'array') s = '[' + o.items.map(x => fmtInner(x, depth + 1, seen)).join(', ') + ']';
    else if (o.kind === 'set') s = 'Set(' + o.values.length + ') {' + o.values.map(x => fmtInner(x, depth + 1, seen)).join(', ') + '}';
    else if (o.isError) s = errName(o) + ': ' + toStr(o.props.get('message'));
    else {
      const parts = [];
      for (const [k, val] of orderedEntries(o.props)) parts.push((/^[A-Za-z_$][\w$]*$/.test(k) ? k : "'" + k + "'") + ': ' + fmtInner(val, depth + 1, seen));
      s = '{' + parts.join(', ') + '}';
    }
    seen.delete(o);
    return s;
  }
  function fmtTop(v) { return typeof v === 'string' ? v : fmtInner(v, 0, new Set()); }
  function errName(o) { const n = o.props.get('name'); return typeof n === 'string' ? n : 'Error'; }

  // ---------- conversions ----------
  function toPrimitive(v, hint) {
    if (!isObj(v)) return v;
    if (v.kind === 'array') return v.items.map(x => (x === HOLE || x == null) ? '' : toStr(x)).join(',');
    if (v.kind === 'function' || v.kind === 'builtin') return 'function ' + (v.name || '') + '() { … }';
    if (v.isError) return errName(v) + ': ' + toStr(v.props.get('message'));
    if (v.kind === 'set') return '[object Set]';
    return '[object Object]';
  }
  function toStr(v) { const p = toPrimitive(v, 'string'); return typeof p === 'symbol' ? p.toString() : String(p); }
  function toNum(v) { return Number(toPrimitive(v, 'number')); }
  function truthy(v) { return isObj(v) ? true : !!v; }
  function toKey(v) {
    if (typeof v === 'number') return fmtNum(v) === '-0' ? '0' : String(v);
    return toStr(v);
  }
  function arrayIndex(key) {
    if (typeof key !== 'string') return -1;
    if (!/^(0|[1-9]\d*)$/.test(key)) return -1;
    const n = Number(key);
    return n < 4294967295 ? n : -1;
  }

  // ---------- the interpreter ----------
  function run(code, opts) {
    opts = opts || {};
    const ctx = {
      code,
      nextObjId: 0, nextBuiltinId: 0, nextEnvId: 0, nextCallId: 0,
      allObjs: [],
      steps: [], output: [], events: [],
      stack: [], random: makeRandom(opts.seed == null ? 42 : opts.seed),
      error: null, unsupported: null, parseError: null, stoppedAtLimit: false,
      maxSteps: opts.maxSteps || MAX_STEPS,
    };
    let ast;
    try {
      ast = acornLib.parse(code, { ecmaVersion: 2022, sourceType: 'script', locations: true, allowReturnOutsideFunction: false });
    } catch (e) {
      ctx.parseError = { message: e.message.replace(/\s*\(\d+:\d+\)$/, ''), line: e.loc ? e.loc.line : 1, column: e.loc ? e.loc.column : 0, pos: e.pos };
      return finish(ctx);
    }
    ctx.ast = ast;
    const builtinEnv = new Env(ctx, 'builtin', 'built-ins', null);
    installBuiltins(ctx, builtinEnv);
    ctx.globalEnv = new Env(ctx, 'global', 'Global frame', builtinEnv, 0);
    const globalFrame = { id: 0, callId: 0, name: 'Global frame', env: ctx.globalEnv, baseEnv: ctx.globalEnv, builtin: false };
    ctx.stack.push(globalFrame);
    ctx.objCountAtBuiltins = ctx.nextObjId;
    try {
      hoistDeclarations(ctx, ast.body, ctx.globalEnv, true);
      emit(ctx, { rule: 'start' });
      record(ctx, null, 'start');
      const c = execBlockBody(ctx, ast.body, ctx.globalEnv);
      if (c && c.type === 'return') { /* not possible at top level */ }
      emit(ctx, { rule: 'end' });
      record(ctx, null, 'end');
    } catch (e) {
      handleTopError(ctx, e);
    }
    return finish(ctx);
  }

  function handleTopError(ctx, e) {
    if (e instanceof Thrown) {
      const v = e.value;
      const msg = isObj(v) && v.isError ? errName(v) + ': ' + toStr(v.props.get('message')) : fmtTop(v);
      ctx.error = { name: isObj(v) && v.isError ? errName(v) : 'Uncaught', message: msg, line: ctx.lastNode ? ctx.lastNode.loc.start.line : 1 };
      ctx.output.push({ kind: 'error', text: 'Uncaught ' + msg });
      emit(ctx, { rule: 'error', text: msg });
      record(ctx, ctx.lastNode, 'error');
    } else if (e instanceof Unsupported) {
      ctx.unsupported = { message: e.message, line: e.node && e.node.loc ? e.node.loc.start.line : 1 };
    } else if (e instanceof StepLimit) {
      ctx.stoppedAtLimit = true;
    } else {
      ctx.unsupported = { message: 'The tracer hit an internal problem: ' + (e && e.message), line: ctx.lastNode ? ctx.lastNode.loc.start.line : 1 };
      if (root.TRACER_DEBUG) throw e;
    }
  }

  function finish(ctx) {
    return {
      steps: ctx.steps,
      output: ctx.output,
      error: ctx.error,
      parseError: ctx.parseError,
      unsupported: ctx.unsupported,
      stoppedAtLimit: ctx.stoppedAtLimit,
      outputText: ctx.output.map(o => o.text).join('\n'),
    };
  }

  // ---------- events and steps ----------
  function emit(ctx, ev) { ctx.events.push(ev); }

  function record(ctx, node, kind, range) {
    if (ctx.steps.length >= ctx.maxSteps) throw new StepLimit();
    const frame = ctx.stack[ctx.stack.length - 1];
    const step = {
      kind,
      line: node && node.loc ? node.loc.start.line : (kind === 'end' ? lastLine(ctx) : 1),
      start: range ? range[0] : (node ? node.start : 0),
      end: range ? range[1] : (node ? node.end : 0),
      events: ctx.events,
      outCount: ctx.output.length,
      frameId: frame.callId,
      snap: snapshot(ctx),
    };
    ctx.events = [];
    ctx.steps.push(step);
  }
  function lastLine(ctx) { return ctx.code.split('\n').length; }

  // ---------- snapshot ----------
  function snapVal(v) {
    if (v === HOLE) return { k: 'hole' };
    if (isObj(v)) {
      if (v.kind === 'builtin') return { k: 'bi', s: 'ƒ ' + v.name };
      return { k: 'r', id: v.id };
    }
    const t = v === null ? 'null' : typeof v;
    let s;
    if (t === 'string') s = JSON.stringify(v);
    else s = fmtPrim(v);
    return { k: 'p', t, s };
  }

  function snapshot(ctx) {
    const objs = new Map(); // id -> obj
    const queue = [];
    const envsOnStack = new Set();
    const capturedEnvs = new Map();
    function visitVal(v) { if (isObj(v) && v.kind !== 'builtin' && !objs.has(v.id)) { objs.set(v.id, v); queue.push(v); } }
    function envChain(env, stopAt) {
      const list = [];
      let e = env;
      while (e && e !== stopAt.parent) { list.push(e); if (e === stopAt) break; e = e.parent; }
      return list.reverse(); // outer to inner
    }
    const frames = ctx.stack.map(fr => {
      const envs = fr.builtin ? [] : envChain(fr.env, fr.baseEnv);
      envs.forEach(e => envsOnStack.add(e));
      return { fr, envs };
    });
    const frameSnaps = frames.map(({ fr, envs }) => {
      const envSnaps = envs.map(e => snapEnv(e));
      return {
        id: fr.callId, name: fr.name, builtin: !!fr.builtin,
        envs: envSnaps,
        ret: fr.hasReturn ? snapVal(fr.returnValue) : null,
        thisVal: fr.thisShown ? snapVal(fr.thisValue) : null,
      };
    });
    function snapEnv(e) {
      const bindings = [];
      for (const [name, b] of e.vars) {
        if (b.hidden) continue;
        if (!b.init) bindings.push({ name, decl: b.decl, v: { k: 'u' } });
        else { bindings.push({ name, decl: b.decl, v: snapVal(b.value) }); visitVal(b.value); }
      }
      return { id: e.id, kind: e.kind, label: e.label, callId: e.callId, bindings };
    }
    // walk heap
    const heap = [];
    while (queue.length) {
      const o = queue.shift();
      const ho = { id: o.id, kind: o.kind };
      if (o.kind === 'array') { ho.items = o.items.map(x => { visitVal(x); return snapVal(x); }); }
      else if (o.kind === 'set') { ho.items = o.values.map(x => { visitVal(x); return snapVal(x); }); }
      else if (o.kind === 'function') {
        ho.name = o.name || '';
        ho.params = o.paramText;
        ho.arrow = o.isArrow;
        // closure env
        const ce = o.closure;
        if (ce && ce.kind !== 'global' && ce.kind !== 'builtin') {
          ho.scopeEnv = ce.id;
          if (!envsOnStack.has(ce)) {
            // captured chain up to (not including) global or an env on stack
            let e = ce;
            while (e && e.kind !== 'global' && e.kind !== 'builtin' && !envsOnStack.has(e)) {
              if (!capturedEnvs.has(e.id)) {
                capturedEnvs.set(e.id, e);
                for (const [, b] of e.vars) if (b.init) visitVal(b.value);
              }
              e = e.parent;
            }
          }
        } else ho.scopeEnv = null;
        ho.scopeLabel = ce ? ce.label : '';
      }
      if (o.kind === 'object' || o.kind === 'function') {
        ho.props = [];
        for (const [k, v] of orderedEntries(o.props)) { if (o.kind === 'function' && (k === 'prototype')) continue; visitVal(v); ho.props.push({ key: k, v: snapVal(v) }); }
        if (o.isError) ho.isError = true;
      }
      heap.push(ho);
    }
    heap.sort((a, b) => a.id - b.id);
    const captured = [];
    for (const [, e] of capturedEnvs) {
      const s = snapEnv(e);
      s.parentId = e.parent && e.parent.kind !== 'global' && e.parent.kind !== 'builtin' ? e.parent.id : null;
      captured.push(s);
    }
    // captured envs may have added objects; walk again
    while (queue.length) {
      const o = queue.shift();
      const ho = { id: o.id, kind: o.kind };
      if (o.kind === 'array') ho.items = o.items.map(x => { visitVal(x); return snapVal(x); });
      else if (o.kind === 'set') ho.items = o.values.map(x => { visitVal(x); return snapVal(x); });
      else { ho.props = []; for (const [k, v] of orderedEntries(o.props)) { visitVal(v); ho.props.push({ key: k, v: snapVal(v) }); } if (o.kind === 'function') { ho.name = o.name || ''; ho.params = o.paramText; ho.arrow = o.isArrow; ho.scopeEnv = o.closure && o.closure.kind !== 'global' ? o.closure.id : null; ho.scopeLabel = o.closure ? o.closure.label : ''; } }
      heap.push(ho);
    }
    heap.sort((a, b) => a.id - b.id);
    captured.sort((a, b) => a.id - b.id);
    return { frames: frameSnaps, heap, captured };
  }

  // ---------- hoisting ----------
  function collectVarNames(node, out) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(n => collectVarNames(n, out)); return; }
    switch (node.type) {
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': return;
      case 'VariableDeclaration':
        if (node.kind === 'var') node.declarations.forEach(d => patternNames(d.id, out));
        node.declarations.forEach(d => collectVarNames(d.init, out));
        return;
    }
    for (const key in node) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'type') continue;
      const v = node[key];
      if (v && typeof v === 'object') collectVarNames(v, out);
    }
  }
  function patternNames(p, out) {
    if (!p) return;
    switch (p.type) {
      case 'Identifier': out.push(p.name); break;
      case 'ArrayPattern': p.elements.forEach(e => patternNames(e, out)); break;
      case 'ObjectPattern': p.properties.forEach(pr => patternNames(pr.type === 'RestElement' ? pr.argument : pr.value, out)); break;
      case 'AssignmentPattern': patternNames(p.left, out); break;
      case 'RestElement': patternNames(p.argument, out); break;
    }
  }

  // Hoist into `env`: function declarations (created now), let/const/class (uninitialized),
  // and when isFunctionScope, var names (undefined).
  function hoistDeclarations(ctx, body, env, isFunctionScope) {
    if (isFunctionScope) {
      const names = [];
      collectVarNames(body, names);
      for (const n of names) if (!env.vars.has(n)) { env.vars.set(n, { value: undefined, decl: 'var', init: true }); emit(ctx, { rule: 'hoist-var', name: n }); }
    }
    for (const st of body) {
      if (st.type === 'VariableDeclaration' && st.kind !== 'var') {
        const names = [];
        st.declarations.forEach(d => patternNames(d.id, names));
        for (const n of names) env.vars.set(n, { value: undefined, decl: st.kind, init: false });
      } else if (st.type === 'ClassDeclaration') {
        throw new Unsupported('Classes aren\'t supported by the tracer yet. Plain objects and functions are.', st);
      }
    }
    for (const st of body) {
      if (st.type === 'FunctionDeclaration') {
        const f = makeFunction(ctx, st, env);
        env.vars.set(st.id.name, { value: f, decl: 'function', init: true });
        emit(ctx, { rule: 'hoist-fn', name: st.id.name, id: f.id });
      }
    }
  }

  function blockNeedsEnv(body) {
    return body.some(st => (st.type === 'VariableDeclaration' && st.kind !== 'var') || st.type === 'FunctionDeclaration' || st.type === 'ClassDeclaration');
  }

  // ---------- statements ----------
  const NORMAL = { type: 'normal' };

  function currentFrame(ctx) { return ctx.stack[ctx.stack.length - 1]; }

  function execBlockBody(ctx, body, env) {
    for (const st of body) {
      const c = execStatement(ctx, st, env);
      if (c.type !== 'normal') return c;
    }
    return NORMAL;
  }

  function withEnv(ctx, env, fn) {
    const fr = currentFrame(ctx);
    const saved = fr.env;
    fr.env = env;
    try { return fn(); } finally { fr.env = saved; }
  }

  function execStatement(ctx, st, env) {
    ctx.lastNode = st;
    switch (st.type) {
      case 'ExpressionStatement': {
        evaluate(ctx, st.expression, env);
        record(ctx, st, 'stmt');
        return NORMAL;
      }
      case 'VariableDeclaration': {
        for (const d of st.declarations) {
          let val;
          if (d.init) val = evaluate(ctx, d.init, env, d.id.type === 'Identifier' ? d.id.name : null);
          else if (st.kind === 'var') { record(ctx, st, 'stmt'); continue; }
          else val = undefined;
          bindPattern(ctx, d.id, val, env, st.kind);
        }
        record(ctx, st, 'stmt');
        return NORMAL;
      }
      case 'FunctionDeclaration':
        return NORMAL; // hoisted
      case 'EmptyStatement':
        return NORMAL;
      case 'BlockStatement': {
        if (blockNeedsEnv(st.body)) {
          const benv = new Env(ctx, 'block', 'block', env, currentFrame(ctx).callId);
          return withEnv(ctx, benv, () => { hoistDeclarations(ctx, st.body, benv, false); return execBlockBody(ctx, st.body, benv); });
        }
        return execBlockBody(ctx, st.body, env);
      }
      case 'IfStatement': {
        const t = evaluate(ctx, st.test, env);
        const r = truthy(t);
        emit(ctx, { rule: 'branch', result: r, value: snapVal(t), isBool: typeof t === 'boolean', hasElse: !!st.alternate });
        record(ctx, st.test, 'test');
        if (r) return execStatement(ctx, st.consequent, env);
        if (st.alternate) return execStatement(ctx, st.alternate, env);
        return NORMAL;
      }
      case 'ReturnStatement': {
        const v = st.argument ? evaluate(ctx, st.argument, env) : undefined;
        const fr = currentFrame(ctx);
        if (fr.callId === 0) throw new Unsupported('return outside a function', st);
        fr.hasReturn = true; fr.returnValue = v;
        emit(ctx, { rule: 'return', fn: fr.name, value: snapVal(v) });
        record(ctx, st, 'return');
        return { type: 'return', value: v };
      }
      case 'BreakStatement':
        if (st.label) throw new Unsupported('Labeled break isn\'t supported yet.', st);
        emit(ctx, { rule: 'break' });
        record(ctx, st, 'stmt');
        return { type: 'break' };
      case 'ContinueStatement':
        if (st.label) throw new Unsupported('Labeled continue isn\'t supported yet.', st);
        emit(ctx, { rule: 'continue' });
        record(ctx, st, 'stmt');
        return { type: 'continue' };
      case 'WhileStatement': {
        for (;;) {
          const t = evaluate(ctx, st.test, env);
          const r = truthy(t);
          emit(ctx, { rule: 'loop-test', result: r, value: snapVal(t) });
          record(ctx, st.test, 'test');
          if (!r) break;
          const c = execStatement(ctx, st.body, env);
          if (c.type === 'break') break;
          if (c.type === 'return') return c;
        }
        return NORMAL;
      }
      case 'DoWhileStatement': {
        for (;;) {
          const c = execStatement(ctx, st.body, env);
          if (c.type === 'break') break;
          if (c.type === 'return') return c;
          const t = evaluate(ctx, st.test, env);
          const r = truthy(t);
          emit(ctx, { rule: 'loop-test', result: r, value: snapVal(t) });
          record(ctx, st.test, 'test');
          if (!r) break;
        }
        return NORMAL;
      }
      case 'ForStatement': return execFor(ctx, st, env);
      case 'ForOfStatement': case 'ForInStatement': return execForOf(ctx, st, env);
      case 'ThrowStatement': {
        const v = evaluate(ctx, st.argument, env);
        throw new Thrown(v);
      }
      case 'TryStatement': return execTry(ctx, st, env);
      case 'ClassDeclaration':
        throw new Unsupported('Classes aren\'t supported by the tracer yet. Plain objects and functions are.', st);
      case 'SwitchStatement': return execSwitch(ctx, st, env);
      case 'LabeledStatement':
        throw new Unsupported('Labels aren\'t supported yet.', st);
      default:
        throw new Unsupported(st.type + ' isn\'t supported by the tracer yet.', st);
    }
  }

  function execSwitch(ctx, st, env) {
    const d = evaluate(ctx, st.discriminant, env);
    record(ctx, st.discriminant, 'test');
    const benv = new Env(ctx, 'block', 'block', env, currentFrame(ctx).callId);
    const all = [];
    st.cases.forEach(c => all.push(...c.consequent));
    return withEnv(ctx, benv, () => {
      hoistDeclarations(ctx, all, benv, false);
      let matched = -1;
      for (let i = 0; i < st.cases.length; i++) {
        const c = st.cases[i];
        if (!c.test) continue;
        if (strictEq(d, evaluate(ctx, c.test, benv))) { matched = i; break; }
      }
      if (matched < 0) matched = st.cases.findIndex(c => !c.test);
      if (matched < 0) return NORMAL;
      for (let i = matched; i < st.cases.length; i++) {
        const c = execBlockBody(ctx, st.cases[i].consequent, benv);
        if (c.type === 'break') return NORMAL;
        if (c.type !== 'normal') return c;
      }
      return NORMAL;
    });
  }

  function execTry(ctx, st, env) {
    const depth = ctx.stack.length;
    let result;
    try {
      result = execStatement(ctx, st.block, env);
    } catch (e) {
      if (!(e instanceof Thrown) || !st.handler) {
        if (st.finalizer) { ctx.stack.length = depth; execStatement(ctx, st.finalizer, env); }
        throw e;
      }
      ctx.stack.length = depth;
      emit(ctx, { rule: 'catch', value: snapVal(e.value) });
      const cenv = new Env(ctx, 'block', 'catch', env, currentFrame(ctx).callId);
      result = withEnv(ctx, cenv, () => {
        if (st.handler.param) bindPattern(ctx, st.handler.param, e.value, cenv, 'let');
        record(ctx, st.handler, 'stmt', [st.handler.start, st.handler.body.start]);
        return execStatement(ctx, st.handler.body, cenv);
      });
    }
    if (st.finalizer) {
      const f = execStatement(ctx, st.finalizer, env);
      if (f.type !== 'normal') return f;
    }
    return result;
  }

  function copyEnv(ctx, env, pass) {
    const n = new Env(ctx, 'loop', env.label.replace(/, pass \d+$/, '') + ', pass ' + pass, env.parent, env.callId);
    for (const [k, b] of env.vars) n.vars.set(k, { value: b.value, decl: b.decl, init: b.init });
    return n;
  }

  function execFor(ctx, st, env) {
    const perIter = st.init && st.init.type === 'VariableDeclaration' && st.init.kind !== 'var';
    let loopEnv = env;
    if (perIter) {
      loopEnv = new Env(ctx, 'loop', 'for loop, pass 1', env, currentFrame(ctx).callId);
      const names = [];
      st.init.declarations.forEach(d => patternNames(d.id, names));
      names.forEach(n => loopEnv.vars.set(n, { value: undefined, decl: st.init.kind, init: false }));
    }
    const fr = currentFrame(ctx);
    const saved = fr.env;
    fr.env = loopEnv;
    try {
      if (st.init) {
        if (st.init.type === 'VariableDeclaration') {
          for (const d of st.init.declarations) bindPattern(ctx, d.id, d.init ? evaluate(ctx, d.init, loopEnv) : undefined, loopEnv, st.init.kind);
        } else evaluate(ctx, st.init, loopEnv);
        record(ctx, st.init, 'stmt');
      }
      let pass = 1;
      for (;;) {
        if (st.test) {
          const t = evaluate(ctx, st.test, loopEnv);
          const r = truthy(t);
          emit(ctx, { rule: 'loop-test', result: r, value: snapVal(t), perIter, pass });
          record(ctx, st.test, 'test');
          if (!r) break;
        }
        const c = execStatement(ctx, st.body, loopEnv);
        if (c.type === 'break') break;
        if (c.type === 'return') return c;
        if (perIter) {
          pass++;
          loopEnv = copyEnv(ctx, loopEnv, pass);
          fr.env = loopEnv;
          emit(ctx, { rule: 'iter-copy', pass });
        }
        if (st.update) { evaluate(ctx, st.update, loopEnv); record(ctx, st.update, 'stmt'); }
      }
      return NORMAL;
    } finally { fr.env = saved; }
  }

  function iterate(ctx, v, node) {
    if (typeof v === 'string') return Array.from(v);
    if (isObj(v) && v.kind === 'array') return v.items.map(x => x === HOLE ? undefined : x);
    if (isObj(v) && v.kind === 'set') return v.values.slice();
    throwError(ctx, 'TypeError', srcOf(ctx, node) + ' is not iterable');
  }

  function execForOf(ctx, st, env) {
    const subject = evaluate(ctx, st.right, env);
    let values;
    if (st.type === 'ForInStatement') {
      if (subject == null) values = [];
      else if (isObj(subject)) values = ownKeys(subject);
      else if (typeof subject === 'string') values = Object.keys(subject);
      else values = [];
    } else values = iterate(ctx, subject, st.right);
    const left = st.left;
    const isDecl = left.type === 'VariableDeclaration';
    const perIter = isDecl && left.kind !== 'var';
    const fr = currentFrame(ctx);
    const saved = fr.env;
    try {
      let pass = 0;
      for (const v of values) {
        pass++;
        let iterEnv = env;
        if (perIter) {
          iterEnv = new Env(ctx, 'loop', (st.type === 'ForInStatement' ? 'for…in' : 'for…of') + ', pass ' + pass, env, fr.callId);
          fr.env = iterEnv;
        }
        if (isDecl) bindPattern(ctx, left.declarations[0].id, v, iterEnv, left.kind);
        else assignToTarget(ctx, left, v, iterEnv);
        emit(ctx, { rule: 'iter-next', value: snapVal(v), pass, kind: st.type });
        record(ctx, left, 'test');
        const c = execStatement(ctx, st.body, iterEnv);
        fr.env = saved;
        if (c.type === 'break') break;
        if (c.type === 'return') return c;
      }
      emit(ctx, { rule: 'iter-done' });
      record(ctx, st.right, 'test');
      return NORMAL;
    } finally { fr.env = saved; }
  }

  // ---------- bindings ----------
  function lookup(ctx, env, name) {
    let e = env;
    while (e) {
      const b = e.vars.get(name);
      if (b) return { env: e, b };
      e = e.parent;
    }
    return null;
  }

  function getVar(ctx, env, name, node) {
    const r = lookup(ctx, env, name);
    if (!r) throwError(ctx, 'ReferenceError', name + ' is not defined');
    if (!r.b.init) { emit(ctx, { rule: 'tdz', name }); throwError(ctx, 'ReferenceError', "Cannot access '" + name + "' before initialization"); }
    return r.b.value;
  }

  function setVar(ctx, env, name, value, node) {
    const r = lookup(ctx, env, name);
    if (!r) {
      // sloppy-mode implicit global
      ctx.globalEnv.vars.set(name, { value, decl: 'implicit', init: true });
      emit(ctx, { rule: 'implicit-global', name, value: snapVal(value) });
      return;
    }
    if (!r.b.init) { emit(ctx, { rule: 'tdz', name }); throwError(ctx, 'ReferenceError', "Cannot access '" + name + "' before initialization"); }
    if (r.b.decl === 'const') throwError(ctx, 'TypeError', 'Assignment to constant variable.');
    const old = r.b.value;
    r.b.value = value;
    emit(ctx, { rule: 'reassign', name, envId: r.env.id, old: snapVal(old), value: snapVal(value) });
  }

  function declare(ctx, env, name, value, kind) {
    let target = env;
    if (kind === 'var') { while (target && target.kind !== 'function' && target.kind !== 'global') target = target.parent; }
    const existing = target.vars.get(name);
    if (existing && kind !== 'var' && existing.init && existing.decl !== 'param') {
      // re-declaration inside a re-run block cannot happen in valid code; just overwrite
    }
    target.vars.set(name, { value, decl: kind === 'param' ? 'param' : kind, init: true });
    emit(ctx, { rule: kind === 'param' ? 'param' : 'declare', name, decl: kind, envId: target.id, value: snapVal(value) });
  }

  function bindPattern(ctx, p, value, env, kind) {
    switch (p.type) {
      case 'Identifier':
        if (isObj(value) && value.kind === 'function' && !value.name && value.anonymousName == null) value.name = p.name;
        declare(ctx, env, p.name, value, kind);
        return;
      case 'AssignmentPattern':
        if (value === undefined) value = evaluate(ctx, p.right, env, p.left.type === 'Identifier' ? p.left.name : null);
        return bindPattern(ctx, p.left, value, env, kind);
      case 'ArrayPattern': {
        const vals = iterate(ctx, value, p);
        p.elements.forEach((el, i) => {
          if (!el) return;
          if (el.type === 'RestElement') bindPattern(ctx, el.argument, newArray(ctx, vals.slice(i)), env, kind);
          else bindPattern(ctx, el, vals[i], env, kind);
        });
        return;
      }
      case 'ObjectPattern': {
        if (value == null) throwError(ctx, 'TypeError', "Cannot destructure '" + fmtTop(value) + "' as it is " + (value === null ? 'null' : 'undefined') + '.');
        const used = [];
        for (const pr of p.properties) {
          if (pr.type === 'RestElement') {
            const o = newObject(ctx);
            if (isObj(value)) for (const k of ownKeys(value)) if (!used.includes(k)) o.props.set(k, getProp(ctx, value, k, pr));
            bindPattern(ctx, pr.argument, o, env, kind);
            continue;
          }
          const key = pr.computed ? toKey(evaluate(ctx, pr.key, env)) : (pr.key.type === 'Identifier' ? pr.key.name : String(pr.key.value));
          used.push(key);
          bindPattern(ctx, pr.value, getProp(ctx, value, key, pr), env, kind);
        }
        return;
      }
      default:
        throw new Unsupported('This kind of declaration isn\'t supported yet.', p);
    }
  }

  function assignToTarget(ctx, target, value, env) {
    switch (target.type) {
      case 'Identifier': setVar(ctx, env, target.name, value, target); return;
      case 'MemberExpression': {
        const obj = evaluate(ctx, target.object, env);
        const key = memberKey(ctx, target, env);
        setProp(ctx, obj, key, value, target);
        return;
      }
      case 'ArrayPattern': {
        const vals = iterate(ctx, value, target);
        target.elements.forEach((el, i) => { if (el) assignToTarget(ctx, el.type === 'RestElement' ? el.argument : el, el.type === 'RestElement' ? newArray(ctx, vals.slice(i)) : vals[i], env); });
        return;
      }
      case 'ObjectPattern': {
        for (const pr of target.properties) {
          const key = pr.computed ? toKey(evaluate(ctx, pr.key, env)) : (pr.key.type === 'Identifier' ? pr.key.name : String(pr.key.value));
          assignToTarget(ctx, pr.value, getProp(ctx, value, key, pr), env);
        }
        return;
      }
      case 'AssignmentPattern':
        return assignToTarget(ctx, target.left, value === undefined ? evaluate(ctx, target.right, env) : value, env);
      default: throw new Unsupported('Assignment to ' + target.type + ' isn\'t supported.', target);
    }
  }

  // ---------- objects ----------
  function newObject(ctx) { const o = new Obj(ctx, 'object'); emit(ctx, { rule: 'create', id: o.id, kind: 'object' }); return o; }
  function newArray(ctx, items) { const o = new Obj(ctx, 'array'); o.items = items || []; emit(ctx, { rule: 'create', id: o.id, kind: 'array' }); return o; }
  function newError(ctx, name, message) {
    const o = new Obj(ctx, 'object');
    o.isError = true;
    o.props.set('name', name);
    o.props.set('message', message);
    return o;
  }
  function throwError(ctx, name, message) { throw new Thrown(newError(ctx, name, message)); }

  function ownKeys(o) {
    if (o.kind === 'array') { const ks = []; o.items.forEach((x, i) => { if (x !== HOLE) ks.push(String(i)); }); for (const k of o.props.keys()) ks.push(k); return ks; }
    if (o.isError) return [];
    return orderedEntries(o.props).map(e => e[0]);
  }

  function memberKey(ctx, node, env) {
    if (node.computed) return toKey(evaluate(ctx, node.property, env));
    if (node.property.type === 'PrivateIdentifier') throw new Unsupported('Private fields aren\'t supported.', node);
    return node.property.name;
  }

  function getProp(ctx, obj, key, node) {
    if (obj === undefined || obj === null) {
      throwError(ctx, 'TypeError', 'Cannot read properties of ' + fmtPrim(obj) + " (reading '" + key + "')");
    }
    if (typeof obj === 'string') {
      emit(ctx, { rule: 'wrapper', prim: snapVal(obj), key });
      if (key === 'length') return obj.length;
      const i = arrayIndex(key);
      if (i >= 0) return i < obj.length ? obj[i] : undefined;
      const m = STRING_METHODS[key];
      return m ? builtinFor(ctx, 'String.prototype.' + key, m) : undefined;
    }
    if (typeof obj === 'number') {
      const m = NUMBER_METHODS[key];
      return m ? builtinFor(ctx, 'Number.prototype.' + key, m) : undefined;
    }
    if (typeof obj === 'boolean') {
      if (key === 'toString') return builtinFor(ctx, 'Boolean.prototype.toString', (c, t) => String(t));
      return undefined;
    }
    if (!isObj(obj)) return undefined;
    if (obj.kind === 'array') {
      if (key === 'length') return obj.items.length;
      const i = arrayIndex(key);
      if (i >= 0) { const v = obj.items[i]; return v === HOLE ? undefined : v; }
      if (obj.props.has(key)) return obj.props.get(key);
      const m = ARRAY_METHODS[key];
      return m ? builtinFor(ctx, 'Array.prototype.' + key, m) : undefined;
    }
    if (obj.kind === 'set') {
      if (key === 'size') return obj.values.length;
      const m = SET_METHODS[key];
      return m ? builtinFor(ctx, 'Set.prototype.' + key, m) : undefined;
    }
    if (obj.props.has(key)) return obj.props.get(key);
    if (obj.kind === 'function' || obj.kind === 'builtin') {
      if (key === 'name') return obj.name || '';
      if (key === 'length') return obj.paramCount || 0;
      if (key === 'call' || key === 'apply' || key === 'bind') return builtinFor(ctx, 'Function.prototype.' + key, FUNCTION_METHODS[key]);
      return undefined;
    }
    if (key === 'hasOwnProperty') return builtinFor(ctx, 'Object.prototype.hasOwnProperty', (c, t, a) => isObj(t) && ownKeys(t).includes(toKey(a[0])));
    if (key === 'toString') return builtinFor(ctx, 'Object.prototype.toString', (c, t) => toStr(t));
    return undefined;
  }

  function setProp(ctx, obj, key, value, node) {
    if (obj === undefined || obj === null) {
      throwError(ctx, 'TypeError', 'Cannot set properties of ' + fmtPrim(obj) + " (setting '" + key + "')");
    }
    if (!isObj(obj)) return; // sloppy mode: silently ignored on primitives
    if (obj.frozen) return;
    let old;
    if (obj.kind === 'array') {
      if (key === 'length') {
        const n = toNum(value);
        if (!(n >= 0 && Number.isInteger(n))) throwError(ctx, 'RangeError', 'Invalid array length');
        old = obj.items.length;
        if (n < obj.items.length) obj.items.length = n; else while (obj.items.length < n) obj.items.push(HOLE);
        emit(ctx, { rule: 'mutate', id: obj.id, key, old: snapVal(old), value: snapVal(value) });
        return;
      }
      const i = arrayIndex(key);
      if (i >= 0) {
        old = i < obj.items.length ? obj.items[i] : HOLE;
        while (obj.items.length < i) obj.items.push(HOLE);
        obj.items[i] = value;
        emit(ctx, { rule: 'mutate', id: obj.id, key, old: snapVal(old), value: snapVal(value), grew: old === HOLE });
        return;
      }
    }
    old = obj.props.has(key) ? obj.props.get(key) : HOLE;
    obj.props.set(key, value);
    emit(ctx, { rule: 'mutate', id: obj.id, key, old: snapVal(old), value: snapVal(value), added: old === HOLE });
  }

  // ---------- functions ----------
  function paramText(ctx, node) { return node.params.map(p => ctx.code.slice(p.start, p.end)).join(', '); }

  function makeFunction(ctx, node, env, nameHint) {
    const f = new Obj(ctx, 'function');
    f.node = node;
    f.closure = env;
    f.isArrow = node.type === 'ArrowFunctionExpression';
    f.name = node.id ? node.id.name : (nameHint || '');
    f.paramText = paramText(ctx, node);
    f.paramCount = node.params.filter(p => p.type === 'Identifier').length;
    if (node.async || node.generator) throw new Unsupported((node.async ? 'async' : 'generator') + ' functions aren\'t supported by the tracer yet.', node);
    if (f.isArrow) {
      // arrow functions take `this` from where they are made
      const fr = currentFrame(ctx);
      f.lexicalThis = fr.thisValue;
    }
    if (env.kind !== 'global' && env.kind !== 'builtin') emit(ctx, { rule: 'closure', id: f.id, name: f.name, envLabel: env.label });
    else emit(ctx, { rule: 'fn-create', id: f.id, name: f.name });
    return f;
  }

  function builtinFor(ctx, name, impl) {
    // builtin method objects are not shown in the heap; they are created fresh but cached per name
    if (!ctx.builtinCache) ctx.builtinCache = new Map();
    let b = ctx.builtinCache.get(name);
    if (!b) { b = new Obj(ctx, 'builtin'); b.name = name; b.impl = impl; ctx.builtinCache.set(name, b); }
    return b;
  }

  function callFunction(ctx, f, thisVal, args, callNode) {
    if (!isObj(f) || (f.kind !== 'function' && f.kind !== 'builtin')) {
      const text = callNode ? srcOf(ctx, callNode.callee || callNode) : 'value';
      throwError(ctx, 'TypeError', text + ' is not a function');
    }
    if (f.kind === 'builtin') return f.impl(ctx, thisVal, args, callNode, f);
    if (ctx.stack.length > MAX_DEPTH) throwError(ctx, 'RangeError', 'Maximum call stack size exceeded');
    const node = f.node;
    const callId = ++ctx.nextCallId;
    const name = f.name || '(anonymous)';
    const fenv = new Env(ctx, 'function', name, f.closure, callId);
    const frame = { id: callId, callId, name, env: fenv, baseEnv: fenv, fn: f, thisValue: f.isArrow ? f.lexicalThis : thisVal, thisShown: !f.isArrow && isObj(thisVal) };
    ctx.stack.push(frame);
    try {
      emit(ctx, { rule: 'call', fn: name, args: args.map(snapVal), params: f.paramText });
      node.params.forEach((p, i) => {
        if (p.type === 'RestElement') bindPattern(ctx, p.argument, newArray(ctx, args.slice(i)), fenv, 'param');
        else bindPattern(ctx, p, args[i], fenv, 'param');
      });
      if (node.body.type === 'BlockStatement') hoistDeclarations(ctx, node.body.body, fenv, true);
      const headEnd = node.body.type === 'BlockStatement' ? node.body.start + 1 : node.body.start;
      record(ctx, node, 'call', [node.start, Math.min(headEnd, node.end)]);
      let result;
      if (node.body.type === 'BlockStatement') {
        const c = execBlockBody(ctx, node.body.body, fenv);
        result = c.type === 'return' ? c.value : undefined;
        if (c.type !== 'return') {
          frame.hasReturn = true; frame.returnValue = undefined;
          emit(ctx, { rule: 'return', fn: name, value: snapVal(undefined), implicit: true });
          record(ctx, node, 'return', [node.end - 1, node.end]);
        }
      } else {
        result = evaluate(ctx, node.body, fenv);
        frame.hasReturn = true; frame.returnValue = result;
        emit(ctx, { rule: 'return', fn: name, value: snapVal(result), expr: true });
        record(ctx, node.body, 'return');
      }
      ctx.stack.pop();
      emit(ctx, { rule: 'popped', fn: name, callId, value: snapVal(result) });
      return result;
    } catch (e) {
      if (ctx.stack[ctx.stack.length - 1] === frame && !(e instanceof Thrown)) ctx.stack.pop();
      else if (e instanceof Thrown) {
        // leave the frame on the stack until the error is caught or reported, so the
        // error step shows where it happened; execTry trims the stack when it catches.
      }
      throw e;
    }
  }

  function srcOf(ctx, node) { return ctx.code.slice(node.start, node.end); }

  // ---------- expressions ----------
  function strictEq(a, b) { return isObj(a) || isObj(b) ? a === b : a === b; }
  function looseEq(ctx, a, b) {
    if (isObj(a) && isObj(b)) return a === b;
    if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
    if (a === null || a === undefined || b === null || b === undefined) return false;
    const pa = isObj(a) ? toPrimitive(a) : a, pb = isObj(b) ? toPrimitive(b) : b;
    // eslint-disable-next-line eqeqeq
    return pa == pb;
  }

  function evaluate(ctx, node, env, nameHint) {
    switch (node.type) {
      case 'Literal':
        if (node.regex) throw new Unsupported('Regular expressions aren\'t supported by the tracer yet.', node);
        if (typeof node.value === 'bigint') throw new Unsupported('BigInt isn\'t supported.', node);
        return node.value;
      case 'Identifier':
        if (node.name === 'undefined' && !lookupUser(ctx, env, 'undefined')) return undefined;
        return getVar(ctx, env, node.name, node);
      case 'TemplateLiteral': {
        let s = '';
        node.quasis.forEach((q, i) => {
          s += q.value.cooked;
          if (i < node.expressions.length) {
            const v = evaluate(ctx, node.expressions[i], env);
            s += toStr(v);
          }
        });
        return s;
      }
      case 'ArrayExpression': {
        const items = [];
        for (const el of node.elements) {
          if (!el) { items.push(HOLE); continue; }
          if (el.type === 'SpreadElement') items.push(...iterate(ctx, evaluate(ctx, el.argument, env), el.argument));
          else items.push(evaluate(ctx, el, env));
        }
        return newArray(ctx, items);
      }
      case 'ObjectExpression': {
        const o = newObject(ctx);
        for (const p of node.properties) {
          if (p.type === 'SpreadElement') {
            const src = evaluate(ctx, p.argument, env);
            if (isObj(src)) for (const k of ownKeys(src)) o.props.set(k, getProp(ctx, src, k, p));
            continue;
          }
          if (p.kind !== 'init') throw new Unsupported('Getters and setters aren\'t supported.', p);
          const key = p.computed ? toKey(evaluate(ctx, p.key, env)) : (p.key.type === 'Identifier' ? p.key.name : toKey(p.key.value));
          const v = evaluate(ctx, p.value, env, key);
          o.props.set(key, v);
        }
        return o;
      }
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return makeFunction(ctx, node, env, nameHint);
      case 'UnaryExpression': {
        if (node.operator === 'typeof' && node.argument.type === 'Identifier' && !lookup(ctx, env, node.argument.name)) return 'undefined';
        if (node.operator === 'delete') {
          const a = node.argument;
          if (a.type !== 'MemberExpression') return true;
          const obj = evaluate(ctx, a.object, env);
          const key = memberKey(ctx, a, env);
          if (isObj(obj)) {
            if (obj.kind === 'array' && arrayIndex(key) >= 0) { const i = arrayIndex(key); if (i < obj.items.length) obj.items[i] = HOLE; }
            else obj.props.delete(key);
            emit(ctx, { rule: 'mutate', id: obj.id, key, deleted: true });
          }
          return true;
        }
        const v = evaluate(ctx, node.argument, env);
        switch (node.operator) {
          case '!': return !truthy(v);
          case '-': return -toNum(v);
          case '+': {
            if (typeof v !== 'number') emit(ctx, { rule: 'coerce', op: 'unary+', from: snapVal(v), to: snapVal(toNum(v)) });
            return toNum(v);
          }
          case 'typeof': return typeOf(v);
          case 'void': return undefined;
          case '~': return ~toNum(v);
        }
        throw new Unsupported('Operator ' + node.operator, node);
      }
      case 'UpdateExpression': {
        const old = toNum(evaluate(ctx, node.argument, env));
        const nv = node.operator === '++' ? old + 1 : old - 1;
        assignToTarget(ctx, node.argument, nv, env);
        return node.prefix ? nv : old;
      }
      case 'BinaryExpression': {
        const a = evaluate(ctx, node.left, env);
        const b = evaluate(ctx, node.right, env);
        return binary(ctx, node.operator, a, b, node);
      }
      case 'LogicalExpression': {
        const a = evaluate(ctx, node.left, env);
        if (node.operator === '&&') return truthy(a) ? evaluate(ctx, node.right, env) : a;
        if (node.operator === '||') return truthy(a) ? a : evaluate(ctx, node.right, env);
        return (a === null || a === undefined) ? evaluate(ctx, node.right, env) : a;
      }
      case 'ConditionalExpression':
        return truthy(evaluate(ctx, node.test, env)) ? evaluate(ctx, node.consequent, env) : evaluate(ctx, node.alternate, env);
      case 'AssignmentExpression': {
        const op = node.operator;
        if (op === '=') {
          const v = evaluate(ctx, node.right, env, node.left.type === 'Identifier' ? node.left.name : null);
          if (node.left.type === 'MemberExpression') {
            // object and key were evaluated before the right side in real JS; re-evaluate is fine for side-effect-free targets
          }
          assignToTarget(ctx, node.left, v, env);
          return v;
        }
        if (op === '||=' || op === '&&=' || op === '??=') {
          const cur = evaluate(ctx, node.left, env);
          const go = op === '||=' ? !truthy(cur) : op === '&&=' ? truthy(cur) : (cur === null || cur === undefined);
          if (!go) return cur;
          const v = evaluate(ctx, node.right, env);
          assignToTarget(ctx, node.left, v, env);
          return v;
        }
        const cur = evaluate(ctx, node.left, env);
        const rhs = evaluate(ctx, node.right, env);
        const v = binary(ctx, op.slice(0, -1), cur, rhs, node);
        assignToTarget(ctx, node.left, v, env);
        return v;
      }
      case 'MemberExpression': {
        const obj = evaluate(ctx, node.object, env);
        if (node.optional && (obj === null || obj === undefined)) throw new ShortCircuit();
        const key = memberKey(ctx, node, env);
        return getProp(ctx, obj, key, node);
      }
      case 'ChainExpression':
        try { return evaluate(ctx, node.expression, env); }
        catch (e) { if (e instanceof ShortCircuit) return undefined; throw e; }
      case 'CallExpression': return evalCall(ctx, node, env);
      case 'NewExpression': return evalNew(ctx, node, env);
      case 'SequenceExpression': {
        let v;
        for (const e of node.expressions) v = evaluate(ctx, e, env);
        return v;
      }
      case 'ThisExpression': {
        const fr = currentFrame(ctx);
        return fr.thisValue;
      }
      case 'ClassExpression':
        throw new Unsupported('Classes aren\'t supported by the tracer yet.', node);
      case 'AwaitExpression': case 'YieldExpression':
        throw new Unsupported('async code isn\'t supported by the tracer yet.', node);
      case 'TaggedTemplateExpression':
        throw new Unsupported('Tagged templates aren\'t supported.', node);
      default:
        throw new Unsupported(node.type + ' isn\'t supported by the tracer yet.', node);
    }
  }

  class ShortCircuit {}

  function lookupUser(ctx, env, name) {
    const r = lookup(ctx, env, name);
    return r && r.env.kind !== 'builtin';
  }

  function binary(ctx, op, a, b, node) {
    switch (op) {
      case '+': {
        const pa = isObj(a) ? toPrimitive(a) : a, pb = isObj(b) ? toPrimitive(b) : b;
        if (typeof pa === 'string' || typeof pb === 'string') {
          if (typeof pa !== 'string' || typeof pb !== 'string' || isObj(a) || isObj(b)) emit(ctx, { rule: 'coerce', op: '+', a: snapVal(a), b: snapVal(b), to: 'string' });
          return String(pa) + String(pb);
        }
        return Number(pa) + Number(pb);
      }
      case '-': case '*': case '/': case '%': case '**': {
        if (typeof a !== 'number' || typeof b !== 'number') emit(ctx, { rule: 'coerce', op, a: snapVal(a), b: snapVal(b), to: 'number' });
        const x = toNum(a), y = toNum(b);
        switch (op) { case '-': return x - y; case '*': return x * y; case '/': return x / y; case '%': return x % y; case '**': return x ** y; }
      }
      // falls through (unreachable)
      case '===': return strictEq(a, b);
      case '!==': return !strictEq(a, b);
      case '==': {
        if (typeOf(a) !== typeOf(b) && !(a == null && b == null)) emit(ctx, { rule: 'coerce', op: '==', a: snapVal(a), b: snapVal(b) });
        return looseEq(ctx, a, b);
      }
      case '!=': return !looseEq(ctx, a, b);
      case '<': case '>': case '<=': case '>=': {
        const pa = isObj(a) ? toPrimitive(a) : a, pb = isObj(b) ? toPrimitive(b) : b;
        switch (op) { case '<': return pa < pb; case '>': return pa > pb; case '<=': return pa <= pb; case '>=': return pa >= pb; }
      }
      // falls through (unreachable)
      case '&': return toNum(a) & toNum(b);
      case '|': return toNum(a) | toNum(b);
      case '^': return toNum(a) ^ toNum(b);
      case '<<': return toNum(a) << toNum(b);
      case '>>': return toNum(a) >> toNum(b);
      case '>>>': return toNum(a) >>> toNum(b);
      case 'in': {
        if (!isObj(b)) throwError(ctx, 'TypeError', "Cannot use 'in' operator to search for '" + toKey(a) + "' in " + fmtTop(b));
        const k = toKey(a);
        if (b.kind === 'array') { const i = arrayIndex(k); if (i >= 0) return i < b.items.length && b.items[i] !== HOLE; if (k === 'length') return true; }
        return b.props.has(k);
      }
      case 'instanceof': {
        if (!isObj(b)) throwError(ctx, 'TypeError', "Right-hand side of 'instanceof' is not callable");
        if (!isObj(a)) return false;
        if (b.name === 'Array') return a.kind === 'array';
        if (b.name === 'Object') return true;
        if (b.name === 'Set') return a.kind === 'set';
        if (b.name === 'Error' || /Error$/.test(b.name)) return !!a.isError && (b.name === 'Error' || errName(a) === b.name);
        if (b.name === 'Function') return a.kind === 'function' || a.kind === 'builtin';
        return false;
      }
    }
    throw new Unsupported('Operator ' + op + ' isn\'t supported.', node);
  }

  function evalArgs(ctx, args, env) {
    const out = [];
    for (const a of args) {
      if (a.type === 'SpreadElement') out.push(...iterate(ctx, evaluate(ctx, a.argument, env), a.argument));
      else out.push(evaluate(ctx, a, env));
    }
    return out;
  }

  function evalCall(ctx, node, env) {
    const callee = node.callee;
    let fn, thisVal;
    if (callee.type === 'MemberExpression') {
      thisVal = evaluate(ctx, callee.object, env);
      if (callee.optional && thisVal == null) throw new ShortCircuit();
      const key = memberKey(ctx, callee, env);
      fn = getProp(ctx, thisVal, key, callee);
    } else {
      fn = evaluate(ctx, callee, env);
      thisVal = undefined;
    }
    if (node.optional && fn == null) throw new ShortCircuit();
    const args = evalArgs(ctx, node.arguments, env);
    ctx.lastNode = node;
    return callFunction(ctx, fn, thisVal, args, node);
  }

  function evalNew(ctx, node, env) {
    const C = evaluate(ctx, node.callee, env);
    const args = evalArgs(ctx, node.arguments, env);
    if (isObj(C) && C.kind === 'builtin' && C.construct) return C.construct(ctx, args, node);
    if (isObj(C) && C.kind === 'function' && !C.isArrow) {
      const o = newObject(ctx);
      const r = callFunction(ctx, C, o, args, node);
      return isObj(r) ? r : o;
    }
    throwError(ctx, 'TypeError', srcOf(ctx, node.callee) + ' is not a constructor');
  }

  // ---------- builtins ----------
  function callback(ctx, fn, thisArg, args, node, label) {
    const fr = { id: -1, callId: -1, name: label + ' (built-in)', env: null, baseEnv: null, builtin: true };
    ctx.stack.push(fr);
    try {
      emit(ctx, { rule: 'callback', builtin: label });
      return callFunction(ctx, fn, thisArg, args, node);
    } finally {
      const i = ctx.stack.lastIndexOf(fr);
      if (i >= 0) ctx.stack.splice(i, 1);
    }
  }
  function requireFn(ctx, f, node, label) {
    if (!isObj(f) || (f.kind !== 'function' && f.kind !== 'builtin')) throwError(ctx, 'TypeError', fmtTop(f) + ' is not a function');
  }
  function arr(ctx, t, name) {
    if (!isObj(t) || t.kind !== 'array') throwError(ctx, 'TypeError', name + ' called on a value that is not an array');
    return t;
  }
  function relIndex(n, len, dflt) {
    if (n === undefined) return dflt;
    n = Math.trunc(toNum(n)) || 0;
    if (n < 0) return Math.max(len + n, 0);
    return Math.min(n, len);
  }
  function sameValueZero(a, b) { return a === b || (typeof a === 'number' && typeof b === 'number' && a !== a && b !== b); }

  const ARRAY_METHODS = {
    push(ctx, t, a) { arr(ctx, t, 'push'); for (const v of a) { t.items.push(v); emit(ctx, { rule: 'mutate', id: t.id, key: String(t.items.length - 1), value: snapVal(v), grew: true, via: 'push' }); } return t.items.length; },
    pop(ctx, t) { arr(ctx, t, 'pop'); if (!t.items.length) return undefined; const v = t.items.pop(); emit(ctx, { rule: 'mutate', id: t.id, key: String(t.items.length), removed: true, via: 'pop' }); return v === HOLE ? undefined : v; },
    shift(ctx, t) { arr(ctx, t, 'shift'); if (!t.items.length) return undefined; const v = t.items.shift(); emit(ctx, { rule: 'mutate', id: t.id, key: '0', removed: true, via: 'shift' }); return v === HOLE ? undefined : v; },
    unshift(ctx, t, a) { arr(ctx, t, 'unshift'); t.items.unshift(...a); emit(ctx, { rule: 'mutate', id: t.id, key: '0', via: 'unshift' }); return t.items.length; },
    slice(ctx, t, a) { arr(ctx, t, 'slice'); const len = t.items.length; return newArray(ctx, t.items.slice(relIndex(a[0], len, 0), relIndex(a[1], len, len))); },
    splice(ctx, t, a) {
      arr(ctx, t, 'splice'); const len = t.items.length; const s = relIndex(a[0], len, 0);
      const dc = a.length < 2 ? len - s : Math.max(0, Math.min(Math.trunc(toNum(a[1])) || 0, len - s));
      const removed = t.items.splice(s, dc, ...a.slice(2));
      emit(ctx, { rule: 'mutate', id: t.id, key: String(s), via: 'splice' });
      return newArray(ctx, removed);
    },
    concat(ctx, t, a) { arr(ctx, t, 'concat'); const items = t.items.slice(); for (const x of a) { if (isObj(x) && x.kind === 'array') items.push(...x.items); else items.push(x); } return newArray(ctx, items); },
    indexOf(ctx, t, a) { arr(ctx, t, 'indexOf'); return t.items.findIndex(x => x !== HOLE && strictEq(x, a[0])); },
    lastIndexOf(ctx, t, a) { arr(ctx, t, 'lastIndexOf'); for (let i = t.items.length - 1; i >= 0; i--) if (t.items[i] !== HOLE && strictEq(t.items[i], a[0])) return i; return -1; },
    includes(ctx, t, a) { arr(ctx, t, 'includes'); return t.items.some(x => sameValueZero(x === HOLE ? undefined : x, a[0])); },
    join(ctx, t, a) { arr(ctx, t, 'join'); const sep = a[0] === undefined ? ',' : toStr(a[0]); return t.items.map(x => (x === HOLE || x == null) ? '' : toStr(x)).join(sep); },
    reverse(ctx, t) { arr(ctx, t, 'reverse'); t.items.reverse(); emit(ctx, { rule: 'mutate', id: t.id, key: '0', via: 'reverse' }); return t; },
    fill(ctx, t, a) {
      arr(ctx, t, 'fill'); const len = t.items.length; const s = relIndex(a[1], len, 0), e = relIndex(a[2], len, len);
      for (let i = s; i < e; i++) t.items[i] = a[0];
      emit(ctx, { rule: 'mutate', id: t.id, key: String(s), via: 'fill', value: snapVal(a[0]), count: e - s });
      return t;
    },
    at(ctx, t, a) { arr(ctx, t, 'at'); let i = Math.trunc(toNum(a[0])) || 0; if (i < 0) i += t.items.length; const v = t.items[i]; return v === HOLE ? undefined : v; },
    toString(ctx, t) { return toStr(t); },
    keys(ctx, t) { arr(ctx, t, 'keys'); return newArray(ctx, t.items.map((_, i) => i)); },
    entries(ctx, t) { arr(ctx, t, 'entries'); return newArray(ctx, t.items.map((x, i) => newArray(ctx, [i, x === HOLE ? undefined : x]))); },
    flat(ctx, t, a) {
      arr(ctx, t, 'flat'); const depth = a[0] === undefined ? 1 : toNum(a[0]);
      const go = (items, d) => { const out = []; for (const x of items) { if (x === HOLE) continue; if (d > 0 && isObj(x) && x.kind === 'array') out.push(...go(x.items, d - 1)); else out.push(x); } return out; };
      return newArray(ctx, go(t.items, depth));
    },
    forEach(ctx, t, a, node) { arr(ctx, t, 'forEach'); requireFn(ctx, a[0], node); for (let i = 0; i < t.items.length; i++) { if (t.items[i] === HOLE) continue; callback(ctx, a[0], a[1], [t.items[i], i, t], node, 'forEach'); } return undefined; },
    map(ctx, t, a, node) { arr(ctx, t, 'map'); requireFn(ctx, a[0], node); const out = newArray(ctx, []); for (let i = 0; i < t.items.length; i++) { if (t.items[i] === HOLE) { out.items[i] = HOLE; continue; } out.items[i] = callback(ctx, a[0], a[1], [t.items[i], i, t], node, 'map'); emit(ctx, { rule: 'mutate', id: out.id, key: String(i), via: 'map' }); } return out; },
    filter(ctx, t, a, node) { arr(ctx, t, 'filter'); requireFn(ctx, a[0], node); const out = newArray(ctx, []); for (let i = 0; i < t.items.length; i++) { if (t.items[i] === HOLE) continue; if (truthy(callback(ctx, a[0], a[1], [t.items[i], i, t], node, 'filter'))) { out.items.push(t.items[i]); emit(ctx, { rule: 'mutate', id: out.id, key: String(out.items.length - 1), via: 'filter' }); } } return out; },
    find(ctx, t, a, node) { arr(ctx, t, 'find'); requireFn(ctx, a[0], node); for (let i = 0; i < t.items.length; i++) { const v = t.items[i] === HOLE ? undefined : t.items[i]; if (truthy(callback(ctx, a[0], a[1], [v, i, t], node, 'find'))) return v; } return undefined; },
    findIndex(ctx, t, a, node) { arr(ctx, t, 'findIndex'); requireFn(ctx, a[0], node); for (let i = 0; i < t.items.length; i++) { const v = t.items[i] === HOLE ? undefined : t.items[i]; if (truthy(callback(ctx, a[0], a[1], [v, i, t], node, 'findIndex'))) return i; } return -1; },
    some(ctx, t, a, node) { arr(ctx, t, 'some'); requireFn(ctx, a[0], node); for (let i = 0; i < t.items.length; i++) { if (t.items[i] === HOLE) continue; if (truthy(callback(ctx, a[0], a[1], [t.items[i], i, t], node, 'some'))) return true; } return false; },
    every(ctx, t, a, node) { arr(ctx, t, 'every'); requireFn(ctx, a[0], node); for (let i = 0; i < t.items.length; i++) { if (t.items[i] === HOLE) continue; if (!truthy(callback(ctx, a[0], a[1], [t.items[i], i, t], node, 'every'))) return false; } return true; },
    reduce(ctx, t, a, node) {
      arr(ctx, t, 'reduce'); requireFn(ctx, a[0], node);
      const idx = []; t.items.forEach((x, i) => { if (x !== HOLE) idx.push(i); });
      let k = 0, acc;
      if (a.length >= 2) acc = a[1];
      else { if (!idx.length) throwError(ctx, 'TypeError', 'Reduce of empty array with no initial value'); acc = t.items[idx[0]]; k = 1; }
      for (; k < idx.length; k++) acc = callback(ctx, a[0], undefined, [acc, t.items[idx[k]], idx[k], t], node, 'reduce');
      return acc;
    },
    sort(ctx, t, a, node) {
      arr(ctx, t, 'sort');
      const vals = t.items.filter(x => x !== HOLE && x !== undefined);
      const undefCount = t.items.filter(x => x === undefined).length;
      const holes = t.items.length - vals.length - undefCount;
      const cmp = a[0] !== undefined ? ((x, y) => { const r = toNum(callback(ctx, a[0], undefined, [x, y], node, 'sort')); return r !== r ? 0 : r; })
        : ((x, y) => { const sx = toStr(x), sy = toStr(y); return sx < sy ? -1 : sx > sy ? 1 : 0; });
      // insertion-stable merge sort to keep callbacks deterministic
      const sorted = mergeSort(vals, cmp);
      t.items = sorted.concat(Array(undefCount).fill(undefined), Array(holes).fill(HOLE));
      emit(ctx, { rule: 'mutate', id: t.id, key: '0', via: 'sort' });
      return t;
    },
  };
  function mergeSort(a, cmp) {
    if (a.length <= 1) return a.slice();
    const m = a.length >> 1, l = mergeSort(a.slice(0, m), cmp), r = mergeSort(a.slice(m), cmp);
    const out = []; let i = 0, j = 0;
    while (i < l.length && j < r.length) { if (cmp(r[j], l[i]) < 0) out.push(r[j++]); else out.push(l[i++]); }
    return out.concat(l.slice(i), r.slice(j));
  }

  const STRING_METHODS = {
    toUpperCase: (c, t) => String(t).toUpperCase(),
    toLowerCase: (c, t) => String(t).toLowerCase(),
    trim: (c, t) => String(t).trim(),
    slice: (c, t, a) => String(t).slice(a[0] === undefined ? undefined : toNum(a[0]), a[1] === undefined ? undefined : toNum(a[1])),
    substring: (c, t, a) => String(t).substring(toNum(a[0]), a[1] === undefined ? undefined : toNum(a[1])),
    includes: (c, t, a) => String(t).includes(toStr(a[0])),
    startsWith: (c, t, a) => String(t).startsWith(toStr(a[0])),
    endsWith: (c, t, a) => String(t).endsWith(toStr(a[0])),
    indexOf: (c, t, a) => String(t).indexOf(toStr(a[0])),
    repeat: (c, t, a) => String(t).repeat(toNum(a[0])),
    padStart: (c, t, a) => String(t).padStart(toNum(a[0]), a[1] === undefined ? ' ' : toStr(a[1])),
    padEnd: (c, t, a) => String(t).padEnd(toNum(a[0]), a[1] === undefined ? ' ' : toStr(a[1])),
    charAt: (c, t, a) => String(t).charAt(a[0] === undefined ? 0 : toNum(a[0])),
    at: (c, t, a) => String(t).at(toNum(a[0])),
    concat: (c, t, a) => String(t).concat(...a.map(toStr)),
    replace: (c, t, a) => { if (isObj(a[1])) throw new Unsupported('replace with a function isn\'t supported.', null); return String(t).replace(toStr(a[0]), toStr(a[1])); },
    replaceAll: (c, t, a) => String(t).split(toStr(a[0])).join(toStr(a[1])),
    split: (c, t, a) => newArray(c, a[0] === undefined ? [String(t)] : String(t).split(toStr(a[0]))),
    toString: (c, t) => String(t),
  };
  const NUMBER_METHODS = {
    toFixed: (c, t, a) => Number(t).toFixed(a[0] === undefined ? 0 : toNum(a[0])),
    toString: (c, t, a) => Number(t).toString(a[0] === undefined ? 10 : toNum(a[0])),
  };
  const SET_METHODS = {
    add(ctx, t, a) { if (!t.values.some(x => sameValueZero(x, a[0]))) { t.values.push(a[0]); emit(ctx, { rule: 'mutate', id: t.id, key: String(t.values.length - 1), via: 'add' }); } return t; },
    has(ctx, t, a) { return t.values.some(x => sameValueZero(x, a[0])); },
    delete(ctx, t, a) { const i = t.values.findIndex(x => sameValueZero(x, a[0])); if (i < 0) return false; t.values.splice(i, 1); emit(ctx, { rule: 'mutate', id: t.id, key: String(i), via: 'delete' }); return true; },
    clear(ctx, t) { t.values = []; emit(ctx, { rule: 'mutate', id: t.id, key: '0', via: 'clear' }); },
    forEach(ctx, t, a, node) { for (const v of t.values.slice()) callback(ctx, a[0], undefined, [v, v, t], node, 'forEach'); },
  };
  const FUNCTION_METHODS = {
    call: (ctx, t, a, node) => callFunction(ctx, t, a[0], a.slice(1), node),
    apply: (ctx, t, a, node) => callFunction(ctx, t, a[0], isObj(a[1]) && a[1].kind === 'array' ? a[1].items.slice() : [], node),
    bind: (ctx, t, a) => { const b = new Obj(ctx, 'builtin'); b.name = 'bound ' + (t.name || ''); const target = t, thisArg = a[0], pre = a.slice(1); b.impl = (c, _t, args, node) => callFunction(c, target, thisArg, pre.concat(args), node); return b; },
  };

  function installBuiltins(ctx, env) {
    const def = (name, value) => env.vars.set(name, { value, decl: 'builtin', init: true, hidden: true });
    const bi = (name, impl, construct) => { const b = new Obj(ctx, 'builtin'); b.name = name; b.impl = impl; if (construct) b.construct = construct; return b; };
    const ns = (name, members) => { const o = new Obj(ctx, 'builtin'); o.name = name; o.impl = (c) => throwError(c, 'TypeError', name + ' is not a function'); for (const k in members) o.props.set(k, members[k]); return o; };

    const consoleLog = (c, t, a) => { const text = a.map(fmtTop).join(' '); c.output.push({ kind: 'log', text }); emit(c, { rule: 'output', text }); return undefined; };
    def('console', ns('console', {
      log: bi('console.log', consoleLog),
      info: bi('console.info', consoleLog),
      warn: bi('console.warn', consoleLog),
      error: bi('console.error', consoleLog),
      table: bi('console.table', (c, t, a) => {
        const v = a[0];
        const rows = [];
        if (isObj(v) && v.kind === 'array') v.items.forEach((row, i) => rows.push({ index: String(i), row }));
        else if (isObj(v) && v.kind === 'object') for (const [k, row] of orderedEntries(v.props)) rows.push({ index: k, row });
        else { const text = fmtTop(v); c.output.push({ kind: 'log', text }); emit(c, { rule: 'output', text }); return; }
        const cols = []; const table = rows.map(({ index, row }) => {
          const cells = {};
          if (isObj(row) && row.kind === 'array') row.items.forEach((x, j) => { const k = String(j); if (!cols.includes(k)) cols.push(k); cells[k] = x === HOLE ? '' : fmtInner(x, 1, new Set()); });
          else if (isObj(row) && row.kind === 'object') for (const [k, x] of orderedEntries(row.props)) { if (!cols.includes(k)) cols.push(k); cells[k] = fmtInner(x, 1, new Set()); }
          else { if (!cols.includes('Value')) cols.push('Value'); cells.Value = fmtInner(row, 1, new Set()); }
          return { index, cells };
        });
        const text = tableText(cols, table);
        c.output.push({ kind: 'table', text, cols, rows: table });
        emit(c, { rule: 'output', text: '(table)' });
      }),
    }));
    def('Math', ns('Math', {
      random: bi('Math.random', (c) => c.random()),
      floor: bi('Math.floor', (c, t, a) => Math.floor(toNum(a[0]))),
      ceil: bi('Math.ceil', (c, t, a) => Math.ceil(toNum(a[0]))),
      round: bi('Math.round', (c, t, a) => Math.round(toNum(a[0]))),
      trunc: bi('Math.trunc', (c, t, a) => Math.trunc(toNum(a[0]))),
      abs: bi('Math.abs', (c, t, a) => Math.abs(toNum(a[0]))),
      sign: bi('Math.sign', (c, t, a) => Math.sign(toNum(a[0]))),
      sqrt: bi('Math.sqrt', (c, t, a) => Math.sqrt(toNum(a[0]))),
      pow: bi('Math.pow', (c, t, a) => Math.pow(toNum(a[0]), toNum(a[1]))),
      max: bi('Math.max', (c, t, a) => Math.max(...a.map(toNum))),
      min: bi('Math.min', (c, t, a) => Math.min(...a.map(toNum))),
      hypot: bi('Math.hypot', (c, t, a) => Math.hypot(...a.map(toNum))),
      PI: Math.PI, E: Math.E,
    }));
    const arrayCtor = (c, a) => {
      if (a.length === 1 && typeof a[0] === 'number') {
        const n = a[0];
        if (!(Number.isInteger(n) && n >= 0 && n < 4294967296)) throwError(c, 'RangeError', 'Invalid array length');
        if (n > 100000) throw new Unsupported('Arrays longer than 100,000 aren\'t supported by the tracer.', null);
        return newArray(c, Array(n).fill(HOLE));
      }
      return newArray(c, a.slice());
    };
    const ArrayB = bi('Array', (c, t, a) => arrayCtor(c, a), (c, a) => arrayCtor(c, a));
    ArrayB.props.set('isArray', bi('Array.isArray', (c, t, a) => isObj(a[0]) && a[0].kind === 'array'));
    ArrayB.props.set('of', bi('Array.of', (c, t, a) => newArray(c, a.slice())));
    ArrayB.props.set('from', bi('Array.from', (c, t, a, node) => {
      const src = a[0], fn = a[1];
      let vals;
      if (isObj(src) && (src.kind === 'array' || src.kind === 'set') || typeof src === 'string') vals = iterate(c, src, node);
      else if (isObj(src)) { const len = toNum(getProp(c, src, 'length', node)) || 0; if (len > 100000) throw new Unsupported('Arrays longer than 100,000 aren\'t supported by the tracer.', node); vals = []; for (let i = 0; i < len; i++) vals.push(getProp(c, src, String(i), node)); }
      else vals = [];
      const out = newArray(c, []);
      for (let i = 0; i < vals.length; i++) {
        out.items.push(fn !== undefined ? callback(c, fn, undefined, [vals[i], i], node, 'Array.from') : vals[i]);
        if (fn !== undefined) emit(c, { rule: 'mutate', id: out.id, key: String(i), via: 'Array.from' });
      }
      return out;
    }));
    def('Array', ArrayB);
    const ObjectB = bi('Object', (c, t, a) => isObj(a[0]) ? a[0] : newObject(c), (c, a) => newObject(c));
    ObjectB.props.set('keys', bi('Object.keys', (c, t, a) => newArray(c, isObj(a[0]) ? ownKeys(a[0]) : (typeof a[0] === 'string' ? Object.keys(a[0]) : []))));
    ObjectB.props.set('values', bi('Object.values', (c, t, a) => newArray(c, isObj(a[0]) ? ownKeys(a[0]).map(k => getProp(c, a[0], k)) : [])));
    ObjectB.props.set('entries', bi('Object.entries', (c, t, a) => newArray(c, isObj(a[0]) ? ownKeys(a[0]).map(k => newArray(c, [k, getProp(c, a[0], k)])) : [])));
    ObjectB.props.set('assign', bi('Object.assign', (c, t, a) => { const tgt = a[0]; for (const s of a.slice(1)) if (isObj(s)) for (const k of ownKeys(s)) setProp(c, tgt, k, getProp(c, s, k)); return tgt; }));
    ObjectB.props.set('freeze', bi('Object.freeze', (c, t, a) => { if (isObj(a[0])) a[0].frozen = true; return a[0]; }));
    def('Object', ObjectB);
    const NumberB = bi('Number', (c, t, a) => a.length ? toNum(a[0]) : 0);
    NumberB.props.set('isInteger', bi('Number.isInteger', (c, t, a) => Number.isInteger(a[0])));
    NumberB.props.set('isNaN', bi('Number.isNaN', (c, t, a) => Number.isNaN(a[0])));
    NumberB.props.set('parseInt', bi('Number.parseInt', (c, t, a) => parseInt(toStr(a[0]), a[1] === undefined ? undefined : toNum(a[1]))));
    NumberB.props.set('MAX_SAFE_INTEGER', Number.MAX_SAFE_INTEGER);
    NumberB.props.set('MIN_SAFE_INTEGER', Number.MIN_SAFE_INTEGER);
    def('Number', NumberB);
    def('String', bi('String', (c, t, a) => a.length ? toStr(a[0]) : ''));
    def('Boolean', bi('Boolean', (c, t, a) => truthy(a[0])));
    def('parseInt', bi('parseInt', (c, t, a) => parseInt(toStr(a[0]), a[1] === undefined ? undefined : toNum(a[1]))));
    def('parseFloat', bi('parseFloat', (c, t, a) => parseFloat(toStr(a[0]))));
    def('isNaN', bi('isNaN', (c, t, a) => isNaN(toNum(a[0]))));
    def('NaN', NaN); def('Infinity', Infinity);
    const SetB = bi('Set', (c) => throwError(c, 'TypeError', "Constructor Set requires 'new'"), (c, a) => {
      const s = new Obj(c, 'set'); emit(c, { rule: 'create', id: s.id, kind: 'set' });
      if (a[0] !== undefined && a[0] !== null) for (const v of iterate(c, a[0], null)) if (!s.values.some(x => sameValueZero(x, v))) s.values.push(v);
      return s;
    });
    def('Set', SetB);
    const errCtor = (name) => bi(name, (c, t, a) => newError(c, name, a[0] === undefined ? '' : toStr(a[0])), (c, a) => newError(c, name, a[0] === undefined ? '' : toStr(a[0])));
    ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError'].forEach(n => def(n, errCtor(n)));
    def('JSON', ns('JSON', {
      stringify: bi('JSON.stringify', (c, t, a) => jsonStringify(a[0], a[2])),
      parse: bi('JSON.parse', (c, t, a) => { let v; try { v = JSON.parse(toStr(a[0])); } catch (e) { throwError(c, 'SyntaxError', e.message); } return fromNative(c, v); }),
    }));
    for (const name of ['document', 'window', 'setTimeout', 'setInterval', 'fetch', 'localStorage', 'alert', 'prompt', 'requestAnimationFrame', 'addEventListener', 'Promise', 'Map', 'WeakMap', 'Symbol', 'Date']) {
      def(name, bi(name, (c, t, a, node) => { throw new Unsupported(name + ' isn\'t available in the tracer yet. The browser units add the DOM, timers and async.', node); },
        (c, a, node) => { throw new Unsupported(name + ' isn\'t available in the tracer yet.', node); }));
    }
    function fromNative(c, v) {
      if (Array.isArray(v)) return newArray(c, v.map(x => fromNative(c, x)));
      if (v && typeof v === 'object') { const o = newObject(c); for (const k of Object.keys(v)) o.props.set(k, fromNative(c, v[k])); return o; }
      return v;
    }
    function toNative(v, seen) {
      if (!isObj(v)) return v;
      if (seen.has(v)) throwError(ctx, 'TypeError', 'Converting circular structure to JSON');
      seen.add(v);
      let r;
      if (v.kind === 'array') r = v.items.map(x => { const n = toNative(x === HOLE ? null : x, seen); return n === undefined || (isObj(x) && (x.kind === 'function' || x.kind === 'builtin')) ? null : n; });
      else if (v.kind === 'function' || v.kind === 'builtin') r = undefined;
      else if (v.kind === 'set') r = {};
      else { r = {}; for (const [k, x] of orderedEntries(v.props)) { if (isObj(x) && (x.kind === 'function' || x.kind === 'builtin')) continue; const n = toNative(x, seen); if (n !== undefined) r[k] = n; } }
      seen.delete(v);
      return r;
    }
    function jsonStringify(v, indent) { const n = toNative(v, new Set()); return JSON.stringify(n, null, indent === undefined ? undefined : (typeof indent === 'number' ? indent : toStr(indent))); }
  }

  function tableText(cols, rows) {
    const head = ['(index)'].concat(cols);
    const lines = [head.join('\t')];
    for (const r of rows) lines.push([r.index].concat(cols.map(c => r.cells[c] === undefined ? '' : r.cells[c])).join('\t'));
    return lines.join('\n');
  }

  // ---------- step descriptions (rule sentences) ----------
  function addrOf(id, snap) { return 'a' + id; }
  function valText(v) {
    if (!v) return '';
    if (v.k === 'p') return v.s;
    if (v.k === 'r') return 'the address a' + v.id;
    if (v.k === 'hole') return 'an empty slot';
    if (v.k === 'u') return 'uninitialized';
    if (v.k === 'bi') return v.s;
    return '';
  }
  function referrers(snap, id) {
    const out = [];
    for (const fr of snap.frames) for (const e of fr.envs) for (const b of e.bindings) if (b.v.k === 'r' && b.v.id === id) out.push(b.name);
    for (const e of snap.captured) for (const b of e.bindings) if (b.v.k === 'r' && b.v.id === id) out.push(b.name);
    for (const o of snap.heap) {
      if (o.items) o.items.forEach((x, i) => { if (x.k === 'r' && x.id === id) out.push('a' + o.id + '[' + i + ']'); });
      if (o.props) o.props.forEach(p => { if (p.v.k === 'r' && p.v.id === id) out.push('a' + o.id + '.' + p.key); });
    }
    return out;
  }
  function describe(step) {
    const lines = [];
    const snap = step.snap;
    for (const ev of step.events) {
      switch (ev.rule) {
        case 'start': lines.push({ rule: 'Hoisting', text: 'Before the first line runs, every function declaration has already been created, and every name declared with let or const already has an entry in its frame, which stays uninitialized until the line that declares it runs.' }); break;
        case 'end': lines.push({ rule: 'Done', text: 'The program has finished running.' }); break;
        case 'declare': {
          const held = ev.value.k === 'r' ? 'the address a' + ev.value.id : valText(ev.value);
          lines.push({ rule: 'New name', text: 'The ' + (ev.decl || 'var') + ' declaration gives ' + ev.name + ' an entry in the current frame, and that entry now holds ' + held + '.' });
          break;
        }
        case 'param': lines.push({ rule: 'Call copies values', text: 'The parameter ' + ev.name + ' receives a copy of the argument, ' + valText(ev.value) + '.' + (ev.value.k === 'r' ? ' Because the copy is an address, ' + ev.name + ' points to the caller\'s object, so changes this function makes to that object are visible to the caller.' : '') }); break;
        case 'reassign': lines.push({ rule: 'Reassignment', text: ev.name + ' was reassigned from ' + valText(ev.old) + ' to ' + valText(ev.value) + '. This changed ' + ev.name + '\'s entry in its frame and left every object in the heap as it was.' }); break;
        case 'mutate': {
          if (ev.via === 'fill' && ev.value && ev.value.k === 'r') { lines.push({ rule: 'Mutation', text: 'fill copied the address a' + ev.value.id + ' into ' + ev.count + ' slots of a' + ev.id + ', so all of those slots point to the same object.' }); break; }
          const who = referrers(snap, ev.id);
          let t;
          if (ev.via === 'push') t = 'push added a new element at index ' + ev.key + ' of a' + ev.id + ', which mutates that array.';
          else if (ev.via === 'pop' || ev.via === 'shift') t = ev.via + ' removed an element from a' + ev.id + ', which mutates that array.';
          else if (ev.via && ['map', 'filter', 'Array.from'].includes(ev.via)) t = ev.via + ' stored its next result at index ' + ev.key + ' of the new array a' + ev.id + '.';
          else if (ev.via) t = ev.via + ' changed a' + ev.id + ' in place.';
          else if (ev.deleted) t = 'delete removed the key ' + ev.key + ' from a' + ev.id + '.';
          else t = 'This line mutated a' + ev.id + ', changing its entry ' + ev.key + ' from ' + valText(ev.old) + ' to ' + valText(ev.value) + '.';
          if (who.length > 1 && !(ev.via && ['map', 'filter', 'Array.from'].includes(ev.via))) {
            const nWord = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'][who.length] || String(who.length);
            const list = who.length === 2 ? who.join(' and ') : who.slice(0, -1).join(', ') + ' and ' + who[who.length - 1];
            t += ' ' + nWord + ' references point to a' + ev.id + ' (' + list + '), and all of them see the change.';
          }
          lines.push({ rule: 'Mutation', text: t });
          break;
        }
        case 'create': lines.push({ rule: 'New object', text: 'A new ' + ev.kind + ' is created in the heap at the address a' + ev.id + '.', minor: true }); break;
        case 'closure': lines.push({ rule: 'Closure', text: 'The function a' + ev.id + (ev.name ? ' (' + ev.name + ')' : '') + ' keeps a link to the frame it was created in, ' + ev.envLabel + ', which makes it a closure.' }); break;
        case 'fn-create': lines.push({ rule: 'New function', text: 'A new function' + (ev.name ? ', ' + ev.name + ',' : '') + ' is created in the heap at the address a' + ev.id + '.', minor: true }); break;
        case 'call': lines.push({ rule: 'Call', text: 'Calling ' + ev.fn + ' puts a new frame on top of the stack and copies each argument\'s value into the matching parameter.' }); break;
        case 'return': lines.push({ rule: 'Return', text: ev.fn + ' returns ' + valText(ev.value) + (ev.implicit ? ', because it reached its end without a return statement' : '') + ', and its frame is about to be removed from the stack.' }); break;
        case 'popped': {
          const kept = snap.captured.find(e => e.callId === ev.callId);
          if (kept) lines.push({ rule: 'Kept alive', text: ev.fn + '\'s call has ended and its frame has left the stack, but a closure still links to that frame, so it stays alive and is drawn next to the objects.' });
          break;
        }
        case 'branch': lines.push({ rule: 'Branch', text: 'The condition evaluates to ' + valText(ev.value) + (ev.isBool ? '' : ', which counts as ' + (ev.result ? 'true' : 'false')) + ', so ' + (ev.result ? 'the if-branch runs.' : (ev.hasElse ? 'the else-branch runs.' : 'the block is skipped.')) }); break;
        case 'loop-test': lines.push({ rule: 'Loop test', text: ev.result ? 'The loop condition is true, so the body runs' + (ev.perIter ? ' for pass ' + ev.pass : '') + '.' : 'The loop condition is false, so the loop ends.' }); break;
        case 'iter-copy': lines.push({ rule: 'New pass, new copy', text: 'A for (let …) loop gives each pass its own copy of the loop variable, so pass ' + ev.pass + ' starts with a new copy holding the values from the end of the previous pass.' }); break;
        case 'iter-next': lines.push({ rule: 'Next value', text: 'The loop variable receives the next ' + (ev.kind === 'ForInStatement' ? 'key' : 'value') + ', ' + valText(ev.value) + ', for pass ' + ev.pass + '.' }); break;
        case 'iter-done': lines.push({ rule: 'Loop done', text: 'No values are left, so the loop ends.' }); break;
        case 'break': lines.push({ rule: 'break', text: 'break leaves the nearest enclosing loop immediately.' }); break;
        case 'continue': lines.push({ rule: 'continue', text: 'continue skips the rest of this pass and moves on to the next one.' }); break;
        case 'wrapper': lines.push({ rule: 'Primitive wrapper', text: valText(ev.prim) + ' is a primitive, so reading its .' + ev.key + ' property creates a temporary wrapper object, reads the property from it, and then discards the wrapper.', minor: true }); break;
        case 'coerce': {
          let t;
          if (ev.op === 'unary+') t = 'Unary + converts ' + valText(ev.from) + ' to the number ' + valText(ev.to) + '.';
          else if (ev.op === '+') t = 'Because one side of + is a string, the other side is converted to a string and the two are joined as text.';
          else if (ev.op === '==') t = '== converts ' + valText(ev.a) + ' and ' + valText(ev.b) + ' to a common type before comparing them, which === never does.';
          else t = ev.op + ' converts both sides to numbers before comparing them.';
          lines.push({ rule: 'Conversion', text: t });
          break;
        }
        case 'output': lines.push({ rule: 'Output', text: 'console.log printed ' + ev.text + '.', minor: true }); break;
        case 'callback': lines.push({ rule: 'Callback', text: ev.builtin + ' calls your function for the next element.', minor: true }); break;
        case 'tdz': lines.push({ rule: 'Temporal dead zone', text: ev.name + ' is in its temporal dead zone, meaning it has an entry in its frame but the let or const line that declares it hasn\'t run yet.' }); break;
        case 'error': lines.push({ rule: 'Error', text: 'This line threw ' + ev.text + ', and nothing caught it, so the program stopped.' }); break;
        case 'catch': lines.push({ rule: 'Caught', text: 'The catch block caught the error and received ' + valText(ev.value) + '.' }); break;
        case 'implicit-global': lines.push({ rule: 'Implicit global', text: ev.name + ' was never declared, so assigning to it created a global variable without any warning. Declaring names with let or const prevents this.' }); break;
        case 'hoist-var': case 'hoist-fn': break;
      }
    }
    return lines;
  }

  const api = { run, describe, makeRandom, fmtTop, HOLE };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Tracer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
