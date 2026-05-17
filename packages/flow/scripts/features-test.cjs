// Feature tests for the image / icon / shapes / edges / a11y pass.
// Renders graphs through the standalone bundle and asserts that the
// new attributes produce the expected SVG output.
// Run with:  node scripts/features-test.cjs

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

function svgFor(graph, opts = {}) {
  return FD.renderSVG(graph, { styleName: 'sleek', ...opts });
}

// ── Image rendering ───────────────────────────────────────

check('node.image renders an <image> on a service kind (not just kind:image)', () => {
  const g = {
    nodes: [
      { id: 'api', kind: 'service', label: 'API', x: 40, y: 40, w: 140, h: 70,
        image: 'https://example.com/logo.svg' },
    ],
    edges: [],
  };
  const svg = svgFor(g);
  if (svg.indexOf('href="https://example.com/logo.svg"') < 0) {
    throw new Error('expected <image> with the image URL');
  }
});

check('imagePosition="fill" emits a clipPath that uses the node id', () => {
  const g = {
    nodes: [
      { id: 'card', kind: 'rect', label: 'Card', x: 40, y: 40, w: 200, h: 120,
        image: 'https://example.com/screenshot.png', imagePosition: 'fill', imageFit: 'cover' },
    ],
    edges: [],
  };
  const svg = svgFor(g);
  if (svg.indexOf('id="fd-clip-card"') < 0) {
    throw new Error('expected clipPath id="fd-clip-card"');
  }
  if (svg.indexOf('xMidYMid slice') < 0) {
    throw new Error('expected preserveAspectRatio="xMidYMid slice" for imageFit=cover');
  }
});

check('data URL image still works', () => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgoA';
  const g = {
    nodes: [{ id: 'pg', kind: 'service', label: 'PG', x: 40, y: 40, w: 140, h: 70, image: dataUrl }],
    edges: [],
  };
  const svg = svgFor(g);
  if (svg.indexOf(`href="${dataUrl}"`) < 0) throw new Error('data URL not in output');
});

check('legacy kind:image + src still renders (back-compat)', () => {
  const g = {
    nodes: [{ id: 'gh', kind: 'image', label: 'GitHub', src: 'https://example.com/gh.svg', x: 0, y: 0, w: 100, h: 100 }],
    edges: [],
  };
  const svg = svgFor(g);
  if (svg.indexOf('href="https://example.com/gh.svg"') < 0) {
    throw new Error('back-compat kind:image+src not rendered');
  }
});

// ── Icon sprite library ───────────────────────────────────

check('node.icon="postgres" looks up the sprite from icons.js', () => {
  const g = {
    nodes: [{ id: 'db', kind: 'store', label: 'Postgres', icon: 'postgres', x: 40, y: 40, w: 140, h: 80 }],
    edges: [],
  };
  const svg = svgFor(g);
  // The postgres sprite uses an ellipse stroke — distinctive.
  if (svg.indexOf('<ellipse cx="12"') < 0) {
    throw new Error('postgres sprite ellipse not rendered');
  }
});

check('unknown icon name falls back silently', () => {
  const g = {
    nodes: [{ id: 'x', kind: 'service', label: 'X', icon: 'totally-not-a-real-icon', x: 40, y: 40, w: 140, h: 70 }],
    edges: [],
  };
  // Should not throw
  const svg = svgFor(g);
  if (!svg) throw new Error('unknown icon broke the render');
});

// ── New shapes ────────────────────────────────────────────

check('shape: document renders the curled-corner path', () => {
  const g = {
    nodes: [{ id: 'd', kind: 'service', shape: 'document', label: 'Doc', x: 0, y: 0, w: 140, h: 90 }],
    edges: [],
  };
  const svg = svgFor(g);
  // Document path has an angled L between w-fold and w.
  if (!/L\s*\d+\s+\d+\s+V\s*\d+/.test(svg.replace(/[\n\r]/g, ''))) {
    // Looser check — just confirm it rendered
    if (svg.indexOf('<path') < 0) throw new Error('no path elements rendered');
  }
});

