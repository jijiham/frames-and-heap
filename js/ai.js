/* Asks Claude through the claude.ai page's sample capability, which bills the viewer's own claude.ai plan.
   Returns null from available() when the page isn't running on claude.ai or the capability isn't granted. */
(function (root) {
  'use strict';
  let samplerP = null;
  function sampler() {
    if (!samplerP) {
      samplerP = root.claude && typeof root.claude.use === 'function'
        ? Promise.race([root.claude.use('sample'), new Promise(r => setTimeout(() => r(null), 10000))]).catch(() => null)
        : Promise.resolve(null);
    }
    return samplerP;
  }
  const MODELS = {
    'opus-high': { model: 'claude-opus-5-5', effort: 'high' },
    'opus-medium': { model: 'claude-opus-5-5', effort: 'medium' },
    'sonnet': { model: 'claude-sonnet-5-5', effort: 'medium' },
  };
  // The writing rules every answer follows, taken from how the site's own text is written.
  const STYLE = 'Write in plain, complete sentences that connect logically, for a capable reader. Define any term a beginner might not know the first time you use it. Do not use sentence fragments, slogans, rhetorical questions, markdown headings, bold text or bullet symbols inside a string.';
  async function ask(prompt, opts) {
    opts = opts || {};
    const s = await sampler();
    if (!s) { const e = new Error('Claude is available only when this page runs on claude.ai.'); e.code = 'unavailable'; throw e; }
    const o = Object.assign({ cache: false }, MODELS[opts.model] || MODELS['opus-high']);
    if (opts.onText) o.onText = opts.onText;
    if (opts.signal) o.signal = opts.signal;
    return opts.json ? s.json(prompt, o) : s(prompt, o);
  }
  function errorText(e) {
    if (!e) return 'Claude didn\'t answer.';
    if (e.code === 'unavailable') return e.message;
    if (e.code === 'not_granted') return 'This page doesn\'t have permission to ask Claude. Allow it when claude.ai asks, then try again.';
    if (e.code === 'rate_limited') return 'Claude is rate-limited for the moment. Wait a minute and try again.';
    return 'Claude didn\'t answer: ' + (e.message || String(e));
  }
  root.AI = { available: async () => !!(await sampler()), ask, errorText, STYLE };
})(typeof globalThis !== 'undefined' ? globalThis : this);
