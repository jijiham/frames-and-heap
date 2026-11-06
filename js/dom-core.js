/* A small DOM for the practice pages. The artifact's security rules don't allow running your code in the page
   itself, so your code runs in a Web Worker against this DOM, the worker sends the finished tree to the page to be
   drawn, and clicks on the drawing are sent back as events. It covers what the Stage 2 items use: creating and
   attaching elements, text, classes, data attributes, inline styles, simple selectors and event bubbling.
   DomFactory is turned into source text and rebuilt inside the worker, so it must not refer to anything outside. */
function DomFactory() {
  'use strict';
  let nextNid = 1;
  const byNid = new Map();
  const kebab = (s) => String(s).replace(/[A-Z]/g, m => '-' + m.toLowerCase());
  const camel = (s) => String(s).replace(/-([a-z])/g, (m, c) => c.toUpperCase());

  class TextNode {
    constructor(t) { this.nodeType = 3; this.data = String(t); this.parentNode = null; }
    get textContent() { return this.data; }
    set textContent(v) { this.data = String(v); }
    get nodeValue() { return this.data; }
    remove() { if (this.parentNode) this.parentNode._detach(this); }
  }

  class ClassList {
    constructor(el) { this._el = el; }
    _get() { return (this._el._attrs.class || '').split(/\s+/).filter(Boolean); }
    _set(a) { this._el._attrs.class = a.join(' '); }
    add(...names) { const a = this._get(); for (const x of names) if (!a.includes(String(x))) a.push(String(x)); this._set(a); }
    remove(...names) { const n = names.map(String); this._set(this._get().filter(x => !n.includes(x))); }
    contains(name) { return this._get().includes(String(name)); }
    toggle(name, force) {
      const has = this.contains(name);
      const want = force === undefined ? !has : !!force;
      if (want && !has) this.add(name);
      if (!want && has) this.remove(name);
      return want;
    }
    replace(a, b) { if (!this.contains(a)) return false; this._set(this._get().map(x => x === a ? String(b) : x)); return true; }
    get length() { return this._get().length; }
    get value() { return this._el._attrs.class || ''; }
    item(i) { const a = this._get(); return i < a.length ? a[i] : null; }
    forEach(fn) { this._get().forEach(fn); }
    toString() { return this.value; }
    [Symbol.iterator]() { return this._get()[Symbol.iterator](); }
  }

  // Selectors: comma lists of compound selectors (tag, #id, .class, [attr], [attr="value"]) joined by spaces.
  function parseCompound(s) {
    const m = s.match(/^([a-zA-Z][\w-]*|\*)?((?:[#.][\w-]+|\[[^\]]+\])*)$/);
    if (!m) throw new SyntaxError("Failed to execute 'querySelector' on 'Document': '" + s + "' is not a valid selector here. Use a tag, #id, .class or [attribute] selector.");
    const parts = { tag: m[1] && m[1] !== '*' ? m[1].toUpperCase() : null, id: null, classes: [], attrs: [] };
    const re = /([#.])([\w-]+)|\[([^\]=\s]+)\s*(?:=\s*"?([^"\]]*)"?)?\]/g;
    let t;
    while ((t = re.exec(m[2] || ''))) {
      if (t[1] === '#') parts.id = t[2];
      else if (t[1] === '.') parts.classes.push(t[2]);
      else parts.attrs.push([t[3].toLowerCase(), t[4]]);
    }
    return parts;
  }
  function matchCompound(el, p) {
    if (!el || el.nodeType !== 1) return false;
    if (p.tag && el.tagName !== p.tag) return false;
    if (p.id && el._attrs.id !== p.id) return false;
    for (const c of p.classes) if (!el.classList.contains(c)) return false;
    for (const [k, v] of p.attrs) { if (!(k in el._attrs)) return false; if (v !== undefined && el._attrs[k] !== v) return false; }
    return true;
  }
  function matches(el, selector) {
    return String(selector).split(',').some(group => {
      const chain = group.trim().split(/\s+/).map(parseCompound);
      if (!matchCompound(el, chain[chain.length - 1])) return false;
      let node = el.parentNode;
      for (let i = chain.length - 2; i >= 0; i--) {
        while (node && !matchCompound(node, chain[i])) node = node.parentNode;
        if (!node) return false;
        node = node.parentNode;
      }
      return true;
    });
  }
  function descendants(el, out) {
    for (const n of el._nodes) if (n.nodeType === 1) { out.push(n); descendants(n, out); }
    return out;
  }

  class Element {
    constructor(tag, doc) {
      this.nodeType = 1;
      this.tagName = String(tag).toUpperCase();
      this.ownerDocument = doc;
      this.parentNode = null;
      this._nodes = [];
      this._attrs = {};
      this._listeners = {};
      this._on = {};
      this._style = {};
      this._nid = nextNid++;
      byNid.set(this._nid, this);
      this.classList = new ClassList(this);
      const self = this;
      const st = this._style;
      this.style = new Proxy(st, {
        get(o, k) {
          if (k === 'cssText') return Object.keys(o).map(p => kebab(p) + ': ' + o[p]).join('; ');
          if (k === 'setProperty') return (p, v) => { o[camel(p)] = String(v); };
          if (k === 'removeProperty') return (p) => { delete o[camel(p)]; };
          if (k === 'getPropertyValue') return (p) => o[camel(p)] || '';
          return typeof k === 'string' ? (o[k] === undefined ? '' : o[k]) : undefined;
        },
        set(o, k, v) {
          if (k === 'cssText') { for (const p of Object.keys(o)) delete o[p]; String(v).split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) o[camel(d.slice(0, i).trim())] = d.slice(i + 1).trim(); }); return true; }
          if (v === '' || v == null) delete o[k]; else o[k] = String(v);
          return true;
        },
      });
      const dkey = (k) => 'data-' + kebab(k);
      this.dataset = new Proxy({}, {
        get(o, k) { return typeof k === 'string' ? self._attrs[dkey(k)] : undefined; },
        set(o, k, v) { self._attrs[dkey(k)] = String(v); return true; },
        deleteProperty(o, k) { delete self._attrs[dkey(k)]; return true; },
        has(o, k) { return dkey(k) in self._attrs; },
        ownKeys() { return Object.keys(self._attrs).filter(a => a.startsWith('data-')).map(a => camel(a.slice(5))); },
        getOwnPropertyDescriptor(o, k) { const a = dkey(k); return a in self._attrs ? { enumerable: true, configurable: true, writable: true, value: self._attrs[a] } : undefined; },
      });
    }
    get __display() {
      let s = '<' + this.tagName.toLowerCase();
      if (this._attrs.id) s += ' id="' + this._attrs.id + '"';
      if (this._attrs.class) s += ' class="' + this._attrs.class + '"';
      return s + '>';
    }
    get nodeName() { return this.tagName; }
    get localName() { return this.tagName.toLowerCase(); }
    get id() { return this._attrs.id || ''; }
    set id(v) { this._attrs.id = String(v); }
    get className() { return this._attrs.class || ''; }
    set className(v) { this._attrs.class = String(v); }
    get title() { return this._attrs.title || ''; }
    set title(v) { this._attrs.title = String(v); }
    // Form controls: an input's current value and checked state live on the element, apart from its attributes.
    get value() { return this._value !== undefined ? this._value : (this._attrs.value || ''); }
    set value(v) { this._value = String(v); }
    get checked() { return this._checked !== undefined ? this._checked : 'checked' in this._attrs; }
    set checked(v) { this._checked = !!v; }
    get type() { return this._attrs.type || (this.tagName === 'INPUT' ? 'text' : this.tagName === 'BUTTON' ? 'submit' : ''); }
    set type(v) { this._attrs.type = String(v); }
    get placeholder() { return this._attrs.placeholder || ''; }
    set placeholder(v) { this._attrs.placeholder = String(v); }
    get name() { return this._attrs.name || ''; }
    set name(v) { this._attrs.name = String(v); }
    get disabled() { return 'disabled' in this._attrs; }
    set disabled(v) { if (v) this._attrs.disabled = ''; else delete this._attrs.disabled; }
    get form() { for (let n = this.parentNode; n && n.nodeType === 1; n = n.parentNode) if (n.tagName === 'FORM') return n; return null; }
    reset() { for (const el of descendants(this, [])) { el._value = undefined; el._checked = undefined; } }
    get children() { return this._nodes.filter(n => n.nodeType === 1); }
    get childNodes() { return this._nodes.slice(); }
    get childElementCount() { return this.children.length; }
    get firstChild() { return this._nodes[0] || null; }
    get lastChild() { return this._nodes[this._nodes.length - 1] || null; }
    get firstElementChild() { return this.children[0] || null; }
    get lastElementChild() { const c = this.children; return c[c.length - 1] || null; }
    get parentElement() { return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null; }
    get nextElementSibling() { if (!this.parentNode) return null; const c = this.parentNode.children; return c[c.indexOf(this) + 1] || null; }
    get previousElementSibling() { if (!this.parentNode) return null; const c = this.parentNode.children; return c[c.indexOf(this) - 1] || null; }
    get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n.nodeType === 9; }
    get textContent() { return this._nodes.map(n => n.textContent).join(''); }
    set textContent(v) { this._clear(); if (v !== '' && v != null) this._push(new TextNode(v)); }
    get innerText() { return this.textContent; }
    set innerText(v) { this.textContent = v; }
    get innerHTML() { return this._nodes.map(n => n.nodeType === 3 ? n.data : n.outerHTML).join(''); }
    set innerHTML(v) {
      v = String(v);
      if (/[<>&]/.test(v)) throw new Error('This practice page supports innerHTML only for plain text or an empty string. Build elements with document.createElement instead.');
      this.textContent = v;
    }
    get outerHTML() {
      const t = this.tagName.toLowerCase();
      const attrs = Object.keys(this._attrs).map(k => ' ' + k + '="' + this._attrs[k] + '"').join('');
      const style = Object.keys(this._style).length ? ' style="' + this.style.cssText + '"' : '';
      return '<' + t + attrs + style + '>' + this.innerHTML + '</' + t + '>';
    }
    _clear() { for (const n of this._nodes) n.parentNode = null; this._nodes = []; }
    _push(n) {
      for (let a = this; a; a = a.parentNode) if (a === n) throw new Error("Failed to execute 'appendChild' on 'Node': The new child element contains the parent.");
      if (n.parentNode) n.parentNode._detach(n);
      n.parentNode = this;
      this._nodes.push(n);
    }
    _detach(n) { const i = this._nodes.indexOf(n); if (i >= 0) this._nodes.splice(i, 1); n.parentNode = null; }
    _node(x) { return x && (x.nodeType === 1 || x.nodeType === 3) ? x : new TextNode(x); }
    appendChild(n) {
      if (!n || !(n.nodeType === 1 || n.nodeType === 3)) throw new TypeError("Failed to execute 'appendChild' on 'Node': parameter 1 is not of type 'Node'.");
      this._push(n);
      return n;
    }
    append(...nodes) { for (const n of nodes) this._push(this._node(n)); }
    prepend(...nodes) {
      for (const x of nodes.slice().reverse()) { const n = this._node(x); if (n.parentNode) n.parentNode._detach(n); n.parentNode = this; this._nodes.unshift(n); }
    }
    insertBefore(n, ref) {
      if (ref == null) return this.appendChild(n);
      const i = this._nodes.indexOf(ref);
      if (i < 0) throw new Error("Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.");
      if (n.parentNode) n.parentNode._detach(n);
      n.parentNode = this;
      this._nodes.splice(this._nodes.indexOf(ref), 0, n);
      return n;
    }
    removeChild(n) {
      if (!n || n.parentNode !== this) throw new Error("Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.");
      this._detach(n);
      return n;
    }
    replaceChild(n, old) { this.insertBefore(n, old); this.removeChild(old); return old; }
    remove() { if (this.parentNode) this.parentNode._detach(this); }
    replaceChildren(...nodes) { this._clear(); this.append(...nodes); }
    replaceWith(...nodes) { const p = this.parentNode; if (!p) return; for (const x of nodes) p.insertBefore(this._node(x), this); p._detach(this); }
    contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
    hasChildNodes() { return this._nodes.length > 0; }
    setAttribute(k, v) { this._attrs[String(k).toLowerCase()] = String(v); }
    getAttribute(k) { const v = this._attrs[String(k).toLowerCase()]; return v === undefined ? null : v; }
    hasAttribute(k) { return String(k).toLowerCase() in this._attrs; }
    removeAttribute(k) { delete this._attrs[String(k).toLowerCase()]; }
    toggleAttribute(k, force) { const has = this.hasAttribute(k); const want = force === undefined ? !has : !!force; if (want) this._attrs[String(k).toLowerCase()] = ''; else this.removeAttribute(k); return want; }
    matches(sel) { return matches(this, sel); }
    closest(sel) { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (matches(n, sel)) return n; return null; }
    querySelector(sel) { return descendants(this, []).find(n => matches(n, sel)) || null; }
    querySelectorAll(sel) { return descendants(this, []).filter(n => matches(n, sel)); }
    getElementsByClassName(c) { return descendants(this, []).filter(n => n.classList.contains(c)); }
    getElementsByTagName(t) { t = String(t).toUpperCase(); return descendants(this, []).filter(n => t === '*' || n.tagName === t); }
    addEventListener(type, fn) { if (typeof fn !== 'function') return; const l = this._listeners[type] || (this._listeners[type] = []); if (!l.includes(fn)) l.push(fn); }
    removeEventListener(type, fn) { const l = this._listeners[type]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } }
    get onclick() { return this._on.click || null; }
    set onclick(fn) { this._on.click = typeof fn === 'function' ? fn : null; }
    get oncontextmenu() { return this._on.contextmenu || null; }
    set oncontextmenu(fn) { this._on.contextmenu = typeof fn === 'function' ? fn : null; }
    get onsubmit() { return this._on.submit || null; }
    set onsubmit(fn) { this._on.submit = typeof fn === 'function' ? fn : null; }
    get oninput() { return this._on.input || null; }
    set oninput(fn) { this._on.input = typeof fn === 'function' ? fn : null; }
    get onchange() { return this._on.change || null; }
    set onchange(fn) { this._on.change = typeof fn === 'function' ? fn : null; }
    get onkeydown() { return this._on.keydown || null; }
    set onkeydown(fn) { this._on.keydown = typeof fn === 'function' ? fn : null; }
    requestSubmit() { dispatch(this, 'submit', {}); }
    click() { dispatch(this, 'click', { button: 0 }); }
    dispatchEvent(e) { return dispatch(this, e.type, e); }
    focus() {}
    blur() {}
  }

  // Besides calling listeners along the bubbling path, a click does what the browser would: it toggles a checkbox
  // (and fires change), and a click on a submit button inside a form fires submit on the form.
  function dispatch(target, type, init) {
    init = init || {};
    const box = type === 'click' && target.tagName === 'INPUT' && (target.type === 'checkbox' || target.type === 'radio');
    if (box) target.checked = target.type === 'radio' ? true : !target.checked;
    const ev = fire(target, type, init);
    if (box) { if (ev.defaultPrevented) target.checked = !target.checked; else { fire(target, 'input', {}); fire(target, 'change', {}); } }
    if (type === 'click' && !ev.defaultPrevented && target.tagName === 'BUTTON' && target.type === 'submit' && target.form) fire(target.form, 'submit', {});
    return ev;
  }
  function fire(target, type, init) {
    const ev = {
      type, target, currentTarget: null, bubbles: true, button: init.button || 0, key: init.key, defaultPrevented: false, _stop: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this._stop = true; },
      stopImmediatePropagation() { this._stop = true; },
    };
    const path = [];
    for (let n = target; n; n = n.parentNode) path.push(n);
    for (const node of path) {
      ev.currentTarget = node;
      const fns = (node._listeners[type] || []).slice();
      if (node._on && node._on[type]) fns.push(node._on[type]);
      for (const fn of fns) fn.call(node, ev);
      if (ev._stop) break;
    }
    ev.currentTarget = null;
    return ev;
  }

  function makeDocument() {
    const doc = { nodeType: 9, _listeners: {}, _on: {}, parentNode: null, _nodes: [] };
    const html = new Element('html', doc);
    const head = new Element('head', doc);
    const body = new Element('body', doc);
    html.appendChild(head); html.appendChild(body);
    html.parentNode = doc; doc._nodes = [html];
    doc.documentElement = html; doc.head = head; doc.body = body;
    doc.title = '';
    doc.createElement = (t) => new Element(t, doc);
    doc.createTextNode = (t) => new TextNode(t);
    doc.getElementById = (id) => descendants(html, []).find(n => n._attrs.id === String(id)) || null;
    doc.querySelector = (s) => html.matches(s) ? html : html.querySelector(s);
    doc.querySelectorAll = (s) => html.querySelectorAll(s);
    doc.getElementsByClassName = (c) => html.getElementsByClassName(c);
    doc.getElementsByTagName = (t) => html.getElementsByTagName(t);
    doc.addEventListener = (type, fn) => { const l = doc._listeners[type] || (doc._listeners[type] = []); if (!l.includes(fn)) l.push(fn); };
    doc.removeEventListener = (type, fn) => { const l = doc._listeners[type]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } };
    return doc;
  }

  // The tree sent to the page: n is the node's id for routing events back, t the tag, a the attributes, s the styles.
  function serialize(el, budget) {
    budget = budget || { left: 4000 };
    if (budget.left-- <= 0) return { x: '' };
    if (el.nodeType === 3) return { x: el.data };
    const out = { n: el._nid, t: el.tagName.toLowerCase(), a: Object.assign({}, el._attrs), s: Object.assign({}, el._style), k: el._nodes.map(c => serialize(c, budget)) };
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') { out.v = el.value; out.c = el.checked; }
    return out;
  }
  const listenerCount = (el, type) => ((el._listeners || {})[type] || []).length + (el._on && el._on[type] ? 1 : 0);

  return { makeDocument, serialize, dispatch, byNid: (id) => byNid.get(id) || null, listenerCount, Element };
}
(function (root) {
  root.DomCore = { factorySource: DomFactory.toString() };
  if (typeof module !== 'undefined' && module.exports) module.exports = DomFactory;
})(typeof globalThis !== 'undefined' ? globalThis : this);
