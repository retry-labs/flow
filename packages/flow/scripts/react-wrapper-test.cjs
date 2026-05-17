// React wrapper test.
// Renders <RLFlow /> via react-dom/server and verifies the resulting markup
// contains a valid SVG diagram. Uses the CJS build so we can require() it
// without any compile step.
// Run with:  node scripts/react-wrapper-test.cjs

const fs = require('fs');
const path = require('path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');

const bundlePath = path.join(__dirname, '..', 'dist', 'index.cjs');
if (!fs.existsSync(bundlePath)) {
  console.error('FAIL: dist/index.cjs missing. Run `npm run build` first.');
  process.exit(1);
}

const { RLFlow, Diagram } = require(bundlePath);

let pass = 0, fail = 0;
const failures = [];
const check = (name, fn) => {
  try { fn(); console.log('  OK  ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' — ' + e.message); failures.push(name); fail++; }
};

const DSL = [
  'nodes:',
  '  - id: client,  kind: actor,   label: Client',
  '  - id: api,     kind: service, label: API',
  '  - id: db,      kind: store,   label: Postgres',
  'edges:',
  '  - client -> api, label: HTTPS',
  '  - api    -> db,  label: SQL',
].join('\n');

const DSL_WITH_STEPS = [
  DSL,
  'steps:',
  '  - title: "First",  nodes: [client]',
  '  - title: "Second", nodes: [client, api]',
  '  - title: "Third",  nodes: [api, db]',
].join('\n');

check('RLFlow is exported as a React component', () => {
  if (typeof RLFlow !== 'function') throw new Error('RLFlow not a function');
  if (typeof Diagram !== 'function') throw new Error('Diagram not a function');
});

check('renderToString produces an <svg>', () => {
  const html = ReactDOMServer.renderToString(
    React.createElement(RLFlow, { dsl: DSL, style: 'sleek' })
  );
  if (!/<svg\b/.test(html)) throw new Error('no <svg> in output');
});

check('renders all node labels in the SVG', () => {
  const html = ReactDOMServer.renderToString(
    React.createElement(RLFlow, { dsl: DSL, style: 'sleek' })
  );
  for (const label of ['Client', 'API', 'Postgres']) {
    if (html.indexOf(label) < 0) throw new Error('missing node label: ' + label);
  }
});

check('different styles produce different output', () => {
  const sleek = ReactDOMServer.renderToString(
    React.createElement(RLFlow, { dsl: DSL, style: 'sleek' })
  );
  const city = ReactDOMServer.renderToString(
    React.createElement(RLFlow, { dsl: DSL, style: 'city' })
  );
  if (sleek === city) throw new Error('city and sleek rendered identically');
});

check('basic player renders caption when graph has steps', () => {
  const html = ReactDOMServer.renderToString(
    React.createElement(RLFlow, { dsl: DSL_WITH_STEPS, style: 'sleek', player: 'basic' })
  );
  // Caption shows "1/3" plus the step title.
  if (!/1\/3/.test(html)) throw new Error('basic caption missing "1/3"');
  if (!/First/.test(html)) throw new Error('basic caption missing step title "First"');
});

check('advanced player renders dots + speed selector + progress bar', () => {
  const html = ReactDOMServer.renderToString(
    React.createElement(RLFlow, { dsl: DSL_WITH_STEPS, style: 'sleek', player: 'advanced' })
  );
  if (!/1\/3/.test(html)) throw new Error('advanced caption missing "1/3"');
  // Speed selector
  if (!/1×/.test(html) || !/2×/.test(html) || !/4×/.test(html)) {
    throw new Error('speed selector missing 1× / 2× / 4× buttons');
  }
  // Dots — 3 step dots styled as circles
  const dots = (html.match(/border-radius:50%/g) || []).length;
  if (dots < 3) throw new Error(`expected >=3 dot buttons, got ${dots}`);
});

check('player="off" suppresses the caption', () => {
  const html = ReactDOMServer.renderToString(
    React.createElement(RLFlow, { dsl: DSL_WITH_STEPS, style: 'sleek', player: 'off' })
  );
  if (/1\/3/.test(html)) throw new Error('caption rendered despite player="off"');
});

check('graph without steps renders no player UI by default', () => {
  const html = ReactDOMServer.renderToString(
    React.createElement(RLFlow, { dsl: DSL, style: 'sleek' })
  );
  // No 1× speed button and no dots specifically — caption shouldn't be there.
  if (/1×/.test(html)) throw new Error('advanced UI appeared on a graph without steps');
});

console.log('\nPassed: ' + pass + ' / ' + (pass + fail));
if (fail) {
  console.error('FAILURES:\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
console.log('OK: React <RLFlow> wrapper renders SVG and player tiers correctly');
