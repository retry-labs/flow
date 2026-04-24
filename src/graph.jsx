// -----------------------------------------------------------
// Graph IR — the shared data model all styles render from.
// -----------------------------------------------------------
// A diagram is: { nodes, edges, steps, canvas }
// - node.kind drives which renderer shape is used
// - edge.path is computed from node positions (orthogonal router)
// - step.highlight marks nodes + edges active at each step
// -----------------------------------------------------------

// Node "kind" drives semantics (what it MEANS in the diagram).
// Node "shape" drives geometry (what it LOOKS like — overridable per node).
// If shape is omitted, we default from the kind.
const NODE_KINDS = {
  // System / architecture kinds
  service: { label: "Service",   shape: "rect",     icon: "square"   },
  store:   { label: "Database",  shape: "cylinder", icon: "cylinder" },
  cache:   { label: "Cache",     shape: "rect",     icon: "disk"     },
  queue:   { label: "Queue",     shape: "rect",     icon: "stack"    },
  actor:   { label: "Client",    shape: "rect",     icon: "person"   },
  gateway: { label: "Gateway",   shape: "hex",      icon: "diamond"  },
  external:{ label: "External",  shape: "cloud",    icon: "cloud"    },
  boundary:{ label: "Boundary",  shape: "rect",     icon: "group"    },
  // Flowchart / process kinds
  start:   { label: "Start",     shape: "pill",     icon: "play"      },
  stop:    { label: "Stop",      shape: "pill",     icon: "square"      },
  decision:{ label: "Decision",  shape: "diamond",  icon: "qmark"    },
  process: { label: "Process",   shape: "square",   icon: "cog"      },
  event:   { label: "Event",     shape: "circle",   icon: "bolt"     },
  step:    { label: "Step",      shape: "oval",     icon: "dot"      },
  tree:    { label: "Tree node", shape: "circle",   icon: "dot"      },
  // Media
  image:   { label: "Logo",      shape: "rect",     icon: "image"    },
};

// All supported geometric shapes (the shape layer — decoupled from kind).
const SHAPES = [
  "rect", "square", "circle", "oval", "diamond", "hex", "pill", "cylinder", "cloud", "parallelogram",
];

// -----------------------------------------------------------
// A tighter, square-ish graph for the hero slot (~16:10). Same
// visual vocabulary as the Player, but condensed: one clear request
// fan-out with cache + queue + store visible at a glance.
const HERO_GRAPH = {
  canvas: { w: 880, h: 540, grid: 20 },
  nodes: [
    { id: "client",  kind: "actor",   label: "Client",   x: 40,  y: 230, w: 140, h: 78 },
    { id: "gateway", kind: "gateway", label: "Gateway",  x: 230, y: 230, w: 160, h: 78, sub: "edge" },
    { id: "orders",  kind: "service", label: "Orders",   x: 450, y: 100, w: 160, h: 80, sub: "v4.2.1" },
    { id: "redis",   kind: "cache",   label: "Redis",    x: 680, y: 100, w: 160, h: 80 },
    { id: "kafka",   kind: "queue",   label: "Events",   x: 450, y: 360, w: 160, h: 80, sub: "kafka" },
    { id: "db",      kind: "store",   label: "Postgres", x: 680, y: 360, w: 160, h: 80 },
  ],
  edges: [
    { id: "e1", from: "client",  to: "gateway", kind: "solid",  label: "HTTPS" },
    { id: "e2", from: "gateway", to: "orders",  kind: "solid",  label: "POST /order" },
    { id: "e3", from: "orders",  to: "redis",   kind: "dashed", label: "cache" },
    { id: "e4", from: "orders",  to: "kafka",   kind: "solid",  label: "publish" },
    { id: "e5", from: "kafka",   to: "db",      kind: "dashed", label: "persist" },
  ],
  steps: [
    { id: "s1", active: { nodes: ["client", "gateway"], edges: ["e1"] } },
    { id: "s2", active: { nodes: ["gateway", "orders"], edges: ["e2"] } },
    { id: "s3", active: { nodes: ["orders", "redis"], edges: ["e3"] } },
    { id: "s4", active: { nodes: ["orders", "kafka"], edges: ["e4"] } },
    { id: "s5", active: { nodes: ["kafka", "db"], edges: ["e5"] } },
  ],
};

