// A minimal WASI preview 1 host for a browser Web Worker (and node): enough for a fibber program that reads its arguments, writes
// standard output and error, reads the clock and exits. There is no file system: every other descriptor answers EBADF. No dependency.
//   const { status, out, err } = await runWasi(module, ['prog', 'argument']);       out and err are Uint8Arrays
// A program that ends with proc_exit gives its status; a trap of the module (fibber's abort) gives 134, an exhausted stack 139, as a native
// program's abort and stack overflow end. Anything else the module throws is rethrown.
const ESUCCESS = 0, EBADF = 8, ESPIPE = 70, ENOSYS = 52;
class Exit extends Error { constructor(code) { super(`exit ${code}`); this.code = code; } }

const joined = (chunks) => {
  const all = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.length; }
  return all;
};

export async function runWasi(module, args = [], { env = [] } = {}) {
  const enc = new TextEncoder();
  const stdout = [], stderr = [];
  let memory;
  const view = () => new DataView(memory.buffer);
  const bytes = () => new Uint8Array(memory.buffer);
  // argv and environ: an array of NUL-terminated strings, and a vector of pointers into it
  const strings = (list) => list.map((s) => enc.encode(s + '\0'));
  const sizes = (list) => (out, outSize) => { const v = view(); v.setUint32(out, list.length, true); v.setUint32(outSize, list.reduce((n, s) => n + s.length, 0), true); return ESUCCESS; };
  const fill = (list) => (ptrs, buf) => {
    const v = view(), m = bytes();
    for (const s of list) { v.setUint32(ptrs, buf, true); m.set(s, buf); ptrs += 4; buf += s.length; }
    return ESUCCESS;
  };
  const argv = strings(args), environ = strings(env);
  const wasi = {
    args_sizes_get: sizes(argv), args_get: fill(argv),
    environ_sizes_get: sizes(environ), environ_get: fill(environ),
    fd_write(fd, iovs, count, written) {
      const sink = fd === 1 ? stdout : fd === 2 ? stderr : null;
      if (!sink) return EBADF;
      const v = view(), m = bytes();
      let total = 0;
      for (let i = 0; i < count; i++) {
        const at = v.getUint32(iovs + 8 * i, true), len = v.getUint32(iovs + 8 * i + 4, true);
        sink.push(m.slice(at, at + len));
        total += len;
      }
      v.setUint32(written, total, true);
      return ESUCCESS;
    },
    fd_read(fd, _iovs, _count, nread) { if (fd !== 0) return EBADF; view().setUint32(nread, 0, true); return ESUCCESS; },   // standard input is empty
    fd_close: (fd) => (fd <= 2 ? ESUCCESS : EBADF),
    fd_seek: (fd) => (fd <= 2 ? ESPIPE : EBADF),
    fd_fdstat_get(fd, out) {
      if (fd > 2) return EBADF;
      const v = view();
      v.setUint8(out, 2);                       // filetype: character device
      v.setUint16(out + 2, 0, true);                  // flags
      v.setBigUint64(out + 8, 0xffffffffffffffffn, true);    // rights
      v.setBigUint64(out + 16, 0n, true);
      return ESUCCESS;
    },
    fd_fdstat_set_flags: (fd) => (fd <= 2 ? ESUCCESS : EBADF),
    fd_prestat_get: () => EBADF, fd_prestat_dir_name: () => EBADF,       // no preopened directories: wasi-libc stops looking
    clock_time_get(id, _precision, out) {
      const ns = id === 0 ? BigInt(Math.round(Date.now())) * 1000000n : BigInt(Math.round(performance.now() * 1e6));
      view().setBigUint64(out, ns, true);
      return ESUCCESS;
    },
    random_get(buf, len) {
      const m = bytes();
      for (let at = 0; at < len; at += 65536) crypto.getRandomValues(m.subarray(buf + at, buf + Math.min(len, at + 65536)));
      return ESUCCESS;
    },
    sched_yield: () => ESUCCESS,
    proc_exit(code) { throw new Exit(code); },
  };
  // an import the module has and this host lacks fails when called, not when the module is instantiated
  const imports = { wasi_snapshot_preview1: wasi };
  for (const { module: m, name, kind } of WebAssembly.Module.imports(module)) {
    if (kind !== 'function') continue;
    imports[m] ??= {};
    imports[m][name] ??= () => { throw new WebAssembly.RuntimeError(`import ${m}.${name} is not provided`); };
  }
  const instance = await WebAssembly.instantiate(module, imports);
  memory = instance.exports.memory;
  let status = 0, extra = '';
  try {
    instance.exports._start();
  } catch (e) {
    if (e instanceof Exit) status = e.code;
    else if (e instanceof RangeError && /call stack/.test(e.message)) { status = 139; extra = 'trap: stack overflow\n'; }
    else if (e instanceof WebAssembly.RuntimeError) { status = 134; extra = `wasm trap: ${e.message}\n`; }
    else throw e;
  }
  return { status, out: joined(stdout), err: joined([...stderr, enc.encode(extra)]) };
}
