// -----------------------------------------------------------
// Graph IR — the shared data model all styles render from.
// A diagram is: { nodes, edges, steps, canvas }
// - node.kind drives which renderer shape is used
// - edge.path is computed from node positions (orthogonal router)
// - step.highlight marks nodes + edges active at each step
// -----------------------------------------------------------

import { getLayout, registerLayout } from './layouts/index.js';

export const NODE_KINDS = {
  service:     { label: 'Service',       shape: 'rect',     icon: 'square'   },
  store:       { label: 'Database',      shape: 'cylinder', icon: 'cylinder' },
  cache:       { label: 'Cache',         shape: 'rect',     icon: 'disk'     },
  queue:       { label: 'Queue',         shape: 'rect',     icon: 'stack'    },
  actor:       { label: 'Client',        shape: 'rect',     icon: 'person'   },
  gateway:     { label: 'Gateway',       shape: 'hex',      icon: 'diamond'  },
  external:    { label: 'External',      shape: 'cloud',    icon: 'cloud'    },
  boundary:    { label: 'Boundary',      shape: 'rect',     icon: 'group'    },
  start:       { label: 'Start',         shape: 'pill',     icon: 'play'     },
  stop:        { label: 'Stop',          shape: 'pill',     icon: 'square'   },
  decision:    { label: 'Decision',      shape: 'diamond',  icon: 'qmark'    },
  process:     { label: 'Process',       shape: 'square',   icon: 'cog'      },
  event:       { label: 'Event',         shape: 'circle',   icon: 'bolt'     },
  step:        { label: 'Step',          shape: 'oval',     icon: 'dot'      },
  tree:        { label: 'Tree node',     shape: 'circle',   icon: 'dot'      },
  image:       { label: 'Logo',          shape: 'rect',     icon: 'image'    },
  function:    { label: 'Function',      shape: 'rect',     icon: 'lambda'   },
  worker:      { label: 'Worker',        shape: 'rect',     icon: 'gear'     },
  loadbalancer:{ label: 'Load Balancer', shape: 'rect',     icon: 'scale'    },
  cdn:         { label: 'CDN',           shape: 'cloud',    icon: 'globe'    },
  auth:        { label: 'Auth',          shape: 'shield',   icon: 'key'      },
  monitor:     { label: 'Monitor',       shape: 'rect',     icon: 'chart'    },
  bus:         { label: 'Event Bus',     shape: 'rect',     icon: 'bus'      },
  stream:      { label: 'Stream',        shape: 'rect',     icon: 'wave'     },
  firewall:    { label: 'Firewall',      shape: 'rect',     icon: 'wall'     },
  mobile:      { label: 'Mobile',        shape: 'tablet',   icon: 'phone'    },
};

export const SHAPES = [
  'rect', 'square', 'circle', 'oval', 'diamond', 'hex', 'pill',
  'cylinder', 'cloud', 'parallelogram', 'shield', 'tablet', 'trapezoid', 'chevron',
  // New shapes
  'document', 'folder', 'sticky-note', 'person', 'custom-path',
];

export const EXAMPLE_GRAPH = {
  canvas: { w: 560, h: 280, grid: 20 },
  nodes: [
    { id: 'client', kind: 'actor',   label: 'Client',      x: 30,  y: 110, w: 100, h: 60 },
    { id: 'api',    kind: 'gateway', label: 'API Gateway', x: 170, y: 110, w: 130, h: 60 },
    { id: 'orders', kind: 'service', label: 'Orders',      x: 340, y: 40,  w: 120, h: 60, sub: 'v4.2.1' },
    { id: 'db',     kind: 'store',   label: 'Postgres',    x: 360, y: 180, w: 100, h: 70 },
  ],
  edges: [
    { id: 'e1', from: 'client', to: 'api',    kind: 'solid',  label: 'HTTPS' },
    { id: 'e2', from: 'api',    to: 'orders', kind: 'solid',  label: 'POST /order' },
    { id: 'e3', from: 'orders', to: 'db',     kind: 'solid',  label: 'write' },
    { id: 'e4', from: 'api',    to: 'db',     kind: 'dashed', label: 'audit' },
  ],
};