// The canonical hero diagram — a checkout request fanning through
// a small system. Designed tight: short edges, no dead space, every
// node earns its place. Used by the Hero + Player.
// Layout (12-col grid, 110px gutter):
//   col 0:  client
//   col 2:  gateway
//   col 4:  orders   (top), inventory (bottom)
//   col 6:  redis (top),  postgres (mid), kafka (bottom)
//   col 8:  audit
// -----------------------------------------------------------
const EXAMPLE_GRAPH_FLAT = {
  canvas: { w: 1120, h: 520, grid: 20 },
  nodes: [
    { id: "client",    kind: "actor",   label: "Client",      x: 40,   y: 220, w: 150, h: 80 },
    { id: "gateway",   kind: "gateway", label: "API Gateway", x: 250,  y: 220, w: 170, h: 80, sub: "auth · rate-limit" },
    { id: "orders",    kind: "service", label: "Orders",      x: 490,  y: 100, w: 160, h: 80, sub: "v4.2.1" },
    { id: "inventory", kind: "service", label: "Inventory",   x: 490,  y: 340, w: 160, h: 80, sub: "v2.8.0" },
    { id: "redis",     kind: "cache",   label: "Redis",       x: 720,  y: 40,  w: 150, h: 80 },
    { id: "kafka",     kind: "queue",   label: "Events",      x: 720,  y: 220, w: 150, h: 80, sub: "kafka" },
    { id: "postgres",  kind: "store",   label: "Postgres",    x: 720,  y: 400, w: 150, h: 80 },
    { id: "audit",     kind: "service", label: "Audit",       x: 940,  y: 340, w: 150, h: 80, sub: "consumer" },
  ],
  edges: [
    { id: "e1", from: "client",    to: "gateway",   kind: "solid",  label: "HTTPS" },
    { id: "e2", from: "gateway",   to: "orders",    kind: "solid",  label: "POST /order" },
    { id: "e3", from: "gateway",   to: "inventory", kind: "solid",  label: "GET /stock" },
    { id: "e4", from: "orders",    to: "redis",     kind: "dashed", label: "read" },
    { id: "e5", from: "orders",    to: "kafka",     kind: "solid",  label: "publish" },
    { id: "e6", from: "inventory", to: "postgres",  kind: "solid",  label: "query" },
    { id: "e7", from: "kafka",     to: "audit",     kind: "dashed", label: "consume" },
  ],
  steps: [
    { id: "s1", title: "Client sends request",
      narration: "A browser issues an HTTPS request to the gateway.",
      active: { nodes: ["client", "gateway"], edges: ["e1"] } },
    { id: "s2", title: "Gateway fans out",
      narration: "JWT is verified, rate-limit counter ticks, request routes to Orders and Inventory.",
      active: { nodes: ["gateway", "orders", "inventory"], edges: ["e2", "e3"] } },
    { id: "s3", title: "Services read their stores",
      narration: "Orders checks Redis for the cart; Inventory queries Postgres for stock.",
      active: { nodes: ["orders", "inventory", "redis", "postgres"], edges: ["e4", "e6"] } },
    { id: "s4", title: "Order published",
      narration: "A domain event is published to Kafka — downstream consumers take it from here.",
      active: { nodes: ["orders", "kafka"], edges: ["e5"] } },
    { id: "s5", title: "Event persisted",
      narration: "The audit consumer picks up the event for replay and analytics.",
      active: { nodes: ["kafka", "audit"], edges: ["e7"] } },
  ],
};

