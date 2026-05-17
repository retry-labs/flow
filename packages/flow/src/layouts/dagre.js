// -----------------------------------------------------------
// Dagre-style layered (Sugiyama) layout.
//
// Implements the same three phases dagre uses, just hand-rolled to
// avoid the ~150 KB npm dep:
//
//   1. Rank assignment — longest-path layering.
//   2. Crossing minimization — barycenter / median heuristic with
//      forward + backward sweeps to settle node order within layers.
//   3. Coordinate assignment — average parent / child x for each
//      node, then spread out to honour minimum spacing.
//
// Produces materially better layouts than the rank-based fallback,
// especially on graphs with many cross-layer edges. For a typical
// architecture diagram (10-30 nodes), it adds <1 ms over the rank
// engine and noticeably reduces edge crossings.
//
// Mutates each node's x, y, w, h in place. Returns the input nodes.
// -----------------------------------------------------------

const DEFAULTS = {
  rankDir:  'LR',     // 'LR' (left → right) or 'TB' (top → bottom)
  nodeSep:  60,       // horizontal gap between nodes in the same layer
  rankSep:  120,      // gap between layers
  marginX:  60,       // outer margin
  marginY:  60,
  nodeW:    150,
  nodeH:    70,
  iters:    24,       // sweep iterations for crossing minimization
};

