// Mesh helpers: smooth normals with creases, and binary STL.

// Non-indexed vertex data for drawing: three corners per face, each with a normal that averages the faces around its vertex whose normals lie
// within `creaseDeg` of this face's normal, so a curved surface shades smoothly and a cube keeps its edges.
export function shadedTriangles(pos, tri, creaseDeg = 40) {
  const nf = tri.length / 3, nv = pos.length / 3;
  const fn = new Float64Array(nf * 3);        // area-weighted face normals (length = twice the area)
  const unit = new Float64Array(nf * 3);
  for (let f = 0; f < nf; f++) {
    const a = tri[3 * f] * 3, b = tri[3 * f + 1] * 3, c = tri[3 * f + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    fn[3 * f] = nx; fn[3 * f + 1] = ny; fn[3 * f + 2] = nz;
    const l = Math.hypot(nx, ny, nz) || 1;
    unit[3 * f] = nx / l; unit[3 * f + 1] = ny / l; unit[3 * f + 2] = nz / l;
  }
  // faces around each vertex, as a compressed list
  const start = new Uint32Array(nv + 1);
  for (let i = 0; i < tri.length; i++) start[tri[i] + 1]++;
  for (let v = 0; v < nv; v++) start[v + 1] += start[v];
  const fill = start.slice(0, nv), around = new Uint32Array(tri.length);
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) around[fill[tri[3 * f + k]]++] = f;
  const cosCrease = Math.cos((creaseDeg * Math.PI) / 180);
  const out = new Float32Array(nf * 3 * 6);
  let o = 0;
  for (let f = 0; f < nf; f++) {
    for (let k = 0; k < 3; k++) {
      const v = tri[3 * f + k];
      let sx = 0, sy = 0, sz = 0;
      for (let j = start[v]; j < start[v + 1]; j++) {
        const g = around[j];
        if (unit[3 * g] * unit[3 * f] + unit[3 * g + 1] * unit[3 * f + 1] + unit[3 * g + 2] * unit[3 * f + 2] >= cosCrease) {
          sx += fn[3 * g]; sy += fn[3 * g + 1]; sz += fn[3 * g + 2];
        }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      out[o++] = pos[3 * v]; out[o++] = pos[3 * v + 1]; out[o++] = pos[3 * v + 2];
      out[o++] = sx / l; out[o++] = sy / l; out[o++] = sz / l;
    }
  }
  return out;
}

// Binary STL (80-byte header, count, then normal and three corners as f32 and a zero attribute word per face).
export function binaryStl(pos, tri) {
  const nf = tri.length / 3;
  const buf = new ArrayBuffer(84 + 50 * nf);
  const dv = new DataView(buf);
  new TextEncoder().encodeInto('fib-solid demo', new Uint8Array(buf, 0, 80));
  dv.setUint32(80, nf, true);
  let at = 84;
  for (let f = 0; f < nf; f++) {
    const a = tri[3 * f] * 3, b = tri[3 * f + 1] * 3, c = tri[3 * f + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (const x of [nx, ny, nz, pos[a], pos[a + 1], pos[a + 2], pos[b], pos[b + 1], pos[b + 2], pos[c], pos[c + 1], pos[c + 2]]) { dv.setFloat32(at, x, true); at += 4; }
    at += 2;
  }
  return buf;
}
