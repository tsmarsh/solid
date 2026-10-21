// The page: editor, render loop, measurements, status for assistive technology, STL download.
import { examples } from './examples.js';
import { startRender } from './render.js';
import { Viewer } from './viewer.js';
import { binaryStl } from './mesh.js';

const $ = (id) => document.getElementById(id);
const el = {
  program: $('program'), select: $('example-select'), render: $('render-button'), cancel: $('cancel-button'), auto: $('auto-render'),
  problem: $('problem'), place: $('problem-place'), message: $('problem-message'), goto: $('goto-problem'),
  status: $('status'), frame: document.querySelector('.viewer-frame'), busy: $('viewer-busy'), elapsed: $('busy-elapsed'),
  download: $('download-stl'), stale: $('viewer-stale'), reset: $('reset-view'), canvas: $('viewer'),
};
const nf = new Intl.NumberFormat('en', { maximumSignificantDigits: 6 });
const fmt = (x) => nf.format(x);
const BASE_TITLE = 'solid';

const viewer = new Viewer(el.canvas);
let current = null;      // the running render: { handle, started, ticker }
let latest = null;       // the last successful result
let lastProblem = null;  // { line, col } of the shown error
let debounce = 0, serial = 0, firstResult = true;

const store = {
  get() { try { return localStorage.getItem('solid-demo-program'); } catch { return null; } },
  set(v) { try { localStorage.setItem('solid-demo-program', v); } catch { /* private window: the program just is not remembered */ } },
};

function setStatus(text, kind) { el.status.textContent = text; el.status.dataset.kind = kind ?? ''; }
function setTitle(state) { document.title = state ? `${state} · ${BASE_TITLE}` : BASE_TITLE; }
function setMetric(id, text, good) { const dd = $(id); dd.textContent = text; if (good === undefined) delete dd.dataset.good; else dd.dataset.good = String(good); }