export const EXAMPLE_GRAPH_FLAT = {
  canvas: { w: 1120, h: 520, grid: 20 },
  nodes: [
    { id: 'client',    kind: 'actor',   label: 'Client',      x: 40,  y: 220, w: 150, h: 80 },
    { id: 'gateway',   kind: 'gateway', label: 'API Gateway', x: 250, y: 220, w: 170, h: 80, sub: 'auth · rate-limit' },
    { id: 'orders',    kind: 'service', label: 'Orders',      x: 490, y: 100, w: 160, h: 80, sub: 'v4.2.1' },
    { id: 'inventory', kind: 'service', label: 'Inventory',   x: 490, y: 340, w: 160, h: 80, sub: 'v2.8.0' },
    { id: 'redis',     kind: 'cache',   label: 'Redis',       x: 720, y: 40,  w: 150, h: 80 },
    { id: 'kafka',     kind: 'queue',   label: 'Events',      x: 720, y: 220, w: 160, h: 80, sub: 'kafka' },
    { id: 'db',        kind: 'store',   label: 'Postgres',    x: 720, y: 380, w: 160, h: 80 },
  ],
  edges: [
    { id: 'e1', from: 'client',  to: 'gateway',   kind: 'solid',  label: 'HTTPS' },
    { id: 'e2', from: 'gateway', to: 'orders',    kind: 'solid',  label: 'POST /order' },
    { id: 'e3', from: 'gateway', to: 'inventory', kind: 'solid',  label: 'GET /stock' },
    { id: 'e4', from: 'orders',  to: 'redis',     kind: 'dashed', label: 'cache' },
    { id: 'e5', from: 'orders',  to: 'kafka',     kind: 'solid',  label: 'publish' },
    { id: 'e6', from: 'kafka',   to: 'db',        kind: 'dashed', label: 'persist' },
  ],
  steps: [
    { id: 's1', title: 'Client request',  narration: 'User sends HTTPS request to the API Gateway.',                     active: { nodes: ['client', 'gateway'],   edges: ['e1'] } },
    { id: 's2', title: 'Order service',   narration: 'Gateway routes the order to the Orders service.',                  active: { nodes: ['gateway', 'orders'],   edges: ['e2'] } },
    { id: 's3', title: 'Cache lookup',    narration: 'Orders checks Redis for a cached response.',                       active: { nodes: ['orders', 'redis'],     edges: ['e4'] } },
    { id: 's4', title: 'Publish event',   narration: 'An order event is published to the Kafka topic.',                  active: { nodes: ['orders', 'kafka'],     edges: ['e5'] } },
    { id: 's5', title: 'Persist to DB',   narration: 'The event consumer writes the order to Postgres.',                 active: { nodes: ['kafka', 'db'],         edges: ['e6'] } },
  ],
};

export const HERO_GRAPH = {
  canvas: { w: 880, h: 540, grid: 20 },
  nodes: [
    { id: 'client',  kind: 'actor',   label: 'Client',   x: 40,  y: 230, w: 140, h: 78 },
    { id: 'gateway', kind: 'gateway', label: 'Gateway',  x: 230, y: 230, w: 160, h: 78, sub: 'edge' },
    { id: 'orders',  kind: 'service', label: 'Orders',   x: 450, y: 100, w: 160, h: 80, sub: 'v4.2.1' },
    { id: 'redis',   kind: 'cache',   label: 'Redis',    x: 680, y: 100, w: 160, h: 80 },
    { id: 'kafka',   kind: 'queue',   label: 'Events',   x: 450, y: 360, w: 160, h: 80, sub: 'kafka' },
    { id: 'db',      kind: 'store',   label: 'Postgres', x: 680, y: 360, w: 160, h: 80 },
  ],
  edges: [
    { id: 'e1', from: 'client',  to: 'gateway', kind: 'solid',  label: 'HTTPS' },
    { id: 'e2', from: 'gateway', to: 'orders',  kind: 'solid',  label: 'POST /order' },
    { id: 'e3', from: 'orders',  to: 'redis',   kind: 'dashed', label: 'cache' },
    { id: 'e4', from: 'orders',  to: 'kafka',   kind: 'solid',  label: 'publish' },
    { id: 'e5', from: 'kafka',   to: 'db',      kind: 'dashed', label: 'persist' },
  ],
  steps: [
    { id: 's1', title: 'Client request', active: { nodes: ['client', 'gateway'], edges: ['e1'] } },
    { id: 's2', title: 'Route order',    active: { nodes: ['gateway', 'orders'], edges: ['e2'] } },
    { id: 's3', title: 'Cache check',    active: { nodes: ['orders', 'redis'],   edges: ['e3'] } },
    { id: 's4', title: 'Publish event',  active: { nodes: ['orders', 'kafka'],   edges: ['e4'] } },
    { id: 's5', title: 'Persist',        active: { nodes: ['kafka', 'db'],       edges: ['e5'] } },
  ],
};