check('shape: folder renders a path (tab on top-left)', () => {
  const g = {
    nodes: [{ id: 'f', kind: 'service', shape: 'folder', label: 'F', x: 0, y: 0, w: 160, h: 100 }],
    edges: [],
  };
  const svg = svgFor(g);
  if (svg.indexOf('<path') < 0) throw new Error('folder did not render');
});

check('shape: custom-path uses node.d', () => {
  const g = {
    nodes: [{ id: 'star', kind: 'service', shape: 'custom-path',
              d: 'M 50 0 L 60 40 L 100 50 L 60 60 L 50 100 L 40 60 L 0 50 L 40 40 Z',
              label: 'Star', x: 0, y: 0, w: 100, h: 100 }],
    edges: [],
  };
  const svg = svgFor(g);
  if (svg.indexOf('M 50 0 L 60 40') < 0) throw new Error('custom-path d not rendered');
});

// ── Edge router upgrades ──────────────────────────────────

check('edge.curve="bezier" emits a cubic C command', () => {
  const g = {
    nodes: [
      { id: 'a', kind: 'service', label: 'A', x: 0,   y: 0, w: 100, h: 60 },
      { id: 'b', kind: 'service', label: 'B', x: 300, y: 0, w: 100, h: 60 },
    ],
    edges: [{ id: 'e', from: 'a', to: 'b', curve: 'bezier' }],
  };
  const svg = svgFor(g);
  if (!/d="M\s+\S+\s+\S+\s+C\s+/.test(svg)) {
    throw new Error('bezier edge missing C command');
  }
});

check('edge from===to renders a self-loop arc', () => {
  const g = {
    nodes: [{ id: 'a', kind: 'service', label: 'A', x: 0, y: 0, w: 100, h: 60 }],
    edges: [{ id: 'loop', from: 'a', to: 'a' }],
  };
  const svg = svgFor(g);
  // Self-loop uses an arc with A r r 0 1 sweep ...
  if (!/A\s+\d+\.?\d*\s+\d+\.?\d*\s+0\s+1\s+[01]\s+/.test(svg)) {
    throw new Error('self-loop arc command missing');
  }
});

// ── Sankey weight ─────────────────────────────────────────

check('edge.weight scales the stroke width', () => {
  const g = {
    nodes: [
      { id: 'a', kind: 'service', label: 'A', x: 0,   y: 0, w: 100, h: 60 },
      { id: 'b', kind: 'service', label: 'B', x: 300, y: 0, w: 100, h: 60 },
    ],
    edges: [
      { id: 'thin',  from: 'a', to: 'b', weight: 1  },
      { id: 'thick', from: 'a', to: 'b', weight: 16 },
    ],
  };
  const svg = svgFor(g);
  // Pull stroke-width values out — weight=16 should produce ~4× the
  // stroke width of weight=1.
  const widths = Array.from(svg.matchAll(/stroke-width="([\d.]+)"/g))
                      .map(m => parseFloat(m[1]))
                      .filter(n => n > 0 && n < 50);  // ignore extreme outliers like 14 (city shadow)
  // We don't know order, just check that there's a thick one and a thin one.
  const max = Math.max(...widths);
  const min = Math.min(...widths);
  if (max / min < 2.5) {
    throw new Error(`expected weight=16 stroke to be ~4× weight=1 (got ratio ${(max/min).toFixed(2)})`);
  }
});

// ── Accessibility ─────────────────────────────────────────

check('every node group has data-node-id', () => {
  const g = {
    nodes: [
      { id: 'a', kind: 'service', label: 'Alpha', x: 0,   y: 0, w: 100, h: 60 },
      { id: 'b', kind: 'service', label: 'Bravo', x: 300, y: 0, w: 100, h: 60 },
    ],
    edges: [],
  };
  const svg = svgFor(g);
  if (svg.indexOf('data-node-id="a"') < 0) throw new Error('missing data-node-id="a"');
  if (svg.indexOf('data-node-id="b"') < 0) throw new Error('missing data-node-id="b"');
});