// Isometric variant — same topology, scaled up so claymorphic blocks
// have room to breathe. Used by the "city" style.
const EXAMPLE_GRAPH = {
  canvas: { w: 1600, h: 760, grid: 20 },
  nodes: EXAMPLE_GRAPH_FLAT.nodes.map(n => ({
    ...n,
    x: Math.round(n.x * 1.42) + 20,
    y: Math.round(n.y * 1.42) + 20,
    w: Math.round(n.w * 1.1),
    h: Math.round(n.h * 1.1),
  })),
  edges: EXAMPLE_GRAPH_FLAT.edges,
  steps: EXAMPLE_GRAPH_FLAT.steps,
};

// A couple of smaller sample graphs for the style showcase.
const MINI_GRAPH = {
  canvas: { w: 520, h: 320, grid: 16 },
  nodes: [
    { id: "a", kind: "actor",   label: "User",    x: 40,  y: 130, w: 100, h: 60 },
    { id: "b", kind: "gateway", label: "API",     x: 190, y: 130, w: 100, h: 60 },
    { id: "c", kind: "service", label: "Worker",  x: 340, y: 60,  w: 120, h: 64 },
    { id: "d", kind: "store",   label: "DB",      x: 360, y: 200, w: 90,  h: 70 },
  ],
  edges: [
    { id: "e1", from: "a", to: "b", kind: "solid",  label: "req" },
    { id: "e2", from: "b", to: "c", kind: "solid",  label: "enqueue" },
    { id: "e3", from: "b", to: "d", kind: "dashed", label: "log" },
    { id: "e4", from: "c", to: "d", kind: "solid",  label: "write" },
  ],
};

// -----------------------------------------------------------
// Orthogonal edge router — simple L/Z routing between node
// edges. Good enough for the showcase; deliberately not A*.
// -----------------------------------------------------------

function nodeRect(n) { return { x: n.x, y: n.y, w: n.w, h: n.h, cx: n.x + n.w/2, cy: n.y + n.h/2 }; }

// Anchor with a t=[0..1] offset along the side's length, so multiple edges
// sharing a side don't stack on the same point.
function anchorOn(rect, side, t = 0.5) {
  const tt = Math.max(0.15, Math.min(0.85, t)); // keep anchors away from rounded corners
  switch (side) {
    case "l": return { x: rect.x,           y: rect.y + rect.h * tt };
    case "r": return { x: rect.x + rect.w,  y: rect.y + rect.h * tt };
    case "t": return { x: rect.x + rect.w * tt, y: rect.y };
    case "b": return { x: rect.x + rect.w * tt, y: rect.y + rect.h };
  }
}

// Given the geometric relation of A→B, return the "best" sides for A (exit) and B (enter)
// in priority order. Used by the global anchor assignment below.
function sideCandidates(a, b) {
  const dx = b.cx - a.cx, dy = b.cy - a.cy;
  const horiz = Math.abs(dx) >= Math.abs(dy);
  const exitH = dx >= 0 ? "r" : "l";
  const exitV = dy >= 0 ? "b" : "t";
  const enterH = dx >= 0 ? "l" : "r";
  const enterV = dy >= 0 ? "t" : "b";
  if (horiz) {
    return { exit: [exitH, exitV, flip(exitV), flip(exitH)], enter: [enterH, enterV, flip(enterV), flip(enterH)] };
  }
  return { exit: [exitV, exitH, flip(exitH), flip(exitV)], enter: [enterV, enterH, flip(enterH), flip(enterV)] };
}

function flip(side) { return { l: "r", r: "l", t: "b", b: "t" }[side]; }

