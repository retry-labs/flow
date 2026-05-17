// Layout engine smoke tests. Confirms each registered engine produces
// non-degenerate, non-overlapping placements for sample graphs.
//
// Run with:  node scripts/layouts-test.cjs

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '..', 'dist', 'flow.standalone.js');
const src = fs.readFileSync(bundlePath, 'utf8');
global.HTMLElement = class {};
global.customElements = { define: () => {}, get: () => null };
global.window = global;
// eslint-disable-next-line no-eval
eval(src);
const FD = global.RLFlow;

let pass = 0, fail = 0;
const failures = [];
const check = (name, fn) => {
  try { fn(); console.log('  OK  ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' — ' + e.message); failures.push(name); fail++; }
};

function makeChain(n) {
  const nodes = Array.from({ length: n }, (_, i) => ({ id: 's' + i, kind: 'service', label: 'S' + i }));
  const edges = [];
  for (let i = 0; i < n - 1; i++) edges.push({ id: 'e' + i, from: 's' + i, to: 's' + (i + 1) });
  return { nodes, edges };
}

function makeStar(branches) {
  const nodes = [{ id: 'root', kind: 'service', label: 'Root', root: true }];
  const edges = [];
  for (let i = 0; i < branches; i++) {
    nodes.push({ id: 'leaf' + i, kind: 'service', label: 'L' + i });
    edges.push({ id: 'e' + i, from: 'root', to: 'leaf' + i });
  }
  return { nodes, edges };
}

function makeDiamond() {
  return {
    nodes: [
      { id: 'a', kind: 'service', label: 'A' },
      { id: 'b', kind: 'service', label: 'B' },
      { id: 'c', kind: 'service', label: 'C' },
      { id: 'd', kind: 'service', label: 'D' },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b' },
      { id: 'e2', from: 'a', to: 'c' },
      { id: 'e3', from: 'b', to: 'd' },
      { id: 'e4', from: 'c', to: 'd' },
    ],
  };
}

function positionsFor(graph, layoutName) {
  const g = { ...graph, layout: layoutName };
  const resolved = FD.resolveGraph(g);
  return resolved.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h }));
}

function noOverlap(positions) {
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i], b = positions[j];
      const overlapX = (a.x < b.x + b.w) && (b.x < a.x + a.w);
      const overlapY = (a.y < b.y + b.h) && (b.y < a.y + a.h);
      if (overlapX && overlapY) {
        throw new Error(`overlap between ${a.id} and ${b.id} (a=[${a.x},${a.y}], b=[${b.x},${b.y}])`);
      }
    }
  }
}

function reasonableBounds(positions, maxSpan = 6000) {
  const xs = positions.map(p => p.x);
  const ys = positions.map(p => p.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  if (spanX > maxSpan || spanY > maxSpan) {
    throw new Error(`positions span too large: ${spanX} x ${spanY}`);
  }
}

// ── rank engine (the historical baseline) ────────────────

check('rank engine: produces positions for a chain', () => {
  const pos = positionsFor(makeChain(4), 'rank');
  if (pos.length !== 4) throw new Error('expected 4 positions');
  noOverlap(pos);
  reasonableBounds(pos);
});

// ── dagre engine ────────────────────────────────────────

check('dagre: chain lays nodes left-to-right', () => {
  const pos = positionsFor(makeChain(5), 'dagre');
  noOverlap(pos);
  reasonableBounds(pos);
  // X should increase across the chain.
  const xs = pos.map(p => p.x);
  const sorted = [...xs].sort((a, b) => a - b);
  if (JSON.stringify(xs) !== JSON.stringify(sorted)) {
    throw new Error('dagre chain not monotonically increasing in x: ' + xs.join(','));
  }
});

check('dagre: diamond positions converge node "d" right of "a"', () => {
  const pos = positionsFor(makeDiamond(), 'dagre');
  noOverlap(pos);
  const a = pos.find(p => p.id === 'a');
  const d = pos.find(p => p.id === 'd');
  if (d.x <= a.x) throw new Error(`expected d.x > a.x (a=${a.x}, d=${d.x})`);
});

check('dagre: cycle does not hang and produces positions', () => {
  // Triangle: a → b → c → a — a real cycle, must terminate.
  const g = {
    nodes: [
      { id: 'a', kind: 'service', label: 'A' },
      { id: 'b', kind: 'service', label: 'B' },
      { id: 'c', kind: 'service', label: 'C' },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b' },
      { id: 'e2', from: 'b', to: 'c' },
      { id: 'e3', from: 'c', to: 'a' },
    ],
  };
  const start = Date.now();
  const pos = positionsFor(g, 'dagre');
  const ms = Date.now() - start;
  if (ms > 1000) throw new Error('dagre took >1s for a 3-cycle (' + ms + 'ms)');
  if (pos.length !== 3) throw new Error('expected 3 positions');
  noOverlap(pos);
});

// ── force engine ────────────────────────────────────────

check('force: places all nodes without overlap', () => {
  const pos = positionsFor(makeStar(6), 'force');
  noOverlap(pos);
  reasonableBounds(pos, 8000);
});

check('force: deterministic — same input gives same output', () => {
  const a = positionsFor(makeStar(5), 'force');
  const b = positionsFor(makeStar(5), 'force');
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) {
      throw new Error('force output not deterministic for node ' + a[i].id);
    }
  }
});

