/**
 * Graph module - legacy code adapted for ES modules
 */

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
  // --- NEW node kinds ----------------------------------------
  function:    { label: "Function",      shape: "rect",     icon: "lambda"   },
  worker:      { label: "Worker",        shape: "rect",     icon: "gear"     },
  loadbalancer:{ label: "Load Balancer", shape: "rect",     icon: "scale"    },
  cdn:         { label: "CDN",           shape: "cloud",    icon: "globe"    },
  auth:        { label: "Auth",          shape: "shield",   icon: "key"      },
  monitor:     { label: "Monitor",       shape: "rect",     icon: "chart"    },
  bus:         { label: "Event Bus",     shape: "rect",     icon: "bus"      },
  stream:      { label: "Stream",        shape: "rect",     icon: "wave"     },
  firewall:    { label: "Firewall",      shape: "rect",     icon: "wall"     },
  mobile:      { label: "Mobile",        shape: "tablet",   icon: "phone"    },
};

const SHAPES = [
  "rect", "square", "circle", "oval", "diamond", "hex", "pill", "cylinder", "cloud", "parallelogram",
  "shield", "tablet", "trapezoid", "chevron",
];

const EXAMPLE_GRAPH = {
  canvas: { w: 560, h: 280, grid: 20 },
  nodes: [
    { id: "client", kind: "actor",   label: "Client",   x: 30,  y: 110, w: 100, h: 60 },
    { id: "api",    kind: "gateway", label: "API Gateway", x: 170, y: 110, w: 130, h: 60 },
    { id: "orders", kind: "service", label: "Orders",   x: 340, y: 40,  w: 120, h: 60, sub: "v4.2.1" },
    { id: "db",     kind: "store",   label: "Postgres", x: 360, y: 180, w: 100, h: 70 },
  ],
  edges: [
    { id: "e1", from: "client", to: "api",    kind: "solid",  label: "HTTPS" },
    { id: "e2", from: "api",    to: "orders", kind: "solid",  label: "POST /order" },
    { id: "e3", from: "orders", to: "db",     kind: "solid",  label: "write" },
    { id: "e4", from: "api",    to: "db",     kind: "dashed", label: "audit" },
  ],
};

