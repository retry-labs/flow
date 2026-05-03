(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('react'), require('react-dom/client')) :
  typeof define === 'function' && define.amd ? define(['exports', 'react', 'react-dom/client'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.FlowDiagram = {}, global.React, global.ReactDOM));
})(this, (function (exports, React, ReactDOM) { 'use strict';

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
  const SHAPES = ['rect', 'square', 'circle', 'oval', 'diamond', 'hex', 'pill', 'cylinder', 'cloud', 'parallelogram', 'shield', 'tablet', 'trapezoid', 'chevron'];
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
  function resolveGraph(graph) {
    // Apply auto-layout if ANY node is missing x or y. Mutates the input
    // nodes' x/y/w/h in place; downstream renderers can then count on them.
    const needsLayout = !graph.nodes || graph.nodes.some(n => n.kind !== 'boundary' && (n.x === undefined || n.y === undefined));
    if (needsLayout) {
      autoLayout(graph.nodes || [], graph.edges || []);
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
      const a = anchors[e.id];
      const t = edgeT[e.id];
      const pts = routeEdge(byId[e.from], byId[e.to], a.fromSide, a.toSide, t.fromT ?? 0.5, t.toT ?? 0.5);
      return {
        ...e,
        fromSide: a.fromSide,
        toSide: a.toSide,
        points: pts,
        d: pathFromPoints(pts, 10),
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
  // -----------------------------------------------------------

  function shapePath(shape, w, h) {
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

  // ---------- Shared helpers ----------

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
    const s = shapePath(shape, node.w, node.h);
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
      const isImg = node.kind === 'image' && node.src;
      const useKind = !node.shape && node.kind;
      const kindBody = useKind ? sleekKindBody(node, {
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
      })), kindBody && kindBody.decor, isImg && /*#__PURE__*/React.createElement("image", {
        href: node.src,
        x: node.w / 2 - 16,
        y: node.h / 2 - 22,
        width: "32",
        height: "32"
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
      const sw = isBold ? active ? 3 : 2.4 : active ? 2 : 1.4;
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
      const isImg = node.kind === 'image' && node.src;
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
      })), isImg && /*#__PURE__*/React.createElement("image", {
        href: node.src,
        x: node.w / 2 - 16,
        y: node.h / 2 - 22,
        width: "32",
        height: "32"
      }), !isImg && !['diamond', 'circle', 'oval', 'pill'].includes(shape) && /*#__PURE__*/React.createElement("g", {
        transform: "translate(12, 10)"
      }, /*#__PURE__*/React.createElement(NodeIcon, {
        kind: node.kind,
        color: ink,
        sketchy: true
      })), !isImg && ['diamond', 'circle', 'oval', 'pill'].includes(shape) && /*#__PURE__*/React.createElement("g", {
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
      const sw = isBold ? active ? 3 : 2.6 : active ? 2.2 : 1.5;
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
      const isImg = node.kind === 'image' && node.src;
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
      }), isImg && /*#__PURE__*/React.createElement("image", {
        href: node.src,
        x: w / 2 - 16,
        y: h / 2 - 22,
        width: "32",
        height: "32"
      }), !isImg && !['diamond', 'circle', 'oval', 'pill'].includes(shape) && /*#__PURE__*/React.createElement("g", {
        transform: "translate(10, 8)"
      }, /*#__PURE__*/React.createElement(NodeIcon, {
        kind: node.kind,
        color: active ? '#7a5a00' : '#475569'
      })), !isImg && ['diamond', 'circle', 'oval', 'pill'].includes(shape) && /*#__PURE__*/React.createElement("g", {
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
      const sw = isBold ? active ? 8 : 6 : active ? 6 : 4;
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
      const isImg = node.kind === 'image' && node.src;
      return /*#__PURE__*/React.createElement("g", {
        transform: `translate(${node.x} ${node.y})`
      }, /*#__PURE__*/React.createElement(ShapeShell, {
        node: node,
        fill: "none",
        stroke: stroke,
        strokeWidth: active ? 1.6 : 1,
        strokeDasharray: node.kind === 'external' ? '4 3' : undefined
      }), isImg && /*#__PURE__*/React.createElement("image", {
        href: node.src,
        x: node.w / 2 - 16,
        y: node.h / 2 - 22,
        width: "32",
        height: "32",
        opacity: ".9"
      }), !isImg && !['diamond', 'circle', 'oval', 'pill'].includes(shape) && /*#__PURE__*/React.createElement("g", {
        transform: "translate(10, 8)"
      }, /*#__PURE__*/React.createElement(NodeIcon, {
        kind: node.kind,
        color: stroke,
        mono: true
      })), !isImg && ['diamond', 'circle', 'oval', 'pill'].includes(shape) && /*#__PURE__*/React.createElement("g", {
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
      const sw = isBold ? active ? 2.2 : 1.8 : active ? 1.4 : 1;
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
      }, node.kind === 'image' && node.src ? /*#__PURE__*/React.createElement("image", {
        href: node.src,
        x: -16,
        y: -16,
        width: "32",
        height: "32"
      }) : !['queue', 'cache', 'gateway', 'client', 'actor', 'external', 'event'].includes(kind) ? /*#__PURE__*/React.createElement("g", {
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
      const coreSw = isBold ? 8 : 6,
        outerSw = isBold ? 11 : 8;
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
      console.warn(`flow-diagram: style "${name}" is being overwritten`);
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

  function Diagram({
    graph,
    style = 'sleek',
    activeNodes = [],
    activeEdges = [],
    padding = 28,
    className,
    fullscreenTarget = null,
    onNodeClick,
    onEdgeClick
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
    const btnBase = {
      background: 'transparent',
      border: 'none',
      padding: '7px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#64748b'
    };
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
    }, Style.Defs && /*#__PURE__*/React.createElement(Style.Defs, null), /*#__PURE__*/React.createElement(Style.Background, {
      w: G.canvas.w,
      h: G.canvas.h,
      grid: G.canvas.grid
    }), G.edges.map(e => /*#__PURE__*/React.createElement("g", {
      key: e.id,
      onClick: onEdgeClick ? () => onEdgeClick(e) : undefined,
      style: onEdgeClick ? {
        cursor: 'pointer'
      } : undefined
    }, /*#__PURE__*/React.createElement(Style.Edge, {
      edge: e,
      active: activeEdges.includes(e.id)
    }))), G.nodes.map(n => /*#__PURE__*/React.createElement("g", {
      key: n.id,
      onClick: onNodeClick ? () => onNodeClick(n) : undefined,
      style: onNodeClick ? {
        cursor: 'pointer'
      } : undefined
    }, /*#__PURE__*/React.createElement(Style.Node, {
      node: n,
      active: activeNodes.includes(n.id)
    })))), /*#__PURE__*/React.createElement("div", {
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
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        display: 'flex',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,.08)'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setZoom(z => Math.max(0.2, z / 1.25)),
      style: btnBase,
      title: "Zoom out"
    }, /*#__PURE__*/React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("circle", {
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
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 1,
        background: '#e2e8f0'
      }
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
      style: {
        width: 1,
        background: '#e2e8f0'
      }
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => setZoom(z => Math.min(4, z * 1.25)),
      style: btnBase,
      title: "Zoom in"
    }, /*#__PURE__*/React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("circle", {
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
    })))), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        const target = fullscreenTarget?.current || containerRef.current;
        if (document.fullscreenElement) document.exitFullscreen();else target?.requestFullscreen?.();
      },
      style: {
        ...btnBase,
        padding: 8,
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,.08)'
      },
      title: "Toggle fullscreen"
    }, isFullscreen ? /*#__PURE__*/React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
    })) : /*#__PURE__*/React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
    }))), /*#__PURE__*/React.createElement("button", {
      onClick: () => downloadSVG(svgRef.current, `diagram-${style}.svg`),
      style: {
        ...btnBase,
        padding: 8,
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,.08)'
      },
      title: "Download SVG"
    }, /*#__PURE__*/React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "7 10 12 15 17 10"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "15",
      x2: "12",
      y2: "3"
    })))));
  }

  // -----------------------------------------------------------
  // DSL Parser — converts YAML-like text into a Graph IR.
  // Zero dependencies. Works in any environment.
  // -----------------------------------------------------------

  function parseDSL(text) {
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
          const kindM = parts.match(/kind:\s*(\S+)/);
          if (kindM) edge.kind = kindM[1];
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

  const OBSERVED = ['dsl', 'config', 'style', 'active-nodes', 'active-edges', 'height'];
  class FlowDiagramElement extends HTMLElement {
    static get observedAttributes() {
      return OBSERVED;
    }
    constructor() {
      super();
      this._root = null;
      this._reactRoot = null;
    }
    connectedCallback() {
      if (!this._root) {
        this._root = document.createElement('div');
        this._root.style.cssText = 'width:100%;height:100%;display:block;';
        this.appendChild(this._root);
      }
      this._mount();
    }
    disconnectedCallback() {
      if (this._reactRoot) {
        this._reactRoot.unmount();
        this._reactRoot = null;
      }
    }
    attributeChangedCallback() {
      if (this._root) this._mount();
    }
    _mount() {
      const dsl = this.getAttribute('dsl');
      const style = this.getAttribute('style') || this.getAttribute('diagram-style') || 'sleek';
      const height = this.getAttribute('height') || '400px';
      const rawAN = this.getAttribute('active-nodes') || '';
      const rawAE = this.getAttribute('active-edges') || '';
      const activeNodes = rawAN ? rawAN.split(',').map(s => s.trim()) : [];
      const activeEdges = rawAE ? rawAE.split(',').map(s => s.trim()) : [];
      let graph = null;
      try {
        const configAttr = this.getAttribute('config');
        if (configAttr) {
          graph = JSON.parse(configAttr);
        } else if (this._configProp) {
          graph = this._configProp;
        } else if (dsl) {
          graph = parseDSL(dsl);
        }
      } catch (e) {
        console.error('[flow-diagram] Failed to parse config/dsl:', e);
      }
      if (!graph) return;
      this._root.style.height = height;
      const el = /*#__PURE__*/React.createElement(Diagram, {
        graph,
        style,
        activeNodes,
        activeEdges,
        onNodeClick: n => this.dispatchEvent(new CustomEvent('node-click', {
          detail: n,
          bubbles: true
        })),
        onEdgeClick: e => this.dispatchEvent(new CustomEvent('edge-click', {
          detail: e,
          bubbles: true
        }))
      });
      if (!this._reactRoot) {
        this._reactRoot = ReactDOM.createRoot(this._root);
      }
      this._reactRoot.render(el);
    }
    set config(val) {
      this._configProp = val;
      if (this._root) this._mount();
    }
  }
  if (typeof customElements !== 'undefined' && !customElements.get('flow-diagram')) {
    customElements.define('flow-diagram', FlowDiagramElement);
  }

  // -----------------------------------------------------------
  // UMD / Browser bundle entry.
  // Registers the <flow-diagram> Web Component and exposes the
  // full API on window.FlowDiagram for plain-HTML usage.
  // -----------------------------------------------------------

  if (typeof window !== 'undefined') {
    window.FlowDiagram = {
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
  exports.FlowDiagramElement = FlowDiagramElement;
  exports.NODE_KINDS = NODE_KINDS;
  exports.NodeIcon = NodeIcon;
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
//# sourceMappingURL=flow-diagram.umd.js.map
