'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var React = require('react');
var vue = require('vue');

/**
 * Graph module - legacy code adapted for ES modules
 */

const NODE_KINDS$1 = {
  // System / architecture kinds
  service: {
    label: "Service",
    shape: "rect",
    icon: "square"
  },
  store: {
    label: "Database",
    shape: "cylinder",
    icon: "cylinder"
  },
  cache: {
    label: "Cache",
    shape: "rect",
    icon: "disk"
  },
  queue: {
    label: "Queue",
    shape: "rect",
    icon: "stack"
  },
  actor: {
    label: "Client",
    shape: "rect",
    icon: "person"
  },
  gateway: {
    label: "Gateway",
    shape: "hex",
    icon: "diamond"
  },
  external: {
    label: "External",
    shape: "cloud",
    icon: "cloud"
  },
  boundary: {
    label: "Boundary",
    shape: "rect",
    icon: "group"
  },
  // Flowchart / process kinds
  start: {
    label: "Start",
    shape: "pill",
    icon: "play"
  },
  stop: {
    label: "Stop",
    shape: "pill",
    icon: "square"
  },
  decision: {
    label: "Decision",
    shape: "diamond",
    icon: "qmark"
  },
  process: {
    label: "Process",
    shape: "square",
    icon: "cog"
  },
  event: {
    label: "Event",
    shape: "circle",
    icon: "bolt"
  },
  step: {
    label: "Step",
    shape: "oval",
    icon: "dot"
  },
  tree: {
    label: "Tree node",
    shape: "circle",
    icon: "dot"
  },
  // Media
  image: {
    label: "Logo",
    shape: "rect",
    icon: "image"
  },
  // --- NEW node kinds ----------------------------------------
  function: {
    label: "Function",
    shape: "rect",
    icon: "lambda"
  },
  worker: {
    label: "Worker",
    shape: "rect",
    icon: "gear"
  },
  loadbalancer: {
    label: "Load Balancer",
    shape: "rect",
    icon: "scale"
  },
  cdn: {
    label: "CDN",
    shape: "cloud",
    icon: "globe"
  },
  auth: {
    label: "Auth",
    shape: "shield",
    icon: "key"
  },
  monitor: {
    label: "Monitor",
    shape: "rect",
    icon: "chart"
  },
  bus: {
    label: "Event Bus",
    shape: "rect",
    icon: "bus"
  },
  stream: {
    label: "Stream",
    shape: "rect",
    icon: "wave"
  },
  firewall: {
    label: "Firewall",
    shape: "rect",
    icon: "wall"
  },
  mobile: {
    label: "Mobile",
    shape: "tablet",
    icon: "phone"
  }
};
const SHAPES$1 = ["rect", "square", "circle", "oval", "diamond", "hex", "pill", "cylinder", "cloud", "parallelogram", "shield", "tablet", "trapezoid", "chevron"];
const EXAMPLE_GRAPH$1 = {
  canvas: {
    w: 560,
    h: 280,
    grid: 20
  },
  nodes: [{
    id: "client",
    kind: "actor",
    label: "Client",
    x: 30,
    y: 110,
    w: 100,
    h: 60
  }, {
    id: "api",
    kind: "gateway",
    label: "API Gateway",
    x: 170,
    y: 110,
    w: 130,
    h: 60
  }, {
    id: "orders",
    kind: "service",
    label: "Orders",
    x: 340,
    y: 40,
    w: 120,
    h: 60,
    sub: "v4.2.1"
  }, {
    id: "db",
    kind: "store",
    label: "Postgres",
    x: 360,
    y: 180,
    w: 100,
    h: 70
  }],
  edges: [{
    id: "e1",
    from: "client",
    to: "api",
    kind: "solid",
    label: "HTTPS"
  }, {
    id: "e2",
    from: "api",
    to: "orders",
    kind: "solid",
    label: "POST /order"
  }, {
    id: "e3",
    from: "orders",
    to: "db",
    kind: "solid",
    label: "write"
  }, {
    id: "e4",
    from: "api",
    to: "db",
    kind: "dashed",
    label: "audit"
  }]
};
const EXAMPLE_GRAPH_FLAT$1 = {
  canvas: {
    w: 1120,
    h: 520,
    grid: 20
  },
  nodes: [{
    id: "client",
    kind: "actor",
    label: "Client",
    x: 40,
    y: 220,
    w: 150,
    h: 80
  }, {
    id: "gateway",
    kind: "gateway",
    label: "API Gateway",
    x: 250,
    y: 220,
    w: 170,
    h: 80,
    sub: "edge"
  }, {
    id: "orders",
    kind: "service",
    label: "Orders",
    x: 490,
    y: 100,
    w: 160,
    h: 80,
    sub: "v4.2.1"
  }, {
    id: "inventory",
    kind: "service",
    label: "Inventory",
    x: 490,
    y: 340,
    w: 160,
    h: 80,
    sub: "v2.8.0"
  }, {
    id: "redis",
    kind: "cache",
    label: "Redis",
    x: 720,
    y: 40,
    w: 150,
    h: 80
  }, {
    id: "kafka",
    kind: "queue",
    label: "Events",
    x: 450,
    y: 360,
    w: 160,
    h: 80,
    sub: "kafka"
  }, {
    id: "db",
    kind: "store",
    label: "Postgres",
    x: 680,
    y: 360,
    w: 160,
    h: 80
  }],
  edges: [{
    id: "e1",
    from: "client",
    to: "gateway",
    kind: "solid",
    label: "HTTPS"
  }, {
    id: "e2",
    from: "gateway",
    to: "orders",
    kind: "solid",
    label: "POST /order"
  }, {
    id: "e3",
    from: "orders",
    to: "redis",
    kind: "dashed",
    label: "cache"
  }, {
    id: "e4",
    from: "orders",
    to: "kafka",
    kind: "solid",
    label: "publish"
  }, {
    id: "e5",
    from: "kafka",
    to: "db",
    kind: "dashed",
    label: "persist"
  }],
  steps: [{
    id: "s1",
    active: {
      nodes: ["client", "gateway"],
      edges: ["e1"]
    }
  }, {
    id: "s2",
    active: {
      nodes: ["gateway", "orders"],
      edges: ["e2"]
    }
  }, {
    id: "s3",
    active: {
      nodes: ["orders", "redis"],
      edges: ["e3"]
    }
  }, {
    id: "s4",
    active: {
      nodes: ["orders", "kafka"],
      edges: ["e4"]
    }
  }, {
    id: "s5",
    active: {
      nodes: ["kafka", "db"],
      edges: ["e5"]
    }
  }]
};
const HERO_GRAPH$1 = {
  canvas: {
    w: 880,
    h: 540,
    grid: 20
  },
  nodes: [{
    id: "client",
    kind: "actor",
    label: "Client",
    x: 40,
    y: 230,
    w: 140,
    h: 78
  }, {
    id: "gateway",
    kind: "gateway",
    label: "Gateway",
    x: 230,
    y: 230,
    w: 160,
    h: 78,
    sub: "edge"
  }, {
    id: "orders",
    kind: "service",
    label: "Orders",
    x: 450,
    y: 100,
    w: 160,
    h: 80,
    sub: "v4.2.1"
  }, {
    id: "redis",
    kind: "cache",
    label: "Redis",
    x: 680,
    y: 100,
    w: 160,
    h: 80
  }, {
    id: "kafka",
    kind: "queue",
    label: "Events",
    x: 450,
    y: 360,
    w: 160,
    h: 80,
    sub: "kafka"
  }, {
    id: "db",
    kind: "store",
    label: "Postgres",
    x: 680,
    y: 360,
    w: 160,
    h: 80
  }],
  edges: [{
    id: "e1",
    from: "client",
    to: "gateway",
    kind: "solid",
    label: "HTTPS"
  }, {
    id: "e2",
    from: "gateway",
    to: "orders",
    kind: "solid",
    label: "POST /order"
  }, {
    id: "e3",
    from: "orders",
    to: "redis",
    kind: "dashed",
    label: "cache"
  }, {
    id: "e4",
    from: "orders",
    to: "kafka",
    kind: "solid",
    label: "publish"
  }, {
    id: "e5",
    from: "kafka",
    to: "db",
    kind: "dashed",
    label: "persist"
  }],
  steps: [{
    id: "s1",
    active: {
      nodes: ["client", "gateway"],
      edges: ["e1"]
    }
  }, {
    id: "s2",
    active: {
      nodes: ["gateway", "orders"],
      edges: ["e2"]
    }
  }, {
    id: "s3",
    active: {
      nodes: ["orders", "redis"],
      edges: ["e3"]
    }
  }, {
    id: "s4",
    active: {
      nodes: ["orders", "kafka"],
      edges: ["e4"]
    }
  }, {
    id: "s5",
    active: {
      nodes: ["kafka", "db"],
      edges: ["e5"]
    }
  }]
};
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
function sideCandidates(A, B) {
  const dx = B.x + B.w / 2 - (A.x + A.w / 2);
  const dy = B.y + B.h / 2 - (A.y + A.h / 2);
  const candidates = {
    exit: [],
    enter: []
  };
  const sides = [{
    s: dx >= 0 ? 'r' : 'l',
    r: Math.abs(dx) / (Math.abs(dx) + Math.abs(dy))
  }, {
    s: dy >= 0 ? 'b' : 't',
    r: Math.abs(dy) / (Math.abs(dx) + Math.abs(dy))
  }];
  sides.sort((a, b) => b.r - a.r);
  candidates.exit = sides.map(s => s.s);
  candidates.enter = sides.map(s => s.s);
  return candidates;
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
  const score = (nodeId, side, role, naturalRank) => {
    const o = occ[nodeId][side];
    const otherRole = role === "out" ? "in" : "out";
    let s = 0;
    s += o[otherRole].length * 100;
    s += o[role].length * 4;
    s += naturalRank * 10;
    return s;
  };
  edges.forEach(e => {
    const A = nodeRect(byId[e.from]),
      B = nodeRect(byId[e.to]);
    const cands = sideCandidates(A, B);
    if (!anchors[e.id].fromSide) {
      let best = cands.exit[0],
        bestScore = Infinity;
      cands.exit.forEach((side, rank) => {
        const s = score(e.from, side, "out", rank);
        if (s < bestScore) {
          bestScore = s;
          best = side;
        }
      });
      anchors[e.id].fromSide = best;
      occ[e.from][best].out.push(e.id);
    }
    if (!anchors[e.id].toSide) {
      let best = cands.enter[0],
        bestScore = Infinity;
      cands.enter.forEach((side, rank) => {
        const s = score(e.to, side, "in", rank);
        if (s < bestScore) {
          bestScore = s;
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
    ["l", "r", "t", "b"].forEach(side => {
      const items = [];
      occ[n.id][side].out.forEach(eid => {
        const other = byId[edges.find(e => e.id === eid).to];
        items.push({
          eid,
          role: "out",
          c: side === "l" || side === "r" ? other.y + other.h / 2 : other.x + other.w / 2
        });
      });
      occ[n.id][side].in.forEach(eid => {
        const other = byId[edges.find(e => e.id === eid).from];
        items.push({
          eid,
          role: "in",
          c: side === "l" || side === "r" ? other.y + other.h / 2 : other.x + other.w / 2
        });
      });
      items.sort((a, b) => a.c - b.c);
      items.forEach((it, i) => {
        const t = items.length === 1 ? 0.5 : (i + 1) / (items.length + 1);
        if (it.role === "out") edgeT[it.eid].fromT = t;else edgeT[it.eid].toT = t;
      });
    });
  });
  return {
    anchors,
    edgeT
  };
}
function routeEdge$1(fromNode, toNode, fromSide, toSide, fromT = 0.5, toT = 0.5) {
  const A = nodeRect(fromNode),
    B = nodeRect(toNode);
  const p0 = anchorOn(A, fromSide, fromT),
    p3 = anchorOn(B, toSide, toT);
  const hFrom = fromSide === "l" || fromSide === "r";
  const hTo = toSide === "l" || toSide === "r";
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
  if (hFrom && !hTo) {
    return [p0, {
      x: p3.x,
      y: p0.y
    }, p3];
  }
  return [p0, {
    x: p0.x,
    y: p3.y
  }, p3];
}
function pathFromPoints$1(pts, rounded = 8) {
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
    const px = cur.x - v1x * r,
      py = cur.y - v1y * r;
    const qx = cur.x + v2x * r,
      qy = cur.y + v2y * r;
    d += ` L ${px} ${py} Q ${cur.x} ${cur.y} ${qx} ${qy}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}
function roughPath$1(pts, amp = 1.4, seed = 7) {
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const offs = () => (rnd() - 0.5) * 2 * amp;
  let d = `M ${pts[0].x + offs()} ${pts[0].y + offs()}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    d += ` L ${p.x + offs()} ${p.y + offs()}`;
  }
  return d;
}
function resolveGraph$1(graph) {
  const byId = Object.fromEntries(graph.nodes.map(n => [n.id, n]));
  const {
    anchors,
    edgeT
  } = assignAnchors(graph.nodes, graph.edges);
  const edges = graph.edges.map(e => {
    const a = anchors[e.id];
    const t = edgeT[e.id];
    const pts = routeEdge$1(byId[e.from], byId[e.to], a.fromSide, a.toSide, t.fromT, t.toT);
    return {
      ...e,
      fromSide: a.fromSide,
      toSide: a.toSide,
      points: pts,
      d: pathFromPoints$1(pts, 10),
      length: pts.reduce((acc, p, i) => i === 0 ? 0 : acc + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y), 0)
    };
  });
  const sortedNodes = [...graph.nodes].sort((a, b) => {
    const isBoundaryA = a.kind === "boundary" ? 1 : 0;
    const isBoundaryB = b.kind === "boundary" ? 1 : 0;
    if (isBoundaryA !== isBoundaryB) return isBoundaryB - isBoundaryA;
    return a.y + a.x - (b.y + b.x);
  });
  return {
    ...graph,
    nodes: sortedNodes,
    edges,
    byId
  };
}

/**
 * Shape library — SVG path generators.
 * Each returns { path, cx, cy } where (cx,cy) is the label anchor.
 */

function shapePath$1(shape, w, h) {
  switch (shape) {
    case "rect":
      return {
        d: `M0 0 H${w} V${h} H0 Z`,
        cx: w / 2,
        cy: h / 2,
        rx: 10
      };
    case "square":
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
    case "circle":
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
    case "oval":
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
    case "diamond":
      return {
        d: `M${w / 2} 0 L${w} ${h / 2} L${w / 2} ${h} L0 ${h / 2} Z`,
        cx: w / 2,
        cy: h / 2
      };
    case "hex":
      {
        const i = Math.min(w * 0.18, 18);
        return {
          d: `M${i} 0 L${w - i} 0 L${w} ${h / 2} L${w - i} ${h} L${i} ${h} L0 ${h / 2} Z`,
          cx: w / 2,
          cy: h / 2
        };
      }
    case "pill":
      {
        const r = h / 2;
        return {
          d: `M${r} 0 H${w - r} A${r} ${r} 0 0 1 ${w - r} ${h} H${r} A${r} ${r} 0 0 1 ${r} 0 Z`,
          cx: w / 2,
          cy: h / 2,
          rx: r
        };
      }
    case "cylinder":
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
    case "cloud":
      {
        return {
          d: `M${w * 0.18} ${h * 0.55} C ${w * 0.02} ${h * 0.55}, ${w * 0.02} ${h * 0.15}, ${w * 0.22} ${h * 0.22} C ${w * 0.28} ${h * 0.02}, ${w * 0.6} ${h * 0.02}, ${w * 0.62} ${h * 0.22} C ${w * 0.82} ${h * 0.15}, ${w * 0.98} ${h * 0.3}, ${w * 0.9} ${h * 0.55} C ${w * 0.98} ${h * 0.75}, ${w * 0.78} ${h * 0.95}, ${w * 0.6} ${h * 0.85} C ${w * 0.4} ${h * 1.02}, ${w * 0.1} ${h * 0.95}, ${w * 0.18} ${h * 0.55} Z`,
          cx: w / 2,
          cy: h / 2
        };
      }
    case "parallelogram":
      {
        const skew = 14;
        return {
          d: `M${skew} 0 H${w} L${w - skew} ${h} H0 Z`,
          cx: w / 2,
          cy: h / 2
        };
      }
    case "shield":
      {
        const r = Math.min(w * 0.18, 14);
        return {
          d: `M${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${h * 0.55} Q${w} ${h * 0.85} ${w / 2} ${h} Q0 ${h * 0.85} 0 ${h * 0.55} V${r} Q0 0 ${r} 0 Z`,
          cx: w / 2,
          cy: h / 2
        };
      }
    case "tablet":
      {
        const r = Math.min(w, h) * 0.18;
        return {
          d: `M${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${h - r} Q${w} ${h} ${w - r} ${h} H${r} Q0 ${h} 0 ${h - r} V${r} Q0 0 ${r} 0 Z`,
          cx: w / 2,
          cy: h / 2,
          rx: r
        };
      }
    case "trapezoid":
      {
        const i = Math.min(w * 0.16, 18);
        return {
          d: `M${i} 0 H${w - i} L${w} ${h} H0 Z`,
          cx: w / 2,
          cy: h / 2
        };
      }
    case "chevron":
      {
        const a = Math.min(w * 0.12, 14);
        return {
          d: `M0 0 H${w - a} L${w} ${h / 2} L${w - a} ${h} H0 L${a} ${h / 2} Z`,
          cx: w / 2,
          cy: h / 2
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
function shapeAnchor$1(node, side) {
  const {
    w,
    h
  } = node;
  const cx = node.x + w / 2,
    cy = node.y + h / 2;
  switch (side) {
    case "l":
      return {
        x: node.x,
        y: cy
      };
    case "r":
      return {
        x: node.x + w,
        y: cy
      };
    case "t":
      return {
        x: cx,
        y: node.y
      };
    case "b":
      return {
        x: cx,
        y: node.y + h
      };
  }
}

/**
 * DSL Parser - converts YAML-like text into a Graph IR
 */

function parseDSL$1(text) {
  const lines = text.split("\n");
  const nodes = [];
  const edges = [];
  const config = {
    gapX: 180,
    gapY: 120,
    nodesPerRow: 3
  };
  let mode = null;
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const lower = trimmed.toLowerCase();
    if (lower === "nodes:") {
      mode = "nodes";
      return;
    }
    if (lower === "edges:") {
      mode = "edges";
      return;
    }
    if (lower === "story:") {
      mode = "story";
      return;
    }
    if (lower === "config:") {
      mode = "config";
      return;
    }
    if (mode === "config") {
      const match = trimmed.match(/^(\w+):\s*(\d+)/);
      if (match) {
        const val = parseInt(match[2], 10);
        if (!isNaN(val)) config[match[1]] = val;
      }
    }
    if (mode === "nodes" && trimmed.startsWith("-")) {
      const parts = trimmed.slice(1).trim();
      const node = {};
      const pairs = parts.match(/(\w+):\s*("[^"]*"|\S+)/g);
      if (pairs) {
        pairs.forEach(p => {
          const match = p.match(/^(\w+):\s*(.*)$/);
          if (match) {
            let [_, k, v] = match;
            v = v.startsWith('"') ? v.slice(1, -1) : v;
            node[k] = k === "x" || k === "y" || k === "w" || k === "h" ? Number(v) : v;
          }
        });
      }
      if (node.id) {
        node.w = node.w || 120;
        node.h = node.h || 60;
        node.kind = node.type || "service";
        nodes.push(node);
      }
    }
    if (mode === "edges" && trimmed.startsWith("-")) {
      const parts = trimmed.slice(1).trim();
      const edgeMatch = parts.match(/(\S+)\s*(\-\>|\.\.>)\s*(\S+)/);
      if (edgeMatch) {
        const [_, from, op, to] = edgeMatch;
        const edge = {
          id: `e-${from}-${to}-${edges.length}`,
          from,
          to,
          kind: op === ".." ? "dashed" : "solid"
        };
        const labelMatch = parts.match(/label:\s*"([^"]*)"/);
        if (labelMatch) edge.label = labelMatch[1];
        edges.push(edge);
      }
    }
  });

  // Auto-layout pass
  const hasManualLayout = nodes.some(n => n.x !== undefined || n.y !== undefined);
  if (!hasManualLayout) {
    const gapX = Number(config.gapX) || 180;
    const gapY = Number(config.gapY) || 120;
    const nPerRow = Number(config.nodesPerRow) || 3;
    nodes.forEach((node, i) => {
      const col = i % nPerRow;
      const row = Math.floor(i / nPerRow);
      node.x = 60 + col * gapX;
      node.y = 40 + row * gapY;
      node.w = node.w || 120;
      node.h = node.h || 60;
    });
  }
  return {
    nodes,
    edges,
    canvas: {
      w: 1100,
      h: 500,
      grid: 20
    }
  };
}

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var propTypes = {exports: {}};

var reactIs = {exports: {}};

var reactIs_production_min = {};

/** @license React v16.13.1
 * react-is.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var hasRequiredReactIs_production_min;

function requireReactIs_production_min () {
	if (hasRequiredReactIs_production_min) return reactIs_production_min;
	hasRequiredReactIs_production_min = 1;
var b="function"===typeof Symbol&&Symbol.for,c=b?Symbol.for("react.element"):60103,d=b?Symbol.for("react.portal"):60106,e=b?Symbol.for("react.fragment"):60107,f=b?Symbol.for("react.strict_mode"):60108,g=b?Symbol.for("react.profiler"):60114,h=b?Symbol.for("react.provider"):60109,k=b?Symbol.for("react.context"):60110,l=b?Symbol.for("react.async_mode"):60111,m=b?Symbol.for("react.concurrent_mode"):60111,n=b?Symbol.for("react.forward_ref"):60112,p=b?Symbol.for("react.suspense"):60113,q=b?
	Symbol.for("react.suspense_list"):60120,r=b?Symbol.for("react.memo"):60115,t=b?Symbol.for("react.lazy"):60116,v=b?Symbol.for("react.block"):60121,w=b?Symbol.for("react.fundamental"):60117,x=b?Symbol.for("react.responder"):60118,y=b?Symbol.for("react.scope"):60119;
	function z(a){if("object"===typeof a&&null!==a){var u=a.$$typeof;switch(u){case c:switch(a=a.type,a){case l:case m:case e:case g:case f:case p:return a;default:switch(a=a&&a.$$typeof,a){case k:case n:case t:case r:case h:return a;default:return u}}case d:return u}}}function A(a){return z(a)===m}reactIs_production_min.AsyncMode=l;reactIs_production_min.ConcurrentMode=m;reactIs_production_min.ContextConsumer=k;reactIs_production_min.ContextProvider=h;reactIs_production_min.Element=c;reactIs_production_min.ForwardRef=n;reactIs_production_min.Fragment=e;reactIs_production_min.Lazy=t;reactIs_production_min.Memo=r;reactIs_production_min.Portal=d;
	reactIs_production_min.Profiler=g;reactIs_production_min.StrictMode=f;reactIs_production_min.Suspense=p;reactIs_production_min.isAsyncMode=function(a){return A(a)||z(a)===l};reactIs_production_min.isConcurrentMode=A;reactIs_production_min.isContextConsumer=function(a){return z(a)===k};reactIs_production_min.isContextProvider=function(a){return z(a)===h};reactIs_production_min.isElement=function(a){return "object"===typeof a&&null!==a&&a.$$typeof===c};reactIs_production_min.isForwardRef=function(a){return z(a)===n};reactIs_production_min.isFragment=function(a){return z(a)===e};reactIs_production_min.isLazy=function(a){return z(a)===t};
	reactIs_production_min.isMemo=function(a){return z(a)===r};reactIs_production_min.isPortal=function(a){return z(a)===d};reactIs_production_min.isProfiler=function(a){return z(a)===g};reactIs_production_min.isStrictMode=function(a){return z(a)===f};reactIs_production_min.isSuspense=function(a){return z(a)===p};
	reactIs_production_min.isValidElementType=function(a){return "string"===typeof a||"function"===typeof a||a===e||a===m||a===g||a===f||a===p||a===q||"object"===typeof a&&null!==a&&(a.$$typeof===t||a.$$typeof===r||a.$$typeof===h||a.$$typeof===k||a.$$typeof===n||a.$$typeof===w||a.$$typeof===x||a.$$typeof===y||a.$$typeof===v)};reactIs_production_min.typeOf=z;
	return reactIs_production_min;
}

var reactIs_development = {};

/** @license React v16.13.1
 * react-is.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var hasRequiredReactIs_development;

function requireReactIs_development () {
	if (hasRequiredReactIs_development) return reactIs_development;
	hasRequiredReactIs_development = 1;



	if (process.env.NODE_ENV !== "production") {
	  (function() {

	// The Symbol used to tag the ReactElement-like types. If there is no native Symbol
	// nor polyfill, then a plain number is used for performance.
	var hasSymbol = typeof Symbol === 'function' && Symbol.for;
	var REACT_ELEMENT_TYPE = hasSymbol ? Symbol.for('react.element') : 0xeac7;
	var REACT_PORTAL_TYPE = hasSymbol ? Symbol.for('react.portal') : 0xeaca;
	var REACT_FRAGMENT_TYPE = hasSymbol ? Symbol.for('react.fragment') : 0xeacb;
	var REACT_STRICT_MODE_TYPE = hasSymbol ? Symbol.for('react.strict_mode') : 0xeacc;
	var REACT_PROFILER_TYPE = hasSymbol ? Symbol.for('react.profiler') : 0xead2;
	var REACT_PROVIDER_TYPE = hasSymbol ? Symbol.for('react.provider') : 0xeacd;
	var REACT_CONTEXT_TYPE = hasSymbol ? Symbol.for('react.context') : 0xeace; // TODO: We don't use AsyncMode or ConcurrentMode anymore. They were temporary
	// (unstable) APIs that have been removed. Can we remove the symbols?

	var REACT_ASYNC_MODE_TYPE = hasSymbol ? Symbol.for('react.async_mode') : 0xeacf;
	var REACT_CONCURRENT_MODE_TYPE = hasSymbol ? Symbol.for('react.concurrent_mode') : 0xeacf;
	var REACT_FORWARD_REF_TYPE = hasSymbol ? Symbol.for('react.forward_ref') : 0xead0;
	var REACT_SUSPENSE_TYPE = hasSymbol ? Symbol.for('react.suspense') : 0xead1;
	var REACT_SUSPENSE_LIST_TYPE = hasSymbol ? Symbol.for('react.suspense_list') : 0xead8;
	var REACT_MEMO_TYPE = hasSymbol ? Symbol.for('react.memo') : 0xead3;
	var REACT_LAZY_TYPE = hasSymbol ? Symbol.for('react.lazy') : 0xead4;
	var REACT_BLOCK_TYPE = hasSymbol ? Symbol.for('react.block') : 0xead9;
	var REACT_FUNDAMENTAL_TYPE = hasSymbol ? Symbol.for('react.fundamental') : 0xead5;
	var REACT_RESPONDER_TYPE = hasSymbol ? Symbol.for('react.responder') : 0xead6;
	var REACT_SCOPE_TYPE = hasSymbol ? Symbol.for('react.scope') : 0xead7;

	function isValidElementType(type) {
	  return typeof type === 'string' || typeof type === 'function' || // Note: its typeof might be other than 'symbol' or 'number' if it's a polyfill.
	  type === REACT_FRAGMENT_TYPE || type === REACT_CONCURRENT_MODE_TYPE || type === REACT_PROFILER_TYPE || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || typeof type === 'object' && type !== null && (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || type.$$typeof === REACT_FUNDAMENTAL_TYPE || type.$$typeof === REACT_RESPONDER_TYPE || type.$$typeof === REACT_SCOPE_TYPE || type.$$typeof === REACT_BLOCK_TYPE);
	}

	function typeOf(object) {
	  if (typeof object === 'object' && object !== null) {
	    var $$typeof = object.$$typeof;

	    switch ($$typeof) {
	      case REACT_ELEMENT_TYPE:
	        var type = object.type;

	        switch (type) {
	          case REACT_ASYNC_MODE_TYPE:
	          case REACT_CONCURRENT_MODE_TYPE:
	          case REACT_FRAGMENT_TYPE:
	          case REACT_PROFILER_TYPE:
	          case REACT_STRICT_MODE_TYPE:
	          case REACT_SUSPENSE_TYPE:
	            return type;

	          default:
	            var $$typeofType = type && type.$$typeof;

	            switch ($$typeofType) {
	              case REACT_CONTEXT_TYPE:
	              case REACT_FORWARD_REF_TYPE:
	              case REACT_LAZY_TYPE:
	              case REACT_MEMO_TYPE:
	              case REACT_PROVIDER_TYPE:
	                return $$typeofType;

	              default:
	                return $$typeof;
	            }

	        }

	      case REACT_PORTAL_TYPE:
	        return $$typeof;
	    }
	  }

	  return undefined;
	} // AsyncMode is deprecated along with isAsyncMode

	var AsyncMode = REACT_ASYNC_MODE_TYPE;
	var ConcurrentMode = REACT_CONCURRENT_MODE_TYPE;
	var ContextConsumer = REACT_CONTEXT_TYPE;
	var ContextProvider = REACT_PROVIDER_TYPE;
	var Element = REACT_ELEMENT_TYPE;
	var ForwardRef = REACT_FORWARD_REF_TYPE;
	var Fragment = REACT_FRAGMENT_TYPE;
	var Lazy = REACT_LAZY_TYPE;
	var Memo = REACT_MEMO_TYPE;
	var Portal = REACT_PORTAL_TYPE;
	var Profiler = REACT_PROFILER_TYPE;
	var StrictMode = REACT_STRICT_MODE_TYPE;
	var Suspense = REACT_SUSPENSE_TYPE;
	var hasWarnedAboutDeprecatedIsAsyncMode = false; // AsyncMode should be deprecated

	function isAsyncMode(object) {
	  {
	    if (!hasWarnedAboutDeprecatedIsAsyncMode) {
	      hasWarnedAboutDeprecatedIsAsyncMode = true; // Using console['warn'] to evade Babel and ESLint

	      console['warn']('The ReactIs.isAsyncMode() alias has been deprecated, ' + 'and will be removed in React 17+. Update your code to use ' + 'ReactIs.isConcurrentMode() instead. It has the exact same API.');
	    }
	  }

	  return isConcurrentMode(object) || typeOf(object) === REACT_ASYNC_MODE_TYPE;
	}
	function isConcurrentMode(object) {
	  return typeOf(object) === REACT_CONCURRENT_MODE_TYPE;
	}
	function isContextConsumer(object) {
	  return typeOf(object) === REACT_CONTEXT_TYPE;
	}
	function isContextProvider(object) {
	  return typeOf(object) === REACT_PROVIDER_TYPE;
	}
	function isElement(object) {
	  return typeof object === 'object' && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
	}
	function isForwardRef(object) {
	  return typeOf(object) === REACT_FORWARD_REF_TYPE;
	}
	function isFragment(object) {
	  return typeOf(object) === REACT_FRAGMENT_TYPE;
	}
	function isLazy(object) {
	  return typeOf(object) === REACT_LAZY_TYPE;
	}
	function isMemo(object) {
	  return typeOf(object) === REACT_MEMO_TYPE;
	}
	function isPortal(object) {
	  return typeOf(object) === REACT_PORTAL_TYPE;
	}
	function isProfiler(object) {
	  return typeOf(object) === REACT_PROFILER_TYPE;
	}
	function isStrictMode(object) {
	  return typeOf(object) === REACT_STRICT_MODE_TYPE;
	}
	function isSuspense(object) {
	  return typeOf(object) === REACT_SUSPENSE_TYPE;
	}

	reactIs_development.AsyncMode = AsyncMode;
	reactIs_development.ConcurrentMode = ConcurrentMode;
	reactIs_development.ContextConsumer = ContextConsumer;
	reactIs_development.ContextProvider = ContextProvider;
	reactIs_development.Element = Element;
	reactIs_development.ForwardRef = ForwardRef;
	reactIs_development.Fragment = Fragment;
	reactIs_development.Lazy = Lazy;
	reactIs_development.Memo = Memo;
	reactIs_development.Portal = Portal;
	reactIs_development.Profiler = Profiler;
	reactIs_development.StrictMode = StrictMode;
	reactIs_development.Suspense = Suspense;
	reactIs_development.isAsyncMode = isAsyncMode;
	reactIs_development.isConcurrentMode = isConcurrentMode;
	reactIs_development.isContextConsumer = isContextConsumer;
	reactIs_development.isContextProvider = isContextProvider;
	reactIs_development.isElement = isElement;
	reactIs_development.isForwardRef = isForwardRef;
	reactIs_development.isFragment = isFragment;
	reactIs_development.isLazy = isLazy;
	reactIs_development.isMemo = isMemo;
	reactIs_development.isPortal = isPortal;
	reactIs_development.isProfiler = isProfiler;
	reactIs_development.isStrictMode = isStrictMode;
	reactIs_development.isSuspense = isSuspense;
	reactIs_development.isValidElementType = isValidElementType;
	reactIs_development.typeOf = typeOf;
	  })();
	}
	return reactIs_development;
}

var hasRequiredReactIs;

function requireReactIs () {
	if (hasRequiredReactIs) return reactIs.exports;
	hasRequiredReactIs = 1;

	if (process.env.NODE_ENV === 'production') {
	  reactIs.exports = requireReactIs_production_min();
	} else {
	  reactIs.exports = requireReactIs_development();
	}
	return reactIs.exports;
}

/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

var objectAssign;
var hasRequiredObjectAssign;

function requireObjectAssign () {
	if (hasRequiredObjectAssign) return objectAssign;
	hasRequiredObjectAssign = 1;
	/* eslint-disable no-unused-vars */
	var getOwnPropertySymbols = Object.getOwnPropertySymbols;
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	var propIsEnumerable = Object.prototype.propertyIsEnumerable;

	function toObject(val) {
		if (val === null || val === undefined) {
			throw new TypeError('Object.assign cannot be called with null or undefined');
		}

		return Object(val);
	}

	function shouldUseNative() {
		try {
			if (!Object.assign) {
				return false;
			}

			// Detect buggy property enumeration order in older V8 versions.

			// https://bugs.chromium.org/p/v8/issues/detail?id=4118
			var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
			test1[5] = 'de';
			if (Object.getOwnPropertyNames(test1)[0] === '5') {
				return false;
			}

			// https://bugs.chromium.org/p/v8/issues/detail?id=3056
			var test2 = {};
			for (var i = 0; i < 10; i++) {
				test2['_' + String.fromCharCode(i)] = i;
			}
			var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
				return test2[n];
			});
			if (order2.join('') !== '0123456789') {
				return false;
			}

			// https://bugs.chromium.org/p/v8/issues/detail?id=3056
			var test3 = {};
			'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
				test3[letter] = letter;
			});
			if (Object.keys(Object.assign({}, test3)).join('') !==
					'abcdefghijklmnopqrst') {
				return false;
			}

			return true;
		} catch (err) {
			// We don't expect any of the above to throw, but better to be safe.
			return false;
		}
	}

	objectAssign = shouldUseNative() ? Object.assign : function (target, source) {
		var from;
		var to = toObject(target);
		var symbols;

		for (var s = 1; s < arguments.length; s++) {
			from = Object(arguments[s]);

			for (var key in from) {
				if (hasOwnProperty.call(from, key)) {
					to[key] = from[key];
				}
			}

			if (getOwnPropertySymbols) {
				symbols = getOwnPropertySymbols(from);
				for (var i = 0; i < symbols.length; i++) {
					if (propIsEnumerable.call(from, symbols[i])) {
						to[symbols[i]] = from[symbols[i]];
					}
				}
			}
		}

		return to;
	};
	return objectAssign;
}

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var ReactPropTypesSecret_1;
var hasRequiredReactPropTypesSecret;

