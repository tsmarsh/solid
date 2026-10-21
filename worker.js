// One render in one worker: the page posts {src}, the worker runs the fib-solid program (solid.mjs, built from render-main.fib) with the text as
// its argument and posts back {status, out, err}. Terminating the worker is how the page cancels or times out a render.
// solid.mjs is fibber's JavaScript backend output; it expects node. Below is the little of node it touches: process, Buffer, fs, tty, os.
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
  postMessage({ status, out: text(stdout), err: text(stderr) + (extra ?? '') });
  throw new Exited();
}

self.addEventListener('message', async (ev) => {
  const src = String(ev.data.src);
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
    if (e instanceof RangeError && /call stack/.test(e.message)) postMessage({ status: 139, out: '', err: 'stack overflow\n' });
    else postMessage({ status: 70, out: '', err: String((e && e.stack) || e) });
  }
});