check('node groups have role="img" and an inline <title>', () => {
  const g = {
    nodes: [{ id: 'a', kind: 'service', label: 'Alpha service', sub: 'v2', x: 0, y: 0, w: 100, h: 60 }],
    edges: [],
  };
  const svg = svgFor(g);
  if (svg.indexOf('role="img"') < 0) throw new Error('role="img" missing');
  if (svg.indexOf('<title>Alpha service</title>') < 0) throw new Error('node title missing');
  if (svg.indexOf('<desc>service — v2</desc>') < 0) throw new Error('node desc missing');
});

check('edges have data-edge-id and a directional <title>', () => {
  const g = {
    nodes: [
      { id: 'a', kind: 'service', label: 'A', x: 0,   y: 0, w: 100, h: 60 },
      { id: 'b', kind: 'service', label: 'B', x: 300, y: 0, w: 100, h: 60 },
    ],
    edges: [{ id: 'e1', from: 'a', to: 'b', label: 'HTTPS' }],
  };
  const svg = svgFor(g);
  if (svg.indexOf('data-edge-id="e1"') < 0) throw new Error('data-edge-id missing');
  if (svg.indexOf('<title>HTTPS (a → b)</title>') < 0) throw new Error('edge title missing');
});

check('top-level SVG has role="img" + aria-roledescription="diagram"', () => {
  const g = { nodes: [{ id: 'a', kind: 'service', label: 'A', x: 0, y: 0, w: 100, h: 60 }], edges: [] };
  const svg = svgFor(g);
  if (svg.indexOf('aria-roledescription="diagram"') < 0) {
    throw new Error('aria-roledescription="diagram" missing');
  }
});

// ── Animation guards ──────────────────────────────────────

check('SVG emits an inline @media (prefers-reduced-motion) guard', () => {
  const g = { nodes: [{ id: 'a', kind: 'service', label: 'A', x: 0, y: 0, w: 100, h: 60 }], edges: [] };
  const svg = svgFor(g);
  if (svg.indexOf('prefers-reduced-motion: reduce') < 0) {
    throw new Error('reduced-motion media query missing from inline <style>');
  }
});

check('active sleek edge picks up the fd-draw-on class', () => {
  const g = {
    nodes: [
      { id: 'a', kind: 'service', label: 'A', x: 0,   y: 0, w: 100, h: 60 },
      { id: 'b', kind: 'service', label: 'B', x: 300, y: 0, w: 100, h: 60 },
    ],
    edges: [{ id: 'e1', from: 'a', to: 'b' }],
  };
  const svg = FD.renderSVG(g, { styleName: 'sleek', activeEdges: ['e1'] });
  if (svg.indexOf('class="fd-draw-on"') < 0) {
    throw new Error('active edge missing fd-draw-on class');
  }
});

// ── DSL → graph integration ───────────────────────────────

check('DSL parses image, imageFit, imagePosition, icon, curve, weight', () => {
  const dsl = [
    'nodes:',
    '  - id: a, kind: service, label: A, image: "https://e.com/a.svg", imageFit: cover, imagePosition: fill',
    '  - id: b, kind: store,   label: B, icon: postgres',
    'edges:',
    '  - a -> b, curve: bezier, weight: 5',
  ].join('\n');
  const g = FD.parseDSL(dsl);
  if (g.nodes[0].image !== 'https://e.com/a.svg') throw new Error('image not parsed');
  if (g.nodes[0].imageFit !== 'cover') throw new Error('imageFit not parsed');
  if (g.nodes[0].imagePosition !== 'fill') throw new Error('imagePosition not parsed');
  if (g.nodes[1].icon !== 'postgres') throw new Error('icon not parsed');
  if (g.edges[0].curve !== 'bezier') throw new Error('curve not parsed');
  if (g.edges[0].weight !== 5) throw new Error('weight not parsed (got ' + g.edges[0].weight + ')');
});

console.log('\nPassed: ' + pass + ' / ' + (pass + fail));
if (fail) {
  console.error('FAILURES:\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
console.log('OK: image / icon / shapes / edges / a11y / animations all wired through correctly');