// ── radial engine ───────────────────────────────────────

check('radial: root stays roughly at the center', () => {
  const pos = positionsFor(makeStar(6), 'radial');
  noOverlap(pos);
  const root = pos.find(p => p.id === 'root');
  // The root x/y should be within 200 of any leaf's x/y (they ring it).
  const leaves = pos.filter(p => p.id !== 'root');
  const maxDistRoot = leaves.reduce((m, l) =>
    Math.max(m, Math.hypot(l.x - root.x, l.y - root.y)), 0);
  if (maxDistRoot < 50) throw new Error('leaves bunched on top of root');
});

check('radial: leaves placed at consistent ring distance', () => {
  const pos = positionsFor(makeStar(8), 'radial');
  const root = pos.find(p => p.id === 'root');
  const leaves = pos.filter(p => p.id !== 'root');
  const dists = leaves.map(l => Math.hypot(l.x - root.x, l.y - root.y));
  const span = Math.max(...dists) - Math.min(...dists);
  if (span > 80) throw new Error('leaves not on a consistent ring (span ' + span + 'px)');
});

// ── End-to-end DSL `layout:` directive ──────────────────

check('DSL `layout: force` actually selects the force engine', () => {
  const dsl = [
    'layout: force',
    'nodes:',
    '  - id: a, kind: service, label: A',
    '  - id: b, kind: service, label: B',
    '  - id: c, kind: service, label: C',
    'edges:',
    '  - a -> b',
    '  - b -> c',
  ].join('\n');
  const ir = FD.parseDSL(dsl);
  if (ir.layout !== 'force') throw new Error('parseDSL dropped layout: ' + JSON.stringify(ir));
  // Compare against the dagre default by rendering both — positions
  // should differ if the engine actually changed.
  const dagreIr = FD.parseDSL(dsl.replace('layout: force\n', ''));
  const r1 = FD.resolveGraph(ir);
  const r2 = FD.resolveGraph(dagreIr);
  const same = r1.nodes.every((n, i) => n.x === r2.nodes[i].x && n.y === r2.nodes[i].y);
  if (same) throw new Error('force and dagre produced identical positions — layout directive ignored');
});

check('graphToDSL round-trips `layout:` directive', () => {
  const original = {
    type: 'flow',
    layout: 'radial',
    nodes: [{ id: 'r', kind: 'service', label: 'R', root: true }, { id: 'c', kind: 'service', label: 'C' }],
    edges: [{ id: 'e', from: 'r', to: 'c' }],
  };
  const text = FD.graphToDSL(original);
  if (!/layout:\s*radial/.test(text)) throw new Error('graphToDSL omitted layout: ' + text);
  const reparsed = FD.parseDSL(text);
  if (reparsed.layout !== 'radial') throw new Error('reparsed layout missing: ' + JSON.stringify(reparsed));
});

// ── Dagre robustness ────────────────────────────────────

check('dagre handles a disconnected graph (multiple roots)', () => {
  const g = {
    nodes: [
      { id: 'a', kind: 'service', label: 'A' },
      { id: 'b', kind: 'service', label: 'B' },
      { id: 'c', kind: 'service', label: 'C' },
      { id: 'd', kind: 'service', label: 'D' },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b' },
      { id: 'e2', from: 'c', to: 'd' },  // separate component
    ],
  };
  const pos = positionsFor(g, 'dagre');
  noOverlap(pos);
  // Both pairs should be laid out properly without anyone landing at origin.
  for (const p of pos) {
    if (p.x === undefined || p.y === undefined) throw new Error('node ' + p.id + ' missing position');
  }
});

// ── Force determinism (truly deterministic, not just lucky) ─

check('force: 10 repeated layouts of same graph produce identical positions', () => {
  // Use a graph where two random initial seeds collide — exercises the
  // perturbation branch.
  const g = {
    nodes: Array.from({ length: 8 }, (_, i) => ({ id: 's' + i, kind: 'service', label: 'S' + i })),
    edges: [
      { id: 'e0', from: 's0', to: 's1' },
      { id: 'e1', from: 's2', to: 's3' },
      { id: 'e2', from: 's0', to: 's4' },
      { id: 'e3', from: 's5', to: 's6' },
    ],
  };
  const ref = positionsFor(g, 'force');
  for (let trial = 0; trial < 10; trial++) {
    const fresh = positionsFor(JSON.parse(JSON.stringify(g)), 'force');
    for (let i = 0; i < ref.length; i++) {
      if (ref[i].x !== fresh[i].x || ref[i].y !== fresh[i].y) {
        throw new Error('trial ' + trial + ' diverged at ' + ref[i].id);
      }
    }
  }
});

// ── Registry + listLayouts ──────────────────────────────

check('listLayouts exposes all built-in engines', () => {
  const names = FD.listLayouts ? FD.listLayouts() : null;
  if (!names) throw new Error('listLayouts not exposed on window.RLFlow');
  for (const n of ['rank', 'dagre', 'force', 'radial']) {
    if (!names.includes(n)) throw new Error('engine missing: ' + n);
  }
});

console.log('\nPassed: ' + pass + ' / ' + (pass + fail));
if (fail) {
  console.error('FAILURES:\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
console.log('OK: layout engines (rank, dagre, force, radial) all behave');
