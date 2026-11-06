# Frames and Heap

A JavaScript practice site. The Memory tab draws a program's frames and heap after every step as you type, and the Practice tab has five stages of tracing and writing exercises, from values and loops to the DOM, timers, fetch and a full Minesweeper, with tests that rerun as you type.

It is a static site with no build step: open `index.html` through any web server. Acorn and CodeMirror load from public CDNs.

`test/verify.js` checks every exercise against Node's engine using the reference solutions in `test/refs.js`. Run it from the repository root with `node test/verify.js`; it needs the `acorn` package installed.
