// Sequence diagram tests. Parses + renders three example diagrams
// through the standalone bundle and verifies the SVG output contains
// the expected structural pieces.
//
// Run with:  node scripts/sequence-test.cjs

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

// ── Parsing / type dispatch ─────────────────────────────

check('sequence type is registered', () => {
  const types = FD.listTypes();
  if (!types.includes('sequence')) throw new Error('expected "sequence" in: ' + types.join(','));
});

check('parser produces a sequence IR for "type: sequence" DSL', () => {
  const dsl = [
    'type: sequence',
    'participant Client',
    'participant Server',
    'Client ->> Server: hello',
  ].join('\n');
  const ir = FD.parseDSL(dsl);
  if (ir.type !== 'sequence') throw new Error('wrong type: ' + ir.type);
  if (ir.actors.length !== 2) throw new Error('expected 2 actors, got ' + ir.actors.length);
  if (ir.events.length !== 1) throw new Error('expected 1 event, got ' + ir.events.length);
  const ev = ir.events[0];
  if (ev.kind !== 'message') throw new Error('expected message, got ' + ev.kind);
  if (ev.label !== 'hello') throw new Error('label mismatch: ' + ev.label);
});

check('parser handles auto-declared participants (used before declared)', () => {
  const ir = FD.parseDSL([
    'type: sequence',
    'Alice ->> Bob: hi',
    'Bob -->> Alice: yo',
  ].join('\n'));
  if (ir.actors.length !== 2) throw new Error('expected 2 auto-declared actors');
  if (ir.actors[0].id !== 'Alice' || ir.actors[1].id !== 'Bob') {
    throw new Error('order wrong: ' + ir.actors.map(a => a.id).join(','));
  }
});

check('parser handles all four arrow kinds', () => {
  const ir = FD.parseDSL([
    'type: sequence',
    'A ->> B: sync',
    'A -->> B: reply',
    'A -x B: lost-sync',
    'A --x B: lost-reply',
  ].join('\n'));
  const arrows = ir.events.map(e => e.arrow);
  for (const a of ['sync', 'reply', 'lost', 'lostDashed']) {
    if (!arrows.includes(a)) throw new Error('missing arrow kind ' + a + ' in ' + arrows.join(','));
  }
});

check('parser handles notes (over / left of / right of)', () => {
  const ir = FD.parseDSL([
    'type: sequence',
    'participant A',
    'participant B',
    'Note over A, B: shared',
    'Note left of A: solo',
    'Note right of B: solo2',
  ].join('\n'));
  const notes = ir.events.filter(e => e.kind === 'note');
  if (notes.length !== 3) throw new Error('expected 3 notes, got ' + notes.length);
  if (notes[0].placement !== 'over') throw new Error('placement mismatch');
  if (notes[1].placement !== 'leftOf') throw new Error('leftOf placement missing');
  if (notes[2].placement !== 'rightOf') throw new Error('rightOf placement missing');
});

check('parser handles activate / deactivate', () => {
  const ir = FD.parseDSL([
    'type: sequence',
    'A ->> B: req',
    'activate B',
    'B -->> A: rep',
    'deactivate B',
  ].join('\n'));
  const kinds = ir.events.map(e => e.kind);
  if (!kinds.includes('activate')) throw new Error('no activate event');
  if (!kinds.includes('deactivate')) throw new Error('no deactivate event');
});

check('parser handles loop ... end', () => {
  const ir = FD.parseDSL([
    'type: sequence',
    'loop every 5min',
    '  A ->> B: ping',
    'end',
  ].join('\n'));
  const frame = ir.events.find(e => e.kind === 'frame');
  if (!frame) throw new Error('no frame');
  if (frame.frame !== 'loop') throw new Error('expected loop, got ' + frame.frame);
  if (frame.body.length !== 1) throw new Error('expected 1 message in body');
});

check('parser handles alt ... else ... end (multiple branches)', () => {
  const ir = FD.parseDSL([
    'type: sequence',
    'alt valid',
    '  A ->> B: 200',
    'else invalid',
    '  A ->> B: 401',
    'else server-error',
    '  A ->> B: 500',
    'end',
  ].join('\n'));
  const frame = ir.events.find(e => e.kind === 'frame');
  if (!frame || frame.frame !== 'alt') throw new Error('expected alt frame');
  if (frame.branches.length !== 3) {
    throw new Error('expected 3 branches, got ' + frame.branches.length);
  }
  if (frame.branches[1].label !== 'invalid') {
    throw new Error('branch labels wrong: ' + frame.branches.map(b => b.label).join(','));
  }
});

