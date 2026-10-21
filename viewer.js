// A small WebGL viewer: orbit, pan and zoom by mouse, touch and keyboard; smooth shading; a ground grid and axes (x red, y green, z blue; z is up).
import { shadedTriangles } from './mesh.js';

const VERT = `
attribute vec3 aPos; attribute vec3 aNormal;
uniform mat4 uProj; uniform mat4 uView;
varying vec3 vNormal;
void main() { vec4 p = uView * vec4(aPos, 1.0); vNormal = mat3(uView) * aNormal; gl_Position = uProj * p; }`;
const FRAG = `
precision mediump float;
uniform vec3 uColor; uniform vec3 uSky; uniform vec3 uGround;
varying vec3 vNormal;
void main() {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  float key = max(dot(n, normalize(vec3(-0.35, 0.55, 0.75))), 0.0);
  float fill = max(dot(n, normalize(vec3(0.6, -0.2, 0.4))), 0.0);
  vec3 ambient = mix(uGround, uSky, 0.5 + 0.5 * n.y);
  gl_FragColor = vec4(uColor * (0.34 * ambient + 0.72 * key + 0.18 * fill), 1.0);
}`;
const LINE_VERT = `attribute vec3 aPos; uniform mat4 uProj; uniform mat4 uView; void main() { gl_Position = uProj * uView * vec4(aPos, 1.0); }`;
const LINE_FRAG = `precision mediump float; uniform vec4 uColor; void main() { gl_FragColor = uColor; }`;

function compile(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram(); gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
const cssColor = (el, name) => {
  const probe = document.createElement('span'); probe.style.color = getComputedStyle(el).getPropertyValue(name); el.append(probe);
  const m = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number); probe.remove();
  return [m[0] / 255, m[1] / 255, m[2] / 255];
};

// column-major 4x4 helpers
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

