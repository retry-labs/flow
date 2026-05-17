// -----------------------------------------------------------
// Force-directed (Fruchterman-Reingold) layout.
//
// Hand-rolled, zero deps. Iterative simulation:
//   - Each node repels every other node (1/r² gravity-like force).
//   - Each edge attracts its endpoints (Hooke's-law spring).
//   - Temperature cools each step, damping movement.
//
// Reasonable for graphs up to ~200 nodes. For larger graphs, layered
// (dagre) or radial is faster and looks better.
//
// Mutates each node's x/y/w/h in place. Returns the input array.
// -----------------------------------------------------------

const DEFAULTS = {
  iters:    180,    // number of simulation steps
  k:        110,    // ideal edge length (px)
  area:     800,    // initial bounding-box side
  cool:     0.95,   // temperature multiplier per iteration
  startT:   60,     // initial max displacement per step (px)
  nodeW:    150,
  nodeH:    70,
  marginX:  60,
  marginY:  60,
};

export function layoutForce(nodes, edges, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };

  const layoutables = (nodes || []).filter(n => n && n.kind !== 'boundary');
  if (layoutables.length === 0) return nodes;

  for (const n of layoutables) {
    n.w = n.w || cfg.nodeW;
    n.h = n.h || cfg.nodeH;
  }

  const ids = layoutables.map(n => n.id);
  const idSet = new Set(ids);
  const idx = Object.fromEntries(ids.map((id, i) => [id, i]));

  // Seed positions: random inside a square of side `area`. Deterministic
  // per-id seed so the same DSL always lays out the same way.
  const N = ids.length;
  const pos = new Array(N);
  for (let i = 0; i < N; i++) {
    const seed = hash(ids[i]);
    pos[i] = {
      x: ((seed * 9301 + 49297) % 233280) / 233280 * cfg.area,
      y: ((seed * 49297 + 9301) % 233280) / 233280 * cfg.area,
    };
  }

  // Edge list filtered to layoutable endpoints.
  const E = [];
  for (const e of edges || []) {
    if (idSet.has(e.from) && idSet.has(e.to) && e.from !== e.to) {
      E.push([idx[e.from], idx[e.to]]);
    }
  }

  // Fruchterman-Reingold loop.
  const k = cfg.k;
  let temp = cfg.startT;
  const disp = new Array(N);
  for (let i = 0; i < N; i++) disp[i] = { x: 0, y: 0 };

  for (let iter = 0; iter < cfg.iters; iter++) {
    // Reset displacements.
    for (let i = 0; i < N; i++) { disp[i].x = 0; disp[i].y = 0; }

    // Repulsion between every pair.
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          // Two nodes coincide. Perturb with a deterministic offset
          // derived from (i, j, iter) so repeated layouts of the same
          // graph still produce identical output.
          const seed = (i + 1) * 31 + (j + 1) * 17 + iter;
          dx = Math.cos(seed) * 0.7;
          dy = Math.sin(seed) * 0.7;
          d2 = dx * dx + dy * dy;
        }
        const d = Math.sqrt(d2);
        const f = (k * k) / d;
        const ux = dx / d, uy = dy / d;
        disp[i].x += ux * f; disp[i].y += uy * f;
        disp[j].x -= ux * f; disp[j].y -= uy * f;
      }
    }

    // Attraction along edges.
    for (const [a, b] of E) {
      const dx = pos[a].x - pos[b].x;
      const dy = pos[a].y - pos[b].y;
      const d = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));
      const f = (d * d) / k;
      const ux = dx / d, uy = dy / d;
      disp[a].x -= ux * f; disp[a].y -= uy * f;
      disp[b].x += ux * f; disp[b].y += uy * f;
    }

    // Apply displacement, capped by temperature.
    for (let i = 0; i < N; i++) {
      const dlen = Math.max(0.01, Math.hypot(disp[i].x, disp[i].y));
      const scale = Math.min(dlen, temp) / dlen;
      pos[i].x += disp[i].x * scale;
      pos[i].y += disp[i].y * scale;
    }

    temp *= cfg.cool;
  }

  // Normalize: shift so min corner is at (marginX, marginY).
  let minX = Infinity, minY = Infinity;
  for (let i = 0; i < N; i++) {
    if (pos[i].x < minX) minX = pos[i].x;
    if (pos[i].y < minY) minY = pos[i].y;
  }
  const dx = cfg.marginX - minX;
  const dy = cfg.marginY - minY;
  for (let i = 0; i < N; i++) {
    const n = layoutables[i];
    if (n.x === undefined) n.x = Math.round(pos[i].x + dx);
    if (n.y === undefined) n.y = Math.round(pos[i].y + dy);
  }

  return nodes;
}

// Small deterministic string hash for seeding.
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default layoutForce;