// -----------------------------------------------------------
// Global anchor assignment: before routing, decide which side of
// each node every edge attaches to, preferring sides that are
// NOT already occupied in the opposite role. Distribute multiple
// edges on the same side along the side's length (t offsets).
// -----------------------------------------------------------
function assignAnchors(nodes, edges) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  // Per node: { l: {in: [...edgeIds], out: [...] }, ... }
  const occ = {};
  const init = () => ({ in: [], out: [] });
  nodes.forEach(n => { occ[n.id] = { l: init(), r: init(), t: init(), b: init() }; });

  const anchors = {}; // edgeId → { fromSide, toSide }

  // Pass 1: honor explicit side hints on edges (edge.fromSide / edge.toSide)
  edges.forEach(e => {
    anchors[e.id] = {};
    if (e.fromSide) { anchors[e.id].fromSide = e.fromSide; occ[e.from][e.fromSide].out.push(e.id); }
    if (e.toSide)   { anchors[e.id].toSide   = e.toSide;   occ[e.to][e.toSide].in.push(e.id); }
  });

  // Pass 2: pick sides for unspecified edges. Score each candidate side:
  //   - heavy penalty if the opposite role already uses that side
  //   - light penalty per existing edge in the same role on that side
  //   - small bonus for the "natural" direction
  const score = (nodeId, side, role, naturalRank) => {
    const o = occ[nodeId][side];
    const otherRole = role === "out" ? "in" : "out";
    let s = 0;
    s += o[otherRole].length * 100; // avoid mixing in+out on same side
    s += o[role].length * 4;        // mild spread
    s += naturalRank * 10;          // prefer the geometrically natural side
    return s;
  };

  edges.forEach(e => {
    const A = nodeRect(byId[e.from]), B = nodeRect(byId[e.to]);
    const cands = sideCandidates(A, B);
    if (!anchors[e.id].fromSide) {
      let best = cands.exit[0], bestScore = Infinity;
      cands.exit.forEach((side, rank) => {
        const s = score(e.from, side, "out", rank);
        if (s < bestScore) { bestScore = s; best = side; }
      });
      anchors[e.id].fromSide = best;
      occ[e.from][best].out.push(e.id);
    }
    if (!anchors[e.id].toSide) {
      let best = cands.enter[0], bestScore = Infinity;
      cands.enter.forEach((side, rank) => {
        const s = score(e.to, side, "in", rank);
        if (s < bestScore) { bestScore = s; best = side; }
      });
      anchors[e.id].toSide = best;
      occ[e.to][best].in.push(e.id);
    }
  });

  // Pass 3: compute a t-offset for every edge on each side.
  // Merge in + out queues on the same side, sorted along the side by the
  // "other endpoint" coordinate so lines don't cross each other.
  const edgeT = {}; // edgeId → { fromT, toT }
  edges.forEach(e => { edgeT[e.id] = {}; });

  nodes.forEach(n => {
    ["l", "r", "t", "b"].forEach(side => {
      const items = [];
      occ[n.id][side].out.forEach(eid => {
        const other = byId[edges.find(e => e.id === eid).to];
        items.push({ eid, role: "out", c: side === "l" || side === "r" ? other.y + other.h/2 : other.x + other.w/2 });
      });
      occ[n.id][side].in.forEach(eid => {
        const other = byId[edges.find(e => e.id === eid).from];
        items.push({ eid, role: "in", c: side === "l" || side === "r" ? other.y + other.h/2 : other.x + other.w/2 });
      });
      items.sort((a, b) => a.c - b.c);
      items.forEach((it, i) => {
        const t = items.length === 1 ? 0.5 : (i + 1) / (items.length + 1);
        if (it.role === "out") edgeT[it.eid].fromT = t;
        else                   edgeT[it.eid].toT = t;
      });
    });
  });

  return { anchors, edgeT };
}