export class Viewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    this.ok = !!this.gl;
    this.az = -0.9; this.el = 0.45; this.dist = 3; this.target = [0, 0, 0];
    this.extent = 1; this.mesh = null; this.dirty = true; this.pointers = new Map();
    if (!this.ok) return;
    const gl = this.gl;
    this.solid = program(gl, VERT, FRAG); this.line = program(gl, LINE_VERT, LINE_FRAG);
    this.meshBuf = gl.createBuffer(); this.gridBuf = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST);
    this.readColors();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { this.readColors(); this.draw(); });
    new ResizeObserver(() => this.draw()).observe(canvas);
    this.bind();
  }

  readColors() {
    const c = this.canvas;
    this.colors = { bg: cssColor(c.parentElement, '--viewer-bg'), grid: cssColor(c, '--viewer-grid'), mesh: cssColor(c, '--viewer-mesh'), ink: cssColor(c, '--ink') };
  }

  // The solid to show (pos: x y z per vertex; tri: three ids per face; bbox: [minx miny minz maxx maxy maxz]) or null.
  setMesh(m, { fit = false } = {}) {
    if (!this.ok) return;
    const gl = this.gl;
    if (!m || m.tri.length === 0) { this.mesh = null; this.draw(); return; }
    const data = shadedTriangles(m.pos, m.tri);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.mesh = { count: data.length / 6, bbox: m.bbox };
    const [x0, y0, z0, x1, y1, z1] = m.bbox;
    this.extent = Math.max(x1 - x0, y1 - y0, z1 - z0, 1e-6);
    this.buildGrid(m.bbox);
    if (fit) this.resetView();
    this.draw();
  }

  buildGrid([x0, y0, z0, x1, y1, z1]) {
    const gl = this.gl;
    const span = Math.max(Math.abs(x0), Math.abs(x1), Math.abs(y0), Math.abs(y1), this.extent) * 1.4;
    const raw = span / 6, mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 5, 10].map((k) => k * mag).find((s) => s >= raw);
    const n = Math.ceil(span / step), lim = n * step, z = z0;
    const v = [];
    for (let i = -n; i <= n; i++) { v.push(i * step, -lim, z, i * step, lim, z, -lim, i * step, z, lim, i * step, z); }
    this.gridCount = v.length / 3;
    const L = Math.max(lim * 0.6, this.extent * 0.7);
    v.push(0, 0, z, L, 0, z, 0, 0, z, 0, L, z, 0, 0, z, 0, 0, z + L);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
  }

  resetView() {
    if (!this.mesh) { this.dist = 3; this.target = [0, 0, 0]; this.az = -0.9; this.el = 0.45; this.draw(); return; }
    const [x0, y0, z0, x1, y1, z1] = this.mesh.bbox;
    this.target = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    this.dist = this.extent * 2.3; this.az = -0.9; this.el = 0.45;
    this.draw();
  }

  // camera: z up. Orbit around target at distance dist.
  matrices() {
    const { az, el, dist, target } = this;
    const ce = Math.cos(el), se = Math.sin(el), ca = Math.cos(az), sa = Math.sin(az);
    const eye = [target[0] + dist * ce * sa, target[1] - dist * ce * ca, target[2] + dist * se];
    // forward f (eye -> target), right r = f x up, true up u = r x f
    let f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]; const fl = Math.hypot(...f); f = f.map((x) => x / fl);
    let r = [f[1], -f[0], 0]; const rl = Math.hypot(...r) || 1; r = r.map((x) => x / rl);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    // view maps world to camera space where the camera looks down -z and y is up; our shader's lighting uses y as up on screen
    const view = new Float32Array([r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -d(r, eye), -d(u, eye), d(f, eye), 1]);
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const proj = perspective((35 * Math.PI) / 180, aspect, this.dist * 0.02, this.dist * 20 + this.extent * 10);
    return { view, proj, right: r, up: u };
  }

  draw() {
    if (!this.ok || this.pending) return;
    this.pending = requestAnimationFrame(() => { this.pending = 0; this.render(); });
  }

  render() {
    const gl = this.gl, c = this.canvas, dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    gl.viewport(0, 0, w, h);
    gl.clearColor(...this.colors.bg, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!this.mesh) return;
    const { view, proj } = this.matrices();
    gl.useProgram(this.line);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.line, 'uProj'), false, proj); gl.uniformMatrix4fv(gl.getUniformLocation(this.line, 'uView'), false, view);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gridBuf);
    const lp = gl.getAttribLocation(this.line, 'aPos'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 3, gl.FLOAT, false, 0, 0);
    const lc = gl.getUniformLocation(this.line, 'uColor');
    gl.uniform4f(lc, ...this.colors.grid, 1); gl.drawArrays(gl.LINES, 0, this.gridCount);
    [[1, 0.2, 0.2], [0.25, 0.65, 0.25], [0.25, 0.45, 0.95]].forEach((rgb, i) => { gl.uniform4f(lc, ...rgb, 1); gl.drawArrays(gl.LINES, this.gridCount + 2 * i, 2); });
    gl.useProgram(this.solid);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.solid, 'uProj'), false, proj); gl.uniformMatrix4fv(gl.getUniformLocation(this.solid, 'uView'), false, view);
    gl.uniform3f(gl.getUniformLocation(this.solid, 'uColor'), ...this.colors.mesh);
    gl.uniform3f(gl.getUniformLocation(this.solid, 'uSky'), 1, 1, 1); gl.uniform3f(gl.getUniformLocation(this.solid, 'uGround'), 0.55, 0.5, 0.45);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshBuf);
    const ap = gl.getAttribLocation(this.solid, 'aPos'), an = gl.getAttribLocation(this.solid, 'aNormal');
    gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(an); gl.vertexAttribPointer(an, 3, gl.FLOAT, false, 24, 12);
    gl.drawArrays(gl.TRIANGLES, 0, this.mesh.count);
  }

  // ---- input
  orbit(dx, dy) { this.az -= dx; this.el = Math.max(-1.5, Math.min(1.5, this.el + dy)); this.draw(); }
  zoom(factor) { this.dist = Math.max(this.extent * 0.15, Math.min(this.extent * 40, this.dist * factor)); this.draw(); }
  pan(dx, dy) {  // in pixels of the canvas
    const { right, up } = this.matrices(), k = (2 * this.dist * Math.tan((35 * Math.PI) / 360)) / Math.max(1, this.canvas.clientHeight);
    for (let i = 0; i < 3; i++) this.target[i] += (-right[i] * dx + up[i] * dy) * k;
    this.draw();
  }

  bind() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(Math.exp(e.deltaY * 0.0015)); }, { passive: false });
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); c.focus({ preventScroll: true }); });
    c.addEventListener('pointerup', (e) => this.pointers.delete(e.pointerId));
    c.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
    c.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId); if (!prev) return;
      const now = { x: e.clientX, y: e.clientY };
      if (this.pointers.size === 1) {
        const dx = now.x - prev.x, dy = now.y - prev.y;
        if (e.shiftKey || e.buttons & 6) this.pan(dx, dy); else this.orbit(dx * 0.008, dy * 0.008);
      } else if (this.pointers.size === 2) {
        const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)[1];
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(now.x - other.x, now.y - other.y);
        if (d0 > 0 && d1 > 0) this.zoom(d0 / d1);
        this.pan((now.x - prev.x) / 2, (now.y - prev.y) / 2);
      }
      this.pointers.set(e.pointerId, now);
    });
    c.addEventListener('keydown', (e) => {
      const step = 0.12, px = 30; let used = true;
      switch (e.key) {
        case 'ArrowLeft': e.shiftKey ? this.pan(px, 0) : this.orbit(-step, 0); break;
        case 'ArrowRight': e.shiftKey ? this.pan(-px, 0) : this.orbit(step, 0); break;
        case 'ArrowUp': e.shiftKey ? this.pan(0, px) : this.orbit(0, step); break;
        case 'ArrowDown': e.shiftKey ? this.pan(0, -px) : this.orbit(0, -step); break;
        case '+': case '=': this.zoom(0.85); break;
        case '-': case '_': this.zoom(1 / 0.85); break;
        case '0': case 'Home': this.resetView(); break;
        default: used = false;
      }
      if (used) e.preventDefault();
    });
  }
}
