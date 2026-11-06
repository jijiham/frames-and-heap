/* Theme presets. Each is a published editor color scheme; UI roles map onto its documented colors.
   Solarized values are VS Code's built-in Solarized Light and Dark themes, copied exactly. */
(function (root) {
  'use strict';
  const T = {
    'book': { name: 'Book', author: 'Eloquent JavaScript\'s site (Marijn Haverbeke)', dark: false, uiFont: 'Georgia, "Nimbus Roman No9 L", serif', codeFont: '"PT Mono", Menlo, monospace',
      bg: '#FFFFFF', side: '#F5F5F5', tabs: '#FFFFFF', tabInactive: '#FFFFFF', status: '#FFFFFF', fg: '#000000', strong: '#000000', statusFg: '#000000',
      border: '#000000', accent: '#000000', arrow: '#000000', hl: '#0000000F', changed: '#00000012', ok: '#004422', bad: '#770000', warn: '#774400',
      btn: '#000000', btnFg: '#FFFFFF', input: '#FFFFFF', inputFg: '#000000', focus: '#000099', sel: '#0000001A', link: '#AAAAAA', rule: '#CCCCCC',
      kw: '#550066', str: '#770000', num: '#004422', atom: '#221199', def: '#000099', com: '#774400', prop: '#000000' },
    'solarized-light': { name: 'Solarized Light', author: 'Ethan Schoonover, 2011 (VS Code built-in)', dark: false,
      bg: '#FDF6E3', side: '#EEE8D5', tabs: '#D9D2C2', tabInactive: '#D3CBB7', status: '#EEE8D5', fg: '#657B83', strong: '#073642', statusFg: '#586E75',
      border: '#DDD6C1', accent: '#B58900', arrow: '#268BD2', hl: '#DFCA88', changed: '#DFCA8866', ok: '#859900', bad: '#DC322F', warn: '#CB4B16',
      btn: '#AC9D57', btnFg: '#FFFFFF', input: '#DDD6C1', inputFg: '#586E75', focus: '#B49471', sel: '#EEE8D5',
      kw: '#859900', str: '#2AA198', num: '#D33682', atom: '#B58900', def: '#268BD2', com: '#93A1A1', prop: '#657B83' },
    'solarized-dark': { name: 'Solarized Dark', author: 'Ethan Schoonover, 2011 (VS Code built-in)', dark: true,
      bg: '#002B36', side: '#00212B', tabs: '#004052', tabInactive: '#004052', status: '#00212B', fg: '#839496', strong: '#EEE8D5', statusFg: '#93A1A1',
      border: '#003847', accent: '#B58900', arrow: '#268BD2', hl: '#005A6F', changed: '#004454AA', ok: '#859900', bad: '#DC322F', warn: '#CB4B16',
      btn: '#2AA19899', btnFg: '#FFFFFF', input: '#003847', inputFg: '#93A1A1', focus: '#2AA19899', sel: '#274642',
      kw: '#859900', str: '#2AA198', num: '#D33682', atom: '#B58900', def: '#268BD2', com: '#586E75', prop: '#839496' },
    'monokai': { name: 'Monokai', author: 'Wimer Hazenberg, 2006', dark: true,
      bg: '#272822', side: '#1E1F1C', tabs: '#1E1F1C', tabInactive: '#34352F', status: '#414339', fg: '#F8F8F2', strong: '#F8F8F2', statusFg: '#F8F8F2',
      border: '#414339', accent: '#E6DB74', arrow: '#66D9EF', hl: '#49483E', changed: '#75715E66', ok: '#A6E22E', bad: '#F92672', warn: '#FD971F',
      btn: '#75715E', btnFg: '#F8F8F2', input: '#414339', inputFg: '#F8F8F2', focus: '#99947C', sel: '#49483E',
      kw: '#F92672', str: '#E6DB74', num: '#AE81FF', atom: '#AE81FF', def: '#A6E22E', com: '#75715E', prop: '#F8F8F2' },
    'gruvbox-dark': { name: 'Gruvbox Dark', author: 'Pavel Pertsev, 2012', dark: true,
      bg: '#282828', side: '#1D2021', tabs: '#1D2021', tabInactive: '#32302F', status: '#1D2021', fg: '#EBDBB2', strong: '#FBF1C7', statusFg: '#EBDBB2',
      border: '#3C3836', accent: '#FABD2F', arrow: '#83A598', hl: '#504945', changed: '#665C5466', ok: '#B8BB26', bad: '#FB4934', warn: '#FE8019',
      btn: '#458588', btnFg: '#FBF1C7', input: '#3C3836', inputFg: '#EBDBB2', focus: '#D79921', sel: '#504945',
      kw: '#FB4934', str: '#B8BB26', num: '#D3869B', atom: '#D3869B', def: '#FABD2F', com: '#928374', prop: '#83A598' },
    'gruvbox-light': { name: 'Gruvbox Light', author: 'Pavel Pertsev, 2012', dark: false,
      bg: '#FBF1C7', side: '#EBDBB2', tabs: '#EBDBB2', tabInactive: '#D5C4A1', status: '#EBDBB2', fg: '#3C3836', strong: '#282828', statusFg: '#3C3836',
      border: '#D5C4A1', accent: '#B57614', arrow: '#076678', hl: '#D5C4A1', changed: '#D5C4A188', ok: '#79740E', bad: '#9D0006', warn: '#AF3A03',
      btn: '#076678', btnFg: '#FBF1C7', input: '#EBDBB2', inputFg: '#3C3836', focus: '#B57614', sel: '#D5C4A1',
      kw: '#9D0006', str: '#79740E', num: '#8F3F71', atom: '#8F3F71', def: '#B57614', com: '#928374', prop: '#076678' },
    'dracula': { name: 'Dracula', author: 'Zeno Rocha, 2013', dark: true,
      bg: '#282A36', side: '#21222C', tabs: '#191A21', tabInactive: '#21222C', status: '#191A21', fg: '#F8F8F2', strong: '#F8F8F2', statusFg: '#F8F8F2',
      border: '#44475A', accent: '#BD93F9', arrow: '#8BE9FD', hl: '#44475A', changed: '#6272A466', ok: '#50FA7B', bad: '#FF5555', warn: '#FFB86C',
      btn: '#44475A', btnFg: '#F8F8F2', input: '#21222C', inputFg: '#F8F8F2', focus: '#6272A4', sel: '#44475A',
      kw: '#FF79C6', str: '#F1FA8C', num: '#BD93F9', atom: '#BD93F9', def: '#50FA7B', com: '#6272A4', prop: '#8BE9FD' },
    'nord': { name: 'Nord', author: 'Arctic Ice Studio, 2016', dark: true,
      bg: '#2E3440', side: '#3B4252', tabs: '#2E3440', tabInactive: '#3B4252', status: '#3B4252', fg: '#D8DEE9', strong: '#ECEFF4', statusFg: '#D8DEE9',
      border: '#434C5E', accent: '#EBCB8B', arrow: '#88C0D0', hl: '#434C5E', changed: '#4C566A88', ok: '#A3BE8C', bad: '#BF616A', warn: '#D08770',
      btn: '#5E81AC', btnFg: '#ECEFF4', input: '#3B4252', inputFg: '#D8DEE9', focus: '#88C0D0', sel: '#434C5E',
      kw: '#81A1C1', str: '#A3BE8C', num: '#B48EAD', atom: '#81A1C1', def: '#88C0D0', com: '#616E88', prop: '#D8DEE9' },
    'one-dark': { name: 'One Dark', author: 'GitHub Atom team, 2014', dark: true,
      bg: '#282C34', side: '#21252B', tabs: '#21252B', tabInactive: '#21252B', status: '#21252B', fg: '#ABB2BF', strong: '#D7DAE0', statusFg: '#9DA5B4',
      border: '#181A1F', accent: '#E5C07B', arrow: '#61AFEF', hl: '#3E4451', changed: '#3E445188', ok: '#98C379', bad: '#E06C75', warn: '#D19A66',
      btn: '#4D78CC', btnFg: '#FFFFFF', input: '#1D1F23', inputFg: '#ABB2BF', focus: '#528BFF', sel: '#3E4451',
      kw: '#C678DD', str: '#98C379', num: '#D19A66', atom: '#D19A66', def: '#61AFEF', com: '#5C6370', prop: '#E06C75' },
    'tomorrow-night': { name: 'Tomorrow Night', author: 'Chris Kempson, 2011', dark: true,
      bg: '#1D1F21', side: '#282A2E', tabs: '#1D1F21', tabInactive: '#282A2E', status: '#282A2E', fg: '#C5C8C6', strong: '#E0E0E0', statusFg: '#C5C8C6',
      border: '#373B41', accent: '#F0C674', arrow: '#81A2BE', hl: '#373B41', changed: '#373B4188', ok: '#B5BD68', bad: '#CC6666', warn: '#DE935F',
      btn: '#373B41', btnFg: '#C5C8C6', input: '#282A2E', inputFg: '#C5C8C6', focus: '#81A2BE', sel: '#373B41',
      kw: '#B294BB', str: '#B5BD68', num: '#DE935F', atom: '#DE935F', def: '#81A2BE', com: '#969896', prop: '#C5C8C6' },
    'github-light': { name: 'GitHub Light', author: 'GitHub Primer, 2023', dark: false, uiFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif', codeFont: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      bg: '#FFFFFF', side: '#F6F8FA', tabs: '#F6F8FA', tabInactive: '#F6F8FA', status: '#F6F8FA', fg: '#1F2328', strong: '#1F2328', statusFg: '#656D76',
      border: '#D0D7DE', accent: '#FD8C73', arrow: '#0969DA', hl: '#FFF8C5', changed: '#FFF8C5', ok: '#1A7F37', bad: '#CF222E', warn: '#9A6700',
      btn: '#1F883D', btnFg: '#FFFFFF', input: '#FFFFFF', inputFg: '#1F2328', focus: '#0969DA', sel: '#DDF4FF', link: '#656D76', rule: '#D0D7DE',
      kw: '#CF222E', str: '#0A3069', num: '#0550AE', atom: '#0550AE', def: '#8250DF', com: '#6E7781', prop: '#0550AE' },
    'github-dark': { name: 'GitHub Dark', author: 'GitHub Primer, 2023', dark: true, uiFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif', codeFont: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      bg: '#0D1117', side: '#161B22', tabs: '#010409', tabInactive: '#010409', status: '#010409', fg: '#E6EDF3', strong: '#E6EDF3', statusFg: '#7D8590',
      border: '#30363D', accent: '#F78166', arrow: '#2F81F7', hl: '#BB800926', changed: '#BB800926', ok: '#3FB950', bad: '#F85149', warn: '#D29922',
      btn: '#238636', btnFg: '#FFFFFF', input: '#0D1117', inputFg: '#E6EDF3', focus: '#1F6FEB', sel: '#264F78', link: '#7D8590', rule: '#30363D',
      kw: '#FF7B72', str: '#A5D6FF', num: '#79C0FF', atom: '#79C0FF', def: '#D2A8FF', com: '#8B949E', prop: '#79C0FF' },
    'catppuccin-latte': { name: 'Catppuccin Latte', author: 'Catppuccin, 2021', dark: false,
      bg: '#EFF1F5', side: '#E6E9EF', tabs: '#DCE0E8', tabInactive: '#DCE0E8', status: '#DCE0E8', fg: '#4C4F69', strong: '#4C4F69', statusFg: '#6C6F85',
      border: '#BCC0CC', accent: '#8839EF', arrow: '#1E66F5', hl: '#CCD0DA', changed: '#DF8E1D33', ok: '#40A02B', bad: '#D20F39', warn: '#FE640B',
      btn: '#8839EF', btnFg: '#EFF1F5', input: '#E6E9EF', inputFg: '#4C4F69', focus: '#7287FD', sel: '#CCD0DA', link: '#7C7F93', rule: '#CCD0DA',
      kw: '#8839EF', str: '#40A02B', num: '#FE640B', atom: '#FE640B', def: '#1E66F5', com: '#9CA0B0', prop: '#179299' },
    'catppuccin-mocha': { name: 'Catppuccin Mocha', author: 'Catppuccin, 2021', dark: true,
      bg: '#1E1E2E', side: '#181825', tabs: '#11111B', tabInactive: '#11111B', status: '#11111B', fg: '#CDD6F4', strong: '#CDD6F4', statusFg: '#A6ADC8',
      border: '#45475A', accent: '#CBA6F7', arrow: '#89B4FA', hl: '#313244', changed: '#F9E2AF26', ok: '#A6E3A1', bad: '#F38BA8', warn: '#FAB387',
      btn: '#CBA6F7', btnFg: '#1E1E2E', input: '#181825', inputFg: '#CDD6F4', focus: '#B4BEFE', sel: '#45475A', link: '#9399B2', rule: '#313244',
      kw: '#CBA6F7', str: '#A6E3A1', num: '#FAB387', atom: '#FAB387', def: '#89B4FA', com: '#6C7086', prop: '#94E2D5' },
    'tokyo-night': { name: 'Tokyo Night', author: 'enkia, 2020', dark: true,
      bg: '#1A1B26', side: '#16161E', tabs: '#16161E', tabInactive: '#16161E', status: '#16161E', fg: '#A9B1D6', strong: '#C0CAF5', statusFg: '#787C99',
      border: '#292E42', accent: '#7AA2F7', arrow: '#7DCFFF', hl: '#292E42', changed: '#E0AF6826', ok: '#9ECE6A', bad: '#F7768E', warn: '#FF9E64',
      btn: '#3D59A1', btnFg: '#FFFFFF', input: '#16161E', inputFg: '#C0CAF5', focus: '#7AA2F7', sel: '#33467C', link: '#565F89', rule: '#292E42',
      kw: '#BB9AF7', str: '#9ECE6A', num: '#FF9E64', atom: '#FF9E64', def: '#7AA2F7', com: '#565F89', prop: '#73DACA' },
    'rose-pine': { name: 'Rosé Pine', author: 'Rosé Pine, 2021', dark: true,
      bg: '#191724', side: '#1F1D2E', tabs: '#1F1D2E', tabInactive: '#1F1D2E', status: '#1F1D2E', fg: '#E0DEF4', strong: '#E0DEF4', statusFg: '#908CAA',
      border: '#26233A', accent: '#EBBCBA', arrow: '#9CCFD8', hl: '#21202E', changed: '#F6C17726', ok: '#9CCFD8', bad: '#EB6F92', warn: '#F6C177',
      btn: '#31748F', btnFg: '#E0DEF4', input: '#1F1D2E', inputFg: '#E0DEF4', focus: '#C4A7E7', sel: '#403D52', link: '#6E6A86', rule: '#26233A',
      kw: '#31748F', str: '#F6C177', num: '#EBBCBA', atom: '#EBBCBA', def: '#EBBCBA', com: '#6E6A86', prop: '#C4A7E7' },
    'turbo-pascal': { name: 'Turbo Pascal', author: 'Borland DOS IDE, 16-color VGA palette', dark: true, codeFont: "'VT323', monospace", uiFont: "'VT323', monospace", scale: 1.25,
      bg: '#0000AA', side: '#0000AA', tabs: '#AAAAAA', tabInactive: '#AAAAAA', status: '#AAAAAA', fg: '#FFFF55', strong: '#FFFFFF', statusFg: '#000000', tabFg: '#000000',
      border: '#55FFFF', accent: '#55FFFF', arrow: '#55FFFF', hl: '#00AAAA', changed: '#00AAAA', ok: '#55FF55', bad: '#FF5555', warn: '#FFFF55',
      btn: '#00AA00', btnFg: '#000000', input: '#000000', inputFg: '#FFFFFF', focus: '#FFFFFF', sel: '#00AAAA',
      kw: '#FFFFFF', str: '#55FFFF', num: '#55FFFF', atom: '#55FFFF', def: '#FFFF55', com: '#AAAAAA', prop: '#FFFF55' },
  };
  const ORDER = ['book', 'solarized-light', 'solarized-dark', 'github-light', 'github-dark', 'gruvbox-light', 'gruvbox-dark', 'catppuccin-latte', 'catppuccin-mocha', 'monokai', 'dracula', 'nord', 'one-dark', 'tokyo-night', 'rose-pine', 'tomorrow-night', 'turbo-pascal'];
  const VARS = ['bg', 'side', 'tabs', 'tabInactive', 'status', 'fg', 'strong', 'statusFg', 'border', 'accent', 'arrow', 'hl', 'changed', 'ok', 'bad', 'warn', 'btn', 'btnFg', 'input', 'inputFg', 'focus', 'sel', 'kw', 'str', 'num', 'atom', 'def', 'com', 'prop'];
  const EDITABLE = [['bg', 'Background'], ['side', 'Panels'], ['strong', 'Text'], ['fg', 'Code text'], ['accent', 'Accent and current step'], ['arrow', 'Arrows'], ['hl', 'Highlight'], ['kw', 'Keywords'], ['str', 'Strings'], ['num', 'Numbers']];

  function resolve(settings, prefersDark) {
    let id = settings.theme || 'solarized-auto';
    if (id === 'solarized-auto') id = prefersDark ? 'solarized-dark' : 'solarized-light';
    if (id === 'custom') {
      const base = T[settings.customBase || 'solarized-light'] || T['solarized-light'];
      return Object.assign({}, base, settings.customColors || {}, { name: 'Custom' });
    }
    return T[id] || T['solarized-light'];
  }
  function apply(theme, settings) {
    const st = document.documentElement.style;
    const cssName = (k) => '--' + k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
    for (const k of VARS) st.setProperty(cssName(k), theme[k]);
    st.setProperty('--tab-fg', theme.tabFg || theme.strong);
    st.setProperty('--link', theme.link || theme.com);
    st.setProperty('--rule', theme.rule || theme.border);
    st.setProperty('--code-bg', theme.side);
    // VS Code's defaults on a Mac: the system UI font for the interface and Menlo for code.
    st.setProperty('--font-code', settings.codeFont && settings.codeFont !== 'theme' ? settings.codeFont : (theme.codeFont || 'Menlo, Monaco, "Courier New", monospace'));
    st.setProperty('--font-body', theme.uiFont || '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif');
    const size = settings.fontSize || 15;
    st.setProperty('--size', (size * (theme.scale || 1)) + 'px');
    st.setProperty('--code-size', ((size - 1) * (theme.scale || 1)) + 'px');
    document.documentElement.style.colorScheme = theme.dark ? 'dark' : 'light';
    document.documentElement.dataset.dark = theme.dark ? '1' : '0';
  }
  root.Themes = { T, ORDER, VARS, EDITABLE, resolve, apply };
})(typeof globalThis !== 'undefined' ? globalThis : this);
