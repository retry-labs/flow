(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('react')) :
  typeof define === 'function' && define.amd ? define(['exports', 'react'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.RLFlow = {}, global.React));
})(this, (function (exports, React) { 'use strict';

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

  const DEFAULTS$2 = {
    rankDir: 'LR',
    // 'LR' (left → right) or 'TB' (top → bottom)
    nodeSep: 60,
    // horizontal gap between nodes in the same layer
    rankSep: 120,
    // gap between layers
    marginX: 60,
    // outer margin
    marginY: 60,
    nodeW: 150,
    nodeH: 70,
    iters: 24 // sweep iterations for crossing minimization
  };
  function layoutDagre(nodes, edges, opts = {}) {
    const cfg = {
      ...DEFAULTS$2,
      ...opts
    };

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
    const inAdj = ids.map(() => []);
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
      if (inAdj[i].length === 0) {
        rank[i] = 0;
        queue.push(i);
      }
    }
    if (queue.length === 0) {
      rank[0] = 0;
      queue.push(0);
    }
    const maxIters = ids.length * ids.length + 1; // hard cap
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
    const layers = Array.from({
      length: maxRank + 1
    }, () => []);
    for (let i = 0; i < ids.length; i++) layers[rank[i]].push(i);

    // ── 2. Crossing minimization via barycenter sweeps ────────
    // We track an order-within-layer (orderInLayer[idx] = position) and
    // iterate: alternately compute median of neighbours from the
    // adjacent layer above (down sweep) or below (up sweep), then
    // resort the layer by that median.

    // Initial order: insertion order within each layer.
    const orderInLayer = new Array(ids.length).fill(0);
    for (const layer of layers) {
      layer.forEach((nodeIdx, pos) => {
        orderInLayer[nodeIdx] = pos;
      });
    }
    function medianFromLayer(nodeIdx, fromLayer) {
      const neighbours = fromLayer === 'up' ? inAdj[nodeIdx] : outAdj[nodeIdx];
      if (neighbours.length === 0) return orderInLayer[nodeIdx];
      const positions = neighbours.map(n => orderInLayer[n]).sort((a, b) => a - b);
      const mid = positions.length >>> 1;
      return positions.length % 2 ? positions[mid] : (positions[mid - 1] + positions[mid]) / 2;
    }
    function sweep(direction /* 'down' | 'up' */) {
      const seq = direction === 'down' ? layers.slice(1) // process layers 1..N referring to layer above
      : layers.slice(0, -1).reverse(); // process layers N-1..0 referring to layer below
      for (const layer of seq) {
        const medians = layer.map(i => [i, medianFromLayer(i, direction === 'down' ? 'up' : 'down')]);
        medians.sort((a, b) => a[1] - b[1]);
        layer.length = 0;
        medians.forEach(([i], pos) => {
          layer.push(i);
          orderInLayer[i] = pos;
        });
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
    const positions = ids.map(() => ({
      x: 0,
      y: 0
    }));

    // Stride per layer
    const layerStride = cfg.rankSep + maxNodeExtent(layoutables, isLR ? 'w' : 'h');
    layers.forEach((layer, layerIdx) => {
      // Initial pass: spread along the secondary axis evenly.
      const stride = cfg.nodeSep + maxNodeExtent(layer.map(i => layoutables[i]), isLR ? 'h' : 'w');
      const total = layer.length;
      const span = stride * (total - 1);
      layer.forEach((nodeIdx, pos) => {
        const offset = pos * stride - span / 2;
        if (isLR) {
          positions[nodeIdx].x = cfg.marginX + layerIdx * layerStride;
          positions[nodeIdx].y = cfg.marginY + offset + 200; // 200 = baseline
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
        const avg = neighbours.reduce((a, j) => a + (isLR ? positions[j].y : positions[j].x), 0) / neighbours.length;
        if (isLR) positions[i].y = positions[i].y * 0.7 + avg * 0.3;else positions[i].x = positions[i].x * 0.7 + avg * 0.3;
      }
    }

    // Detect overlap on the secondary axis within each layer and
    // de-overlap by spreading neighbours apart.
    layers.forEach(layer => {
      if (layer.length <= 1) return;
      // Sort by current secondary-axis position to preserve crossing order.
      const sortedLayer = [...layer].sort((a, b) => isLR ? positions[a].y - positions[b].y : positions[a].x - positions[b].x);
      for (let p = 1; p < sortedLayer.length; p++) {
        const prev = layoutables[sortedLayer[p - 1]];
        const curr = layoutables[sortedLayer[p]];
        const minGap = (isLR ? prev.h / 2 + curr.h / 2 : prev.w / 2 + curr.w / 2) + cfg.nodeSep;
        const prevPos = isLR ? positions[sortedLayer[p - 1]].y : positions[sortedLayer[p - 1]].x;
        const currPos = isLR ? positions[sortedLayer[p]].y : positions[sortedLayer[p]].x;
        if (currPos - prevPos < minGap) {
          if (isLR) positions[sortedLayer[p]].y = prevPos + minGap;else positions[sortedLayer[p]].x = prevPos + minGap;
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
      const v = axis === 'w' ? n.w || 150 : n.h || 70;
      if (v > max) max = v;
    }
    return max;
  }

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

  const DEFAULTS$1 = {
    iters: 180,
    // number of simulation steps
    k: 110,
    // ideal edge length (px)
    area: 800,
    // initial bounding-box side
    cool: 0.95,
    // temperature multiplier per iteration
    startT: 60,
    // initial max displacement per step (px)
    nodeW: 150,
    nodeH: 70,
    marginX: 60,
    marginY: 60
  };
  function layoutForce(nodes, edges, opts = {}) {
    const cfg = {
      ...DEFAULTS$1,
      ...opts
    };
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
        x: (seed * 9301 + 49297) % 233280 / 233280 * cfg.area,
        y: (seed * 49297 + 9301) % 233280 / 233280 * cfg.area
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
    for (let i = 0; i < N; i++) disp[i] = {
      x: 0,
      y: 0
    };
    for (let iter = 0; iter < cfg.iters; iter++) {
      // Reset displacements.
      for (let i = 0; i < N; i++) {
        disp[i].x = 0;
        disp[i].y = 0;
      }

      // Repulsion between every pair.
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          let dx = pos[i].x - pos[j].x;
          let dy = pos[i].y - pos[j].y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d2 = 0.5;
          }
          const d = Math.sqrt(d2);
          const f = k * k / d;
          const ux = dx / d,
            uy = dy / d;
          disp[i].x += ux * f;
          disp[i].y += uy * f;
          disp[j].x -= ux * f;
          disp[j].y -= uy * f;
        }
      }

      // Attraction along edges.
      for (const [a, b] of E) {
        const dx = pos[a].x - pos[b].x;
        const dy = pos[a].y - pos[b].y;
        const d = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));
        const f = d * d / k;
        const ux = dx / d,
          uy = dy / d;
        disp[a].x -= ux * f;
        disp[a].y -= uy * f;
        disp[b].x += ux * f;
        disp[b].y += uy * f;
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
    let minX = Infinity,
      minY = Infinity;
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
    for (let i = 0; i < s.length; i++) h = (h << 5) + h + s.charCodeAt(i) | 0;
    return Math.abs(h);
  }

  // -----------------------------------------------------------
  // Radial layout — root in the center, children fanned out in
  // concentric rings. The right choice for mindmaps, classification
  // hierarchies, and small "central-concept" diagrams.
  //
  // Algorithm:
  //   1. Pick a root. Either the first node with no incoming edges,
  //      or a node explicitly tagged `root: true`, or simply nodes[0].
  //   2. BFS to assign depth (= ring number) to each reachable node.
  //   3. For each ring, distribute children evenly on an arc whose
  //      total angle is proportional to the subtree size — so dense
  //      branches get more space than sparse ones.
  //
  // Hand-rolled, zero deps. Mutates node x/y/w/h in place.
  // -----------------------------------------------------------

  const DEFAULTS = {
    ringStep: 140,
    // px between concentric rings
    cx: 400,
    // center x
    cy: 300,
    // center y
    startAng: -Math.PI / 2,
    // first child placed straight up
    totalAng: 2 * Math.PI,
    // full circle
    nodeW: 140,
    nodeH: 70
  };
  function layoutRadial(nodes, edges, opts = {}) {
    const cfg = {
      ...DEFAULTS,
      ...opts
    };
    const layoutables = (nodes || []).filter(n => n && n.kind !== 'boundary');
    if (layoutables.length === 0) return nodes;
    for (const n of layoutables) {
      n.w = n.w || cfg.nodeW;
      n.h = n.h || cfg.nodeH;
    }
    const idx = Object.fromEntries(layoutables.map((n, i) => [n.id, i]));
    const N = layoutables.length;

    // Build adjacency (directed, parent → child).
    const children = layoutables.map(() => []);
    for (const e of edges || []) {
      if (idx[e.from] !== undefined && idx[e.to] !== undefined && e.from !== e.to) {
        children[idx[e.from]].push(idx[e.to]);
      }
    }

    // Pick a root.
    let rootIdx = layoutables.findIndex(n => n.root === true);
    if (rootIdx < 0) {
      const inDeg = new Array(N).fill(0);
      for (const list of children) for (const c of list) inDeg[c]++;
      rootIdx = inDeg.findIndex(d => d === 0);
      if (rootIdx < 0) rootIdx = 0;
    }

    // BFS depth assignment.
    const depth = new Array(N).fill(-1);
    depth[rootIdx] = 0;
    const queue = [rootIdx];
    while (queue.length) {
      const i = queue.shift();
      for (const c of children[i]) {
        if (depth[c] < 0) {
          depth[c] = depth[i] + 1;
          queue.push(c);
        }
      }
    }
    for (let i = 0; i < N; i++) if (depth[i] < 0) depth[i] = 1; // disconnected → ring 1

    // Subtree-size weighted angular distribution. We assign each child
    // an angular slice proportional to the number of descendants it
    // carries; that way busy branches don't bunch up.
    const size = new Array(N).fill(0);
    function computeSize(i, visited) {
      if (visited.has(i)) return 1;
      visited.add(i);
      let s = 1;
      for (const c of children[i]) s += computeSize(c, visited);
      size[i] = s;
      return s;
    }
    computeSize(rootIdx, new Set());

    // Each node has an angle interval [angStart, angEnd]. Children of
    // a node split their parent's interval proportionally to size[c].
    const angStart = new Array(N).fill(0);
    const angEnd = new Array(N).fill(0);
    angStart[rootIdx] = cfg.startAng;
    angEnd[rootIdx] = cfg.startAng + cfg.totalAng;
    function placeChildren(i, visited) {
      if (visited.has(i)) return;
      visited.add(i);
      const kids = children[i].filter(c => !visited.has(c));
      if (kids.length === 0) return;
      const totalKidSize = kids.reduce((a, c) => a + (size[c] || 1), 0);
      const span = angEnd[i] - angStart[i];
      let cursor = angStart[i];
      for (const c of kids) {
        const slice = (size[c] || 1) / totalKidSize * span;
        angStart[c] = cursor;
        angEnd[c] = cursor + slice;
        cursor += slice;
      }
      for (const c of kids) placeChildren(c, visited);
    }
    placeChildren(rootIdx, new Set());

    // Place each node at the midpoint of its angle slice on its ring.
    for (let i = 0; i < N; i++) {
      const ring = depth[i];
      const mid = (angStart[i] + angEnd[i]) / 2;
      const r = ring * cfg.ringStep;
      const n = layoutables[i];
      if (n.x === undefined) n.x = Math.round(cfg.cx + Math.cos(mid) * r - n.w / 2);
      if (n.y === undefined) n.y = Math.round(cfg.cy + Math.sin(mid) * r - n.h / 2);
    }
    return nodes;
  }

  // -----------------------------------------------------------
  // Layout engine registry.
  //
  // A layout engine takes (nodes, edges, opts) and mutates each node's
  // {x, y, w, h} in place (or returns positions to be applied). Engines
  // only run when at least one node is missing x/y.
  //
  // Built-in engines registered by this module:
  //
  //   - 'rank'   : the original left-to-right rank-based layout
  //                (rank = longest path from a source; nodes per rank
  //                stacked vertically). Cheap, predictable.
  //
  //   - 'dagre'  : DAG-aware Sugiyama-style layered layout. Best for
  //                flow/architecture/state/ER diagrams with clear
  //                direction.
  //
  //   - 'force'  : Fruchterman-Reingold force simulation. Best for
  //                network / undirected / mindmap diagrams.
  //
  //   - 'radial' : Root-centred tree placement. Best for mindmaps.
  //
  // New engines call `registerLayout(name, fn)` from their own module.
  // The runtime `layout:` directive in DSL selects an engine per graph.
  // -----------------------------------------------------------

  const LAYOUT_ENGINES = new Map();
  function registerLayout(name, fn) {
    if (!name || typeof name !== 'string') {
      throw new Error('registerLayout: name must be a non-empty string');
    }
    if (typeof fn !== 'function') {
      throw new Error('registerLayout: fn must be a function');
    }
    if (LAYOUT_ENGINES.has(name)) {
      // eslint-disable-next-line no-console
      console.warn(`registerLayout: engine "${name}" is being overwritten`);
    }
    LAYOUT_ENGINES.set(name, fn);
  }
  function getLayout(name) {
    if (!name) return null;
    return LAYOUT_ENGINES.get(name) || null;
  }

  // Register the built-in engines once at module load. New types call
  // `registerLayout(...)` from their own modules.
  //
  // The 'rank' engine is registered lazily by graph.js to avoid a
  // circular import (graph.js owns autoLayout, layouts/index.js is
  // imported by graph.js).
  registerLayout('dagre', layoutDagre);
  registerLayout('force', layoutForce);
  registerLayout('radial', layoutRadial);

  // -----------------------------------------------------------
  // Graph IR — the shared data model all styles render from.
  // A diagram is: { nodes, edges, steps, canvas }
  // - node.kind drives which renderer shape is used
  // - edge.path is computed from node positions (orthogonal router)
  // - step.highlight marks nodes + edges active at each step
  // -----------------------------------------------------------

  const NODE_KINDS = {
    service: {
      label: 'Service',
      shape: 'rect',
      icon: 'square'
    },
    store: {
      label: 'Database',
      shape: 'cylinder',
      icon: 'cylinder'
    },
    cache: {
      label: 'Cache',
      shape: 'rect',
      icon: 'disk'
    },
    queue: {
      label: 'Queue',
      shape: 'rect',
      icon: 'stack'
    },
    actor: {
      label: 'Client',
      shape: 'rect',
      icon: 'person'
    },
    gateway: {
      label: 'Gateway',
      shape: 'hex',
      icon: 'diamond'
    },
    external: {
      label: 'External',
      shape: 'cloud',
      icon: 'cloud'
    },
    boundary: {
      label: 'Boundary',
      shape: 'rect',
      icon: 'group'
    },
    start: {
      label: 'Start',
      shape: 'pill',
      icon: 'play'
    },
    stop: {
      label: 'Stop',
      shape: 'pill',
      icon: 'square'
    },
    decision: {
      label: 'Decision',
      shape: 'diamond',
      icon: 'qmark'
    },
    process: {
      label: 'Process',
      shape: 'square',
      icon: 'cog'
    },
    event: {
      label: 'Event',
      shape: 'circle',
      icon: 'bolt'
    },
    step: {
      label: 'Step',
      shape: 'oval',
      icon: 'dot'
    },
    tree: {
      label: 'Tree node',
      shape: 'circle',
      icon: 'dot'
    },
    image: {
      label: 'Logo',
      shape: 'rect',
      icon: 'image'
    },
    function: {
      label: 'Function',
      shape: 'rect',
      icon: 'lambda'
    },
    worker: {
      label: 'Worker',
      shape: 'rect',
      icon: 'gear'
    },
    loadbalancer: {
      label: 'Load Balancer',
      shape: 'rect',
      icon: 'scale'
    },
    cdn: {
      label: 'CDN',
      shape: 'cloud',
      icon: 'globe'
    },
    auth: {
      label: 'Auth',
      shape: 'shield',
      icon: 'key'
    },
    monitor: {
      label: 'Monitor',
      shape: 'rect',
      icon: 'chart'
    },
    bus: {
      label: 'Event Bus',
      shape: 'rect',
      icon: 'bus'
    },
    stream: {
      label: 'Stream',
      shape: 'rect',
      icon: 'wave'
    },
    firewall: {
      label: 'Firewall',
      shape: 'rect',
      icon: 'wall'
    },
    mobile: {
      label: 'Mobile',
      shape: 'tablet',
      icon: 'phone'
    }
  };
  const SHAPES = ['rect', 'square', 'circle', 'oval', 'diamond', 'hex', 'pill', 'cylinder', 'cloud', 'parallelogram', 'shield', 'tablet', 'trapezoid', 'chevron',
  // New shapes
  'document', 'folder', 'sticky-note', 'person', 'custom-path'];
  const EXAMPLE_GRAPH = {
    canvas: {
      w: 560,
      h: 280,
      grid: 20
    },
    nodes: [{
      id: 'client',
      kind: 'actor',
      label: 'Client',
      x: 30,
      y: 110,
      w: 100,
      h: 60
    }, {
      id: 'api',
      kind: 'gateway',
      label: 'API Gateway',
      x: 170,
      y: 110,
      w: 130,
      h: 60
    }, {
      id: 'orders',
      kind: 'service',
      label: 'Orders',
      x: 340,
      y: 40,
      w: 120,
      h: 60,
      sub: 'v4.2.1'
    }, {
      id: 'db',
      kind: 'store',
      label: 'Postgres',
      x: 360,
      y: 180,
      w: 100,
      h: 70
    }],
    edges: [{
      id: 'e1',
      from: 'client',
      to: 'api',
      kind: 'solid',
      label: 'HTTPS'
    }, {
      id: 'e2',
      from: 'api',
      to: 'orders',
      kind: 'solid',
      label: 'POST /order'
    }, {
      id: 'e3',
      from: 'orders',
      to: 'db',
      kind: 'solid',
      label: 'write'
    }, {
      id: 'e4',
      from: 'api',
      to: 'db',
      kind: 'dashed',
      label: 'audit'
    }]
  };
  function shapeOf(node) {
    if (node.shape) return node.shape;
    const k = NODE_KINDS[node.kind];
    return k && k.shape || 'rect';
  }
  function nodeRect(node) {
    return {
      x: node.x,
      y: node.y,
      w: node.w,
      h: node.h
    };
  }
  function anchorOn(rect, side, t) {
    const {
      x,
      y,
      w,
      h
    } = rect;
    switch (side) {
      case 'l':
        return {
          x,
          y: y + h * t
        };
      case 'r':
        return {
          x: x + w,
          y: y + h * t
        };
      case 't':
        return {
          x: x + w * t,
          y
        };
      case 'b':
        return {
          x: x + w * t,
          y: y + h
        };
      default:
        return {
          x: x + w / 2,
          y: y + h / 2
        };
    }
  }
  function flip(side) {
    return {
      l: 'r',
      r: 'l',
      t: 'b',
      b: 't'
    }[side];
  }

  // Given the geometric relation of A→B, return the "best" sides for A (exit)
  // and B (enter) in priority order. The enter side must face A — i.e. it is the
  // opposite of the exit side, not the same one.
  function sideCandidates(A, B) {
    const aCx = A.x + A.w / 2,
      aCy = A.y + A.h / 2;
    const bCx = B.x + B.w / 2,
      bCy = B.y + B.h / 2;
    const dx = bCx - aCx,
      dy = bCy - aCy;
    const horiz = Math.abs(dx) >= Math.abs(dy);
    const exitH = dx >= 0 ? 'r' : 'l';
    const exitV = dy >= 0 ? 'b' : 't';
    const enterH = dx >= 0 ? 'l' : 'r';
    const enterV = dy >= 0 ? 't' : 'b';
    if (horiz) {
      return {
        exit: [exitH, exitV, flip(exitV), flip(exitH)],
        enter: [enterH, enterV, flip(enterV), flip(enterH)]
      };
    }
    return {
      exit: [exitV, exitH, flip(exitH), flip(exitV)],
      enter: [enterV, enterH, flip(enterH), flip(enterV)]
    };
  }
  function assignAnchors(nodes, edges) {
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    const occ = {};
    const init = () => ({
      in: [],
      out: []
    });
    nodes.forEach(n => {
      occ[n.id] = {
        l: init(),
        r: init(),
        t: init(),
        b: init()
      };
    });
    const anchors = {};
    edges.forEach(e => {
      anchors[e.id] = {};
      if (e.fromSide) {
        anchors[e.id].fromSide = e.fromSide;
        occ[e.from][e.fromSide].out.push(e.id);
      }
      if (e.toSide) {
        anchors[e.id].toSide = e.toSide;
        occ[e.to][e.toSide].in.push(e.id);
      }
    });
    const score = (nodeId, side, role, rank) => {
      const o = occ[nodeId][side];
      const other = role === 'out' ? 'in' : 'out';
      return o[other].length * 100 + o[role].length * 4 + rank * 10;
    };
    edges.forEach(e => {
      const A = nodeRect(byId[e.from]),
        B = nodeRect(byId[e.to]);
      const cands = sideCandidates(A, B);
      if (!anchors[e.id].fromSide) {
        let best = cands.exit[0],
          bestS = Infinity;
        cands.exit.forEach((side, rank) => {
          const s = score(e.from, side, 'out', rank);
          if (s < bestS) {
            bestS = s;
            best = side;
          }
        });
        anchors[e.id].fromSide = best;
        occ[e.from][best].out.push(e.id);
      }
      if (!anchors[e.id].toSide) {
        let best = cands.enter[0],
          bestS = Infinity;
        cands.enter.forEach((side, rank) => {
          const s = score(e.to, side, 'in', rank);
          if (s < bestS) {
            bestS = s;
            best = side;
          }
        });
        anchors[e.id].toSide = best;
        occ[e.to][best].in.push(e.id);
      }
    });
    const edgeT = {};
    edges.forEach(e => {
      edgeT[e.id] = {};
    });
    nodes.forEach(n => {
      ['l', 'r', 't', 'b'].forEach(side => {
        const items = [];
        occ[n.id][side].out.forEach(eid => {
          const other = byId[edges.find(e => e.id === eid).to];
          items.push({
            eid,
            role: 'out',
            c: side === 'l' || side === 'r' ? other.y + other.h / 2 : other.x + other.w / 2
          });
        });
        occ[n.id][side].in.forEach(eid => {
          const other = byId[edges.find(e => e.id === eid).from];
          items.push({
            eid,
            role: 'in',
            c: side === 'l' || side === 'r' ? other.y + other.h / 2 : other.x + other.w / 2
          });
        });
        items.sort((a, b) => a.c - b.c);
        items.forEach((it, i) => {
          const t = items.length === 1 ? 0.5 : (i + 1) / (items.length + 1);
          if (it.role === 'out') edgeT[it.eid].fromT = t;else edgeT[it.eid].toT = t;
        });
      });
    });
    return {
      anchors,
      edgeT
    };
  }
  function routeEdge(fromNode, toNode, fromSide, toSide, fromT = 0.5, toT = 0.5) {
    const A = nodeRect(fromNode),
      B = nodeRect(toNode);
    const p0 = anchorOn(A, fromSide, fromT);
    const p3 = anchorOn(B, toSide, toT);
    const hFrom = fromSide === 'l' || fromSide === 'r';
    const hTo = toSide === 'l' || toSide === 'r';
    if (hFrom && hTo) {
      const midX = (p0.x + p3.x) / 2;
      return [p0, {
        x: midX,
        y: p0.y
      }, {
        x: midX,
        y: p3.y
      }, p3];
    }
    if (!hFrom && !hTo) {
      const midY = (p0.y + p3.y) / 2;
      return [p0, {
        x: p0.x,
        y: midY
      }, {
        x: p3.x,
        y: midY
      }, p3];
    }
    if (hFrom && !hTo) return [p0, {
      x: p3.x,
      y: p0.y
    }, p3];
    return [p0, {
      x: p0.x,
      y: p3.y
    }, p3];
  }
  function pathFromPoints(pts, rounded = 8) {
    if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1],
        cur = pts[i],
        next = pts[i + 1];
      const v1x = Math.sign(cur.x - prev.x),
        v1y = Math.sign(cur.y - prev.y);
      const v2x = Math.sign(next.x - cur.x),
        v2y = Math.sign(next.y - cur.y);
      const r = rounded;
      d += ` L ${cur.x - v1x * r} ${cur.y - v1y * r} Q ${cur.x} ${cur.y} ${cur.x + v2x * r} ${cur.y + v2y * r}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last.x} ${last.y}`;
    return d;
  }

  // Smooth cubic bezier between the two endpoints. Control points are
  // offset perpendicular to the segment direction by ~40% of the line
  // length so the curve has a noticeable but tasteful arc.
  function bezierFromPoints(pts) {
    if (pts.length < 2) return '';
    const p0 = pts[0];
    const p1 = pts[pts.length - 1];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    // Tangent direction at endpoints — pull horizontal/vertical based on
    // which axis dominates so the curve "leans into" the source/target.
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const k = Math.min(140, Math.max(40, len * 0.4));
    const c1 = horizontal ? {
      x: p0.x + Math.sign(dx) * k,
      y: p0.y
    } : {
      x: p0.x,
      y: p0.y + Math.sign(dy) * k
    };
    const c2 = horizontal ? {
      x: p1.x - Math.sign(dx) * k,
      y: p1.y
    } : {
      x: p1.x,
      y: p1.y - Math.sign(dy) * k
    };
    return `M ${p0.x} ${p0.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p1.x} ${p1.y}`;
  }

  // Self-loop arc rendered as a small circle anchored on the right side
  // of the node. Used when an edge's `from === to`. Returns both the
  // approximated points (for label placement) and the SVG path string.
  function selfLoopPath(node, side = 'r') {
    const A = nodeRect(node);
    const r = Math.min(node.h, 50) * 0.45;
    // Anchor: the chosen side of the node.
    const base = anchorOn(A, side, 0.5);
    // Place the loop center outside the node.
    let cx, cy;
    if (side === 'r') {
      cx = base.x + r;
      cy = base.y - r;
    } else if (side === 'l') {
      cx = base.x - r;
      cy = base.y - r;
    } else if (side === 't') {
      cx = base.x - r;
      cy = base.y - r;
    } else {
      cx = base.x + r;
      cy = base.y + r;
    }
    // SVG arc: full circle minus an opening at the anchor. Two arcs around
    // the circle so each renderer's marker-end terminates on the node.
    const sweep = side === 'l' || side === 'b' ? 0 : 1;
    const d = `M ${base.x} ${base.y} A ${r} ${r} 0 1 ${sweep} ${base.x + 0.001} ${base.y + 0.001}`;
    // Synthesize a small set of points for label/midpoint use.
    const pts = [base, {
      x: cx,
      y: cy - r
    },
    // top of loop
    {
      x: cx + r,
      y: cy
    },
    // right of loop
    {
      x: cx,
      y: cy + r
    },
    // bottom of loop
    {
      x: base.x + 0.001,
      y: base.y + 0.001
    }];
    return {
      d,
      points: pts
    };
  }
  function roughPath(pts, amp = 1.4, seed = 7) {
    let s = seed;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const offs = () => (rnd() - 0.5) * 2 * amp;
    let d = `M ${pts[0].x + offs()} ${pts[0].y + offs()}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x + offs()} ${pts[i].y + offs()}`;
    }
    return d;
  }
  function edgeMidpoint(pts) {
    if (pts.length >= 3) {
      const a = pts[Math.floor(pts.length / 2) - 1];
      const b = pts[Math.floor(pts.length / 2)];
      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
      };
    }
    return {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2
    };
  }

  // -----------------------------------------------------------
  // Auto-layout — left-to-right hierarchical flow.
  // Used when any node is missing x/y. Computes node "ranks" (longest
  // path from a source) and groups nodes by rank into columns. Within
  // each column, distributes nodes vertically with even spacing.
  // Ignores boundary nodes (they're containers and get their layout
  // from their members or explicit coords).
  // -----------------------------------------------------------
  function autoLayout(nodes, edges, opts = {}) {
    const gapX = opts.gapX || 200;
    const gapY = opts.gapY || 110;
    const startX = opts.startX || 60;
    const startY = opts.startY || 60;
    const nodeW = opts.nodeW || 150;
    const nodeH = opts.nodeH || 70;
    if (!nodes || nodes.length === 0) return;

    // Boundaries are containers — auto-layout positions only non-boundary nodes.
    const layoutables = nodes.filter(n => n.kind !== 'boundary');
    if (layoutables.length === 0) return;

    // Build adjacency over layoutable nodes only.
    const layoutableIds = new Set(layoutables.map(n => n.id));
    const inDeg = {};
    const outAdj = {};
    for (const n of layoutables) {
      inDeg[n.id] = 0;
      outAdj[n.id] = [];
    }
    for (const e of edges || []) {
      if (layoutableIds.has(e.from) && layoutableIds.has(e.to)) {
        inDeg[e.to]++;
        outAdj[e.from].push(e.to);
      }
    }

    // Rank assignment (longest-path from any root).
    const rank = {};
    const queue = [];
    for (const n of layoutables) {
      if (inDeg[n.id] === 0) {
        rank[n.id] = 0;
        queue.push(n.id);
      }
    }
    // Cyclic graph or no roots: pick the first node as a fake root.
    if (queue.length === 0) {
      rank[layoutables[0].id] = 0;
      queue.push(layoutables[0].id);
    }
    // BFS, taking the maximum rank seen on each visit.
    const seen = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      const r = rank[id];
      for (const t of outAdj[id]) {
        const next = rank[t] === undefined ? r + 1 : Math.max(rank[t], r + 1);
        rank[t] = next;
        queue.push(t);
      }
    }
    // Disconnected nodes default to rank 0.
    for (const n of layoutables) {
      if (rank[n.id] === undefined) rank[n.id] = 0;
    }

    // Group by rank → columns.
    const cols = {};
    for (const n of layoutables) {
      const r = rank[n.id];
      if (!cols[r]) cols[r] = [];
      cols[r].push(n);
    }

    // Find the tallest column to vertically center shorter ones.
    const ranks = Object.keys(cols).map(Number).sort((a, b) => a - b);
    const maxRows = ranks.reduce((m, r) => Math.max(m, cols[r].length), 1);
    for (const r of ranks) {
      const col = cols[r];
      const colCount = col.length;
      const yOffset = (maxRows - colCount) * gapY / 2;
      col.forEach((n, i) => {
        n.x = startX + r * gapX;
        n.y = startY + yOffset + i * gapY;
        n.w = n.w || nodeW;
        n.h = n.h || nodeH;
      });
    }
  }

  // Compute a sensible canvas size from node positions + sizes.
  function autoCanvas(nodes, padding = 60) {
    if (!nodes || nodes.length === 0) return {
      w: 800,
      h: 400
    };
    let maxX = 0,
      maxY = 0;
    for (const n of nodes) {
      if (n.kind === 'boundary') continue;
      if (typeof n.x === 'number' && typeof n.w === 'number') maxX = Math.max(maxX, n.x + n.w);
      if (typeof n.y === 'number' && typeof n.h === 'number') maxY = Math.max(maxY, n.y + n.h);
    }
    return {
      w: Math.max(800, maxX + padding),
      h: Math.max(400, maxY + padding)
    };
  }

  // Register the built-in rank-based engine once. layouts/index.js
  // registered dagre at load time; both engines are now available.
  registerLayout('rank', autoLayout);
  function resolveGraph(graph) {
    // Apply auto-layout if ANY node is missing x or y. Mutates the input
    // nodes' x/y/w/h in place; downstream renderers can then count on them.
    const needsLayout = !graph.nodes || graph.nodes.some(n => n.kind !== 'boundary' && (n.x === undefined || n.y === undefined));
    if (needsLayout) {
      // Engine selection: explicit `layout:` directive wins. Otherwise
      // pick dagre when the graph has edges (DAG-shaped) and rank
      // otherwise (single-column / disconnected nodes).
      const engineName = graph.layout || (Array.isArray(graph.edges) && graph.edges.length > 0 ? 'dagre' : 'rank');
      const engine = getLayout(engineName) || autoLayout;
      engine(graph.nodes || [], graph.edges || []);
      if (!graph.canvas || !graph.canvas.w) {
        graph = {
          ...graph,
          canvas: {
            ...(graph.canvas || {}),
            ...autoCanvas(graph.nodes)
          }
        };
      }
    }
    const byId = Object.fromEntries(graph.nodes.map(n => [n.id, n]));
    const {
      anchors,
      edgeT
    } = assignAnchors(graph.nodes, graph.edges);
    const edges = graph.edges.map(e => {
      // Self-loop: from === to. Skip the standard router; draw a small arc
      // anchored on the right side of the node.
      if (e.from === e.to && byId[e.from]) {
        const {
          d,
          points
        } = selfLoopPath(byId[e.from], 'r');
        return {
          ...e,
          fromSide: 'r',
          toSide: 'r',
          points,
          d,
          length: 2 * Math.PI * Math.min(byId[e.from].h, 50) * 0.45
        };
      }
      const a = anchors[e.id];
      const t = edgeT[e.id];
      const pts = routeEdge(byId[e.from], byId[e.to], a.fromSide, a.toSide, t.fromT ?? 0.5, t.toT ?? 0.5);
      // Curve mode: 'bezier' produces a smooth path between the two endpoints
      // and discards the orthogonal waypoints. Default 'ortho' keeps the
      // existing routed path.
      const d = e.curve === 'bezier' ? bezierFromPoints([pts[0], pts[pts.length - 1]]) : pathFromPoints(pts, 10);
      return {
        ...e,
        fromSide: a.fromSide,
        toSide: a.toSide,
        points: pts,
        d,
        length: pts.reduce((acc, p, i) => i === 0 ? 0 : acc + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y), 0)
      };
    });
    const sortedNodes = [...graph.nodes].sort((a, b) => {
      const bA = a.kind === 'boundary' ? 1 : 0;
      const bB = b.kind === 'boundary' ? 1 : 0;
      if (bA !== bB) return bB - bA;
      return a.y + a.x - (b.y + b.x);
    });
    return {
      ...graph,
      nodes: sortedNodes,
      edges,
      byId
    };
  }

  function _extends() {
    return _extends = Object.assign ? Object.assign.bind() : function (n) {
      for (var e = 1; e < arguments.length; e++) {
        var t = arguments[e];
        for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
      }
      return n;
    }, _extends.apply(null, arguments);
  }

  // -----------------------------------------------------------
  // Shape library — SVG path generators. Pure JS, no React dep.
  // Each returns { d, cx, cy, rx?, circle?, ellipse?, top?, body? }
  //
  // The optional `node` argument is forwarded for shapes that need
  // to read a node-level attribute (currently only `custom-path`,
  // which reads `node.d`).
  // -----------------------------------------------------------

  function shapePath(shape, w, h, node) {
    switch (shape) {
      case 'rect':
        return {
          d: `M0 0 H${w} V${h} H0 Z`,
          cx: w / 2,
          cy: h / 2,
          rx: 10
        };
      case 'square':
        {
          const s = Math.min(w, h);
          const ox = (w - s) / 2,
            oy = (h - s) / 2;
          return {
            d: `M${ox} ${oy} h${s} v${s} h${-s} z`,
            cx: w / 2,
            cy: h / 2,
            rx: 4
          };
        }
      case 'circle':
        {
          const r = Math.min(w, h) / 2;
          return {
            d: `M${w / 2 - r} ${h / 2} a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`,
            cx: w / 2,
            cy: h / 2,
            circle: {
              cx: w / 2,
              cy: h / 2,
              r
            }
          };
        }
      case 'oval':
        return {
          d: `M0 ${h / 2} a${w / 2} ${h / 2} 0 1 0 ${w} 0 a${w / 2} ${h / 2} 0 1 0 ${-w} 0`,
          cx: w / 2,
          cy: h / 2,
          ellipse: {
            cx: w / 2,
            cy: h / 2,
            rx: w / 2,
            ry: h / 2
          }
        };
      case 'diamond':
        return {
          d: `M${w / 2} 0 L${w} ${h / 2} L${w / 2} ${h} L0 ${h / 2} Z`,
          cx: w / 2,
          cy: h / 2
        };
      case 'hex':
        {
          const i = Math.min(w * 0.18, 18);
          return {
            d: `M${i} 0 L${w - i} 0 L${w} ${h / 2} L${w - i} ${h} L${i} ${h} L0 ${h / 2} Z`,
            cx: w / 2,
            cy: h / 2
          };
        }
      case 'pill':
        {
          const r = h / 2;
          return {
            d: `M${r} 0 H${w - r} A${r} ${r} 0 0 1 ${w - r} ${h} H${r} A${r} ${r} 0 0 1 ${r} 0 Z`,
            cx: w / 2,
            cy: h / 2,
            rx: r
          };
        }
      case 'cylinder':
        {
          const ry = 7;
          return {
            d: `M0 ${ry} a${w / 2} ${ry} 0 1 0 ${w} 0 a${w / 2} ${ry} 0 1 0 ${-w} 0 M0 ${ry} V${h - ry} a${w / 2} ${ry} 0 0 0 ${w} 0 V${ry}`,
            top: `M0 ${ry} a${w / 2} ${ry} 0 1 0 ${w} 0 a${w / 2} ${ry} 0 1 0 ${-w} 0`,
            body: `M0 ${ry} V${h - ry} a${w / 2} ${ry} 0 0 0 ${w} 0 V${ry}`,
            cx: w / 2,
            cy: h / 2 + ry / 2
          };
        }
      case 'cloud':
        return {
          d: `M${w * 0.18} ${h * 0.55} C ${w * 0.02} ${h * 0.55}, ${w * 0.02} ${h * 0.15}, ${w * 0.22} ${h * 0.22} C ${w * 0.28} ${h * 0.02}, ${w * 0.6} ${h * 0.02}, ${w * 0.62} ${h * 0.22} C ${w * 0.82} ${h * 0.15}, ${w * 0.98} ${h * 0.3}, ${w * 0.9} ${h * 0.55} C ${w * 0.98} ${h * 0.75}, ${w * 0.78} ${h * 0.95}, ${w * 0.6} ${h * 0.85} C ${w * 0.4} ${h * 1.02}, ${w * 0.1} ${h * 0.95}, ${w * 0.18} ${h * 0.55} Z`,
          cx: w / 2,
          cy: h / 2
        };
      case 'parallelogram':
        {
          const skew = 14;
          return {
            d: `M${skew} 0 H${w} L${w - skew} ${h} H0 Z`,
            cx: w / 2,
            cy: h / 2
          };
        }
      case 'shield':
        {
          const r = Math.min(w * 0.18, 14);
          return {
            d: `M${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${h * 0.55} Q${w} ${h * 0.85} ${w / 2} ${h} Q0 ${h * 0.85} 0 ${h * 0.55} V${r} Q0 0 ${r} 0 Z`,
            cx: w / 2,
            cy: h / 2
          };
        }
      case 'tablet':
        {
          const r = Math.min(w, h) * 0.18;
          return {
            d: `M${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${h - r} Q${w} ${h} ${w - r} ${h} H${r} Q0 ${h} 0 ${h - r} V${r} Q0 0 ${r} 0 Z`,
            cx: w / 2,
            cy: h / 2,
            rx: r
          };
        }
      case 'trapezoid':
        {
          const i = Math.min(w * 0.16, 18);
          return {
            d: `M${i} 0 H${w - i} L${w} ${h} H0 Z`,
            cx: w / 2,
            cy: h / 2
          };
        }
      case 'chevron':
        {
          const a = Math.min(w * 0.12, 14);
          return {
            d: `M0 0 H${w - a} L${w} ${h / 2} L${w - a} ${h} H0 L${a} ${h / 2} Z`,
            cx: w / 2,
            cy: h / 2
          };
        }
      case 'document':
        {
          // Rectangle with a curled bottom-right corner.
          const fold = Math.min(w * 0.18, 22);
          return {
            d: `M0 0 H${w - fold} L${w} ${fold} V${h} H0 Z`,
            // Fold flap decor (rendered separately by styles that care).
            decor: `M${w - fold} 0 V${fold} H${w}`,
            cx: w / 2,
            cy: h / 2,
            rx: 4
          };
        }
      case 'folder':
        {
          // Tab on top-left, body below.
          const tab = Math.min(w * 0.34, 70);
          const tabH = Math.min(h * 0.18, 14);
          return {
            d: `M0 ${tabH} H${tab * 0.8} L${tab} 0 H${w - 6} Q${w} 0 ${w} 6 V${h - 6} Q${w} ${h} ${w - 6} ${h} H6 Q0 ${h} 0 ${h - 6} Z`,
            cx: w / 2,
            cy: h / 2 + tabH / 2,
            rx: 6
          };
        }
      case 'sticky-note':
      case 'note':
        {
          // Rectangle with a folded triangle in the bottom-right corner.
          const fold = Math.min(w * 0.16, 18);
          return {
            d: `M0 0 H${w} V${h - fold} L${w - fold} ${h} H0 Z`,
            decor: `M${w} ${h - fold} L${w - fold} ${h - fold} L${w - fold} ${h}`,
            cx: w / 2,
            cy: h / 2 - fold / 4,
            rx: 2
          };
        }
      case 'person':
        {
          // Stick figure: head circle + body rounded rect. Used for `actor`
          // when the style opts in.
          const headR = Math.min(w, h) * 0.18;
          const headCx = w / 2;
          const headCy = headR + 2;
          const bodyTop = headCy + headR + 4;
          const bodyW = Math.min(w * 0.7, 80);
          const bodyX = (w - bodyW) / 2;
          const bodyR = bodyW * 0.5;
          return {
            d: `M${headCx} ${headCy - headR} a${headR} ${headR} 0 1 0 0 ${headR * 2} a${headR} ${headR} 0 1 0 0 ${-headR * 2} ` + `M${bodyX} ${h} V${bodyTop + bodyR} Q${bodyX} ${bodyTop} ${bodyX + bodyR} ${bodyTop} H${bodyX + bodyW - bodyR} Q${bodyX + bodyW} ${bodyTop} ${bodyX + bodyW} ${bodyTop + bodyR} V${h} Z`,
            // Expose pieces so styles can render head + body separately if desired.
            head: {
              cx: headCx,
              cy: headCy,
              r: headR
            },
            body: `M${bodyX} ${h} V${bodyTop + bodyR} Q${bodyX} ${bodyTop} ${bodyX + bodyR} ${bodyTop} H${bodyX + bodyW - bodyR} Q${bodyX + bodyW} ${bodyTop} ${bodyX + bodyW} ${bodyTop + bodyR} V${h} Z`,
            cx: w / 2,
            cy: h / 2,
            noShadow: true
          };
        }
      case 'custom-path':
      case 'path':
        {
          // User-supplied path data via node.d. Falls back to a rect if absent.
          const d = node && typeof node.d === 'string' && node.d.trim() ? node.d : `M0 0 H${w} V${h} H0 Z`;
          return {
            d,
            cx: w / 2,
            cy: h / 2,
            rx: 6
          };
        }
      default:
        return {
          d: `M0 0 H${w} V${h} H0 Z`,
          cx: w / 2,
          cy: h / 2,
          rx: 10
        };
    }
  }
  function shapeAnchor(node, side) {
    const {
      w,
      h
    } = node;
    const cx = node.x + w / 2,
      cy = node.y + h / 2;
    switch (side) {
      case 'l':
        return {
          x: node.x,
          y: cy
        };
      case 'r':
        return {
          x: node.x + w,
          y: cy
        };
      case 't':
        return {
          x: cx,
          y: node.y
        };
      case 'b':
        return {
          x: cx,
          y: node.y + h
        };
      default:
        return {
          x: cx,
          y: cy
        };
    }
  }

  // -----------------------------------------------------------
  // Built-in icon sprite library. Each entry returns an `<svg>`
  // fragment string sized to a 24×24 viewBox so renderers can
  // drop it inside a node at whatever scale they want.
  //
  // The shapes are deliberately simple monochrome glyphs rather
  // than brand-accurate logos — they read at small sizes inside
  // architecture nodes, and they sidestep trademark concerns.
  //
  // Usage from a DSL:
  //
  //     nodes:
  //       - id: pg, kind: store, label: Postgres, icon: "postgres"
  //
  // Looking up by name returns the inner-SVG markup (no <svg>
  // wrapper) so the renderer controls width/height/color.
  // Unknown names return null — renderers fall back silently.
  // -----------------------------------------------------------

  // Inner-SVG fragments. All paths assume currentColor for fills/strokes
  // so the host renderer can tint via fill / stroke on the wrapping <g>.
  const ICONS$1 = {
    // Databases
    postgres: '<path d="M12 3c4 0 7 1 7 3v12c0 2-3 3-7 3s-7-1-7-3V6c0-2 3-3 7-3z" fill="none" stroke="currentColor" stroke-width="1.8"/><ellipse cx="12" cy="6" rx="7" ry="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 11l3 2 3-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    mysql: '<path d="M3 12c0-3 2-5 5-5h8c3 0 5 2 5 5s-2 5-5 5h-8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 17l-3 3 3-3z" fill="currentColor"/><path d="M7 11l2 1 2-1m2 0l2 1 2-1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    mongo: '<path d="M12 2c-2 4-4 6-4 11 0 4 2 7 4 9 2-2 4-5 4-9 0-5-2-7-4-11z" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="12" y1="22" x2="12" y2="16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    redis: '<path d="M3 8l9-4 9 4-9 4-9-4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M3 12l9 4 9-4M3 16l9 4 9-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    sqlite: '<rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 10h18M8 10v8M14 10v8" stroke="currentColor" stroke-width="1.4"/>',
    // Messaging
    kafka: '<circle cx="6" cy="6" r="2" fill="currentColor"/><circle cx="6" cy="18" r="2" fill="currentColor"/><circle cx="18" cy="12" r="2" fill="currentColor"/><path d="M8 7l8 4M8 17l8-4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    rabbitmq: '<rect x="4" y="11" width="6" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="11" width="6" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="9" y="4" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    // Cloud / Infra
    's3': '<path d="M5 7l7-3 7 3v10l-7 3-7-3V7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M5 7l7 3 7-3M12 10v10" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    'aws-s3': '<path d="M5 7l7-3 7 3v10l-7 3-7-3V7z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M5 7l7 3 7-3M12 10v10" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    aws: '<path d="M3 14c3 2 7 3 9 3s6-1 9-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="6" cy="9" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="18" cy="9" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    gcp: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    azure: '<path d="M3 19l7-13 4 6-5 3 6 4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    k8s: '<polygon points="12,3 21,8 21,16 12,21 3,16 3,8" fill="none" stroke="currentColor" stroke-width="1.6"/><polygon points="12,7 17,10 17,14 12,17 7,14 7,10" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    docker: '<rect x="3" y="11" width="3" height="3" fill="currentColor"/><rect x="7" y="11" width="3" height="3" fill="currentColor"/><rect x="11" y="11" width="3" height="3" fill="currentColor"/><rect x="7" y="7" width="3" height="3" fill="currentColor"/><rect x="11" y="7" width="3" height="3" fill="currentColor"/><path d="M3 15h13c3 0 5-2 5-5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    nginx: '<path d="M3 5l9-2 9 2v14l-9 2-9-2V5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 16V9l8 6V9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    cloudflare: '<path d="M5 14c-1-3 1-6 4-6 1-2 4-3 6-2 3 0 5 2 5 5 0 0 0 0 0 0H7c-1 0-2 1-2 2z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    // Source control / CI
    github: '<path d="M12 3a9 9 0 00-3 17.5c.5.1.7-.2.7-.5v-2c-3 .6-3.5-1-3.5-1-.5-1-1-1.5-1-1.5-.8-.5 0-.5 0-.5 1 0 1.5 1 1.5 1 .9 1.5 2.5 1 3 .8.1-.6.4-1 .7-1.3-2.2-.2-4.5-1.1-4.5-5 0-1 .3-1.9 1-2.5-.1-.3-.5-1.3.1-2.7 0 0 .8-.3 2.7 1a9 9 0 015 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.7.7 1 1.5 1 2.5 0 3.9-2.3 4.8-4.5 5 .4.3.7 1 .7 2v3c0 .3.2.6.7.5A9 9 0 0012 3z" fill="currentColor"/>',
    gitlab: '<path d="M12 22l-9-7 2-9 3 6h8l3-6 2 9z" fill="currentColor"/>',
    git: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="6" cy="12" r="1.5" fill="currentColor"/><circle cx="18" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="6" r="1.5" fill="currentColor"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/><path d="M6 12h12M12 6v12" stroke="currentColor" stroke-width="1.4"/>',
    // Languages / Runtimes
    node: '<path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 9v4c0 1 1 2 2 2h3" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    python: '<rect x="6" y="2" width="12" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="6" y="12" width="12" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="6" r="1" fill="currentColor"/><circle cx="15" cy="18" r="1" fill="currentColor"/>',
    go: '<path d="M4 14h7M3 11h6M5 17h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="17" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="19" cy="11" r="1" fill="currentColor"/>',
    rust: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 4v16M4 12h16M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="1.4"/>',
    java: '<path d="M10 4c0 2 4 3 4 6s-3 4-3 4M12 14c0 0 5 1 5 4 0 1-1 2-3 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M5 19c3 1 11 1 14 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    // Frontend
    react: '<circle cx="12" cy="12" r="2" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="currentColor" stroke-width="1.4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" fill="none" stroke="currentColor" stroke-width="1.4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    vue: '<path d="M3 4l9 16 9-16h-4l-5 9-5-9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    angular: '<path d="M12 2L3 6l1 12 8 4 8-4 1-12z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 16l3-9 3 9M10 13h4" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" fill="none"/>',
    svelte: '<path d="M16 6c-3-2-7-1-9 2L3 13c-2 3-1 7 2 9 3 2 7 1 9-2l4-5c2-3 1-7-2-9z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    // Comms / Auth / Misc
    graphql: '<polygon points="12,3 21,8 21,16 12,21 3,16 3,8" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="3" r="1.5" fill="currentColor"/><circle cx="21" cy="8" r="1.5" fill="currentColor"/><circle cx="21" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="21" r="1.5" fill="currentColor"/><circle cx="3" cy="16" r="1.5" fill="currentColor"/><circle cx="3" cy="8" r="1.5" fill="currentColor"/>',
    jwt: '<rect x="3" y="9" width="18" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 9v6M11 9v6M15 9v6M19 9v6" stroke="currentColor" stroke-width="1.4"/>',
    user: '<circle cx="12" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    globe: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" fill="none" stroke="currentColor" stroke-width="1.6"/>'
  };

  /**
   * Return the inner-SVG fragment string for a named icon, or null if
   * the name isn't registered. The fragment is positioned in a 24×24
   * coordinate system and uses currentColor so the caller controls tint.
   */
  function getIcon(name) {
    if (!name) return null;
    return ICONS$1[String(name).toLowerCase()] || null;
  }

  // ---------- Shared helpers ----------

  // Renders the node's `image:` (URL or data URL) or `icon:` (bundled
  // sprite). Backwards-compatible with `kind: image` + `src:`. Returns
  // null when the node has no media.
  //
  // `imagePosition: 'top' (default) | 'center' | 'bottom' | 'fill'`
  // `imageFit:      'contain' (default) | 'cover' | 'fill'`
  function NodeImageOrIcon({
    node
  }) {
    const w = node.w,
      h = node.h;
    const imageUrl = node.image || (node.kind === 'image' && node.src ? node.src : null);
    const iconName = node.icon;
    if (imageUrl) {
      const position = node.imagePosition || 'top';
      const fit = node.imageFit || 'contain';
      if (position === 'fill') {
        const preserve = fit === 'fill' ? 'none' : fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
        const shape = shapeOf(node);
        const s = shapePath(shape, w, h, node);
        const clipId = `fd-clip-${node.id}`;
        return /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("clipPath", {
          id: clipId
        }, /*#__PURE__*/React.createElement("path", {
          d: s.d
        })), /*#__PURE__*/React.createElement("image", {
          href: imageUrl,
          x: 0,
          y: 0,
          width: w,
          height: h,
          preserveAspectRatio: preserve,
          clipPath: `url(#${clipId})`
        }));
      }
      const size = Math.min(40, Math.min(w, h) - 16);
      const x = w / 2 - size / 2;
      const y = position === 'bottom' ? h - size - 8 : position === 'center' ? h / 2 - size / 2 : 8;
      const preserve = fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
      return /*#__PURE__*/React.createElement("image", {
        href: imageUrl,
        x: x,
        y: y,
        width: size,
        height: size,
        preserveAspectRatio: preserve
      });
    }
    if (iconName) {
      const fragment = getIcon(iconName);
      if (!fragment) return null;
      const size = Math.min(28, Math.min(w, h) - 20);
      if (size <= 0) return null;
      const x = w / 2 - size / 2;
      const y = node.imagePosition === 'center' ? h / 2 - size / 2 : node.imagePosition === 'bottom' ? h - size - 8 : 6;
      const scale = size / 24;
      return /*#__PURE__*/React.createElement("g", {
        transform: `translate(${x} ${y}) scale(${scale})`,
        style: {
          color: '#1e293b'
        },
        dangerouslySetInnerHTML: {
          __html: fragment
        }
      });
    }
    return null;
  }
  function hasMedia(node) {
    return !!(node.image || node.icon || node.kind === 'image' && node.src);
  }

  // Sankey-style edge thickness: scale the base stroke width by sqrt(weight).
  function edgeStrokeWidth$1(edge, base) {
    if (edge && typeof edge.weight === 'number' && edge.weight > 0) {
      const scale = Math.max(0.5, Math.min(6, Math.sqrt(edge.weight)));
      return Math.max(0.5, base * scale);
    }
    return base;
  }
  function EdgeLabel({
    text,
    x,
    y,
    bg = '#faf7ef',
    fg = '#6b6459',
    mono = false
  }) {
    if (!text) return null;
    return /*#__PURE__*/React.createElement("g", {
      transform: `translate(${x} ${y - 12})`
    }, /*#__PURE__*/React.createElement("text", {
      textAnchor: "middle",
      dominantBaseline: "middle",
      fontFamily: mono ? 'JetBrains Mono' : 'Inter Tight',
      fontSize: "11",
      fill: bg,
      stroke: bg,
      strokeWidth: "3.5",
      strokeLinejoin: "round"
    }, text), /*#__PURE__*/React.createElement("text", {
      textAnchor: "middle",
      dominantBaseline: "middle",
      fontFamily: mono ? 'JetBrains Mono' : 'Inter Tight',
      fontSize: "11",
      fill: fg,
      fontWeight: "600"
    }, text));
  }
  function ShapeShell({
    node,
    fill,
    stroke,
    strokeWidth,
    strokeDasharray
  }) {
    const shape = shapeOf(node);
    const s = shapePath(shape, node.w, node.h, node);
    if (shape === 'rect') {
      return /*#__PURE__*/React.createElement("rect", {
        width: node.w,
        height: node.h,
        rx: s.rx ?? 10,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth,
        strokeDasharray: strokeDasharray
      });
    }
    if (shape === 'square') {
      const sz = Math.min(node.w, node.h),
        ox = (node.w - sz) / 2,
        oy = (node.h - sz) / 2;
      return /*#__PURE__*/React.createElement("rect", {
        x: ox,
        y: oy,
        width: sz,
        height: sz,
        rx: 4,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth,
        strokeDasharray: strokeDasharray
      });
    }
    if (shape === 'pill') {
      return /*#__PURE__*/React.createElement("rect", {
        width: node.w,
        height: node.h,
        rx: node.h / 2,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth,
        strokeDasharray: strokeDasharray
      });
    }
    if (shape === 'circle' && s.circle) {
      return /*#__PURE__*/React.createElement("circle", {
        cx: s.circle.cx,
        cy: s.circle.cy,
        r: s.circle.r,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth,
        strokeDasharray: strokeDasharray
      });
    }
    if (shape === 'oval' && s.ellipse) {
      return /*#__PURE__*/React.createElement("ellipse", {
        cx: s.ellipse.cx,
        cy: s.ellipse.cy,
        rx: s.ellipse.rx,
        ry: s.ellipse.ry,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth,
        strokeDasharray: strokeDasharray
      });
    }
    if (shape === 'cylinder') {
      return /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
        d: s.body,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth
      }), /*#__PURE__*/React.createElement("path", {
        d: s.top,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth
      }));
    }
    return /*#__PURE__*/React.createElement("path", {
      d: s.d,
      fill: fill,
      stroke: stroke,
      strokeWidth: strokeWidth,
      strokeDasharray: strokeDasharray
    });
  }
  function NodeLabel({
    node,
    fill,
    sub,
    subFill,
    fontFamily = 'Inter Tight',
    fontWeight = 600,
    fontSize = 13,
    hand = false,
    centerOffsetY = 0
  }) {
    const shape = shapeOf(node);
    if (['diamond', 'circle', 'oval', 'pill'].includes(shape)) {
      return /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("text", {
        x: node.w / 2,
        y: node.h / 2 + (sub ? -3 : 4) + centerOffsetY,
        textAnchor: "middle",
        dominantBaseline: "middle",
        fontFamily: fontFamily,
        fontWeight: fontWeight,
        fontSize: fontSize,
        fill: fill
      }, node.label), sub && /*#__PURE__*/React.createElement("text", {
        x: node.w / 2,
        y: node.h / 2 + 12 + centerOffsetY,
        textAnchor: "middle",
        dominantBaseline: "middle",
        fontFamily: "JetBrains Mono",
        fontSize: "9.5",
        fill: subFill
      }, sub));
    }
    return /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("text", {
      x: node.w / 2,
      y: node.h / 2 + 4,
      textAnchor: "middle",
      fontFamily: fontFamily,
      fontWeight: fontWeight,
      fontSize: hand ? 20 : fontSize,
      fill: fill
    }, node.label), sub && /*#__PURE__*/React.createElement("text", {
      x: node.w / 2,
      y: node.h - 12,
      textAnchor: "middle",
      fontFamily: hand ? 'Caveat' : 'JetBrains Mono',
      fontSize: hand ? 13 : 9.5,
      fill: subFill
    }, sub));
  }

  // ---------- NodeIcon ----------

  function NodeIcon({
    kind,
    color = '#8f8779',
    sketchy = false,
    mono = false
  }) {
    const s = 14;
    const sw = mono ? 1 : 1.2;
    const common = {
      stroke: color,
      strokeWidth: sw,
      fill: 'none',
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    };
    const filter = sketchy ? {
      filter: 'url(#sk-rough)'
    } : {};
    switch (kind) {
      case 'actor':
      case 'client':
      case 'person':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("circle", _extends({
          cx: s / 2,
          cy: 4,
          r: "2.5"
        }, common)), /*#__PURE__*/React.createElement("path", _extends({
          d: `M1 ${s} C 2 9, 5 9, ${s / 2} 9 C ${s - 5} 9, ${s - 2} 9, ${s - 1} ${s}`
        }, common)));
      case 'service':
      case 'process':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("rect", _extends({
          x: "1",
          y: "2",
          width: s - 2,
          height: s - 4,
          rx: "1.5"
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: "1",
          y1: "6",
          x2: s - 1,
          y2: "6"
        }, common)));
      case 'gateway':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("path", _extends({
          d: `M${s / 2} 1 L${s - 1} ${s / 2} L${s / 2} ${s - 1} L1 ${s / 2} Z`
        }, common)));
      case 'store':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("ellipse", _extends({
          cx: s / 2,
          cy: "3",
          rx: "5.5",
          ry: "1.8"
        }, common)), /*#__PURE__*/React.createElement("path", _extends({
          d: `M1 3 L1 ${s - 3} C 1 ${s - 1}, ${s - 1} ${s - 1}, ${s - 1} ${s - 3} L${s - 1} 3`
        }, common)));
      case 'cache':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("circle", _extends({
          cx: s / 2,
          cy: s / 2,
          r: "5.5"
        }, common)), /*#__PURE__*/React.createElement("circle", _extends({
          cx: s / 2,
          cy: s / 2,
          r: "1.2"
        }, common)));
      case 'queue':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("rect", _extends({
          x: "1",
          y: "3",
          width: s - 2,
          height: "3"
        }, common)), /*#__PURE__*/React.createElement("rect", _extends({
          x: "1",
          y: "7.5",
          width: s - 2,
          height: "3"
        }, common)));
      case 'external':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("path", _extends({
          d: `M3 ${s / 2 + 2} C 1 ${s / 2 + 2}, 1 ${s / 2 - 1}, 3 ${s / 2 - 1} C 3 3, 8 2, 10 ${s / 2 - 2} C 13 ${s / 2 - 2}, 13 ${s / 2 + 2}, ${s - 2} ${s / 2 + 2} Z`
        }, common)));
      case 'boundary':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("rect", _extends({
          x: "1",
          y: "1",
          width: s - 2,
          height: s - 2,
          rx: "1",
          strokeDasharray: "2 1.5"
        }, common)));
      case 'start':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("path", {
          d: "M4 2 L11 7 L4 12 Z",
          fill: color,
          stroke: "none"
        }));
      case 'stop':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("rect", {
          x: "3",
          y: "3",
          width: "8",
          height: "8",
          fill: color,
          stroke: "none"
        }));
      case 'decision':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("text", {
          x: s / 2,
          y: s - 3,
          textAnchor: "middle",
          fontSize: "11",
          fontFamily: "Inter Tight",
          fontWeight: "700",
          fill: color
        }, "?"));
      case 'event':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("path", {
          d: "M8 1 L3 8 H7 L6 13 L11 6 H7 L8 1 Z",
          fill: color,
          stroke: "none"
        }));
      case 'step':
      case 'tree':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("circle", _extends({
          cx: s / 2,
          cy: s / 2,
          r: "3"
        }, common)));
      case 'image':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("rect", _extends({
          x: "1",
          y: "2",
          width: s - 2,
          height: s - 4,
          rx: "1"
        }, common)), /*#__PURE__*/React.createElement("circle", _extends({
          cx: "5",
          cy: "6",
          r: "1.2"
        }, common)), /*#__PURE__*/React.createElement("path", _extends({
          d: `M1 ${s - 4} L5 ${s - 7} L9 ${s - 5} L${s - 1} ${s - 2}`
        }, common)));
      case 'function':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("text", {
          x: s / 2,
          y: s - 2,
          textAnchor: "middle",
          fontSize: "13",
          fontFamily: "Inter Tight",
          fontWeight: "500",
          fill: color
        }, "\u03BB"));
      case 'worker':
        {
          const teeth = [];
          for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3;
            teeth.push(/*#__PURE__*/React.createElement("line", _extends({
              key: i,
              x1: s / 2 + Math.cos(a) * 5,
              y1: s / 2 + Math.sin(a) * 5,
              x2: s / 2 + Math.cos(a) * 6.7,
              y2: s / 2 + Math.sin(a) * 6.7
            }, common)));
          }
          return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("circle", _extends({
            cx: s / 2,
            cy: s / 2,
            r: "3.5"
          }, common)), teeth);
        }
      case 'loadbalancer':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("circle", _extends({
          cx: s / 2,
          cy: "3",
          r: "1.6"
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: s / 2,
          y1: "4.5",
          x2: s / 2,
          y2: s - 2
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: "2",
          y1: s - 2,
          x2: s - 2,
          y2: s - 2
        }, common)), /*#__PURE__*/React.createElement("path", _extends({
          d: `M2 ${s - 2} L${s / 2} 7 L${s - 2} ${s - 2}`
        }, common)));
      case 'cdn':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("circle", _extends({
          cx: s / 2,
          cy: s / 2,
          r: "5.5"
        }, common)), /*#__PURE__*/React.createElement("path", _extends({
          d: `M1.5 ${s / 2} H${s - 1.5}`
        }, common)), /*#__PURE__*/React.createElement("path", _extends({
          d: `M${s / 2} 1.5 C 4 ${s / 2}, 4 ${s / 2}, ${s / 2} ${s - 1.5}`
        }, common)), /*#__PURE__*/React.createElement("path", _extends({
          d: `M${s / 2} 1.5 C 10 ${s / 2}, 10 ${s / 2}, ${s / 2} ${s - 1.5}`
        }, common)));
      case 'auth':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("circle", _extends({
          cx: "4",
          cy: s / 2,
          r: "2.5"
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: "6",
          y1: s / 2,
          x2: s - 1,
          y2: s / 2
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: s - 3,
          y1: s / 2,
          x2: s - 3,
          y2: s / 2 + 2.5
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: s - 1,
          y1: s / 2,
          x2: s - 1,
          y2: s / 2 + 2.5
        }, common)));
      case 'monitor':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("line", _extends({
          x1: "1.5",
          y1: "2",
          x2: "1.5",
          y2: s - 1.5
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: "1.5",
          y1: s - 1.5,
          x2: s - 1,
          y2: s - 1.5
        }, common)), /*#__PURE__*/React.createElement("path", _extends({
          d: `M3 ${s - 4} L6 ${s - 7} L9 ${s - 5} L12 ${s - 9}`
        }, common)));
      case 'bus':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("line", _extends({
          x1: "1",
          y1: s / 2,
          x2: s - 1,
          y2: s / 2
        }, common)), /*#__PURE__*/React.createElement("circle", _extends({
          cx: "3",
          cy: s / 2 - 3,
          r: "1.4"
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: "3",
          y1: s / 2 - 1.6,
          x2: "3",
          y2: s / 2
        }, common)), /*#__PURE__*/React.createElement("circle", _extends({
          cx: s / 2,
          cy: s / 2 + 3,
          r: "1.4"
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: s / 2,
          y1: s / 2,
          x2: s / 2,
          y2: s / 2 + 1.6
        }, common)), /*#__PURE__*/React.createElement("circle", _extends({
          cx: s - 3,
          cy: s / 2 - 3,
          r: "1.4"
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: s - 3,
          y1: s / 2 - 1.6,
          x2: s - 3,
          y2: s / 2
        }, common)));
      case 'stream':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("path", _extends({
          d: `M1 ${s / 2} Q 3 ${s / 2 - 3}, 5 ${s / 2} T 9 ${s / 2} T 13 ${s / 2}`
        }, common)), /*#__PURE__*/React.createElement("path", _extends({
          d: `M1 ${s / 2 + 3} Q 3 ${s / 2}, 5 ${s / 2 + 3} T 9 ${s / 2 + 3} T 13 ${s / 2 + 3}`
        }, common, {
          opacity: ".55"
        })));
      case 'firewall':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("rect", _extends({
          x: "1",
          y: "2",
          width: s - 2,
          height: "3"
        }, common)), /*#__PURE__*/React.createElement("rect", _extends({
          x: "1",
          y: "5.5",
          width: s - 2,
          height: "3"
        }, common)), /*#__PURE__*/React.createElement("rect", _extends({
          x: "1",
          y: "9",
          width: s - 2,
          height: "3"
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: "5",
          y1: "2",
          x2: "5",
          y2: "5"
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: "9",
          y1: "2",
          x2: "9",
          y2: "5"
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: "3",
          y1: "5.5",
          x2: "3",
          y2: "8.5"
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: "7",
          y1: "5.5",
          x2: "7",
          y2: "8.5"
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: "11",
          y1: "5.5",
          x2: "11",
          y2: "8.5"
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: "5",
          y1: "9",
          x2: "5",
          y2: "12"
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: "9",
          y1: "9",
          x2: "9",
          y2: "12"
        }, common)));
      case 'mobile':
        return /*#__PURE__*/React.createElement("g", filter, /*#__PURE__*/React.createElement("rect", _extends({
          x: "3.5",
          y: "1",
          width: "7",
          height: s - 2,
          rx: "1.2"
        }, common)), /*#__PURE__*/React.createElement("line", _extends({
          x1: "6",
          y1: s - 2.5,
          x2: "8",
          y2: s - 2.5
        }, common)));
      default:
        return /*#__PURE__*/React.createElement("rect", _extends({
          x: "2",
          y: "2",
          width: s - 4,
          height: s - 4
        }, common));
    }
  }

  // ---------- sleekKindBody ----------

  function sleekKindBody$1(node, {
    fill,
    stroke,
    strokeW,
    ink,
    muted,
    accent,
    active
  }) {
    const {
      w,
      h
    } = node;
    const card = (rx = 10) => /*#__PURE__*/React.createElement("rect", {
      width: w,
      height: h,
      rx: rx,
      fill: fill,
      stroke: stroke,
      strokeWidth: strokeW
    });
    const centerLabel = (dy = 0) => /*#__PURE__*/React.createElement("text", {
      x: w / 2,
      y: h / 2 + 4 + dy,
      textAnchor: "middle",
      fontFamily: "Inter Tight",
      fontWeight: 600,
      fontSize: 13,
      fill: ink
    }, node.label);
    switch (node.kind) {
      case 'service':
        {
          return {
            body: card(10),
            decor: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
              x: 8,
              y: 8,
              width: 16,
              height: 16,
              rx: 4,
              fill: active ? accent : '#faf3dc',
              stroke: active ? accent : '#e4decd',
              strokeWidth: ".8"
            }), /*#__PURE__*/React.createElement("line", {
              x1: 11,
              y1: 16,
              x2: 21,
              y2: 16,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: "1.3",
              strokeLinecap: "round"
            }), /*#__PURE__*/React.createElement("line", {
              x1: 11,
              y1: 19,
              x2: 18,
              y2: 19,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: "1.3",
              strokeLinecap: "round"
            })),
            label: centerLabel()
          };
        }
      case 'store':
        {
          const ry = 6;
          return {
            noShadow: true,
            body: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
              d: `M0 ${ry} a${w / 2} ${ry} 0 1 0 ${w} 0 a${w / 2} ${ry} 0 1 0 ${-w} 0 M0 ${ry} V${h - ry} a${w / 2} ${ry} 0 0 0 ${w} 0 V${ry}`,
              fill: fill,
              stroke: stroke,
              strokeWidth: strokeW
            }), /*#__PURE__*/React.createElement("path", {
              d: `M0 ${ry} a${w / 2} ${ry} 0 1 0 ${w} 0 a${w / 2} ${ry} 0 1 0 ${-w} 0`,
              fill: active ? '#fffbea' : '#fff',
              stroke: stroke,
              strokeWidth: strokeW
            })),
            decor: /*#__PURE__*/React.createElement("g", null, [1, 2, 3].map(i => /*#__PURE__*/React.createElement("path", {
              key: i,
              d: `M4 ${ry + i * 9} a${w / 2 - 4} ${ry * 0.5} 0 0 0 ${w - 8} 0`,
              stroke: active ? accent : '#e4decd',
              strokeWidth: ".8",
              fill: "none"
            }))),
            label: /*#__PURE__*/React.createElement("text", {
              x: w / 2,
              y: h / 2 + ry + 4,
              textAnchor: "middle",
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 13,
              fill: ink
            }, node.label)
          };
        }
      case 'cache':
        {
          return {
            body: card(10),
            decor: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
              cx: w / 2,
              cy: h / 2,
              r: Math.min(w, h) / 2 - 8,
              fill: "none",
              stroke: active ? accent : '#e4decd',
              strokeWidth: ".8",
              strokeDasharray: "3 2"
            }), /*#__PURE__*/React.createElement("circle", {
              cx: w / 2,
              cy: h / 2,
              r: 4,
              fill: active ? accent : '#d9c98b'
            })),
            label: centerLabel()
          };
        }
      case 'queue':
        {
          const pw = (w - 24) / 3;
          return {
            body: card(10),
            decor: /*#__PURE__*/React.createElement("g", null, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("rect", {
              key: i,
              x: 10 + i * (pw + 2),
              y: h / 2 - 8,
              width: pw,
              height: 16,
              rx: 4,
              fill: active && i === 2 ? accent : '#faf3dc',
              stroke: active ? accent : '#e4decd',
              strokeWidth: ".8"
            })), /*#__PURE__*/React.createElement("path", {
              d: `M${w - 14} ${h / 2 - 5} L${w - 6} ${h / 2} L${w - 14} ${h / 2 + 5}`,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: "1.5",
              fill: "none",
              strokeLinecap: "round",
              strokeLinejoin: "round"
            })),
            label: /*#__PURE__*/React.createElement("text", {
              x: w / 2,
              y: h / 2 - 16,
              textAnchor: "middle",
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 12,
              fill: ink
            }, node.label)
          };
        }
      case 'actor':
        {
          return {
            body: card(10),
            decor: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
              cx: w / 2,
              cy: h / 2 - 10,
              r: 7,
              fill: active ? '#fef3c7' : '#f5f0e8',
              stroke: active ? accent : '#e4decd',
              strokeWidth: "1"
            }), /*#__PURE__*/React.createElement("path", {
              d: `M${w / 2 - 12} ${h / 2 + 8} Q${w / 2} ${h / 2 - 2} ${w / 2 + 12} ${h / 2 + 8}`,
              fill: active ? '#fef3c7' : '#f5f0e8',
              stroke: active ? accent : '#e4decd',
              strokeWidth: "1"
            })),
            label: /*#__PURE__*/React.createElement("text", {
              x: w / 2,
              y: h - 8,
              textAnchor: "middle",
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 12,
              fill: ink
            }, node.label)
          };
        }
      case 'gateway':
        {
          const i = Math.min(w * 0.18, 18);
          return {
            body: /*#__PURE__*/React.createElement("path", {
              d: `M${i} 0 L${w - i} 0 L${w} ${h / 2} L${w - i} ${h} L${i} ${h} L0 ${h / 2} Z`,
              fill: fill,
              stroke: stroke,
              strokeWidth: strokeW
            }),
            decor: /*#__PURE__*/React.createElement("g", null, [{
              cx: w / 2,
              cy: h / 2,
              r: 5
            }, {
              cx: w / 2 - 10,
              cy: h / 2,
              r: 3
            }, {
              cx: w / 2 + 10,
              cy: h / 2,
              r: 3
            }].map((c, j) => /*#__PURE__*/React.createElement("circle", {
              key: j,
              cx: c.cx,
              cy: c.cy,
              r: c.r,
              fill: active ? accent : '#e4decd'
            }))),
            label: centerLabel()
          };
        }
      case 'external':
        {
          const d = `M${w * 0.18} ${h * 0.6} C ${w * 0.02} ${h * 0.6}, ${w * 0.02} ${h * 0.2}, ${w * 0.22} ${h * 0.25} C ${w * 0.28} ${h * 0.02}, ${w * 0.58} ${h * 0.02}, ${w * 0.62} ${h * 0.22} C ${w * 0.85} ${h * 0.15}, ${w * 0.98} ${h * 0.35}, ${w * 0.9} ${h * 0.6} C ${w * 0.98} ${h * 0.82}, ${w * 0.75} ${h * 0.98}, ${w * 0.6} ${h * 0.88} C ${w * 0.4} ${h * 1.02}, ${w * 0.1} ${h * 0.95}, ${w * 0.18} ${h * 0.6} Z`;
          return {
            body: /*#__PURE__*/React.createElement("path", {
              d: d,
              fill: fill,
              stroke: stroke,
              strokeWidth: strokeW
            }),
            decor: null,
            label: /*#__PURE__*/React.createElement("text", {
              x: w / 2,
              y: h * 0.6,
              textAnchor: "middle",
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      case 'boundary':
        {
          return {
            body: /*#__PURE__*/React.createElement("rect", {
              width: w,
              height: h,
              rx: 14,
              fill: "transparent",
              stroke: active ? accent : '#d9c98b',
              strokeWidth: 1.5,
              strokeDasharray: "8 5"
            }),
            decor: null,
            label: /*#__PURE__*/React.createElement("text", {
              x: 16,
              y: 22,
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 12,
              fill: active ? '#7a5a00' : muted,
              letterSpacing: ".05em"
            }, node.label.toUpperCase())
          };
        }
      case 'start':
        {
          return {
            body: /*#__PURE__*/React.createElement("rect", {
              width: w,
              height: h,
              rx: h / 2,
              fill: active ? '#fef3c7' : '#26231d',
              stroke: active ? accent : '#26231d',
              strokeWidth: strokeW
            }),
            decor: null,
            label: /*#__PURE__*/React.createElement("text", {
              x: w / 2,
              y: h / 2 + 4.5,
              textAnchor: "middle",
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 13,
              fill: active ? '#7a5a00' : '#fff'
            }, node.label)
          };
        }
      case 'stop':
        {
          return {
            body: /*#__PURE__*/React.createElement("rect", {
              width: w,
              height: h,
              rx: h / 2,
              fill: active ? '#fef3c7' : '#fdecec',
              stroke: active ? accent : '#ecc7c7',
              strokeWidth: strokeW
            }),
            decor: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
              cx: 18,
              cy: h / 2,
              r: "8",
              fill: active ? accent : '#d57a7a'
            }), /*#__PURE__*/React.createElement("rect", {
              x: 18 - 3.5,
              y: h / 2 - 3.5,
              width: "7",
              height: "7",
              rx: "1",
              fill: "#fff"
            })),
            label: /*#__PURE__*/React.createElement("text", {
              x: w / 2 + 6,
              y: h / 2 + 4.5,
              textAnchor: "middle",
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 13,
              fill: ink
            }, node.label)
          };
        }
      case 'decision':
        {
          return {
            body: /*#__PURE__*/React.createElement("path", {
              d: `M${w / 2} 0 L${w} ${h / 2} L${w / 2} ${h} L0 ${h / 2} Z`,
              fill: fill,
              stroke: stroke,
              strokeWidth: strokeW
            }),
            decor: null,
            label: /*#__PURE__*/React.createElement("text", {
              x: w / 2,
              y: h / 2 + 4,
              textAnchor: "middle",
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 13,
              fill: ink
            }, node.label)
          };
        }
      case 'event':
        {
          const r = Math.min(w, h) / 2 - 2;
          return {
            body: /*#__PURE__*/React.createElement("circle", {
              cx: w / 2,
              cy: h / 2,
              r: r,
              fill: active ? '#fef3c7' : '#fdf8e4',
              stroke: active ? accent : '#d9c98b',
              strokeWidth: strokeW
            }),
            decor: /*#__PURE__*/React.createElement("path", {
              d: `M ${w / 2 + 2} ${h / 2 - 8} L ${w / 2 - 4} ${h / 2 + 1} H ${w / 2} L ${w / 2 - 2} ${h / 2 + 8} L ${w / 2 + 4} ${h / 2 - 1} H ${w / 2} Z`,
              fill: active ? '#7a5a00' : '#b79414'
            }),
            label: /*#__PURE__*/React.createElement("text", {
              x: w / 2,
              y: h + 14,
              textAnchor: "middle",
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      case 'function':
        {
          return {
            body: card(12),
            decor: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
              x: 1,
              y: 1,
              width: w - 2,
              height: 4,
              rx: 2,
              fill: active ? accent : '#e4decd'
            }), /*#__PURE__*/React.createElement("g", {
              transform: `translate(${w - 26} 8)`
            }, /*#__PURE__*/React.createElement("rect", {
              width: "20",
              height: "14",
              rx: "3",
              fill: active ? '#fef3c7' : '#faf3dc',
              stroke: active ? accent : '#d9c98b',
              strokeWidth: ".8"
            }), /*#__PURE__*/React.createElement("text", {
              x: "10",
              y: "11",
              textAnchor: "middle",
              fontFamily: "JetBrains Mono",
              fontWeight: 700,
              fontSize: "10",
              fill: active ? '#7a5a00' : muted
            }, "\u03BB"))),
            label: centerLabel()
          };
        }
      case 'worker':
        {
          return {
            body: card(10),
            decor: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("g", {
              transform: `translate(${w - 22} 10)`,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: "1.1",
              fill: "none"
            }, /*#__PURE__*/React.createElement("circle", {
              cx: "6",
              cy: "6",
              r: "3.6"
            }), /*#__PURE__*/React.createElement("circle", {
              cx: "6",
              cy: "6",
              r: "1.2",
              fill: active ? '#7a5a00' : muted
            }), [0, 45, 90, 135, 180, 225, 270, 315].map(a => /*#__PURE__*/React.createElement("line", {
              key: a,
              x1: "6",
              y1: "1.5",
              x2: "6",
              y2: "2.5",
              transform: `rotate(${a} 6 6)`
            }))), /*#__PURE__*/React.createElement("g", {
              transform: `translate(12 ${h - 12})`
            }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("circle", {
              key: i,
              cx: i * 7,
              cy: "0",
              r: "2",
              fill: active ? accent : '#d9c98b',
              opacity: 1 - i * 0.25
            })))),
            label: centerLabel(-2)
          };
        }
      case 'loadbalancer':
        {
          return {
            body: card(10),
            decor: /*#__PURE__*/React.createElement("g", {
              transform: `translate(${w - 30} ${h / 2})`,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: "1.3",
              fill: "none",
              strokeLinecap: "round"
            }, /*#__PURE__*/React.createElement("circle", {
              cx: "0",
              cy: "0",
              r: "3",
              fill: active ? accent : '#fbf6e7'
            }), /*#__PURE__*/React.createElement("line", {
              x1: "3",
              y1: "0",
              x2: "14",
              y2: "-7"
            }), /*#__PURE__*/React.createElement("line", {
              x1: "3",
              y1: "0",
              x2: "16",
              y2: "0"
            }), /*#__PURE__*/React.createElement("line", {
              x1: "3",
              y1: "0",
              x2: "14",
              y2: "7"
            }), /*#__PURE__*/React.createElement("circle", {
              cx: "14",
              cy: "-7",
              r: "1.5",
              fill: active ? '#7a5a00' : muted
            }), /*#__PURE__*/React.createElement("circle", {
              cx: "16",
              cy: "0",
              r: "1.5",
              fill: active ? '#7a5a00' : muted
            }), /*#__PURE__*/React.createElement("circle", {
              cx: "14",
              cy: "7",
              r: "1.5",
              fill: active ? '#7a5a00' : muted
            })),
            label: centerLabel()
          };
        }
      case 'auth':
        {
          const r = Math.min(w * 0.18, 14);
          const d = `M${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${h * 0.55} Q${w} ${h * 0.85} ${w / 2} ${h} Q0 ${h * 0.85} 0 ${h * 0.55} V${r} Q0 0 ${r} 0 Z`;
          return {
            body: /*#__PURE__*/React.createElement("path", {
              d: d,
              fill: fill,
              stroke: stroke,
              strokeWidth: strokeW
            }),
            decor: /*#__PURE__*/React.createElement("g", {
              transform: `translate(${w / 2} ${h * 0.34})`,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: "1.4",
              fill: "none"
            }, /*#__PURE__*/React.createElement("rect", {
              x: "-4",
              y: "-1",
              width: "8",
              height: "7",
              rx: "1.2",
              fill: active ? '#fef3c7' : '#faf3dc'
            }), /*#__PURE__*/React.createElement("path", {
              d: "M-2.5 -1 V-3.5 Q0 -5.5 2.5 -3.5 V-1"
            })),
            label: /*#__PURE__*/React.createElement("text", {
              x: w / 2,
              y: h * 0.74,
              textAnchor: "middle",
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      case 'monitor':
        {
          return {
            body: card(10),
            decor: /*#__PURE__*/React.createElement("g", {
              transform: `translate(10 ${h / 2 - 6})`
            }, /*#__PURE__*/React.createElement("rect", {
              width: w - 20,
              height: "24",
              rx: "3",
              fill: active ? '#fef3c7' : '#faf3dc',
              stroke: active ? accent : '#d9c98b',
              strokeWidth: ".7"
            }), /*#__PURE__*/React.createElement("polyline", {
              points: `4,18 ${(w - 20) * 0.25},10 ${(w - 20) * 0.45},14 ${(w - 20) * 0.7},6 ${w - 24},12`,
              fill: "none",
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: "1.4"
            })),
            label: /*#__PURE__*/React.createElement("text", {
              x: w / 2,
              y: 14,
              textAnchor: "middle",
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      case 'bus':
        {
          return {
            body: card(10),
            decor: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
              x: 10,
              y: h / 2 - 4,
              width: w - 20,
              height: "8",
              rx: "3",
              fill: active ? accent : '#e8deb5',
              stroke: active ? '#7a5a00' : '#b79414',
              strokeWidth: ".7"
            }), [0.2, 0.5, 0.8].map((p, i) => /*#__PURE__*/React.createElement("g", {
              key: i,
              transform: `translate(${10 + (w - 20) * p} ${h / 2})`
            }, /*#__PURE__*/React.createElement("line", {
              x1: "0",
              y1: "-4",
              x2: "0",
              y2: "-9",
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: "1"
            }), /*#__PURE__*/React.createElement("circle", {
              cx: "0",
              cy: "-11",
              r: "2",
              fill: active ? '#7a5a00' : muted
            }), /*#__PURE__*/React.createElement("line", {
              x1: "0",
              y1: "4",
              x2: "0",
              y2: "9",
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: "1"
            }), /*#__PURE__*/React.createElement("circle", {
              cx: "0",
              cy: "11",
              r: "2",
              fill: active ? '#7a5a00' : muted
            })))),
            label: /*#__PURE__*/React.createElement("text", {
              x: w / 2,
              y: 14,
              textAnchor: "middle",
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      case 'stream':
        {
          return {
            body: card(10),
            decor: /*#__PURE__*/React.createElement("g", null, [0, 1, 2].map(row => /*#__PURE__*/React.createElement("path", {
              key: row,
              d: `M10 ${20 + row * 10} Q ${(w - 20) * 0.25 + 10} ${14 + row * 10}, ${(w - 20) * 0.5 + 10} ${20 + row * 10} T ${w - 10} ${20 + row * 10}`,
              fill: "none",
              stroke: active ? row === 0 ? accent : '#e0c870' : row === 0 ? '#b79414' : '#d9c98b',
              strokeWidth: row === 0 ? '1.6' : '1',
              strokeLinecap: "round",
              opacity: 1 - row * 0.25
            }, active && row === 0 && /*#__PURE__*/React.createElement("animate", {
              attributeName: "d",
              values: `M10 ${20} Q ${(w - 20) * 0.25 + 10} ${14}, ${(w - 20) * 0.5 + 10} ${20} T ${w - 10} ${20};M10 ${20} Q ${(w - 20) * 0.25 + 10} ${26}, ${(w - 20) * 0.5 + 10} ${20} T ${w - 10} ${20};M10 ${20} Q ${(w - 20) * 0.25 + 10} ${14}, ${(w - 20) * 0.5 + 10} ${20} T ${w - 10} ${20}`,
              dur: "2s",
              repeatCount: "indefinite"
            })))),
            label: /*#__PURE__*/React.createElement("text", {
              x: w / 2,
              y: 14,
              textAnchor: "middle",
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      case 'firewall':
        {
          return {
            body: card(10),
            decor: /*#__PURE__*/React.createElement("g", {
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: ".7",
              fill: "none"
            }, [0, 1, 2].map(row => {
              const y = 22 + row * 8;
              const offset = row % 2 === 0 ? 0 : (w - 20) / 4;
              return /*#__PURE__*/React.createElement("g", {
                key: row
              }, /*#__PURE__*/React.createElement("line", {
                x1: 10,
                y1: y,
                x2: w - 10,
                y2: y
              }), [0, 1, 2, 3].map(c => /*#__PURE__*/React.createElement("line", {
                key: c,
                x1: 10 + offset + c * (w - 20) / 2,
                y1: y - 8,
                x2: 10 + offset + c * (w - 20) / 2,
                y2: y
              })));
            })),
            label: /*#__PURE__*/React.createElement("text", {
              x: w / 2,
              y: 14,
              textAnchor: "middle",
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 12,
              fill: ink
            }, node.label)
          };
        }
      case 'mobile':
        {
          const pw = Math.min(w * 0.45, 44),
            ph = h - 12;
          const px = (w - pw) / 2,
            py = 6;
          return {
            body: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
              width: w,
              height: h,
              rx: 12,
              fill: "transparent"
            }), /*#__PURE__*/React.createElement("rect", {
              x: px,
              y: py,
              width: pw,
              height: ph,
              rx: "6",
              fill: fill,
              stroke: stroke,
              strokeWidth: strokeW
            }), /*#__PURE__*/React.createElement("rect", {
              x: px + 4,
              y: py + 8,
              width: pw - 8,
              height: ph - 16,
              rx: "2",
              fill: active ? '#fef3c7' : '#faf3dc'
            })),
            decor: /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
              cx: w / 2,
              cy: py + 4,
              r: "1",
              fill: muted
            }), /*#__PURE__*/React.createElement("rect", {
              x: w / 2 - 4,
              y: py + ph - 4,
              width: "8",
              height: "1.5",
              rx: ".5",
              fill: muted
            })),
            label: /*#__PURE__*/React.createElement("text", {
              x: px - 4,
              y: h / 2 + 4,
              textAnchor: "end",
              fontFamily: "Inter Tight",
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      default:
        return null;
    }
  }

  // ===========================================================
  // SLEEK
  // ===========================================================
  const SleekStyle = {
    id: 'sleek',
    name: 'Sleek',
    tagline: 'Soft whites, yellow accent, calm.',
    tokens: {
      bg: '#fffcf3',
      ink: '#26231d',
      muted: '#8f8779',
      accent: '#f5c518',
      line: '#e4decd'
    },
    Defs: () => /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("filter", {
      id: "sleek-soft",
      x: "-20%",
      y: "-20%",
      width: "140%",
      height: "140%"
    }, /*#__PURE__*/React.createElement("feGaussianBlur", {
      in: "SourceAlpha",
      stdDeviation: "4"
    }), /*#__PURE__*/React.createElement("feOffset", {
      dy: "3"
    }), /*#__PURE__*/React.createElement("feComponentTransfer", null, /*#__PURE__*/React.createElement("feFuncA", {
      type: "linear",
      slope: "0.15"
    })), /*#__PURE__*/React.createElement("feMerge", null, /*#__PURE__*/React.createElement("feMergeNode", null), /*#__PURE__*/React.createElement("feMergeNode", {
      in: "SourceGraphic"
    }))), /*#__PURE__*/React.createElement("linearGradient", {
      id: "sleek-node",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#ffffff"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#fbf6e7"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "sleek-node-a",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#fffbea"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#fef3c7"
    })), /*#__PURE__*/React.createElement("radialGradient", {
      id: "sleek-glow",
      cx: ".5",
      cy: ".5",
      r: ".55"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#f5c518",
      stopOpacity: ".28"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#f5c518",
      stopOpacity: "0"
    })), /*#__PURE__*/React.createElement("marker", {
      id: "sleek-arrow",
      viewBox: "0 0 10 10",
      refX: "8",
      refY: "5",
      markerWidth: "7",
      markerHeight: "7",
      orient: "auto-start-reverse"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M0 0 L10 5 L0 10 z",
      fill: "#8f8779"
    })), /*#__PURE__*/React.createElement("marker", {
      id: "sleek-arrow-a",
      viewBox: "0 0 10 10",
      refX: "8",
      refY: "5",
      markerWidth: "7",
      markerHeight: "7",
      orient: "auto-start-reverse"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M0 0 L10 5 L0 10 z",
      fill: "#f5c518"
    })), /*#__PURE__*/React.createElement("marker", {
      id: "sleek-arrow-err",
      viewBox: "0 0 10 10",
      refX: "8",
      refY: "5",
      markerWidth: "7",
      markerHeight: "7",
      orient: "auto-start-reverse"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M0 0 L10 5 L0 10 z",
      fill: "#c0392b"
    })), /*#__PURE__*/React.createElement("pattern", {
      id: "sleek-dots",
      width: "20",
      height: "20",
      patternUnits: "userSpaceOnUse"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "10",
      cy: "10",
      r: ".8",
      fill: "#d9d3c6"
    }))),
    Background: ({
      w,
      h
    }) => /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
      width: w,
      height: h,
      fill: "#fffcf3"
    }), /*#__PURE__*/React.createElement("rect", {
      width: w,
      height: h,
      fill: "url(#sleek-dots)",
      opacity: ".6"
    })),
    Node: ({
      node,
      active
    }) => {
      const ink = '#26231d',
        muted = '#8f8779';
      const fill = active ? 'url(#sleek-node-a)' : 'url(#sleek-node)';
      const stroke = active ? '#f5c518' : '#e4decd';
      const strokeW = active ? 1.5 : 1;
      const shape = shapeOf(node);
      const useKind = !node.shape && node.kind && !hasMedia(node);
      const kindBody = useKind ? sleekKindBody$1(node, {
        fill,
        stroke,
        strokeW,
        ink,
        muted,
        accent: '#f5c518',
        active
      }) : null;
      return /*#__PURE__*/React.createElement("g", {
        transform: `translate(${node.x} ${node.y})`
      }, active && shape !== 'cylinder' && /*#__PURE__*/React.createElement("rect", {
        x: -10,
        y: -10,
        width: node.w + 20,
        height: node.h + 20,
        rx: 18,
        fill: "url(#sleek-glow)"
      }), kindBody ? /*#__PURE__*/React.createElement("g", {
        filter: kindBody.noShadow ? undefined : 'url(#sleek-soft)'
      }, kindBody.body) : /*#__PURE__*/React.createElement("g", {
        filter: "url(#sleek-soft)"
      }, /*#__PURE__*/React.createElement(ShapeShell, {
        node: node,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeW
      })), kindBody && kindBody.decor, /*#__PURE__*/React.createElement(NodeImageOrIcon, {
        node: node
      }), kindBody && kindBody.label !== undefined ? kindBody.label : /*#__PURE__*/React.createElement(NodeLabel, {
        node: node,
        fill: ink,
        sub: node.sub,
        subFill: muted
      }));
    },
    Edge: ({
      edge,
      active
    }) => {
      const kind = edge.kind || 'solid';
      const isDashed = kind === 'dashed',
        isDotted = kind === 'dotted',
        isBold = kind === 'bold';
      const isAsync = kind === 'async',
        isBidir = kind === 'bidir',
        isError = kind === 'error';
      const isSecure = kind === 'secure',
        isRealtime = kind === 'realtime';
      const errorColor = '#c0392b',
        secureColor = '#3a6b3a';
      const baseStroke = isError ? errorColor : isSecure ? secureColor : active ? '#f5c518' : '#b8b0a1';
      const dashAttr = isDashed ? '5 4' : isDotted ? '1 5' : isAsync ? '8 4 1 4' : isRealtime ? '6 3' : undefined;
      const sw = edgeStrokeWidth$1(edge, isBold ? active ? 3 : 2.4 : active ? 2 : 1.4);
      const mid = edgeMidpoint(edge.points);
      const arrowEnd = isError ? 'url(#sleek-arrow-err)' : active ? 'url(#sleek-arrow-a)' : 'url(#sleek-arrow)';
      const arrowStart = isBidir ? active ? 'url(#sleek-arrow-a)' : 'url(#sleek-arrow)' : undefined;
      return /*#__PURE__*/React.createElement("g", null, isBold && /*#__PURE__*/React.createElement("path", {
        d: edge.d,
        fill: "none",
        stroke: baseStroke,
        opacity: ".18",
        strokeWidth: sw + 6,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }), isRealtime && /*#__PURE__*/React.createElement("path", {
        d: edge.d,
        fill: "none",
        stroke: "#f5c518",
        opacity: ".35",
        strokeWidth: sw + 3,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: edge.d,
        fill: "none",
        stroke: isRealtime ? '#b8860b' : baseStroke,
        strokeWidth: sw,
        strokeDasharray: dashAttr,
        strokeLinecap: isDotted ? 'round' : 'butt',
        markerEnd: arrowEnd,
        markerStart: arrowStart,
        strokeLinejoin: "round"
      }, isRealtime && /*#__PURE__*/React.createElement("animate", {
        attributeName: "stroke-dashoffset",
        from: "0",
        to: "-18",
        dur: ".5s",
        repeatCount: "indefinite"
      })), active && !isRealtime && /*#__PURE__*/React.createElement("circle", {
        r: "3.5",
        fill: isError ? errorColor : '#f5c518'
      }, /*#__PURE__*/React.createElement("animateMotion", {
        dur: "1.4s",
        repeatCount: "indefinite",
        path: edge.d,
        rotate: "auto"
      })), isSecure && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${mid.x} ${mid.y - 14})`
      }, /*#__PURE__*/React.createElement("rect", {
        x: "-7",
        y: "-8",
        width: "14",
        height: "13",
        rx: "2.5",
        fill: "#fffcf3",
        stroke: secureColor,
        strokeWidth: "1"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "-3",
        y: "-3",
        width: "6",
        height: "6",
        rx: ".8",
        fill: secureColor
      }), /*#__PURE__*/React.createElement("path", {
        d: "M-2 -3 V-5 Q0 -7 2 -5 V-3",
        fill: "none",
        stroke: secureColor,
        strokeWidth: "1"
      })), isError && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${mid.x} ${mid.y - 12})`,
        stroke: errorColor,
        strokeWidth: "1.4",
        fill: "#fffcf3"
      }, /*#__PURE__*/React.createElement("circle", {
        r: "6"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "-3",
        y1: "-3",
        x2: "3",
        y2: "3"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "3",
        y1: "-3",
        x2: "-3",
        y2: "3"
      })), /*#__PURE__*/React.createElement(EdgeLabel, {
        text: edge.label,
        x: mid.x,
        y: mid.y,
        bg: "#fffcf3",
        fg: isError ? errorColor : isSecure ? secureColor : active ? '#7a5a00' : '#8f8779',
        mono: true
      }));
    }
  };

  // ===========================================================
  // SKETCH
  // ===========================================================
  const SketchStyle = {
    id: 'sketch',
    name: 'Sketch',
    tagline: 'Like a whiteboard photo — warm and honest.',
    tokens: {
      bg: '#fbf7ec',
      ink: '#2b2a26',
      muted: '#5a5148',
      accent: '#d97757',
      line: '#3a362d'
    },
    Defs: () => /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("filter", {
      id: "sk-rough"
    }, /*#__PURE__*/React.createElement("feTurbulence", {
      type: "fractalNoise",
      baseFrequency: "0.9",
      numOctaves: "2",
      seed: "3"
    }), /*#__PURE__*/React.createElement("feDisplacementMap", {
      in: "SourceGraphic",
      scale: "0.9"
    })), /*#__PURE__*/React.createElement("pattern", {
      id: "sk-paper",
      width: "160",
      height: "160",
      patternUnits: "userSpaceOnUse"
    }, /*#__PURE__*/React.createElement("rect", {
      width: "160",
      height: "160",
      fill: "#fbf7ec"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "30",
      cy: "40",
      r: ".6",
      fill: "#c6bfae"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "110",
      cy: "90",
      r: ".5",
      fill: "#c6bfae"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "60",
      cy: "130",
      r: ".7",
      fill: "#c6bfae"
    })), /*#__PURE__*/React.createElement("marker", {
      id: "sk-arrow",
      viewBox: "0 0 10 10",
      refX: "8",
      refY: "5",
      markerWidth: "8",
      markerHeight: "8",
      orient: "auto-start-reverse"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M0 1 L10 5 L0 9 L3 5 Z",
      fill: "#3a362d"
    })), /*#__PURE__*/React.createElement("marker", {
      id: "sk-arrow-a",
      viewBox: "0 0 10 10",
      refX: "8",
      refY: "5",
      markerWidth: "8",
      markerHeight: "8",
      orient: "auto-start-reverse"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M0 1 L10 5 L0 9 L3 5 Z",
      fill: "#d97757"
    }))),
    Background: ({
      w,
      h
    }) => /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
      width: w,
      height: h,
      fill: "url(#sk-paper)"
    }), Array.from({
      length: Math.ceil(h / 28)
    }).map((_, i) => /*#__PURE__*/React.createElement("line", {
      key: i,
      x1: "0",
      x2: w,
      y1: i * 28 + 14,
      y2: i * 28 + 14,
      stroke: "#ded6c2",
      strokeWidth: ".6",
      strokeDasharray: "2 3"
    }))),
    Node: ({
      node,
      active
    }) => {
      const seed = node.id.charCodeAt(0) + node.id.length;
      const jitter = n => seed * (n + 1) % 7 * 0.35 - 1;
      const ink = active ? '#d97757' : '#2b2a26';
      const fill = active ? '#fce7d6' : '#ffffff';
      const shape = shapeOf(node);
      const media = hasMedia(node);
      return /*#__PURE__*/React.createElement("g", {
        transform: `translate(${node.x} ${node.y})`
      }, /*#__PURE__*/React.createElement("g", {
        transform: `translate(${jitter(0)} ${jitter(1) + 3})`,
        opacity: ".55"
      }, /*#__PURE__*/React.createElement(ShapeShell, {
        node: node,
        fill: "#f0e9d6",
        stroke: "none",
        strokeWidth: 0
      })), /*#__PURE__*/React.createElement("g", {
        filter: "url(#sk-rough)"
      }, /*#__PURE__*/React.createElement(ShapeShell, {
        node: node,
        fill: fill,
        stroke: ink,
        strokeWidth: 1.8
      })), /*#__PURE__*/React.createElement("g", {
        filter: "url(#sk-rough)",
        opacity: ".5"
      }, /*#__PURE__*/React.createElement(ShapeShell, {
        node: node,
        fill: "none",
        stroke: ink,
        strokeWidth: 1
      })), /*#__PURE__*/React.createElement(NodeImageOrIcon, {
        node: node
      }), !media && !['diamond', 'circle', 'oval', 'pill'].includes(shape) && /*#__PURE__*/React.createElement("g", {
        transform: "translate(12, 10)"
      }, /*#__PURE__*/React.createElement(NodeIcon, {
        kind: node.kind,
        color: ink,
        sketchy: true
      })), !media && ['diamond', 'circle', 'oval', 'pill'].includes(shape) && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${node.w / 2 - 7} ${node.h / 2 - 18})`
      }, /*#__PURE__*/React.createElement(NodeIcon, {
        kind: node.kind,
        color: ink,
        sketchy: true
      })), /*#__PURE__*/React.createElement(NodeLabel, {
        node: node,
        fill: ink,
        sub: node.sub,
        subFill: "#5a5148",
        fontFamily: "Caveat",
        fontWeight: 600,
        fontSize: 18,
        hand: true,
        centerOffsetY: ['diamond', 'circle', 'oval', 'pill'].includes(shape) ? 8 : 0
      }));
    },
    Edge: ({
      edge,
      active
    }) => {
      const kind = edge.kind || 'solid';
      const isDashed = kind === 'dashed',
        isDotted = kind === 'dotted',
        isBold = kind === 'bold';
      const isAsync = kind === 'async',
        isBidir = kind === 'bidir',
        isError = kind === 'error';
      const isSecure = kind === 'secure',
        isRealtime = kind === 'realtime';
      const errorColor = '#c14a3a',
        secureColor = '#3d6b3d';
      const baseStroke = isError ? errorColor : isSecure ? secureColor : active ? '#d97757' : '#3a362d';
      const dashAttr = isDashed ? '6 5' : isDotted ? '1.5 5' : isAsync ? '9 4 1.5 4' : isRealtime ? '7 4' : undefined;
      const sw = edgeStrokeWidth$1(edge, isBold ? active ? 3 : 2.6 : active ? 2.2 : 1.5);
      const d1 = roughPath(edge.points, 1.6, edge.id.charCodeAt(0) * 7);
      const d2 = roughPath(edge.points, 1.2, edge.id.charCodeAt(0) * 13 + 1);
      const mid = edgeMidpoint(edge.points);
      return /*#__PURE__*/React.createElement("g", null, isRealtime && /*#__PURE__*/React.createElement("path", {
        d: d1,
        fill: "none",
        stroke: "#d97757",
        opacity: ".25",
        strokeWidth: sw + 3,
        strokeLinecap: "round",
        filter: "url(#sk-rough)"
      }), /*#__PURE__*/React.createElement("path", {
        d: d1,
        fill: "none",
        stroke: isRealtime ? '#b85a3a' : baseStroke,
        strokeWidth: sw,
        strokeDasharray: dashAttr,
        strokeLinecap: "round",
        markerEnd: active ? 'url(#sk-arrow-a)' : 'url(#sk-arrow)',
        markerStart: isBidir ? active ? 'url(#sk-arrow-a)' : 'url(#sk-arrow)' : undefined,
        filter: "url(#sk-rough)"
      }, isRealtime && /*#__PURE__*/React.createElement("animate", {
        attributeName: "stroke-dashoffset",
        from: "0",
        to: "-22",
        dur: ".55s",
        repeatCount: "indefinite"
      })), /*#__PURE__*/React.createElement("path", {
        d: d2,
        fill: "none",
        stroke: baseStroke,
        strokeWidth: isBold ? 1.4 : .7,
        strokeDasharray: dashAttr,
        opacity: ".4",
        strokeLinecap: "round"
      }), active && !isRealtime && /*#__PURE__*/React.createElement("circle", {
        r: "4",
        fill: isError ? errorColor : '#d97757',
        stroke: "#fbf7ec",
        strokeWidth: "1.5"
      }, /*#__PURE__*/React.createElement("animateMotion", {
        dur: "1.6s",
        repeatCount: "indefinite",
        path: edge.d,
        rotate: "auto"
      })), isSecure && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${mid.x} ${mid.y - 14}) rotate(-2)`,
        fill: "#fbf7ec",
        stroke: secureColor,
        strokeWidth: "1.4",
        filter: "url(#sk-rough)"
      }, /*#__PURE__*/React.createElement("rect", {
        x: "-7",
        y: "-7",
        width: "14",
        height: "13",
        rx: "2"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M-2.5 -7 V-10 Q0 -12 2.5 -10 V-7",
        fill: "none"
      })), isError && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${mid.x} ${mid.y - 13}) rotate(-3)`,
        stroke: errorColor,
        strokeWidth: "1.6",
        fill: "#fbf7ec",
        filter: "url(#sk-rough)"
      }, /*#__PURE__*/React.createElement("circle", {
        r: "7"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "-3.5",
        y1: "-3.5",
        x2: "3.5",
        y2: "3.5"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "3.5",
        y1: "-3.5",
        x2: "-3.5",
        y2: "3.5"
      })), edge.label && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${mid.x} ${mid.y - 2}) rotate(-3)`
      }, /*#__PURE__*/React.createElement("rect", {
        x: -edge.label.length * 4.5 - 4,
        y: -10,
        width: edge.label.length * 9 + 8,
        height: 18,
        rx: 3,
        fill: "#fbf7ec"
      }), /*#__PURE__*/React.createElement("text", {
        textAnchor: "middle",
        dominantBaseline: "middle",
        fontFamily: "Caveat",
        fontSize: "15",
        fill: isError ? errorColor : isSecure ? secureColor : active ? '#d97757' : '#5a5148'
      }, edge.label)));
    }
  };

  // ===========================================================
  // ISO
  // ===========================================================
  const IsoStyle = {
    id: 'iso',
    name: 'Iso',
    tagline: 'Flat isometric with pipe-style edges.',
    tokens: {
      bg: '#f3f4f6',
      ink: '#1e293b',
      muted: '#64748b',
      accent: '#f5c518',
      line: '#cbd5e1'
    },
    Defs: () => /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
      id: "iso-top",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#ffffff"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#eef1f6"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "iso-top-a",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#ffe28a"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#f5c518"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "iso-right",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "0"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#dde2ea"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#c7cfda"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "iso-front",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#e7ebf1"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#d2d8e1"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "iso-pipe",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "0"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#2563eb"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#60a5fa"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "iso-pipe-a",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "0"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#f59e0b"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#fde68a"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "iso-pipe-err",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "0"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#b91c1c"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#ef4444"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "iso-pipe-sec",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "0"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#15803d"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#4ade80"
    })), /*#__PURE__*/React.createElement("pattern", {
      id: "iso-grid",
      width: "24",
      height: "14",
      patternUnits: "userSpaceOnUse",
      patternTransform: "skewX(-30)"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M0 0 L24 0 M0 0 L0 14",
      stroke: "#dbe0e7",
      strokeWidth: ".6"
    }))),
    Background: ({
      w,
      h
    }) => /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
      width: w,
      height: h,
      fill: "#f3f4f6"
    }), /*#__PURE__*/React.createElement("rect", {
      width: w,
      height: h,
      fill: "url(#iso-grid)",
      opacity: ".9"
    })),
    Node: ({
      node,
      active
    }) => {
      const depth = 12;
      const w = node.w,
        h = node.h;
      const shape = shapeOf(node);
      const topFill = active ? 'url(#iso-top-a)' : 'url(#iso-top)';
      const media = hasMedia(node);
      return /*#__PURE__*/React.createElement("g", {
        transform: `translate(${node.x} ${node.y})`
      }, /*#__PURE__*/React.createElement("ellipse", {
        cx: w / 2 + 4,
        cy: h + depth + 6,
        rx: w * .4,
        ry: "3.5",
        fill: "#000",
        opacity: ".07"
      }), (shape === 'rect' || shape === 'square') && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
        d: `M 0 ${h} L ${w} ${h} L ${w} ${h + depth} L 0 ${h + depth} Z`,
        fill: "url(#iso-front)",
        stroke: "#c7cfda",
        strokeWidth: ".8"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M ${w} 0 L ${w + depth * 0.6} ${-depth * 0.5} L ${w + depth * 0.6} ${h - depth * 0.5} L ${w} ${h} Z`,
        fill: "url(#iso-right)",
        stroke: "#c7cfda",
        strokeWidth: ".8"
      })), /*#__PURE__*/React.createElement(ShapeShell, {
        node: node,
        fill: topFill,
        stroke: active ? '#f59e0b' : '#cfd6e0',
        strokeWidth: 1
      }), /*#__PURE__*/React.createElement(NodeImageOrIcon, {
        node: node
      }), !media && !['diamond', 'circle', 'oval', 'pill'].includes(shape) && /*#__PURE__*/React.createElement("g", {
        transform: "translate(10, 8)"
      }, /*#__PURE__*/React.createElement(NodeIcon, {
        kind: node.kind,
        color: active ? '#7a5a00' : '#475569'
      })), !media && ['diamond', 'circle', 'oval', 'pill'].includes(shape) && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${w / 2 - 7} ${h / 2 - 18})`
      }, /*#__PURE__*/React.createElement(NodeIcon, {
        kind: node.kind,
        color: active ? '#7a5a00' : '#475569'
      })), /*#__PURE__*/React.createElement(NodeLabel, {
        node: node,
        fill: active ? '#3a2a00' : '#1e293b',
        sub: node.sub,
        subFill: active ? '#7a5a00' : '#64748b',
        fontSize: 12.5,
        centerOffsetY: ['diamond', 'circle', 'oval', 'pill'].includes(shape) ? 8 : 0
      }));
    },
    Edge: ({
      edge,
      active
    }) => {
      const kind = edge.kind || 'solid';
      const isDashed = kind === 'dashed',
        isDotted = kind === 'dotted',
        isBold = kind === 'bold';
      const isAsync = kind === 'async',
        isBidir = kind === 'bidir',
        isError = kind === 'error';
      const isSecure = kind === 'secure',
        isRealtime = kind === 'realtime';
      const mid = edgeMidpoint(edge.points);
      const stroke = isError ? 'url(#iso-pipe-err)' : isSecure ? 'url(#iso-pipe-sec)' : active ? 'url(#iso-pipe-a)' : 'url(#iso-pipe)';
      const dashAttr = isDashed ? '10 6' : isDotted ? '2 7' : isAsync ? '12 5 2 5' : isRealtime ? '8 5' : undefined;
      const sw = edgeStrokeWidth$1(edge, isBold ? active ? 8 : 6 : active ? 6 : 4);
      const labelFg = isError ? '#7a1a1a' : isSecure ? '#1f4d1f' : active ? '#7a5a00' : '#475569';
      return /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
        d: edge.d,
        fill: "none",
        stroke: "rgba(0,0,0,.08)",
        strokeWidth: sw + 2,
        transform: "translate(1,2)",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }), isRealtime && /*#__PURE__*/React.createElement("path", {
        d: edge.d,
        fill: "none",
        stroke: "#f59e0b",
        opacity: ".35",
        strokeWidth: sw + 4,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: edge.d,
        fill: "none",
        stroke: stroke,
        strokeWidth: sw,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeDasharray: dashAttr
      }, isRealtime && /*#__PURE__*/React.createElement("animate", {
        attributeName: "stroke-dashoffset",
        from: "0",
        to: "-26",
        dur: ".6s",
        repeatCount: "indefinite"
      })), active && !isRealtime && /*#__PURE__*/React.createElement("circle", {
        r: "3",
        fill: "#fff"
      }, /*#__PURE__*/React.createElement("animateMotion", {
        dur: "1.4s",
        repeatCount: "indefinite",
        path: edge.d,
        rotate: "auto"
      })), isBidir && /*#__PURE__*/React.createElement("circle", {
        r: "3",
        fill: "#fff"
      }, /*#__PURE__*/React.createElement("animateMotion", {
        dur: "1.6s",
        repeatCount: "indefinite",
        path: edge.d,
        rotate: "auto",
        keyPoints: "1;0",
        keyTimes: "0;1"
      })), isSecure && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${mid.x} ${mid.y - 14})`
      }, /*#__PURE__*/React.createElement("rect", {
        x: "-8",
        y: "-9",
        width: "16",
        height: "14",
        rx: "3",
        fill: "#fff",
        stroke: "#1f4d1f",
        strokeWidth: "1.2"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "-3",
        y: "-3",
        width: "6",
        height: "6",
        rx: ".8",
        fill: "#1f4d1f"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M-2.5 -3 V-6 Q0 -8 2.5 -6 V-3",
        fill: "none",
        stroke: "#1f4d1f",
        strokeWidth: "1.2"
      })), isError && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${mid.x} ${mid.y - 14})`,
        stroke: "#7a1a1a",
        strokeWidth: "1.5",
        fill: "#fff"
      }, /*#__PURE__*/React.createElement("circle", {
        r: "7"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "-3.5",
        y1: "-3.5",
        x2: "3.5",
        y2: "3.5"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "3.5",
        y1: "-3.5",
        x2: "-3.5",
        y2: "3.5"
      })), /*#__PURE__*/React.createElement(EdgeLabel, {
        text: edge.label,
        x: mid.x,
        y: mid.y,
        bg: "#f3f4f6",
        fg: labelFg,
        mono: true
      }));
    }
  };

  // ===========================================================
  // BLUEPRINT
  // ===========================================================
  const BlueprintStyle = {
    id: 'blueprint',
    name: 'Blueprint',
    tagline: 'Cyan on navy. Technical drawing.',
    tokens: {
      bg: '#0b2545',
      ink: '#e0fbfc',
      muted: '#8bb5d4',
      accent: '#ffd166',
      line: '#3b82a0'
    },
    Defs: () => /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("pattern", {
      id: "bp-grid",
      width: "20",
      height: "20",
      patternUnits: "userSpaceOnUse"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M 20 0 L 0 0 0 20",
      fill: "none",
      stroke: "#1e3a62",
      strokeWidth: ".6"
    })), /*#__PURE__*/React.createElement("pattern", {
      id: "bp-grid-hi",
      width: "100",
      height: "100",
      patternUnits: "userSpaceOnUse"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M 100 0 L 0 0 0 100",
      fill: "none",
      stroke: "#2a4d80",
      strokeWidth: ".8"
    })), /*#__PURE__*/React.createElement("marker", {
      id: "bp-arrow",
      viewBox: "0 0 10 10",
      refX: "9",
      refY: "5",
      markerWidth: "6",
      markerHeight: "6",
      orient: "auto-start-reverse"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M0 1 L10 5 L0 9",
      fill: "none",
      stroke: "#80d0e0",
      strokeWidth: "1.3"
    })), /*#__PURE__*/React.createElement("marker", {
      id: "bp-arrow-a",
      viewBox: "0 0 10 10",
      refX: "9",
      refY: "5",
      markerWidth: "6",
      markerHeight: "6",
      orient: "auto-start-reverse"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M0 1 L10 5 L0 9",
      fill: "none",
      stroke: "#ffd166",
      strokeWidth: "1.5"
    }))),
    Background: ({
      w,
      h
    }) => /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("rect", {
      width: w,
      height: h,
      fill: "#0b2545"
    }), /*#__PURE__*/React.createElement("rect", {
      width: w,
      height: h,
      fill: "url(#bp-grid)"
    }), /*#__PURE__*/React.createElement("rect", {
      width: w,
      height: h,
      fill: "url(#bp-grid-hi)"
    })),
    Node: ({
      node,
      active
    }) => {
      const stroke = active ? '#ffd166' : '#80d0e0';
      const shape = shapeOf(node);
      const media = hasMedia(node);
      return /*#__PURE__*/React.createElement("g", {
        transform: `translate(${node.x} ${node.y})`
      }, /*#__PURE__*/React.createElement(ShapeShell, {
        node: node,
        fill: "none",
        stroke: stroke,
        strokeWidth: active ? 1.6 : 1,
        strokeDasharray: node.kind === 'external' ? '4 3' : undefined
      }), /*#__PURE__*/React.createElement(NodeImageOrIcon, {
        node: node
      }), !media && !['diamond', 'circle', 'oval', 'pill'].includes(shape) && /*#__PURE__*/React.createElement("g", {
        transform: "translate(10, 8)"
      }, /*#__PURE__*/React.createElement(NodeIcon, {
        kind: node.kind,
        color: stroke,
        mono: true
      })), !media && ['diamond', 'circle', 'oval', 'pill'].includes(shape) && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${node.w / 2 - 7} ${node.h / 2 - 18})`
      }, /*#__PURE__*/React.createElement(NodeIcon, {
        kind: node.kind,
        color: stroke,
        mono: true
      })), /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("text", {
        x: node.w / 2,
        y: node.h / 2 + 4 + (['diamond', 'circle', 'oval', 'pill'].includes(shape) ? 8 : 0),
        textAnchor: "middle",
        fontFamily: "JetBrains Mono",
        fontWeight: "600",
        fontSize: "11",
        fill: active ? '#ffd166' : '#e0fbfc',
        letterSpacing: ".04em"
      }, node.label.toUpperCase()), node.sub && /*#__PURE__*/React.createElement("text", {
        x: node.w / 2,
        y: node.h - 8,
        textAnchor: "middle",
        fontFamily: "JetBrains Mono",
        fontSize: "8.5",
        fill: "#8bb5d4"
      }, node.sub)));
    },
    Edge: ({
      edge,
      active
    }) => {
      const kind = edge.kind || 'solid';
      const isDashed = kind === 'dashed',
        isDotted = kind === 'dotted',
        isBold = kind === 'bold';
      const isAsync = kind === 'async',
        isBidir = kind === 'bidir',
        isError = kind === 'error';
      const isSecure = kind === 'secure',
        isRealtime = kind === 'realtime';
      const errorColor = '#ff6b6b',
        secureColor = '#7eea9c';
      const stroke = isError ? errorColor : isSecure ? secureColor : active ? '#ffd166' : '#80d0e0';
      const dashAttr = isDashed ? '4 3' : isDotted ? '1 4' : isAsync ? '7 3 1 3' : isRealtime ? '5 3' : undefined;
      const sw = edgeStrokeWidth$1(edge, isBold ? active ? 2.2 : 1.8 : active ? 1.4 : 1);
      const mid = edgeMidpoint(edge.points);
      const arrowEnd = active ? 'url(#bp-arrow-a)' : 'url(#bp-arrow)';
      return /*#__PURE__*/React.createElement("g", null, isRealtime && /*#__PURE__*/React.createElement("path", {
        d: edge.d,
        fill: "none",
        stroke: "#ffd166",
        opacity: ".3",
        strokeWidth: sw + 2.5
      }), /*#__PURE__*/React.createElement("path", {
        d: edge.d,
        fill: "none",
        stroke: isRealtime ? '#ffd166' : stroke,
        strokeWidth: sw,
        strokeDasharray: dashAttr,
        strokeLinecap: isDotted ? 'round' : 'butt',
        markerEnd: arrowEnd,
        markerStart: isBidir ? arrowEnd : undefined
      }, isRealtime && /*#__PURE__*/React.createElement("animate", {
        attributeName: "stroke-dashoffset",
        from: "0",
        to: "-16",
        dur: ".5s",
        repeatCount: "indefinite"
      })), active && !isRealtime && /*#__PURE__*/React.createElement("circle", {
        r: "2.5",
        fill: isError ? errorColor : '#ffd166'
      }, /*#__PURE__*/React.createElement("animateMotion", {
        dur: "1.5s",
        repeatCount: "indefinite",
        path: edge.d,
        rotate: "auto"
      })), isSecure && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${mid.x} ${mid.y - 13})`,
        fill: "#0b2545",
        stroke: secureColor,
        strokeWidth: "1"
      }, /*#__PURE__*/React.createElement("rect", {
        x: "-6",
        y: "-7",
        width: "12",
        height: "11",
        rx: "1.5"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M-2 -7 V-9.5 Q0 -11 2 -9.5 V-7",
        fill: "none"
      })), isError && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${mid.x} ${mid.y - 12})`,
        stroke: errorColor,
        strokeWidth: "1.2",
        fill: "#0b2545"
      }, /*#__PURE__*/React.createElement("circle", {
        r: "6"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "-3",
        y1: "-3",
        x2: "3",
        y2: "3"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "3",
        y1: "-3",
        x2: "-3",
        y2: "3"
      })), edge.label && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${mid.x} ${mid.y})`
      }, /*#__PURE__*/React.createElement("rect", {
        x: -edge.label.length * 3.3 - 4,
        y: -7,
        width: edge.label.length * 6.6 + 8,
        height: 14,
        fill: "#0b2545",
        stroke: stroke,
        strokeWidth: ".5"
      }), /*#__PURE__*/React.createElement("text", {
        textAnchor: "middle",
        dominantBaseline: "middle",
        fontFamily: "JetBrains Mono",
        fontSize: "9",
        fill: stroke,
        letterSpacing: ".05em"
      }, edge.label.toUpperCase())));
    }
  };

  // ===========================================================
  // CITY — True Isometric 3D Map
  // ===========================================================
  const CityStyle = {
    id: 'city',
    name: 'City',
    tagline: 'True 3D Map. City blocks, isometric projection.',
    tokens: {
      bg: '#F9FAFB',
      ink: '#0f172a',
      muted: '#64748b',
      accent: '#007AFF',
      line: '#D1D5DB'
    },
    isometric: true,
    Defs: () => /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("radialGradient", {
      id: "grid-fade",
      cx: "50%",
      cy: "50%",
      r: "60%"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0%",
      stopColor: "white",
      stopOpacity: "1"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "100%",
      stopColor: "white",
      stopOpacity: "0"
    })), /*#__PURE__*/React.createElement("mask", {
      id: "grid-fade-mask"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "-2000",
      y: "-2000",
      width: "6000",
      height: "6000",
      fill: "url(#grid-fade)"
    })), /*#__PURE__*/React.createElement("pattern", {
      id: "clay-iso-grid",
      width: "40",
      height: "40",
      patternUnits: "userSpaceOnUse"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M 40 0 L 0 0 0 40",
      fill: "none",
      stroke: "#EEEEEE",
      strokeWidth: "1.5",
      vectorEffect: "non-scaling-stroke"
    })), /*#__PURE__*/React.createElement("filter", {
      id: "clay-ao",
      x: "-30%",
      y: "-30%",
      width: "160%",
      height: "160%"
    }, /*#__PURE__*/React.createElement("feGaussianBlur", {
      in: "SourceAlpha",
      stdDeviation: "12",
      result: "blur1"
    }), /*#__PURE__*/React.createElement("feOffset", {
      in: "blur1",
      dy: "16",
      result: "offset1"
    }), /*#__PURE__*/React.createElement("feComponentTransfer", {
      in: "offset1",
      result: "ao"
    }, /*#__PURE__*/React.createElement("feFuncA", {
      type: "linear",
      slope: ".06"
    })), /*#__PURE__*/React.createElement("feGaussianBlur", {
      in: "SourceAlpha",
      stdDeviation: "3",
      result: "blur2"
    }), /*#__PURE__*/React.createElement("feOffset", {
      in: "blur2",
      dy: "2",
      result: "offset2"
    }), /*#__PURE__*/React.createElement("feComponentTransfer", {
      in: "offset2",
      result: "contact"
    }, /*#__PURE__*/React.createElement("feFuncA", {
      type: "linear",
      slope: ".15"
    })), /*#__PURE__*/React.createElement("feMerge", null, /*#__PURE__*/React.createElement("feMergeNode", {
      in: "ao"
    }), /*#__PURE__*/React.createElement("feMergeNode", {
      in: "contact"
    }), /*#__PURE__*/React.createElement("feMergeNode", {
      in: "SourceGraphic"
    }))), /*#__PURE__*/React.createElement("filter", {
      id: "clay-ao-sm",
      x: "-30%",
      y: "-30%",
      width: "160%",
      height: "160%"
    }, /*#__PURE__*/React.createElement("feGaussianBlur", {
      in: "SourceAlpha",
      stdDeviation: "4"
    }), /*#__PURE__*/React.createElement("feOffset", {
      dy: "3"
    }), /*#__PURE__*/React.createElement("feComponentTransfer", null, /*#__PURE__*/React.createElement("feFuncA", {
      type: "linear",
      slope: ".15"
    })), /*#__PURE__*/React.createElement("feMerge", null, /*#__PURE__*/React.createElement("feMergeNode", null), /*#__PURE__*/React.createElement("feMergeNode", {
      in: "SourceGraphic"
    }))), /*#__PURE__*/React.createElement("linearGradient", {
      id: "clay-top",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#ffffff"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#fdfdfd"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "clay-right",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "0"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#f2f2f2"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#e0e0e0"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "clay-front",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#e0e0e0"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#cccccc"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "clay-wall-left",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#e4e4e7"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#d4d4d8"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "clay-wall-right",
      x1: "0",
      y1: "0",
      x2: "0",
      y2: "1"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#ffffff"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#f4f4f5"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "clay-pipe-cool",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "0"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#005bb5"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: ".5",
      stopColor: "#4da6ff"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#007AFF"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "clay-pipe-warm",
      x1: "0",
      y1: "0",
      x2: "1",
      y2: "0"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0",
      stopColor: "#cc9300"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: ".5",
      stopColor: "#ffdb4d"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "1",
      stopColor: "#FFB800"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "clay-packet-warm",
      x1: "1",
      y1: "0.5",
      x2: "0",
      y2: "0.5"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0%",
      stopColor: "#FFBB0C",
      stopOpacity: "1"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "50%",
      stopColor: "#FFDD86",
      stopOpacity: "0.6"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "100%",
      stopColor: "#fef3c7",
      stopOpacity: "0"
    })), /*#__PURE__*/React.createElement("linearGradient", {
      id: "clay-packet-cool",
      x1: "1",
      y1: "0.5",
      x2: "0",
      y2: "0.5"
    }, /*#__PURE__*/React.createElement("stop", {
      offset: "0%",
      stopColor: "#3b82f6",
      stopOpacity: "1"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "50%",
      stopColor: "#93c5fd",
      stopOpacity: "0.6"
    }), /*#__PURE__*/React.createElement("stop", {
      offset: "100%",
      stopColor: "#dbeafe",
      stopOpacity: "0"
    })), /*#__PURE__*/React.createElement("filter", {
      id: "clay-packet-glow",
      x: "-100%",
      y: "-100%",
      width: "300%",
      height: "300%"
    }, /*#__PURE__*/React.createElement("feGaussianBlur", {
      stdDeviation: "2.5",
      result: "blur"
    }), /*#__PURE__*/React.createElement("feComposite", {
      in: "SourceGraphic",
      in2: "blur",
      operator: "over"
    }))),
    Background: ({
      w,
      h
    }) => /*#__PURE__*/React.createElement("rect", {
      width: w * 2,
      height: h * 2,
      x: -w / 2,
      y: -h / 2,
      fill: "url(#clay-iso-grid)",
      mask: "url(#grid-fade-mask)"
    }),
    Node: ({
      node,
      active
    }) => {
      const {
        w,
        h
      } = node;
      const kind = node.kind;
      const isBoundary = kind === 'boundary';
      if (kind === 'store') {
        const r = Math.min(w, h) / 2;
        const cx = r,
          cy = h / 2,
          Z = 56,
          E = 1.225 * Z;
        const tan1 = {
          x: cx + r / Math.sqrt(2),
          y: cy + r / Math.sqrt(2)
        };
        const tan2 = {
          x: cx - r / Math.sqrt(2),
          y: cy - r / Math.sqrt(2)
        };
        const pSplit = {
          x: cx - r / Math.sqrt(2),
          y: cy + r / Math.sqrt(2)
        };
        return /*#__PURE__*/React.createElement("g", {
          transform: `translate(${node.x} ${node.y})`
        }, active && /*#__PURE__*/React.createElement("ellipse", {
          cx: 0,
          cy: cy,
          rx: r + 8,
          ry: 28,
          fill: "none",
          stroke: "#007AFF",
          strokeWidth: "3",
          opacity: "0.6"
        }, /*#__PURE__*/React.createElement("animate", {
          attributeName: "opacity",
          values: "0.6;0.1;0.6",
          dur: "2s",
          repeatCount: "indefinite"
        })), /*#__PURE__*/React.createElement("ellipse", {
          cx: cx + 8,
          cy: cy + 10,
          rx: r,
          ry: r * 0.577,
          fill: "rgba(0,0,0,0.35)",
          filter: "url(#clay-ao)"
        }), /*#__PURE__*/React.createElement("path", {
          d: `M ${tan2.x} ${tan2.y} L ${tan2.x + E} ${tan2.y - E} A ${r} ${r} 0 0 0 ${pSplit.x + E} ${pSplit.y - E} L ${pSplit.x} ${pSplit.y} A ${r} ${r} 0 0 1 ${tan2.x} ${tan2.y} Z`,
          fill: "url(#clay-wall-left)"
        }), /*#__PURE__*/React.createElement("path", {
          d: `M ${pSplit.x} ${pSplit.y} L ${pSplit.x + E} ${pSplit.y - E} A ${r} ${r} 0 0 0 ${tan1.x + E} ${tan1.y - E} L ${tan1.x} ${tan1.y} A ${r} ${r} 0 0 1 ${pSplit.x} ${pSplit.y} Z`,
          fill: "url(#clay-wall-right)"
        }), [0.33, 0.66].map((f, i) => /*#__PURE__*/React.createElement("path", {
          key: i,
          d: `M ${tan2.x + E * f} ${tan2.y - E * f} A ${r} ${r} 0 0 0 ${tan1.x + E * f} ${tan1.y - E * f}`,
          fill: "none",
          stroke: "#a1a1aa",
          strokeWidth: "1",
          strokeDasharray: "2 2",
          opacity: "0.55"
        })), /*#__PURE__*/React.createElement("g", {
          transform: `translate(${E} ${-E})`
        }, /*#__PURE__*/React.createElement("circle", {
          cx: cx,
          cy: cy,
          r: r,
          fill: "url(#clay-top)",
          stroke: "#e4e4e7",
          strokeWidth: "1"
        }), /*#__PURE__*/React.createElement("circle", {
          cx: cx,
          cy: cy,
          r: r - 4,
          fill: "none",
          stroke: "rgba(0,0,0,0.06)",
          strokeWidth: "1"
        }), /*#__PURE__*/React.createElement("g", {
          transform: `translate(${cx} ${cy})`
        }, /*#__PURE__*/React.createElement("g", {
          transform: "translate(-7 -16)"
        }, /*#__PURE__*/React.createElement(NodeIcon, {
          kind: "store",
          color: "#475569",
          mono: true
        })), /*#__PURE__*/React.createElement("text", {
          y: 12,
          textAnchor: "middle",
          fill: "#334155",
          fontSize: "14",
          fontWeight: "600",
          fontFamily: "Inter Tight"
        }, node.label), node.sub && /*#__PURE__*/React.createElement("text", {
          y: 26,
          textAnchor: "middle",
          fill: "#64748b",
          fontSize: "11",
          fontFamily: "JetBrains Mono"
        }, node.sub))), /*#__PURE__*/React.createElement("g", {
          transform: `translate(${E * 0.06} ${cy - E * 0.06})`
        }, /*#__PURE__*/React.createElement("rect", {
          x: "-2",
          y: "-10",
          width: E * 0.08,
          height: "20",
          rx: "3",
          fill: "#1e293b",
          transform: "skewY(-45)"
        }), /*#__PURE__*/React.createElement("rect", {
          x: "-1",
          y: "-8",
          width: E * 0.04,
          height: "16",
          rx: "2",
          fill: "#007AFF",
          filter: "url(#clay-ao-sm)",
          transform: "skewY(-45)"
        })));
      }
      if (kind === 'gateway') {
        const i = Math.min(w * 0.14, 16);
        const Z = 42,
          E = 1.225 * Z;
        const p0 = {
            x: i,
            y: 0
          },
          p1 = {
            x: w - i,
            y: 0
          },
          p2 = {
            x: w,
            y: h / 2
          },
          p3 = {
            x: w - i,
            y: h
          },
          p4 = {
            x: i,
            y: h
          },
          p5 = {
            x: 0,
            y: h / 2
          };
        const t0 = {
            x: i + E,
            y: -E
          },
          t1 = {
            x: w - i + E,
            y: -E
          },
          t2 = {
            x: w + E,
            y: h / 2 - E
          },
          t3 = {
            x: w - i + E,
            y: h - E
          },
          t4 = {
            x: i + E,
            y: h - E
          },
          t5 = {
            x: E,
            y: h / 2 - E
          };
        const poly = pts => pts.map(p => `${p.x},${p.y}`).join(' ');
        return /*#__PURE__*/React.createElement("g", {
          transform: `translate(${node.x} ${node.y})`
        }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
          id: `gw-wall-1-${node.id}`,
          x1: "0",
          y1: "0",
          x2: "0",
          y2: "1"
        }, /*#__PURE__*/React.createElement("stop", {
          offset: "0",
          stopColor: "#cbd5e1"
        }), /*#__PURE__*/React.createElement("stop", {
          offset: "1",
          stopColor: "#94a3b8"
        })), /*#__PURE__*/React.createElement("linearGradient", {
          id: `gw-wall-2-${node.id}`,
          x1: "0",
          y1: "0",
          x2: "0",
          y2: "1"
        }, /*#__PURE__*/React.createElement("stop", {
          offset: "0",
          stopColor: "#e4e4e7"
        }), /*#__PURE__*/React.createElement("stop", {
          offset: "1",
          stopColor: "#d4d4d8"
        }))), active && /*#__PURE__*/React.createElement("path", {
          d: `M ${poly([p0, p1, p2, p3, p4, p5])} Z`,
          fill: "none",
          stroke: "#007AFF",
          strokeWidth: "3",
          opacity: "0.6",
          transform: "scale(1.05) translate(-2 1)"
        }, /*#__PURE__*/React.createElement("animate", {
          attributeName: "opacity",
          values: "0.6;0.1;0.6",
          dur: "2s",
          repeatCount: "indefinite"
        })), /*#__PURE__*/React.createElement("path", {
          d: `M ${poly([p0, p1, p2, p3, p4, p5])} Z`,
          fill: "rgba(0,0,0,0.35)",
          filter: "url(#clay-ao)"
        }), /*#__PURE__*/React.createElement("path", {
          d: `M ${p0.x},${p0.y} L ${p5.x},${p5.y} L ${t5.x},${t5.y} L ${t0.x},${t0.y} Z`,
          fill: `url(#gw-wall-1-${node.id})`
        }), /*#__PURE__*/React.createElement("path", {
          d: `M ${p5.x},${p5.y} L ${p4.x},${p4.y} L ${t4.x},${t4.y} L ${t5.x},${t5.y} Z`,
          fill: `url(#gw-wall-2-${node.id})`
        }), /*#__PURE__*/React.createElement("path", {
          d: `M ${p4.x},${p4.y} L ${p3.x},${p3.y} L ${t3.x},${t3.y} L ${t4.x},${t4.y} Z`,
          fill: "url(#clay-wall-right)"
        }), /*#__PURE__*/React.createElement("g", {
          transform: `translate(${p5.x * 0.7 + p4.x * 0.3} ${p5.y * 0.7 + p4.y * 0.3})`
        }, /*#__PURE__*/React.createElement("ellipse", {
          cx: E * 0.2,
          cy: -E * 0.2 - 8,
          rx: "1.5",
          ry: "3.5",
          fill: "#fcd34d",
          filter: "url(#clay-ao-sm)"
        }), /*#__PURE__*/React.createElement("ellipse", {
          cx: E * 0.2,
          cy: -E * 0.2 + 8,
          rx: "1.5",
          ry: "3.5",
          fill: "#f59e0b",
          filter: "url(#clay-ao-sm)"
        })), /*#__PURE__*/React.createElement("g", {
          transform: `translate(${p5.x + E * 0.06} ${p5.y - E * 0.06})`
        }, /*#__PURE__*/React.createElement("rect", {
          x: "-2",
          y: "-10",
          width: E * 0.08,
          height: "20",
          rx: "3",
          fill: "#1e293b",
          transform: "skewY(-45)"
        }), /*#__PURE__*/React.createElement("rect", {
          x: "-1",
          y: "-8",
          width: E * 0.04,
          height: "16",
          rx: "2",
          fill: "#007AFF",
          filter: "url(#clay-ao-sm)",
          transform: "skewY(-45)"
        })), /*#__PURE__*/React.createElement("path", {
          d: `M ${poly([t0, t1, t2, t3, t4, t5])} Z`,
          fill: "url(#clay-top)",
          stroke: "none"
        }), /*#__PURE__*/React.createElement("path", {
          d: `M ${poly([t0, t1, t2, t3, t4, t5])} Z`,
          fill: "none",
          stroke: "rgba(0,0,0,0.06)",
          strokeWidth: "2.5",
          transform: "scale(0.9) translate(4 2)",
          style: {
            pointerEvents: 'none'
          }
        }), /*#__PURE__*/React.createElement("g", {
          transform: `translate(${w / 2 + E} ${h / 2 - E})`
        }, /*#__PURE__*/React.createElement("g", {
          transform: "translate(-7 -16)"
        }, /*#__PURE__*/React.createElement(NodeIcon, {
          kind: "gateway",
          color: "#007AFF",
          mono: true
        })), /*#__PURE__*/React.createElement("text", {
          y: 12,
          textAnchor: "middle",
          fill: "#334155",
          fontSize: "14",
          fontWeight: "600",
          fontFamily: "Inter Tight"
        }, node.label), node.sub && /*#__PURE__*/React.createElement("text", {
          y: 26,
          textAnchor: "middle",
          fill: "#64748b",
          fontSize: "11",
          fontFamily: "JetBrains Mono"
        }, node.sub)));
      }
      const Z = isBoundary ? 6 : kind === 'client' || kind === 'actor' ? 32 : 42;
      const E = 1.225 * Z;
      const R = isBoundary ? 0 : 16;
      const topFill = isBoundary ? 'transparent' : 'url(#clay-top)';
      const wallStroke = isBoundary ? '#cbd5e1' : 'none';
      const layout = node.layout || 'center';
      const icons = node.icons || [node.kind];
      return /*#__PURE__*/React.createElement("g", {
        transform: `translate(${node.x} ${node.y})`
      }, /*#__PURE__*/React.createElement("rect", {
        width: w,
        height: h,
        rx: R,
        fill: isBoundary ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.5)',
        filter: "url(#clay-ao)"
      }), active && !isBoundary && /*#__PURE__*/React.createElement("rect", {
        width: w,
        height: h,
        rx: R,
        fill: "none",
        stroke: "#007AFF",
        strokeWidth: "3",
        opacity: "0.6",
        transform: "scale(1.06) translate(-2 -2)"
      }, /*#__PURE__*/React.createElement("animate", {
        attributeName: "opacity",
        values: "0.6;0.1;0.6",
        dur: "2s",
        repeatCount: "indefinite"
      })), isBoundary ? /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
        d: `M 0 0 L 0 ${h} L ${E} ${h - E} L ${E} ${-E} Z`,
        fill: "transparent",
        stroke: wallStroke,
        strokeWidth: 1,
        strokeLinejoin: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M 0 ${h} L ${w} ${h} L ${w + E} ${h - E} L ${E} ${h - E} Z`,
        fill: "transparent",
        stroke: wallStroke,
        strokeWidth: 1,
        strokeLinejoin: "round"
      })) : /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
        id: `corner-grad-${node.id}`,
        gradientUnits: "userSpaceOnUse",
        x1: 0,
        y1: h - R,
        x2: R,
        y2: h
      }, /*#__PURE__*/React.createElement("stop", {
        offset: "0",
        stopColor: "#d4d4d8"
      }), /*#__PURE__*/React.createElement("stop", {
        offset: "1",
        stopColor: "#f4f4f5"
      }))), /*#__PURE__*/React.createElement("path", {
        d: `M 0 ${R} L 0 ${h - R} L ${E} ${h - R - E} L ${E} ${R - E} Z`,
        fill: "url(#clay-wall-left)"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M 0 ${h - R} A ${R} ${R} 0 0 0 ${R} ${h} L ${R + E} ${h - E} A ${R} ${R} 0 0 1 ${E} ${h - R - E} Z`,
        fill: `url(#corner-grad-${node.id})`
      }), /*#__PURE__*/React.createElement("path", {
        d: `M ${R} ${h} L ${w - R} ${h} L ${w - R + E} ${h - E} L ${R + E} ${h - E} Z`,
        fill: "url(#clay-wall-right)"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M ${w - R} ${h} A ${R} ${R} 0 0 0 ${w} ${h - R} L ${w + E} ${h - R - E} A ${R} ${R} 0 0 1 ${w - R + E} ${h - E} Z`,
        fill: "url(#clay-wall-right)"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${R + E} ${-E} A ${R} ${R} 0 0 0 ${E} ${R - E} Z`,
        fill: "url(#clay-wall-left)"
      })), !isBoundary && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("g", {
        transform: `translate(${E * 0.06} ${h / 2 - E * 0.06})`
      }, /*#__PURE__*/React.createElement("rect", {
        x: "-2",
        y: "-10",
        width: E * 0.08,
        height: "20",
        rx: "3",
        fill: "#1e293b",
        transform: "skewY(-45)"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "-1",
        y: "-8",
        width: E * 0.04,
        height: "16",
        rx: "2",
        fill: "#007AFF",
        filter: "url(#clay-ao-sm)",
        transform: "skewY(-45)"
      })), /*#__PURE__*/React.createElement("g", {
        transform: `translate(${w / 2 + 2} ${h - 2})`
      }, /*#__PURE__*/React.createElement("rect", {
        x: "-10",
        y: "-2",
        width: "20",
        height: E * 0.08,
        rx: "3",
        fill: "#1e293b",
        transform: "skewX(-45)"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "-8",
        y: "-1",
        width: "16",
        height: E * 0.04,
        rx: "2",
        fill: "#007AFF",
        filter: "url(#clay-ao-sm)",
        transform: "skewX(-45)"
      }))), /*#__PURE__*/React.createElement("rect", {
        x: E,
        y: -E,
        width: w,
        height: h,
        rx: R,
        fill: topFill,
        stroke: isBoundary ? '#cbd5e1' : 'none',
        strokeWidth: isBoundary ? 1 : 0
      }), !isBoundary && /*#__PURE__*/React.createElement("rect", {
        x: E + 3,
        y: -E + 3,
        width: w - 6,
        height: h - 6,
        rx: Math.max(2, R - 3),
        fill: "transparent",
        stroke: "rgba(0,0,0,0.06)",
        strokeWidth: "2"
      }), /*#__PURE__*/React.createElement("g", {
        transform: `translate(${E} ${-E})`
      }, layout === 'multi-row' && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("line", {
        x1: 0,
        y1: h / 2,
        x2: w,
        y2: h / 2,
        stroke: "#e2e8f0",
        strokeWidth: 1.5
      }), icons.map((ic, idx) => {
        const cellW = w / icons.length;
        return /*#__PURE__*/React.createElement("g", {
          key: idx
        }, idx > 0 && /*#__PURE__*/React.createElement("line", {
          x1: idx * cellW,
          y1: 0,
          x2: idx * cellW,
          y2: h / 2,
          stroke: "#e2e8f0",
          strokeWidth: 1.5
        }), /*#__PURE__*/React.createElement("g", {
          transform: `translate(${idx * cellW + cellW / 2} ${h / 4})`
        }, /*#__PURE__*/React.createElement(NodeIcon, {
          kind: ic,
          color: "#475569",
          mono: true
        })));
      }), /*#__PURE__*/React.createElement("text", {
        x: w / 2,
        y: h * 0.75 + 4,
        textAnchor: "middle",
        fill: "#334155",
        fontSize: "13",
        fontWeight: "600",
        fontFamily: "Inter Tight"
      }, node.label)), layout === 'inline' && /*#__PURE__*/React.createElement("g", null, icons.map((ic, idx) => {
        const cellW = w / icons.length;
        return /*#__PURE__*/React.createElement("g", {
          key: idx
        }, idx > 0 && /*#__PURE__*/React.createElement("line", {
          x1: idx * cellW,
          y1: 0,
          x2: idx * cellW,
          y2: h,
          stroke: "#e2e8f0",
          strokeWidth: 1.5
        }), /*#__PURE__*/React.createElement("g", {
          transform: `translate(${idx * cellW + cellW / 2} ${h / 2})`
        }, /*#__PURE__*/React.createElement(NodeIcon, {
          kind: ic,
          color: "#475569",
          mono: true
        })));
      })), layout === 'center' && /*#__PURE__*/React.createElement("g", null, isBoundary ? /*#__PURE__*/React.createElement("text", {
        x: 18,
        y: 28,
        fill: "#94a3b8",
        fontSize: "18",
        fontWeight: "600",
        fontFamily: "Inter Tight",
        letterSpacing: "0.05em"
      }, node.label.toUpperCase()) : /*#__PURE__*/React.createElement("g", null, kind === 'queue' && /*#__PURE__*/React.createElement("g", null, [0, 1, 2].map(qi => {
        const pw = (w - 28) / 3,
          px = 10 + qi * (pw + 4);
        return /*#__PURE__*/React.createElement("rect", {
          key: qi,
          x: px,
          y: 8,
          width: pw,
          height: 14,
          rx: "3",
          fill: qi === 2 ? '#FFB800' : '#fde68a',
          stroke: "#b45309",
          strokeWidth: "1"
        });
      }), /*#__PURE__*/React.createElement("path", {
        d: `M ${w - 14} 15 L ${w - 6} 15 M ${w - 10} 11 L ${w - 6} 15 L ${w - 10} 19`,
        stroke: "#b45309",
        strokeWidth: "1.5",
        fill: "none",
        strokeLinecap: "round"
      })), kind === 'cache' && /*#__PURE__*/React.createElement("g", null, [0, 1, 2, 3].map(ci => {
        const cw = (w - 24) / 4,
          cx2 = 10 + ci * (cw + 1);
        return /*#__PURE__*/React.createElement("rect", {
          key: ci,
          x: cx2,
          y: 10,
          width: cw - 1,
          height: 10,
          rx: "1.5",
          fill: "#0f172a",
          stroke: "#334155",
          strokeWidth: "0.5"
        });
      })), (kind === 'client' || kind === 'actor') && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
        cx: w / 2,
        cy: 12,
        r: "6",
        fill: "#cbd5e1",
        stroke: "#64748b",
        strokeWidth: "1"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M ${w / 2 - 10} 22 Q ${w / 2} 14, ${w / 2 + 10} 22`,
        fill: "none",
        stroke: "#64748b",
        strokeWidth: "1"
      })), kind === 'external' && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${w / 2} 16)`
      }, /*#__PURE__*/React.createElement("path", {
        d: "M -8 4 Q 0 -6, 8 4",
        fill: "none",
        stroke: "#64748b",
        strokeWidth: "1.5"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M -5 4 Q 0 -2, 5 4",
        fill: "none",
        stroke: "#64748b",
        strokeWidth: "1.5"
      }), /*#__PURE__*/React.createElement("circle", {
        cx: "0",
        cy: "4",
        r: "1.5",
        fill: "#64748b"
      })), kind === 'event' && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("circle", {
        cx: w / 2,
        cy: 14,
        r: "8",
        fill: "#fef3c7",
        stroke: "#f59e0b",
        strokeWidth: "1"
      }), /*#__PURE__*/React.createElement("path", {
        d: `M ${w / 2 + 1} 9 L ${w / 2 - 2} 15 L ${w / 2 + 1} 15 L ${w / 2 - 1} 19 L ${w / 2 + 3} 13 L ${w / 2} 13 Z`,
        fill: "#f59e0b"
      })), /*#__PURE__*/React.createElement("g", {
        transform: `translate(${w / 2} ${['queue', 'cache', 'gateway', 'client', 'actor', 'external', 'event'].includes(kind) ? h / 2 + 8 : h / 2})`
      }, hasMedia(node) ? /*#__PURE__*/React.createElement("g", {
        transform: `translate(${-node.w / 2} ${-node.h / 2})`
      }, /*#__PURE__*/React.createElement(NodeImageOrIcon, {
        node: node
      })) : !['queue', 'cache', 'gateway', 'client', 'actor', 'external', 'event'].includes(kind) ? /*#__PURE__*/React.createElement("g", {
        transform: "translate(-7 -16)"
      }, /*#__PURE__*/React.createElement(NodeIcon, {
        kind: icons[0],
        color: "#475569",
        mono: true
      })) : null, /*#__PURE__*/React.createElement("text", {
        y: 12,
        textAnchor: "middle",
        fill: "#334155",
        fontSize: "14",
        fontWeight: "600",
        fontFamily: "Inter Tight"
      }, node.label), node.sub && /*#__PURE__*/React.createElement("text", {
        y: 26,
        textAnchor: "middle",
        fill: "#64748b",
        fontSize: "11",
        fontFamily: "JetBrains Mono"
      }, node.sub))))), layout === 'inline' && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${w / 2 + E / 2} ${h - E / 2}) rotate(45) scale(1, 1.732)`
      }, /*#__PURE__*/React.createElement("text", {
        textAnchor: "middle",
        dominantBaseline: "middle",
        fill: "#64748b",
        fontSize: "12",
        fontWeight: "600",
        fontFamily: "Inter Tight"
      }, node.label)));
    },
    Edge: ({
      edge,
      active
    }) => {
      const kind = edge.kind || 'solid';
      const isDashed = kind === 'dashed',
        isDotted = kind === 'dotted';
      const isBold = kind === 'bold',
        isAsync = kind === 'async';
      const isBidir = kind === 'bidir',
        isError = kind === 'error';
      const isSecure = kind === 'secure',
        isRealtime = kind === 'realtime';
      const warm = active || kind === 'warm' || isError || isRealtime;
      const errorPipe = '#dc2626',
        securePipe = '#16a34a';
      const pipeFill = isError ? errorPipe : isSecure ? securePipe : warm ? 'url(#clay-pipe-warm)' : 'url(#clay-pipe-cool)';
      const dash = isDashed ? '16 10' : isDotted ? '2 9' : isAsync ? '14 5 2 5' : isRealtime ? '10 6' : undefined;
      const coreSw = edgeStrokeWidth$1(edge, isBold ? 8 : 6);
      const outerSw = edgeStrokeWidth$1(edge, isBold ? 11 : 8);
      const mid = edgeMidpoint(edge.points);
      return /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("path", {
        d: edge.d,
        fill: "none",
        stroke: "rgba(0,0,0,.15)",
        strokeWidth: "14",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        filter: "url(#clay-ao-sm)"
      }), /*#__PURE__*/React.createElement("path", {
        d: edge.d,
        fill: "none",
        stroke: isError ? '#7f1d1d' : isSecure ? '#14532d' : '#64748b',
        strokeWidth: outerSw,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }), /*#__PURE__*/React.createElement("path", {
        d: edge.d,
        fill: "none",
        stroke: pipeFill,
        strokeWidth: coreSw,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeDasharray: dash
      }, isRealtime && /*#__PURE__*/React.createElement("animate", {
        attributeName: "stroke-dashoffset",
        from: "0",
        to: "-32",
        dur: ".7s",
        repeatCount: "indefinite"
      })), /*#__PURE__*/React.createElement("path", {
        d: edge.d,
        fill: "none",
        stroke: "rgba(255,255,255,0.4)",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        transform: "translate(-1, -1)"
      }), active && !isRealtime && /*#__PURE__*/React.createElement("g", null, [0, 1, 2, 3].map(i => /*#__PURE__*/React.createElement("g", {
        key: i
      }, /*#__PURE__*/React.createElement("animateMotion", {
        dur: "1.8s",
        repeatCount: "indefinite",
        path: edge.d,
        begin: `${i * -0.45}s`,
        rotate: "auto"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M -24 0 L -6 -3.5 L 6 0 L -6 3.5 Z",
        fill: isError ? errorPipe : warm ? 'url(#clay-packet-warm)' : 'url(#clay-packet-cool)',
        filter: "url(#clay-packet-glow)"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M -8 0 L 0 -4.5 L 8 0 L 0 4.5 Z",
        fill: "#ffffff",
        filter: "url(#clay-packet-glow)",
        opacity: "0.9"
      }), /*#__PURE__*/React.createElement("circle", {
        r: "1.5",
        fill: "white"
      })))), isBidir && /*#__PURE__*/React.createElement("g", null, /*#__PURE__*/React.createElement("animateMotion", {
        dur: "2s",
        repeatCount: "indefinite",
        path: edge.d,
        keyPoints: "1;0",
        keyTimes: "0;1",
        rotate: "auto"
      }), /*#__PURE__*/React.createElement("circle", {
        r: "3.5",
        fill: "#fff",
        filter: "url(#clay-packet-glow)"
      })), isSecure && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${mid.x} ${mid.y - 30}) rotate(45) scale(1, 1.732)`,
        fill: "#fff",
        stroke: "#16a34a",
        strokeWidth: "1.5",
        filter: "url(#clay-ao-sm)"
      }, /*#__PURE__*/React.createElement("rect", {
        x: "-9",
        y: "-10",
        width: "18",
        height: "16",
        rx: "3"
      }), /*#__PURE__*/React.createElement("path", {
        d: "M-3 -10 V-13.5 Q0 -16 3 -13.5 V-10",
        fill: "none"
      }), /*#__PURE__*/React.createElement("rect", {
        x: "-3.5",
        y: "-5",
        width: "7",
        height: "7",
        rx: "1",
        fill: "#16a34a"
      })), isError && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${mid.x} ${mid.y - 30}) rotate(45) scale(1, 1.732)`,
        fill: "#fff",
        stroke: "#dc2626",
        strokeWidth: "2",
        filter: "url(#clay-ao-sm)"
      }, /*#__PURE__*/React.createElement("circle", {
        r: "9"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "-4.5",
        y1: "-4.5",
        x2: "4.5",
        y2: "4.5"
      }), /*#__PURE__*/React.createElement("line", {
        x1: "4.5",
        y1: "-4.5",
        x2: "-4.5",
        y2: "4.5"
      })), edge.label && /*#__PURE__*/React.createElement("g", {
        transform: `translate(${mid.x} ${mid.y}) translate(0 -36) rotate(45) scale(1, 1.732)`
      }, /*#__PURE__*/React.createElement("rect", {
        x: -edge.label.length * 3.6 - 8,
        y: -10,
        width: edge.label.length * 7.2 + 16,
        height: 20,
        rx: "4",
        fill: "#ffffff",
        stroke: "#e2e8f0",
        strokeWidth: "1.5",
        filter: "url(#clay-ao-sm)"
      }), /*#__PURE__*/React.createElement("text", {
        textAnchor: "middle",
        dominantBaseline: "middle",
        fontFamily: "JetBrains Mono",
        fontSize: "10.5",
        fontWeight: "600",
        fill: warm ? '#b45309' : '#1d4ed8'
      }, edge.label)));
    }
  };
  const BUILTIN_STYLES = {
    sleek: SleekStyle,
    sketch: SketchStyle,
    iso: IsoStyle,
    city: CityStyle,
    blueprint: BlueprintStyle
  };

  const STYLES = {
    ...BUILTIN_STYLES
  };
  const _registry = new Map(Object.entries(BUILTIN_STYLES));
  function registerStyle(name, styleModule) {
    const required = ['Node', 'Edge', 'tokens'];
    const missing = required.filter(k => !styleModule[k]);
    if (missing.length > 0) {
      throw new Error(`registerStyle("${name}"): missing required exports: ${missing.join(', ')}`);
    }
    if (_registry.has(name)) {
      console.warn(`rl-flow: style "${name}" is being overwritten`);
    }
    const entry = {
      ...styleModule,
      id: name
    };
    _registry.set(name, entry);
    STYLES[name] = entry;
  }
  function getStyle(name) {
    return _registry.get(name) || BUILTIN_STYLES.sleek;
  }
  function listStyles() {
    return Array.from(_registry.keys());
  }

  // -----------------------------------------------------------
  // Export utilities — SVG download, PNG export, embed helpers.
  // Zero dependencies. Works in any browser environment.
  // -----------------------------------------------------------

  const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Caveat:wght@500;600&family=Instrument+Serif:ital@0;1&display=swap');`;
  function downloadSVG(svgElement, filename = 'diagram.svg') {
    if (!svgElement) return;
    const clone = svgElement.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    const style = document.createElement('style');
    style.textContent = FONT_IMPORT + '\nsvg { font-family: "Inter Tight", sans-serif; }';
    clone.insertBefore(style, clone.firstChild);
    try {
      const bbox = svgElement.getBBox();
      const pad = 40;
      clone.setAttribute('width', String(bbox.width + pad * 2));
      clone.setAttribute('height', String(bbox.height + pad * 2));
      clone.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`);
    } catch (_) {
      // getBBox not available (e.g. offscreen) — skip
    }
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clone);
    if (!source.startsWith('<?xml')) {
      source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    }
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  function svgToString(svgElement) {
    if (!svgElement) return '';
    const clone = svgElement.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const style = document.createElement('style');
    style.textContent = FONT_IMPORT;
    clone.insertBefore(style, clone.firstChild);
    return new XMLSerializer().serializeToString(clone);
  }
  function downloadPNG(svgElement, filename = 'diagram.png', scale = 2) {
    if (!svgElement) return;
    const svgStr = svgToString(svgElement);
    const blob = new Blob([svgStr], {
      type: 'image/svg+xml'
    });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = url;
  }

  const ICON = (paths, opts = {}) => /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: opts.fill || 'none',
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, paths);
  const ZoomIn = () => ICON(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "21",
    x2: "16.65",
    y2: "16.65"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "11",
    y1: "8",
    x2: "11",
    y2: "14"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "11",
    x2: "14",
    y2: "11"
  })));
  const ZoomOut = () => ICON(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "21",
    x2: "16.65",
    y2: "16.65"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "11",
    x2: "14",
    y2: "11"
  })));
  const FsEnter = () => ICON(/*#__PURE__*/React.createElement("path", {
    d: "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
  }));
  const FsExit = () => ICON(/*#__PURE__*/React.createElement("path", {
    d: "M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
  }));
  const Download = () => ICON(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "7 10 12 15 17 10"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "15",
    x2: "12",
    y2: "3"
  })));
  const Prev = () => ICON(/*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  }));
  const Next = () => ICON(/*#__PURE__*/React.createElement("polyline", {
    points: "9 18 15 12 9 6"
  }));
  const Play = () => ICON(/*#__PURE__*/React.createElement("polygon", {
    points: "6 4 20 12 6 20 6 4"
  }), {
    fill: 'currentColor'
  });
  const Pause = () => ICON(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "5",
    width: "4",
    height: "14",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "5",
    width: "4",
    height: "14",
    fill: "currentColor"
  })));

  /**
   * `playerControls` (optional): when present, Diagram renders a step player
   * overlay. Shape:
   *   {
   *     mode: 'basic' | 'advanced',
   *     stepIndex, totalSteps, stepTitle,
   *     playing, speed, interval,
   *     onPlayPause, onPrev, onNext, onGoto(i), onSpeedChange(s),
   *   }
   */
  function Diagram({
    graph,
    style = 'sleek',
    activeNodes = [],
    activeEdges = [],
    padding = 28,
    className,
    fullscreenTarget = null,
    onNodeClick,
    onEdgeClick,
    playerControls = null
  }) {
    const Style = getStyle(style) || STYLES.sleek;
    const G = React.useMemo(() => resolveGraph(graph), [graph]);
    const bounds = React.useMemo(() => {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      G.nodes.forEach(n => {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.w);
        maxY = Math.max(maxY, n.y + n.h);
      });
      G.edges.forEach(e => e.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }));
      if (!isFinite(minX)) {
        minX = 0;
        minY = 0;
        maxX = 800;
        maxY = 600;
      }
      return {
        minX: minX - 10,
        minY: minY - 15,
        w: maxX - minX + 20,
        h: maxY - minY + 40
      };
    }, [G]);
    const containerRef = React.useRef(null);
    const svgRef = React.useRef(null);
    const dragRef = React.useRef(null);
    const [isFullscreen, setIsFullscreen] = React.useState(false);
    const [isHovered, setIsHovered] = React.useState(false);
    const [isDragging, setIsDragging] = React.useState(false);
    const [zoom, setZoom] = React.useState(1);
    const [pan, setPan] = React.useState({
      x: 0,
      y: 0
    });
    React.useEffect(() => {
      const onChange = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', onChange);
      return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);
    const baseW = bounds.w + padding * 2;
    const baseH = bounds.h + padding * 2;
    const vbW = baseW / zoom,
      vbH = baseH / zoom;
    const cx = bounds.minX - padding + baseW / 2 + pan.x;
    const cy = bounds.minY - padding + baseH / 2 + pan.y;
    const handleMouseDown = e => {
      if (e.button !== 0) return;
      setIsDragging(true);
      dragRef.current = {
        mx: e.clientX,
        my: e.clientY,
        px: pan.x,
        py: pan.y
      };
    };
    const handleMouseMove = e => {
      if (!isDragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.mx;
      const dy = e.clientY - dragRef.current.my;
      const rect = containerRef.current?.getBoundingClientRect();
      const scale = rect ? Math.min(rect.width / vbW, rect.height / vbH) : 1;
      setPan({
        x: dragRef.current.px - dx / scale,
        y: dragRef.current.py - dy / scale
      });
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };
    React.useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const onWheel = e => {
        e.preventDefault();
        setZoom(z => Math.max(0.2, Math.min(4, z * (e.deltaY > 0 ? 0.9 : 1.1))));
      };
      el.addEventListener('wheel', onWheel, {
        passive: false
      });
      return () => el.removeEventListener('wheel', onWheel);
    });
    const showControls = isHovered || isDragging || isFullscreen;
    return /*#__PURE__*/React.createElement("div", {
      ref: containerRef,
      className: className,
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => {
        setIsHovered(false);
        handleMouseUp();
      },
      style: {
        width: '100%',
        height: '100%',
        position: 'relative',
        background: Style.tokens.bg,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("svg", {
      ref: svgRef,
      viewBox: `${cx - vbW / 2} ${cy - vbH / 2} ${vbW} ${vbH}`,
      preserveAspectRatio: "xMidYMid meet",
      role: "img",
      "aria-roledescription": "diagram",
      "aria-label": graph && graph.title ? graph.title : 'Diagram',
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseUp,
      style: {
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: isDragging ? 'grabbing' : 'grab'
      }
    }, /*#__PURE__*/React.createElement("style", null, `
          @keyframes fd-edge-draw {
            from { stroke-dashoffset: var(--fd-edge-len, 600); }
            to   { stroke-dashoffset: 0; }
          }
          .fd-draw-on {
            stroke-dasharray: var(--fd-edge-len, 600);
            animation: fd-edge-draw .55s ease-out both;
          }
          @media (prefers-reduced-motion: reduce) {
            * { animation: none !important; transition: none !important; }
          }
        `), Style.Defs && /*#__PURE__*/React.createElement(Style.Defs, null), /*#__PURE__*/React.createElement(Style.Background, {
      w: G.canvas.w,
      h: G.canvas.h,
      grid: G.canvas.grid
    }), G.edges.map(e => {
      const fromTo = `${e.from || ''} → ${e.to || ''}`;
      const desc = e.label ? `${e.label} (${fromTo})` : fromTo;
      return /*#__PURE__*/React.createElement("g", {
        key: e.id,
        "data-edge-id": e.id,
        role: "img",
        onClick: onEdgeClick ? () => onEdgeClick(e) : undefined,
        style: onEdgeClick ? {
          cursor: 'pointer'
        } : undefined
      }, /*#__PURE__*/React.createElement("title", null, desc), /*#__PURE__*/React.createElement(Style.Edge, {
        edge: e,
        active: activeEdges.includes(e.id)
      }));
    }), G.nodes.map(n => {
      const descBits = [n.kind, n.sub].filter(Boolean).join(' — ');
      return /*#__PURE__*/React.createElement("g", {
        key: n.id,
        "data-node-id": n.id,
        role: "img",
        onClick: onNodeClick ? () => onNodeClick(n) : undefined,
        style: onNodeClick ? {
          cursor: 'pointer'
        } : undefined
      }, /*#__PURE__*/React.createElement("title", null, n.label || n.id), descBits && /*#__PURE__*/React.createElement("desc", null, descBits), /*#__PURE__*/React.createElement(Style.Node, {
        node: n,
        active: activeNodes.includes(n.id)
      }));
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        display: 'flex',
        gap: 6,
        zIndex: 10,
        opacity: showControls ? 1 : 0,
        pointerEvents: showControls ? 'auto' : 'none',
        transition: 'opacity 0.2s'
      }
    }, playerControls && /*#__PURE__*/React.createElement(PlayerGroup, {
      pc: playerControls
    }), /*#__PURE__*/React.createElement(ZoomGroup, {
      zoom: zoom,
      setZoom: setZoom,
      setPan: setPan
    }), /*#__PURE__*/React.createElement(SoloButton, {
      title: "Toggle fullscreen",
      onClick: () => {
        const target = fullscreenTarget?.current || containerRef.current;
        if (document.fullscreenElement) document.exitFullscreen();else target?.requestFullscreen?.();
      }
    }, isFullscreen ? /*#__PURE__*/React.createElement(FsExit, null) : /*#__PURE__*/React.createElement(FsEnter, null)), /*#__PURE__*/React.createElement(SoloButton, {
      title: "Download SVG",
      onClick: () => downloadSVG(svgRef.current, `diagram-${style}.svg`)
    }, /*#__PURE__*/React.createElement(Download, null))), playerControls && /*#__PURE__*/React.createElement(PlayerCaption, {
      pc: playerControls,
      showControls: showControls
    }));
  }

  // ── Sub-components ─────────────────────────────────────────

  const groupStyle = {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    display: 'flex',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,.08)'
  };
  const btnBase = {
    background: 'transparent',
    border: 'none',
    padding: '7px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    font: 'inherit'
  };
  const dividerStyle = {
    width: 1,
    background: '#e2e8f0'
  };
  function SoloButton({
    title,
    onClick,
    children
  }) {
    return /*#__PURE__*/React.createElement("button", {
      onClick: onClick,
      title: title,
      style: {
        ...btnBase,
        padding: 8,
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,.08)'
      }
    }, children);
  }
  function ZoomGroup({
    zoom,
    setZoom,
    setPan
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: groupStyle
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setZoom(z => Math.max(0.2, z / 1.25)),
      style: btnBase,
      title: "Zoom out"
    }, /*#__PURE__*/React.createElement(ZoomOut, null)), /*#__PURE__*/React.createElement("div", {
      style: dividerStyle
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        setZoom(1);
        setPan({
          x: 0,
          y: 0
        });
      },
      style: {
        ...btnBase,
        fontSize: 10,
        fontFamily: 'monospace',
        fontWeight: 700,
        width: 44
      },
      title: "Reset"
    }, Math.round(zoom * 100), "%"), /*#__PURE__*/React.createElement("div", {
      style: dividerStyle
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => setZoom(z => Math.min(4, z * 1.25)),
      style: btnBase,
      title: "Zoom in"
    }, /*#__PURE__*/React.createElement(ZoomIn, null)));
  }
  function PlayerGroup({
    pc
  }) {
    const {
      stepIndex,
      totalSteps,
      playing,
      onPrev,
      onNext,
      onPlayPause,
      onGoto
    } = pc;
    return /*#__PURE__*/React.createElement("div", {
      style: groupStyle
    }, /*#__PURE__*/React.createElement("button", {
      onClick: onPrev,
      style: btnBase,
      title: "Previous step"
    }, /*#__PURE__*/React.createElement(Prev, null)), /*#__PURE__*/React.createElement("div", {
      style: dividerStyle
    }), /*#__PURE__*/React.createElement("button", {
      onClick: onPlayPause,
      style: btnBase,
      title: playing ? 'Pause' : 'Play'
    }, playing ? /*#__PURE__*/React.createElement(Pause, null) : /*#__PURE__*/React.createElement(Play, null)), /*#__PURE__*/React.createElement("div", {
      style: dividerStyle
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => onGoto(0),
      style: {
        ...btnBase,
        fontSize: 10,
        fontFamily: 'monospace',
        fontWeight: 700,
        width: 44
      },
      title: "Reset to step 1"
    }, `${stepIndex + 1}/${totalSteps}`), /*#__PURE__*/React.createElement("div", {
      style: dividerStyle
    }), /*#__PURE__*/React.createElement("button", {
      onClick: onNext,
      style: btnBase,
      title: "Next step"
    }, /*#__PURE__*/React.createElement(Next, null)));
  }
  function PlayerCaption({
    pc,
    showControls
  }) {
    const {
      mode,
      stepIndex,
      totalSteps,
      stepTitle,
      playing,
      speed,
      interval,
      onGoto,
      onSpeedChange
    } = pc;
    const advanced = mode === 'advanced';

    // Progress bar: track elapsed time within the current step while playing.
    const [progress, setProgress] = React.useState(0);
    const startedAtRef = React.useRef(0);
    const rafRef = React.useRef(null);
    React.useEffect(() => {
      if (!advanced) return undefined;
      startedAtRef.current = performance.now();
      setProgress(0);
      if (!playing) return undefined;
      const effInterval = Math.max(80, interval / (speed || 1));
      const tick = () => {
        const t = Math.min(1, (performance.now() - startedAtRef.current) / effInterval);
        setProgress(t);
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, [advanced, playing, speed, interval, stepIndex]);
    const captionBase = {
      position: 'absolute',
      left: 12,
      bottom: 12,
      zIndex: 9,
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      boxShadow: '0 2px 8px rgba(0,0,0,.08)',
      fontSize: 12,
      color: '#1e293b',
      opacity: showControls ? 1 : 0,
      transition: 'opacity .18s ease',
      maxWidth: 'calc(100% - 230px)'
    };
    if (!advanced) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          ...captionBase,
          padding: '7px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          pointerEvents: 'none'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontFamily: 'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
          fontSize: 10,
          fontWeight: 700,
          color: '#64748b',
          letterSpacing: '.04em'
        }
      }, `${stepIndex + 1}/${totalSteps}`), /*#__PURE__*/React.createElement("span", {
        style: {
          fontWeight: 600
        }
      }, stepTitle));
    }

    // Advanced
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...captionBase,
        padding: '10px 12px',
        minWidth: 220,
        display: 'flex',
        flexDirection: 'column',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
        fontSize: 10,
        fontWeight: 700,
        color: '#64748b',
        letterSpacing: '.04em'
      }
    }, `${stepIndex + 1}/${totalSteps}`), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600
      }
    }, stepTitle)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6
      }
    }, Array.from({
      length: totalSteps
    }).map((_, i) => /*#__PURE__*/React.createElement("button", {
      key: i,
      onClick: () => onGoto(i),
      title: `Go to step ${i + 1}`,
      "aria-label": `Go to step ${i + 1}`,
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: i === stepIndex ? '#0f172a' : '#cbd5e1',
        border: 0,
        cursor: 'pointer',
        padding: 0,
        transition: 'background .15s, transform .15s'
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'inline-flex',
        border: '1px solid #e2e8f0',
        borderRadius: 6,
        overflow: 'hidden',
        fontFamily: 'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
        fontSize: 10,
        fontWeight: 700
      }
    }, [0.5, 1, 2, 4].map(v => /*#__PURE__*/React.createElement("button", {
      key: v,
      onClick: () => onSpeedChange(v),
      title: `Playback speed ${v}×`,
      style: {
        background: v === speed ? '#0f172a' : 'transparent',
        color: v === speed ? '#fff' : '#64748b',
        border: 0,
        padding: '4px 8px',
        cursor: 'pointer',
        font: 'inherit'
      }
    }, v < 1 ? v.toString() : v, "\xD7")))), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 3,
        background: '#e2e8f0',
        borderRadius: 2,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("i", {
      style: {
        display: 'block',
        height: '100%',
        width: (progress * 100).toFixed(2) + '%',
        background: '#0f172a',
        borderRadius: 2
      }
    })));
  }

  // -----------------------------------------------------------
  // Diagram-type registry.
  //
  // Adding a new diagram type (sequence, state, ER, mindmap, ...) means
  // registering a small plugin object. The library's public entry
  // points — parseDSL, renderSVG, the React <Diagram> component, the
  // <rl-flow> custom element — all dispatch on `graph.type`.
  //
  // Plugin shape:
  //
  //   {
  //     name: 'sequence',           // unique, used in the DSL `type:` directive
  //     parse(text)    -> graph,    // text → IR. Must return { type, ...payload }
  //     renderSVG(graph, opts) -> string,    // IR → SVG string
  //     Render?({ graph, style, activeNodes, activeEdges, ... }) -> ReactNode
  //                                  // optional React component renderer
  //   }
  //
  // The IR shape is up to the plugin. The only required field is `type`
  // (a string matching the registered name) so dispatch works.
  //
  // `flow` is the *default* (and only) built-in type; the existing
  // parser and renderer handle it directly. New types call
  // `registerType(...)` from their own module.
  // -----------------------------------------------------------

  const DIAGRAM_TYPES = new Map();
  function getType(name) {
    if (!name) return null;
    return DIAGRAM_TYPES.get(name) || null;
  }

  // Sniff the first lines of a DSL string for `type: <name>`. Returns the
  // type name or null. Cheap pre-parse so dispatch can find the right
  // plugin without parsing the whole document twice.
  function sniffType(text) {
    if (typeof text !== 'string') return null;
    // Scan up to the first ~15 lines for a top-level `type: X` directive.
    // Inline-section keys can also match, so guard against sections.
    let scanned = 0;
    for (const raw of text.split('\n')) {
      if (scanned++ > 15) break;
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      // Stop scanning once we hit a section header.
      if (/^(nodes|edges|steps|story|config|participants?|actors|states|entities):/i.test(line)) {
        return null;
      }
      const m = line.match(/^type:\s*([\w-]+)/i);
      if (m) return m[1].toLowerCase();
    }
    return null;
  }

  // -----------------------------------------------------------
  // DSL Parser — converts YAML-like text into a Graph IR.
  // Zero dependencies. Works in any environment.
  //
  // Dispatch: if the DSL begins with a `type: <name>` directive AND a
  // diagram-type plugin is registered under that name, delegate parsing
  // to the plugin. Otherwise fall back to the built-in `flow` parser.
  // -----------------------------------------------------------

  function parseDSL(text) {
    // Type dispatch — sequence / state / ER / mindmap / etc. plugins
    // intercept here before the flow parser sees the text.
    const declaredType = sniffType(text);
    if (declaredType) {
      const plugin = getType(declaredType);
      if (plugin && typeof plugin.parse === 'function') {
        const ir = plugin.parse(text);
        // Guarantee the IR carries the type tag so renderSVG can dispatch.
        if (ir && typeof ir === 'object' && !ir.type) ir.type = declaredType;
        return ir;
      }
      // Declared a type with no plugin → fall through to flow parser so
      // unknown directives become inert meta; render will still work.
    }
    return parseFlowDSL(text);
  }
  function parseFlowDSL(text) {
    const lines = text.split('\n');
    const nodes = [];
    const edges = [];
    const steps = [];
    const config = {
      gapX: 180,
      gapY: 120,
      nodesPerRow: 3
    };
    const meta = {}; // top-level scalars like `style: city`, `title: "..."`
    let mode = null;
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const lower = trimmed.toLowerCase();
      if (lower === 'nodes:') {
        mode = 'nodes';
        return;
      }
      if (lower === 'edges:') {
        mode = 'edges';
        return;
      }
      if (lower === 'steps:') {
        mode = 'steps';
        return;
      }
      if (lower === 'story:') {
        mode = 'steps';
        return;
      }
      if (lower === 'config:') {
        mode = 'config';
        return;
      }

      // Top-level scalar: `key: value` outside any section. Captures `style:`,
      // `title:`, etc. so DSLs can carry per-graph metadata.
      if (mode === null) {
        const m = trimmed.match(/^(\w+):\s*(.+)$/);
        if (m) {
          let [, k, v] = m;
          v = v.trim();
          if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
          meta[k] = v;
          return;
        }
      }
      if (mode === 'config') {
        const m = trimmed.match(/^(\w+):\s*(\d+)/);
        if (m) {
          const val = parseInt(m[2], 10);
          if (!isNaN(val)) config[m[1]] = val;
        }
        return;
      }
      if (mode === 'nodes' && trimmed.startsWith('-')) {
        const parts = trimmed.slice(1).trim();
        const node = {};
        // Unquoted values must not include commas (which separate inline pairs)
        // or whitespace. Quoted values ("...") accept anything but quotes.
        const pairs = parts.match(/(\w+):\s*("[^"]*"|[^,\s][^,]*?)(?=\s*(?:,|$))/g);
        if (pairs) {
          pairs.forEach(p => {
            const m = p.match(/^(\w+):\s*(.*)$/);
            if (m) {
              let [, k, v] = m;
              v = v.trim();
              v = v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v;
              node[k] = ['x', 'y', 'w', 'h'].includes(k) ? Number(v) : v;
            }
          });
        }
        if (node.id) {
          node.w = node.w || 140;
          node.h = node.h || 70;
          node.kind = node.kind || node.type || 'service';
          nodes.push(node);
        }
        return;
      }
      if (mode === 'edges' && trimmed.startsWith('-')) {
        const parts = trimmed.slice(1).trim();
        const m = parts.match(/(\S+)\s*(->|\.\.>?|-->)\s*([^,\s]+)/);
        if (m) {
          const [, from, op, to] = m;
          const edge = {
            id: `e-${from}-${to}-${edges.length}`,
            from,
            to,
            kind: op === '..>' || op === '..' ? 'dashed' : 'solid'
          };
          const labelM = parts.match(/label:\s*"([^"]*)"/);
          if (labelM) edge.label = labelM[1];
          const kindM = parts.match(/kind:\s*([^,\s]+)/);
          if (kindM) edge.kind = kindM[1];
          // `curve: ortho | bezier` — overrides default ortho routing.
          const curveM = parts.match(/curve:\s*([^,\s]+)/);
          if (curveM) edge.curve = curveM[1];
          // `weight: N` — drives stroke thickness (used by sankey-style flows).
          const weightM = parts.match(/weight:\s*([0-9.]+)/);
          if (weightM) edge.weight = Number(weightM[1]);
          edges.push(edge);
        }
        return;
      }
      if (mode === 'steps' && trimmed.startsWith('-')) {
        const parts = trimmed.slice(1).trim();
        const step = {
          id: `s${steps.length}`,
          active: {
            nodes: [],
            edges: []
          }
        };
        const titleM = parts.match(/title:\s*"([^"]*)"/);
        if (titleM) step.title = titleM[1];
        const narM = parts.match(/narration:\s*"([^"]*)"/);
        if (narM) step.narration = narM[1];
        const nodesM = parts.match(/nodes:\s*\[([^\]]*)\]/);
        if (nodesM) step.active.nodes = nodesM[1].split(',').map(s => s.trim().replace(/"/g, ''));
        const edgesM = parts.match(/edges:\s*\[([^\]]*)\]/);
        if (edgesM) step.active.edges = edgesM[1].split(',').map(s => s.trim().replace(/"/g, ''));
        steps.push(step);
        return;
      }
    });

    // Coerce any provided positions/sizes to numbers; leave undefined ones
    // alone so resolveGraph's smart auto-layout can position them.
    nodes.forEach(n => {
      if (n.x !== undefined) n.x = Number(n.x);
      if (n.y !== undefined) n.y = Number(n.y);
      if (n.w !== undefined) n.w = Number(n.w);
      if (n.h !== undefined) n.h = Number(n.h);
    });
    return {
      // Canvas is computed by resolveGraph from final node positions when
      // unspecified. Users can override with `canvasW: ...` config keys if
      // they need a fixed viewport.
      type: 'flow',
      canvas: {
        grid: 20
      },
      ...(meta.style ? {
        style: meta.style
      } : {}),
      ...(meta.title ? {
        title: meta.title
      } : {}),
      nodes,
      edges,
      ...(steps.length > 0 ? {
        steps
      } : {})
    };
  }

  // -----------------------------------------------------------
  // Pure SVG string renderer — zero React, zero dependencies.
  // Each function returns an SVG string. Works in any browser
  // including pages that already have React (Confluence, etc.).
  // -----------------------------------------------------------


  // ── SVG attribute helpers ──────────────────────────────────

  function attrs(obj) {
    return Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => {
      const attr = k.replace(/([A-Z])/g, m => '-' + m.toLowerCase()).replace(/^stroke-width$/, 'stroke-width').replace(/^stroke-dasharray$/, 'stroke-dasharray').replace(/^stroke-linecap$/, 'stroke-linecap').replace(/^stroke-linejoin$/, 'stroke-linejoin').replace(/^text-anchor$/, 'text-anchor').replace(/^dominant-baseline$/, 'dominant-baseline').replace(/^font-family$/, 'font-family').replace(/^font-weight$/, 'font-weight').replace(/^font-size$/, 'font-size').replace(/^letter-spacing$/, 'letter-spacing').replace(/^stop-color$/, 'stop-color').replace(/^stop-opacity$/, 'stop-opacity').replace(/^vector-effect$/, 'vector-effect').replace(/^pointer-events$/, 'pointer-events').replace(/^marker-end$/, 'marker-end').replace(/^marker-start$/, 'marker-start').replace(/^pattern-units$/, 'patternUnits').replace(/^pattern-transform$/, 'patternTransform').replace(/^gradient-units$/, 'gradientUnits').replace(/^gradient-transform$/, 'gradientTransform').replace(/^key-points$/, 'keyPoints').replace(/^key-times$/, 'keyTimes').replace(/^repeat-count$/, 'repeatCount').replace(/^attribute-name$/, 'attributeName').replace(/^base-frequency$/, 'baseFrequency').replace(/^num-octaves$/, 'numOctaves');
      return `${attr}="${String(v).replace(/"/g, '&quot;')}"`;
    }).join(' ');
  }
  const e = (tag, props, ...children) => {
    const a = props ? ' ' + attrs(props) : '';
    const inner = children.flat(Infinity).filter(Boolean).join('');
    if (!inner && ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'image'].includes(tag)) {
      return `<${tag}${a}/>`;
    }
    return `<${tag}${a}>${inner}</${tag}>`;
  };
  const g = (props, ...children) => e('g', props, ...children);
  const text = (props, content) => `<text ${attrs(props)}>${esc(content)}</text>`;
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ── Shared shape shell ─────────────────────────────────────

  function shapeShell(node, {
    fill,
    stroke,
    strokeWidth,
    strokeDasharray
  }) {
    const shape = shapeOf(node);
    const s = shapePath(shape, node.w, node.h, node);
    const base = {
      fill,
      stroke,
      strokeWidth,
      strokeDasharray
    };
    if (shape === 'rect') return e('rect', {
      width: node.w,
      height: node.h,
      rx: s.rx ?? 10,
      ...base
    });
    if (shape === 'square') {
      const sz = Math.min(node.w, node.h),
        ox = (node.w - sz) / 2,
        oy = (node.h - sz) / 2;
      return e('rect', {
        x: ox,
        y: oy,
        width: sz,
        height: sz,
        rx: 4,
        ...base
      });
    }
    if (shape === 'pill') return e('rect', {
      width: node.w,
      height: node.h,
      rx: node.h / 2,
      ...base
    });
    if (shape === 'circle' && s.circle) return e('circle', {
      cx: s.circle.cx,
      cy: s.circle.cy,
      r: s.circle.r,
      ...base
    });
    if (shape === 'oval' && s.ellipse) return e('ellipse', {
      cx: s.ellipse.cx,
      cy: s.ellipse.cy,
      rx: s.ellipse.rx,
      ry: s.ellipse.ry,
      ...base
    });
    if (shape === 'cylinder') return g(null, e('path', {
      d: s.body,
      fill,
      stroke,
      strokeWidth
    }), e('path', {
      d: s.top,
      fill,
      stroke,
      strokeWidth
    }));
    return e('path', {
      d: s.d,
      ...base
    });
  }

  // ── Node image / icon (shared across styles) ───────────────
  //
  // Renders the node's `image:` (URL or data URL) or `icon:` (bundled
  // sprite name). Honors:
  //   - `imagePosition`: 'top' (default) | 'center' | 'bottom' | 'fill'
  //   - `imageFit`:      'contain' (default) | 'cover' | 'fill'
  //
  // `kind: image` with `src:` is back-compat — treated as `image: <src>`.
  // Returns '' when the node has no image/icon.

  function clipPathFor(node) {
    const shape = shapeOf(node);
    const s = shapePath(shape, node.w, node.h, node);
    return s.d;
  }
  function nodeImageOrIcon(node) {
    if (!node) return '';
    const w = node.w,
      h = node.h;
    const imageUrl = node.image || (node.kind === 'image' && node.src ? node.src : null);
    const iconName = node.icon;
    if (imageUrl) {
      const position = node.imagePosition || 'top';
      const fit = node.imageFit || 'contain';
      if (position === 'fill') {
        const preserve = fit === 'fill' ? 'none' : fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
        const clipId = `fd-clip-${node.id}`;
        return e('clipPath', {
          id: clipId
        }, e('path', {
          d: clipPathFor(node)
        })) + e('image', {
          href: imageUrl,
          x: 0,
          y: 0,
          width: w,
          height: h,
          preserveAspectRatio: preserve,
          clipPath: `url(#${clipId})`
        });
      }

      // Small image positioned inside the node.
      const size = Math.min(40, Math.min(w, h) - 16);
      const x = w / 2 - size / 2;
      const y = position === 'bottom' ? h - size - 8 : position === 'center' ? h / 2 - size / 2 : 8;
      const preserve = fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
      return e('image', {
        href: imageUrl,
        x,
        y,
        width: size,
        height: size,
        preserveAspectRatio: preserve
      });
    }
    if (iconName) {
      const fragment = getIcon(iconName);
      if (!fragment) return '';
      const size = Math.min(28, Math.min(w, h) - 20);
      if (size <= 0) return '';
      const x = w / 2 - size / 2;
      const y = node.imagePosition === 'center' ? h / 2 - size / 2 : node.imagePosition === 'bottom' ? h - size - 8 : 6;
      // Sprite paths use a 24×24 viewBox + currentColor — scale to `size`.
      const scale = size / 24;
      return `<g transform="translate(${x} ${y}) scale(${scale})" style="color:#1e293b">${fragment}</g>`;
    }
    return '';
  }

  // ── Node accessibility (title + desc) ──────────────────────
  //
  // Inlined inside each node group so screen readers announce the node.
  // `<title>` becomes the accessible name. `<desc>` adds context (kind + sub).

  function nodeA11y(node) {
    if (!node) return '';
    const titleText = esc(node.label || node.id || '');
    const kindLabel = node.kind ? String(node.kind) : '';
    const descBits = [kindLabel, node.sub ? String(node.sub) : ''].filter(Boolean);
    const descText = esc(descBits.join(' — '));
    return (titleText ? `<title>${titleText}</title>` : '') + (descText ? `<desc>${descText}</desc>` : '');
  }

  // ── Node / edge wrappers (data-id + ARIA) ──────────────────
  //
  // Each node/edge is wrapped in an outer <g> that carries:
  //   - data-node-id / data-edge-id for click delegation in viewport.js
  //   - role="img" + an inline <title>/<desc> for accessibility
  //
  // The per-style renderer's output goes inside this wrapper unchanged.

  function wrapNode(node, inner) {
    return `<g data-node-id="${esc(node.id)}" role="img">${nodeA11y(node)}${inner}</g>`;
  }
  function wrapEdge(edge, inner) {
    const fromTo = `${edge.from || ''} → ${edge.to || ''}`;
    const label = edge.label ? `${edge.label} (${fromTo})` : fromTo;
    return `<g data-edge-id="${esc(edge.id)}" role="img"><title>${esc(label)}</title>${inner}</g>`;
  }

  // ── Edge stroke-width helper (sankey-style weighting) ──────
  //
  // When `edge.weight` is a positive number, scale the base stroke width
  // to communicate volume — pass the result of edgeStrokeWidth(edge, base)
  // anywhere a style would otherwise use a literal stroke-width.

  function edgeStrokeWidth(edge, base) {
    if (edge && typeof edge.weight === 'number' && edge.weight > 0) {
      // weight=1 → 1×, weight=10 → ~3×. Capped to avoid hairline-wide bands.
      const scale = Math.max(0.5, Math.min(6, Math.sqrt(edge.weight)));
      return Math.max(0.5, base * scale);
    }
    return base;
  }

  // ── Node label ─────────────────────────────────────────────

  function nodeLabel(node, {
    fill,
    subFill,
    fontFamily = 'Inter Tight',
    fontWeight = 600,
    fontSize = 13,
    hand = false,
    centerOffsetY = 0
  }) {
    const shape = shapeOf(node);
    const centered = ['diamond', 'circle', 'oval', 'pill'].includes(shape);
    if (centered) {
      return g(null, text({
        x: node.w / 2,
        y: node.h / 2 + (node.sub ? -3 : 4) + centerOffsetY,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
        fontFamily,
        fontWeight,
        fontSize,
        fill
      }, node.label), node.sub ? text({
        x: node.w / 2,
        y: node.h / 2 + 12 + centerOffsetY,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
        fontFamily: 'JetBrains Mono',
        fontSize: 9.5,
        fill: subFill
      }, node.sub) : '');
    }
    return g(null, text({
      x: node.w / 2,
      y: node.h / 2 + 4,
      textAnchor: 'middle',
      fontFamily,
      fontWeight,
      fontSize: hand ? 20 : fontSize,
      fill
    }, node.label), node.sub ? text({
      x: node.w / 2,
      y: node.h - 12,
      textAnchor: 'middle',
      fontFamily: hand ? 'Caveat' : 'JetBrains Mono',
      fontSize: hand ? 13 : 9.5,
      fill: subFill
    }, node.sub) : '');
  }

  // ── Edge label ─────────────────────────────────────────────

  function edgeLabel(txt, x, y, {
    bg = '#faf7ef',
    fg = '#6b6459',
    mono = false
  } = {}) {
    if (!txt) return '';
    const ff = mono ? 'JetBrains Mono' : 'Inter Tight';
    return g({
      transform: `translate(${x} ${y - 12})`
    }, text({
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      fontFamily: ff,
      fontSize: 11,
      fill: bg,
      stroke: bg,
      strokeWidth: 3.5,
      strokeLinejoin: 'round'
    }, txt), text({
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      fontFamily: ff,
      fontSize: 11,
      fill: fg,
      fontWeight: 600
    }, txt));
  }

  // ── Node icon ──────────────────────────────────────────────

  function nodeIcon(kind, {
    color = '#8f8779',
    mono = false
  } = {}) {
    const sw = mono ? 1 : 1.2;
    const c = {
      stroke: color,
      strokeWidth: sw,
      fill: 'none',
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    };
    const s = 14;
    switch (kind) {
      case 'actor':
      case 'client':
      case 'person':
        return g(null, e('circle', {
          cx: s / 2,
          cy: 4,
          r: 2.5,
          ...c
        }), e('path', {
          d: `M1 ${s} C 2 9, 5 9, ${s / 2} 9 C ${s - 5} 9, ${s - 2} 9, ${s - 1} ${s}`,
          ...c
        }));
      case 'service':
      case 'process':
        return g(null, e('rect', {
          x: 1,
          y: 2,
          width: s - 2,
          height: s - 4,
          rx: 1.5,
          ...c
        }), e('line', {
          x1: 1,
          y1: 6,
          x2: s - 1,
          y2: 6,
          ...c
        }));
      case 'gateway':
        return g(null, e('path', {
          d: `M${s / 2} 1 L${s - 1} ${s / 2} L${s / 2} ${s - 1} L1 ${s / 2} Z`,
          ...c
        }));
      case 'store':
        return g(null, e('ellipse', {
          cx: s / 2,
          cy: 3,
          rx: 5.5,
          ry: 1.8,
          ...c
        }), e('path', {
          d: `M1 3 L1 ${s - 3} C 1 ${s - 1}, ${s - 1} ${s - 1}, ${s - 1} ${s - 3} L${s - 1} 3`,
          ...c
        }));
      case 'cache':
        return g(null, e('circle', {
          cx: s / 2,
          cy: s / 2,
          r: 5.5,
          ...c
        }), e('circle', {
          cx: s / 2,
          cy: s / 2,
          r: 1.2,
          ...c
        }));
      case 'queue':
        return g(null, e('rect', {
          x: 1,
          y: 3,
          width: s - 2,
          height: 3,
          ...c
        }), e('rect', {
          x: 1,
          y: 7.5,
          width: s - 2,
          height: 3,
          ...c
        }));
      case 'external':
        return g(null, e('path', {
          d: `M3 ${s / 2 + 2} C 1 ${s / 2 + 2}, 1 ${s / 2 - 1}, 3 ${s / 2 - 1} C 3 3, 8 2, 10 ${s / 2 - 2} C 13 ${s / 2 - 2}, 13 ${s / 2 + 2}, ${s - 2} ${s / 2 + 2} Z`,
          ...c
        }));
      case 'boundary':
        return g(null, e('rect', {
          x: 1,
          y: 1,
          width: s - 2,
          height: s - 2,
          rx: 1,
          strokeDasharray: '2 1.5',
          ...c
        }));
      case 'start':
        return g(null, e('path', {
          d: 'M4 2 L11 7 L4 12 Z',
          fill: color,
          stroke: 'none'
        }));
      case 'stop':
        return g(null, e('rect', {
          x: 3,
          y: 3,
          width: 8,
          height: 8,
          fill: color,
          stroke: 'none'
        }));
      case 'decision':
        return g(null, text({
          x: s / 2,
          y: s - 3,
          textAnchor: 'middle',
          fontSize: 11,
          fontFamily: 'Inter Tight',
          fontWeight: 700,
          fill: color
        }, '?'));
      case 'event':
        return g(null, e('path', {
          d: 'M8 1 L3 8 H7 L6 13 L11 6 H7 L8 1 Z',
          fill: color,
          stroke: 'none'
        }));
      case 'step':
      case 'tree':
        return g(null, e('circle', {
          cx: s / 2,
          cy: s / 2,
          r: 3,
          ...c
        }));
      case 'image':
        return g(null, e('rect', {
          x: 1,
          y: 2,
          width: s - 2,
          height: s - 4,
          rx: 1,
          ...c
        }), e('circle', {
          cx: 5,
          cy: 6,
          r: 1.2,
          ...c
        }), e('path', {
          d: `M1 ${s - 4} L5 ${s - 7} L9 ${s - 5} L${s - 1} ${s - 2}`,
          ...c
        }));
      case 'function':
        return g(null, text({
          x: s / 2,
          y: s - 2,
          textAnchor: 'middle',
          fontSize: 13,
          fontFamily: 'Inter Tight',
          fontWeight: 500,
          fill: color
        }, 'λ'));
      case 'worker':
        {
          const teeth = Array.from({
            length: 6
          }, (_, i) => {
            const a = i * Math.PI / 3;
            return e('line', {
              x1: s / 2 + Math.cos(a) * 5,
              y1: s / 2 + Math.sin(a) * 5,
              x2: s / 2 + Math.cos(a) * 6.7,
              y2: s / 2 + Math.sin(a) * 6.7,
              ...c
            });
          }).join('');
          return g(null, e('circle', {
            cx: s / 2,
            cy: s / 2,
            r: 3.5,
            ...c
          }), teeth);
        }
      case 'loadbalancer':
        return g(null, e('circle', {
          cx: s / 2,
          cy: 3,
          r: 1.6,
          ...c
        }), e('line', {
          x1: s / 2,
          y1: 4.5,
          x2: s / 2,
          y2: s - 2,
          ...c
        }), e('line', {
          x1: 2,
          y1: s - 2,
          x2: s - 2,
          y2: s - 2,
          ...c
        }), e('path', {
          d: `M2 ${s - 2} L${s / 2} 7 L${s - 2} ${s - 2}`,
          ...c
        }));
      case 'cdn':
        return g(null, e('circle', {
          cx: s / 2,
          cy: s / 2,
          r: 5.5,
          ...c
        }), e('path', {
          d: `M1.5 ${s / 2} H${s - 1.5}`,
          ...c
        }), e('path', {
          d: `M${s / 2} 1.5 C 4 ${s / 2}, 4 ${s / 2}, ${s / 2} ${s - 1.5}`,
          ...c
        }), e('path', {
          d: `M${s / 2} 1.5 C 10 ${s / 2}, 10 ${s / 2}, ${s / 2} ${s - 1.5}`,
          ...c
        }));
      case 'auth':
        return g(null, e('circle', {
          cx: 4,
          cy: s / 2,
          r: 2.5,
          ...c
        }), e('line', {
          x1: 6,
          y1: s / 2,
          x2: s - 1,
          y2: s / 2,
          ...c
        }), e('line', {
          x1: s - 3,
          y1: s / 2,
          x2: s - 3,
          y2: s / 2 + 2.5,
          ...c
        }), e('line', {
          x1: s - 1,
          y1: s / 2,
          x2: s - 1,
          y2: s / 2 + 2.5,
          ...c
        }));
      default:
        return e('rect', {
          x: 2,
          y: 2,
          width: s - 4,
          height: s - 4,
          ...c
        });
    }
  }

  // ── SLEEK kind bodies ──────────────────────────────────────

  function sleekKindBody(node, {
    fill,
    stroke,
    strokeW,
    ink,
    muted,
    accent,
    active
  }) {
    const {
      w,
      h
    } = node;
    const headerH = 22;
    const subtleBand = active ? '#fef3c7' : '#f3ecd8';
    const card = (rx = 12) => e('rect', {
      width: w,
      height: h,
      rx,
      fill,
      stroke,
      strokeWidth: strokeW
    });
    const centerLabel = (dy = 0) => g(null, text({
      x: w / 2,
      y: h / 2 + 4 + dy,
      textAnchor: 'middle',
      fontFamily: 'Inter Tight',
      fontWeight: 600,
      fontSize: 13,
      fill: ink
    }, node.label), node.sub ? text({
      x: w / 2,
      y: h / 2 + 18 + dy,
      textAnchor: 'middle',
      fontFamily: 'JetBrains Mono',
      fontSize: 9.5,
      fill: muted
    }, node.sub) : '');
    const headerLabel = badge => g(null, text({
      x: 12,
      y: 14.5,
      fontFamily: 'JetBrains Mono',
      fontSize: 9,
      letterSpacing: '.08em',
      fill: active ? '#7a5a00' : muted
    }, badge), text({
      x: w / 2,
      y: headerH + (h - headerH) / 2 + 2.5,
      textAnchor: 'middle',
      fontFamily: 'Inter Tight',
      fontWeight: 600,
      fontSize: 14,
      fill: ink
    }, node.label), node.sub ? text({
      x: w / 2,
      y: headerH + (h - headerH) / 2 + 16,
      textAnchor: 'middle',
      fontFamily: 'JetBrains Mono',
      fontSize: 9.5,
      fill: muted
    }, node.sub) : '');
    switch (node.kind) {
      case 'service':
        {
          const notchBody = g(null, card(12), e('path', {
            d: `M0 ${headerH} H${w}`,
            stroke,
            strokeWidth: strokeW,
            opacity: '.7'
          }), e('rect', {
            x: 1,
            y: 1,
            width: w - 2,
            height: headerH - 1,
            rx: 11,
            fill: subtleBand,
            opacity: '.55',
            style: 'clip-path:inset(0 0 50% 0)'
          }));
          const dots = g(null, e('circle', {
            cx: 10,
            cy: 11,
            r: '2.2',
            fill: active ? accent : '#c9bf9e'
          }), e('circle', {
            cx: 17,
            cy: 11,
            r: '2.2',
            fill: '#e4decd'
          }), e('circle', {
            cx: 24,
            cy: 11,
            r: '2.2',
            fill: '#e4decd'
          }));
          return {
            body: notchBody,
            decor: dots,
            label: headerLabel('SERVICE')
          };
        }
      case 'process':
        {
          const notch = 10;
          const pd = `M12 0 H${w - 12} Q${w} 0 ${w} 12 V${h - notch} L${w - notch} ${h} H${notch} L0 ${h - notch} V12 Q0 0 12 0 Z`;
          const gearAngles = [0, 60, 120, 180, 240, 300];
          return {
            body: g(null, e('path', {
              d: pd,
              fill,
              stroke,
              strokeWidth: strokeW
            }), e('rect', {
              x: 0,
              y: 0,
              width: w,
              height: 4,
              rx: 2,
              fill: active ? accent : '#e4decd'
            })),
            decor: g({
              transform: `translate(${w - 22} 10)`,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: '1.1',
              fill: 'none'
            }, e('circle', {
              cx: 6,
              cy: 6,
              r: 3
            }), e('circle', {
              cx: 6,
              cy: 6,
              r: 1,
              fill: active ? '#7a5a00' : muted
            }), ...gearAngles.map(a => e('line', {
              x1: 6,
              y1: 1.5,
              x2: 6,
              y2: 2.5,
              transform: `rotate(${a} 6 6)`
            }))),
            label: centerLabel()
          };
        }
      case 'store':
        {
          const ry = 10;
          return {
            body: g(null, e('path', {
              d: `M0 ${ry} V${h - ry} a${w / 2} ${ry} 0 0 0 ${w} 0 V${ry}`,
              fill,
              stroke,
              strokeWidth: strokeW
            }), e('path', {
              d: `M0 ${ry} a${w / 2} ${ry} 0 1 0 ${w} 0 a${w / 2} ${ry} 0 1 0 ${-w} 0`,
              fill: active ? '#fef3c7' : '#fbf6e7',
              stroke,
              strokeWidth: strokeW
            })),
            decor: g(null, e('path', {
              d: `M0 ${h * 0.5} a${w / 2} ${ry} 0 0 0 ${w} 0`,
              stroke: active ? '#e7c97a' : '#e4decd',
              strokeWidth: 1,
              fill: 'none',
              opacity: '.4'
            }), e('path', {
              d: `M0 ${h * 0.72} a${w / 2} ${ry} 0 0 0 ${w} 0`,
              stroke: active ? '#e7c97a' : '#ece7db',
              strokeWidth: .8,
              fill: 'none',
              opacity: '.3'
            })),
            label: g(null, text({
              x: w / 2,
              y: h / 2 + 10,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 13,
              fill: ink
            }, node.label), node.sub ? text({
              x: w / 2,
              y: h / 2 + 24,
              textAnchor: 'middle',
              fontFamily: 'JetBrains Mono',
              fontSize: 9.5,
              fill: muted
            }, node.sub) : '')
          };
        }
      case 'cache':
        {
          const rectW = (w - 24) / 4 - 4;
          const chips = [0, 1, 2, 3].map(i => {
            const rx2 = 12 + i * ((w - 24) / 4) + 2;
            const ry2 = h / 2 - 4;
            const anim = active ? `<animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" begin="${i * 0.18}s" repeatCount="indefinite"/>` : '';
            return e('rect', {
              x: rx2,
              y: ry2,
              width: rectW,
              height: 12,
              rx: 1.5,
              fill: active ? '#fde68a' : '#f0e9d6',
              stroke: active ? accent : '#d9d0b8',
              strokeWidth: .8
            }, anim);
          }).join('');
          const contactCount = Math.max(10, Math.floor(w / 8));
          const contactW = (w - 24) / contactCount;
          const contacts = Array.from({
            length: contactCount
          }, (_, i) => e('rect', {
            x: 12 + i * contactW + 0.5,
            y: 0,
            width: contactW - 1,
            height: 3,
            fill: active ? '#d4a315' : '#c9bf9e',
            opacity: '.55'
          })).join('');
          return {
            body: card(10),
            decor: g(null, chips, g({
              transform: `translate(0 ${h - 7})`
            }, contacts)),
            label: text({
              x: w / 2,
              y: 16,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 13,
              fill: ink
            }, node.label)
          };
        }
      case 'queue':
        {
          const labelH = 20,
            gap = 5,
            rowCount = 3;
          const rowH = Math.max(8, (h - labelH - 8 - gap * (rowCount - 1)) / rowCount);
          const rowColors = [active ? accent : '#e8b820', '#f2d664', '#e8deb5'];
          const rows = [0, 1, 2].map(i => {
            const y2 = labelH + i * (rowH + gap);
            const anim = active ? `<animate attributeName="opacity" values="0.4;1;0.4" dur="1.4s" begin="${(rowCount - 1 - i) * 0.2}s" repeatCount="indefinite"/>` : '';
            return e('rect', {
              x: 12,
              y: y2,
              width: w - 24,
              height: rowH,
              rx: Math.min(rowH / 2, 5),
              fill: rowColors[i],
              stroke: i === 0 ? active ? '#7a5a00' : '#b79414' : '#d9c98b',
              strokeWidth: i === 0 ? 1 : .6
            }, anim);
          }).join('');
          return {
            body: card(10),
            decor: g(null, rows, e('path', {
              d: `M${w - 8} ${labelH + rowH / 2} l5 -3.5 v7 z`,
              fill: active ? '#7a5a00' : '#b79414'
            })),
            label: text({
              x: w / 2,
              y: 14,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      case 'actor':
        {
          const headR = 9;
          return {
            body: e('rect', {
              y: headR + 3,
              width: w,
              height: h - headR - 3,
              rx: 12,
              fill,
              stroke,
              strokeWidth: strokeW
            }),
            decor: g(null, e('circle', {
              cx: w / 2,
              cy: headR + 1,
              r: headR,
              fill,
              stroke,
              strokeWidth: strokeW
            }), e('circle', {
              cx: w / 2,
              cy: headR - 1,
              r: '2.2',
              fill: active ? '#7a5a00' : muted
            }), e('path', {
              d: `M${w / 2 - 4} ${headR + 4} Q${w / 2} ${headR + 7} ${w / 2 + 4} ${headR + 4}`,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: '1.2',
              fill: 'none'
            })),
            label: g(null, text({
              x: w / 2,
              y: headR + 3 + (h - headR - 3) / 2 + 8,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 13,
              fill: ink
            }, node.label), node.sub ? text({
              x: w / 2,
              y: headR + 3 + (h - headR - 3) / 2 + 22,
              textAnchor: 'middle',
              fontFamily: 'JetBrains Mono',
              fontSize: 9.5,
              fill: muted
            }, node.sub) : '')
          };
        }
      case 'gateway':
        {
          const gi = Math.min(w * 0.14, 16);
          return {
            body: e('path', {
              d: `M${gi} 0 L${w - gi} 0 L${w} ${h / 2} L${w - gi} ${h} L${gi} ${h} L0 ${h / 2} Z`,
              fill,
              stroke,
              strokeWidth: strokeW
            }),
            decor: g(null, e('path', {
              d: `M${gi} 6 L${w - gi} 6`,
              stroke: active ? accent : '#e4decd',
              strokeWidth: 1
            }), e('path', {
              d: `M${gi} ${h - 6} L${w - gi} ${h - 6}`,
              stroke: active ? accent : '#e4decd',
              strokeWidth: 1
            })),
            label: centerLabel()
          };
        }
      case 'external':
        {
          const cd = `M${w * .18} ${h * .6} C ${w * .02} ${h * .6}, ${w * .02} ${h * .2}, ${w * .22} ${h * .25} C ${w * .28} ${h * .02}, ${w * .58} ${h * .02}, ${w * .62} ${h * .22} C ${w * .85} ${h * .15}, ${w * .98} ${h * .35}, ${w * .9} ${h * .6} C ${w * .98} ${h * .82}, ${w * .75} ${h * .98}, ${w * .6} ${h * .88} C ${w * .4} ${h * 1.02}, ${w * .1} ${h * .95}, ${w * .18} ${h * .6} Z`;
          return {
            body: e('path', {
              d: cd,
              fill,
              stroke,
              strokeWidth: strokeW
            }),
            decor: g({
              transform: 'translate(0 -4)'
            }, e('path', {
              d: `M${w * .42} ${h * .32} A 6 6 0 0 1 ${w * .58} ${h * .32}`,
              stroke: active ? accent : muted,
              strokeWidth: '1.2',
              fill: 'none'
            }), e('path', {
              d: `M${w * .45} ${h * .38} A 4 4 0 0 1 ${w * .55} ${h * .38}`,
              stroke: active ? accent : muted,
              strokeWidth: '1.2',
              fill: 'none'
            }), e('circle', {
              cx: w / 2,
              cy: h * .45,
              r: '1.3',
              fill: active ? accent : muted
            })),
            label: g(null, text({
              x: w / 2,
              y: h * .74,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label), node.sub ? text({
              x: w / 2,
              y: h * .86,
              textAnchor: 'middle',
              fontFamily: 'JetBrains Mono',
              fontSize: 9,
              fill: muted
            }, node.sub) : '')
          };
        }
      case 'boundary':
        {
          const chipW = Math.max(70, (node.label || '').length * 7);
          return {
            noShadow: true,
            body: e('rect', {
              width: w,
              height: h,
              rx: 10,
              fill: 'transparent',
              stroke: active ? accent : '#a89e84',
              strokeDasharray: '5 4',
              strokeWidth: '1.2'
            }),
            decor: g(null, e('rect', {
              x: 10,
              y: -8,
              width: chipW,
              height: 16,
              rx: 8,
              fill: active ? '#fef3c7' : '#fbf7ea',
              stroke: active ? accent : '#d9d0b8',
              strokeWidth: .8
            }), text({
              x: 10 + chipW / 2,
              y: 3,
              textAnchor: 'middle',
              fontFamily: 'JetBrains Mono',
              fontSize: 10,
              fill: active ? '#7a5a00' : '#7a7060',
              letterSpacing: '.06em'
            }, node.label)),
            label: null
          };
        }
      case 'start':
        {
          return {
            body: e('rect', {
              width: w,
              height: h,
              rx: h / 2,
              fill: active ? '#fef3c7' : '#eef8e6',
              stroke: active ? accent : '#bfdfa8',
              strokeWidth: strokeW
            }),
            decor: g(null, e('circle', {
              cx: 18,
              cy: h / 2,
              r: 8,
              fill: active ? accent : '#9fcd7b'
            }), e('path', {
              d: `M${18 - 2} ${h / 2 - 4} L${18 + 4} ${h / 2} L${18 - 2} ${h / 2 + 4} Z`,
              fill: '#fff'
            })),
            label: text({
              x: w / 2 + 6,
              y: h / 2 + 4.5,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 13,
              fill: ink
            }, node.label)
          };
        }
      case 'stop':
        {
          return {
            body: e('rect', {
              width: w,
              height: h,
              rx: h / 2,
              fill: active ? '#fef3c7' : '#fdecec',
              stroke: active ? accent : '#ecc7c7',
              strokeWidth: strokeW
            }),
            decor: g(null, e('circle', {
              cx: 18,
              cy: h / 2,
              r: 8,
              fill: active ? accent : '#d57a7a'
            }), e('rect', {
              x: 18 - 3.5,
              y: h / 2 - 3.5,
              width: 7,
              height: 7,
              rx: 1,
              fill: '#fff'
            })),
            label: text({
              x: w / 2 + 6,
              y: h / 2 + 4.5,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 13,
              fill: ink
            }, node.label)
          };
        }
      case 'decision':
        {
          return {
            body: e('path', {
              d: `M${w / 2} 0 L${w} ${h / 2} L${w / 2} ${h} L0 ${h / 2} Z`,
              fill,
              stroke,
              strokeWidth: strokeW
            }),
            decor: null,
            label: text({
              x: w / 2,
              y: h / 2 + 4,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 13,
              fill: ink
            }, node.label)
          };
        }
      case 'event':
        {
          const r = Math.min(w, h) / 2 - 2;
          return {
            body: e('circle', {
              cx: w / 2,
              cy: h / 2,
              r,
              fill: active ? '#fef3c7' : '#fdf8e4',
              stroke: active ? accent : '#d9c98b',
              strokeWidth: strokeW
            }),
            decor: e('path', {
              d: `M ${w / 2 + 2} ${h / 2 - 8} L ${w / 2 - 4} ${h / 2 + 1} H ${w / 2} L ${w / 2 - 2} ${h / 2 + 8} L ${w / 2 + 4} ${h / 2 - 1} H ${w / 2} Z`,
              fill: active ? '#7a5a00' : '#b79414'
            }),
            label: text({
              x: w / 2,
              y: h + 14,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      case 'step':
      case 'tree':
        {
          return {
            body: e('circle', {
              cx: w / 2,
              cy: h / 2,
              r: Math.min(w, h) / 2 - 2,
              fill,
              stroke,
              strokeWidth: strokeW
            }),
            decor: e('circle', {
              cx: w / 2,
              cy: h / 2,
              r: 3,
              fill: active ? accent : muted
            }),
            label: text({
              x: w / 2,
              y: h + 14,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      case 'image':
        {
          return {
            body: card(10),
            decor: g(null, e('rect', {
              x: 10,
              y: 10,
              width: w - 20,
              height: h - 30,
              rx: 4,
              fill: active ? '#fef3c7' : '#faf3dc',
              stroke: '#e4decd'
            }), e('circle', {
              cx: 18,
              cy: 18,
              r: 3,
              fill: active ? accent : '#d9c98b'
            }), e('path', {
              d: `M12 ${h - 24} L ${w / 2} ${h - 34} L ${w - 12} ${h - 22}`,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: '1.2',
              fill: 'none',
              strokeLinejoin: 'round'
            })),
            label: text({
              x: w / 2,
              y: h - 6,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 11.5,
              fill: ink
            }, node.label)
          };
        }
      case 'function':
        {
          return {
            body: card(12),
            decor: g(null, e('rect', {
              x: 1,
              y: 1,
              width: w - 2,
              height: 4,
              rx: 2,
              fill: active ? accent : '#e4decd'
            }), g({
              transform: `translate(${w - 26} 8)`
            }, e('rect', {
              width: 20,
              height: 14,
              rx: 3,
              fill: active ? '#fef3c7' : '#faf3dc',
              stroke: active ? accent : '#d9c98b',
              strokeWidth: .8
            }), text({
              x: 10,
              y: 11,
              textAnchor: 'middle',
              fontFamily: 'JetBrains Mono',
              fontWeight: 700,
              fontSize: 10,
              fill: active ? '#7a5a00' : muted
            }, '\u03bb'))),
            label: centerLabel()
          };
        }
      case 'worker':
        {
          const workerAngles = [0, 45, 90, 135, 180, 225, 270, 315];
          return {
            body: card(10),
            decor: g(null, g({
              transform: `translate(${w - 22} 10)`,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: '1.1',
              fill: 'none'
            }, e('circle', {
              cx: 6,
              cy: 6,
              r: '3.6'
            }), e('circle', {
              cx: 6,
              cy: 6,
              r: '1.2',
              fill: active ? '#7a5a00' : muted
            }), ...workerAngles.map(a => e('line', {
              x1: 6,
              y1: 1.5,
              x2: 6,
              y2: 2.5,
              transform: `rotate(${a} 6 6)`
            }))), g({
              transform: `translate(12 ${h - 12})`
            }, ...[0, 1, 2].map(i => e('circle', {
              cx: i * 7,
              cy: 0,
              r: 2,
              fill: active ? accent : '#d9c98b',
              opacity: String(1 - i * 0.25)
            })))),
            label: centerLabel(-2)
          };
        }
      case 'loadbalancer':
        {
          return {
            body: card(10),
            decor: g({
              transform: `translate(${w - 30} ${h / 2})`,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: '1.3',
              fill: 'none',
              strokeLinecap: 'round'
            }, e('circle', {
              cx: 0,
              cy: 0,
              r: 3,
              fill: active ? accent : '#fbf6e7'
            }), e('line', {
              x1: 3,
              y1: 0,
              x2: 14,
              y2: -7
            }), e('line', {
              x1: 3,
              y1: 0,
              x2: 16,
              y2: 0
            }), e('line', {
              x1: 3,
              y1: 0,
              x2: 14,
              y2: 7
            }), e('circle', {
              cx: 14,
              cy: -7,
              r: '1.5',
              fill: active ? '#7a5a00' : muted
            }), e('circle', {
              cx: 16,
              cy: 0,
              r: '1.5',
              fill: active ? '#7a5a00' : muted
            }), e('circle', {
              cx: 14,
              cy: 7,
              r: '1.5',
              fill: active ? '#7a5a00' : muted
            })),
            label: centerLabel()
          };
        }
      case 'cdn':
        {
          const cdd = `M${w * .18} ${h * .6} C ${w * .02} ${h * .6}, ${w * .02} ${h * .2}, ${w * .22} ${h * .25} C ${w * .28} ${h * .02}, ${w * .58} ${h * .02}, ${w * .62} ${h * .22} C ${w * .85} ${h * .15}, ${w * .98} ${h * .35}, ${w * .9} ${h * .6} C ${w * .98} ${h * .82}, ${w * .75} ${h * .98}, ${w * .6} ${h * .88} C ${w * .4} ${h * 1.02}, ${w * .1} ${h * .95}, ${w * .18} ${h * .6} Z`;
          return {
            body: e('path', {
              d: cdd,
              fill,
              stroke,
              strokeWidth: strokeW
            }),
            decor: g({
              transform: `translate(${w / 2} ${h * .42})`,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: '1.1',
              fill: 'none'
            }, e('circle', {
              r: 6
            }), e('ellipse', {
              rx: 6,
              ry: 2.5
            }), e('line', {
              x1: -6,
              y1: 0,
              x2: 6,
              y2: 0
            })),
            label: text({
              x: w / 2,
              y: h * .78,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      case 'auth':
        {
          const ar = Math.min(w * .18, 14);
          const ad = `M${ar} 0 H${w - ar} Q${w} 0 ${w} ${ar} V${h * .55} Q${w} ${h * .85} ${w / 2} ${h} Q0 ${h * .85} 0 ${h * .55} V${ar} Q0 0 ${ar} 0 Z`;
          return {
            body: e('path', {
              d: ad,
              fill,
              stroke,
              strokeWidth: strokeW
            }),
            decor: g({
              transform: `translate(${w / 2} ${h * .34})`,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: '1.4',
              fill: 'none'
            }, e('rect', {
              x: -4,
              y: -1,
              width: 8,
              height: 7,
              rx: '1.2',
              fill: active ? '#fef3c7' : '#faf3dc'
            }), e('path', {
              d: 'M-2.5 -1 V-3.5 Q0 -5.5 2.5 -3.5 V-1'
            })),
            label: text({
              x: w / 2,
              y: h * .74,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      case 'monitor':
        {
          return {
            body: card(10),
            decor: g({
              transform: `translate(10 ${h / 2 - 6})`
            }, e('rect', {
              width: w - 20,
              height: 24,
              rx: 3,
              fill: active ? '#fef3c7' : '#faf3dc',
              stroke: active ? accent : '#d9c98b',
              strokeWidth: .7
            }), e('polyline', {
              points: `4,18 ${(w - 20) * .25},10 ${(w - 20) * .45},14 ${(w - 20) * .7},6 ${w - 24},12`,
              fill: 'none',
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: 1.4
            })),
            label: text({
              x: w / 2,
              y: 14,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      case 'bus':
        {
          return {
            body: card(10),
            decor: g(null, e('rect', {
              x: 10,
              y: h / 2 - 4,
              width: w - 20,
              height: 8,
              rx: 3,
              fill: active ? accent : '#e8deb5',
              stroke: active ? '#7a5a00' : '#b79414',
              strokeWidth: .7
            }), ...[0.2, 0.5, 0.8].map(p => g({
              transform: `translate(${10 + (w - 20) * p} ${h / 2})`
            }, e('line', {
              x1: 0,
              y1: -4,
              x2: 0,
              y2: -9,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: 1
            }), e('circle', {
              cx: 0,
              cy: -11,
              r: 2,
              fill: active ? '#7a5a00' : muted
            }), e('line', {
              x1: 0,
              y1: 4,
              x2: 0,
              y2: 9,
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: 1
            }), e('circle', {
              cx: 0,
              cy: 11,
              r: 2,
              fill: active ? '#7a5a00' : muted
            })))),
            label: text({
              x: w / 2,
              y: 14,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      case 'stream':
        {
          const waveRows = [0, 1, 2].map(row => {
            const mx = (w - 20) * 0.25 + 10,
              hx = (w - 20) * 0.5 + 10;
            const anim = active && row === 0 ? `<animate attributeName="d" values="M10 ${20 + row * 10} Q ${mx} ${14 + row * 10}, ${hx} ${20 + row * 10} T ${w - 10} ${20 + row * 10};M10 ${20 + row * 10} Q ${mx} ${26 + row * 10}, ${hx} ${20 + row * 10} T ${w - 10} ${20 + row * 10};M10 ${20 + row * 10} Q ${mx} ${14 + row * 10}, ${hx} ${20 + row * 10} T ${w - 10} ${20 + row * 10}" dur="2s" repeatCount="indefinite"/>` : '';
            return e('path', {
              d: `M10 ${20 + row * 10} Q ${mx} ${14 + row * 10}, ${hx} ${20 + row * 10} T ${w - 10} ${20 + row * 10}`,
              fill: 'none',
              stroke: active ? row === 0 ? accent : '#e0c870' : row === 0 ? '#b79414' : '#d9c98b',
              strokeWidth: row === 0 ? '1.6' : '1',
              strokeLinecap: 'round',
              opacity: String(1 - row * 0.25)
            }, anim);
          }).join('');
          return {
            body: card(10),
            decor: g(null, waveRows),
            label: text({
              x: w / 2,
              y: 14,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      case 'firewall':
        {
          const fwRows = [0, 1, 2].map(row => {
            const y2 = 22 + row * 8,
              offset = row % 2 === 0 ? 0 : (w - 20) / 4;
            return g(null, e('line', {
              x1: 10,
              y1: y2,
              x2: w - 10,
              y2: y2
            }), ...[0, 1, 2, 3].map(c => e('line', {
              x1: 10 + offset + c * (w - 20) / 2,
              y1: y2 - 8,
              x2: 10 + offset + c * (w - 20) / 2,
              y2: y2
            })));
          }).join('');
          return {
            body: card(10),
            decor: g({
              stroke: active ? '#7a5a00' : muted,
              strokeWidth: .7,
              fill: 'none'
            }, fwRows, e('rect', {
              x: 9.5,
              y: 14,
              width: w - 19,
              height: h - 22,
              rx: 2,
              fill: active ? 'rgba(245,197,24,0.15)' : 'transparent',
              strokeWidth: .5
            })),
            label: text({
              x: w / 2,
              y: 14,
              textAnchor: 'middle',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 12,
              fill: ink
            }, node.label)
          };
        }
      case 'mobile':
        {
          const pw = Math.min(w * .45, 44),
            ph = h - 12,
            px = (w - pw) / 2,
            py = 6;
          return {
            body: g(null, e('rect', {
              width: w,
              height: h,
              rx: 12,
              fill: 'transparent'
            }), e('rect', {
              x: px,
              y: py,
              width: pw,
              height: ph,
              rx: 6,
              fill,
              stroke,
              strokeWidth: strokeW
            }), e('rect', {
              x: px + 4,
              y: py + 8,
              width: pw - 8,
              height: ph - 16,
              rx: 2,
              fill: active ? '#fef3c7' : '#faf3dc'
            })),
            decor: g(null, e('circle', {
              cx: w / 2,
              cy: py + 4,
              r: 1,
              fill: muted
            }), e('rect', {
              x: w / 2 - 4,
              y: py + ph - 4,
              width: 8,
              height: 1.5,
              rx: .5,
              fill: muted
            }), active ? g({
              transform: `translate(${w / 2} ${h / 2})`,
              stroke: accent,
              strokeWidth: '1.4',
              fill: 'none'
            }, e('path', {
              d: 'M -5 0 Q 0 -5 5 0'
            }), e('path', {
              d: 'M -3 2 Q 0 -1 3 2'
            })) : ''),
            label: text({
              x: px - 4,
              y: h / 2 + 4,
              textAnchor: 'end',
              fontFamily: 'Inter Tight',
              fontWeight: 600,
              fontSize: 12.5,
              fill: ink
            }, node.label)
          };
        }
      default:
        return null;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STYLE RENDERERS — return SVG strings
  // ═══════════════════════════════════════════════════════════

  // ── SLEEK ──────────────────────────────────────────────────

  function sleekDefs() {
    return `<defs>
    <filter id="sleek-soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
      <feOffset dy="3"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.15"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="sleek-node" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#fbf6e7"/>
    </linearGradient>
    <linearGradient id="sleek-node-a" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fffbea"/><stop offset="1" stop-color="#fef3c7"/>
    </linearGradient>
    <radialGradient id="sleek-glow" cx=".5" cy=".5" r=".55">
      <stop offset="0" stop-color="#f5c518" stop-opacity=".28"/>
      <stop offset="1" stop-color="#f5c518" stop-opacity="0"/>
    </radialGradient>
    <marker id="sleek-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="#8f8779"/>
    </marker>
    <marker id="sleek-arrow-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="#f5c518"/>
    </marker>
    <marker id="sleek-arrow-err" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="#c0392b"/>
    </marker>
    <pattern id="sleek-dots" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r=".8" fill="#d9d3c6"/>
    </pattern>
    <style>@keyframes sleek-pulse { 0%, 100% { opacity: .6 } 50% { opacity: 1 } }</style>
  </defs>`;
  }
  function sleekBackground(w, h) {
    return g(null, e('rect', {
      width: w,
      height: h,
      fill: '#fffcf3'
    }), e('rect', {
      width: w,
      height: h,
      fill: 'url(#sleek-dots)',
      opacity: .6
    }));
  }
  function sleekNode(node, active) {
    const ink = '#26231d',
      muted = '#8f8779',
      accent = '#f5c518';
    const fill = active ? 'url(#sleek-node-a)' : 'url(#sleek-node)';
    const stroke = active ? '#f5c518' : '#e4decd';
    const strokeW = active ? 1.5 : 1;
    const shape = shapeOf(node);
    const hasMedia = !!(node.image || node.icon || node.kind === 'image' && node.src);
    const useKind = !node.shape && node.kind && !hasMedia;
    const kb = useKind ? sleekKindBody(node, {
      fill,
      stroke,
      strokeW,
      ink,
      muted,
      accent,
      active
    }) : null;
    return g({
      transform: `translate(${node.x} ${node.y})`
    }, active && shape !== 'cylinder' ? e('rect', {
      x: -10,
      y: -10,
      width: node.w + 20,
      height: node.h + 20,
      rx: 18,
      fill: 'url(#sleek-glow)',
      style: 'animation:sleek-pulse 2s ease-in-out infinite'
    }) : '', kb ? g({
      filter: kb.noShadow ? undefined : 'url(#sleek-soft)'
    }, kb.body) : g({
      filter: 'url(#sleek-soft)'
    }, shapeShell(node, {
      fill,
      stroke,
      strokeWidth: strokeW
    })), kb ? kb.decor || '' : '', nodeImageOrIcon(node), kb && kb.label !== undefined ? kb.label : nodeLabel(node, {
      fill: ink,
      subFill: muted
    }));
  }
  function sleekEdge(edge, active) {
    const kind = edge.kind || 'solid';
    const isDashed = kind === 'dashed',
      isDotted = kind === 'dotted',
      isBold = kind === 'bold';
    const isAsync = kind === 'async',
      isBidir = kind === 'bidir',
      isError = kind === 'error';
    const isSecure = kind === 'secure',
      isRealtime = kind === 'realtime';
    const errC = '#c0392b',
      secC = '#3a6b3a';
    const stroke = isError ? errC : isSecure ? secC : active ? '#f5c518' : '#b8b0a1';
    const dash = isDashed ? '5 4' : isDotted ? '1 5' : isAsync ? '8 4 1 4' : isRealtime ? '6 3' : undefined;
    const sw = edgeStrokeWidth(edge, isBold ? active ? 3 : 2.4 : active ? 2 : 1.4);
    const mid = edgeMidpoint(edge.points);
    const arrowE = isError ? 'url(#sleek-arrow-err)' : active ? 'url(#sleek-arrow-a)' : 'url(#sleek-arrow)';
    const arrowS = isBidir ? active ? 'url(#sleek-arrow-a)' : 'url(#sleek-arrow)' : undefined;
    // Draw-on animation on the main stroke when the edge transitions to
    // active. Only for plain solid edges — patterned dashes conflict with
    // the dasharray-driven animation.
    const drawOn = active && !isDashed && !isDotted && !isAsync && !isRealtime;
    const drawClass = drawOn ? 'fd-draw-on' : undefined;
    const drawStyle = drawOn ? `--fd-edge-len:${Math.round(edge.length || 600)}` : undefined;
    return g(null, isBold ? e('path', {
      d: edge.d,
      fill: 'none',
      stroke,
      opacity: .18,
      strokeWidth: sw + 6,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }) : '', isRealtime ? e('path', {
      d: edge.d,
      fill: 'none',
      stroke: '#f5c518',
      opacity: .35,
      strokeWidth: sw + 3,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }) : '', e('path', {
      d: edge.d,
      fill: 'none',
      stroke: isRealtime ? '#b8860b' : stroke,
      strokeWidth: sw,
      strokeDasharray: dash,
      strokeLinecap: isDotted ? 'round' : 'butt',
      markerEnd: arrowE,
      markerStart: arrowS,
      strokeLinejoin: 'round',
      class: drawClass,
      style: drawStyle
    }, isRealtime ? `<animate attributeName="stroke-dashoffset" from="0" to="-18" dur=".5s" repeatCount="indefinite"/>` : ''), active && !isRealtime ? `<circle r="3.5" fill="${isError ? errC : '#f5c518'}"><animateMotion dur="1.4s" repeatCount="indefinite" path="${edge.d}" rotate="auto"/></circle>` : '', isSecure ? g({
      transform: `translate(${mid.x} ${mid.y - 14})`
    }, e('rect', {
      x: -7,
      y: -8,
      width: 14,
      height: 13,
      rx: 2.5,
      fill: '#fffcf3',
      stroke: secC,
      strokeWidth: 1
    }), e('rect', {
      x: -3,
      y: -3,
      width: 6,
      height: 6,
      rx: .8,
      fill: secC
    }), e('path', {
      d: 'M-2 -3 V-5 Q0 -7 2 -5 V-3',
      fill: 'none',
      stroke: secC,
      strokeWidth: 1
    })) : '', isError ? g({
      transform: `translate(${mid.x} ${mid.y - 12})`,
      stroke: errC,
      strokeWidth: 1.4,
      fill: '#fffcf3'
    }, e('circle', {
      r: 6
    }), e('line', {
      x1: -3,
      y1: -3,
      x2: 3,
      y2: 3
    }), e('line', {
      x1: 3,
      y1: -3,
      x2: -3,
      y2: 3
    })) : '', edgeLabel(edge.label, mid.x, mid.y, {
      bg: '#fffcf3',
      fg: isError ? errC : isSecure ? secC : active ? '#7a5a00' : '#8f8779',
      mono: true
    }));
  }

  // ── SKETCH ─────────────────────────────────────────────────

  function sketchDefs() {
    return `<defs>
    <filter id="sk-rough">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/>
      <feDisplacementMap in="SourceGraphic" scale="0.9"/>
    </filter>
    <pattern id="sk-paper" width="160" height="160" patternUnits="userSpaceOnUse">
      <rect width="160" height="160" fill="#fbf7ec"/>
      <circle cx="30" cy="40" r=".6" fill="#c6bfae"/>
      <circle cx="110" cy="90" r=".5" fill="#c6bfae"/>
      <circle cx="60" cy="130" r=".7" fill="#c6bfae"/>
    </pattern>
    <marker id="sk-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0 1 L10 5 L0 9 L3 5 Z" fill="#3a362d"/>
    </marker>
    <marker id="sk-arrow-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0 1 L10 5 L0 9 L3 5 Z" fill="#d97757"/>
    </marker>
  </defs>`;
  }
  function sketchBackground(w, h) {
    const lines = Array.from({
      length: Math.ceil(h / 28)
    }, (_, i) => e('line', {
      x1: 0,
      x2: w,
      y1: i * 28 + 14,
      y2: i * 28 + 14,
      stroke: '#ded6c2',
      strokeWidth: .6,
      strokeDasharray: '2 3'
    })).join('');
    return g(null, e('rect', {
      width: w,
      height: h,
      fill: 'url(#sk-paper)'
    }), lines);
  }
  function sketchNode(node, active) {
    const seed = node.id.charCodeAt(0) + node.id.length;
    const jitter = n => seed * (n + 1) % 7 * 0.35 - 1;
    const ink = active ? '#d97757' : '#2b2a26';
    const fill = active ? '#fce7d6' : '#ffffff';
    const shape = shapeOf(node);
    const hasMedia = !!(node.image || node.icon || node.kind === 'image' && node.src);
    const centered = ['diamond', 'circle', 'oval', 'pill'].includes(shape);
    return g({
      transform: `translate(${node.x} ${node.y})`
    }, g({
      transform: `translate(${jitter(0)} ${jitter(1) + 3})`,
      opacity: .55
    }, shapeShell(node, {
      fill: '#f0e9d6',
      stroke: 'none',
      strokeWidth: 0
    })), g({
      filter: 'url(#sk-rough)'
    }, shapeShell(node, {
      fill,
      stroke: ink,
      strokeWidth: 1.8
    })), g({
      filter: 'url(#sk-rough)',
      opacity: .5
    }, shapeShell(node, {
      fill: 'none',
      stroke: ink,
      strokeWidth: 1
    })), nodeImageOrIcon(node), !hasMedia && !centered ? g({
      transform: 'translate(12, 10)'
    }, nodeIcon(node.kind, {
      color: ink
    })) : '', !hasMedia && centered ? g({
      transform: `translate(${node.w / 2 - 7} ${node.h / 2 - 18})`
    }, nodeIcon(node.kind, {
      color: ink
    })) : '', nodeLabel(node, {
      fill: ink,
      subFill: '#5a5148',
      fontFamily: 'Caveat',
      fontWeight: 600,
      fontSize: 18,
      hand: true,
      centerOffsetY: centered ? 8 : 0
    }));
  }
  function sketchEdge(edge, active) {
    const kind = edge.kind || 'solid';
    const isBold = kind === 'bold',
      isAsync = kind === 'async',
      isBidir = kind === 'bidir';
    const isError = kind === 'error',
      isSecure = kind === 'secure',
      isRealtime = kind === 'realtime';
    const isDashed = kind === 'dashed',
      isDotted = kind === 'dotted';
    const errC = '#c14a3a',
      secC = '#3d6b3d';
    const stroke = isError ? errC : isSecure ? secC : active ? '#d97757' : '#3a362d';
    const dash = isDashed ? '6 5' : isDotted ? '1.5 5' : isAsync ? '9 4 1.5 4' : isRealtime ? '7 4' : undefined;
    const sw = edgeStrokeWidth(edge, isBold ? active ? 3 : 2.6 : active ? 2.2 : 1.5);
    const d1 = roughPath(edge.points, 1.6, edge.id.charCodeAt(0) * 7);
    const d2 = roughPath(edge.points, 1.2, edge.id.charCodeAt(0) * 13 + 1);
    const mid = edgeMidpoint(edge.points);
    const drawOn = active && !isDashed && !isDotted && !isAsync && !isRealtime;
    const drawClass = drawOn ? 'fd-draw-on' : undefined;
    const drawStyle = drawOn ? `--fd-edge-len:${Math.round(edge.length || 600)}` : undefined;
    return g(null, isRealtime ? e('path', {
      d: d1,
      fill: 'none',
      stroke: '#d97757',
      opacity: .25,
      strokeWidth: sw + 3,
      strokeLinecap: 'round',
      filter: 'url(#sk-rough)'
    }) : '', e('path', {
      d: d1,
      fill: 'none',
      stroke: isRealtime ? '#b85a3a' : stroke,
      strokeWidth: sw,
      strokeDasharray: dash,
      strokeLinecap: 'round',
      markerEnd: active ? 'url(#sk-arrow-a)' : 'url(#sk-arrow)',
      markerStart: isBidir ? active ? 'url(#sk-arrow-a)' : 'url(#sk-arrow)' : undefined,
      filter: 'url(#sk-rough)',
      class: drawClass,
      style: drawStyle
    }, isRealtime ? `<animate attributeName="stroke-dashoffset" from="0" to="-22" dur=".55s" repeatCount="indefinite"/>` : ''), e('path', {
      d: d2,
      fill: 'none',
      stroke,
      strokeWidth: isBold ? 1.4 : .7,
      strokeDasharray: dash,
      opacity: .4,
      strokeLinecap: 'round'
    }), active && !isRealtime ? `<circle r="4" fill="${isError ? errC : '#d97757'}" stroke="#fbf7ec" stroke-width="1.5"><animateMotion dur="1.6s" repeatCount="indefinite" path="${edge.d}" rotate="auto"/></circle>` : '', isSecure ? g({
      transform: `translate(${mid.x} ${mid.y - 14}) rotate(-2)`,
      fill: '#fbf7ec',
      stroke: secC,
      strokeWidth: 1.4,
      filter: 'url(#sk-rough)'
    }, e('rect', {
      x: -7,
      y: -7,
      width: 14,
      height: 13,
      rx: 2
    }), e('path', {
      d: 'M-2.5 -7 V-10 Q0 -12 2.5 -10 V-7',
      fill: 'none'
    })) : '', isError ? g({
      transform: `translate(${mid.x} ${mid.y - 13}) rotate(-3)`,
      stroke: errC,
      strokeWidth: 1.6,
      fill: '#fbf7ec',
      filter: 'url(#sk-rough)'
    }, e('circle', {
      r: 7
    }), e('line', {
      x1: -3.5,
      y1: -3.5,
      x2: 3.5,
      y2: 3.5
    }), e('line', {
      x1: 3.5,
      y1: -3.5,
      x2: -3.5,
      y2: 3.5
    })) : '', edge.label ? g({
      transform: `translate(${mid.x} ${mid.y - 2}) rotate(-3)`
    }, e('rect', {
      x: -edge.label.length * 4.5 - 4,
      y: -10,
      width: edge.label.length * 9 + 8,
      height: 18,
      rx: 3,
      fill: '#fbf7ec'
    }), text({
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      fontFamily: 'Caveat',
      fontSize: 15,
      fill: isError ? errC : isSecure ? secC : active ? '#d97757' : '#5a5148'
    }, edge.label)) : '');
  }

  // ── ISO ────────────────────────────────────────────────────

  function isoDefs() {
    return `<defs>
    <linearGradient id="iso-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef1f6"/></linearGradient>
    <linearGradient id="iso-top-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe28a"/><stop offset="1" stop-color="#f5c518"/></linearGradient>
    <linearGradient id="iso-right" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#dde2ea"/><stop offset="1" stop-color="#c7cfda"/></linearGradient>
    <linearGradient id="iso-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7ebf1"/><stop offset="1" stop-color="#d2d8e1"/></linearGradient>
    <linearGradient id="iso-pipe" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#60a5fa"/></linearGradient>
    <linearGradient id="iso-pipe-a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#fde68a"/></linearGradient>
    <linearGradient id="iso-pipe-err" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b91c1c"/><stop offset="1" stop-color="#ef4444"/></linearGradient>
    <linearGradient id="iso-pipe-sec" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#15803d"/><stop offset="1" stop-color="#4ade80"/></linearGradient>
    <pattern id="iso-grid" width="24" height="14" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">
      <path d="M0 0 L24 0 M0 0 L0 14" stroke="#dbe0e7" stroke-width=".6"/>
    </pattern>
  </defs>`;
  }
  function isoBackground(w, h) {
    return g(null, e('rect', {
      width: w,
      height: h,
      fill: '#f3f4f6'
    }), e('rect', {
      width: w,
      height: h,
      fill: 'url(#iso-grid)',
      opacity: .9
    }));
  }
  function isoNode(node, active) {
    const depth = 12,
      w = node.w,
      h = node.h,
      shape = shapeOf(node);
    const topFill = active ? 'url(#iso-top-a)' : 'url(#iso-top)';
    const hasMedia = !!(node.image || node.icon || node.kind === 'image' && node.src);
    const centered = ['diamond', 'circle', 'oval', 'pill'].includes(shape);
    return g({
      transform: `translate(${node.x} ${node.y})`
    }, e('ellipse', {
      cx: w / 2 + 4,
      cy: h + depth + 6,
      rx: w * .4,
      ry: 3.5,
      fill: '#000',
      opacity: .07
    }), shape === 'rect' || shape === 'square' ? g(null, e('path', {
      d: `M 0 ${h} L ${w} ${h} L ${w} ${h + depth} L 0 ${h + depth} Z`,
      fill: 'url(#iso-front)',
      stroke: '#c7cfda',
      strokeWidth: .8
    }), e('path', {
      d: `M ${w} 0 L ${w + depth * .6} ${-depth * .5} L ${w + depth * .6} ${h - depth * .5} L ${w} ${h} Z`,
      fill: 'url(#iso-right)',
      stroke: '#c7cfda',
      strokeWidth: .8
    })) : '', shapeShell(node, {
      fill: topFill,
      stroke: active ? '#f59e0b' : '#cfd6e0',
      strokeWidth: 1
    }), nodeImageOrIcon(node), !hasMedia && !centered ? g({
      transform: 'translate(10, 8)'
    }, nodeIcon(node.kind, {
      color: active ? '#7a5a00' : '#475569'
    })) : '', !hasMedia && centered ? g({
      transform: `translate(${w / 2 - 7} ${h / 2 - 18})`
    }, nodeIcon(node.kind, {
      color: active ? '#7a5a00' : '#475569'
    })) : '', nodeLabel(node, {
      fill: active ? '#3a2a00' : '#1e293b',
      subFill: active ? '#7a5a00' : '#64748b',
      fontSize: 12.5,
      centerOffsetY: centered ? 8 : 0
    }));
  }
  function isoEdge(edge, active) {
    const kind = edge.kind || 'solid';
    const isDashed = kind === 'dashed',
      isDotted = kind === 'dotted',
      isBold = kind === 'bold';
    const isAsync = kind === 'async',
      isBidir = kind === 'bidir',
      isError = kind === 'error';
    const isSecure = kind === 'secure',
      isRealtime = kind === 'realtime';
    const mid = edgeMidpoint(edge.points);
    const stroke = isError ? 'url(#iso-pipe-err)' : isSecure ? 'url(#iso-pipe-sec)' : active ? 'url(#iso-pipe-a)' : 'url(#iso-pipe)';
    const dash = isDashed ? '10 6' : isDotted ? '2 7' : isAsync ? '12 5 2 5' : isRealtime ? '8 5' : undefined;
    const sw = edgeStrokeWidth(edge, isBold ? active ? 8 : 6 : active ? 6 : 4);
    const labelFg = isError ? '#7a1a1a' : isSecure ? '#1f4d1f' : active ? '#7a5a00' : '#475569';
    return g(null, e('path', {
      d: edge.d,
      fill: 'none',
      stroke: 'rgba(0,0,0,.08)',
      strokeWidth: sw + 2,
      transform: 'translate(1,2)',
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }), isRealtime ? e('path', {
      d: edge.d,
      fill: 'none',
      stroke: '#f59e0b',
      opacity: .35,
      strokeWidth: sw + 4,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }) : '', e('path', {
      d: edge.d,
      fill: 'none',
      stroke,
      strokeWidth: sw,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeDasharray: dash
    }, isRealtime ? `<animate attributeName="stroke-dashoffset" from="0" to="-26" dur=".6s" repeatCount="indefinite"/>` : ''), active && !isRealtime ? `<circle r="3" fill="#fff"><animateMotion dur="1.4s" repeatCount="indefinite" path="${edge.d}" rotate="auto"/></circle>` : '', isBidir ? `<circle r="3" fill="#fff"><animateMotion dur="1.6s" repeatCount="indefinite" path="${edge.d}" keyPoints="1;0" keyTimes="0;1" rotate="auto"/></circle>` : '', isSecure ? g({
      transform: `translate(${mid.x} ${mid.y - 14})`
    }, e('rect', {
      x: -8,
      y: -9,
      width: 16,
      height: 14,
      rx: 3,
      fill: '#fff',
      stroke: '#1f4d1f',
      strokeWidth: 1.2
    }), e('rect', {
      x: -3,
      y: -3,
      width: 6,
      height: 6,
      rx: .8,
      fill: '#1f4d1f'
    }), e('path', {
      d: 'M-2.5 -3 V-6 Q0 -8 2.5 -6 V-3',
      fill: 'none',
      stroke: '#1f4d1f',
      strokeWidth: 1.2
    })) : '', isError ? g({
      transform: `translate(${mid.x} ${mid.y - 14})`,
      stroke: '#7a1a1a',
      strokeWidth: 1.5,
      fill: '#fff'
    }, e('circle', {
      r: 7
    }), e('line', {
      x1: -3.5,
      y1: -3.5,
      x2: 3.5,
      y2: 3.5
    }), e('line', {
      x1: 3.5,
      y1: -3.5,
      x2: -3.5,
      y2: 3.5
    })) : '', edgeLabel(edge.label, mid.x, mid.y, {
      bg: '#f3f4f6',
      fg: labelFg,
      mono: true
    }));
  }

  // ── BLUEPRINT ──────────────────────────────────────────────

  function blueprintDefs() {
    return `<defs>
    <pattern id="bp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e3a62" stroke-width=".6"/>
    </pattern>
    <pattern id="bp-grid-hi" width="100" height="100" patternUnits="userSpaceOnUse">
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#2a4d80" stroke-width=".8"/>
    </pattern>
    <marker id="bp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 1 L10 5 L0 9" fill="none" stroke="#80d0e0" stroke-width="1.3"/>
    </marker>
    <marker id="bp-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 1 L10 5 L0 9" fill="none" stroke="#ffd166" stroke-width="1.5"/>
    </marker>
  </defs>`;
  }
  function blueprintBackground(w, h) {
    return g(null, e('rect', {
      width: w,
      height: h,
      fill: '#0b2545'
    }), e('rect', {
      width: w,
      height: h,
      fill: 'url(#bp-grid)'
    }), e('rect', {
      width: w,
      height: h,
      fill: 'url(#bp-grid-hi)'
    }));
  }
  function blueprintNode(node, active) {
    const stroke = active ? '#ffd166' : '#80d0e0';
    const shape = shapeOf(node);
    const hasMedia = !!(node.image || node.icon || node.kind === 'image' && node.src);
    const centered = ['diamond', 'circle', 'oval', 'pill'].includes(shape);
    return g({
      transform: `translate(${node.x} ${node.y})`
    }, shapeShell(node, {
      fill: 'none',
      stroke,
      strokeWidth: active ? 1.6 : 1,
      strokeDasharray: node.kind === 'external' ? '4 3' : undefined
    }), nodeImageOrIcon(node), !hasMedia && !centered ? g({
      transform: 'translate(10, 8)'
    }, nodeIcon(node.kind, {
      color: stroke,
      mono: true
    })) : '', !hasMedia && centered ? g({
      transform: `translate(${node.w / 2 - 7} ${node.h / 2 - 18})`
    }, nodeIcon(node.kind, {
      color: stroke,
      mono: true
    })) : '', g(null, text({
      x: node.w / 2,
      y: node.h / 2 + 4 + (centered ? 8 : 0),
      textAnchor: 'middle',
      fontFamily: 'JetBrains Mono',
      fontWeight: 600,
      fontSize: 11,
      fill: active ? '#ffd166' : '#e0fbfc',
      letterSpacing: '.04em'
    }, (node.label || '').toUpperCase()), node.sub ? text({
      x: node.w / 2,
      y: node.h - 8,
      textAnchor: 'middle',
      fontFamily: 'JetBrains Mono',
      fontSize: 8.5,
      fill: '#8bb5d4'
    }, node.sub) : ''));
  }
  function blueprintEdge(edge, active) {
    const kind = edge.kind || 'solid';
    const isDashed = kind === 'dashed',
      isDotted = kind === 'dotted',
      isBold = kind === 'bold';
    const isAsync = kind === 'async',
      isBidir = kind === 'bidir',
      isError = kind === 'error';
    const isSecure = kind === 'secure',
      isRealtime = kind === 'realtime';
    const errC = '#ff6b6b',
      secC = '#7eea9c';
    const stroke = isError ? errC : isSecure ? secC : active ? '#ffd166' : '#80d0e0';
    const dash = isDashed ? '4 3' : isDotted ? '1 4' : isAsync ? '7 3 1 3' : isRealtime ? '5 3' : undefined;
    const sw = edgeStrokeWidth(edge, isBold ? active ? 2.2 : 1.8 : active ? 1.4 : 1);
    const mid = edgeMidpoint(edge.points);
    const arrowE = active ? 'url(#bp-arrow-a)' : 'url(#bp-arrow)';
    return g(null, isRealtime ? e('path', {
      d: edge.d,
      fill: 'none',
      stroke: '#ffd166',
      opacity: .3,
      strokeWidth: sw + 2.5
    }) : '', e('path', {
      d: edge.d,
      fill: 'none',
      stroke: isRealtime ? '#ffd166' : stroke,
      strokeWidth: sw,
      strokeDasharray: dash,
      strokeLinecap: isDotted ? 'round' : 'butt',
      markerEnd: arrowE,
      markerStart: isBidir ? arrowE : undefined
    }, isRealtime ? `<animate attributeName="stroke-dashoffset" from="0" to="-16" dur=".5s" repeatCount="indefinite"/>` : ''), active && !isRealtime ? `<circle r="2.5" fill="${isError ? errC : '#ffd166'}"><animateMotion dur="1.5s" repeatCount="indefinite" path="${edge.d}" rotate="auto"/></circle>` : '', isSecure ? g({
      transform: `translate(${mid.x} ${mid.y - 13})`,
      fill: '#0b2545',
      stroke: secC,
      strokeWidth: 1
    }, e('rect', {
      x: -6,
      y: -7,
      width: 12,
      height: 11,
      rx: 1.5
    }), e('path', {
      d: 'M-2 -7 V-9.5 Q0 -11 2 -9.5 V-7',
      fill: 'none'
    })) : '', isError ? g({
      transform: `translate(${mid.x} ${mid.y - 12})`,
      stroke: errC,
      strokeWidth: 1.2,
      fill: '#0b2545'
    }, e('circle', {
      r: 6
    }), e('line', {
      x1: -3,
      y1: -3,
      x2: 3,
      y2: 3
    }), e('line', {
      x1: 3,
      y1: -3,
      x2: -3,
      y2: 3
    })) : '', edge.label ? g({
      transform: `translate(${mid.x} ${mid.y})`
    }, e('rect', {
      x: -edge.label.length * 3.3 - 4,
      y: -7,
      width: edge.label.length * 6.6 + 8,
      height: 14,
      fill: '#0b2545',
      stroke,
      strokeWidth: .5
    }), text({
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      fontFamily: 'JetBrains Mono',
      fontSize: 9,
      fill: stroke,
      letterSpacing: '.05em'
    }, (edge.label || '').toUpperCase())) : '');
  }

  // ── CITY defs ──────────────────────────────────────────────

  function cityDefs() {
    return `<defs>
    <radialGradient id="grid-fade" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="white" stop-opacity="1"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
    <mask id="grid-fade-mask">
      <rect x="-2000" y="-2000" width="6000" height="6000" fill="url(#grid-fade)"/>
    </mask>
    <pattern id="clay-iso-grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#EEEEEE" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
    </pattern>
    <filter id="clay-ao" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
      <feOffset in="blur1" dy="16" result="offset1"/>
      <feComponentTransfer in="offset1" result="ao"><feFuncA type="linear" slope=".06"/></feComponentTransfer>
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur2"/>
      <feOffset in="blur2" dy="2" result="offset2"/>
      <feComponentTransfer in="offset2" result="contact"><feFuncA type="linear" slope=".15"/></feComponentTransfer>
      <feMerge><feMergeNode in="ao"/><feMergeNode in="contact"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="clay-ao-sm" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
      <feOffset dy="3"/>
      <feComponentTransfer><feFuncA type="linear" slope=".15"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="clay-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#fdfdfd"/></linearGradient>
    <linearGradient id="clay-right" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f2f2f2"/><stop offset="1" stop-color="#e0e0e0"/></linearGradient>
    <linearGradient id="clay-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0e0e0"/><stop offset="1" stop-color="#cccccc"/></linearGradient>
    <linearGradient id="clay-wall-left" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e4e7"/><stop offset="1" stop-color="#d4d4d8"/></linearGradient>
    <linearGradient id="clay-wall-right" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f4f4f5"/></linearGradient>
    <linearGradient id="clay-pipe-cool" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#005bb5"/><stop offset=".5" stop-color="#4da6ff"/><stop offset="1" stop-color="#007AFF"/></linearGradient>
    <linearGradient id="clay-pipe-warm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cc9300"/><stop offset=".5" stop-color="#ffdb4d"/><stop offset="1" stop-color="#FFB800"/></linearGradient>
    <linearGradient id="clay-packet-warm" x1="1" y1="0.5" x2="0" y2="0.5"><stop offset="0%" stop-color="#FFBB0C" stop-opacity="1"/><stop offset="50%" stop-color="#FFDD86" stop-opacity="0.6"/><stop offset="100%" stop-color="#fef3c7" stop-opacity="0"/></linearGradient>
    <linearGradient id="clay-packet-cool" x1="1" y1="0.5" x2="0" y2="0.5"><stop offset="0%" stop-color="#3b82f6" stop-opacity="1"/><stop offset="50%" stop-color="#93c5fd" stop-opacity="0.6"/><stop offset="100%" stop-color="#dbeafe" stop-opacity="0"/></linearGradient>
    <filter id="clay-packet-glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>`;
  }
  function cityBackground(w, h) {
    return e('rect', {
      width: w * 2,
      height: h * 2,
      x: -w / 2,
      y: -h / 2,
      fill: 'url(#clay-iso-grid)',
      mask: 'url(#grid-fade-mask)'
    });
  }
  function cityNode(node, active) {
    const {
      w,
      h,
      kind
    } = node;
    const isBoundary = kind === 'boundary';
    if (kind === 'store') {
      const r = Math.min(w, h) / 2,
        cx = r,
        cy = h / 2,
        Z = 56,
        E = 1.225 * Z;
      const tan1 = {
        x: cx + r / Math.sqrt(2),
        y: cy + r / Math.sqrt(2)
      };
      const tan2 = {
        x: cx - r / Math.sqrt(2),
        y: cy - r / Math.sqrt(2)
      };
      const pSplit = {
        x: cx - r / Math.sqrt(2),
        y: cy + r / Math.sqrt(2)
      };
      return g({
        transform: `translate(${node.x} ${node.y})`
      }, active ? `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="none" stroke="#007AFF" stroke-width="2" opacity="0.7" vector-effect="non-scaling-stroke"><animate attributeName="opacity" values="0.7;0.15;0.7" dur="2s" repeatCount="indefinite"/></circle>` : '', e('ellipse', {
        cx: cx + 8,
        cy: cy + 10,
        rx: r,
        ry: r * 0.577,
        fill: 'rgba(0,0,0,0.35)',
        filter: 'url(#clay-ao)'
      }), e('path', {
        d: `M ${tan2.x} ${tan2.y} L ${tan2.x + E} ${tan2.y - E} A ${r} ${r} 0 0 0 ${pSplit.x + E} ${pSplit.y - E} L ${pSplit.x} ${pSplit.y} A ${r} ${r} 0 0 1 ${tan2.x} ${tan2.y} Z`,
        fill: 'url(#clay-wall-left)'
      }), e('path', {
        d: `M ${pSplit.x} ${pSplit.y} L ${pSplit.x + E} ${pSplit.y - E} A ${r} ${r} 0 0 0 ${tan1.x + E} ${tan1.y - E} L ${tan1.x} ${tan1.y} A ${r} ${r} 0 0 1 ${pSplit.x} ${pSplit.y} Z`,
        fill: 'url(#clay-wall-right)'
      }), [.33, .66].map(f => e('path', {
        d: `M ${tan2.x + E * f} ${tan2.y - E * f} A ${r} ${r} 0 0 0 ${tan1.x + E * f} ${tan1.y - E * f}`,
        fill: 'none',
        stroke: '#a1a1aa',
        strokeWidth: 1,
        strokeDasharray: '2 2',
        opacity: .55
      })).join(''), g({
        transform: `translate(${E} ${-E})`
      }, e('circle', {
        cx,
        cy,
        r,
        fill: 'url(#clay-top)',
        stroke: '#e4e4e7',
        strokeWidth: 1
      }), e('circle', {
        cx,
        cy,
        r: r - 4,
        fill: 'none',
        stroke: 'rgba(0,0,0,0.06)',
        strokeWidth: 1
      }), g({
        transform: `translate(${cx} ${cy})`
      }, g({
        transform: 'translate(-7 -16)'
      }, nodeIcon('store', {
        color: '#475569',
        mono: true
      })), text({
        y: 12,
        textAnchor: 'middle',
        fill: '#334155',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'Inter Tight'
      }, node.label), node.sub ? text({
        y: 26,
        textAnchor: 'middle',
        fill: '#64748b',
        fontSize: 11,
        fontFamily: 'JetBrains Mono'
      }, node.sub) : '')));
    }
    if (kind === 'gateway') {
      const i = Math.min(w * .14, 16),
        Z = 42,
        E = 1.225 * Z;
      const p = [{
        x: i,
        y: 0
      }, {
        x: w - i,
        y: 0
      }, {
        x: w,
        y: h / 2
      }, {
        x: w - i,
        y: h
      }, {
        x: i,
        y: h
      }, {
        x: 0,
        y: h / 2
      }];
      const t = p.map(pt => ({
        x: pt.x + E,
        y: pt.y - E
      }));
      const poly = pts => pts.map(pt => `${pt.x},${pt.y}`).join(' ');
      return g({
        transform: `translate(${node.x} ${node.y})`
      }, `<defs>
        <linearGradient id="gw-wall-1-${node.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cbd5e1"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>
        <linearGradient id="gw-wall-2-${node.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e4e7"/><stop offset="1" stop-color="#d4d4d8"/></linearGradient>
      </defs>`, active ? `<path d="M ${poly(p)} Z" fill="none" stroke="#007AFF" stroke-width="3" opacity="0.6" transform="scale(1.05) translate(-2 1)"><animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite"/></path>` : '', e('path', {
        d: `M ${poly(p)} Z`,
        fill: 'rgba(0,0,0,0.35)',
        filter: 'url(#clay-ao)'
      }), e('path', {
        d: `M ${p[0].x},${p[0].y} L ${p[5].x},${p[5].y} L ${t[5].x},${t[5].y} L ${t[0].x},${t[0].y} Z`,
        fill: `url(#gw-wall-1-${node.id})`
      }), e('path', {
        d: `M ${p[5].x},${p[5].y} L ${p[4].x},${p[4].y} L ${t[4].x},${t[4].y} L ${t[5].x},${t[5].y} Z`,
        fill: `url(#gw-wall-2-${node.id})`
      }), e('path', {
        d: `M ${p[4].x},${p[4].y} L ${p[3].x},${p[3].y} L ${t[3].x},${t[3].y} L ${t[4].x},${t[4].y} Z`,
        fill: 'url(#clay-wall-right)'
      }), e('path', {
        d: `M ${poly(t)} Z`,
        fill: 'url(#clay-top)'
      }), g({
        transform: `translate(${w / 2 + E} ${h / 2 - E})`
      }, g({
        transform: 'translate(-7 -16)'
      }, nodeIcon('gateway', {
        color: '#007AFF',
        mono: true
      })), text({
        y: 12,
        textAnchor: 'middle',
        fill: '#334155',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'Inter Tight'
      }, node.label), node.sub ? text({
        y: 26,
        textAnchor: 'middle',
        fill: '#64748b',
        fontSize: 11,
        fontFamily: 'JetBrains Mono'
      }, node.sub) : ''));
    }
    const Z = isBoundary ? 6 : kind === 'client' || kind === 'actor' ? 32 : 42;
    const E = 1.225 * Z,
      R = isBoundary ? 0 : 16;
    const topFill = isBoundary ? 'transparent' : 'url(#clay-top)';
    const icons = node.icons || [node.kind];
    const layout = node.layout || 'center';
    return g({
      transform: `translate(${node.x} ${node.y})`
    }, e('rect', {
      width: w,
      height: h,
      rx: R,
      fill: isBoundary ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.5)',
      filter: 'url(#clay-ao)'
    }), active && !isBoundary ? `<rect width="${w}" height="${h}" rx="${R}" fill="none" stroke="#007AFF" stroke-width="3" opacity="0.6" transform="scale(1.06) translate(-2 -2)"><animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite"/></rect>` : '', isBoundary ? g(null, e('path', {
      d: `M 0 0 L 0 ${h} L ${E} ${h - E} L ${E} ${-E} Z`,
      fill: 'transparent',
      stroke: '#cbd5e1',
      strokeWidth: 1,
      strokeLinejoin: 'round'
    }), e('path', {
      d: `M 0 ${h} L ${w} ${h} L ${w + E} ${h - E} L ${E} ${h - E} Z`,
      fill: 'transparent',
      stroke: '#cbd5e1',
      strokeWidth: 1,
      strokeLinejoin: 'round'
    })) : g(null, `<defs><linearGradient id="corner-grad-${node.id}" gradientUnits="userSpaceOnUse" x1="0" y1="${h - R}" x2="${R}" y2="${h}"><stop offset="0" stop-color="#d4d4d8"/><stop offset="1" stop-color="#f4f4f5"/></linearGradient></defs>`, e('path', {
      d: `M 0 ${R} L 0 ${h - R} L ${E} ${h - R - E} L ${E} ${R - E} Z`,
      fill: 'url(#clay-wall-left)'
    }), e('path', {
      d: `M 0 ${h - R} A ${R} ${R} 0 0 0 ${R} ${h} L ${R + E} ${h - E} A ${R} ${R} 0 0 1 ${E} ${h - R - E} Z`,
      fill: `url(#corner-grad-${node.id})`
    }), e('path', {
      d: `M ${R} ${h} L ${w - R} ${h} L ${w - R + E} ${h - E} L ${R + E} ${h - E} Z`,
      fill: 'url(#clay-wall-right)'
    }), e('path', {
      d: `M ${w - R} ${h} A ${R} ${R} 0 0 0 ${w} ${h - R} L ${w + E} ${h - R - E} A ${R} ${R} 0 0 1 ${w - R + E} ${h - E} Z`,
      fill: 'url(#clay-wall-right)'
    })), !isBoundary ? g(null, g({
      transform: `translate(${E * .06} ${h / 2 - E * .06})`
    }, e('rect', {
      x: -2,
      y: -10,
      width: E * .08,
      height: 20,
      rx: 3,
      fill: '#1e293b',
      transform: 'skewY(-45)'
    }), e('rect', {
      x: -1,
      y: -8,
      width: E * .04,
      height: 16,
      rx: 2,
      fill: '#007AFF',
      filter: 'url(#clay-ao-sm)',
      transform: 'skewY(-45)'
    })), g({
      transform: `translate(${w / 2 + 2} ${h - 2})`
    }, e('rect', {
      x: -10,
      y: -2,
      width: 20,
      height: E * .08,
      rx: 3,
      fill: '#1e293b',
      transform: 'skewX(-45)'
    }), e('rect', {
      x: -8,
      y: -1,
      width: 16,
      height: E * .04,
      rx: 2,
      fill: '#007AFF',
      filter: 'url(#clay-ao-sm)',
      transform: 'skewX(-45)'
    }))) : '', e('rect', {
      x: E,
      y: -E,
      width: w,
      height: h,
      rx: R,
      fill: topFill,
      stroke: isBoundary ? '#cbd5e1' : 'none',
      strokeWidth: isBoundary ? 1 : 0
    }), !isBoundary ? e('rect', {
      x: E + 3,
      y: -E + 3,
      width: w - 6,
      height: h - 6,
      rx: Math.max(2, R - 3),
      fill: 'transparent',
      stroke: 'rgba(0,0,0,0.06)',
      strokeWidth: 2
    }) : '', g({
      transform: `translate(${E} ${-E})`
    }, isBoundary ? text({
      x: 18,
      y: 28,
      fill: '#94a3b8',
      fontSize: 18,
      fontWeight: 600,
      fontFamily: 'Inter Tight',
      letterSpacing: '0.05em'
    }, (node.label || '').toUpperCase()) : layout === 'center' ? g({
      transform: `translate(${w / 2} ${h / 2})`
    }, g({
      transform: 'translate(-7 -16)'
    }, nodeIcon(icons[0], {
      color: '#475569',
      mono: true
    })), text({
      y: 12,
      textAnchor: 'middle',
      fill: '#334155',
      fontSize: 14,
      fontWeight: 600,
      fontFamily: 'Inter Tight'
    }, node.label), node.sub ? text({
      y: 26,
      textAnchor: 'middle',
      fill: '#64748b',
      fontSize: 11,
      fontFamily: 'JetBrains Mono'
    }, node.sub) : '') : ''));
  }

  // City edges are split into TWO passes for correct z-ordering against 3D blocks:
  //   cityEdge        → pipes, AO shadow, animated packets (rendered UNDER nodes)
  //   cityEdgeOverlay → label chips + secure/error badges (rendered OVER nodes)
  // Without this split, foreground blocks occlude edge labels of edges going
  // behind them, since iso depth-sort puts edges before nodes.
  function cityEdge(edge, active) {
    const kind = edge.kind || 'solid';
    const isBold = kind === 'bold',
      isAsync = kind === 'async',
      isBidir = kind === 'bidir';
    const isError = kind === 'error',
      isRealtime = kind === 'realtime';
    const isDashed = kind === 'dashed',
      isDotted = kind === 'dotted',
      isSecure = kind === 'secure';
    const warm = active || kind === 'warm' || isError || isRealtime;
    const errP = '#dc2626',
      secP = '#16a34a';
    const pipeFill = isError ? errP : isSecure ? secP : warm ? 'url(#clay-pipe-warm)' : 'url(#clay-pipe-cool)';
    const dash = isDashed ? '16 10' : isDotted ? '2 9' : isAsync ? '14 5 2 5' : isRealtime ? '10 6' : undefined;
    const coreSw = edgeStrokeWidth(edge, isBold ? 8 : 6);
    const outerSw = edgeStrokeWidth(edge, isBold ? 11 : 8);
    return g(null, e('path', {
      d: edge.d,
      fill: 'none',
      stroke: 'rgba(0,0,0,.15)',
      strokeWidth: 14,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      filter: 'url(#clay-ao-sm)'
    }), e('path', {
      d: edge.d,
      fill: 'none',
      stroke: isError ? '#7f1d1d' : isSecure ? '#14532d' : '#64748b',
      strokeWidth: outerSw,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }), e('path', {
      d: edge.d,
      fill: 'none',
      stroke: pipeFill,
      strokeWidth: coreSw,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeDasharray: dash
    }, isRealtime ? `<animate attributeName="stroke-dashoffset" from="0" to="-32" dur=".7s" repeatCount="indefinite"/>` : ''), e('path', {
      d: edge.d,
      fill: 'none',
      stroke: 'rgba(255,255,255,0.4)',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      transform: 'translate(-1, -1)'
    }), active && !isRealtime ? [0, 1, 2, 3].map(i => `<g><animateMotion dur="1.8s" repeatCount="indefinite" path="${edge.d}" begin="${i * -0.45}s" rotate="auto"/><path d="M -24 0 L -6 -3.5 L 6 0 L -6 3.5 Z" fill="${isError ? errP : warm ? 'url(#clay-packet-warm)' : 'url(#clay-packet-cool)'}" filter="url(#clay-packet-glow)"/><circle r="1.5" fill="white"/></g>`).join('') : '', isBidir ? `<g><animateMotion dur="2s" repeatCount="indefinite" path="${edge.d}" keyPoints="1;0" keyTimes="0;1" rotate="auto"/><circle r="3.5" fill="#fff" filter="url(#clay-packet-glow)"/></g>` : '');
  }

  // City overlay is rendered in SCREEN SPACE (outside the iso projection).
  // This guarantees labels and badges:
  //   - never get occluded by foreground 3D blocks
  //   - stay axis-aligned and easy to read
  //   - act like floating tooltips tethered to the projected edge midpoint
  // The `project` helper converts canvas (x, y) → screen (x, y).
  function cityEdgeOverlay(edge, active, helpers) {
    const kind = edge.kind || 'solid';
    const isError = kind === 'error',
      isSecure = kind === 'secure',
      isRealtime = kind === 'realtime';
    const warm = active || kind === 'warm' || isError || isRealtime;
    if (!edge.label && !isSecure && !isError) return '';
    const midC = edgeMidpoint(edge.points);
    const project = helpers && helpers.project ? helpers.project : (x, y) => ({
      x,
      y
    });
    const mid = project(midC.x, midC.y);
    // Float label well above the projected midpoint so it clears any
    // building tops in iso projection. No tether — proximity alone tells
    // the user which edge it describes, and a tether often visually
    // attaches to whatever building the projected midpoint lands inside.
    const yLift = 34;
    return g(null, isSecure ? g({
      transform: `translate(${mid.x} ${mid.y - yLift})`,
      fill: '#fff',
      stroke: '#16a34a',
      strokeWidth: 1.5,
      filter: 'url(#clay-ao-sm)'
    }, e('rect', {
      x: -9,
      y: -10,
      width: 18,
      height: 16,
      rx: 3
    }), e('path', {
      d: 'M-3 -10 V-13.5 Q0 -16 3 -13.5 V-10',
      fill: 'none'
    }), e('rect', {
      x: -3.5,
      y: -5,
      width: 7,
      height: 7,
      rx: 1,
      fill: '#16a34a'
    })) : '', isError ? g({
      transform: `translate(${mid.x} ${mid.y - yLift})`,
      fill: '#fff',
      stroke: '#dc2626',
      strokeWidth: 2,
      filter: 'url(#clay-ao-sm)'
    }, e('circle', {
      r: 9
    }), e('line', {
      x1: -4.5,
      y1: -4.5,
      x2: 4.5,
      y2: 4.5
    }), e('line', {
      x1: 4.5,
      y1: -4.5,
      x2: -4.5,
      y2: 4.5
    })) : '', edge.label ? g({
      transform: `translate(${mid.x} ${mid.y - yLift})`
    }, e('rect', {
      x: -edge.label.length * 3.6 - 8,
      y: -10,
      width: edge.label.length * 7.2 + 16,
      height: 20,
      rx: 4,
      fill: '#ffffff',
      stroke: '#e2e8f0',
      strokeWidth: 1.2,
      filter: 'url(#clay-ao-sm)'
    }), text({
      textAnchor: 'middle',
      dominantBaseline: 'middle',
      fontFamily: 'JetBrains Mono',
      fontSize: 10.5,
      fontWeight: 600,
      fill: warm ? '#b45309' : '#1d4ed8'
    }, edge.label)) : '');
  }

  // ═══════════════════════════════════════════════════════════
  // STYLE REGISTRY
  // ═══════════════════════════════════════════════════════════

  const SVG_STYLES = {
    sleek: {
      tokens: {
        bg: '#fffcf3',
        ink: '#26231d',
        muted: '#8f8779',
        accent: '#f5c518',
        line: '#e4decd'
      },
      defs: sleekDefs,
      background: sleekBackground,
      node: sleekNode,
      edge: sleekEdge
    },
    sketch: {
      tokens: {
        bg: '#fbf7ec',
        ink: '#2b2a26',
        muted: '#5a5148',
        accent: '#d97757',
        line: '#3a362d'
      },
      defs: sketchDefs,
      background: sketchBackground,
      node: sketchNode,
      edge: sketchEdge
    },
    iso: {
      tokens: {
        bg: '#f3f4f6',
        ink: '#1e293b',
        muted: '#64748b',
        accent: '#f5c518',
        line: '#cbd5e1'
      },
      defs: isoDefs,
      background: isoBackground,
      node: isoNode,
      edge: isoEdge
    },
    blueprint: {
      tokens: {
        bg: '#0b2545',
        ink: '#e0fbfc',
        muted: '#8bb5d4',
        accent: '#ffd166',
        line: '#3b82a0'
      },
      defs: blueprintDefs,
      background: blueprintBackground,
      node: blueprintNode,
      edge: blueprintEdge
    },
    city: {
      tokens: {
        bg: '#F9FAFB',
        ink: '#0f172a',
        muted: '#64748b',
        accent: '#007AFF',
        line: '#D1D5DB'
      },
      isometric: true,
      defs: cityDefs,
      background: cityBackground,
      node: cityNode,
      edge: cityEdge,
      edgeOverlay: cityEdgeOverlay
    }
  };

  // ── Main render function ───────────────────────────────────

  // Isometric projection used by City: scale(1, 0.577) rotate(-45)
  // Equivalent linear map applied to (x,y) input coordinates.
  //   X' = (cos(-45)) * x        + (-sin(-45)) * y       = 0.7071 x + 0.7071 y
  //   Y' = (sin(-45) * 0.577) x  + (cos(-45)  * 0.577) y = -0.4081 x + 0.4081 y
  function isoProject(x, y) {
    const c = Math.SQRT1_2; // cos(45°) = 0.7071
    const s = Math.SQRT1_2 * 0.577; // sin(45°) * 0.577 ≈ 0.4081
    return {
      x: c * x + c * y,
      y: -s * x + s * y
    };
  }
  function renderSVG(graphInput, opts = {}) {
    // Type dispatch — if the graph declares a non-flow type and a plugin
    // is registered for it, delegate to the plugin's renderer. Flow type
    // (or no type) falls through to the built-in flow renderer below.
    const declaredType = graphInput && typeof graphInput === 'object' && graphInput.type;
    if (declaredType && declaredType !== 'flow') {
      const plugin = getType(declaredType);
      if (plugin && typeof plugin.renderSVG === 'function') {
        return plugin.renderSVG(graphInput, opts);
      }
    }
    return renderFlowSVG(graphInput, opts);
  }
  function renderFlowSVG(graphInput, {
    styleName,
    activeNodes = [],
    activeEdges = [],
    padding = 28,
    width,
    height
  } = {}) {
    const G = resolveGraph(graphInput);
    // Style precedence: explicit option > graph.style directive > sleek default.
    const resolvedStyleName = styleName || G.style || 'sleek';
    const style = SVG_STYLES[resolvedStyleName] || SVG_STYLES.sleek;
    const isIso = !!style.isometric;

    // Sort nodes by iso depth so back blocks render first (painter's algorithm).
    // Depth heuristic: (y + h/2) - (x + w/2). Smaller = farther = drawn first.
    const orderedNodes = isIso ? [...G.nodes].sort((a, b) => a.y + a.h / 2 - (a.x + a.w / 2) - (b.y + b.h / 2 - (b.x + b.w / 2))) : G.nodes;

    // Compute bounds. For iso styles, project all 8 corners of each node's
    // extruded cube (top + bottom face) so the viewBox includes the lifted
    // top face after the global rotate/scale transform.
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const accept = (x, y) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    };
    if (!isIso) {
      G.nodes.forEach(n => {
        accept(n.x, n.y);
        accept(n.x + n.w, n.y + n.h);
      });
      G.edges.forEach(e => e.points.forEach(p => accept(p.x, p.y)));
    } else {
      // Approximate extrusion height used by city kindBodies (see Z constants).
      const extrudeFor = n => {
        if (n.kind === 'boundary') return 6;
        if (n.kind === 'client' || n.kind === 'actor') return 32;
        if (n.kind === 'store') return 56;
        return 42;
      };
      G.nodes.forEach(n => {
        const E = 1.225 * extrudeFor(n);
        const corners = [
        // bottom face (z = 0)
        [n.x, n.y], [n.x + n.w, n.y], [n.x, n.y + n.h], [n.x + n.w, n.y + n.h],
        // top face (lifted by E in screen space)
        [n.x + E, n.y - E], [n.x + n.w + E, n.y - E], [n.x + E, n.y + n.h - E], [n.x + n.w + E, n.y + n.h - E]];
        for (const [cx, cy] of corners) {
          const p = isoProject(cx, cy);
          accept(p.x, p.y);
        }
      });
      G.edges.forEach(e => e.points.forEach(pt => {
        const p = isoProject(pt.x, pt.y);
        accept(p.x, p.y);
      }));
    }
    if (!isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 800;
      maxY = 600;
    }
    const padX = padding + (isIso ? 30 : 10);
    const padY = padding + (isIso ? 40 : 15);
    const vbX = minX - padX;
    const vbY = minY - padY;
    const vbW = maxX - minX + padX * 2;
    const vbH = maxY - minY + padY * 2 + (isIso ? 10 : 25);
    const svgW = width || '100%';
    const svgH = height || '100%';
    const edgesHTML = G.edges.map(ed => wrapEdge(ed, style.edge(ed, activeEdges.includes(ed.id)))).join('');
    const nodesHTML = orderedNodes.map(nd => wrapNode(nd, style.node(nd, activeNodes.includes(nd.id)))).join('');

    // Optional second-pass edge layer rendered in SCREEN SPACE (outside the
    // iso projection). Used by iso styles to float labels/badges above the
    // 3D scene like tooltips, immune to building occlusion. Overlay functions
    // receive a `project` helper to convert canvas coords → screen coords.
    const project = isIso ? isoProject : (x, y) => ({
      x,
      y
    });
    const edgeOverlayHTML = style.edgeOverlay ? G.edges.map(ed => style.edgeOverlay(ed, activeEdges.includes(ed.id), {
      project,
      isIso
    })).join('') : '';

    // For isometric styles, wrap background+edges+nodes in the global iso
    // transform so the entire scene is projected together.
    const sceneOpen = isIso ? '<g transform="scale(1, 0.577) rotate(-45)">' : '';
    const sceneClose = isIso ? '</g>' : '';

    // Background rect must cover the full viewBox area so patterns/grids
    // fill the visible space correctly. For iso, the background lives inside
    // the projection transform so we use canvas-space coordinates.
    const bgInner = isIso ? style.background(G.canvas.w, G.canvas.h) : `<g transform="translate(${vbX} ${vbY})">${style.background(vbW, vbH)}</g>`;
    const a11yTitle = G.title ? `<title>${esc(G.title)}</title>` : '';

    // Inline stylesheet — travels with the SVG so the draw-on animation
    // and the reduced-motion guard work regardless of whether the host
    // page loaded viewport.js's stylesheet.
    const inlineStyle = `<style>
    @keyframes fd-edge-draw {
      from { stroke-dashoffset: var(--fd-edge-len, 600); }
      to   { stroke-dashoffset: 0; }
    }
    .fd-draw-on {
      stroke-dasharray: var(--fd-edge-len, 600);
      animation: fd-edge-draw .55s ease-out both;
    }
    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; transition: none !important; }
    }
  </style>`;
    return `<svg xmlns="http://www.w3.org/2000/svg"
    width="${svgW}" height="${svgH}"
    viewBox="${vbX} ${vbY} ${vbW} ${vbH}"
    preserveAspectRatio="xMidYMid meet"
    role="img" aria-roledescription="diagram"
    style="display:block;background:${style.tokens.bg}">
    ${a11yTitle}
    ${inlineStyle}
    ${style.defs()}
    ${sceneOpen}${bgInner}${edgesHTML}${nodesHTML}${sceneClose}
    ${edgeOverlayHTML}
  </svg>`;
  }

  // -----------------------------------------------------------
  // Vanilla viewport — zoom / pan / fullscreen / download
  // shell around a renderSVG() output. Used by the standalone
  // bundle and the <rl-flow> Web Component so non-React
  // pages get the same interactive controls as the React
  // <Diagram> component.
  // -----------------------------------------------------------


  // ---- Inline SVG icon strings for the floating buttons. ----
  const SVG_ATTRS = 'width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const ICONS = {
    zoomIn: `<svg ${SVG_ATTRS}>` + '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' + '<line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>' + '</svg>',
    zoomOut: `<svg ${SVG_ATTRS}>` + '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' + '<line x1="8" y1="11" x2="14" y2="11"/>' + '</svg>',
    fsEnter: `<svg ${SVG_ATTRS}>` + '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>' + '</svg>',
    fsExit: `<svg ${SVG_ATTRS}>` + '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>' + '</svg>',
    download: `<svg ${SVG_ATTRS}>` + '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' + '<polyline points="7 10 12 15 17 10"/>' + '<line x1="12" y1="15" x2="12" y2="3"/>' + '</svg>',
    prev: `<svg ${SVG_ATTRS}>` + '<polyline points="15 18 9 12 15 6"/>' + '</svg>',
    next: `<svg ${SVG_ATTRS}>` + '<polyline points="9 18 15 12 9 6"/>' + '</svg>',
    play: `<svg ${SVG_ATTRS}>` + '<polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/>' + '</svg>',
    pause: `<svg ${SVG_ATTRS}>` + '<rect x="6" y="5" width="4" height="14" fill="currentColor"/>' + '<rect x="14" y="5" width="4" height="14" fill="currentColor"/>' + '</svg>'
  };

  // ---- Stylesheet injected once into the page head. ---------
  const STYLE_BLOCK = `
.fd-host {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Inter Tight", system-ui, sans-serif;
}
.fd-host:fullscreen { background: #fff; padding: 24px; }
.fd-host .fd-stage {
  width: 100%; height: 100%;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.fd-host .fd-stage.fd-grabbing { cursor: grabbing; }
.fd-host .fd-stage > svg { display: block; width: 100%; height: 100%; }
.fd-host .fd-controls {
  position: absolute; bottom: 12px; right: 12px;
  display: flex; gap: 6px; z-index: 10;
  opacity: 0; pointer-events: none;
  transition: opacity .18s ease;
}
.fd-host:hover .fd-controls,
.fd-host.fd-active .fd-controls,
.fd-host:fullscreen .fd-controls { opacity: 1; pointer-events: auto; }
.fd-host .fd-group {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
  display: flex; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08);
}
.fd-host .fd-btn {
  background: transparent; border: 0; padding: 7px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: #64748b; transition: background .15s, color .15s;
  font-family: inherit;
}
.fd-host .fd-btn:hover { background: #f8fafc; color: #1e293b; }
.fd-host .fd-divider { width: 1px; background: #e2e8f0; }
.fd-host .fd-pct {
  font-family: ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace;
  font-weight: 700; font-size: 10px; min-width: 44px;
}
.fd-host .fd-solo {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 8px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.08);
  display: flex; align-items: center; justify-content: center;
  color: #64748b; transition: background .15s, color .15s;
  font-family: inherit;
}
.fd-host .fd-solo:hover { background: #f8fafc; color: #1e293b; }
.fd-host .fd-caption {
  position: absolute; left: 12px; bottom: 12px; z-index: 9;
  display: flex; align-items: center; gap: 10px;
  padding: 7px 12px;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
  font-size: 12px; color: #1e293b;
  max-width: calc(100% - 230px);
  pointer-events: none;
  opacity: 0; transition: opacity .18s ease;
}
.fd-host:hover .fd-caption,
.fd-host:fullscreen .fd-caption,
.fd-host.fd-active .fd-caption { opacity: 1; }
.fd-host .fd-caption .fd-step {
  font-family: ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace;
  font-size: 10px; font-weight: 700;
  color: #64748b; letter-spacing: .04em;
}
.fd-host .fd-caption .fd-title { font-weight: 600; }

/* ── Advanced player extras ────────────────────────────── */
.fd-host .fd-caption.fd-advanced {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 10px 12px;
  min-width: 220px;
  max-width: calc(100% - 230px);
  pointer-events: auto;
}
.fd-host .fd-caption.fd-advanced .fd-cap-row {
  display: flex; align-items: center; gap: 10px;
}
.fd-host .fd-caption.fd-advanced .fd-cap-spacer { flex: 1; }
.fd-host .fd-caption.fd-advanced .fd-dots {
  display: flex; gap: 6px; align-items: center;
}
.fd-host .fd-caption.fd-advanced .fd-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #cbd5e1; border: 0; cursor: pointer;
  padding: 0; transition: background .15s, transform .15s;
}
.fd-host .fd-caption.fd-advanced .fd-dot:hover { transform: scale(1.25); background: #94a3b8; }
.fd-host .fd-caption.fd-advanced .fd-dot.fd-on { background: #0f172a; }
.fd-host .fd-caption.fd-advanced .fd-speed {
  display: inline-flex; align-items: center; gap: 0;
  border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;
  font-family: ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace;
  font-size: 10px; font-weight: 700;
}
.fd-host .fd-caption.fd-advanced .fd-speed button {
  background: transparent; border: 0; padding: 4px 8px;
  cursor: pointer; color: #64748b; font: inherit;
}
.fd-host .fd-caption.fd-advanced .fd-speed button.fd-on {
  background: #0f172a; color: #fff;
}
.fd-host .fd-caption.fd-advanced .fd-progress {
  height: 3px; background: #e2e8f0; border-radius: 2px; overflow: hidden;
}
.fd-host .fd-caption.fd-advanced .fd-progress > i {
  display: block; height: 100%; width: 0;
  background: #0f172a; border-radius: 2px;
  transform-origin: left center;
}

/* Active-edge draw-on animation. Renderers can opt-in by adding the
   class to a freshly-active edge path; the dash animates from full
   length back to 0 to give a "drawing" effect on each transition. */
@keyframes fd-edge-draw {
  from { stroke-dashoffset: var(--fd-edge-len, 600); }
  to   { stroke-dashoffset: 0; }
}
.fd-host .fd-draw-on {
  stroke-dasharray: var(--fd-edge-len, 600);
  animation: fd-edge-draw .55s ease-out both;
}

/* Honour the user's prefers-reduced-motion setting — disables every
   auto-animation (pulse / draw / dashoffset cycles). Static visuals
   remain. */
@media (prefers-reduced-motion: reduce) {
  .fd-host *,
  .fd-host *::before,
  .fd-host *::after {
    animation: none !important;
    transition: none !important;
  }
}
`;
  let stylesInjected = false;
  function injectStyles() {
    if (stylesInjected || typeof document === 'undefined') return;
    const s = document.createElement('style');
    s.setAttribute('data-flow-viewport', '');
    s.textContent = STYLE_BLOCK;
    document.head.appendChild(s);
    stylesInjected = true;
  }

  // Parse "x y w h" viewBox string → { x, y, w, h }
  function parseViewBox(vb) {
    if (!vb) return null;
    const parts = vb.trim().split(/\s+/).map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return null;
    return {
      x: parts[0],
      y: parts[1],
      w: parts[2],
      h: parts[3]
    };
  }

  /**
   * Mount an interactive Flow viewport into a container element.
   *
   *   const v = mount('#arch', { graph, styleName: 'sleek' })
   *   v.update({ activeNodes: ['client'], activeEdges: ['e1'] })
   *   v.setStyle('city')
   *   v.resetView()
   *   v.destroy()
   */
  function mount(target, opts = {}) {
    if (typeof document === 'undefined') {
      throw new Error('rl-flow mount() requires a DOM environment');
    }
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container || container.nodeType !== 1) {
      throw new Error('rl-flow mount() needs a valid DOM element or selector');
    }
    injectStyles();
    const state = {
      graph: opts.graph || null,
      styleName: opts.styleName || opts.graph && opts.graph.style || 'sleek',
      activeNodes: opts.activeNodes || [],
      activeEdges: opts.activeEdges || [],
      padding: opts.padding,
      showControls: opts.controls !== false,
      fileName: opts.fileName || 'rl-flow',
      onNodeClick: typeof opts.onNodeClick === 'function' ? opts.onNodeClick : null,
      onEdgeClick: typeof opts.onEdgeClick === 'function' ? opts.onEdgeClick : null,
      onStepChange: typeof opts.onStepChange === 'function' ? opts.onStepChange : null,
      // Player: optional steps array overrides graph.steps. autoplay/interval
      // turn the timeline into a self-cycling diagram. autoStep just exposes
      // the controls without auto-advancing.
      steps: Array.isArray(opts.steps) ? opts.steps : null,
      playerMode: normalizePlayerMode(opts.player),
      autoplay: opts.autoplay === true,
      interval: typeof opts.interval === 'number' ? opts.interval : 2200,
      speed: typeof opts.speed === 'number' && opts.speed > 0 ? opts.speed : 1,
      stepIndex: 0,
      _timer: null,
      _stepStartedAt: 0,
      _progressRAF: null,
      zoom: 1,
      panX: 0,
      panY: 0
    };
    if (!state.steps && state.graph && Array.isArray(state.graph.steps)) {
      state.steps = state.graph.steps;
    }
    // Resolve 'auto' (the default when player wasn't set) now that we know
    // whether the graph actually has steps.
    if (state.playerMode === 'auto') {
      state.playerMode = state.steps && state.steps.length > 0 ? 'basic' : 'off';
    }

    // ── DOM scaffolding ─────────────────────────────────────
    container.innerHTML = '';
    const host = document.createElement('div');
    host.className = 'fd-host';
    const stage = document.createElement('div');
    stage.className = 'fd-stage';
    host.appendChild(stage);
    container.appendChild(host);

    // ── Floating control panel ──────────────────────────────
    let pctBtn = null;
    let fsBtn = null;
    let playBtn = null;
    let stepIdxLabel = null;
    let captionEl = null;
    let captionStepEl = null;
    let captionTitleEl = null;
    // Advanced-player extras
    let progressEl = null; // <i> inside .fd-progress whose width animates
    let dotsEl = null; // container holding clickable step dots
    let speedBtns = []; // [{ value, el }] chip group

    const hasPlayer = () => state.playerMode !== 'off' && Array.isArray(state.steps) && state.steps.length > 0;
    const isAdvanced = () => state.playerMode === 'advanced' && Array.isArray(state.steps) && state.steps.length > 0;
    if (state.showControls) {
      const controls = document.createElement('div');
      controls.className = 'fd-controls';

      // ── Player group (only if steps exist) ─────────────
      if (hasPlayer()) {
        const pg = document.createElement('div');
        pg.className = 'fd-group';
        const bPrev = mkBtn('fd-btn', ICONS.prev, 'Previous step', () => api.prevStep());
        const bPlay = mkBtn('fd-btn', state.autoplay ? ICONS.pause : ICONS.play, state.autoplay ? 'Pause' : 'Play', () => api.togglePlay());
        playBtn = bPlay;
        const bIdx = mkBtn('fd-btn fd-pct', '1/' + state.steps.length, 'Reset to step 1', () => api.gotoStep(0));
        stepIdxLabel = bIdx;
        const bNext = mkBtn('fd-btn', ICONS.next, 'Next step', () => api.nextStep());
        pg.appendChild(bPrev);
        pg.appendChild(divider());
        pg.appendChild(bPlay);
        pg.appendChild(divider());
        pg.appendChild(bIdx);
        pg.appendChild(divider());
        pg.appendChild(bNext);
        controls.appendChild(pg);
      }

      // Zoom group
      const zg = document.createElement('div');
      zg.className = 'fd-group';
      const bOut = mkBtn('fd-btn', ICONS.zoomOut, 'Zoom out', () => api.setZoom(state.zoom / 1.25));
      const bPct = mkBtn('fd-btn fd-pct', '100%', 'Reset view', () => api.resetView());
      pctBtn = bPct;
      const bIn = mkBtn('fd-btn', ICONS.zoomIn, 'Zoom in', () => api.setZoom(state.zoom * 1.25));
      zg.appendChild(bOut);
      zg.appendChild(divider());
      zg.appendChild(bPct);
      zg.appendChild(divider());
      zg.appendChild(bIn);

      // Fullscreen + download solos
      fsBtn = mkBtn('fd-solo', ICONS.fsEnter, 'Toggle fullscreen', () => api.toggleFullscreen());
      const dlBtn = mkBtn('fd-solo', ICONS.download, 'Download SVG', () => api.download());
      controls.appendChild(zg);
      controls.appendChild(fsBtn);
      controls.appendChild(dlBtn);
      host.appendChild(controls);

      // ── Step caption (left side) ───────────────────────
      if (hasPlayer()) {
        captionEl = document.createElement('div');
        captionEl.className = 'fd-caption' + (isAdvanced() ? ' fd-advanced' : '');
        captionStepEl = document.createElement('span');
        captionStepEl.className = 'fd-step';
        captionTitleEl = document.createElement('span');
        captionTitleEl.className = 'fd-title';
        if (isAdvanced()) {
          // Row 1: step counter + title
          const row1 = document.createElement('div');
          row1.className = 'fd-cap-row';
          row1.appendChild(captionStepEl);
          row1.appendChild(captionTitleEl);
          captionEl.appendChild(row1);

          // Row 2: clickable step dots + speed selector
          const row2 = document.createElement('div');
          row2.className = 'fd-cap-row';
          dotsEl = document.createElement('div');
          dotsEl.className = 'fd-dots';
          state.steps.forEach((_, i) => {
            const d = document.createElement('button');
            d.className = 'fd-dot';
            d.title = 'Go to step ' + (i + 1);
            d.setAttribute('aria-label', 'Go to step ' + (i + 1));
            d.addEventListener('click', e => {
              e.stopPropagation();
              api.gotoStep(i);
            });
            dotsEl.appendChild(d);
          });
          const spacer = document.createElement('div');
          spacer.className = 'fd-cap-spacer';
          const speedGroup = document.createElement('div');
          speedGroup.className = 'fd-speed';
          speedBtns = [0.5, 1, 2, 4].map(v => {
            const b = document.createElement('button');
            b.textContent = (v < 1 ? v.toString() : v) + '×';
            b.title = 'Playback speed ' + v + '×';
            b.addEventListener('click', e => {
              e.stopPropagation();
              api.setSpeed(v);
            });
            speedGroup.appendChild(b);
            return {
              value: v,
              el: b
            };
          });
          row2.appendChild(dotsEl);
          row2.appendChild(spacer);
          row2.appendChild(speedGroup);
          captionEl.appendChild(row2);

          // Row 3: progress bar
          const progressWrap = document.createElement('div');
          progressWrap.className = 'fd-progress';
          progressEl = document.createElement('i');
          progressWrap.appendChild(progressEl);
          captionEl.appendChild(progressWrap);
        } else {
          captionEl.appendChild(captionStepEl);
          captionEl.appendChild(captionTitleEl);
        }
        host.appendChild(captionEl);
      }

      // Reflect fullscreen state in the toggle icon
      const onFsChange = () => {
        if (!fsBtn) return;
        fsBtn.innerHTML = document.fullscreenElement === host ? ICONS.fsExit : ICONS.fsEnter;
      };
      document.addEventListener('fullscreenchange', onFsChange);
      state._cleanupFs = () => document.removeEventListener('fullscreenchange', onFsChange);
    }

    // Apply the current step's highlights to active state.
    function applyStep() {
      if (!hasPlayer()) return;
      const step = state.steps[state.stepIndex] || {};
      const a = step.active || {};
      state.activeNodes = Array.isArray(a.nodes) ? a.nodes : Array.isArray(step.nodes) ? step.nodes : [];
      state.activeEdges = Array.isArray(a.edges) ? a.edges : Array.isArray(step.edges) ? step.edges : [];
      if (captionStepEl) captionStepEl.textContent = state.stepIndex + 1 + '/' + state.steps.length;
      if (captionTitleEl) captionTitleEl.textContent = step.title || step.label || 'Step ' + (state.stepIndex + 1);
      if (stepIdxLabel) stepIdxLabel.innerHTML = state.stepIndex + 1 + '/' + state.steps.length;
      if (dotsEl) {
        Array.from(dotsEl.children).forEach((d, i) => {
          d.classList.toggle('fd-on', i === state.stepIndex);
        });
      }
      state._stepStartedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      if (progressEl) progressEl.style.width = '0%';
      if (state.onStepChange) state.onStepChange(state.stepIndex, step);
    }
    function effectiveInterval() {
      return Math.max(80, state.interval / (state.speed || 1));
    }
    function applySpeedUI() {
      for (const {
        value,
        el
      } of speedBtns) {
        el.classList.toggle('fd-on', value === state.speed);
      }
    }
    function tickProgress() {
      if (!progressEl) {
        state._progressRAF = null;
        return;
      }
      if (!state.autoplay) {
        state._progressRAF = null;
        return;
      }
      const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      const t = Math.min(1, (now - state._stepStartedAt) / effectiveInterval());
      progressEl.style.width = (t * 100).toFixed(2) + '%';
      state._progressRAF = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(tickProgress) : null;
    }
    function startProgress() {
      if (!progressEl) return;
      if (state._progressRAF) cancelAnimationFrame(state._progressRAF);
      if (typeof requestAnimationFrame !== 'undefined') {
        state._progressRAF = requestAnimationFrame(tickProgress);
      }
    }
    function stopProgress() {
      if (state._progressRAF && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(state._progressRAF);
      }
      state._progressRAF = null;
    }
    function startTimer() {
      stopTimer();
      if (!hasPlayer()) return;
      state._stepStartedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      state._timer = setInterval(() => api.nextStep(), effectiveInterval());
      if (playBtn) {
        playBtn.innerHTML = ICONS.pause;
        playBtn.title = 'Pause';
      }
      startProgress();
    }
    function stopTimer() {
      if (state._timer) {
        clearInterval(state._timer);
        state._timer = null;
      }
      if (playBtn) {
        playBtn.innerHTML = ICONS.play;
        playBtn.title = 'Play';
      }
      stopProgress();
    }

    // ── Render + viewBox math ───────────────────────────────
    let baseVB = {
      x: 0,
      y: 0,
      w: 800,
      h: 400
    };
    function render() {
      if (!state.graph) {
        stage.innerHTML = '<div style="padding:16px;color:#94a3b8;font-size:13px;font-family:inherit">No graph provided</div>';
        return;
      }
      let svgStr;
      try {
        svgStr = renderSVG(state.graph, {
          styleName: state.styleName,
          activeNodes: state.activeNodes,
          activeEdges: state.activeEdges,
          padding: state.padding
        });
      } catch (err) {
        stage.innerHTML = '<div style="padding:16px;color:#c0392b;font-family:monospace;font-size:12px">rl-flow render error: ' + String(err && err.message || err) + '</div>';
        return;
      }
      stage.innerHTML = svgStr;
      const svg = stage.querySelector('svg');
      if (svg) {
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.display = 'block';
        svg.style.width = '100%';
        svg.style.height = '100%';
        const vb = parseViewBox(svg.getAttribute('viewBox'));
        if (vb) baseVB = vb;
        attachInteraction(svg);
      }
      applyViewBox();
    }
    function applyViewBox() {
      const svg = stage.querySelector('svg');
      if (!svg) return;
      const vbW = baseVB.w / state.zoom;
      const vbH = baseVB.h / state.zoom;
      const cx = baseVB.x + baseVB.w / 2 + state.panX;
      const cy = baseVB.y + baseVB.h / 2 + state.panY;
      svg.setAttribute('viewBox', `${cx - vbW / 2} ${cy - vbH / 2} ${vbW} ${vbH}`);
      if (pctBtn) pctBtn.innerHTML = Math.round(state.zoom * 100) + '%';
    }

    // ── Mouse + wheel interaction ──────────────────────────
    function attachInteraction(svg) {
      let drag = null;
      const onDown = e => {
        if (e.button !== undefined && e.button !== 0) return;
        const point = pointerPos(e);
        drag = {
          mx: point.x,
          my: point.y,
          px: state.panX,
          py: state.panY
        };
        stage.classList.add('fd-grabbing');
      };
      const onMove = e => {
        if (!drag) return;
        const point = pointerPos(e);
        const rect = stage.getBoundingClientRect();
        const vbW = baseVB.w / state.zoom;
        const vbH = baseVB.h / state.zoom;
        const sx = rect.width / vbW;
        const sy = rect.height / vbH;
        const scale = Math.min(sx, sy) || 1;
        state.panX = drag.px - (point.x - drag.mx) / scale;
        state.panY = drag.py - (point.y - drag.my) / scale;
        applyViewBox();
      };
      const onUp = () => {
        drag = null;
        stage.classList.remove('fd-grabbing');
      };
      svg.addEventListener('mousedown', onDown);
      svg.addEventListener('mousemove', onMove);
      svg.addEventListener('mouseup', onUp);
      svg.addEventListener('mouseleave', onUp);

      // Touch — single-finger pan only (pinch-zoom would be nice but adds complexity)
      svg.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;
        onDown({
          button: 0,
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY
        });
      }, {
        passive: true
      });
      svg.addEventListener('touchmove', e => {
        if (e.touches.length !== 1) return;
        onMove({
          clientX: e.touches[0].clientX,
          clientY: e.touches[0].clientY
        });
      }, {
        passive: true
      });
      svg.addEventListener('touchend', onUp);

      // Wheel zoom
      svg.addEventListener('wheel', e => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
        api.setZoom(state.zoom * factor);
      }, {
        passive: false
      });

      // Click delegation: walk up to find a node/edge group.
      if (state.onNodeClick || state.onEdgeClick) {
        svg.addEventListener('click', e => {
          if (drag) return;
          const t = e.target.closest('[data-node-id], [data-edge-id]');
          if (!t) return;
          const nid = t.getAttribute('data-node-id');
          const eid = t.getAttribute('data-edge-id');
          if (nid && state.onNodeClick) state.onNodeClick(nid, e);else if (eid && state.onEdgeClick) state.onEdgeClick(eid, e);
        });
      }
    }
    function pointerPos(e) {
      return {
        x: e.clientX,
        y: e.clientY
      };
    }

    // ── Public API ──────────────────────────────────────────
    const api = {
      update(next) {
        if (!next) return;
        let needRender = false;
        // Special-case `graph` so its embedded steps can flow through into
        // the player without forcing callers to repeat them.
        if ('graph' in next && next.graph !== state.graph) {
          state.graph = next.graph;
          if (!('steps' in next) && state.graph && Array.isArray(state.graph.steps)) {
            state.steps = state.graph.steps;
            state.stepIndex = 0;
          }
          needRender = true;
        }
        for (const k of ['styleName', 'activeNodes', 'activeEdges', 'padding']) {
          if (k in next && next[k] !== state[k]) {
            state[k] = next[k];
            needRender = true;
          }
        }
        if ('steps' in next) {
          state.steps = Array.isArray(next.steps) ? next.steps : null;
          state.stepIndex = 0;
          applyStep();
          needRender = true;
        }
        for (const k of ['onNodeClick', 'onEdgeClick', 'fileName', 'onStepChange', 'interval']) {
          if (k in next) state[k] = next[k];
        }
        if (needRender) render();
      },
      setStyle(name) {
        if (!name || name === state.styleName) return;
        state.styleName = name;
        render();
      },
      setActive(nodes, edges) {
        state.activeNodes = Array.isArray(nodes) ? nodes : [];
        state.activeEdges = Array.isArray(edges) ? edges : [];
        render();
      },
      // ── Player API ─────────────────────────────────────
      play() {
        if (!hasPlayer()) return;
        state.autoplay = true;
        startTimer();
      },
      pause() {
        state.autoplay = false;
        stopTimer();
      },
      togglePlay() {
        if (state.autoplay) api.pause();else api.play();
      },
      nextStep() {
        if (!hasPlayer()) return;
        state.stepIndex = (state.stepIndex + 1) % state.steps.length;
        applyStep();
        render();
      },
      prevStep() {
        if (!hasPlayer()) return;
        state.stepIndex = (state.stepIndex - 1 + state.steps.length) % state.steps.length;
        applyStep();
        render();
      },
      gotoStep(i) {
        if (!hasPlayer()) return;
        const n = state.steps.length;
        state.stepIndex = (i % n + n) % n;
        applyStep();
        render();
      },
      setInterval(ms) {
        state.interval = Math.max(200, ms | 0);
        if (state.autoplay) startTimer();
      },
      setSpeed(s) {
        const next = typeof s === 'number' && s > 0 ? s : 1;
        if (next === state.speed) return;
        state.speed = next;
        applySpeedUI();
        if (state.autoplay) startTimer();
      },
      get stepIndex() {
        return state.stepIndex;
      },
      get playerMode() {
        return state.playerMode;
      },
      setZoom(z) {
        state.zoom = Math.max(0.2, Math.min(4, z));
        applyViewBox();
      },
      resetView() {
        state.zoom = 1;
        state.panX = 0;
        state.panY = 0;
        applyViewBox();
      },
      toggleFullscreen() {
        if (typeof document === 'undefined') return;
        if (document.fullscreenElement === host) {
          document.exitFullscreen && document.exitFullscreen();
        } else if (host.requestFullscreen) {
          host.requestFullscreen().catch(err => {
            // Fullscreen rejected (e.g. iframe without allowfullscreen). Surface
            // the failure but keep the rest of the viewport functional.
            // eslint-disable-next-line no-console
            console.warn('rl-flow fullscreen rejected:', err && err.message);
          });
        }
      },
      download() {
        const svg = stage.querySelector('svg');
        if (!svg) return;
        const clone = svg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        // Restore the natural (unzoomed) viewBox so the export captures the
        // full diagram, regardless of the user's current zoom/pan.
        clone.setAttribute('viewBox', `${baseVB.x} ${baseVB.y} ${baseVB.w} ${baseVB.h}`);
        clone.setAttribute('width', String(baseVB.w));
        clone.setAttribute('height', String(baseVB.h));
        let src = new XMLSerializer().serializeToString(clone);
        if (!src.startsWith('<?xml')) {
          src = '<?xml version="1.0" standalone="no"?>\n' + src;
        }
        const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
        const a = document.createElement('a');
        a.href = url;
        a.download = (state.fileName || 'rl-flow') + '-' + state.styleName + '.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      },
      destroy() {
        stopTimer();
        if (state._cleanupFs) state._cleanupFs();
        if (host.parentNode) host.parentNode.removeChild(host);
      },
      get host() {
        return host;
      },
      get stage() {
        return stage;
      },
      get svg() {
        return stage.querySelector('svg');
      }
    };

    // Initialize player highlights + speed UI before the first render so the
    // diagram opens on step 1 if a steps array was provided.
    if (hasPlayer()) applyStep();
    if (isAdvanced()) applySpeedUI();
    render();
    if (state.autoplay && hasPlayer()) startTimer();
    return api;
  }

  // Normalize the `player` option into one of: 'off' | 'basic' | 'advanced' |
  // 'auto'. 'auto' is resolved later once we know whether the graph has
  // steps. Accepted inputs:
  //   true / 'basic'    → 'basic'
  //   'advanced'        → 'advanced'
  //   false / 'off'     → 'off'
  //   undefined / other → 'auto'  (default: basic when steps exist, else off)
  function normalizePlayerMode(player) {
    if (player === false || player === 'off') return 'off';
    if (player === 'advanced') return 'advanced';
    if (player === true || player === 'basic') return 'basic';
    return 'auto';
  }

  // Helper: build a button quickly.
  function mkBtn(cls, content, title, fn) {
    const b = document.createElement('button');
    b.className = cls;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = content;
    b.addEventListener('click', e => {
      e.stopPropagation();
      fn();
    });
    return b;
  }
  function divider() {
    const d = document.createElement('div');
    d.className = 'fd-divider';
    return d;
  }

  // -----------------------------------------------------------
  // <rl-flow> custom element. Pure SVG renderer via mount() —
  // no React. Single source of truth for the element shape used
  // by both the standalone IIFE bundle and the UMD bundle.
  // -----------------------------------------------------------

  const OBSERVED = ['dsl', 'config', 'diagram-style', 'active-nodes', 'active-edges', 'height', 'width', 'controls', 'autoplay', 'interval', 'player', 'speed'];

  // SSR safety: HTMLElement is undefined in Node. The class is only ever
  // constructed by `customElements.define(...)` in a browser, but the
  // `extends` clause runs at import time — so fall back to a no-op base
  // when there's no DOM. This lets the package be imported from server
  // components / SSR pipelines without crashing.
  const _Base = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};
  class RLFlowElement extends _Base {
    static get observedAttributes() {
      return OBSERVED;
    }
    connectedCallback() {
      this._render();
    }
    disconnectedCallback() {
      if (this._viewport) {
        this._viewport.destroy();
        this._viewport = null;
      }
    }
    attributeChangedCallback() {
      if (this.isConnected) this._render();
    }
    set config(val) {
      this._config = val;
      this._render();
    }
    _render() {
      const dsl = this.getAttribute('dsl');
      const styleName = this.getAttribute('diagram-style') || 'sleek';
      const rawAN = this.getAttribute('active-nodes') || '';
      const rawAE = this.getAttribute('active-edges') || '';
      const activeNodes = rawAN ? rawAN.split(',').map(s => s.trim()) : [];
      const activeEdges = rawAE ? rawAE.split(',').map(s => s.trim()) : [];
      const h = this.getAttribute('height') || '400px';
      const w = this.getAttribute('width') || '100%';
      const controls = this.getAttribute('controls') !== 'false';
      // player attribute is a string: 'basic' | 'advanced' | 'off'. Falsy /
      // unknown values fall through as undefined so viewport.js applies its
      // default (basic when steps exist).
      const playerRaw = this.getAttribute('player');
      const player = playerRaw == null ? undefined : playerRaw;
      const autoplay = this.getAttribute('autoplay') === 'true' || this.hasAttribute('autoplay') && this.getAttribute('autoplay') !== 'false';
      const intervalRaw = this.getAttribute('interval');
      const interval = intervalRaw && !isNaN(+intervalRaw) ? +intervalRaw : undefined;
      const speedRaw = this.getAttribute('speed');
      const speed = speedRaw && !isNaN(+speedRaw) ? +speedRaw : undefined;
      let graph = null;
      try {
        const configAttr = this.getAttribute('config');
        if (configAttr) graph = JSON.parse(configAttr);else if (this._config) graph = this._config;else if (dsl) graph = parseDSL(dsl);
      } catch (err) {
        this.innerHTML = `<div style="color:red;padding:12px;font-family:monospace">rl-flow error: ${err.message}</div>`;
        return;
      }
      if (!graph) {
        this.innerHTML = `<div style="color:#94a3b8;padding:12px;font-family:sans-serif;font-size:13px">Add nodes to see a diagram</div>`;
        return;
      }
      this.style.display = 'block';
      this.style.width = w;
      this.style.height = h;
      this.style.overflow = 'hidden';
      if (this._viewport) {
        this._viewport.update({
          graph,
          styleName,
          activeNodes,
          activeEdges
        });
        return;
      }
      try {
        this._viewport = mount(this, {
          graph,
          styleName,
          activeNodes,
          activeEdges,
          controls,
          player,
          autoplay,
          interval,
          speed,
          onNodeClick: id => this.dispatchEvent(new CustomEvent('node-click', {
            detail: {
              id
            },
            bubbles: true
          })),
          onEdgeClick: id => this.dispatchEvent(new CustomEvent('edge-click', {
            detail: {
              id
            },
            bubbles: true
          })),
          onStepChange: (i, step) => this.dispatchEvent(new CustomEvent('step-change', {
            detail: {
              index: i,
              step
            },
            bubbles: true
          }))
        });
      } catch (err) {
        this.innerHTML = `<div style="color:red;padding:12px;font-family:monospace">rl-flow render error: ${err.message}</div>`;
      }
    }
    play() {
      this._viewport && this._viewport.play();
    }
    pause() {
      this._viewport && this._viewport.pause();
    }
    togglePlay() {
      this._viewport && this._viewport.togglePlay();
    }
    nextStep() {
      this._viewport && this._viewport.nextStep();
    }
    prevStep() {
      this._viewport && this._viewport.prevStep();
    }
    gotoStep(i) {
      this._viewport && this._viewport.gotoStep(i);
    }
    setStyle(s) {
      this._viewport && this._viewport.setStyle(s);
    }
    setSpeed(s) {
      this._viewport && this._viewport.setSpeed(s);
    }
    setZoom(z) {
      this._viewport && this._viewport.setZoom(z);
    }
    resetView() {
      this._viewport && this._viewport.resetView();
    }
    download() {
      this._viewport && this._viewport.download();
    }
    toggleFullscreen() {
      this._viewport && this._viewport.toggleFullscreen();
    }
  }
  function registerElement() {
    if (typeof customElements !== 'undefined' && !customElements.get('rl-flow')) {
      customElements.define('rl-flow', RLFlowElement);
    }
  }

  // -----------------------------------------------------------
  // UMD / Browser bundle entry.
  // Registers the <rl-flow> Web Component and exposes the
  // full API on window.RLFlow for plain-HTML usage.
  // -----------------------------------------------------------

  registerElement();
  if (typeof window !== 'undefined') {
    window.RLFlow = {
      Diagram,
      parseDSL,
      shapePath,
      shapeAnchor,
      downloadSVG,
      svgToString,
      downloadPNG,
      resolveGraph,
      NODE_KINDS,
      SHAPES,
      EXAMPLE_GRAPH,
      STYLES,
      NodeIcon,
      registerStyle,
      getStyle,
      listStyles
    };
  }

  exports.BUILTIN_STYLES = BUILTIN_STYLES;
  exports.Diagram = Diagram;
  exports.EXAMPLE_GRAPH = EXAMPLE_GRAPH;
  exports.NODE_KINDS = NODE_KINDS;
  exports.NodeIcon = NodeIcon;
  exports.RLFlowElement = RLFlowElement;
  exports.SHAPES = SHAPES;
  exports.STYLES = STYLES;
  exports.downloadPNG = downloadPNG;
  exports.downloadSVG = downloadSVG;
  exports.getStyle = getStyle;
  exports.listStyles = listStyles;
  exports.parseDSL = parseDSL;
  exports.registerStyle = registerStyle;
  exports.resolveGraph = resolveGraph;
  exports.shapeAnchor = shapeAnchor;
  exports.shapePath = shapePath;
  exports.svgToString = svgToString;

}));
//# sourceMappingURL=flow.umd.js.map