export function shapeOf(node) {
  if (node.shape) return node.shape;
  const k = NODE_KINDS[node.kind];
  return (k && k.shape) || 'rect';
}

function nodeRect(node) {
  return { x: node.x, y: node.y, w: node.w, h: node.h };
}

function anchorOn(rect, side, t) {
  const { x, y, w, h } = rect;
  switch (side) {
    case 'l': return { x,        y: y + h * t };
    case 'r': return { x: x + w, y: y + h * t };
    case 't': return { x: x + w * t, y };
    case 'b': return { x: x + w * t, y: y + h };
    default:  return { x: x + w/2, y: y + h/2 };
  }
}

function flip(side) { return { l: 'r', r: 'l', t: 'b', b: 't' }[side]; }

// Given the geometric relation of A→B, return the "best" sides for A (exit)
// and B (enter) in priority order. The enter side must face A — i.e. it is the
// opposite of the exit side, not the same one.
function sideCandidates(A, B) {
  const aCx = A.x + A.w/2, aCy = A.y + A.h/2;
  const bCx = B.x + B.w/2, bCy = B.y + B.h/2;
  const dx = bCx - aCx, dy = bCy - aCy;
  const horiz = Math.abs(dx) >= Math.abs(dy);
  const exitH  = dx >= 0 ? 'r' : 'l';
  const exitV  = dy >= 0 ? 'b' : 't';
  const enterH = dx >= 0 ? 'l' : 'r';
  const enterV = dy >= 0 ? 't' : 'b';
  if (horiz) {
    return {
      exit:  [exitH,  exitV,  flip(exitV),  flip(exitH)],
      enter: [enterH, enterV, flip(enterV), flip(enterH)],
    };
  }
  return {
    exit:  [exitV,  exitH,  flip(exitH),  flip(exitV)],
    enter: [enterV, enterH, flip(enterH), flip(enterV)],
  };
}

export function assignAnchors(nodes, edges) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const occ = {};
  const init = () => ({ in: [], out: [] });
  nodes.forEach(n => { occ[n.id] = { l: init(), r: init(), t: init(), b: init() }; });

  const anchors = {};
  edges.forEach(e => {
    anchors[e.id] = {};
    if (e.fromSide) { anchors[e.id].fromSide = e.fromSide; occ[e.from][e.fromSide].out.push(e.id); }
    if (e.toSide)   { anchors[e.id].toSide   = e.toSide;   occ[e.to][e.toSide].in.push(e.id); }
  });

  const score = (nodeId, side, role, rank) => {
    const o = occ[nodeId][side];
    const other = role === 'out' ? 'in' : 'out';
    return o[other].length * 100 + o[role].length * 4 + rank * 10;
  };

  edges.forEach(e => {
    const A = nodeRect(byId[e.from]), B = nodeRect(byId[e.to]);
    const cands = sideCandidates(A, B);
    if (!anchors[e.id].fromSide) {
      let best = cands.exit[0], bestS = Infinity;
      cands.exit.forEach((side, rank) => { const s = score(e.from, side, 'out', rank); if (s < bestS) { bestS = s; best = side; } });
      anchors[e.id].fromSide = best;
      occ[e.from][best].out.push(e.id);
    }
    if (!anchors[e.id].toSide) {
      let best = cands.enter[0], bestS = Infinity;
      cands.enter.forEach((side, rank) => { const s = score(e.to, side, 'in', rank); if (s < bestS) { bestS = s; best = side; } });
      anchors[e.id].toSide = best;
      occ[e.to][best].in.push(e.id);
    }
  });

  const edgeT = {};
  edges.forEach(e => { edgeT[e.id] = {}; });

  nodes.forEach(n => {
    ['l', 'r', 't', 'b'].forEach(side => {
      const items = [];
      occ[n.id][side].out.forEach(eid => {
        const other = byId[edges.find(e => e.id === eid).to];
        items.push({ eid, role: 'out', c: (side === 'l' || side === 'r') ? other.y + other.h/2 : other.x + other.w/2 });
      });
      occ[n.id][side].in.forEach(eid => {
        const other = byId[edges.find(e => e.id === eid).from];
        items.push({ eid, role: 'in', c: (side === 'l' || side === 'r') ? other.y + other.h/2 : other.x + other.w/2 });
      });
      items.sort((a, b) => a.c - b.c);
      items.forEach((it, i) => {
        const t = items.length === 1 ? 0.5 : (i + 1) / (items.length + 1);
        if (it.role === 'out') edgeT[it.eid].fromT = t;
        else                   edgeT[it.eid].toT = t;
      });
    });
  });

  return { anchors, edgeT };
}

