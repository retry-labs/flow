// -----------------------------------------------------------
// Sequence diagram type.
//
// Plugin shape (see ../types.js for the contract). Exports a single
// side-effect: register a sequence-type plugin under name 'sequence'.
//
// Syntax (Mermaid-compatible subset, see ROADMAP.md):
//
//   type: sequence
//   title: User login
//
//   participant Client
//   participant Server
//   actor       User
//   participant DB
//
//   User   ->>  Client: enter creds
//   Client ->>  Server: login(creds)
//   activate Server
//     Server ->> DB:     SELECT user
//     DB     -->> Server: row
//     Server -->> Client: token
//   deactivate Server
//   Note over Server, DB: secured channel
//
//   loop every 5 min
//     Client ->> Server: heartbeat
//     Server -->> Client: ok
//   end
//
//   alt valid
//     Server ->> Client: 200 OK
//   else invalid
//     Server ->> Client: 401
//   end
//
//   opt with cookie
//     Client ->> Server: set-cookie
//   end
//
//   par worker A
//     Client ->> Server: ping
//   and worker B
//     Client ->> Server: ping
//   end
//
// Arrow types:
//   `->>`  solid arrow with filled head (sync request)
//   `-->>` dashed arrow with open head  (reply / async)
//   `-x`   solid arrow with X            (lost message)
//   `--x`  dashed arrow with X           (lost reply)
//
// Notes: `Note over A`, `Note over A, B`, `Note left of A`, `Note right of A`.
//
// IR:
//   {
//     type: 'sequence',
//     title, style,
//     actors:   [{ id, label, kind: 'participant' | 'actor' }],
//     events:   [Event],   // ordered timeline (messages, notes, activations, frames)
//   }
//
//   Event kinds:
//     { kind: 'message',    from, to, arrow, label, lost? }
//     { kind: 'note',       placement, actors: [id], text }
//     { kind: 'activate',   actor }
//     { kind: 'deactivate', actor }
//     { kind: 'frame', frame: 'loop'|'opt', label, body: [Event] }
//     { kind: 'frame', frame: 'alt'|'par',   branches: [{ label, body: [Event] }] }
//
// -----------------------------------------------------------

import { registerType } from '../types.js';

// ── PARSER ──────────────────────────────────────────────────

const ARROW_RE = /^([\w-]+)\s*(-->>|->>|--x|-x)\s*([\w-]+)\s*(?::\s*(.*))?$/;
const PARTICIPANT_RE = /^participant\s+([\w-]+)(?:\s+as\s+(.+))?$/i;
const ACTOR_RE       = /^actor\s+([\w-]+)(?:\s+as\s+(.+))?$/i;
const NOTE_OVER_RE   = /^note\s+over\s+([\w-]+)(?:\s*,\s*([\w-]+))?\s*:\s*(.*)$/i;
const NOTE_SIDE_RE   = /^note\s+(left|right)\s+of\s+([\w-]+)\s*:\s*(.*)$/i;
const ACTIVATE_RE    = /^activate\s+([\w-]+)$/i;
const DEACTIVATE_RE  = /^deactivate\s+([\w-]+)$/i;
const LOOP_RE        = /^loop(?:\s+(.+))?$/i;
const OPT_RE         = /^opt(?:\s+(.+))?$/i;
const ALT_RE         = /^alt(?:\s+(.+))?$/i;
const ELSE_RE        = /^else(?:\s+(.+))?$/i;
const PAR_RE         = /^par(?:\s+(.+))?$/i;
const AND_RE         = /^and(?:\s+(.+))?$/i;
const END_RE         = /^end$/i;
const META_RE        = /^(\w+):\s*(.+)$/;