function showMetrics(r, ms) {
  const [x0, y0, z0, x1, y1, z1] = r.bbox;
  setMetric('m-volume', fmt(r.volume));
  setMetric('m-area', fmt(r.area));
  setMetric('m-bbox', r.faces ? `${fmt(x1 - x0)} × ${fmt(y1 - y0)} × ${fmt(z1 - z0)}` : 'empty');
  setMetric('m-manifold', r.faces === 0 ? 'No (empty)' : r.manifold ? `Yes, genus ${r.genus}` : 'No', r.faces === 0 ? false : r.manifold);
  setMetric('m-mesh', `${r.faces} faces, ${r.verts} vertices`);
  setMetric('m-time', ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
}
function clearMetrics() { for (const id of ['m-volume', 'm-area', 'm-bbox', 'm-manifold', 'm-mesh', 'm-time']) setMetric(id, '–'); }

function showProblem(message, place) {
  el.problem.hidden = false;
  el.place.textContent = place ?? '';
  el.message.textContent = message;
  el.program.setAttribute('aria-invalid', 'true');
  el.goto.hidden = !place;
}
function clearProblem() { el.problem.hidden = true; el.program.removeAttribute('aria-invalid'); lastProblem = null; }

// After a failure the last good solid stays on screen, dimmed and labelled; its measurements and the download are withdrawn.
function markStale() {
  latest = null; clearMetrics(); el.download.disabled = true;
  el.frame.dataset.stale = String(!!viewer.mesh);
  el.stale.hidden = !viewer.mesh;
}
function setBusy(on) {
  el.frame.setAttribute('aria-busy', String(on));
  el.busy.hidden = !on;
  el.cancel.hidden = !on;
}

function offsetOf(text, line, col) {
  let at = 0;
  for (let l = 1; l < line; l++) { const nl = text.indexOf('\n', at); if (nl < 0) break; at = nl + 1; }
  return Math.min(text.length, at + col - 1);
}

function stop() {
  if (!current) return;
  clearInterval(current.ticker);
  current.handle.cancel();   // rejects with kind "cancelled"; the run() that started it ignores that
  current = null;
}

async function run() {
  clearTimeout(debounce);
  stop();
  const mine = ++serial, src = el.program.value, started = performance.now();
  store.set(src);
  el.elapsed.textContent = '0.0';
  const handle = startRender(src);
  current = { handle, started, ticker: setInterval(() => { el.elapsed.textContent = ((performance.now() - started) / 1000).toFixed(1); }, 100) };
  setBusy(true);
  setStatus('Rendering…');
  setTitle('Rendering…');
  try {
    const r = await handle.promise;
    if (mine !== serial) return;
    finish(mine);
    const ms = performance.now() - started;
    if (!r.ok) {
      markStale();
      lastProblem = { line: r.line, col: r.col };
      showProblem(r.message, `Line ${r.line}, column ${r.col}`);
      setStatus(`Error at line ${r.line}, column ${r.col}: ${r.message}`, 'error');
      setTitle(`Error, line ${r.line}`);
      return;
    }
    clearProblem();
    el.frame.dataset.stale = 'false'; el.stale.hidden = true;
    latest = r;
    showMetrics(r, ms);
    viewer.setMesh(r.faces ? r : null, { fit: firstResult });
    firstResult = false;
    el.download.disabled = r.faces === 0;
    const manifold = r.faces === 0 ? 'The result is empty.' : r.manifold ? 'Valid manifold.' : 'Not a valid manifold.';
    setStatus(`Rendered ${r.faces} faces in ${ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(1) + ' s'}. Volume ${fmt(r.volume)}, surface area ${fmt(r.area)}. ${manifold}`, 'ok');
    setTitle(r.faces ? `Volume ${fmt(r.volume)}` : 'Empty');
  } catch (e) {
    if (mine !== serial || e.kind === 'cancelled') { if (e.kind === 'cancelled' && mine === serial) { finish(mine); setStatus('Cancelled.'); setTitle(''); } return; }
    finish(mine);
    markStale();
    showProblem(e.message);
    setStatus(e.message, 'error');
    setTitle(e.kind === 'timeout' ? 'Timed out' : 'Error');
  }
}
function finish(mine) {
  if (mine !== serial) return;
  if (current) clearInterval(current.ticker);
  current = null;
  setBusy(false);
}

function schedule() {
  store.set(el.program.value);
  clearTimeout(debounce);
  if (el.auto.checked) debounce = setTimeout(run, 900);
}

function loadExample(id, { focus }) {
  const ex = examples.find((e) => e.id === id);
  if (!ex) return;
  el.program.value = ex.program;
  firstResult = true;
  run();
  if (focus) el.program.focus();
}

// ---- wiring
for (const ex of examples) el.select.append(new Option(ex.title, ex.id));
el.select.insertBefore(new Option('Your own program', ''), el.select.firstChild);
el.select.addEventListener('change', () => { if (el.select.value) loadExample(el.select.value, { focus: true }); });
el.program.addEventListener('input', () => { el.select.value = ''; schedule(); });
el.program.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target !== el.program) { e.preventDefault(); run(); } });
el.render.addEventListener('click', run);
el.cancel.addEventListener('click', () => { stop(); el.program.focus(); });
el.goto.addEventListener('click', () => {
  if (!lastProblem) return;
  const at = offsetOf(el.program.value, lastProblem.line, lastProblem.col);
  el.program.focus();
  const m = /^[^\s()]+|^\(/.exec(el.program.value.slice(at));
  el.program.setSelectionRange(at, at + (m ? m[0].length : 1));
});
el.reset.addEventListener('click', () => { viewer.resetView(); el.canvas.focus(); });
el.download.addEventListener('click', () => {
  if (!latest || !latest.faces) return;
  const blob = new Blob([binaryStl(latest.pos, latest.tri)], { type: 'model/stl' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'solid.stl'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  setStatus(`Downloaded solid.stl (${latest.faces} triangles, binary).`, 'ok');
});

if (!viewer.ok) setStatus('This browser has no WebGL; measurements and STL still work.', 'error');
const saved = store.get();
if (saved && saved.trim()) { el.program.value = saved; el.select.value = ''; run(); }
else { el.select.value = examples[0].id; loadExample(examples[0].id, { focus: false }); }
// exposed for the test script only
window.__demo = { run, viewer, get latest() { return latest; } };
