// Double-load resilience test.
//
// Real-world pages sometimes include the standalone bundle twice
// (CMS plugin + a copy-pasted snippet, multiple npm consumers, etc).
// The framework must:
//   1. Detect the duplicate load and warn exactly once.
//   2. Keep the first load's window.RLFlow surface (function identity
//      preserved) so anything registered against it stays valid.
//   3. Not append a second <style data-flow-viewport> element to head.
//   4. mount() called twice on the same container must clean up the
//      first viewport before installing the second (no leaked
//      fullscreenchange listener, no doubled DOM).
//
// Run:  node scripts/double-load-test.cjs

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const bundlePath = path.join(__dirname, '..', 'dist', 'flow.standalone.js');
const bundle = fs.readFileSync(bundlePath, 'utf8');

const dom = new JSDOM(
  `<!DOCTYPE html>
   <html><head></head>
   <body><div id="stage" style="width: 600px; height: 360px;"></div></body></html>`,
  { runScripts: 'outside-only', pretendToBeVisual: true },
);
const { window } = dom;

// Capture warnings emitted by the bundle.
const warnings = [];
window.console.warn = (...args) => warnings.push(args.join(' '));

let pass = 0, fail = 0;
const failures = [];
const check = (name, fn) => {
  try { fn(); console.log('  OK  ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' — ' + e.message); failures.push(name); fail++; }
};

// ── Load #1 ────────────────────────────────────────────────
window.eval(bundle);
const FD1 = window.RLFlow;

check('first load publishes RLFlow', () => {
  if (!FD1) throw new Error('window.RLFlow missing');
  if (typeof FD1.mount !== 'function') throw new Error('mount() missing');
  if (typeof FD1.parseDSL !== 'function') throw new Error('parseDSL() missing');
});

check('first load sets __loaded marker', () => {
  if (FD1.__loaded !== true) throw new Error('__loaded should be true');
});

check('first load injects exactly one <style data-flow-viewport>', () => {
  // mount() triggers injectStyles. Force it.
  FD1.mount(window.document.getElementById('stage'), {
    graph: FD1.parseDSL('nodes:\n  - id: a, kind: actor, label: A'),
  });
  const styles = window.document.querySelectorAll('style[data-flow-viewport]');
  if (styles.length !== 1) throw new Error('expected 1 style block, got ' + styles.length);
});

check('first load fires no warnings', () => {
  if (warnings.length !== 0) throw new Error('unexpected warnings: ' + JSON.stringify(warnings));
});

// Capture function identities for comparison after load #2.
const refs = {
  mount: FD1.mount,
  parseDSL: FD1.parseDSL,
  renderSVG: FD1.renderSVG,
  registerType: FD1.registerType,
  RLFlow: window.RLFlow,
};

// User-registered type — should remain visible after a duplicate load.
FD1.registerType('user-plugin', {
  name: 'user-plugin', parse: () => ({ type: 'user-plugin' }), renderSVG: () => '<svg/>',
});

// ── Load #2 (the duplicate) ────────────────────────────────
window.eval(bundle);
const FD2 = window.RLFlow;

check('second load preserves window.RLFlow identity', () => {
  if (FD2 !== refs.RLFlow) throw new Error('window.RLFlow object was replaced on second load');
});

check('second load preserves function identity (mount/parseDSL/renderSVG/registerType)', () => {
  if (FD2.mount !== refs.mount)             throw new Error('mount reference changed');
  if (FD2.parseDSL !== refs.parseDSL)       throw new Error('parseDSL reference changed');
  if (FD2.renderSVG !== refs.renderSVG)     throw new Error('renderSVG reference changed');
  if (FD2.registerType !== refs.registerType) throw new Error('registerType reference changed');
});

check('second load preserves user-registered types', () => {
  const t = FD2.getType('user-plugin');
  if (!t) throw new Error('user-plugin type was lost after second load');
});

check('second load emits exactly one warning', () => {
  if (warnings.length !== 1) throw new Error('expected 1 warning, got ' + warnings.length + ': ' + JSON.stringify(warnings));
  if (!/RLFlow.*more than once/.test(warnings[0])) throw new Error('warning text wrong: ' + warnings[0]);
});

check('second load does not append another <style data-flow-viewport>', () => {
  const styles = window.document.querySelectorAll('style[data-flow-viewport]');
  if (styles.length !== 1) throw new Error('expected 1 style block, got ' + styles.length);
});

// ── Triple-load — warning should still only fire once ──────
window.eval(bundle);

check('third load does not duplicate the warning', () => {
  if (warnings.length !== 1) throw new Error('warning fired more than once: total = ' + warnings.length);
});

// ── mount() idempotency ────────────────────────────────────
check('re-mounting on the same container tears down the prior viewport', () => {
  const stage = window.document.getElementById('stage');
  // first mount happened above; capture the host element from it
  const firstHost = stage.querySelector('.fd-host');
  if (!firstHost) throw new Error('first mount did not produce an .fd-host');

  // mount again on the same container
  FD1.mount(stage, {
    graph: FD1.parseDSL('nodes:\n  - id: b, kind: service, label: B'),
  });
  const hosts = stage.querySelectorAll('.fd-host');
  if (hosts.length !== 1) throw new Error('expected exactly one .fd-host after re-mount, got ' + hosts.length);
  if (hosts[0] === firstHost) throw new Error('expected new host element, got the same one');
  if (!stage.__rlflowViewport) throw new Error('container.__rlflowViewport not stashed');
});

check('destroying the active viewport clears container.__rlflowViewport', () => {
  const stage = window.document.getElementById('stage');
  stage.__rlflowViewport.destroy();
  if (stage.__rlflowViewport !== null) throw new Error('destroy() did not null the container ref');
  const hosts = stage.querySelectorAll('.fd-host');
  if (hosts.length !== 0) throw new Error('destroy() left DOM behind: ' + hosts.length + ' host(s)');
});

// ── mount() error message ──────────────────────────────────
check('mount() with bogus selector reports the selector in the error', () => {
  let err;
  try { FD1.mount('#does-not-exist', { graph: FD1.parseDSL('nodes:\n  - id: a, kind: actor, label: A') }); }
  catch (e) { err = e; }
  if (!err) throw new Error('expected mount() to throw');
  if (!/#does-not-exist/.test(err.message)) throw new Error('selector missing from error: ' + err.message);
});

// ── Report ─────────────────────────────────────────────────
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) {
  console.log('Failures: ' + failures.join(', '));
  process.exit(1);
}
process.exit(0);