export function parseSequenceDSL(text) {
  const lines = text.split('\n');
  // actorOrder preserves the column order shown in the rendered
  // diagram. The first time an actor appears (via `participant`,
  // `actor`, or a message), it's appended to actorOrder — including
  // when the user only declares it *after* using it in a message.
  // In that late-declaration case the column appears at the end,
  // matching Mermaid's behavior. Declare actors up front if you need
  // a specific column ordering.
  const actorOrder = [];
  const actorMap = Object.create(null);       // id → { id, label, kind }

  // Kind upgrade rule: `actor X` upgrades a participant to actor
  // (stick figure). The reverse — `participant X` after `actor X` —
  // does NOT downgrade. This is intentional: callers usually upgrade
  // a participant to "User" once they realize it's a human, and
  // never want the reverse.
  const ensureActor = (id, kind = 'participant', label = null) => {
    if (!actorMap[id]) {
      actorMap[id] = { id, kind, label: label || id };
      actorOrder.push(id);
    } else if (label) {
      actorMap[id].label = label;
    }
    if (kind === 'actor') actorMap[id].kind = 'actor';
    return actorMap[id];
  };

  const meta = {};        // type, title, style, ...
  const rootBody = [];    // top-level events
  // Stack of { kind: 'frame'|'alt-branch'|'par-branch', target: array-to-push-into,
  //            frame?: 'loop'|'opt'|'alt'|'par', label?, branches?, currentBranch? }
  const stack = [{ target: rootBody }];

  let msgCounter = 0;
  const nextId = (prefix) => `${prefix}${msgCounter++}`;
  const top = () => stack[stack.length - 1];

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;

    // Top-level meta (only when at root + before any events).
    if (stack.length === 1 && top().target.length === 0) {
      const mm = line.match(META_RE);
      if (mm && !/^(participant|actor|note|activate|deactivate|loop|opt|alt|par|else|and|end)\b/i.test(mm[1])) {
        // Not a structural keyword — treat as meta.
        const key = mm[1].toLowerCase();
        if (!['nodes','edges','steps','config'].includes(key)) {
          meta[key] = mm[2].trim().replace(/^"(.*)"$/, '$1');
          continue;
        }
      }
    }

    // Participant / actor declarations.
    let m;
    if ((m = line.match(PARTICIPANT_RE))) {
      ensureActor(m[1], 'participant', m[2]);
      continue;
    }
    if ((m = line.match(ACTOR_RE))) {
      ensureActor(m[1], 'actor', m[2]);
      continue;
    }

    // Note over / left / right.
    if ((m = line.match(NOTE_OVER_RE))) {
      const a = m[1], b = m[2];
      ensureActor(a);
      if (b) ensureActor(b);
      top().target.push({
        kind: 'note',
        id: nextId('n'),
        placement: 'over',
        actors: b ? [a, b] : [a],
        text: m[3].trim(),
      });
      continue;
    }
    if ((m = line.match(NOTE_SIDE_RE))) {
      ensureActor(m[2]);
      top().target.push({
        kind: 'note',
        id: nextId('n'),
        placement: m[1].toLowerCase() === 'left' ? 'leftOf' : 'rightOf',
        actors: [m[2]],
        text: m[3].trim(),
      });
      continue;
    }

    // Activations.
    if ((m = line.match(ACTIVATE_RE))) {
      ensureActor(m[1]);
      top().target.push({ kind: 'activate', actor: m[1] });
      continue;
    }
    if ((m = line.match(DEACTIVATE_RE))) {
      ensureActor(m[1]);
      top().target.push({ kind: 'deactivate', actor: m[1] });
      continue;
    }

    // Frame openers.
    if ((m = line.match(LOOP_RE))) {
      const frame = { kind: 'frame', frame: 'loop', label: m[1] || 'loop', body: [] };
      top().target.push(frame);
      stack.push({ target: frame.body });
      continue;
    }
    if ((m = line.match(OPT_RE))) {
      const frame = { kind: 'frame', frame: 'opt', label: m[1] || 'opt', body: [] };
      top().target.push(frame);
      stack.push({ target: frame.body });
      continue;
    }
    if ((m = line.match(ALT_RE))) {
      const branches = [{ label: m[1] || 'alt', body: [] }];
      const frame = { kind: 'frame', frame: 'alt', branches };
      top().target.push(frame);
      stack.push({ target: branches[0].body, frame, kind: 'alt-branch' });
      continue;
    }
    if ((m = line.match(ELSE_RE))) {
      // Switch to a new branch of the enclosing alt.
      const closer = stack.pop();
      if (!closer || closer.kind !== 'alt-branch') {
        // Mismatched else — restore and skip.
        if (closer) stack.push(closer);
        continue;
      }
      const branch = { label: m[1] || 'else', body: [] };
      closer.frame.branches.push(branch);
      stack.push({ target: branch.body, frame: closer.frame, kind: 'alt-branch' });
      continue;
    }
    if ((m = line.match(PAR_RE))) {
      const branches = [{ label: m[1] || 'par', body: [] }];
      const frame = { kind: 'frame', frame: 'par', branches };
      top().target.push(frame);
      stack.push({ target: branches[0].body, frame, kind: 'par-branch' });
      continue;
    }
    if ((m = line.match(AND_RE))) {
      const closer = stack.pop();
      if (!closer || closer.kind !== 'par-branch') {
        if (closer) stack.push(closer);
        continue;
      }
      const branch = { label: m[1] || 'and', body: [] };
      closer.frame.branches.push(branch);
      stack.push({ target: branch.body, frame: closer.frame, kind: 'par-branch' });
      continue;
    }
    if (END_RE.test(line)) {
      if (stack.length > 1) stack.pop();
      continue;
    }

    // Messages (must come after structural keywords).
    if ((m = line.match(ARROW_RE))) {
      const [, from, arrow, to, label] = m;
      ensureActor(from);
      ensureActor(to);
      const dashed = arrow.startsWith('--');
      const lost = arrow.endsWith('x');
      top().target.push({
        kind: 'message',
        id: nextId('m'),
        from, to,
        arrow: dashed ? (lost ? 'lostDashed' : 'reply') : (lost ? 'lost' : 'sync'),
        label: (label || '').trim(),
      });
      continue;
    }
    // Anything we don't recognize is silently dropped — keeps the
    // parser permissive for typos rather than erroring loudly.
  }

  return {
    type: 'sequence',
    title: meta.title,
    style: meta.style || 'sleek',
    actors: actorOrder.map(id => actorMap[id]),
    events: rootBody,
  };
}

