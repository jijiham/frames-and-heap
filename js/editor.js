/* Code editor: CodeMirror 5 when it loaded from the CDN, otherwise a plain textarea with the same interface. */
(function (root) {
  'use strict';

  function create(parent, opts) {
    opts = opts || {};
    if (root.CodeMirror) return createCM(parent, opts);
    return createPlain(parent, opts);
  }

  function createCM(parent, opts) {
    const cm = root.CodeMirror(parent, {
      value: opts.value || '',
      mode: 'javascript',
      lineNumbers: true,
      indentUnit: 2,
      tabSize: 2,
      readOnly: opts.readOnly ? 'nocursor' : false,
      matchBrackets: true,
      autoCloseBrackets: !opts.readOnly,
      styleActiveLine: false,
      viewportMargin: Infinity,
      extraKeys: { Tab: (c) => c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('  ', 'end'), 'Shift-Tab': (c) => c.indentSelection('subtract') },
    });
    let marks = [];
    let lineMarks = [];
    let bookmarks = [];
    const api = {
      kind: 'cm',
      getValue: () => cm.getValue(),
      setValue: (v) => { if (cm.getValue() !== v) cm.setValue(v); },
      onChange: (fn) => cm.on('change', (_c, change) => { if (change.origin !== 'setValue') fn(cm.getValue()); }),
      mark: (start, end, cls) => {
        if (start == null || end == null || end <= start) return;
        const a = cm.posFromIndex(start), b = cm.posFromIndex(end);
        marks.push(cm.markText(a, b, { className: cls }));
      },
      markLine: (line, cls) => { if (line >= 1) { const h = cm.addLineClass(line - 1, 'background', cls); lineMarks.push([h, cls]); } },
      markEnd: (line, text) => {
        if (line < 1 || line > cm.lineCount()) return;
        const w = document.createElement('span'); w.className = 'eol-note'; w.textContent = text;
        bookmarks.push(cm.setBookmark({ line: line - 1, ch: cm.getLine(line - 1).length }, { widget: w }));
      },
      clearMarks: () => { marks.forEach(m => m.clear()); marks = []; bookmarks.forEach(m => m.clear()); bookmarks = []; lineMarks.forEach(([h, cls]) => cm.removeLineClass(h, 'background', cls)); lineMarks = []; },
      scrollToLine: (line) => { if (line >= 1) cm.scrollIntoView({ line: line - 1, ch: 0 }, 60); },
      refresh: () => cm.refresh(),
      focus: () => cm.focus(),
      setReadOnly: (ro) => cm.setOption('readOnly', ro ? 'nocursor' : false),
      lineAtIndex: (i) => cm.posFromIndex(i).line + 1,
      cursorIndex: () => cm.indexFromPos(cm.getCursor()),
      el: cm.getWrapperElement(),
      cm,
    };
    return api;
  }

  function createPlain(parent, opts) {
    const wrap = document.createElement('div');
    wrap.className = 'plain-editor';
    const gutter = document.createElement('pre');
    gutter.className = 'pe-gutter';
    const ta = document.createElement('textarea');
    ta.className = 'pe-text';
    ta.spellcheck = false;
    ta.value = opts.value || '';
    ta.readOnly = !!opts.readOnly;
    ta.setAttribute('aria-label', 'Code');
    wrap.appendChild(gutter);
    wrap.appendChild(ta);
    parent.appendChild(wrap);
    let markedLine = -1;
    const updateGutter = () => {
      const n = ta.value.split('\n').length;
      let s = '';
      for (let i = 1; i <= n; i++) s += (i === markedLine ? '▶ ' : '  ') + i + '\n';
      gutter.textContent = s;
    };
    updateGutter();
    ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop; });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
        ta.selectionStart = ta.selectionEnd = s + 2;
        ta.dispatchEvent(new Event('input'));
      }
    });
    const listeners = [];
    ta.addEventListener('input', () => { updateGutter(); listeners.forEach(f => f(ta.value)); });
    return {
      kind: 'plain',
      getValue: () => ta.value,
      setValue: (v) => { if (ta.value !== v) { ta.value = v; updateGutter(); } },
      onChange: (fn) => listeners.push(fn),
      mark: () => {},
      markEnd: () => {},
      markLine: (line) => { markedLine = line; updateGutter(); },
      clearMarks: () => { markedLine = -1; updateGutter(); },
      scrollToLine: () => {},
      refresh: () => {},
      focus: () => ta.focus(),
      setReadOnly: (ro) => { ta.readOnly = ro; },
      lineAtIndex: (i) => ta.value.slice(0, i).split('\n').length,
      cursorIndex: () => ta.selectionStart,
      el: wrap,
    };
  }

  root.Editor = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
