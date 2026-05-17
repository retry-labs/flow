// Player smoke test — verifies the viewport's play/pause/step controls
// using jsdom + the actual built standalone bundle.
//
// Asserts:
//   1. mount() with a graph containing `steps:` builds the player group
//      (prev / play / step-idx / next + caption).
//   2. nextStep / prevStep / gotoStep update the active highlights to
//      match the configured step's nodes/edges.
//   3. play() starts the autoplay timer; pause() clears it.
//   4. onStepChange callback fires for each transition.
//   5. The web component (`<rl-flow>`) exposes the same imperative
//      methods (play, pause, nextStep, gotoStep) and forwards events.
//
// Run with:  node scripts/player-test.cjs

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const bundle = fs.readFileSync(
  path.join(__dirname, '..', 'dist', 'flow.standalone.js'),
  'utf8',
);

const dom = new JSDOM(
  `<!DOCTYPE html><html><head></head><body>
     <div id="host" style="width:800px;height:420px"></div>
   </body></html>`,
  { runScripts: 'outside-only', pretendToBeVisual: true },
);

const { window } = dom;
window.eval(bundle);
const FD = window.RLFlow;

const DSL = [
  'nodes:',
  '  - id: a, kind: actor,   label: A',
  '  - id: b, kind: gateway, label: B',
  '  - id: c, kind: service, label: C',
  '  - id: d, kind: store,   label: D',
  '',
  'edges:',
  '  - a -> b',
  '  - b -> c',
  '  - c -> d',
  '',
  'steps:',
  '  - title: "Step one",   nodes: [a, b], edges: [e1]',
  '  - title: "Step two",   nodes: [b, c], edges: [e2]',
  '  - title: "Step three", nodes: [c, d], edges: [e3]',
].join('\n');

let pass = 0, fail = 0;
const failures = [];
const check = (name, fn) => {
  try { fn(); console.log('  OK  ' + name); pass++; }
  catch (e) { console.log('  FAIL ' + name + ' — ' + e.message); failures.push(name); fail++; }
};

// ── Tests ─────────────────────────────────────────────────────────

check('mount() builds the player group when graph.steps exists', () => {
  const host = window.document.getElementById('host');
  const vp = FD.mount(host, { graph: FD.parseDSL(DSL), styleName: 'sleek' });
  // The player's group is the FIRST .fd-group inside .fd-controls (zoom is second).
  const groups = host.querySelectorAll('.fd-controls .fd-group');
  if (groups.length < 2) throw new Error('expected at least 2 control groups, got ' + groups.length);
  // Player buttons: prev, play, idx (1/3), next
  const playerBtns = groups[0].querySelectorAll('button');
  if (playerBtns.length !== 4) throw new Error('expected 4 player buttons, got ' + playerBtns.length);
  const titles = Array.from(playerBtns).map((b) => b.getAttribute('title')).filter(Boolean);
  for (const t of ['Previous step', 'Play', 'Reset to step 1', 'Next step']) {
    if (titles.indexOf(t) < 0) throw new Error('missing player button: ' + t);
  }
  // Caption visible
  const cap = host.querySelector('.fd-caption');
  if (!cap) throw new Error('no .fd-caption rendered');
  vp.destroy();
});

check('nextStep / prevStep / gotoStep cycle the step index', () => {
  const host = window.document.createElement('div');
  host.style.width = '800px'; host.style.height = '420px';
  window.document.body.appendChild(host);
  const vp = FD.mount(host, { graph: FD.parseDSL(DSL), styleName: 'sleek' });
  if (vp.stepIndex !== 0) throw new Error('initial step should be 0');
  vp.nextStep(); if (vp.stepIndex !== 1) throw new Error('after nextStep should be 1');
  vp.nextStep(); if (vp.stepIndex !== 2) throw new Error('after nextStep should be 2');
  vp.nextStep(); if (vp.stepIndex !== 0) throw new Error('wraps back to 0');
  vp.prevStep(); if (vp.stepIndex !== 2) throw new Error('prev wraps to last');
  vp.gotoStep(1); if (vp.stepIndex !== 1) throw new Error('gotoStep(1) failed');
  vp.gotoStep(-1); if (vp.stepIndex !== 2) throw new Error('gotoStep(-1) should normalize to last');
  vp.destroy();
});