// ── LAYOUT ──────────────────────────────────────────────────

const ACTOR_W       = 130;
const ACTOR_H       = 44;
const COL_PAD       = 50;
const MSG_GAP       = 46;
const NOTE_PAD_Y    = 8;
const FRAME_PAD_Y   = 22;
const TOP_MARGIN    = 30;
const BOTTOM_MARGIN = 30;

function layoutSequence(ir) {
  // Compute actor X positions (uniform columns sized to widest label).
  const cols = {};
  const totalActors = ir.actors.length;
  // Naive column width: take the longest label, ~7px per char + padding.
  const maxLabel = ir.actors.reduce((m, a) => Math.max(m, (a.label || a.id).length), 0);
  const colW = Math.max(ACTOR_W, maxLabel * 8 + 40);
  const colSpacing = colW + COL_PAD;
  ir.actors.forEach((a, i) => {
    cols[a.id] = {
      cx: TOP_MARGIN + colW / 2 + i * colSpacing,
      left: TOP_MARGIN + i * colSpacing,
      right: TOP_MARGIN + i * colSpacing + colW,
    };
  });

  // Walk the event tree assigning Y coordinates. Frames take FRAME_PAD_Y
  // above and below their body. Returns the maximum Y reached.
  let y = TOP_MARGIN + ACTOR_H + 30;

  function walk(events, depth = 0) {
    for (const ev of events) {
      if (ev.kind === 'message' || ev.kind === 'note') {
        ev.y = y;
        y += MSG_GAP;
      } else if (ev.kind === 'activate' || ev.kind === 'deactivate') {
        ev.y = y;  // marker — doesn't add height
      } else if (ev.kind === 'frame') {
        ev.depth = depth;
        ev.headerY = y;
        y += FRAME_PAD_Y;
        if (ev.frame === 'loop' || ev.frame === 'opt') {
          walk(ev.body, depth + 1);
        } else {
          // alt / par — divider before each branch after the first.
          for (let b = 0; b < ev.branches.length; b++) {
            if (b > 0) {
              ev.branches[b].dividerY = y;
              y += FRAME_PAD_Y;
            }
            walk(ev.branches[b].body, depth + 1);
          }
        }
        y += FRAME_PAD_Y;
        ev.endY = y;
      }
    }
  }
  walk(ir.events);

  const totalH = y + BOTTOM_MARGIN;
  const totalW = TOP_MARGIN * 2 + colW + (totalActors - 1) * colSpacing;

  return { cols, colW, colSpacing, totalH, totalW };
}

