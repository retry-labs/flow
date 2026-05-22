// Showcase examples test.
// Reads website/examples/index.json, then for each listed .flow file
// validates the DSL body:
//   1. parses through FD.parseDSL without errors,
//   2. produces at least one node,
//   3. renders through FD.renderSVG without throwing, yielding valid SVG.
//
// The .flow files use a YAML-style front-matter block (---...---) followed
// by the DSL body — same format the showcase page parses at runtime.
//
// Run with:  node scripts/showcase-test.cjs

const fs = require('fs');
const path = require('path');

// ── Load the standalone bundle into a fake window global ────────────
const bundlePath = path.join(__dirname, '..', 'dist', 'flow.standalone.js');
const src = fs.readFileSync(bundlePath, 'utf8');
global.HTMLElement = class {};
global.customElements = { define: () => {}, get: () => null };
global.window = global;
// eslint-disable-next-line no-eval
eval(src);
const FD = global.RLFlow;
if (!FD || typeof FD.parseDSL !== 'function' || typeof FD.renderSVG !== 'function') {
  console.error('FAIL: window.RLFlow API missing');
  process.exit(1);
}

// ── Read the manifest + each .flow file ────────────────────────────
const examplesDir = path.join(__dirname, '..', '..', '..', 'website', 'examples');
const manifestPath = path.join(examplesDir, 'index.json');

if (!fs.existsSync(manifestPath)) {
  console.error('FAIL: missing manifest at ' + manifestPath);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const files = manifest.files || [];

if (!files.length) {
  console.error('FAIL: manifest lists no files');
  process.exit(1);
}

// Same front-matter parser shape as showcase.html. Splits off the
// `---\n...\n---\n` block and returns the DSL body. (Front-matter
// fields aren't needed for the parse/render check.)
function extractDSL(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m ? m[2] : text;
}

const examples = [];
for (const file of files) {
  const p = path.join(examplesDir, file);
  if (!fs.existsSync(p)) {
    console.error('FAIL: manifest references missing file ' + file);
    process.exit(1);
  }
  examples.push({ id: file.replace(/\.flow$/, ''), dsl: extractDSL(fs.readFileSync(p, 'utf8')) });
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
      '  OK  ' + ex.id.padEnd(28) +
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
console.log('OK: every showcase example parses + renders cleanly');
