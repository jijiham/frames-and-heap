/* Draws the page tree that the practice DOM sends from the worker, inside a shadow root so the page's own classes
   (cell, board, row) can't clash with the site's styles. Elements are reused between updates by their id in the
   worker, so a text box you are typing in keeps its focus while the page redraws. Clicks, right-clicks, typing,
   Enter in a form and key presses are sent back to the worker as events. Only a fixed set of tags, attributes and
   style properties is drawn. */
(function (root) {
  'use strict';
  const STYLE = [
    ':host { display: block; outline: none; }',
    '.page-root { font: 14px/1.4 var(--font-body); color: var(--strong); min-height: 28px; }',
    '.board, .grid { display: grid; grid-template-columns: repeat(9, 28px); gap: 2px; width: max-content; margin: 0 0 8px; }',
    '.row { display: flex; gap: 2px; margin: 0 0 2px; }',
    '.cell { width: 28px; height: 28px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; background: var(--side); border: 1px solid var(--rule); font: 13px var(--font-code); color: var(--strong); cursor: pointer; user-select: none; }',
    '.cell.revealed { background: var(--bg); cursor: default; }',
    '.cell.mine { color: var(--bad); font-weight: 700; }',
    '.cell.flag { color: var(--warn); font-weight: 700; }',
    '.cell.alive, .cell.snake, .cell.player, .cell.on { background: var(--strong); }',
    '.cell.head { background: var(--accent); }',
    '.cell.food { background: var(--bad); }',
    '.cell.x, .cell.o { font-weight: 700; }',
    'button { font: inherit; padding: 3px 10px; border: 1px solid var(--rule); background: var(--side); color: var(--strong); border-radius: 2px; cursor: pointer; margin: 0 6px 6px 0; }',
    'input[type=text], input:not([type]), textarea { font: inherit; padding: 3px 6px; border: 1px solid var(--rule); background: var(--input); color: var(--input-fg); margin: 0 6px 6px 0; }',
    'ul { padding-left: 20px; margin: 0 0 8px; }',
    'li.done span { text-decoration: line-through; color: var(--fg); }',
    'p { margin: 0 0 8px; }',
    'h1, h2, h3 { margin: 0 0 8px; font-weight: 600; }',
  ].join('\n');
  const TAGS = new Set(['div', 'span', 'p', 'button', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'section', 'main', 'header', 'footer', 'nav', 'article', 'aside', 'strong', 'em', 'b', 'i', 'small', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'label', 'pre', 'code', 'br', 'hr', 'form', 'input', 'textarea', 'select', 'option']);
  const ATTRS = /^(id|class|title|role|placeholder|name|for|value|min|max|step|aria-[a-z-]+|data-[a-z0-9-]+)$/;
  const PROP = /^[a-z-]+$/;
  const BAD_VALUE = /url\s*\(|expression\s*\(|javascript:/i;
  const KEYS_TO_KEEP = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']);

  function mount(host, send) {
    host.tabIndex = 0;
    const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = STYLE;
    const page = document.createElement('div');
    page.className = 'page-root';
    shadow.append(style, page);
    let byNid = new Map();
    const nidOf = (el) => { for (const [n, e] of byNid) if (e === el) return n; return null; };
    const nearest = (e) => { for (const n of e.composedPath()) { if (n === page) return null; const id = nidOf(n); if (id != null) return { id, el: n }; } return null; };
    page.addEventListener('click', (e) => {
      const t = nearest(e);
      if (t) { if (t.el.localName === 'button') e.preventDefault(); send({ nid: t.id, type: 'click', button: 0 }); }
      const field = e.composedPath().some(n => n.localName === 'input' || n.localName === 'textarea' || n.localName === 'select');
      if (!field) host.focus({ preventScroll: true });
    });
    page.addEventListener('contextmenu', (e) => { e.preventDefault(); const t = nearest(e); if (t) send({ nid: t.id, type: 'contextmenu', button: 2 }); });
    page.addEventListener('input', (e) => { const t = nearest(e); if (t && (t.el.localName === 'input' && t.el.type !== 'checkbox' || t.el.localName === 'textarea')) send({ nid: t.id, type: 'input', value: t.el.value }); });
    page.addEventListener('submit', (e) => e.preventDefault());
    host.addEventListener('keydown', (e) => {
      const inField = e.composedPath().some(n => n.localName === 'input' || n.localName === 'textarea');
      if (inField) {
        if (e.key === 'Enter') {
          const form = e.composedPath().find(n => n.localName === 'form');
          const id = form ? nidOf(form) : null;
          if (id != null) { e.preventDefault(); send({ nid: id, type: 'submit' }); }
        }
        return;
      }
      if (KEYS_TO_KEEP.has(e.key)) e.preventDefault();
      send({ nid: 'body', type: 'keydown', key: e.key });
    });

    function sync(node, old) {
      if (node.x !== undefined) {
        if (old && old.nodeType === 3) { if (old.data !== node.x) old.data = node.x; return old; }
        return document.createTextNode(node.x);
      }
      const tag = TAGS.has(node.t) ? node.t : 'div';
      let el = byNid.get(node.n);
      if (!el || el.localName !== tag) { el = document.createElement(tag); if (tag === 'button') el.type = 'button'; }
      next.set(node.n, el);
      const want = node.a || {};
      for (const a of Array.from(el.attributes)) if (a.name !== 'type' && !(a.name in want)) el.removeAttribute(a.name);
      for (const k of Object.keys(want)) if (ATTRS.test(k) && el.getAttribute(k) !== want[k]) el.setAttribute(k, want[k]);
      if (tag === 'input' && want.type && el.type !== want.type) el.type = want.type;
      el.style.cssText = '';
      for (const k of Object.keys(node.s || {})) {
        const prop = k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
        const v = String(node.s[k]);
        if (PROP.test(prop) && !BAD_VALUE.test(v)) el.style.setProperty(prop, v);
      }
      if (node.v !== undefined && shadow.activeElement !== el && el.value !== node.v) el.value = node.v;
      if (node.c !== undefined) el.checked = node.c;
      const kids = (node.k || []).map((c, i) => sync(c, el.childNodes[i]));
      const same = kids.length === el.childNodes.length && kids.every((k, i) => k === el.childNodes[i]);
      if (!same) el.replaceChildren(...kids);
      return el;
    }
    let next = new Map();
    return {
      draw(tree) {
        next = new Map();
        const kids = ((tree && tree.k) || []).map((c, i) => sync(c, page.childNodes[i]));
        const same = kids.length === page.childNodes.length && kids.every((k, i) => k === page.childNodes[i]);
        if (!same) page.replaceChildren(...kids);
        byNid = next;
      },
    };
  }
  root.Preview = { mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
