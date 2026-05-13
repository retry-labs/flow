// End-to-end check of mount() using jsdom — simulates a real browser
// loading the standalone bundle and calling FD.mount on an actual DOM
// element. Verifies:
//   1. mount() does not throw
//   2. The SVG is actually appended to the DOM
//   3. The SVG has a viewBox (non-zero size)
//   4. The floating control buttons are present in the host
//
// Run:  node scripts/mount-e2e.cjs

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const bundlePath = path.join(__dirname, '..', 'dist', 'flow-diagram.standalone.js');
const bundle = fs.readFileSync(bundlePath, 'utf8');

const dom = new JSDOM(
  `<!DOCTYPE html>
   <html><head></head>
   <body>
     <div id="hero-stage" style="width: 800px; height: 420px;"></div>
     <div id="sc-canvas"  style="width: 600px; height: 320px;"></div>
   </body></html>`,
  { runScripts: 'outside-only', pretendToBeVisual: true },
);

const { window } = dom;
window.eval(bundle);
const FD = window.FlowDiagram;

let pass = 0, fail = 0;
const failures = [];
const check = (name, fn) => {
  try { fn(); console.log('  OK  ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' — ' + e.message); failures.push(name); fail++; }
};

const DSL = [
  'nodes:',
  '  - id: client,  kind: actor,   label: Client',
  '  - id: gateway, kind: service, label: Gateway',
  '  - id: db,      kind: store,   label: Postgres',
  'edges:',
  '  - client  -> gateway, label: "HTTPS"',
  '  - gateway -> db,      label: "SQL"',
].join('\n');

// ── Tests ────────────────────────────────────────────────
check('FlowDiagram global exposes mount', () => {
  if (typeof FD.mount !== 'function') throw new Error('no mount');
});

check('mount() into #hero-stage renders an SVG', () => {
  const host = window.document.getElementById('hero-stage');
  const vp = FD.mount(host, { graph: FD.parseDSL(DSL), styleName: 'sleek' });
  if (!vp) throw new Error('no viewport returned');
  const svg = host.querySelector('svg');
  if (!svg) throw new Error('no <svg> in the stage');
  const vb = svg.getAttribute('viewBox');
  if (!vb) throw new Error('svg missing viewBox');
  const parts = vb.split(/\s+/).map(Number);
  if (parts[2] <= 0 || parts[3] <= 0) throw new Error('viewBox has zero size: ' + vb);
});

check('mount() adds floating controls (zoom in/out/reset, fullscreen, download)', () => {
  const host = window.document.getElementById('sc-canvas');
  FD.mount(host, { graph: FD.parseDSL(DSL), styleName: 'city' });
  const buttons = host.querySelectorAll('button');
  if (buttons.length < 5) {
    throw new Error('expected ≥5 control buttons, got ' + buttons.length);
  }
  const titles = Array.from(buttons).map(b => b.getAttribute('title')).filter(Boolean);
  const expected = ['Zoom out', 'Reset view', 'Zoom in', 'Toggle fullscreen', 'Download SVG'];
  for (const t of expected) {
    if (!titles.includes(t)) throw new Error('missing control: ' + t);
  }
});

check('mount() host has .fd-host class and SVG fills its parent', () => {
  const container = window.document.getElementById('hero-stage');
  const hostDiv = container.querySelector('.fd-host');
  if (!hostDiv) throw new Error('.fd-host not found');
  const stage = hostDiv.querySelector('.fd-stage');
  if (!stage) throw new Error('.fd-stage not found');
  const svg = stage.querySelector('svg');
  if (!svg) throw new Error('svg not in .fd-stage');
  // svg should have width/height attributes (set by renderSVG: 100%/100%)
  const w = svg.getAttribute('width');
  const h = svg.getAttribute('height');
  if (!w || !h) throw new Error(`svg missing width/height attrs (w=${w}, h=${h})`);
});

check('setStyle() re-renders SVG with new style', () => {
  const host = window.document.createElement('div');
  host.style.width = '800px'; host.style.height = '420px';
  window.document.body.appendChild(host);
  const vp = FD.mount(host, { graph: FD.parseDSL(DSL), styleName: 'sleek' });
  const before = host.querySelector('svg').outerHTML.slice(0, 200);
  vp.setStyle('blueprint');
  const after = host.querySelector('svg').outerHTML.slice(0, 200);
  if (before === after) throw new Error('SVG did not change after setStyle');
});

console.log('\nPassed: ' + pass + ' / ' + (pass + fail));
if (fail) {
  console.error('FAILURES:\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
console.log('OK: mount() renders diagrams and wires controls in a real-ish DOM');
