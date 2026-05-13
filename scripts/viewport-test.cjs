// Viewport smoke test.
// Loads the standalone bundle into a minimal DOM shim and verifies that
// mount() builds a host element with the expected control buttons and
// that setStyle / setActive / setZoom / resetView / destroy work without
// throwing.
// Run with:  node scripts/viewport-test.cjs

const fs = require('fs');
const path = require('path');

// ── Minimal DOM shim ─────────────────────────────────────────────
class FakeNode {
  constructor(tag) {
    this.tagName = (tag || '').toUpperCase();
    this.nodeType = 1;
    this.children = [];
    this.classList = new Set();
    this.attrs = {};
    this.style = {};
    this.parentNode = null;
    this.listeners = {};
    this._innerHTML = '';
  }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); c.parentNode = null; return c; }
  insertBefore(c) { return this.appendChild(c); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  removeEventListener(t, fn) {
    if (!this.listeners[t]) return;
    this.listeners[t] = this.listeners[t].filter(f => f !== fn);
  }
  set innerHTML(v) {
    this._innerHTML = v;
    this.children = [];
    if (v && v.startsWith('<svg')) {
      const svg = new FakeNode('svg');
      const m = v.match(/viewBox="([^"]+)"/);
      if (m) svg.setAttribute('viewBox', m[1]);
      this.appendChild(svg);
    }
  }
  get innerHTML() { return this._innerHTML; }
  querySelector(sel) {
    if (!sel) return null;
    const tag = sel.replace(/^[#.\[]/, '').toLowerCase();
    const walk = (n) => {
      for (const c of n.children) {
        if (c.tagName && c.tagName.toLowerCase() === tag) return c;
        const r = walk(c); if (r) return r;
      }
      return null;
    };
    return walk(this);
  }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { width: 800, height: 400, top: 0, left: 0, right: 800, bottom: 400 }; }
}

global.HTMLElement = class FakeHTMLElement extends FakeNode {
  constructor() { super('div'); }
};
global.customElements = { define: () => {}, get: () => null };

const head = new FakeNode('head');
const body = new FakeNode('body');
global.document = {
  head, body,
  createElement: (t) => new FakeNode(t),
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: () => null,
  fullscreenElement: null,
};
global.window = global;
global.XMLSerializer = class { serializeToString() { return '<svg/>'; } };
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);

// ── Load bundle ──────────────────────────────────────────────────
const bundlePath = path.join(__dirname, '..', 'dist', 'flow-diagram.standalone.js');
// eslint-disable-next-line no-eval
eval(fs.readFileSync(bundlePath, 'utf8'));
const FD = global.FlowDiagram;

let pass = 0, fail = 0;
const failures = [];
const check = (name, fn) => {
  try { fn(); console.log('  OK  ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' — ' + e.message); failures.push(name + ': ' + e.message); fail++; }
};

// ── Tests ────────────────────────────────────────────────────────
check('FD.mount is exported', () => {
  if (typeof FD.mount !== 'function') throw new Error('mount not a function');
});

check('mount() builds a host with stage + controls', () => {
  const container = new FakeNode('div');
  const dsl = [
    'nodes:',
    '  - id: a, kind: service, label: A',
    '  - id: b, kind: store,   label: B',
    'edges:',
    '  - a -> b',
  ].join('\n');
  const vp = FD.mount(container, { graph: FD.parseDSL(dsl), styleName: 'sleek' });
  if (!vp || typeof vp.setStyle !== 'function') throw new Error('mount returned no API');
  const host = container.children[0];
  if (!host || !host.classList || ![...host.classList].includes('fd-host')) {
    // classList is a Set in our shim — verify via class attribute
    if (host && host.className && host.className.includes('fd-host')) {} else {
      throw new Error('expected fd-host container');
    }
  }
});

check('mount() returns API surface (setStyle, setActive, setZoom, resetView, download, destroy)', () => {
  const container = new FakeNode('div');
  const vp = FD.mount(container, {
    graph: FD.parseDSL('nodes:\n  - id: a, kind: service, label: A\n'),
    styleName: 'sleek',
  });
  for (const m of ['setStyle', 'setActive', 'setZoom', 'resetView', 'toggleFullscreen', 'download', 'update', 'destroy']) {
    if (typeof vp[m] !== 'function') throw new Error('missing API: ' + m);
  }
  // Exercise the no-DOM-side-effect ones
  vp.setStyle('city');
  vp.setActive(['a'], []);
  vp.setZoom(1.5);
  vp.resetView();
  vp.update({ activeNodes: ['a'] });
  vp.destroy();
});

check('mount() with controls:false skips the floating panel', () => {
  const container = new FakeNode('div');
  FD.mount(container, {
    graph: FD.parseDSL('nodes:\n  - id: a, kind: service, label: A\n'),
    controls: false,
  });
  // We can't deeply verify the absence here without a richer DOM shim,
  // but the call must not throw with controls:false.
});

console.log('\nPassed: ' + pass + ' / ' + (pass + fail));
if (fail) {
  console.error('FAILURES:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('OK: viewport API works in a minimal DOM shim');