function requireReactPropTypesSecret () {
	if (hasRequiredReactPropTypesSecret) return ReactPropTypesSecret_1;
	hasRequiredReactPropTypesSecret = 1;

	var ReactPropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';

	ReactPropTypesSecret_1 = ReactPropTypesSecret;
	return ReactPropTypesSecret_1;
}

var has;
var hasRequiredHas;

function requireHas () {
	if (hasRequiredHas) return has;
	hasRequiredHas = 1;
	has = Function.call.bind(Object.prototype.hasOwnProperty);
	return has;
}

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var checkPropTypes_1;
var hasRequiredCheckPropTypes;

function requireCheckPropTypes () {
	if (hasRequiredCheckPropTypes) return checkPropTypes_1;
	hasRequiredCheckPropTypes = 1;

	var printWarning = function() {};

	if (process.env.NODE_ENV !== 'production') {
	  var ReactPropTypesSecret = requireReactPropTypesSecret();
	  var loggedTypeFailures = {};
	  var has = requireHas();

	  printWarning = function(text) {
	    var message = 'Warning: ' + text;
	    if (typeof console !== 'undefined') {
	      console.error(message);
	    }
	    try {
	      // --- Welcome to debugging React ---
	      // This error was thrown as a convenience so that you can use this stack
	      // to find the callsite that caused this warning to fire.
	      throw new Error(message);
	    } catch (x) { /**/ }
	  };
	}

	/**
	 * Assert that the values match with the type specs.
	 * Error messages are memorized and will only be shown once.
	 *
	 * @param {object} typeSpecs Map of name to a ReactPropType
	 * @param {object} values Runtime values that need to be type-checked
	 * @param {string} location e.g. "prop", "context", "child context"
	 * @param {string} componentName Name of the component for error messages.
	 * @param {?Function} getStack Returns the component stack.
	 * @private
	 */
	function checkPropTypes(typeSpecs, values, location, componentName, getStack) {
	  if (process.env.NODE_ENV !== 'production') {
	    for (var typeSpecName in typeSpecs) {
	      if (has(typeSpecs, typeSpecName)) {
	        var error;
	        // Prop type validation may throw. In case they do, we don't want to
	        // fail the render phase where it didn't fail before. So we log it.
	        // After these have been cleaned up, we'll let them throw.
	        try {
	          // This is intentionally an invariant that gets caught. It's the same
	          // behavior as without this statement except with a better message.
	          if (typeof typeSpecs[typeSpecName] !== 'function') {
	            var err = Error(
	              (componentName || 'React class') + ': ' + location + ' type `' + typeSpecName + '` is invalid; ' +
	              'it must be a function, usually from the `prop-types` package, but received `' + typeof typeSpecs[typeSpecName] + '`.' +
	              'This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.'
	            );
	            err.name = 'Invariant Violation';
	            throw err;
	          }
	          error = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, ReactPropTypesSecret);
	        } catch (ex) {
	          error = ex;
	        }
	        if (error && !(error instanceof Error)) {
	          printWarning(
	            (componentName || 'React class') + ': type specification of ' +
	            location + ' `' + typeSpecName + '` is invalid; the type checker ' +
	            'function must return `null` or an `Error` but returned a ' + typeof error + '. ' +
	            'You may have forgotten to pass an argument to the type checker ' +
	            'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ' +
	            'shape all require an argument).'
	          );
	        }
	        if (error instanceof Error && !(error.message in loggedTypeFailures)) {
	          // Only monitor this failure once because there tends to be a lot of the
	          // same error.
	          loggedTypeFailures[error.message] = true;

	          var stack = getStack ? getStack() : '';

	          printWarning(
	            'Failed ' + location + ' type: ' + error.message + (stack != null ? stack : '')
	          );
	        }
	      }
	    }
	  }
	}

	/**
	 * Resets warning cache when testing.
	 *
	 * @private
	 */
	checkPropTypes.resetWarningCache = function() {
	  if (process.env.NODE_ENV !== 'production') {
	    loggedTypeFailures = {};
	  }
	};

	checkPropTypes_1 = checkPropTypes;
	return checkPropTypes_1;
}

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var factoryWithTypeCheckers;
var hasRequiredFactoryWithTypeCheckers;