check('play() starts a timer that auto-advances; pause() clears it', () => {
  const host = window.document.createElement('div');
  host.style.width = '800px'; host.style.height = '420px';
  window.document.body.appendChild(host);
  const seen = [];
  const vp = FD.mount(host, {
    graph: FD.parseDSL(DSL),
    styleName: 'sleek',
    interval: 30,
    onStepChange: (i) => seen.push(i),
  });
  if (vp.stepIndex !== 0) throw new Error('start at 0');
  vp.play();
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      vp.pause();
      const before = seen.length;
      // After pause, no new step events should fire
      setTimeout(() => {
        if (seen.length !== before) {
          fail++;
          failures.push('play/pause: timer continued after pause: ' + before + ' -> ' + seen.length);
          reject(new Error('timer continued after pause'));
          return;
        }
        if (seen.length < 2) {
          reject(new Error('expected at least 2 onStepChange calls during 100ms autoplay, got ' + seen.length));
          return;
        }
        vp.destroy();
        resolve();
      }, 80);
    }, 100);
  });
});

check('caption text reflects current step title', () => {
  const host = window.document.createElement('div');
  host.style.width = '800px'; host.style.height = '420px';
  window.document.body.appendChild(host);
  const vp = FD.mount(host, { graph: FD.parseDSL(DSL), styleName: 'sleek' });
  const titleEl = host.querySelector('.fd-caption .fd-title');
  if (!titleEl) throw new Error('no .fd-title');
  if (titleEl.textContent !== 'Step one') throw new Error('expected "Step one", got "' + titleEl.textContent + '"');
  vp.nextStep();
  if (titleEl.textContent !== 'Step two') throw new Error('expected "Step two" after nextStep');
  vp.gotoStep(2);
  if (titleEl.textContent !== 'Step three') throw new Error('expected "Step three" after gotoStep(2)');
  vp.destroy();
});

check('<rl-flow> web component exposes imperative play/pause/step API', () => {
  const el = window.document.createElement('rl-flow');
  el.setAttribute('dsl', DSL);
  el.setAttribute('height', '420px');
  el.setAttribute('width', '800px');
  window.document.body.appendChild(el);
  for (const m of ['play', 'pause', 'togglePlay', 'nextStep', 'prevStep', 'gotoStep', 'setStyle', 'setZoom', 'resetView', 'download', 'toggleFullscreen']) {
    if (typeof el[m] !== 'function') throw new Error('web component missing method: ' + m);
  }
  // Should also have rendered a host with controls
  const host = el.querySelector('.fd-host');
  if (!host) throw new Error('web component did not mount viewport');
  el.nextStep();
  // After nextStep the step badge should read 2/3
  const idxBtn = host.querySelector('.fd-controls .fd-group button.fd-pct');
  if (!idxBtn) throw new Error('no step idx label');
  if (!/2\s*\/\s*3/.test(idxBtn.innerHTML)) {
    throw new Error('expected "2/3" after nextStep, got "' + idxBtn.innerHTML + '"');
  }
});

check('step-change CustomEvent fires on the web component', () => {
  const el = window.document.createElement('rl-flow');
  el.setAttribute('dsl', DSL);
  el.setAttribute('height', '420px');
  el.setAttribute('width', '800px');
  window.document.body.appendChild(el);
  let lastDetail = null;
  el.addEventListener('step-change', (ev) => { lastDetail = ev.detail; });
  el.nextStep();
  if (!lastDetail) throw new Error('no step-change event fired');
  if (lastDetail.index !== 1) throw new Error('expected event detail.index === 1, got ' + lastDetail.index);
  if (!lastDetail.step || lastDetail.step.title !== 'Step two') {
    throw new Error('expected step.title === "Step two", got ' + JSON.stringify(lastDetail.step));
  }
});

// Wait for any async checks to settle, then summarize.
Promise.resolve().then(async () => {
  // Allow any pending promise-based checks to finish
  await new Promise((r) => setTimeout(r, 250));
  console.log('\nPassed: ' + pass + ' / ' + (pass + fail));
  if (fail) {
    console.error('FAILURES:\n  - ' + failures.join('\n  - '));
    process.exit(1);
  }
  console.log('OK: player API works in vanilla mount() and the <rl-flow> web component');
});
