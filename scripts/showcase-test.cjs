// Showcase DSL test.
// Parses examples/showcase.html, extracts every `dsl: [...].join('\n')`
// block, and verifies each one:
//   1. parses through FD.parseDSL without errors,
//   2. produces at least one node,
//   3. renders through FD.renderSVG without throwing, yielding valid SVG.
// Run with:  node scripts/showcase-test.cjs

const fs = require('fs');
const path = require('path');

// ── Load the standalone bundle into a fake window global ────────────
const bundlePath = path.join(__dirname, '..', 'dist', 'flow-diagram.standalone.js');
const src = fs.readFileSync(bundlePath, 'utf8');
global.HTMLElement = class {};
global.customElements = { define: () => {}, get: () => null };
global.window = global;
// eslint-disable-next-line no-eval
eval(src);
const FD = global.FlowDiagram;
if (!FD || typeof FD.parseDSL !== 'function' || typeof FD.renderSVG !== 'function') {
  console.error('FAIL: window.FlowDiagram API missing');
  process.exit(1);
}

// ── Extract every DSL example from showcase.html ────────────────────
const htmlPath = path.join(__dirname, '..', 'showcase.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Matches blocks of the shape:
//   { id: 'foo',
//     ...
//     dsl: [
//       'line',
//       'line',
//     ].join('\n'),
//     ... },
const blockRe = /id:\s*'([^']+)',[\s\S]*?dsl:\s*\[([\s\S]*?)\]\.join\('\\n'\)/g;

const examples = [];
let m;
while ((m = blockRe.exec(html)) !== null) {
  const id = m[1];
  const inner = m[2];
  // Pull each 'quoted string' entry out of the array literal. Treats \' as
  // an escaped quote (not needed today but kept defensively).
  const lines = [];
  const strRe = /'((?:\\'|[^'])*)'/g;
  let sm;
  while ((sm = strRe.exec(inner)) !== null) {
    lines.push(sm[1].replace(/\\'/g, "'"));
  }
  examples.push({ id, dsl: lines.join('\n') });
}

if (examples.length === 0) {
  console.error('FAIL: found no showcase DSL blocks in ' + htmlPath);
  process.exit(1);
}

// ── Verify each one ─────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];

for (const ex of examples) {
  try {
    const g = FD.parseDSL(ex.dsl);
    if (!g || !Array.isArray(g.nodes) || g.nodes.length === 0) {
      throw new Error('parseDSL produced no nodes');
    }
    const styleName = g.style || 'sleek';
    const svg = FD.renderSVG(g, { styleName });
    if (typeof svg !== 'string' || !svg.startsWith('<svg')) {
      throw new Error('renderSVG did not return valid SVG');
    }
    console.log(
      '  OK  ' + ex.id.padEnd(12) +
      ' nodes=' + String(g.nodes.length).padStart(2) +
      '  edges=' + String((g.edges || []).length).padStart(2) +
      '  style=' + styleName
    );
    pass++;
  } catch (err) {
    failures.push(ex.id + ': ' + err.message);
    fail++;
  }
}

console.log('\nPassed: ' + pass + ' / ' + examples.length);
if (fail) {
  console.error('FAILURES:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('OK: every showcase DSL parses + renders cleanly');
