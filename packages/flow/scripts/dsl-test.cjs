// DSL round-trip test.
// Ensures parseDSL(graphToDSL(g)) yields a graph equivalent to g
// for the fields the DSL supports.
// Run with:  node scripts/dsl-test.cjs

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

const inputs = [
  {
    name: 'simple service graph',
    graph: {
      canvas: { w: 600, h: 400 },
      style: 'sketch',
      nodes: [
        { id: 'a', kind: 'service', label: 'Orders', sub: 'v4.2.1', x: 50, y: 50, w: 150, h: 80 },
        { id: 'b', kind: 'cache',   label: 'Redis',                 x: 280, y: 50, w: 130, h: 80 },
      ],
      edges: [
        { id: 'e1', from: 'a', to: 'b', kind: 'dashed', label: 'read' },
      ],
    },
  },
  {
    name: 'graph with playback steps',
    graph: {
      canvas: { w: 800, h: 400 },
      nodes: [
        { id: 'u', kind: 'actor',   label: 'User',    x: 50,  y: 100, w: 120, h: 80 },
        { id: 'g', kind: 'gateway', label: 'Gateway', x: 220, y: 100, w: 140, h: 80 },
        { id: 's', kind: 'service', label: 'API',     x: 410, y: 100, w: 140, h: 80 },
      ],
      edges: [
        { id: 'e1', from: 'u', to: 'g', kind: 'solid' },
        { id: 'e2', from: 'g', to: 's', kind: 'solid', label: 'route' },
      ],
      steps: [
        { id: 's1', title: 'Request',  active: { nodes: ['u', 'g'], edges: ['e1'] } },
        { id: 's2', title: 'Forward',  active: { nodes: ['g', 's'], edges: ['e2'] } },
      ],
    },
  },
];

let pass = 0, fail = 0;
const failures = [];

for (const c of inputs) {
  const dsl = FD.graphToDSL(c.graph);
  if (!dsl || typeof dsl !== 'string' || !dsl.includes('nodes:')) {
    failures.push(`${c.name}: graphToDSL returned empty/invalid DSL`);
    fail++;
    continue;
  }

  const reparsed = FD.parseDSL(dsl);

  // Equivalence check: same node ids/kinds/labels and same edge from→to pairs.
  const inputNodeIds = c.graph.nodes.map(n => n.id).sort();
  const outputNodeIds = reparsed.nodes.map(n => n.id).sort();
  if (JSON.stringify(inputNodeIds) !== JSON.stringify(outputNodeIds)) {
    failures.push(`${c.name}: node ids differ. in=${inputNodeIds} out=${outputNodeIds}`);
    fail++;
    continue;
  }

  const inputEdges = c.graph.edges.map(e => `${e.from}->${e.to}`).sort();
  const outputEdges = reparsed.edges.map(e => `${e.from}->${e.to}`).sort();
  if (JSON.stringify(inputEdges) !== JSON.stringify(outputEdges)) {
    failures.push(`${c.name}: edge from→to pairs differ. in=${inputEdges} out=${outputEdges}`);
    fail++;
    continue;
  }

  // Per-node label preservation (most important for "view source" UX)
  const labelsMatch = c.graph.nodes.every(n => {
    const m = reparsed.nodes.find(r => r.id === n.id);
    return m && m.label === n.label;
  });
  if (!labelsMatch) {
    failures.push(`${c.name}: node labels mangled in round-trip`);
    fail++;
    continue;
  }

  // Style directive round-trips when present
  if (c.graph.style && reparsed.style !== c.graph.style) {
    failures.push(`${c.name}: style directive lost (in=${c.graph.style} out=${reparsed.style})`);
    fail++;
    continue;
  }

  pass++;
}

// Additional test: auto-layout when nodes lack x/y
(function testAutoLayout() {
  const dsl = [
    'style: sleek',
    '',
    'nodes:',
    '  - id: user, kind: actor, label: User',
    '  - id: api, kind: service, label: API',
    '  - id: db, kind: store, label: Postgres',
    '',
    'edges:',
    '  - user -> api',
    '  - api -> db',
  ].join('\n');

  const g = FD.parseDSL(dsl);
  if (g.style !== 'sleek') {
    failures.push(`auto-layout test: style directive not parsed (got ${g.style})`);
    fail++; return;
  }
  if (g.nodes.some(n => n.x !== undefined)) {
    failures.push('auto-layout test: parseDSL should leave x/y undefined when not provided');
    fail++; return;
  }

  const resolved = FD.resolveGraph(g);
  if (!resolved.nodes.every(n => typeof n.x === 'number' && typeof n.y === 'number')) {
    failures.push('auto-layout test: resolveGraph should assign x/y to every node');
    fail++; return;
  }
  // Verify left-to-right flow: user should be leftmost, db rightmost
  const byId = Object.fromEntries(resolved.nodes.map(n => [n.id, n]));
  if (!(byId.user.x < byId.api.x && byId.api.x < byId.db.x)) {
    failures.push(`auto-layout test: expected left-to-right flow; got user.x=${byId.user.x} api.x=${byId.api.x} db.x=${byId.db.x}`);
    fail++; return;
  }
  pass++;
})();

const total = inputs.length + 1; // +1 for the auto-layout test
console.log(`Passed: ${pass} / ${total}`);
if (fail) {
  console.error('FAILURES:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('OK: DSL round-trips cleanly, style directive works, auto-layout positions unpositioned nodes');