function requireFactoryWithTypeCheckers () {
	if (hasRequiredFactoryWithTypeCheckers) return factoryWithTypeCheckers;
	hasRequiredFactoryWithTypeCheckers = 1;

	var ReactIs = requireReactIs();
	var assign = requireObjectAssign();

	var ReactPropTypesSecret = requireReactPropTypesSecret();
	var has = requireHas();
	var checkPropTypes = requireCheckPropTypes();

	var printWarning = function() {};

	if (process.env.NODE_ENV !== 'production') {
	  printWarning = function(text) {
	    var message = 'Warning: ' + text;
	    if (typeof console !== 'undefined') {
	      console.error(message);
	    }
	    try {
	      // --- Welcome to debugging React ---
	      // This error was thrown as a convenience so that you can use this stack
	      // to find the callsite that caused this warning to fire.
	      throw new Error(message);
	    } catch (x) {}
	  };
	}

	function emptyFunctionThatReturnsNull() {
	  return null;
	}

	factoryWithTypeCheckers = function(isValidElement, throwOnDirectAccess) {
	  /* global Symbol */
	  var ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
	  var FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.

	  /**
	   * Returns the iterator method function contained on the iterable object.
	   *
	   * Be sure to invoke the function with the iterable as context:
	   *
	   *     var iteratorFn = getIteratorFn(myIterable);
	   *     if (iteratorFn) {
	   *       var iterator = iteratorFn.call(myIterable);
	   *       ...
	   *     }
	   *
	   * @param {?object} maybeIterable
	   * @return {?function}
	   */
	  function getIteratorFn(maybeIterable) {
	    var iteratorFn = maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]);
	    if (typeof iteratorFn === 'function') {
	      return iteratorFn;
	    }
	  }

	  /**
	   * Collection of methods that allow declaration and validation of props that are
	   * supplied to React components. Example usage:
	   *
	   *   var Props = require('ReactPropTypes');
	   *   var MyArticle = React.createClass({
	   *     propTypes: {
	   *       // An optional string prop named "description".
	   *       description: Props.string,
	   *
	   *       // A required enum prop named "category".
	   *       category: Props.oneOf(['News','Photos']).isRequired,
	   *
	   *       // A prop named "dialog" that requires an instance of Dialog.
	   *       dialog: Props.instanceOf(Dialog).isRequired
	   *     },
	   *     render: function() { ... }
	   *   });
	   *
	   * A more formal specification of how these methods are used:
	   *
	   *   type := array|bool|func|object|number|string|oneOf([...])|instanceOf(...)
	   *   decl := ReactPropTypes.{type}(.isRequired)?
	   *
	   * Each and every declaration produces a function with the same signature. This
	   * allows the creation of custom validation functions. For example:
	   *
	   *  var MyLink = React.createClass({
	   *    propTypes: {
	   *      // An optional string or URI prop named "href".
	   *      href: function(props, propName, componentName) {
	   *        var propValue = props[propName];
	   *        if (propValue != null && typeof propValue !== 'string' &&
	   *            !(propValue instanceof URI)) {
	   *          return new Error(
	   *            'Expected a string or an URI for ' + propName + ' in ' +
	   *            componentName
	   *          );
	   *        }
	   *      }
	   *    },
	   *    render: function() {...}
	   *  });
	   *
	   * @internal
	   */

	  var ANONYMOUS = '<<anonymous>>';

	  // Important!
	  // Keep this list in sync with production version in `./factoryWithThrowingShims.js`.
	  var ReactPropTypes = {
	    array: createPrimitiveTypeChecker('array'),
	    bigint: createPrimitiveTypeChecker('bigint'),
	    bool: createPrimitiveTypeChecker('boolean'),
	    func: createPrimitiveTypeChecker('function'),
	    number: createPrimitiveTypeChecker('number'),
	    object: createPrimitiveTypeChecker('object'),
	    string: createPrimitiveTypeChecker('string'),
	    symbol: createPrimitiveTypeChecker('symbol'),

	    any: createAnyTypeChecker(),
	    arrayOf: createArrayOfTypeChecker,
	    element: createElementTypeChecker(),
	    elementType: createElementTypeTypeChecker(),
	    instanceOf: createInstanceTypeChecker,
	    node: createNodeChecker(),
	    objectOf: createObjectOfTypeChecker,
	    oneOf: createEnumTypeChecker,
	    oneOfType: createUnionTypeChecker,
	    shape: createShapeTypeChecker,
	    exact: createStrictShapeTypeChecker,
	  };

	  /**
	   * inlined Object.is polyfill to avoid requiring consumers ship their own
	   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
	   */
	  /*eslint-disable no-self-compare*/
	  function is(x, y) {
	    // SameValue algorithm
	    if (x === y) {
	      // Steps 1-5, 7-10
	      // Steps 6.b-6.e: +0 != -0
	      return x !== 0 || 1 / x === 1 / y;
	    } else {
	      // Step 6.a: NaN == NaN
	      return x !== x && y !== y;
	    }
	  }
	  /*eslint-enable no-self-compare*/

	  /**
	   * We use an Error-like object for backward compatibility as people may call
	   * PropTypes directly and inspect their output. However, we don't use real
	   * Errors anymore. We don't inspect their stack anyway, and creating them
	   * is prohibitively expensive if they are created too often, such as what
	   * happens in oneOfType() for any type before the one that matched.
	   */
	  function PropTypeError(message, data) {
	    this.message = message;
	    this.data = data && typeof data === 'object' ? data: {};
	    this.stack = '';
	  }
	  // Make `instanceof Error` still work for returned errors.
	  PropTypeError.prototype = Error.prototype;

	  function createChainableTypeChecker(validate) {
	    if (process.env.NODE_ENV !== 'production') {
	      var manualPropTypeCallCache = {};
	      var manualPropTypeWarningCount = 0;
	    }
	    function checkType(isRequired, props, propName, componentName, location, propFullName, secret) {
	      componentName = componentName || ANONYMOUS;
	      propFullName = propFullName || propName;

	      if (secret !== ReactPropTypesSecret) {
	        if (throwOnDirectAccess) {
	          // New behavior only for users of `prop-types` package
	          var err = new Error(
	            'Calling PropTypes validators directly is not supported by the `prop-types` package. ' +
	            'Use `PropTypes.checkPropTypes()` to call them. ' +
	            'Read more at http://fb.me/use-check-prop-types'
	          );
	          err.name = 'Invariant Violation';
	          throw err;
	        } else if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
	          // Old behavior for people using React.PropTypes
	          var cacheKey = componentName + ':' + propName;
	          if (
	            !manualPropTypeCallCache[cacheKey] &&
	            // Avoid spamming the console because they are often not actionable except for lib authors
	            manualPropTypeWarningCount < 3
	          ) {
	            printWarning(
	              'You are manually calling a React.PropTypes validation ' +
	              'function for the `' + propFullName + '` prop on `' + componentName + '`. This is deprecated ' +
	              'and will throw in the standalone `prop-types` package. ' +
	              'You may be seeing this warning due to a third-party PropTypes ' +
	              'library. See https://fb.me/react-warning-dont-call-proptypes ' + 'for details.'
	            );
	            manualPropTypeCallCache[cacheKey] = true;
	            manualPropTypeWarningCount++;
	          }
	        }
	      }
	      if (props[propName] == null) {
	        if (isRequired) {
	          if (props[propName] === null) {
	            return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required ' + ('in `' + componentName + '`, but its value is `null`.'));
	          }
	          return new PropTypeError('The ' + location + ' `' + propFullName + '` is marked as required in ' + ('`' + componentName + '`, but its value is `undefined`.'));
	        }
	        return null;
	      } else {
	        return validate(props, propName, componentName, location, propFullName);
	      }
	    }

	    var chainedCheckType = checkType.bind(null, false);
	    chainedCheckType.isRequired = checkType.bind(null, true);

	    return chainedCheckType;
	  }

	  function createPrimitiveTypeChecker(expectedType) {
	    function validate(props, propName, componentName, location, propFullName, secret) {
	      var propValue = props[propName];
	      var propType = getPropType(propValue);
	      if (propType !== expectedType) {
	        // `propValue` being instance of, say, date/regexp, pass the 'object'
	        // check, but we can offer a more precise error message here rather than
	        // 'of type `object`'.
	        var preciseType = getPreciseType(propValue);

	        return new PropTypeError(
	          'Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedType + '`.'),
	          {expectedType: expectedType}
	        );
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createAnyTypeChecker() {
	    return createChainableTypeChecker(emptyFunctionThatReturnsNull);
	  }

	  function createArrayOfTypeChecker(typeChecker) {
	    function validate(props, propName, componentName, location, propFullName) {
	      if (typeof typeChecker !== 'function') {
	        return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside arrayOf.');
	      }
	      var propValue = props[propName];
	      if (!Array.isArray(propValue)) {
	        var propType = getPropType(propValue);
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));
	      }
	      for (var i = 0; i < propValue.length; i++) {
	        var error = typeChecker(propValue, i, componentName, location, propFullName + '[' + i + ']', ReactPropTypesSecret);
	        if (error instanceof Error) {
	          return error;
	        }
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createElementTypeChecker() {
	    function validate(props, propName, componentName, location, propFullName) {
	      var propValue = props[propName];
	      if (!isValidElement(propValue)) {
	        var propType = getPropType(propValue);
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement.'));
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createElementTypeTypeChecker() {
	    function validate(props, propName, componentName, location, propFullName) {
	      var propValue = props[propName];
	      if (!ReactIs.isValidElementType(propValue)) {
	        var propType = getPropType(propValue);
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement type.'));
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createInstanceTypeChecker(expectedClass) {
	    function validate(props, propName, componentName, location, propFullName) {
	      if (!(props[propName] instanceof expectedClass)) {
	        var expectedClassName = expectedClass.name || ANONYMOUS;
	        var actualClassName = getClassName(props[propName]);
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + actualClassName + '` supplied to `' + componentName + '`, expected ') + ('instance of `' + expectedClassName + '`.'));
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createEnumTypeChecker(expectedValues) {
	    if (!Array.isArray(expectedValues)) {
	      if (process.env.NODE_ENV !== 'production') {
	        if (arguments.length > 1) {
	          printWarning(
	            'Invalid arguments supplied to oneOf, expected an array, got ' + arguments.length + ' arguments. ' +
	            'A common mistake is to write oneOf(x, y, z) instead of oneOf([x, y, z]).'
	          );
	        } else {
	          printWarning('Invalid argument supplied to oneOf, expected an array.');
	        }
	      }
	      return emptyFunctionThatReturnsNull;
	    }

	    function validate(props, propName, componentName, location, propFullName) {
	      var propValue = props[propName];
	      for (var i = 0; i < expectedValues.length; i++) {
	        if (is(propValue, expectedValues[i])) {
	          return null;
	        }
	      }

	      var valuesString = JSON.stringify(expectedValues, function replacer(key, value) {
	        var type = getPreciseType(value);
	        if (type === 'symbol') {
	          return String(value);
	        }
	        return value;
	      });
	      return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of value `' + String(propValue) + '` ' + ('supplied to `' + componentName + '`, expected one of ' + valuesString + '.'));
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createObjectOfTypeChecker(typeChecker) {
	    function validate(props, propName, componentName, location, propFullName) {
	      if (typeof typeChecker !== 'function') {
	        return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside objectOf.');
	      }
	      var propValue = props[propName];
	      var propType = getPropType(propValue);
	      if (propType !== 'object') {
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));
	      }
	      for (var key in propValue) {
	        if (has(propValue, key)) {
	          var error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
	          if (error instanceof Error) {
	            return error;
	          }
	        }
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createUnionTypeChecker(arrayOfTypeCheckers) {
	    if (!Array.isArray(arrayOfTypeCheckers)) {
	      process.env.NODE_ENV !== 'production' ? printWarning('Invalid argument supplied to oneOfType, expected an instance of array.') : void 0;
	      return emptyFunctionThatReturnsNull;
	    }

	    for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
	      var checker = arrayOfTypeCheckers[i];
	      if (typeof checker !== 'function') {
	        printWarning(
	          'Invalid argument supplied to oneOfType. Expected an array of check functions, but ' +
	          'received ' + getPostfixForTypeWarning(checker) + ' at index ' + i + '.'
	        );
	        return emptyFunctionThatReturnsNull;
	      }
	    }

	    function validate(props, propName, componentName, location, propFullName) {
	      var expectedTypes = [];
	      for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
	        var checker = arrayOfTypeCheckers[i];
	        var checkerResult = checker(props, propName, componentName, location, propFullName, ReactPropTypesSecret);
	        if (checkerResult == null) {
	          return null;
	        }
	        if (checkerResult.data && has(checkerResult.data, 'expectedType')) {
	          expectedTypes.push(checkerResult.data.expectedType);
	        }
	      }
	      var expectedTypesMessage = (expectedTypes.length > 0) ? ', expected one of type [' + expectedTypes.join(', ') + ']': '';
	      return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`' + expectedTypesMessage + '.'));
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createNodeChecker() {
	    function validate(props, propName, componentName, location, propFullName) {
	      if (!isNode(props[propName])) {
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a ReactNode.'));
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function invalidValidatorError(componentName, location, propFullName, key, type) {
	    return new PropTypeError(
	      (componentName || 'React class') + ': ' + location + ' type `' + propFullName + '.' + key + '` is invalid; ' +
	      'it must be a function, usually from the `prop-types` package, but received `' + type + '`.'
	    );
	  }

	  function createShapeTypeChecker(shapeTypes) {
	    function validate(props, propName, componentName, location, propFullName) {
	      var propValue = props[propName];
	      var propType = getPropType(propValue);
	      if (propType !== 'object') {
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
	      }
	      for (var key in shapeTypes) {
	        var checker = shapeTypes[key];
	        if (typeof checker !== 'function') {
	          return invalidValidatorError(componentName, location, propFullName, key, getPreciseType(checker));
	        }
	        var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
	        if (error) {
	          return error;
	        }
	      }
	      return null;
	    }
	    return createChainableTypeChecker(validate);
	  }

	  function createStrictShapeTypeChecker(shapeTypes) {
	    function validate(props, propName, componentName, location, propFullName) {
	      var propValue = props[propName];
	      var propType = getPropType(propValue);
	      if (propType !== 'object') {
	        return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
	      }
	      // We need to check all keys in case some are required but missing from props.
	      var allKeys = assign({}, props[propName], shapeTypes);
	      for (var key in allKeys) {
	        var checker = shapeTypes[key];
	        if (has(shapeTypes, key) && typeof checker !== 'function') {
	          return invalidValidatorError(componentName, location, propFullName, key, getPreciseType(checker));
	        }
	        if (!checker) {
	          return new PropTypeError(
	            'Invalid ' + location + ' `' + propFullName + '` key `' + key + '` supplied to `' + componentName + '`.' +
	            '\nBad object: ' + JSON.stringify(props[propName], null, '  ') +
	            '\nValid keys: ' + JSON.stringify(Object.keys(shapeTypes), null, '  ')
	          );
	        }
	        var error = checker(propValue, key, componentName, location, propFullName + '.' + key, ReactPropTypesSecret);
	        if (error) {
	          return error;
	        }
	      }
	      return null;
	    }

	    return createChainableTypeChecker(validate);
	  }

	  function isNode(propValue) {
	    switch (typeof propValue) {
	      case 'number':
	      case 'string':
	      case 'undefined':
	        return true;
	      case 'boolean':
	        return !propValue;
	      case 'object':
	        if (Array.isArray(propValue)) {
	          return propValue.every(isNode);
	        }
	        if (propValue === null || isValidElement(propValue)) {
	          return true;
	        }

	        var iteratorFn = getIteratorFn(propValue);
	        if (iteratorFn) {
	          var iterator = iteratorFn.call(propValue);
	          var step;
	          if (iteratorFn !== propValue.entries) {
	            while (!(step = iterator.next()).done) {
	              if (!isNode(step.value)) {
	                return false;
	              }
	            }
	          } else {
	            // Iterator will provide entry [k,v] tuples rather than values.
	            while (!(step = iterator.next()).done) {
	              var entry = step.value;
	              if (entry) {
	                if (!isNode(entry[1])) {
	                  return false;
	                }
	              }
	            }
	          }
	        } else {
	          return false;
	        }

	        return true;
	      default:
	        return false;
	    }
	  }

	  function isSymbol(propType, propValue) {
	    // Native Symbol.
	    if (propType === 'symbol') {
	      return true;
	    }

	    // falsy value can't be a Symbol
	    if (!propValue) {
	      return false;
	    }

	    // 19.4.3.5 Symbol.prototype[@@toStringTag] === 'Symbol'
	    if (propValue['@@toStringTag'] === 'Symbol') {
	      return true;
	    }

	    // Fallback for non-spec compliant Symbols which are polyfilled.
	    if (typeof Symbol === 'function' && propValue instanceof Symbol) {
	      return true;
	    }

	    return false;
	  }

	  // Equivalent of `typeof` but with special handling for array and regexp.
	  function getPropType(propValue) {
	    var propType = typeof propValue;
	    if (Array.isArray(propValue)) {
	      return 'array';
	    }
	    if (propValue instanceof RegExp) {
	      // Old webkits (at least until Android 4.0) return 'function' rather than
	      // 'object' for typeof a RegExp. We'll normalize this here so that /bla/
	      // passes PropTypes.object.
	      return 'object';
	    }
	    if (isSymbol(propType, propValue)) {
	      return 'symbol';
	    }
	    return propType;
	  }

	  // This handles more types than `getPropType`. Only used for error messages.
	  // See `createPrimitiveTypeChecker`.
	  function getPreciseType(propValue) {
	    if (typeof propValue === 'undefined' || propValue === null) {
	      return '' + propValue;
	    }
	    var propType = getPropType(propValue);
	    if (propType === 'object') {
	      if (propValue instanceof Date) {
	        return 'date';
	      } else if (propValue instanceof RegExp) {
	        return 'regexp';
	      }
	    }
	    return propType;
	  }

	  // Returns a string that is postfixed to a warning about an invalid type.
	  // For example, "undefined" or "of type array"
	  function getPostfixForTypeWarning(value) {
	    var type = getPreciseType(value);
	    switch (type) {
	      case 'array':
	      case 'object':
	        return 'an ' + type;
	      case 'boolean':
	      case 'date':
	      case 'regexp':
	        return 'a ' + type;
	      default:
	        return type;
	    }
	  }

	  // Returns class name of the object, if any.
	  function getClassName(propValue) {
	    if (!propValue.constructor || !propValue.constructor.name) {
	      return ANONYMOUS;
	    }
	    return propValue.constructor.name;
	  }

	  ReactPropTypes.checkPropTypes = checkPropTypes;
	  ReactPropTypes.resetWarningCache = checkPropTypes.resetWarningCache;
	  ReactPropTypes.PropTypes = ReactPropTypes;

	  return ReactPropTypes;
	};
	return factoryWithTypeCheckers;
}

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var factoryWithThrowingShims;
var hasRequiredFactoryWithThrowingShims;

function requireFactoryWithThrowingShims () {
	if (hasRequiredFactoryWithThrowingShims) return factoryWithThrowingShims;
	hasRequiredFactoryWithThrowingShims = 1;

	var ReactPropTypesSecret = requireReactPropTypesSecret();

	function emptyFunction() {}
	function emptyFunctionWithReset() {}
	emptyFunctionWithReset.resetWarningCache = emptyFunction;

	factoryWithThrowingShims = function() {
	  function shim(props, propName, componentName, location, propFullName, secret) {
	    if (secret === ReactPropTypesSecret) {
	      // It is still safe when called from React.
	      return;
	    }
	    var err = new Error(
	      'Calling PropTypes validators directly is not supported by the `prop-types` package. ' +
	      'Use PropTypes.checkPropTypes() to call them. ' +
	      'Read more at http://fb.me/use-check-prop-types'
	    );
	    err.name = 'Invariant Violation';
	    throw err;
	  }	  shim.isRequired = shim;
	  function getShim() {
	    return shim;
	  }	  // Important!
	  // Keep this list in sync with production version in `./factoryWithTypeCheckers.js`.
	  var ReactPropTypes = {
	    array: shim,
	    bigint: shim,
	    bool: shim,
	    func: shim,
	    number: shim,
	    object: shim,
	    string: shim,
	    symbol: shim,

	    any: shim,
	    arrayOf: getShim,
	    element: shim,
	    elementType: shim,
	    instanceOf: getShim,
	    node: shim,
	    objectOf: getShim,
	    oneOf: getShim,
	    oneOfType: getShim,
	    shape: getShim,
	    exact: getShim,

	    checkPropTypes: emptyFunctionWithReset,
	    resetWarningCache: emptyFunction
	  };

	  ReactPropTypes.PropTypes = ReactPropTypes;

	  return ReactPropTypes;
	};
	return factoryWithThrowingShims;
}

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

if (process.env.NODE_ENV !== 'production') {
  var ReactIs = requireReactIs();

  // By explicitly using `prop-types` you are opting into new development behavior.
  // http://fb.me/prop-types-in-prod
  var throwOnDirectAccess = true;
  propTypes.exports = requireFactoryWithTypeCheckers()(ReactIs.isElement, throwOnDirectAccess);
} else {
  // By explicitly using `prop-types` you are opting into new production behavior.
  // http://fb.me/prop-types-in-prod
  propTypes.exports = requireFactoryWithThrowingShims()();
}

var propTypesExports = propTypes.exports;
var PropTypes = /*@__PURE__*/getDefaultExportFromCjs(propTypesExports);

/**
 * Core Diagram Component
 * Framework-agnostic React component for rendering diagrams
 */


/**
 * Diagram - Main diagram renderer component
 */
function Diagram$1({
  graph,
  style = 'sleek',
  activeNodes = [],
  activeEdges = [],
  className = '',
  padding = 0,
  onNodeClick,
  onEdgeClick,
  fullscreenTarget,
  showControls = false,
  animate = true,
  children
}) {
  const containerRef = React.useRef(null);
  const [resolved, setResolved] = React.useState(null);
  const [svgElement, setSvgElement] = React.useState(null);

  // Resolve and cache the graph
  React.useEffect(() => {
    if (!graph) return;
    try {
      const r = resolveGraph$1(graph);
      setResolved(r);
    } catch (e) {
      console.error('Flow: Failed to resolve graph', e);
    }
  }, [graph]);
  const styleObj = STYLES$1[style] || STYLES$1.sleek;

  // Download handler
  const handleDownload = React.useCallback(() => {
    if (svgElement) {
      downloadSVG$1(svgElement, `diagram-${Date.now()}.svg`);
    }
  }, [svgElement]);
  const handleFullscreen = React.useCallback(() => {
    if (!containerRef.current) return;
    if (containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen();
    }
  }, []);
  if (!resolved) {
    return /*#__PURE__*/React.createElement("div", {
      className: `flow-diagram flow-loading ${className}`
    }, "Loading diagram...");
  }
  const {
    nodes,
    edges,
    canvas
  } = resolved;
  const width = canvas.w + padding * 2;
  const height = canvas.h + padding * 2;
  return /*#__PURE__*/React.createElement("div", {
    ref: containerRef,
    className: `flow-diagram ${className}`,
    style: {
      '--flow-bg': styleObj.tokens.bg,
      '--flow-grid': styleObj.tokens.grid
    }
  }, /*#__PURE__*/React.createElement("svg", {
    ref: setSvgElement,
    width: "100%",
    height: "100%",
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "xMidYMid meet",
    className: "flow-svg"
  }, /*#__PURE__*/React.createElement("defs", null, styleObj.Defs && /*#__PURE__*/React.createElement(styleObj.Defs, null), /*#__PURE__*/React.createElement("marker", {
    id: "flow-arrow-solid",
    viewBox: "0 0 10 10",
    refX: "9",
    refY: "5",
    markerWidth: "6",
    markerHeight: "6",
    orient: "auto"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 0 0 L 10 5 L 0 10 z",
    fill: styleObj.tokens.edge
  })), /*#__PURE__*/React.createElement("marker", {
    id: "flow-arrow-active",
    viewBox: "0 0 10 10",
    refX: "9",
    refY: "5",
    markerWidth: "6",
    markerHeight: "6",
    orient: "auto"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M 0 0 L 10 5 L 0 10 z",
    fill: styleObj.tokens.edgeActive
  })), /*#__PURE__*/React.createElement("filter", {
    id: "flow-glow",
    x: "-50%",
    y: "-50%",
    width: "200%",
    height: "200%"
  }, /*#__PURE__*/React.createElement("feGaussianBlur", {
    stdDeviation: "2",
    result: "coloredBlur"
  }), /*#__PURE__*/React.createElement("feMerge", null, /*#__PURE__*/React.createElement("feMergeNode", {
    in: "coloredBlur"
  }), /*#__PURE__*/React.createElement("feMergeNode", {
    in: "SourceGraphic"
  })))), /*#__PURE__*/React.createElement("rect", {
    width: width,
    height: height,
    fill: styleObj.tokens.bg
  }), styleObj.renderGrid && /*#__PURE__*/React.createElement("g", {
    className: "flow-grid"
  }, styleObj.renderGrid({
    width,
    height,
    canvas
  })), /*#__PURE__*/React.createElement("g", {
    className: "flow-edges"
  }, edges.map(edge => {
    const isActive = activeEdges.includes(edge.id);
    return /*#__PURE__*/React.createElement("g", {
      key: edge.id,
      className: `flow-edge ${isActive ? 'is-active' : ''}`
    }, styleObj.Edge ? /*#__PURE__*/React.createElement(styleObj.Edge, {
      edge: edge,
      active: isActive,
      style: styleObj
    }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: edge.d,
      fill: "none",
      stroke: isActive ? styleObj.tokens.edgeActive : styleObj.tokens.edge,
      strokeWidth: edge.kind === 'dashed' ? 2 : 2.5,
      strokeDasharray: edge.kind === 'dashed' ? '8,4' : 'none',
      strokeLinecap: "round",
      strokeLinejoin: "round",
      filter: isActive && animate ? 'url(#flow-glow)' : 'none'
    }), edge.label && /*#__PURE__*/React.createElement("text", {
      x: edge.points[1]?.x || 0,
      y: edge.points[1]?.y || 0,
      textAnchor: "middle",
      dominantBaseline: "middle",
      fontSize: "11",
      fill: styleObj.tokens.edgeLabel,
      fontFamily: "JetBrains Mono",
      dx: edge.dx || 0,
      dy: edge.dy || 18
    }, edge.label)));
  })), /*#__PURE__*/React.createElement("g", {
    className: "flow-nodes"
  }, nodes.map(node => {
    const isActive = activeNodes.includes(node.id);
    return /*#__PURE__*/React.createElement("g", {
      key: node.id,
      className: `flow-node ${isActive ? 'is-active' : ''}`,
      transform: `translate(${node.x + padding}, ${node.y + padding})`,
      onClick: () => onNodeClick?.(node),
      style: {
        cursor: onNodeClick ? 'pointer' : 'default'
      }
    }, styleObj.Node ? /*#__PURE__*/React.createElement(styleObj.Node, {
      node: node,
      active: isActive,
      style: styleObj
    }) : /*#__PURE__*/React.createElement(React.Fragment, null, (() => {
      const shape = shapePath$1(node.shape || 'rect', node.w, node.h);
      return /*#__PURE__*/React.createElement("path", {
        d: shape.d,
        fill: styleObj.tokens.nodeBg,
        stroke: styleObj.tokens.nodeBorder,
        strokeWidth: 1.5
      });
    })(), /*#__PURE__*/React.createElement("text", {
      x: node.w / 2,
      y: node.h / 2 - 4,
      textAnchor: "middle",
      dominantBaseline: "middle",
      fontSize: "13",
      fontWeight: "600",
      fill: styleObj.tokens.nodeInk,
      fontFamily: "Inter Tight"
    }, node.label), node.sub && /*#__PURE__*/React.createElement("text", {
      x: node.w / 2,
      y: node.h / 2 + 12,
      textAnchor: "middle",
      dominantBaseline: "middle",
      fontSize: "9.5",
      fill: styleObj.tokens.nodeSub,
      fontFamily: "JetBrains Mono"
    }, node.sub)));
  }))), showControls && /*#__PURE__*/React.createElement("div", {
    className: "flow-controls"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: handleDownload,
    title: "Download SVG"
  }, /*#__PURE__*/React.createElement(DownloadIcon, null)), /*#__PURE__*/React.createElement("button", {
    onClick: handleFullscreen,
    title: "Fullscreen"
  }, /*#__PURE__*/React.createElement(FullscreenIcon, null))), children);
}

// PropTypes for better DX
Diagram$1.propTypes = {
  graph: PropTypes.shape({
    nodes: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      kind: PropTypes.string,
      shape: PropTypes.string,
      x: PropTypes.number,
      y: PropTypes.number,
      w: PropTypes.number,
      h: PropTypes.number,
      sub: PropTypes.string
    })),
    edges: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      from: PropTypes.string.isRequired,
      to: PropTypes.string.isRequired,
      label: PropTypes.string,
      kind: PropTypes.oneOf(['solid', 'dashed'])
    })),
    canvas: PropTypes.shape({
      w: PropTypes.number,
      h: PropTypes.number
    })
  }).isRequired,
  style: PropTypes.oneOf(['sleek', 'sketch', 'iso', 'blueprint']),
  activeNodes: PropTypes.arrayOf(PropTypes.string),
  activeEdges: PropTypes.arrayOf(PropTypes.string),
  className: PropTypes.string,
  padding: PropTypes.number,
  onNodeClick: PropTypes.func,
  onEdgeClick: PropTypes.func,
  fullscreenTarget: PropTypes.object,
  showControls: PropTypes.bool,
  animate: PropTypes.bool
};

// Icons
function DownloadIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
  }));
}
function FullscreenIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
  }));
}

/**
 * Flow Diagram - Legacy renderers adapter
 * Exposes the existing renderers from renderers.jsx as modern modules
 */

// Re-export styles from the legacy system
const STYLES$2 = window.Flow?.STYLES || {};
window.Flow?.Diagram || (() => null);
const NodeIcon = window.Flow?.NodeIcon || (() => null);

// Default export
({
  shapePath,
  shapeAnchor
});

/**
 * Style definitions and registration system
 * Each style must export: Defs, Node, Edge, Background, tokens, motion
 */

const STYLES$1 = {
  ...STYLES$2
};
const registeredStyles = new Map();

/**
 * Register a new diagram style
 * Style modules must export: { Defs, Node, Edge, Background, tokens, motion }
 */
function registerStyle$1(name, styleModule) {
  const requiredExports = ['Node', 'Edge', 'tokens'];
  const missing = requiredExports.filter(exp => !styleModule[exp]);
  if (missing.length > 0) {
    throw new Error(`Cannot register style "${name}": missing required exports: ${missing.join(', ')}\n` + `Required: Node, Edge, tokens\n` + `Optional: Defs, Background, motion`);
  }
  if (registeredStyles.has(name)) {
    console.warn(`Style "${name}" is being overwritten`);
  }
  registeredStyles.set(name, {
    ...styleModule,
    id: name
  });

  // Merge with built-in styles for backwards compatibility
  if (!STYLES$1[name]) {
    STYLES$1[name] = registeredStyles.get(name);
  }
}

// Auto-register built-in styles
Object.entries(STYLES$2).forEach(([name, style]) => {
  registerStyle$1(name, style);
});

/**
 * Export Utility - handles serialization of SVG for external use
 */

function downloadSVG$1(svgElement, filename = "diagram.svg") {
  if (!svgElement) return;

  // Clone to avoid mutating the live DOM
  const clone = svgElement.cloneNode(true);

  // Ensure standard namespaces
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  // Add font import
  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;600&family=JetBrains+Mono:wght@400;600&display=swap');
    svg { font-family: 'Inter Tight', sans-serif; }
  `;
  clone.insertBefore(style, clone.firstChild);

  // Set explicit dimensions
  const bbox = svgElement.getBBox();
  const padding = 40;
  clone.setAttribute("width", bbox.width + padding * 2);
  clone.setAttribute("height", bbox.height + padding * 2);
  clone.setAttribute("viewBox", `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`);

  // Serialize to string
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(clone);

  // Add XML declaration
  if (!source.startsWith('<?xml')) {
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
  }

  // Create download link
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

/**
 * FlowDiagram - React component with DSL support
 */
function FlowDiagram$1({
  children,
  config,
  dsl,
  style = 'sleek',
  className = '',
  ...diagramProps
}) {
  // Parse DSL if provided
  const graph = React.useMemo(() => {
    if (config) {
      return config;
    }
    if (dsl) {
      try {
        return parseDSL$1(dsl);
      } catch (e) {
        console.error('Flow: Failed to parse DSL', e);
        return null;
      }
    }
    return null;
  }, [config, dsl]);
  if (!graph) {
    return /*#__PURE__*/React.createElement("div", {
      className: `flow-diagram-error ${className}`
    }, /*#__PURE__*/React.createElement("div", {
      className: "flow-error-content"
    }, /*#__PURE__*/React.createElement("h3", null, "Flow Diagram Error"), /*#__PURE__*/React.createElement("p", null, "No valid graph configuration provided."), /*#__PURE__*/React.createElement("p", null, "Provide either:", /*#__PURE__*/React.createElement("ul", null, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "config"), " - a graph object"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "dsl"), " - a DSL/YAML string")))));
  }
  return /*#__PURE__*/React.createElement(Diagram$1, _extends({
    className: `flow-react-diagram ${className}`,
    graph: graph,
    style: style
  }, diagramProps));
}
FlowDiagram$1.displayName = 'FlowDiagram';

/**
 * Vue 3 Wrapper Component
 */


/**
 * VueFlowDiagram - Vue 3 component
 */
const FlowDiagram = vue.defineComponent({
  name: 'FlowDiagram',
  props: {
    config: {
      type: Object,
      default: null
    },
    dsl: {
      type: String,
      default: ''
    },
    style: {
      type: String,
      default: 'sleek'
    },
    activeNodes: {
      type: Array,
      default: () => []
    },
    activeEdges: {
      type: Array,
      default: () => []
    },
    padding: {
      type: Number,
      default: 0
    },
    animate: {
      type: Boolean,
      default: true
    }
  },
  emits: ['node-click', 'edge-click'],
  setup(props, {
    emit,
    slots
  }) {
    const graph = vue.ref(null);
    const updateGraph = () => {
      if (props.config) {
        graph.value = props.config;
      } else if (props.dsl) {
        try {
          graph.value = parseDSL$1(props.dsl);
        } catch (e) {
          console.error('Flow: Failed to parse DSL', e);
          graph.value = null;
        }
      }
    };
    vue.watch(() => [props.config, props.dsl], updateGraph, {
      deep: true
    });
    vue.onMounted(updateGraph);
    return () => {
      if (!graph.value) {
        return vue.h('div', {
          class: 'flow-diagram-error'
        }, [vue.h('p', 'No valid graph configuration provided.')]);
      }
      return vue.h(Diagram$1, {
        graph: graph.value,
        style: props.style,
        activeNodes: props.activeNodes,
        activeEdges: props.activeEdges,
        padding: props.padding,
        animate: props.animate,
        onNodeClick: node => emit('node-click', node),
        onEdgeClick: edge => emit('edge-click', edge)
      });
    };
  }
});

/**
 * Angular Wrapper Module & Directive
 * 
 * Note: This is a conceptual wrapper since Angular typically
 * uses TypeScript components with proper DI. In a real Angular
 * app, you would create a proper Angular component that mounts
 * the Flow diagram.
 * 
 * Usage:
 * 
 * import { FlowDiagramModule } from 'flow-diagram'
 * 
 * // Create an Angular component that uses FlowDiagram
 * @Component({
 *   selector: 'app-diagram',
 *   template: '<div #diagramContainer></div>'
 * })
 * export class DiagramComponent implements AfterViewInit {
 *   @ViewChild('diagramContainer', {static: true}) container: ElementRef;
 *   
 *   ngAfterViewInit() {
 *     // Use FlowDiagram with the container
 *   }
 * }
 */

// The wrapper provides the conceptual structure for Angular integration
// since actual Angular components require TypeScript compilation

const FlowDiagramModule = {
  name: 'FlowDiagramModule',
  description: 'Angular wrapper for Flow Diagram (conceptual - see docs for implementation)',
  // Configuration helpers
  withConfig(config) {
    return {
      provide: 'FLOW_DIAGRAM_CONFIG',
      useValue: config
    };
  }
};

// For actual Angular usage, users should:
// 1. Install flow-diagram: npm install flow-diagram
// 2. Create an Angular component that mounts the diagram
// 3. Use the Diagram component directly or via the FlowDiagram component
// See the README for Angular integration examples

/**
 * DSL Utilities - Create graphs from configuration
 */


/**
 * Create a graph from a configuration object
 * Supports multiple input formats:
 * - DSL string
 * - Graph object
 * - URL to DSL
 */
async function createGraphFromConfig$1(config, options = {}) {
  if (!config) {
    throw new Error('No configuration provided');
  }
  let graph = null;

  // Case 1: DSL string
  if (typeof config === 'string') {
    try {
      graph = parseDSL$1(config);
    } catch (e) {
      // Maybe it's JSON?
      try {
        graph = JSON.parse(config);
      } catch (e2) {
        throw new Error('Failed to parse configuration: not valid DSL or JSON');
      }
    }
  }
  // Case 2: URL
  else if (typeof config === 'object' && config.url) {
    const response = await fetch(config.url);
    const text = await response.text();
    try {
      graph = parseDSL$1(text);
    } catch (e) {
      graph = JSON.parse(text);
    }
  }
  // Case 3: Graph object
  else if (typeof config === 'object') {
    graph = config;
  }
  if (!graph) {
    throw new Error('Could not create graph from configuration');
  }

  // Auto-resolve unless disabled
  if (options.resolve !== false) {
    graph = resolveGraph$1(graph);
  }
  return graph;
}

/**
 * Flow Diagram Library - Main Entry Point
 * Versatile diagram system for React, Vue, Angular, or plain HTML
 */


/**
 * Default export with everything
 */
const FlowDiagramLib = {
  // Core
  NODE_KINDS,
  SHAPES,
  EXAMPLE_GRAPH,
  EXAMPLE_GRAPH_FLAT,
  HERO_GRAPH,
  // Functions
  shapePath,
  shapeAnchor,
  parseDSL,
  resolveGraph,
  routeEdge,
  pathFromPoints,
  roughPath,
  downloadSVG,
  // Components
  Diagram,
  FlowDiagram: FlowDiagramLib,
  // Styles
  STYLES,
  registerStyle,
  // Utils
  createGraphFromConfig
};

exports.Diagram = Diagram$1;
exports.EXAMPLE_GRAPH = EXAMPLE_GRAPH$1;
exports.EXAMPLE_GRAPH_FLAT = EXAMPLE_GRAPH_FLAT$1;
exports.FlowDiagram = FlowDiagram$1;
exports.FlowDiagramModule = FlowDiagramModule;
exports.HERO_GRAPH = HERO_GRAPH$1;
exports.NODE_KINDS = NODE_KINDS$1;
exports.NodeIcon = NodeIcon;
exports.SHAPES = SHAPES$1;
exports.STYLES = STYLES$1;
exports.VueFlowDiagram = FlowDiagram;
exports.createGraphFromConfig = createGraphFromConfig$1;
exports.default = FlowDiagramLib;
exports.downloadSVG = downloadSVG$1;
exports.parseDSL = parseDSL$1;
exports.pathFromPoints = pathFromPoints$1;
exports.registerStyle = registerStyle$1;
exports.resolveGraph = resolveGraph$1;
exports.roughPath = roughPath$1;
exports.routeEdge = routeEdge$1;
exports.shapeAnchor = shapeAnchor$1;
exports.shapePath = shapePath$1;
//# sourceMappingURL=index.js.map
