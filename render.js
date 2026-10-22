// Runs one render in a fresh worker (worker.js). Resolves to the parsed JSON of the program (solid.render in fib-solid) with `engine` added ("wasm" or "JavaScript": which ran; `engine` in the options is "auto", "js" or "wasm") or rejects with an Error whose
// `kind` is "timeout", "cancelled", "crashed" or "unavailable". Calling `.cancel()` on the returned promise's `handle` stops the worker.
export function startRender(src, { timeoutMs = 45000, engine = 'auto' } = {}) {
  let worker, timer, settle;
  const promise = new Promise((resolve, reject) => {
    const fail = (kind, message) => { cleanup(); reject(Object.assign(new Error(message), { kind })); };
    const cleanup = () => { clearTimeout(timer); worker?.terminate(); };
    settle = fail;
    try { worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }); }
    catch (e) { fail('unavailable', `This browser cannot start the renderer: ${e.message}`); return; }
    timer = setTimeout(() => fail('timeout', `The render took longer than ${Math.round(timeoutMs / 1000)} seconds and was stopped.`), timeoutMs);
    worker.onerror = (e) => fail('unavailable', `The renderer failed to load${e.message ? `: ${e.message}` : ''}. Has demo/build.sh been run?`);
    worker.onmessage = (ev) => {
      const { status, out, err, engine: ran } = ev.data;
      cleanup();
      if (status !== 0) { reject(Object.assign(new Error(`The geometry library stopped on this program (${err.trim() || `exit status ${status}`}).`), { kind: 'crashed' })); return; }
      try { resolve({ ...JSON.parse(out.split('\n', 1)[0]), engine: ran }); }
      catch (e) { reject(Object.assign(new Error('The renderer answered with something that is not JSON.'), { kind: 'crashed' })); }
    };
    worker.postMessage({ src, engine });
  });
  return { promise, cancel: () => settle('cancelled', 'Cancelled.') };
}