export function routeEdge(fromNode, toNode, fromSide, toSide, fromT = 0.5, toT = 0.5) {
  const A = nodeRect(fromNode), B = nodeRect(toNode);
  const p0 = anchorOn(A, fromSide, fromT);
  const p3 = anchorOn(B, toSide, toT);
  const hFrom = fromSide === 'l' || fromSide === 'r';
  const hTo   = toSide   === 'l' || toSide   === 'r';
  if (hFrom && hTo) {
    const midX = (p0.x + p3.x) / 2;
    return [p0, { x: midX, y: p0.y }, { x: midX, y: p3.y }, p3];
  }
  if (!hFrom && !hTo) {
    const midY = (p0.y + p3.y) / 2;
    return [p0, { x: p0.x, y: midY }, { x: p3.x, y: midY }, p3];
  }
  if (hFrom && !hTo) return [p0, { x: p3.x, y: p0.y }, p3];
  return [p0, { x: p0.x, y: p3.y }, p3];
}

export function pathFromPoints(pts, rounded = 8) {
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i-1], cur = pts[i], next = pts[i+1];
    const v1x = Math.sign(cur.x - prev.x), v1y = Math.sign(cur.y - prev.y);
    const v2x = Math.sign(next.x - cur.x), v2y = Math.sign(next.y - cur.y);
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
export function bezierFromPoints(pts) {
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
  const c1 = horizontal
    ? { x: p0.x + Math.sign(dx) * k, y: p0.y }
    : { x: p0.x,                     y: p0.y + Math.sign(dy) * k };
  const c2 = horizontal
    ? { x: p1.x - Math.sign(dx) * k, y: p1.y }
    : { x: p1.x,                     y: p1.y - Math.sign(dy) * k };
  return `M ${p0.x} ${p0.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p1.x} ${p1.y}`;
}

// Self-loop arc rendered as a small circle anchored on the right side
// of the node. Used when an edge's `from === to`. Returns both the
// approximated points (for label placement) and the SVG path string.
export function selfLoopPath(node, side = 'r') {
  const A = nodeRect(node);
  const r = Math.min(node.h, 50) * 0.45;
  // Anchor: the chosen side of the node.
  const base = anchorOn(A, side, 0.5);
  // Place the loop center outside the node.
  let cx, cy;
  if (side === 'r') { cx = base.x + r; cy = base.y - r; }
  else if (side === 'l') { cx = base.x - r; cy = base.y - r; }
  else if (side === 't') { cx = base.x - r; cy = base.y - r; }
  else                   { cx = base.x + r; cy = base.y + r; }
  // SVG arc: full circle minus an opening at the anchor. Two arcs around
  // the circle so each renderer's marker-end terminates on the node.
  const sweep = side === 'l' || side === 'b' ? 0 : 1;
  const d = `M ${base.x} ${base.y} A ${r} ${r} 0 1 ${sweep} ${base.x + 0.001} ${base.y + 0.001}`;
  // Synthesize a small set of points for label/midpoint use.
  const pts = [
    base,
    { x: cx, y: cy - r },        // top of loop
    { x: cx + r, y: cy },        // right of loop
    { x: cx, y: cy + r },        // bottom of loop
    { x: base.x + 0.001, y: base.y + 0.001 },
  ];
  return { d, points: pts };
}

export function roughPath(pts, amp = 1.4, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const offs = () => (rnd() - 0.5) * 2 * amp;
  let d = `M ${pts[0].x + offs()} ${pts[0].y + offs()}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x + offs()} ${pts[i].y + offs()}`;
  }
  return d;
}

