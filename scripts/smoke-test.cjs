// Smoke test for the standalone bundle.
// Loads dist/flow-diagram.standalone.js, exercises every node kind across every style.
// Run with:  node scripts/smoke-test.js

const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '..', 'dist', 'flow-diagram.standalone.js');
const src = fs.readFileSync(bundlePath, 'utf8');

// Stub minimal browser globals so the bundle loads in Node
global.HTMLElement = class {};
global.customElements = { define: () => {}, get: () => null };
global.window = global;

// eslint-disable-next-line no-eval
eval(src);
const FD = global.FlowDiagram;

if (!FD || typeof FD.renderSVG !== 'function') {
  console.error('FAIL: FlowDiagram.renderSVG not exported on window');
  process.exit(1);
}

const KINDS = [
  'cache', 'queue', 'service', 'store', 'actor', 'gateway', 'external',
  'boundary', 'start', 'stop', 'process', 'function', 'worker', 'monitor',
  'bus', 'stream', 'firewall', 'mobile', 'event', 'decision', 'step',
  'tree', 'image', 'cdn', 'auth', 'loadbalancer'
];
const STYLES = ['sleek', 'sketch', 'iso', 'blueprint', 'city'];

let pass = 0;
let total = 0;
const errs = [];

for (const kind of KINDS) {
  for (const style of STYLES) {
    for (const active of [true, false]) {
      total++;
      try {
        const graph = {
          canvas: { w: 400, h: 300 },
          nodes: [{ id: 'n', kind, label: 'Test', sub: 'sub', x: 50, y: 50, w: 150, h: 80 }],
          edges: []
        };
        const svg = FD.renderSVG(graph, {
          styleName: style,
          activeNodes: active ? ['n'] : [],
          activeEdges: []
        });
        if (!svg || typeof svg !== 'string' || !svg.includes('<svg')) {
          throw new Error('no SVG output');
        }
        pass++;
      } catch (e) {
        errs.push(`${style}/${kind}/${active ? 'active' : 'idle'}: ${e.message}`);
      }
    }
  }
}

console.log(`Passed: ${pass} / ${total}`);
if (errs.length) {
  console.error('FAILURES:');
  for (const err of errs.slice(0, 20)) console.error('  - ' + err);
  if (errs.length > 20) console.error(`  ... and ${errs.length - 20} more`);
  process.exit(1);
}
console.log('OK: all kinds × all styles render without errors');