const EXAMPLE_GRAPH_FLAT = {
  canvas: { w: 1120, h: 520, grid: 20 },
  nodes: [
    { id: "client",    kind: "actor",   label: "Client",      x: 40,   y: 220, w: 150, h: 80 },
    { id: "gateway",   kind: "gateway", label: "API Gateway", x: 250,  y: 220, w: 170, h: 80, sub: "edge" },
    { id: "orders",    kind: "service", label: "Orders",      x: 490,  y: 100, w: 160, h: 80, sub: "v4.2.1" },
    { id: "inventory", kind: "service", label: "Inventory",   x: 490,  y: 340, w: 160, h: 80, sub: "v2.8.0" },
    { id: "redis",     kind: "cache",   label: "Redis",       x: 720,  y: 40,  w: 150, h: 80 },
    { id: "kafka",     kind: "queue",   label: "Events",      x: 450,  y: 360, w: 160, h: 80, sub: "kafka" },
    { id: "db",        kind: "store",   label: "Postgres",    x: 680,  y: 360, w: 160, h: 80 },
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

export { NODE_KINDS, SHAPES, EXAMPLE_GRAPH, EXAMPLE_GRAPH_FLAT, HERO_GRAPH }

function nodeRect(node) {
  return { x: node.x, y: node.y, w: node.w, h: node.h }
}

function anchorOn(rect, side, t) {
  const { x, y, w, h } = rect
  switch (side) {
    case 'l': return { x, y: y + h * t }
    case 'r': return { x: x + w, y: y + h * t }
    case 't': return { x: x + w * t, y }
    case 'b': return { x: x + w * t, y: y + h }
    default: return { x: x + w/2, y: y + h/2 }
  }
}

function sideCandidates(A, B) {
  const dx = B.x + B.w/2 - (A.x + A.w/2)
  const dy = B.y + B.h/2 - (A.y + A.h/2)
  const candidates = {
    exit: [],
    enter: [],
  }
  const sides = [
    { s: dx >= 0 ? 'r' : 'l', r: Math.abs(dx) / (Math.abs(dx) + Math.abs(dy)) },
    { s: dy >= 0 ? 'b' : 't', r: Math.abs(dy) / (Math.abs(dx) + Math.abs(dy)) },
  ]
  sides.sort((a, b) => b.r - a.r)
  candidates.exit = sides.map(s => s.s)
  candidates.enter = sides.map(s => s.s)
  return candidates
}

const MINI_GRAPH = EXAMPLE_GRAPH

export { routeEdge, pathFromPoints, roughPath, resolveGraph, nodeRect, anchorOn, shapeOf, assignAnchors, MINI_GRAPH }

// Shape functions
export function shapePath(shape, w, h) {
  switch (shape) {
    case "rect":   return { d: `M0 0 H${w} V${h} H0 Z`, cx: w/2, cy: h/2, rx: 10 }
    case "square": {
      const s = Math.min(w, h)
      const ox = (w - s) / 2, oy = (h - s) / 2
      return { d: `M${ox} ${oy} h${s} v${s} h${-s} z`, cx: w/2, cy: h/2, rx: 4 }
    }
    case "circle": {
      const r = Math.min(w, h) / 2
      return { d: `M${w/2 - r} ${h/2} a${r} ${r} 0 1 0 ${r*2} 0 a${r} ${r} 0 1 0 ${-r*2} 0`, cx: w/2, cy: h/2, circle: { cx: w/2, cy: h/2, r } }
    }
    case "oval":   return { d: `M0 ${h/2} a${w/2} ${h/2} 0 1 0 ${w} 0 a${w/2} ${h/2} 0 1 0 ${-w} 0`, cx: w/2, cy: h/2, ellipse: { cx: w/2, cy: h/2, rx: w/2, ry: h/2 } }
    case "diamond":return { d: `M${w/2} 0 L${w} ${h/2} L${w/2} ${h} L0 ${h/2} Z`, cx: w/2, cy: h/2 }
    case "hex": {
      const i = Math.min(w * 0.18, 18)
      return { d: `M${i} 0 L${w-i} 0 L${w} ${h/2} L${w-i} ${h} L${i} ${h} L0 ${h/2} Z`, cx: w/2, cy: h/2 }
    }
    case "pill": {
      const r = h / 2
      return { d: `M${r} 0 H${w-r} A${r} ${r} 0 0 1 ${w-r} ${h} H${r} A${r} ${r} 0 0 1 ${r} 0 Z`, cx: w/2, cy: h/2, rx: r }
    }
    case "cylinder": {
      const ry = 7
      return {
        d: `M0 ${ry} a${w/2} ${ry} 0 1 0 ${w} 0 a${w/2} ${ry} 0 1 0 ${-w} 0 M0 ${ry} V${h-ry} a${w/2} ${ry} 0 0 0 ${w} 0 V${ry}`,
        top: `M0 ${ry} a${w/2} ${ry} 0 1 0 ${w} 0 a${w/2} ${ry} 0 1 0 ${-w} 0`,
        body: `M0 ${ry} V${h-ry} a${w/2} ${ry} 0 0 0 ${w} 0 V${ry}`,
        cx: w/2, cy: h/2 + ry/2,
      }
    }
    case "cloud": {
      return { d: `M${w*0.18} ${h*0.55} C ${w*0.02} ${h*0.55}, ${w*0.02} ${h*0.15}, ${w*0.22} ${h*0.22} C ${w*0.28} ${h*0.02}, ${w*0.6} ${h*0.02}, ${w*0.62} ${h*0.22} C ${w*0.82} ${h*0.15}, ${w*0.98} ${h*0.3}, ${w*0.9} ${h*0.55} C ${w*0.98} ${h*0.75}, ${w*0.78} ${h*0.95}, ${w*0.6} ${h*0.85} C ${w*0.4} ${h*1.02}, ${w*0.1} ${h*0.95}, ${w*0.18} ${h*0.55} Z`, cx: w/2, cy: h/2 }
    }
    case "parallelogram": {
      const skew = 14
      return { d: `M${skew} 0 H${w} L${w-skew} ${h} H0 Z`, cx: w/2, cy: h/2 }
    }
    case "shield": {
      const r = Math.min(w * 0.18, 14)
      return {
        d: `M${r} 0 H${w-r} Q${w} 0 ${w} ${r} V${h*0.55} Q${w} ${h*0.85} ${w/2} ${h} Q0 ${h*0.85} 0 ${h*0.55} V${r} Q0 0 ${r} 0 Z`,
        cx: w/2, cy: h/2,
      }
    }
    case "tablet": {
      const r = Math.min(w, h) * 0.18
      return { d: `M${r} 0 H${w-r} Q${w} 0 ${w} ${r} V${h-r} Q${w} ${h} ${w-r} ${h} H${r} Q0 ${h} 0 ${h-r} V${r} Q0 0 ${r} 0 Z`, cx: w/2, cy: h/2, rx: r }
    }
    case "trapezoid": {
      const i = Math.min(w * 0.16, 18)
      return { d: `M${i} 0 H${w-i} L${w} ${h} H0 Z`, cx: w/2, cy: h/2 }
    }
    case "chevron": {
      const a = Math.min(w * 0.12, 14)
      return { d: `M0 0 H${w-a} L${w} ${h/2} L${w-a} ${h} H0 L${a} ${h/2} Z`, cx: w/2, cy: h/2 }
    }
    default:
      return { d: `M0 0 H${w} V${h} H0 Z`, cx: w/2, cy: h/2, rx: 10 }
  }
}

function shapeOf(node) {
  if (node.shape) return node.shape
  const k = NODE_KINDS[node.kind]
  return (k && k.shape) || "rect"
}

function assignAnchors(nodes, edges) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
  const occ = {}
  const init = () => ({ in: [], out: [] })
  nodes.forEach(n => { occ[n.id] = { l: init(), r: init(), t: init(), b: init() } })

  const anchors = {}

  edges.forEach(e => {
    anchors[e.id] = {}
    if (e.fromSide) { anchors[e.id].fromSide = e.fromSide; occ[e.from][e.fromSide].out.push(e.id) }
    if (e.toSide)   { anchors[e.id].toSide   = e.toSide;   occ[e.to][e.toSide].in.push(e.id) }
  })

  const score = (nodeId, side, role, naturalRank) => {
    const o = occ[nodeId][side]
    const otherRole = role === "out" ? "in" : "out"
    let s = 0
    s += o[otherRole].length * 100
    s += o[role].length * 4
    s += naturalRank * 10
    return s
  }

  edges.forEach(e => {
    const A = nodeRect(byId[e.from]), B = nodeRect(byId[e.to])
    const cands = sideCandidates(A, B)
    if (!anchors[e.id].fromSide) {
      let best = cands.exit[0], bestScore = Infinity
      cands.exit.forEach((side, rank) => {
        const s = score(e.from, side, "out", rank)
        if (s < bestScore) { bestScore = s; best = side }
      })
      anchors[e.id].fromSide = best
      occ[e.from][best].out.push(e.id)
    }
    if (!anchors[e.id].toSide) {
      let best = cands.enter[0], bestScore = Infinity
      cands.enter.forEach((side, rank) => {
        const s = score(e.to, side, "in", rank)
        if (s < bestScore) { bestScore = s; best = side }
      })
      anchors[e.id].toSide = best
      occ[e.to][best].in.push(e.id)
    }
  })

  const edgeT = {}
  edges.forEach(e => { edgeT[e.id] = {} })

  nodes.forEach(n => {
    ["l", "r", "t", "b"].forEach(side => {
      const items = []
      occ[n.id][side].out.forEach(eid => {
        const other = byId[edges.find(e => e.id === eid).to]
        items.push({ eid, role: "out", c: side === "l" || side === "r" ? other.y + other.h/2 : other.x + other.w/2 })
      })
      occ[n.id][side].in.forEach(eid => {
        const other = byId[edges.find(e => e.id === eid).from]
        items.push({ eid, role: "in", c: side === "l" || side === "r" ? other.y + other.h/2 : other.x + other.w/2 })
      })
      items.sort((a, b) => a.c - b.c)
      items.forEach((it, i) => {
        const t = items.length === 1 ? 0.5 : (i + 1) / (items.length + 1)
        if (it.role === "out") edgeT[it.eid].fromT = t
        else                   edgeT[it.eid].toT = t
      })
    })
  })

  return { anchors, edgeT }
}

function routeEdge(fromNode, toNode, fromSide, toSide, fromT = 0.5, toT = 0.5) {
  const A = nodeRect(fromNode), B = nodeRect(toNode)
  const p0 = anchorOn(A, fromSide, fromT), p3 = anchorOn(B, toSide, toT)

  const hFrom = fromSide === "l" || fromSide === "r"
  const hTo   = toSide   === "l" || toSide   === "r"

  if (hFrom && hTo) {
    const midX = (p0.x + p3.x) / 2
    return [p0, { x: midX, y: p0.y }, { x: midX, y: p3.y }, p3]
  }
  if (!hFrom && !hTo) {
    const midY = (p0.y + p3.y) / 2
    return [p0, { x: p0.x, y: midY }, { x: p3.x, y: midY }, p3]
  }
  if (hFrom && !hTo) {
    return [p0, { x: p3.x, y: p0.y }, p3]
  }
  return [p0, { x: p0.x, y: p3.y }, p3]
}

function pathFromPoints(pts, rounded = 8) {
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i-1], cur = pts[i], next = pts[i+1]
    const v1x = Math.sign(cur.x - prev.x), v1y = Math.sign(cur.y - prev.y)
    const v2x = Math.sign(next.x - cur.x), v2y = Math.sign(next.y - cur.y)
    const r = rounded
    const px = cur.x - v1x * r, py = cur.y - v1y * r
    const qx = cur.x + v2x * r, qy = cur.y + v2y * r
    d += ` L ${px} ${py} Q ${cur.x} ${cur.y} ${qx} ${qy}`
  }
  const last = pts[pts.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

function roughPath(pts, amp = 1.4, seed = 7) {
  let s = seed
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  const offs = () => (rnd() - 0.5) * 2 * amp
  let d = `M ${pts[0].x + offs()} ${pts[0].y + offs()}`
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]
    d += ` L ${p.x + offs()} ${p.y + offs()}`
  }
  return d
}

function resolveGraph(graph) {
  const byId = Object.fromEntries(graph.nodes.map(n => [n.id, n]))
  const { anchors, edgeT } = assignAnchors(graph.nodes, graph.edges)
  const edges = graph.edges.map(e => {
    const a = anchors[e.id]
    const t = edgeT[e.id]
    const pts = routeEdge(byId[e.from], byId[e.to], a.fromSide, a.toSide, t.fromT, t.toT)
    return {
      ...e,
      fromSide: a.fromSide, toSide: a.toSide,
      points: pts,
      d: pathFromPoints(pts, 10),
      length: pts.reduce((acc, p, i) => i === 0 ? 0 : acc + Math.hypot(p.x - pts[i-1].x, p.y - pts[i-1].y), 0),
    }
  })

  const sortedNodes = [...graph.nodes].sort((a, b) => {
    const isBoundaryA = a.kind === "boundary" ? 1 : 0
    const isBoundaryB = b.kind === "boundary" ? 1 : 0
    if (isBoundaryA !== isBoundaryB) return isBoundaryB - isBoundaryA
    return (a.y + a.x) - (b.y + b.x)
  })

  return { ...graph, nodes: sortedNodes, edges, byId }
}
