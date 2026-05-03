// Regression test for edge anchor assignment.
// Ensures nodes connect on the SIDE FACING the other node, not the opposite end.
// Run with:  node scripts/anchor-test.cjs

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '..', 'dist', 'flow-diagram.standalone.js');
const src = fs.readFileSync(bundlePath, 'utf8');

global.HTMLElement = class {};
global.customElements = { define: () => {}, get: () => null };
global.window = global;

// eslint-disable-next-line no-eval
eval(src);
const FD = global.FlowDiagram;

const cases = [
  // A is to the left of B → A exits 'r', B enters 'l'
  {
    name: 'A left of B',
    a: { x: 0,   y: 100, w: 100, h: 60 },
    b: { x: 300, y: 100, w: 100, h: 60 },
    expectFromSide: 'r',
    expectToSide:   'l',
  },
  // A is to the right of B → A exits 'l', B enters 'r'
  {
    name: 'A right of B',
    a: { x: 300, y: 100, w: 100, h: 60 },
    b: { x: 0,   y: 100, w: 100, h: 60 },
    expectFromSide: 'l',
    expectToSide:   'r',
  },
  // A is above B → A exits 'b', B enters 't'
  {
    name: 'A above B',
    a: { x: 100, y: 0,   w: 100, h: 60 },
    b: { x: 100, y: 300, w: 100, h: 60 },
    expectFromSide: 'b',
    expectToSide:   't',
  },
  // A is below B → A exits 't', B enters 'b'
  {
    name: 'A below B',
    a: { x: 100, y: 300, w: 100, h: 60 },
    b: { x: 100, y: 0,   w: 100, h: 60 },
    expectFromSide: 't',
    expectToSide:   'b',
  },
  // Diagonal: A upper-left of B (more horizontal) → r → l
  {
    name: 'A upper-left of B (horizontal dominant)',
    a: { x: 0,   y: 50, w: 100, h: 60 },
    b: { x: 400, y: 100, w: 100, h: 60 },
    expectFromSide: 'r',
    expectToSide:   'l',
  },
];

let pass = 0, fail = 0;
const failures = [];

for (const c of cases) {
  const graph = {
    canvas: { w: 600, h: 400 },
    nodes: [
      Object.assign({ id: 'a', kind: 'service', label: 'A' }, c.a),
      Object.assign({ id: 'b', kind: 'service', label: 'B' }, c.b),
    ],
    edges: [{ id: 'e1', from: 'a', to: 'b' }],
  };

  const resolved = FD.resolveGraph(graph);
  const edge = resolved.edges[0];

  if (edge.fromSide === c.expectFromSide && edge.toSide === c.expectToSide) {
    pass++;
  } else {
    fail++;
    failures.push(`${c.name}: expected from=${c.expectFromSide} to=${c.expectToSide}, got from=${edge.fromSide} to=${edge.toSide}`);
  }
}

console.log(`Passed: ${pass} / ${cases.length}`);
if (fail) {
  console.error('FAILURES:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('OK: edges anchor on the correct facing sides');
