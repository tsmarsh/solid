// One render in one worker: the page posts {src, engine}, the worker runs the fib-solid program with the text as its argument and posts back
// {status, out, err, engine}. Terminating the worker is how the page cancels or times out a render.
// Two engines, the same program (render-main.fib): solid.wasm, fibber's wasm32-wasi build run through the shim in wasi.js (the default), and solid.mjs,
// fibber's JavaScript backend, which runs on the little of node that it touches (below). The JavaScript one is the fallback, used when this browser has no
// WebAssembly or cannot compile the module, or when the page asks for it (engine "js"); engine "wasm" refuses to fall back (the tests use it).
const stdout = [], stderr = [];
class Exited extends Error {}

class Buf extends Uint8Array {
  static from(x, enc) {
    if (typeof x === 'string') {
      if (enc === 'latin1') return new Buf(Array.from(x, (c) => c.charCodeAt(0) & 255));
      return new Buf(new TextEncoder().encode(x));
    }
    return new Buf(x);
  }
  static concat(list) {
    const out = new Buf(list.reduce((n, b) => n + b.length, 0));
    let at = 0;
    for (const b of list) { out.set(b, at); at += b.length; }
    return out;
  }
  toString(enc) {
    if (enc === 'latin1') return Array.from(this, (b) => String.fromCharCode(b)).join('');
    return new TextDecoder().decode(this);
  }
}

function finish(status, extra) {
  const text = (chunks) => new TextDecoder().decode(Buf.concat(chunks));
  postMessage({ status, out: text(stdout), err: text(stderr) + (extra ?? ''), engine: 'JavaScript' });
  throw new Exited();
}

async function runWasm(src) {
  const { runWasi } = await import('./wasi.js');
  const response = await fetch(new URL('./solid.wasm', import.meta.url));
  if (!response.ok) throw new Error(`solid.wasm: HTTP ${response.status}`);
  const module = await WebAssembly.compile(await response.arrayBuffer());   // not compileStreaming: a server that sends the wrong content type must still work
  const r = await runWasi(module, ['solid', src]);
  const text = (b) => new TextDecoder().decode(b);
  postMessage({ status: r.status, out: text(r.out), err: text(r.err), engine: 'wasm' });
}

async function runJs(src) {
  globalThis.process = {
    env: { FIB_JS_HEAP_MB: '1024' },
    argv: ['browser', 'solid', src],
    pid: 1,
    hrtime: Object.assign(() => [0, 0], { bigint: () => BigInt(Math.round(performance.now() * 1e6)) }),
    exit: (code) => finish(code),
    kill: (_pid, sig) => finish(128, `killed by ${sig}\n`),
  };
  globalThis.Buffer = Buf;
  globalThis.$node = {
    fs: {
      writeSync(fd, bytes, off = 0, len = bytes.length - off) {
        (fd === 2 ? stderr : stdout).push(Buf.from(bytes.slice(off, off + len)));
        return len;
      },
      readSync: () => 0,
      fstatSync: () => ({ size: 0 }),
      openSync: () => { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; },
      closeSync() {}, unlinkSync() {}, mkdirSync() {}, rmdirSync() {},
    },
    tty: { isatty: () => false },
    os: { constants: { errno: { ENOENT: 2, EIO: 5, EEXIST: 17, EINVAL: 22 } } },
  };
  try {
    await import('./solid.mjs');
  } catch (e) {
    if (e instanceof Exited) return;
    if (e instanceof RangeError && /call stack/.test(e.message)) postMessage({ status: 139, out: '', err: 'stack overflow\n', engine: 'JavaScript' });
    else postMessage({ status: 70, out: '', err: String((e && e.stack) || e), engine: 'JavaScript' });
  }
}

self.addEventListener('message', async (ev) => {
  const src = String(ev.data.src), engine = ev.data.engine ?? 'auto';
  if (engine !== 'js') {
    try { await runWasm(src); return; }
    catch (e) {
      // No WebAssembly, a module this browser cannot compile (a CompileError), or no module to fetch: fall back. A trap or a crash of a program that did start is
      // reported by runWasi as a status, not thrown, so a wasm failure of the program itself is never retried as JavaScript.
      if (engine === 'wasm') { postMessage({ status: 70, out: '', err: `WebAssembly is not available here: ${(e && e.message) || e}\n`, engine: 'wasm' }); return; }
    }
  }
  await runJs(src);
});
