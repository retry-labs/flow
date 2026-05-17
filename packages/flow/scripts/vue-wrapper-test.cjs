// Vue wrapper test.
// Creates a Vue 3 app, mounts <RLFlow> from the built CJS bundle into a
// jsdom container, and verifies an SVG is produced. Exercises the same
// mount() viewport path the standalone bundle uses, so we test the real
// runtime end-to-end.
// Run with:  node scripts/vue-wrapper-test.cjs

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const bundlePath = path.join(__dirname, '..', 'dist', 'vue.cjs');
if (!fs.existsSync(bundlePath)) {
  console.error('FAIL: dist/vue.cjs missing. Run `npm run build` first.');
  process.exit(1);
}

// ── jsdom globals — Vue + viewport.js both touch document/window. ───
const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>`,
  { pretendToBeVisual: true },
);
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.customElements = dom.window.customElements;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.performance = { now: () => Date.now() };

const Vue = require('vue');
const { RLFlow } = require(bundlePath);

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

const DSL_WITH_STEPS = DSL +
  '\nsteps:' +
  '\n  - title: First, nodes: [client]' +
  '\n  - title: Second, nodes: [client, api]' +
  '\n  - title: Third, nodes: [api, db]';

async function mountVue(props) {
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '420px';
  document.body.appendChild(container);
  const app = Vue.createApp({
    setup() {
      return () => Vue.h(RLFlow, props);
    },
  });
  app.mount(container);
  // Let onMounted hooks settle (mount() runs synchronously, but Vue defers
  // setup → render → onMounted across microtasks).
  await new Promise((r) => setTimeout(r, 30));
  return { app, container };
}

(async () => {
  await check('Vue wrapper renders an SVG', async () => {
    const { container, app } = await mountVue({ dsl: DSL, style: 'sleek', controls: false });
    const svg = container.querySelector('svg');
    if (!svg) throw new Error('no <svg> rendered');
    app.unmount();
  });

  await check('Vue wrapper produces node groups with data-node-id', async () => {
    const { container, app } = await mountVue({ dsl: DSL, style: 'sleek', controls: false });
    const ids = Array.from(container.querySelectorAll('[data-node-id]')).map(
      (el) => el.getAttribute('data-node-id')
    );
    if (!ids.includes('client') || !ids.includes('api') || !ids.includes('db')) {
      throw new Error('missing expected data-node-ids: ' + JSON.stringify(ids));
    }
    app.unmount();
  });

  await check('Vue wrapper auto-shows basic player when steps exist', async () => {
    const { container, app } = await mountVue({ dsl: DSL_WITH_STEPS, style: 'sleek' });
    const caption = container.querySelector('.fd-caption');
    if (!caption) throw new Error('no .fd-caption rendered');
    if (caption.classList.contains('fd-advanced')) {
      throw new Error('expected basic caption, got advanced');
    }
    app.unmount();
  });

  await check('Vue wrapper renders advanced player with dots + speed selector', async () => {
    const { container, app } = await mountVue({
      dsl: DSL_WITH_STEPS, style: 'sleek', player: 'advanced',
    });
    const caption = container.querySelector('.fd-caption.fd-advanced');
    if (!caption) throw new Error('no .fd-caption.fd-advanced rendered');
    const dots = caption.querySelectorAll('.fd-dot');
    if (dots.length !== 3) throw new Error('expected 3 step dots, got ' + dots.length);
    const speedBtns = caption.querySelectorAll('.fd-speed button');
    if (speedBtns.length !== 4) throw new Error('expected 4 speed buttons, got ' + speedBtns.length);
    const progress = caption.querySelector('.fd-progress > i');
    if (!progress) throw new Error('no progress bar inner element');
    app.unmount();
  });

  await check('Vue wrapper with player="off" hides the caption', async () => {
    const { container, app } = await mountVue({
      dsl: DSL_WITH_STEPS, style: 'sleek', player: 'off',
    });
    const caption = container.querySelector('.fd-caption');
    if (caption) throw new Error('caption rendered despite player="off"');
    app.unmount();
  });

  console.log('\nPassed: ' + pass + ' / ' + (pass + fail));
  if (fail) {
    console.error('FAILURES:\n  - ' + failures.join('\n  - '));
    process.exit(1);
  }
  console.log('OK: Vue <RLFlow> wrapper drives mount() and player tiers correctly');
})();