export function edgeMidpoint(pts) {
  if (pts.length >= 3) {
    const a = pts[Math.floor(pts.length / 2) - 1];
    const b = pts[Math.floor(pts.length / 2)];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
}

// -----------------------------------------------------------
// Auto-layout — left-to-right hierarchical flow.
// Used when any node is missing x/y. Computes node "ranks" (longest
// path from a source) and groups nodes by rank into columns. Within
// each column, distributes nodes vertically with even spacing.
// Ignores boundary nodes (they're containers and get their layout
// from their members or explicit coords).
// -----------------------------------------------------------
export function autoLayout(nodes, edges, opts = {}) {
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
  for (const n of layoutables) { inDeg[n.id] = 0; outAdj[n.id] = []; }
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
      const next = (rank[t] === undefined) ? r + 1 : Math.max(rank[t], r + 1);
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
    const yOffset = ((maxRows - colCount) * gapY) / 2;
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
  if (!nodes || nodes.length === 0) return { w: 800, h: 400 };
  let maxX = 0, maxY = 0;
  for (const n of nodes) {
    if (n.kind === 'boundary') continue;
    if (typeof n.x === 'number' && typeof n.w === 'number') maxX = Math.max(maxX, n.x + n.w);
    if (typeof n.y === 'number' && typeof n.h === 'number') maxY = Math.max(maxY, n.y + n.h);
  }
  return {
    w: Math.max(800, maxX + padding),
    h: Math.max(400, maxY + padding),
  };
}

// Register the built-in rank-based engine once. layouts/index.js
// registered dagre at load time; both engines are now available.
registerLayout('rank', autoLayout);

export function resolveGraph(graph) {
  // Apply auto-layout if ANY node is missing x or y. Mutates the input
  // nodes' x/y/w/h in place; downstream renderers can then count on them.
  const needsLayout = !graph.nodes || graph.nodes.some(
    n => n.kind !== 'boundary' && (n.x === undefined || n.y === undefined)
  );
  if (needsLayout) {
    // Engine selection: explicit `layout:` directive wins. Otherwise
    // pick dagre when the graph has edges (DAG-shaped) and rank
    // otherwise (single-column / disconnected nodes).
    const engineName = graph.layout
      || (Array.isArray(graph.edges) && graph.edges.length > 0 ? 'dagre' : 'rank');
    const engine = getLayout(engineName) || autoLayout;
    engine(graph.nodes || [], graph.edges || []);
    if (!graph.canvas || !graph.canvas.w) {
      graph = { ...graph, canvas: { ...(graph.canvas || {}), ...autoCanvas(graph.nodes) } };
    }
  }

  const byId = Object.fromEntries(graph.nodes.map(n => [n.id, n]));
  const { anchors, edgeT } = assignAnchors(graph.nodes, graph.edges);
  const edges = graph.edges.map(e => {
    // Self-loop: from === to. Skip the standard router; draw a small arc
    // anchored on the right side of the node.
    if (e.from === e.to && byId[e.from]) {
      const { d, points } = selfLoopPath(byId[e.from], 'r');
      return {
        ...e,
        fromSide: 'r', toSide: 'r',
        points,
        d,
        length: 2 * Math.PI * Math.min(byId[e.from].h, 50) * 0.45,
      };
    }

    const a = anchors[e.id];
    const t = edgeT[e.id];
    const pts = routeEdge(byId[e.from], byId[e.to], a.fromSide, a.toSide, t.fromT ?? 0.5, t.toT ?? 0.5);
    // Curve mode: 'bezier' produces a smooth path between the two endpoints
    // and discards the orthogonal waypoints. Default 'ortho' keeps the
    // existing routed path.
    const d = e.curve === 'bezier'
      ? bezierFromPoints([pts[0], pts[pts.length - 1]])
      : pathFromPoints(pts, 10);
    return {
      ...e,
      fromSide: a.fromSide, toSide: a.toSide,
      points: pts,
      d,
      length: pts.reduce((acc, p, i) => i === 0 ? 0 : acc + Math.hypot(p.x - pts[i-1].x, p.y - pts[i-1].y), 0),
    };
  });

  const sortedNodes = [...graph.nodes].sort((a, b) => {
    const bA = a.kind === 'boundary' ? 1 : 0;
    const bB = b.kind === 'boundary' ? 1 : 0;
    if (bA !== bB) return bB - bA;
    return (a.y + a.x) - (b.y + b.x);
  });

  return { ...graph, nodes: sortedNodes, edges, byId };
}