check('parser handles nested frames (alt inside loop)', () => {
  const ir = FD.parseDSL([
    'type: sequence',
    'loop retry',
    '  alt ok',
    '    A ->> B: success',
    '  else fail',
    '    A ->> B: error',
    '  end',
    'end',
  ].join('\n'));
  const outer = ir.events[0];
  if (outer.frame !== 'loop') throw new Error('outer not loop');
  const inner = outer.body[0];
  if (!inner || inner.frame !== 'alt') throw new Error('inner not alt');
});

// ── Rendering ───────────────────────────────────────────

check('renderSVG dispatches to sequence renderer for sequence IR', () => {
  const dsl = [
    'type: sequence',
    'participant A',
    'participant B',
    'A ->> B: msg',
  ].join('\n');
  const ir = FD.parseDSL(dsl);
  const svg = FD.renderSVG(ir);
  if (!/aria-roledescription="sequence diagram"/.test(svg)) {
    throw new Error('SVG not from sequence renderer');
  }
});

check('rendered SVG contains actor labels in headers', () => {
  const ir = FD.parseDSL([
    'type: sequence',
    'participant Client',
    'participant Server',
    'Client ->> Server: x',
  ].join('\n'));
  const svg = FD.renderSVG(ir);
  if (svg.indexOf('>Client<') < 0) throw new Error('Client label missing');
  if (svg.indexOf('>Server<') < 0) throw new Error('Server label missing');
});

check('rendered SVG draws lifelines (dashed lines)', () => {
  const ir = FD.parseDSL('type: sequence\nparticipant A\nA ->> A: x');
  const svg = FD.renderSVG(ir);
  // A lifeline is a dashed <line> with stroke-dasharray.
  if (!/stroke-dasharray="5 4"/.test(svg)) throw new Error('no dashed lifeline');
});

check('rendered SVG draws arrowhead markers', () => {
  const ir = FD.parseDSL('type: sequence\nA ->> B: x');
  const svg = FD.renderSVG(ir);
  if (svg.indexOf('seq-arrow') < 0) throw new Error('no arrowhead marker defined');
  if (!/marker-end="url\(#seq-arrow/.test(svg)) throw new Error('arrow not applied to message');
});

check('rendered SVG draws frame outline + label tab for "loop"', () => {
  const ir = FD.parseDSL([
    'type: sequence',
    'loop every 5min',
    '  A ->> B: ping',
    'end',
  ].join('\n'));
  const svg = FD.renderSVG(ir);
  if (!/data-frame-kind="loop"/.test(svg)) throw new Error('frame group missing');
  if (svg.indexOf('loop every 5min') < 0) throw new Error('frame label missing');
});

check('self-message renders an arc (cubic path), not a straight line', () => {
  const ir = FD.parseDSL('type: sequence\nparticipant X\nX ->> X: retry');
  const svg = FD.renderSVG(ir);
  // Self-message uses a path with cubic C command.
  if (!/<path[^>]*d="M[^"]*C/.test(svg)) throw new Error('no cubic path for self-message');
});

check('activation bar renders between activate and deactivate', () => {
  const ir = FD.parseDSL([
    'type: sequence',
    'A ->> B: req',
    'activate B',
    'B -->> A: rep',
    'deactivate B',
  ].join('\n'));
  const svg = FD.renderSVG(ir);
  // Activation bar = small rect with width=10 and fill="#e2e8f0".
  if (!/<rect[^>]*fill="#e2e8f0"[^>]*\/>/.test(svg)) {
    throw new Error('activation bar rect missing');
  }
});

check('actor (with stick-figure) renders a circle head', () => {
  const ir = FD.parseDSL([
    'type: sequence',
    'actor User',
    'participant System',
    'User ->> System: click',
  ].join('\n'));
  const svg = FD.renderSVG(ir);
  // Stick figure: a circle with r="6" near the top.
  if (!/<circle[^>]*r="6"/.test(svg)) throw new Error('stick-figure head missing');
});

check('flow-type DSL (no `type:`) still renders via flow renderer', () => {
  const dsl = [
    'nodes:',
    '  - id: a, kind: service, label: A',
    '  - id: b, kind: store,   label: B',
    'edges:',
    '  - a -> b',
  ].join('\n');
  const ir = FD.parseDSL(dsl);
  if (ir.type !== 'flow') throw new Error('flow IR not tagged: ' + ir.type);
  const svg = FD.renderSVG(ir);
  if (!/aria-roledescription="diagram"/.test(svg)) throw new Error('flow renderer not used');
  if (/aria-roledescription="sequence diagram"/.test(svg)) {
    throw new Error('sequence renderer wrongly invoked for flow IR');
  }
});

console.log('\nPassed: ' + pass + ' / ' + (pass + fail));
if (fail) {
  console.error('FAILURES:\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
console.log('OK: sequence diagrams parse + render correctly across all event kinds');