// Walks the event tree and produces a flat list of activations per
// actor: [{ actor, startY, endY }]. Pairs activate/deactivate by
// stacking per actor. `stacks` is the per-actor LIFO of open
// activations being threaded through the recursion.
function collectActivations(events, activations, stacks) {
  for (const ev of events) {
    if (ev.kind === 'activate') {
      (stacks[ev.actor] || (stacks[ev.actor] = [])).push({ actor: ev.actor, startY: ev.y });
    } else if (ev.kind === 'deactivate') {
      const list = stacks[ev.actor];
      const open = list && list[list.length - 1];
      if (open) {
        open.endY = ev.y;
        activations.push(open);
        list.pop();
      }
    } else if (ev.kind === 'frame') {
      if (ev.frame === 'loop' || ev.frame === 'opt') {
        collectActivations(ev.body, activations, stacks);
      } else {
        for (const b of ev.branches) collectActivations(b.body, activations, stacks);
      }
    }
  }
}

// ── RENDERER ────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderSequence(graph, opts = {}) {
  const ir = graph;
  if (!ir || !Array.isArray(ir.actors) || ir.actors.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60">
      <text x="10" y="30" font-family="Inter Tight" font-size="13" fill="#94a3b8">
        Empty sequence diagram
      </text>
    </svg>`;
  }

  const layout = layoutSequence(ir);
  const { cols, colW, totalH, totalW } = layout;

  // Resolve activations (top-level + nested in frames). Unmatched
  // activates auto-close at the bottom of the diagram so an
  // unbalanced DSL still renders something useful.
  const activations = [];
  const openStacks = {};
  collectActivations(ir.events, activations, openStacks);
  for (const actor of Object.keys(openStacks)) {
    for (const open of openStacks[actor]) {
      open.endY = totalH - BOTTOM_MARGIN - 10;
      activations.push(open);
    }
  }

  // Render order: lifelines → frames (deepest first, so outer overlay
  // doesn't cover inner) → activations → messages → notes → actor
  // headers (top so they overlay lifelines cleanly).

  const lifelines = ir.actors.map(a =>
    `<line x1="${cols[a.id].cx}" y1="${TOP_MARGIN + ACTOR_H + 4}" ` +
    `x2="${cols[a.id].cx}" y2="${totalH - BOTTOM_MARGIN}" ` +
    `stroke="#cbd5e1" stroke-width="1.2" stroke-dasharray="5 4"/>`
  ).join('');

  const frames = renderFrames(ir.events, cols, colW);

  const activationBars = activations.map(a => {
    const x = cols[a.actor].cx - 5;
    const h = Math.max(8, a.endY - a.startY);
    return `<rect x="${x}" y="${a.startY}" width="10" height="${h}" ` +
           `fill="#e2e8f0" stroke="#94a3b8" stroke-width="1" rx="1"/>`;
  }).join('');

  const messages = renderMessages(ir.events, cols);

  const notes = renderNotes(ir.events, cols, colW);

  // Top header boxes / actor figures.
  const actorHeads = ir.actors.map(a => {
    const c = cols[a.id];
    if (a.kind === 'actor') {
      // Stick-figure: head + body. Vertically centered in ACTOR_H.
      const cx = c.cx, cy = TOP_MARGIN + ACTOR_H / 2;
      return `
        <g data-actor-id="${esc(a.id)}">
          <circle cx="${cx}" cy="${cy - 12}" r="6" fill="#fff" stroke="#475569" stroke-width="1.5"/>
          <path d="M ${cx} ${cy - 6} V ${cy + 4} M ${cx - 8} ${cy} H ${cx + 8} M ${cx} ${cy + 4} L ${cx - 6} ${cy + 14} M ${cx} ${cy + 4} L ${cx + 6} ${cy + 14}" stroke="#475569" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          <text x="${cx}" y="${TOP_MARGIN + ACTOR_H + 18}" text-anchor="middle"
                font-family="Inter Tight" font-weight="600" font-size="13" fill="#0f172a">${esc(a.label)}</text>
        </g>`;
    }
    return `
      <g data-actor-id="${esc(a.id)}">
        <rect x="${c.left}" y="${TOP_MARGIN}" width="${colW}" height="${ACTOR_H}" rx="6"
              fill="#fff" stroke="#cbd5e1" stroke-width="1.2"/>
        <text x="${c.cx}" y="${TOP_MARGIN + ACTOR_H / 2 + 5}" text-anchor="middle"
              font-family="Inter Tight" font-weight="600" font-size="13" fill="#0f172a">${esc(a.label)}</text>
      </g>`;
  }).join('');

  const title = ir.title
    ? `<title>${esc(ir.title)}</title>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 ${totalW} ${totalH}"
    width="100%" height="100%"
    preserveAspectRatio="xMidYMid meet"
    role="img" aria-roledescription="sequence diagram"
    style="display:block;background:#fbf7ec;font-family:Inter Tight,sans-serif">
    ${title}
    <defs>
      <marker id="seq-arrow"   markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
        <path d="M0 0 L9 3 L0 6 Z" fill="#0f172a"/>
      </marker>
      <marker id="seq-arrow-o" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
        <path d="M0 0 L9 3 L0 6" fill="none" stroke="#0f172a" stroke-width="1.2"/>
      </marker>
    </defs>
    ${lifelines}
    ${frames}
    ${activationBars}
    ${messages}
    ${notes}
    ${actorHeads}
  </svg>`;
}

function renderMessages(events, cols) {
  const out = [];
  for (const ev of events) {
    if (ev.kind === 'message') {
      out.push(renderMessage(ev, cols));
    } else if (ev.kind === 'frame') {
      if (ev.frame === 'loop' || ev.frame === 'opt') {
        out.push(renderMessages(ev.body, cols));
      } else {
        for (const b of ev.branches) out.push(renderMessages(b.body, cols));
      }
    }
  }
  return out.join('');
}

function renderMessage(m, cols) {
  const from = cols[m.from], to = cols[m.to];
  if (!from || !to) return '';
  const dashed = m.arrow === 'reply' || m.arrow === 'lostDashed';
  const lost = m.arrow === 'lost' || m.arrow === 'lostDashed';
  const stroke = '#0f172a';
  const dash = dashed ? '6 4' : undefined;
  const sw = 1.4;

  if (m.from === m.to) {
    // Self-message: arc 60px to the right then back. Label sits to
    // the right of the arc at its vertical midpoint so it doesn't
    // collide with the message immediately above.
    const x = from.cx;
    const y0 = m.y;
    const y1 = m.y + 22;
    const path = `M ${x} ${y0} C ${x + 60} ${y0}, ${x + 60} ${y1}, ${x + 6} ${y1}`;
    return `
      <g data-message-id="${esc(m.id)}">
        <path d="${path}" fill="none" stroke="${stroke}" stroke-width="${sw}"
              ${dash ? `stroke-dasharray="${dash}"` : ''}
              marker-end="url(#${dashed ? 'seq-arrow-o' : 'seq-arrow'})"/>
        ${m.label ? `<text x="${x + 68}" y="${(y0 + y1) / 2 + 4}" font-size="11.5" fill="${stroke}" font-family="Inter Tight">${esc(m.label)}</text>` : ''}
      </g>`;
  }

  const x1 = from.cx;
  const x2 = to.cx;
  const direction = x2 > x1 ? 1 : -1;
  const endX = x2 - direction * 6;
  const labelMid = (x1 + x2) / 2;
  const labelY = m.y - 6;
  return `
    <g data-message-id="${esc(m.id)}">
      <line x1="${x1}" y1="${m.y}" x2="${endX}" y2="${m.y}"
            stroke="${stroke}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''}
            marker-end="url(#${dashed ? 'seq-arrow-o' : 'seq-arrow'})"/>
      ${lost ? `<text x="${endX}" y="${m.y + 4}" font-size="14" font-weight="700" fill="#c0392b">×</text>` : ''}
      ${m.label ? `<text x="${labelMid}" y="${labelY}" text-anchor="middle" font-size="11.5"
                          fill="${stroke}" font-family="Inter Tight">${esc(m.label)}</text>` : ''}
    </g>`;
}

function renderNotes(events, cols, colW) {
  const out = [];
  for (const ev of events) {
    if (ev.kind === 'note') {
      out.push(renderNote(ev, cols, colW));
    } else if (ev.kind === 'frame') {
      if (ev.frame === 'loop' || ev.frame === 'opt') {
        out.push(renderNotes(ev.body, cols, colW));
      } else {
        for (const b of ev.branches) out.push(renderNotes(b.body, cols, colW));
      }
    }
  }
  return out.join('');
}

function renderNote(n, cols, colW) {
  let x, w;
  if (n.placement === 'over') {
    const a = cols[n.actors[0]];
    const b = n.actors[1] ? cols[n.actors[1]] : null;
    if (b) {
      const left  = Math.min(a.cx, b.cx) - colW / 4;
      const right = Math.max(a.cx, b.cx) + colW / 4;
      x = left; w = right - left;
    } else {
      x = a.cx - colW / 3;
      w = (colW / 3) * 2;
    }
  } else if (n.placement === 'leftOf') {
    const a = cols[n.actors[0]];
    w = colW * 0.7;
    x = a.cx - w - 16;
  } else {
    const a = cols[n.actors[0]];
    w = colW * 0.7;
    x = a.cx + 16;
  }
  const y = n.y - NOTE_PAD_Y;
  const h = 26 + NOTE_PAD_Y;
  return `
    <g data-note-id="${esc(n.id)}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"
            fill="#fef9c3" stroke="#facc15" stroke-width="1"/>
      <text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle"
            font-size="11.5" font-family="Inter Tight" fill="#3b2a06">${esc(n.text)}</text>
    </g>`;
}

function renderFrames(events, cols, colW) {
  const out = [];
  const actorIds = Object.keys(cols);
  if (actorIds.length === 0) return '';
  const leftX = Math.min(...actorIds.map(id => cols[id].left));
  const rightX = Math.max(...actorIds.map(id => cols[id].right));
  walkForFrames(events, leftX, rightX, out);
  return out.join('');
}

function walkForFrames(events, leftX, rightX, out) {
  for (const ev of events) {
    if (ev.kind === 'frame') {
      // ev.depth is set during layout; using it here (instead of the
      // recursion depth of this walk) decouples the visual depth
      // offset from any future render-time recursion changes.
      const depth = ev.depth || 0;
      const x = leftX - 4 - depth * 2;
      const w = (rightX - leftX) + 8 + depth * 4;
      const y = ev.headerY;
      const h = ev.endY - ev.headerY;
      const labelText = ev.frame === 'alt' || ev.frame === 'par'
        ? `${ev.frame} ${ev.branches[0].label || ''}`
        : `${ev.frame} ${ev.label || ''}`;
      out.push(`
        <g data-frame-kind="${ev.frame}">
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"
                fill="none" stroke="#94a3b8" stroke-width="1"/>
          <rect x="${x}" y="${y}" width="${Math.min(80, w - 4)}" height="18" rx="2"
                fill="#e2e8f0" stroke="#94a3b8" stroke-width="1"/>
          <text x="${x + 8}" y="${y + 13}" font-size="10.5" font-weight="700"
                font-family="JetBrains Mono" fill="#1e293b">${esc(labelText)}</text>
        </g>`);
      // Dividers for alt/par.
      if (ev.frame === 'alt' || ev.frame === 'par') {
        for (let b = 1; b < ev.branches.length; b++) {
          const dy = ev.branches[b].dividerY;
          out.push(`
            <line x1="${x + 2}" y1="${dy - 6}" x2="${x + w - 2}" y2="${dy - 6}"
                  stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3"/>
            <text x="${x + 8}" y="${dy + 4}" font-size="10.5" font-weight="700"
                  font-family="JetBrains Mono" fill="#1e293b">${esc(ev.branches[b].label || '')}</text>`);
        }
      }
      // Recurse into branches/body to render nested frames.
      if (ev.frame === 'loop' || ev.frame === 'opt') {
        walkForFrames(ev.body, leftX, rightX, out);
      } else {
        for (const b of ev.branches) walkForFrames(b.body, leftX, rightX, out);
      }
    }
  }
}

// ── REGISTER ────────────────────────────────────────────────

registerType('sequence', {
  name: 'sequence',
  parse:     parseSequenceDSL,
  renderSVG: renderSequence,
});

export default { parseSequenceDSL, renderSequence };