function routeEdge(fromNode, toNode, fromSide, toSide, fromT = 0.5, toT = 0.5) {
  const A = nodeRect(fromNode), B = nodeRect(toNode);
  const p0 = anchorOn(A, fromSide, fromT), p3 = anchorOn(B, toSide, toT);

  // If exiting/entering on horizontal sides, do H→V→H (Z route)
  const hFrom = fromSide === "l" || fromSide === "r";
  const hTo   = toSide   === "l" || toSide   === "r";

  if (hFrom && hTo) {
    const midX = (p0.x + p3.x) / 2;
    return [p0, { x: midX, y: p0.y }, { x: midX, y: p3.y }, p3];
  }
  if (!hFrom && !hTo) {
    const midY = (p0.y + p3.y) / 2;
    return [p0, { x: p0.x, y: midY }, { x: p3.x, y: midY }, p3];
  }
  // Mixed: L-route. Exit direction determines first leg orientation.
  if (hFrom && !hTo) {
    // horizontal first leg, then vertical
    return [p0, { x: p3.x, y: p0.y }, p3];
  }
  // vertical first leg, then horizontal
  return [p0, { x: p0.x, y: p3.y }, p3];
}

function pathFromPoints(pts, rounded = 8) {
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i-1], cur = pts[i], next = pts[i+1];
    const v1x = Math.sign(cur.x - prev.x), v1y = Math.sign(cur.y - prev.y);
    const v2x = Math.sign(next.x - cur.x), v2y = Math.sign(next.y - cur.y);
    const r = rounded;
    const px = cur.x - v1x * r, py = cur.y - v1y * r;
    const qx = cur.x + v2x * r, qy = cur.y + v2y * r;
    d += ` L ${px} ${py} Q ${cur.x} ${cur.y} ${qx} ${qy}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

// Rough (sketchy) path for hand-drawn style — adds jitter along the line.
function roughPath(pts, amp = 1.4, seed = 7) {
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const offs = () => (rnd() - 0.5) * 2 * amp;
  let d = `M ${pts[0].x + offs()} ${pts[0].y + offs()}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    d += ` L ${p.x + offs()} ${p.y + offs()}`;
  }
  return d;
}

// Resolve a graph: compute edge paths, anchor info.
function resolveGraph(graph) {
  const byId = Object.fromEntries(graph.nodes.map(n => [n.id, n]));
  const { anchors, edgeT } = assignAnchors(graph.nodes, graph.edges);
  const edges = graph.edges.map(e => {
    const a = anchors[e.id];
    const t = edgeT[e.id];
    const pts = routeEdge(byId[e.from], byId[e.to], a.fromSide, a.toSide, t.fromT, t.toT);
    return {
      ...e,
      fromSide: a.fromSide, toSide: a.toSide,
      points: pts,
      d: pathFromPoints(pts, 10),
      length: pts.reduce((acc, p, i) => i === 0 ? 0 : acc + Math.hypot(p.x - pts[i-1].x, p.y - pts[i-1].y), 0),
    };
  });
  
  // Sort nodes for correct isometric rendering order:
  // 1. "boundary" (groups/containers) first.
  // 2. Others sorted by depth (y + x) to ensure back-to-front rendering.
  const sortedNodes = [...graph.nodes].sort((a, b) => {
    const isBoundaryA = a.kind === "boundary" ? 1 : 0;
    const isBoundaryB = b.kind === "boundary" ? 1 : 0;
    if (isBoundaryA !== isBoundaryB) return isBoundaryB - isBoundaryA;
    return (a.y + a.x) - (b.y + b.x);
  });

  return { ...graph, nodes: sortedNodes, edges, byId };
}

window.Flow = Object.assign(window.Flow || {}, {
  NODE_KINDS, SHAPES, EXAMPLE_GRAPH, EXAMPLE_GRAPH_FLAT, HERO_GRAPH, MINI_GRAPH,
  routeEdge, pathFromPoints, roughPath, resolveGraph, nodeRect, anchorOn,
  shapeOf,
});

// Resolve what shape a node actually uses — explicit `shape` wins, else kind default.
function shapeOf(node) {
  if (node.shape) return node.shape;
  const k = NODE_KINDS[node.kind];
  return (k && k.shape) || "rect";
}