export function layoutDagre(nodes, edges, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };

  // Boundaries are layout containers — don't position them as nodes.
  const layoutables = (nodes || []).filter(n => n && n.kind !== 'boundary');
  if (layoutables.length === 0) return nodes;

  // Ensure every node has w/h before we start (other code paths may
  // rely on these defaults).
  for (const n of layoutables) {
    n.w = n.w || cfg.nodeW;
    n.h = n.h || cfg.nodeH;
  }

  const ids = layoutables.map(n => n.id);
  const idSet = new Set(ids);
  const idx = Object.fromEntries(ids.map((id, i) => [id, i]));

  // Build adjacency (only edges where both ends are layoutable).
  const outAdj = ids.map(() => []);
  const inAdj  = ids.map(() => []);
  for (const e of edges || []) {
    if (idSet.has(e.from) && idSet.has(e.to) && e.from !== e.to) {
      outAdj[idx[e.from]].push(idx[e.to]);
      inAdj[idx[e.to]].push(idx[e.from]);
    }
  }

  // ── 1. Rank assignment (longest-path from any source) ─────
  // Use a bounded relaxation: each node is enqueued at most N times
  // where N is the number of nodes (the longest possible path in an
  // acyclic graph). Cycles still terminate; the resulting rank may
  // be slightly suboptimal in cyclic cases but cycles are uncommon
  // in DAG-oriented diagrams and the visuals still render.
  const rank = new Array(ids.length).fill(-1);
  const queue = [];
  for (let i = 0; i < ids.length; i++) {
    if (inAdj[i].length === 0) { rank[i] = 0; queue.push(i); }
  }
  if (queue.length === 0) {
    rank[0] = 0; queue.push(0);
  }
  const maxIters = ids.length * ids.length + 1;  // hard cap
  let iters = 0;
  while (queue.length && iters++ < maxIters) {
    const i = queue.shift();
    for (const j of outAdj[i]) {
      const r = rank[i] + 1;
      if (rank[j] < r && r < ids.length) {
        rank[j] = r;
        queue.push(j);
      }
    }
  }
  for (let i = 0; i < rank.length; i++) if (rank[i] < 0) rank[i] = 0;

  // Group node indices by layer.
  const maxRank = Math.max(...rank);
  const layers = Array.from({ length: maxRank + 1 }, () => []);
  for (let i = 0; i < ids.length; i++) layers[rank[i]].push(i);

  // ── 2. Crossing minimization via barycenter sweeps ────────
  // We track an order-within-layer (orderInLayer[idx] = position) and
  // iterate: alternately compute median of neighbours from the
  // adjacent layer above (down sweep) or below (up sweep), then
  // resort the layer by that median.

  // Initial order: insertion order within each layer.
  const orderInLayer = new Array(ids.length).fill(0);
  for (const layer of layers) {
    layer.forEach((nodeIdx, pos) => { orderInLayer[nodeIdx] = pos; });
  }

  function medianFromLayer(nodeIdx, fromLayer) {
    const neighbours = fromLayer === 'up' ? inAdj[nodeIdx] : outAdj[nodeIdx];
    if (neighbours.length === 0) return orderInLayer[nodeIdx];
    const positions = neighbours.map(n => orderInLayer[n]).sort((a, b) => a - b);
    const mid = positions.length >>> 1;
    return positions.length % 2 ? positions[mid] : (positions[mid - 1] + positions[mid]) / 2;
  }

  function sweep(direction /* 'down' | 'up' */) {
    const seq = direction === 'down'
      ? layers.slice(1)            // process layers 1..N referring to layer above
      : layers.slice(0, -1).reverse(); // process layers N-1..0 referring to layer below
    for (const layer of seq) {
      const medians = layer.map(i => [i, medianFromLayer(i, direction === 'down' ? 'up' : 'down')]);
      medians.sort((a, b) => a[1] - b[1]);
      layer.length = 0;
      medians.forEach(([i], pos) => { layer.push(i); orderInLayer[i] = pos; });
    }
  }

  for (let it = 0; it < cfg.iters; it++) {
    sweep('down');
    sweep('up');
  }

  // ── 3. Coordinate assignment ──────────────────────────────
  // For 'LR' (left-to-right) we treat each layer as a vertical
  // column. For 'TB' (top-to-bottom) layers are horizontal rows.
  const isLR = cfg.rankDir === 'LR';

  // First, place nodes in their layer using barycentre of neighbours
  // (averaged across the adjacent layers) to keep edges short.
  const positions = ids.map(() => ({ x: 0, y: 0 }));

  // Stride per layer
  const layerStride = cfg.rankSep + maxNodeExtent(layoutables, isLR ? 'w' : 'h');

  layers.forEach((layer, layerIdx) => {
    // Initial pass: spread along the secondary axis evenly.
    const stride = cfg.nodeSep + maxNodeExtent(
      layer.map(i => layoutables[i]),
      isLR ? 'h' : 'w',
    );
    const total = layer.length;
    const span = stride * (total - 1);
    layer.forEach((nodeIdx, pos) => {
      const offset = pos * stride - span / 2;
      if (isLR) {
        positions[nodeIdx].x = cfg.marginX + layerIdx * layerStride;
        positions[nodeIdx].y = cfg.marginY + offset + 200;  // 200 = baseline
      } else {
        positions[nodeIdx].x = cfg.marginX + offset + 400;
        positions[nodeIdx].y = cfg.marginY + layerIdx * layerStride;
      }
    });
  });

  // Smoothing pass: nudge each node toward the average of its
  // neighbours (a quick relaxation that materially reduces edge bends).
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < ids.length; i++) {
      const neighbours = [...inAdj[i], ...outAdj[i]];
      if (neighbours.length === 0) continue;
      const avg = neighbours.reduce(
        (a, j) => a + (isLR ? positions[j].y : positions[j].x),
        0,
      ) / neighbours.length;
      if (isLR) positions[i].y = positions[i].y * 0.7 + avg * 0.3;
      else      positions[i].x = positions[i].x * 0.7 + avg * 0.3;
    }
  }

  // Detect overlap on the secondary axis within each layer and
  // de-overlap by spreading neighbours apart.
  layers.forEach((layer) => {
    if (layer.length <= 1) return;
    // Sort by current secondary-axis position to preserve crossing order.
    const sortedLayer = [...layer].sort((a, b) =>
      isLR ? positions[a].y - positions[b].y : positions[a].x - positions[b].x,
    );
    for (let p = 1; p < sortedLayer.length; p++) {
      const prev = layoutables[sortedLayer[p - 1]];
      const curr = layoutables[sortedLayer[p]];
      const minGap = (isLR
        ? (prev.h / 2 + curr.h / 2)
        : (prev.w / 2 + curr.w / 2)) + cfg.nodeSep;
      const prevPos = isLR ? positions[sortedLayer[p - 1]].y : positions[sortedLayer[p - 1]].x;
      const currPos = isLR ? positions[sortedLayer[p]].y      : positions[sortedLayer[p]].x;
      if (currPos - prevPos < minGap) {
        if (isLR) positions[sortedLayer[p]].y = prevPos + minGap;
        else      positions[sortedLayer[p]].x = prevPos + minGap;
      }
    }
  });

  // Apply positions to the original nodes (only when x/y are missing
  // — so explicit positions in DSL still win).
  for (let i = 0; i < layoutables.length; i++) {
    const n = layoutables[i];
    if (n.x === undefined) n.x = Math.round(positions[i].x);
    if (n.y === undefined) n.y = Math.round(positions[i].y);
  }

  return nodes;
}

function maxNodeExtent(nodes, axis) {
  let max = 0;
  for (const n of nodes) {
    const v = axis === 'w' ? (n.w || 150) : (n.h || 70);
    if (v > max) max = v;
  }
  return max;
}

export default layoutDagre;
