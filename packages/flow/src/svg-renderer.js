// -----------------------------------------------------------
// Pure SVG string renderer — zero React, zero dependencies.
// Each function returns an SVG string. Works in any browser
// including pages that already have React (Confluence, etc.).
// -----------------------------------------------------------

import { shapePath, shapeAnchor } from './shapes.js';
import { resolveGraph, shapeOf, edgeMidpoint, roughPath, NODE_KINDS } from './graph.js';
import { getIcon } from './icons.js';
import { getType } from './types.js';

// ── SVG attribute helpers ──────────────────────────────────

function attrs(obj) {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => {
      const attr = k.replace(/([A-Z])/g, m => '-' + m.toLowerCase())
        .replace(/^stroke-width$/, 'stroke-width')
        .replace(/^stroke-dasharray$/, 'stroke-dasharray')
        .replace(/^stroke-linecap$/, 'stroke-linecap')
        .replace(/^stroke-linejoin$/, 'stroke-linejoin')
        .replace(/^text-anchor$/, 'text-anchor')
        .replace(/^dominant-baseline$/, 'dominant-baseline')
        .replace(/^font-family$/, 'font-family')
        .replace(/^font-weight$/, 'font-weight')
        .replace(/^font-size$/, 'font-size')
        .replace(/^letter-spacing$/, 'letter-spacing')
        .replace(/^stop-color$/, 'stop-color')
        .replace(/^stop-opacity$/, 'stop-opacity')
        .replace(/^vector-effect$/, 'vector-effect')
        .replace(/^pointer-events$/, 'pointer-events')
        .replace(/^marker-end$/, 'marker-end')
        .replace(/^marker-start$/, 'marker-start')
        .replace(/^pattern-units$/, 'patternUnits')
        .replace(/^pattern-transform$/, 'patternTransform')
        .replace(/^gradient-units$/, 'gradientUnits')
        .replace(/^gradient-transform$/, 'gradientTransform')
        .replace(/^key-points$/, 'keyPoints')
        .replace(/^key-times$/, 'keyTimes')
        .replace(/^repeat-count$/, 'repeatCount')
        .replace(/^attribute-name$/, 'attributeName')
        .replace(/^base-frequency$/, 'baseFrequency')
        .replace(/^num-octaves$/, 'numOctaves');
      return `${attr}="${String(v).replace(/"/g, '&quot;')}"`;
    }).join(' ');
}

const e = (tag, props, ...children) => {
  const a = props ? ' ' + attrs(props) : '';
  const inner = children.flat(Infinity).filter(Boolean).join('');
  if (!inner && ['path','rect','circle','ellipse','line','polyline','polygon','image'].includes(tag)) {
    return `<${tag}${a}/>`;
  }
  return `<${tag}${a}>${inner}</${tag}>`;
};

const g = (props, ...children) => e('g', props, ...children);
const text = (props, content) => `<text ${attrs(props)}>${esc(content)}</text>`;
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── Shared shape shell ─────────────────────────────────────

function shapeShell(node, { fill, stroke, strokeWidth, strokeDasharray }) {
  const shape = shapeOf(node);
  const s = shapePath(shape, node.w, node.h, node);
  const base = { fill, stroke, strokeWidth, strokeDasharray };
  if (shape === 'rect') return e('rect', { width: node.w, height: node.h, rx: s.rx ?? 10, ...base });
  if (shape === 'square') {
    const sz = Math.min(node.w, node.h), ox = (node.w-sz)/2, oy = (node.h-sz)/2;
    return e('rect', { x: ox, y: oy, width: sz, height: sz, rx: 4, ...base });
  }
  if (shape === 'pill') return e('rect', { width: node.w, height: node.h, rx: node.h/2, ...base });
  if (shape === 'circle' && s.circle) return e('circle', { cx: s.circle.cx, cy: s.circle.cy, r: s.circle.r, ...base });
  if (shape === 'oval' && s.ellipse) return e('ellipse', { cx: s.ellipse.cx, cy: s.ellipse.cy, rx: s.ellipse.rx, ry: s.ellipse.ry, ...base });
  if (shape === 'cylinder') return g(null,
    e('path', { d: s.body, fill, stroke, strokeWidth }),
    e('path', { d: s.top,  fill, stroke, strokeWidth }),
  );
  return e('path', { d: s.d, ...base });
}

// ── Node image / icon (shared across styles) ───────────────
//
// Renders the node's `image:` (URL or data URL) or `icon:` (bundled
// sprite name). Honors:
//   - `imagePosition`: 'top' (default) | 'center' | 'bottom' | 'fill'
//   - `imageFit`:      'contain' (default) | 'cover' | 'fill'
//
// `kind: image` with `src:` is back-compat — treated as `image: <src>`.
// Returns '' when the node has no image/icon.

function clipPathFor(node) {
  const shape = shapeOf(node);
  const s = shapePath(shape, node.w, node.h, node);
  return s.d;
}

function nodeImageOrIcon(node) {
  if (!node) return '';
  const w = node.w, h = node.h;
  const imageUrl = node.image || (node.kind === 'image' && node.src ? node.src : null);
  const iconName = node.icon;

  if (imageUrl) {
    const position = node.imagePosition || 'top';
    const fit = node.imageFit || 'contain';

    if (position === 'fill') {
      const preserve = fit === 'fill'  ? 'none'
                     : fit === 'cover' ? 'xMidYMid slice'
                                       : 'xMidYMid meet';
      const clipId = `fd-clip-${node.id}`;
      return (
        e('clipPath', { id: clipId }, e('path', { d: clipPathFor(node) })) +
        e('image', {
          href: imageUrl, x: 0, y: 0, width: w, height: h,
          preserveAspectRatio: preserve, clipPath: `url(#${clipId})`,
        })
      );
    }

    // Small image positioned inside the node.
    const size = Math.min(40, Math.min(w, h) - 16);
    const x = w/2 - size/2;
    const y = position === 'bottom' ? h - size - 8
            : position === 'center' ? h/2 - size/2
                                    : 8;
    const preserve = fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
    return e('image', {
      href: imageUrl, x, y, width: size, height: size, preserveAspectRatio: preserve,
    });
  }

  if (iconName) {
    const fragment = getIcon(iconName);
    if (!fragment) return '';
    const size = Math.min(28, Math.min(w, h) - 20);
    if (size <= 0) return '';
    const x = w/2 - size/2;
    const y = node.imagePosition === 'center' ? h/2 - size/2
            : node.imagePosition === 'bottom' ? h - size - 8
                                              : 6;
    // Sprite paths use a 24×24 viewBox + currentColor — scale to `size`.
    const scale = size / 24;
    return `<g transform="translate(${x} ${y}) scale(${scale})" style="color:#1e293b">${fragment}</g>`;
  }

  return '';
}

// ── Node accessibility (title + desc) ──────────────────────
//
// Inlined inside each node group so screen readers announce the node.
// `<title>` becomes the accessible name. `<desc>` adds context (kind + sub).

function nodeA11y(node) {
  if (!node) return '';
  const titleText = esc(node.label || node.id || '');
  const kindLabel = node.kind ? String(node.kind) : '';
  const descBits = [kindLabel, node.sub ? String(node.sub) : ''].filter(Boolean);
  const descText = esc(descBits.join(' — '));
  return (
    (titleText ? `<title>${titleText}</title>` : '') +
    (descText  ? `<desc>${descText}</desc>` : '')
  );
}

// ── Node / edge wrappers (data-id + ARIA) ──────────────────
//
// Each node/edge is wrapped in an outer <g> that carries:
//   - data-node-id / data-edge-id for click delegation in viewport.js
//   - role="img" + an inline <title>/<desc> for accessibility
//
// The per-style renderer's output goes inside this wrapper unchanged.

function wrapNode(node, inner) {
  return `<g data-node-id="${esc(node.id)}" role="img">${nodeA11y(node)}${inner}</g>`;
}

function wrapEdge(edge, inner) {
  const fromTo = `${edge.from || ''} → ${edge.to || ''}`;
  const label = edge.label ? `${edge.label} (${fromTo})` : fromTo;
  return `<g data-edge-id="${esc(edge.id)}" role="img"><title>${esc(label)}</title>${inner}</g>`;
}

// ── Edge stroke-width helper (sankey-style weighting) ──────
//
// When `edge.weight` is a positive number, scale the base stroke width
// to communicate volume — pass the result of edgeStrokeWidth(edge, base)
// anywhere a style would otherwise use a literal stroke-width.

function edgeStrokeWidth(edge, base) {
  if (edge && typeof edge.weight === 'number' && edge.weight > 0) {
    // weight=1 → 1×, weight=10 → ~3×. Capped to avoid hairline-wide bands.
    const scale = Math.max(0.5, Math.min(6, Math.sqrt(edge.weight)));
    return Math.max(0.5, base * scale);
  }
  return base;
}

// ── Node label ─────────────────────────────────────────────

function nodeLabel(node, { fill, subFill, fontFamily='Inter Tight', fontWeight=600, fontSize=13, hand=false, centerOffsetY=0 }) {
  const shape = shapeOf(node);
  const centered = ['diamond','circle','oval','pill'].includes(shape);
  if (centered) {
    return g(null,
      text({ x: node.w/2, y: node.h/2 + (node.sub ? -3 : 4) + centerOffsetY, textAnchor: 'middle', dominantBaseline: 'middle', fontFamily, fontWeight, fontSize, fill }, node.label),
      node.sub ? text({ x: node.w/2, y: node.h/2 + 12 + centerOffsetY, textAnchor: 'middle', dominantBaseline: 'middle', fontFamily: 'JetBrains Mono', fontSize: 9.5, fill: subFill }, node.sub) : '',
    );
  }
  return g(null,
    text({ x: node.w/2, y: node.h/2 + 4, textAnchor: 'middle', fontFamily, fontWeight, fontSize: hand ? 20 : fontSize, fill }, node.label),
    node.sub ? text({ x: node.w/2, y: node.h-12, textAnchor: 'middle', fontFamily: hand ? 'Caveat' : 'JetBrains Mono', fontSize: hand ? 13 : 9.5, fill: subFill }, node.sub) : '',
  );
}

// ── Edge label ─────────────────────────────────────────────

function edgeLabel(txt, x, y, { bg='#faf7ef', fg='#6b6459', mono=false } = {}) {
  if (!txt) return '';
  const ff = mono ? 'JetBrains Mono' : 'Inter Tight';
  return g({ transform: `translate(${x} ${y - 12})` },
    text({ textAnchor: 'middle', dominantBaseline: 'middle', fontFamily: ff, fontSize: 11, fill: bg, stroke: bg, strokeWidth: 3.5, strokeLinejoin: 'round' }, txt),
    text({ textAnchor: 'middle', dominantBaseline: 'middle', fontFamily: ff, fontSize: 11, fill: fg, fontWeight: 600 }, txt),
  );
}

// ── Node icon ──────────────────────────────────────────────

function nodeIcon(kind, { color='#8f8779', mono=false } = {}) {
  const sw = mono ? 1 : 1.2;
  const c = { stroke: color, strokeWidth: sw, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const s = 14;
  switch (kind) {
    case 'actor': case 'client': case 'person':
      return g(null, e('circle', { cx: s/2, cy: 4, r: 2.5, ...c }), e('path', { d: `M1 ${s} C 2 9, 5 9, ${s/2} 9 C ${s-5} 9, ${s-2} 9, ${s-1} ${s}`, ...c }));
    case 'service': case 'process':
      return g(null, e('rect', { x:1, y:2, width:s-2, height:s-4, rx:1.5, ...c }), e('line', { x1:1, y1:6, x2:s-1, y2:6, ...c }));
    case 'gateway':
      return g(null, e('path', { d: `M${s/2} 1 L${s-1} ${s/2} L${s/2} ${s-1} L1 ${s/2} Z`, ...c }));
    case 'store':
      return g(null, e('ellipse', { cx:s/2, cy:3, rx:5.5, ry:1.8, ...c }), e('path', { d:`M1 3 L1 ${s-3} C 1 ${s-1}, ${s-1} ${s-1}, ${s-1} ${s-3} L${s-1} 3`, ...c }));
    case 'cache':
      return g(null, e('circle', { cx:s/2, cy:s/2, r:5.5, ...c }), e('circle', { cx:s/2, cy:s/2, r:1.2, ...c }));
    case 'queue':
      return g(null, e('rect', { x:1, y:3, width:s-2, height:3, ...c }), e('rect', { x:1, y:7.5, width:s-2, height:3, ...c }));
    case 'external':
      return g(null, e('path', { d:`M3 ${s/2+2} C 1 ${s/2+2}, 1 ${s/2-1}, 3 ${s/2-1} C 3 3, 8 2, 10 ${s/2-2} C 13 ${s/2-2}, 13 ${s/2+2}, ${s-2} ${s/2+2} Z`, ...c }));
    case 'boundary':
      return g(null, e('rect', { x:1, y:1, width:s-2, height:s-2, rx:1, strokeDasharray:'2 1.5', ...c }));
    case 'start':
      return g(null, e('path', { d:'M4 2 L11 7 L4 12 Z', fill:color, stroke:'none' }));
    case 'stop':
      return g(null, e('rect', { x:3, y:3, width:8, height:8, fill:color, stroke:'none' }));
    case 'decision':
      return g(null, text({ x:s/2, y:s-3, textAnchor:'middle', fontSize:11, fontFamily:'Inter Tight', fontWeight:700, fill:color }, '?'));
    case 'event':
      return g(null, e('path', { d:'M8 1 L3 8 H7 L6 13 L11 6 H7 L8 1 Z', fill:color, stroke:'none' }));
    case 'step': case 'tree':
      return g(null, e('circle', { cx:s/2, cy:s/2, r:3, ...c }));
    case 'image':
      return g(null, e('rect', { x:1, y:2, width:s-2, height:s-4, rx:1, ...c }), e('circle', { cx:5, cy:6, r:1.2, ...c }), e('path', { d:`M1 ${s-4} L5 ${s-7} L9 ${s-5} L${s-1} ${s-2}`, ...c }));
    case 'function':
      return g(null, text({ x:s/2, y:s-2, textAnchor:'middle', fontSize:13, fontFamily:'Inter Tight', fontWeight:500, fill:color }, 'λ'));
    case 'worker': {
      const teeth = Array.from({ length: 6 }, (_, i) => {
        const a = (i * Math.PI) / 3;
        return e('line', { x1:s/2+Math.cos(a)*5, y1:s/2+Math.sin(a)*5, x2:s/2+Math.cos(a)*6.7, y2:s/2+Math.sin(a)*6.7, ...c });
      }).join('');
      return g(null, e('circle', { cx:s/2, cy:s/2, r:3.5, ...c }), teeth);
    }
    case 'loadbalancer':
      return g(null,
        e('circle', { cx:s/2, cy:3, r:1.6, ...c }),
        e('line', { x1:s/2, y1:4.5, x2:s/2, y2:s-2, ...c }),
        e('line', { x1:2, y1:s-2, x2:s-2, y2:s-2, ...c }),
        e('path', { d:`M2 ${s-2} L${s/2} 7 L${s-2} ${s-2}`, ...c }),
      );
    case 'cdn':
      return g(null,
        e('circle', { cx:s/2, cy:s/2, r:5.5, ...c }),
        e('path', { d:`M1.5 ${s/2} H${s-1.5}`, ...c }),
        e('path', { d:`M${s/2} 1.5 C 4 ${s/2}, 4 ${s/2}, ${s/2} ${s-1.5}`, ...c }),
        e('path', { d:`M${s/2} 1.5 C 10 ${s/2}, 10 ${s/2}, ${s/2} ${s-1.5}`, ...c }),
      );
    case 'auth':
      return g(null,
        e('circle', { cx:4, cy:s/2, r:2.5, ...c }),
        e('line', { x1:6, y1:s/2, x2:s-1, y2:s/2, ...c }),
        e('line', { x1:s-3, y1:s/2, x2:s-3, y2:s/2+2.5, ...c }),
        e('line', { x1:s-1, y1:s/2, x2:s-1, y2:s/2+2.5, ...c }),
      );
    default:
      return e('rect', { x:2, y:2, width:s-4, height:s-4, ...c });
  }
}

// ── SLEEK kind bodies ──────────────────────────────────────

function sleekKindBody(node, { fill, stroke, strokeW, ink, muted, accent, active }) {
  const { w, h } = node;
  const headerH = 22;
  const subtleBand = active ? '#fef3c7' : '#f3ecd8';
  const card = (rx=12) => e('rect', { width:w, height:h, rx, fill, stroke, strokeWidth:strokeW });
  const centerLabel = (dy=0) => g(null,
    text({ x:w/2, y:h/2+4+dy, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:13, fill:ink }, node.label),
    node.sub ? text({ x:w/2, y:h/2+18+dy, textAnchor:'middle', fontFamily:'JetBrains Mono', fontSize:9.5, fill:muted }, node.sub) : '',
  );
  const headerLabel = (badge) => g(null,
    text({ x:12, y:14.5, fontFamily:'JetBrains Mono', fontSize:9, letterSpacing:'.08em', fill:active?'#7a5a00':muted }, badge),
    text({ x:w/2, y:headerH+(h-headerH)/2+2.5, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:14, fill:ink }, node.label),
    node.sub ? text({ x:w/2, y:headerH+(h-headerH)/2+16, textAnchor:'middle', fontFamily:'JetBrains Mono', fontSize:9.5, fill:muted }, node.sub) : '',
  );

  switch (node.kind) {
    case 'service': {
      const notchBody = g(null,
        card(12),
        e('path', { d:`M0 ${headerH} H${w}`, stroke, strokeWidth:strokeW, opacity:'.7' }),
        e('rect', { x:1, y:1, width:w-2, height:headerH-1, rx:11, fill:subtleBand, opacity:'.55', style:'clip-path:inset(0 0 50% 0)' }),
      );
      const dots = g(null,
        e('circle', { cx:10, cy:11, r:'2.2', fill:active?accent:'#c9bf9e' }),
        e('circle', { cx:17, cy:11, r:'2.2', fill:'#e4decd' }),
        e('circle', { cx:24, cy:11, r:'2.2', fill:'#e4decd' }),
      );
      return { body: notchBody, decor: dots, label: headerLabel('SERVICE') };
    }

    case 'process': {
      const notch=10;
      const pd=`M12 0 H${w-12} Q${w} 0 ${w} 12 V${h-notch} L${w-notch} ${h} H${notch} L0 ${h-notch} V12 Q0 0 12 0 Z`;
      const gearAngles = [0,60,120,180,240,300];
      return { body: g(null,
        e('path', { d:pd, fill, stroke, strokeWidth:strokeW }),
        e('rect', { x:0, y:0, width:w, height:4, rx:2, fill:active?accent:'#e4decd' }),
      ), decor: g({ transform:`translate(${w-22} 10)`, stroke:active?'#7a5a00':muted, strokeWidth:'1.1', fill:'none' },
        e('circle', { cx:6, cy:6, r:3 }),
        e('circle', { cx:6, cy:6, r:1, fill:active?'#7a5a00':muted }),
        ...gearAngles.map(a => e('line', { x1:6, y1:1.5, x2:6, y2:2.5, transform:`rotate(${a} 6 6)` })),
      ), label: centerLabel() };
    }

    case 'store': {
      const ry=10;
      return { body: g(null,
        e('path', { d:`M0 ${ry} V${h-ry} a${w/2} ${ry} 0 0 0 ${w} 0 V${ry}`, fill, stroke, strokeWidth:strokeW }),
        e('path', { d:`M0 ${ry} a${w/2} ${ry} 0 1 0 ${w} 0 a${w/2} ${ry} 0 1 0 ${-w} 0`, fill:active?'#fef3c7':'#fbf6e7', stroke, strokeWidth:strokeW }),
      ), decor: g(null,
        e('path', { d:`M0 ${h*0.5} a${w/2} ${ry} 0 0 0 ${w} 0`, stroke:active?'#e7c97a':'#e4decd', strokeWidth:1, fill:'none', opacity:'.4' }),
        e('path', { d:`M0 ${h*0.72} a${w/2} ${ry} 0 0 0 ${w} 0`, stroke:active?'#e7c97a':'#ece7db', strokeWidth:.8, fill:'none', opacity:'.3' }),
      ), label: g(null,
        text({ x:w/2, y:h/2+10, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:13, fill:ink }, node.label),
        node.sub ? text({ x:w/2, y:h/2+24, textAnchor:'middle', fontFamily:'JetBrains Mono', fontSize:9.5, fill:muted }, node.sub) : '',
      ) };
    }

    case 'cache': {
      const rectW = (w-24)/4 - 4;
      const chips = [0,1,2,3].map(i => {
        const rx2 = 12 + i*((w-24)/4) + 2;
        const ry2 = h/2 - 4;
        const anim = active ? `<animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" begin="${i*0.18}s" repeatCount="indefinite"/>` : '';
        return e('rect', { x:rx2, y:ry2, width:rectW, height:12, rx:1.5,
          fill:active?'#fde68a':'#f0e9d6', stroke:active?accent:'#d9d0b8', strokeWidth:.8 }, anim);
      }).join('');
      const contactCount = Math.max(10, Math.floor(w/8));
      const contactW = (w-24)/contactCount;
      const contacts = Array.from({ length: contactCount }, (_, i) =>
        e('rect', { x:12+i*contactW+0.5, y:0, width:contactW-1, height:3, fill:active?'#d4a315':'#c9bf9e', opacity:'.55' })
      ).join('');
      return { body: card(10),
        decor: g(null, chips, g({ transform:`translate(0 ${h-7})` }, contacts)),
        label: text({ x:w/2, y:16, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:13, fill:ink }, node.label),
      };
    }

    case 'queue': {
      const labelH=20, gap=5, rowCount=3;
      const rowH = Math.max(8, (h-labelH-8-gap*(rowCount-1))/rowCount);
      const rowColors = [active?accent:'#e8b820', '#f2d664', '#e8deb5'];
      const rows = [0,1,2].map(i => {
        const y2 = labelH + i*(rowH+gap);
        const anim = active ? `<animate attributeName="opacity" values="0.4;1;0.4" dur="1.4s" begin="${(rowCount-1-i)*0.2}s" repeatCount="indefinite"/>` : '';
        return e('rect', { x:12, y:y2, width:w-24, height:rowH, rx:Math.min(rowH/2,5),
          fill:rowColors[i], stroke:i===0?(active?'#7a5a00':'#b79414'):'#d9c98b', strokeWidth:i===0?1:.6 }, anim);
      }).join('');
      return { body: card(10),
        decor: g(null, rows, e('path', { d:`M${w-8} ${labelH+rowH/2} l5 -3.5 v7 z`, fill:active?'#7a5a00':'#b79414' })),
        label: text({ x:w/2, y:14, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:12.5, fill:ink }, node.label),
      };
    }

    case 'actor': {
      const headR=9;
      return { body: e('rect', { y:headR+3, width:w, height:h-headR-3, rx:12, fill, stroke, strokeWidth:strokeW }),
        decor: g(null,
          e('circle', { cx:w/2, cy:headR+1, r:headR, fill, stroke, strokeWidth:strokeW }),
          e('circle', { cx:w/2, cy:headR-1, r:'2.2', fill:active?'#7a5a00':muted }),
          e('path', { d:`M${w/2-4} ${headR+4} Q${w/2} ${headR+7} ${w/2+4} ${headR+4}`, stroke:active?'#7a5a00':muted, strokeWidth:'1.2', fill:'none' }),
        ),
        label: g(null,
          text({ x:w/2, y:headR+3+(h-headR-3)/2+8, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:13, fill:ink }, node.label),
          node.sub ? text({ x:w/2, y:headR+3+(h-headR-3)/2+22, textAnchor:'middle', fontFamily:'JetBrains Mono', fontSize:9.5, fill:muted }, node.sub) : '',
        ),
      };
    }

    case 'gateway': {
      const gi=Math.min(w*0.14,16);
      return { body: e('path', { d:`M${gi} 0 L${w-gi} 0 L${w} ${h/2} L${w-gi} ${h} L${gi} ${h} L0 ${h/2} Z`, fill, stroke, strokeWidth:strokeW }),
        decor: g(null,
          e('path', { d:`M${gi} 6 L${w-gi} 6`, stroke:active?accent:'#e4decd', strokeWidth:1 }),
          e('path', { d:`M${gi} ${h-6} L${w-gi} ${h-6}`, stroke:active?accent:'#e4decd', strokeWidth:1 }),
        ),
        label: centerLabel(),
      };
    }

    case 'external': {
      const cd=`M${w*.18} ${h*.6} C ${w*.02} ${h*.6}, ${w*.02} ${h*.2}, ${w*.22} ${h*.25} C ${w*.28} ${h*.02}, ${w*.58} ${h*.02}, ${w*.62} ${h*.22} C ${w*.85} ${h*.15}, ${w*.98} ${h*.35}, ${w*.9} ${h*.6} C ${w*.98} ${h*.82}, ${w*.75} ${h*.98}, ${w*.6} ${h*.88} C ${w*.4} ${h*1.02}, ${w*.1} ${h*.95}, ${w*.18} ${h*.6} Z`;
      return { body: e('path', { d:cd, fill, stroke, strokeWidth:strokeW }),
        decor: g({ transform:'translate(0 -4)' },
          e('path', { d:`M${w*.42} ${h*.32} A 6 6 0 0 1 ${w*.58} ${h*.32}`, stroke:active?accent:muted, strokeWidth:'1.2', fill:'none' }),
          e('path', { d:`M${w*.45} ${h*.38} A 4 4 0 0 1 ${w*.55} ${h*.38}`, stroke:active?accent:muted, strokeWidth:'1.2', fill:'none' }),
          e('circle', { cx:w/2, cy:h*.45, r:'1.3', fill:active?accent:muted }),
        ),
        label: g(null,
          text({ x:w/2, y:h*.74, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:12.5, fill:ink }, node.label),
          node.sub ? text({ x:w/2, y:h*.86, textAnchor:'middle', fontFamily:'JetBrains Mono', fontSize:9, fill:muted }, node.sub) : '',
        ),
      };
    }

    case 'boundary': {
      const chipW = Math.max(70, (node.label||'').length*7);
      return { noShadow:true,
        body: e('rect', { width:w, height:h, rx:10, fill:'transparent', stroke:active?accent:'#a89e84', strokeDasharray:'5 4', strokeWidth:'1.2' }),
        decor: g(null,
          e('rect', { x:10, y:-8, width:chipW, height:16, rx:8, fill:active?'#fef3c7':'#fbf7ea', stroke:active?accent:'#d9d0b8', strokeWidth:.8 }),
          text({ x:10+chipW/2, y:3, textAnchor:'middle', fontFamily:'JetBrains Mono', fontSize:10, fill:active?'#7a5a00':'#7a7060', letterSpacing:'.06em' }, node.label),
        ),
        label: null,
      };
    }

    case 'start': {
      return { body: e('rect', { width:w, height:h, rx:h/2, fill:active?'#fef3c7':'#eef8e6', stroke:active?accent:'#bfdfa8', strokeWidth:strokeW }),
        decor: g(null,
          e('circle', { cx:18, cy:h/2, r:8, fill:active?accent:'#9fcd7b' }),
          e('path', { d:`M${18-2} ${h/2-4} L${18+4} ${h/2} L${18-2} ${h/2+4} Z`, fill:'#fff' }),
        ),
        label: text({ x:w/2+6, y:h/2+4.5, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:13, fill:ink }, node.label),
      };
    }

    case 'stop': {
      return { body: e('rect', { width:w, height:h, rx:h/2, fill:active?'#fef3c7':'#fdecec', stroke:active?accent:'#ecc7c7', strokeWidth:strokeW }),
        decor: g(null,
          e('circle', { cx:18, cy:h/2, r:8, fill:active?accent:'#d57a7a' }),
          e('rect', { x:18-3.5, y:h/2-3.5, width:7, height:7, rx:1, fill:'#fff' }),
        ),
        label: text({ x:w/2+6, y:h/2+4.5, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:13, fill:ink }, node.label),
      };
    }

    case 'decision': {
      return { body: e('path', { d:`M${w/2} 0 L${w} ${h/2} L${w/2} ${h} L0 ${h/2} Z`, fill, stroke, strokeWidth:strokeW }),
        decor: null,
        label: text({ x:w/2, y:h/2+4, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:13, fill:ink }, node.label),
      };
    }

    case 'event': {
      const r=Math.min(w,h)/2-2;
      return { body: e('circle', { cx:w/2, cy:h/2, r, fill:active?'#fef3c7':'#fdf8e4', stroke:active?accent:'#d9c98b', strokeWidth:strokeW }),
        decor: e('path', { d:`M ${w/2+2} ${h/2-8} L ${w/2-4} ${h/2+1} H ${w/2} L ${w/2-2} ${h/2+8} L ${w/2+4} ${h/2-1} H ${w/2} Z`, fill:active?'#7a5a00':'#b79414' }),
        label: text({ x:w/2, y:h+14, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:12.5, fill:ink }, node.label),
      };
    }

    case 'step': case 'tree': {
      return { body: e('circle', { cx:w/2, cy:h/2, r:Math.min(w,h)/2-2, fill, stroke, strokeWidth:strokeW }),
        decor: e('circle', { cx:w/2, cy:h/2, r:3, fill:active?accent:muted }),
        label: text({ x:w/2, y:h+14, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:12.5, fill:ink }, node.label),
      };
    }

    case 'image': {
      return { body: card(10),
        decor: g(null,
          e('rect', { x:10, y:10, width:w-20, height:h-30, rx:4, fill:active?'#fef3c7':'#faf3dc', stroke:'#e4decd' }),
          e('circle', { cx:18, cy:18, r:3, fill:active?accent:'#d9c98b' }),
          e('path', { d:`M12 ${h-24} L ${w/2} ${h-34} L ${w-12} ${h-22}`, stroke:active?'#7a5a00':muted, strokeWidth:'1.2', fill:'none', strokeLinejoin:'round' }),
        ),
        label: text({ x:w/2, y:h-6, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:11.5, fill:ink }, node.label),
      };
    }

    case 'function': {
      return { body: card(12),
        decor: g(null,
          e('rect', { x:1, y:1, width:w-2, height:4, rx:2, fill:active?accent:'#e4decd' }),
          g({ transform:`translate(${w-26} 8)` },
            e('rect', { width:20, height:14, rx:3, fill:active?'#fef3c7':'#faf3dc', stroke:active?accent:'#d9c98b', strokeWidth:.8 }),
            text({ x:10, y:11, textAnchor:'middle', fontFamily:'JetBrains Mono', fontWeight:700, fontSize:10, fill:active?'#7a5a00':muted }, '\u03bb'),
          ),
        ),
        label: centerLabel(),
      };
    }

    case 'worker': {
      const workerAngles=[0,45,90,135,180,225,270,315];
      return { body: card(10),
        decor: g(null,
          g({ transform:`translate(${w-22} 10)`, stroke:active?'#7a5a00':muted, strokeWidth:'1.1', fill:'none' },
            e('circle', { cx:6, cy:6, r:'3.6' }),
            e('circle', { cx:6, cy:6, r:'1.2', fill:active?'#7a5a00':muted }),
            ...workerAngles.map(a => e('line', { x1:6, y1:1.5, x2:6, y2:2.5, transform:`rotate(${a} 6 6)` })),
          ),
          g({ transform:`translate(12 ${h-12})` },
            ...[0,1,2].map(i => e('circle', { cx:i*7, cy:0, r:2, fill:active?accent:'#d9c98b', opacity:String(1-i*0.25) })),
          ),
        ),
        label: centerLabel(-2),
      };
    }

    case 'loadbalancer': {
      return { body: card(10),
        decor: g({ transform:`translate(${w-30} ${h/2})`, stroke:active?'#7a5a00':muted, strokeWidth:'1.3', fill:'none', strokeLinecap:'round' },
          e('circle', { cx:0, cy:0, r:3, fill:active?accent:'#fbf6e7' }),
          e('line', { x1:3, y1:0, x2:14, y2:-7 }),
          e('line', { x1:3, y1:0, x2:16, y2:0 }),
          e('line', { x1:3, y1:0, x2:14, y2:7 }),
          e('circle', { cx:14, cy:-7, r:'1.5', fill:active?'#7a5a00':muted }),
          e('circle', { cx:16, cy:0, r:'1.5', fill:active?'#7a5a00':muted }),
          e('circle', { cx:14, cy:7, r:'1.5', fill:active?'#7a5a00':muted }),
        ),
        label: centerLabel(),
      };
    }

    case 'cdn': {
      const cdd=`M${w*.18} ${h*.6} C ${w*.02} ${h*.6}, ${w*.02} ${h*.2}, ${w*.22} ${h*.25} C ${w*.28} ${h*.02}, ${w*.58} ${h*.02}, ${w*.62} ${h*.22} C ${w*.85} ${h*.15}, ${w*.98} ${h*.35}, ${w*.9} ${h*.6} C ${w*.98} ${h*.82}, ${w*.75} ${h*.98}, ${w*.6} ${h*.88} C ${w*.4} ${h*1.02}, ${w*.1} ${h*.95}, ${w*.18} ${h*.6} Z`;
      return { body: e('path', { d:cdd, fill, stroke, strokeWidth:strokeW }),
        decor: g({ transform:`translate(${w/2} ${h*.42})`, stroke:active?'#7a5a00':muted, strokeWidth:'1.1', fill:'none' },
          e('circle', { r:6 }),
          e('ellipse', { rx:6, ry:2.5 }),
          e('line', { x1:-6, y1:0, x2:6, y2:0 }),
        ),
        label: text({ x:w/2, y:h*.78, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:12.5, fill:ink }, node.label),
      };
    }

    case 'auth': {
      const ar=Math.min(w*.18,14);
      const ad=`M${ar} 0 H${w-ar} Q${w} 0 ${w} ${ar} V${h*.55} Q${w} ${h*.85} ${w/2} ${h} Q0 ${h*.85} 0 ${h*.55} V${ar} Q0 0 ${ar} 0 Z`;
      return { body: e('path', { d:ad, fill, stroke, strokeWidth:strokeW }),
        decor: g({ transform:`translate(${w/2} ${h*.34})`, stroke:active?'#7a5a00':muted, strokeWidth:'1.4', fill:'none' },
          e('rect', { x:-4, y:-1, width:8, height:7, rx:'1.2', fill:active?'#fef3c7':'#faf3dc' }),
          e('path', { d:'M-2.5 -1 V-3.5 Q0 -5.5 2.5 -3.5 V-1' }),
        ),
        label: text({ x:w/2, y:h*.74, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:12.5, fill:ink }, node.label),
      };
    }

    case 'monitor': {
      return { body: card(10),
        decor: g({ transform:`translate(10 ${h/2-6})` },
          e('rect', { width:w-20, height:24, rx:3, fill:active?'#fef3c7':'#faf3dc', stroke:active?accent:'#d9c98b', strokeWidth:.7 }),
          e('polyline', { points:`4,18 ${(w-20)*.25},10 ${(w-20)*.45},14 ${(w-20)*.7},6 ${w-24},12`, fill:'none', stroke:active?'#7a5a00':muted, strokeWidth:1.4 }),
        ),
        label: text({ x:w/2, y:14, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:12.5, fill:ink }, node.label),
      };
    }

    case 'bus': {
      return { body: card(10),
        decor: g(null,
          e('rect', { x:10, y:h/2-4, width:w-20, height:8, rx:3, fill:active?accent:'#e8deb5', stroke:active?'#7a5a00':'#b79414', strokeWidth:.7 }),
          ...[0.2,0.5,0.8].map(p => g({ transform:`translate(${10+(w-20)*p} ${h/2})` },
            e('line', { x1:0, y1:-4, x2:0, y2:-9, stroke:active?'#7a5a00':muted, strokeWidth:1 }),
            e('circle', { cx:0, cy:-11, r:2, fill:active?'#7a5a00':muted }),
            e('line', { x1:0, y1:4, x2:0, y2:9, stroke:active?'#7a5a00':muted, strokeWidth:1 }),
            e('circle', { cx:0, cy:11, r:2, fill:active?'#7a5a00':muted }),
          )),
        ),
        label: text({ x:w/2, y:14, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:12.5, fill:ink }, node.label),
      };
    }

    case 'stream': {
      const waveRows = [0,1,2].map(row => {
        const mx = (w-20)*0.25+10, hx = (w-20)*0.5+10;
        const anim = active && row===0
          ? `<animate attributeName="d" values="M10 ${20+row*10} Q ${mx} ${14+row*10}, ${hx} ${20+row*10} T ${w-10} ${20+row*10};M10 ${20+row*10} Q ${mx} ${26+row*10}, ${hx} ${20+row*10} T ${w-10} ${20+row*10};M10 ${20+row*10} Q ${mx} ${14+row*10}, ${hx} ${20+row*10} T ${w-10} ${20+row*10}" dur="2s" repeatCount="indefinite"/>`
          : '';
        return e('path', { d:`M10 ${20+row*10} Q ${mx} ${14+row*10}, ${hx} ${20+row*10} T ${w-10} ${20+row*10}`,
          fill:'none', stroke:active?(row===0?accent:'#e0c870'):(row===0?'#b79414':'#d9c98b'),
          strokeWidth:row===0?'1.6':'1', strokeLinecap:'round', opacity:String(1-row*0.25) }, anim);
      }).join('');
      return { body: card(10), decor: g(null, waveRows),
        label: text({ x:w/2, y:14, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:12.5, fill:ink }, node.label),
      };
    }

    case 'firewall': {
      const fwRows = [0,1,2].map(row => {
        const y2=22+row*8, offset=row%2===0?0:(w-20)/4;
        return g(null,
          e('line', { x1:10, y1:y2, x2:w-10, y2:y2 }),
          ...[0,1,2,3].map(c => e('line', { x1:10+offset+c*(w-20)/2, y1:y2-8, x2:10+offset+c*(w-20)/2, y2:y2 })),
        );
      }).join('');
      return { body: card(10),
        decor: g({ stroke:active?'#7a5a00':muted, strokeWidth:.7, fill:'none' },
          fwRows,
          e('rect', { x:9.5, y:14, width:w-19, height:h-22, rx:2, fill:active?'rgba(245,197,24,0.15)':'transparent', strokeWidth:.5 }),
        ),
        label: text({ x:w/2, y:14, textAnchor:'middle', fontFamily:'Inter Tight', fontWeight:600, fontSize:12, fill:ink }, node.label),
      };
    }

    case 'mobile': {
      const pw=Math.min(w*.45,44), ph=h-12, px=(w-pw)/2, py=6;
      return { body: g(null,
          e('rect', { width:w, height:h, rx:12, fill:'transparent' }),
          e('rect', { x:px, y:py, width:pw, height:ph, rx:6, fill, stroke, strokeWidth:strokeW }),
          e('rect', { x:px+4, y:py+8, width:pw-8, height:ph-16, rx:2, fill:active?'#fef3c7':'#faf3dc' }),
        ),
        decor: g(null,
          e('circle', { cx:w/2, cy:py+4, r:1, fill:muted }),
          e('rect', { x:w/2-4, y:py+ph-4, width:8, height:1.5, rx:.5, fill:muted }),
          active ? g({ transform:`translate(${w/2} ${h/2})`, stroke:accent, strokeWidth:'1.4', fill:'none' },
            e('path', { d:'M -5 0 Q 0 -5 5 0' }),
            e('path', { d:'M -3 2 Q 0 -1 3 2' }),
          ) : '',
        ),
        label: text({ x:px-4, y:h/2+4, textAnchor:'end', fontFamily:'Inter Tight', fontWeight:600, fontSize:12.5, fill:ink }, node.label),
      };
    }

    default: return null;
  }
}

// ═══════════════════════════════════════════════════════════
// STYLE RENDERERS — return SVG strings
// ═══════════════════════════════════════════════════════════

// ── SLEEK ──────────────────────────────────────────────────

function sleekDefs() {
  return `<defs>
    <filter id="sleek-soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
      <feOffset dy="3"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.15"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="sleek-node" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#fbf6e7"/>
    </linearGradient>
    <linearGradient id="sleek-node-a" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fffbea"/><stop offset="1" stop-color="#fef3c7"/>
    </linearGradient>
    <radialGradient id="sleek-glow" cx=".5" cy=".5" r=".55">
      <stop offset="0" stop-color="#f5c518" stop-opacity=".28"/>
      <stop offset="1" stop-color="#f5c518" stop-opacity="0"/>
    </radialGradient>
    <marker id="sleek-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="#8f8779"/>
    </marker>
    <marker id="sleek-arrow-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="#f5c518"/>
    </marker>
    <marker id="sleek-arrow-err" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" fill="#c0392b"/>
    </marker>
    <pattern id="sleek-dots" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r=".8" fill="#d9d3c6"/>
    </pattern>
    <style>@keyframes sleek-pulse { 0%, 100% { opacity: .6 } 50% { opacity: 1 } }</style>
  </defs>`;
}

function sleekBackground(w, h) {
  return g(null,
    e('rect', { width:w, height:h, fill:'#fffcf3' }),
    e('rect', { width:w, height:h, fill:'url(#sleek-dots)', opacity:.6 }),
  );
}

function sleekNode(node, active) {
  const ink='#26231d', muted='#8f8779', accent='#f5c518';
  const fill = active ? 'url(#sleek-node-a)' : 'url(#sleek-node)';
  const stroke = active ? '#f5c518' : '#e4decd';
  const strokeW = active ? 1.5 : 1;
  const shape = shapeOf(node);
  const hasMedia = !!(node.image || node.icon || (node.kind === 'image' && node.src));
  const useKind = !node.shape && node.kind && !hasMedia;
  const kb = useKind ? sleekKindBody(node, { fill, stroke, strokeW, ink, muted, accent, active }) : null;

  return g({ transform:`translate(${node.x} ${node.y})` },
    active && shape !== 'cylinder' ? e('rect', { x:-10, y:-10, width:node.w+20, height:node.h+20, rx:18, fill:'url(#sleek-glow)', style:'animation:sleek-pulse 2s ease-in-out infinite' }) : '',
    kb ? g({ filter: kb.noShadow ? undefined : 'url(#sleek-soft)' }, kb.body)
       : g({ filter:'url(#sleek-soft)' }, shapeShell(node, { fill, stroke, strokeWidth:strokeW })),
    kb ? (kb.decor||'') : '',
    nodeImageOrIcon(node),
    kb && kb.label !== undefined ? kb.label : nodeLabel(node, { fill:ink, subFill:muted }),
  );
}

function sleekEdge(edge, active) {
  const kind = edge.kind || 'solid';
  const isDashed=kind==='dashed', isDotted=kind==='dotted', isBold=kind==='bold';
  const isAsync=kind==='async', isBidir=kind==='bidir', isError=kind==='error';
  const isSecure=kind==='secure', isRealtime=kind==='realtime';
  const errC='#c0392b', secC='#3a6b3a';
  const stroke = isError?errC : isSecure?secC : (active?'#f5c518':'#b8b0a1');
  const dash = isDashed?'5 4' : isDotted?'1 5' : isAsync?'8 4 1 4' : isRealtime?'6 3' : undefined;
  const sw = edgeStrokeWidth(edge, isBold?(active?3:2.4):(active?2:1.4));
  const mid = edgeMidpoint(edge.points);
  const arrowE = isError?'url(#sleek-arrow-err)':active?'url(#sleek-arrow-a)':'url(#sleek-arrow)';
  const arrowS = isBidir?(active?'url(#sleek-arrow-a)':'url(#sleek-arrow)'):undefined;
  // Draw-on animation on the main stroke when the edge transitions to
  // active. Only for plain solid edges — patterned dashes conflict with
  // the dasharray-driven animation.
  const drawOn = active && !isDashed && !isDotted && !isAsync && !isRealtime;
  const drawClass = drawOn ? 'fd-draw-on' : undefined;
  const drawStyle = drawOn ? `--fd-edge-len:${Math.round(edge.length || 600)}` : undefined;
  return g(null,
    isBold ? e('path', { d:edge.d, fill:'none', stroke, opacity:.18, strokeWidth:sw+6, strokeLinecap:'round', strokeLinejoin:'round' }) : '',
    isRealtime ? e('path', { d:edge.d, fill:'none', stroke:'#f5c518', opacity:.35, strokeWidth:sw+3, strokeLinecap:'round', strokeLinejoin:'round' }) : '',
    e('path', { d:edge.d, fill:'none', stroke:isRealtime?'#b8860b':stroke, strokeWidth:sw, strokeDasharray:dash, strokeLinecap:isDotted?'round':'butt', markerEnd:arrowE, markerStart:arrowS, strokeLinejoin:'round', class:drawClass, style:drawStyle },
      isRealtime ? `<animate attributeName="stroke-dashoffset" from="0" to="-18" dur=".5s" repeatCount="indefinite"/>` : '',
    ),
    active&&!isRealtime ? `<circle r="3.5" fill="${isError?errC:'#f5c518'}"><animateMotion dur="1.4s" repeatCount="indefinite" path="${edge.d}" rotate="auto"/></circle>` : '',
    isSecure ? g({ transform:`translate(${mid.x} ${mid.y-14})` },
      e('rect', { x:-7, y:-8, width:14, height:13, rx:2.5, fill:'#fffcf3', stroke:secC, strokeWidth:1 }),
      e('rect', { x:-3, y:-3, width:6, height:6, rx:.8, fill:secC }),
      e('path', { d:'M-2 -3 V-5 Q0 -7 2 -5 V-3', fill:'none', stroke:secC, strokeWidth:1 }),
    ) : '',
    isError ? g({ transform:`translate(${mid.x} ${mid.y-12})`, stroke:errC, strokeWidth:1.4, fill:'#fffcf3' },
      e('circle', { r:6 }), e('line', { x1:-3, y1:-3, x2:3, y2:3 }), e('line', { x1:3, y1:-3, x2:-3, y2:3 }),
    ) : '',
    edgeLabel(edge.label, mid.x, mid.y, { bg:'#fffcf3', fg:isError?errC:isSecure?secC:active?'#7a5a00':'#8f8779', mono:true }),
  );
}

// ── SKETCH ─────────────────────────────────────────────────

function sketchDefs() {
  return `<defs>
    <filter id="sk-rough">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/>
      <feDisplacementMap in="SourceGraphic" scale="0.9"/>
    </filter>
    <pattern id="sk-paper" width="160" height="160" patternUnits="userSpaceOnUse">
      <rect width="160" height="160" fill="#fbf7ec"/>
      <circle cx="30" cy="40" r=".6" fill="#c6bfae"/>
      <circle cx="110" cy="90" r=".5" fill="#c6bfae"/>
      <circle cx="60" cy="130" r=".7" fill="#c6bfae"/>
    </pattern>
    <marker id="sk-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0 1 L10 5 L0 9 L3 5 Z" fill="#3a362d"/>
    </marker>
    <marker id="sk-arrow-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M0 1 L10 5 L0 9 L3 5 Z" fill="#d97757"/>
    </marker>
  </defs>`;
}

function sketchBackground(w, h) {
  const lines = Array.from({ length: Math.ceil(h/28) }, (_, i) =>
    e('line', { x1:0, x2:w, y1:i*28+14, y2:i*28+14, stroke:'#ded6c2', strokeWidth:.6, strokeDasharray:'2 3' })
  ).join('');
  return g(null, e('rect', { width:w, height:h, fill:'url(#sk-paper)' }), lines);
}

function sketchNode(node, active) {
  const seed = node.id.charCodeAt(0) + node.id.length;
  const jitter = n => ((seed*(n+1))%7)*0.35-1;
  const ink = active ? '#d97757' : '#2b2a26';
  const fill = active ? '#fce7d6' : '#ffffff';
  const shape = shapeOf(node);
  const hasMedia = !!(node.image || node.icon || (node.kind === 'image' && node.src));
  const centered = ['diamond','circle','oval','pill'].includes(shape);
  return g({ transform:`translate(${node.x} ${node.y})` },
    g({ transform:`translate(${jitter(0)} ${jitter(1)+3})`, opacity:.55 }, shapeShell(node, { fill:'#f0e9d6', stroke:'none', strokeWidth:0 })),
    g({ filter:'url(#sk-rough)' }, shapeShell(node, { fill, stroke:ink, strokeWidth:1.8 })),
    g({ filter:'url(#sk-rough)', opacity:.5 }, shapeShell(node, { fill:'none', stroke:ink, strokeWidth:1 })),
    nodeImageOrIcon(node),
    !hasMedia && !centered ? g({ transform:'translate(12, 10)' }, nodeIcon(node.kind, { color:ink })) : '',
    !hasMedia && centered ? g({ transform:`translate(${node.w/2-7} ${node.h/2-18})` }, nodeIcon(node.kind, { color:ink })) : '',
    nodeLabel(node, { fill:ink, subFill:'#5a5148', fontFamily:'Caveat', fontWeight:600, fontSize:18, hand:true, centerOffsetY:centered?8:0 }),
  );
}

function sketchEdge(edge, active) {
  const kind = edge.kind || 'solid';
  const isBold=kind==='bold', isAsync=kind==='async', isBidir=kind==='bidir';
  const isError=kind==='error', isSecure=kind==='secure', isRealtime=kind==='realtime';
  const isDashed=kind==='dashed', isDotted=kind==='dotted';
  const errC='#c14a3a', secC='#3d6b3d';
  const stroke = isError?errC:isSecure?secC:(active?'#d97757':'#3a362d');
  const dash = isDashed?'6 5':isDotted?'1.5 5':isAsync?'9 4 1.5 4':isRealtime?'7 4':undefined;
  const sw = edgeStrokeWidth(edge, isBold?(active?3:2.6):(active?2.2:1.5));
  const d1 = roughPath(edge.points, 1.6, edge.id.charCodeAt(0)*7);
  const d2 = roughPath(edge.points, 1.2, edge.id.charCodeAt(0)*13+1);
  const mid = edgeMidpoint(edge.points);
  const drawOn = active && !isDashed && !isDotted && !isAsync && !isRealtime;
  const drawClass = drawOn ? 'fd-draw-on' : undefined;
  const drawStyle = drawOn ? `--fd-edge-len:${Math.round(edge.length || 600)}` : undefined;
  return g(null,
    isRealtime ? e('path', { d:d1, fill:'none', stroke:'#d97757', opacity:.25, strokeWidth:sw+3, strokeLinecap:'round', filter:'url(#sk-rough)' }) : '',
    e('path', { d:d1, fill:'none', stroke:isRealtime?'#b85a3a':stroke, strokeWidth:sw, strokeDasharray:dash, strokeLinecap:'round', markerEnd:active?'url(#sk-arrow-a)':'url(#sk-arrow)', markerStart:isBidir?(active?'url(#sk-arrow-a)':'url(#sk-arrow)'):undefined, filter:'url(#sk-rough)', class:drawClass, style:drawStyle },
      isRealtime ? `<animate attributeName="stroke-dashoffset" from="0" to="-22" dur=".55s" repeatCount="indefinite"/>` : '',
    ),
    e('path', { d:d2, fill:'none', stroke, strokeWidth:isBold?1.4:.7, strokeDasharray:dash, opacity:.4, strokeLinecap:'round' }),
    active&&!isRealtime ? `<circle r="4" fill="${isError?errC:'#d97757'}" stroke="#fbf7ec" stroke-width="1.5"><animateMotion dur="1.6s" repeatCount="indefinite" path="${edge.d}" rotate="auto"/></circle>` : '',
    isSecure ? g({ transform:`translate(${mid.x} ${mid.y-14}) rotate(-2)`, fill:'#fbf7ec', stroke:secC, strokeWidth:1.4, filter:'url(#sk-rough)' },
      e('rect', { x:-7, y:-7, width:14, height:13, rx:2 }), e('path', { d:'M-2.5 -7 V-10 Q0 -12 2.5 -10 V-7', fill:'none' }),
    ) : '',
    isError ? g({ transform:`translate(${mid.x} ${mid.y-13}) rotate(-3)`, stroke:errC, strokeWidth:1.6, fill:'#fbf7ec', filter:'url(#sk-rough)' },
      e('circle', { r:7 }), e('line', { x1:-3.5, y1:-3.5, x2:3.5, y2:3.5 }), e('line', { x1:3.5, y1:-3.5, x2:-3.5, y2:3.5 }),
    ) : '',
    edge.label ? g({ transform:`translate(${mid.x} ${mid.y-2}) rotate(-3)` },
      e('rect', { x:-edge.label.length*4.5-4, y:-10, width:edge.label.length*9+8, height:18, rx:3, fill:'#fbf7ec' }),
      text({ textAnchor:'middle', dominantBaseline:'middle', fontFamily:'Caveat', fontSize:15, fill:isError?errC:isSecure?secC:active?'#d97757':'#5a5148' }, edge.label),
    ) : '',
  );
}

// ── ISO ────────────────────────────────────────────────────

function isoDefs() {
  return `<defs>
    <linearGradient id="iso-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef1f6"/></linearGradient>
    <linearGradient id="iso-top-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe28a"/><stop offset="1" stop-color="#f5c518"/></linearGradient>
    <linearGradient id="iso-right" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#dde2ea"/><stop offset="1" stop-color="#c7cfda"/></linearGradient>
    <linearGradient id="iso-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7ebf1"/><stop offset="1" stop-color="#d2d8e1"/></linearGradient>
    <linearGradient id="iso-pipe" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2563eb"/><stop offset="1" stop-color="#60a5fa"/></linearGradient>
    <linearGradient id="iso-pipe-a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#fde68a"/></linearGradient>
    <linearGradient id="iso-pipe-err" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b91c1c"/><stop offset="1" stop-color="#ef4444"/></linearGradient>
    <linearGradient id="iso-pipe-sec" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#15803d"/><stop offset="1" stop-color="#4ade80"/></linearGradient>
    <pattern id="iso-grid" width="24" height="14" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">
      <path d="M0 0 L24 0 M0 0 L0 14" stroke="#dbe0e7" stroke-width=".6"/>
    </pattern>
  </defs>`;
}

function isoBackground(w, h) {
  return g(null,
    e('rect', { width:w, height:h, fill:'#f3f4f6' }),
    e('rect', { width:w, height:h, fill:'url(#iso-grid)', opacity:.9 }),
  );
}

function isoNode(node, active) {
  const depth=12, w=node.w, h=node.h, shape=shapeOf(node);
  const topFill = active ? 'url(#iso-top-a)' : 'url(#iso-top)';
  const hasMedia = !!(node.image || node.icon || (node.kind === 'image' && node.src));
  const centered = ['diamond','circle','oval','pill'].includes(shape);
  return g({ transform:`translate(${node.x} ${node.y})` },
    e('ellipse', { cx:w/2+4, cy:h+depth+6, rx:w*.4, ry:3.5, fill:'#000', opacity:.07 }),
    (shape==='rect'||shape==='square') ? g(null,
      e('path', { d:`M 0 ${h} L ${w} ${h} L ${w} ${h+depth} L 0 ${h+depth} Z`, fill:'url(#iso-front)', stroke:'#c7cfda', strokeWidth:.8 }),
      e('path', { d:`M ${w} 0 L ${w+depth*.6} ${-depth*.5} L ${w+depth*.6} ${h-depth*.5} L ${w} ${h} Z`, fill:'url(#iso-right)', stroke:'#c7cfda', strokeWidth:.8 }),
    ) : '',
    shapeShell(node, { fill:topFill, stroke:active?'#f59e0b':'#cfd6e0', strokeWidth:1 }),
    nodeImageOrIcon(node),
    !hasMedia && !centered ? g({ transform:'translate(10, 8)' }, nodeIcon(node.kind, { color:active?'#7a5a00':'#475569' })) : '',
    !hasMedia && centered ? g({ transform:`translate(${w/2-7} ${h/2-18})` }, nodeIcon(node.kind, { color:active?'#7a5a00':'#475569' })) : '',
    nodeLabel(node, { fill:active?'#3a2a00':'#1e293b', subFill:active?'#7a5a00':'#64748b', fontSize:12.5, centerOffsetY:centered?8:0 }),
  );
}

function isoEdge(edge, active) {
  const kind=edge.kind||'solid';
  const isDashed=kind==='dashed', isDotted=kind==='dotted', isBold=kind==='bold';
  const isAsync=kind==='async', isBidir=kind==='bidir', isError=kind==='error';
  const isSecure=kind==='secure', isRealtime=kind==='realtime';
  const mid=edgeMidpoint(edge.points);
  const stroke=isError?'url(#iso-pipe-err)':isSecure?'url(#iso-pipe-sec)':(active?'url(#iso-pipe-a)':'url(#iso-pipe)');
  const dash=isDashed?'10 6':isDotted?'2 7':isAsync?'12 5 2 5':isRealtime?'8 5':undefined;
  const sw=edgeStrokeWidth(edge, isBold?(active?8:6):(active?6:4));
  const labelFg=isError?'#7a1a1a':isSecure?'#1f4d1f':active?'#7a5a00':'#475569';
  return g(null,
    e('path', { d:edge.d, fill:'none', stroke:'rgba(0,0,0,.08)', strokeWidth:sw+2, transform:'translate(1,2)', strokeLinecap:'round', strokeLinejoin:'round' }),
    isRealtime ? e('path', { d:edge.d, fill:'none', stroke:'#f59e0b', opacity:.35, strokeWidth:sw+4, strokeLinecap:'round', strokeLinejoin:'round' }) : '',
    e('path', { d:edge.d, fill:'none', stroke, strokeWidth:sw, strokeLinecap:'round', strokeLinejoin:'round', strokeDasharray:dash },
      isRealtime ? `<animate attributeName="stroke-dashoffset" from="0" to="-26" dur=".6s" repeatCount="indefinite"/>` : '',
    ),
    active&&!isRealtime ? `<circle r="3" fill="#fff"><animateMotion dur="1.4s" repeatCount="indefinite" path="${edge.d}" rotate="auto"/></circle>` : '',
    isBidir ? `<circle r="3" fill="#fff"><animateMotion dur="1.6s" repeatCount="indefinite" path="${edge.d}" keyPoints="1;0" keyTimes="0;1" rotate="auto"/></circle>` : '',
    isSecure ? g({ transform:`translate(${mid.x} ${mid.y-14})` },
      e('rect', { x:-8, y:-9, width:16, height:14, rx:3, fill:'#fff', stroke:'#1f4d1f', strokeWidth:1.2 }),
      e('rect', { x:-3, y:-3, width:6, height:6, rx:.8, fill:'#1f4d1f' }),
      e('path', { d:'M-2.5 -3 V-6 Q0 -8 2.5 -6 V-3', fill:'none', stroke:'#1f4d1f', strokeWidth:1.2 }),
    ) : '',
    isError ? g({ transform:`translate(${mid.x} ${mid.y-14})`, stroke:'#7a1a1a', strokeWidth:1.5, fill:'#fff' },
      e('circle', { r:7 }), e('line', { x1:-3.5, y1:-3.5, x2:3.5, y2:3.5 }), e('line', { x1:3.5, y1:-3.5, x2:-3.5, y2:3.5 }),
    ) : '',
    edgeLabel(edge.label, mid.x, mid.y, { bg:'#f3f4f6', fg:labelFg, mono:true }),
  );
}

// ── BLUEPRINT ──────────────────────────────────────────────

function blueprintDefs() {
  return `<defs>
    <pattern id="bp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e3a62" stroke-width=".6"/>
    </pattern>
    <pattern id="bp-grid-hi" width="100" height="100" patternUnits="userSpaceOnUse">
      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#2a4d80" stroke-width=".8"/>
    </pattern>
    <marker id="bp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 1 L10 5 L0 9" fill="none" stroke="#80d0e0" stroke-width="1.3"/>
    </marker>
    <marker id="bp-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0 1 L10 5 L0 9" fill="none" stroke="#ffd166" stroke-width="1.5"/>
    </marker>
  </defs>`;
}

function blueprintBackground(w, h) {
  return g(null,
    e('rect', { width:w, height:h, fill:'#0b2545' }),
    e('rect', { width:w, height:h, fill:'url(#bp-grid)' }),
    e('rect', { width:w, height:h, fill:'url(#bp-grid-hi)' }),
  );
}

function blueprintNode(node, active) {
  const stroke = active ? '#ffd166' : '#80d0e0';
  const shape = shapeOf(node);
  const hasMedia = !!(node.image || node.icon || (node.kind === 'image' && node.src));
  const centered = ['diamond','circle','oval','pill'].includes(shape);
  return g({ transform:`translate(${node.x} ${node.y})` },
    shapeShell(node, { fill:'none', stroke, strokeWidth:active?1.6:1, strokeDasharray:node.kind==='external'?'4 3':undefined }),
    nodeImageOrIcon(node),
    !hasMedia && !centered ? g({ transform:'translate(10, 8)' }, nodeIcon(node.kind, { color:stroke, mono:true })) : '',
    !hasMedia && centered ? g({ transform:`translate(${node.w/2-7} ${node.h/2-18})` }, nodeIcon(node.kind, { color:stroke, mono:true })) : '',
    g(null,
      text({ x:node.w/2, y:node.h/2+4+(centered?8:0), textAnchor:'middle', fontFamily:'JetBrains Mono', fontWeight:600, fontSize:11, fill:active?'#ffd166':'#e0fbfc', letterSpacing:'.04em' }, (node.label||'').toUpperCase()),
      node.sub ? text({ x:node.w/2, y:node.h-8, textAnchor:'middle', fontFamily:'JetBrains Mono', fontSize:8.5, fill:'#8bb5d4' }, node.sub) : '',
    ),
  );
}

function blueprintEdge(edge, active) {
  const kind=edge.kind||'solid';
  const isDashed=kind==='dashed', isDotted=kind==='dotted', isBold=kind==='bold';
  const isAsync=kind==='async', isBidir=kind==='bidir', isError=kind==='error';
  const isSecure=kind==='secure', isRealtime=kind==='realtime';
  const errC='#ff6b6b', secC='#7eea9c';
  const stroke=isError?errC:isSecure?secC:(active?'#ffd166':'#80d0e0');
  const dash=isDashed?'4 3':isDotted?'1 4':isAsync?'7 3 1 3':isRealtime?'5 3':undefined;
  const sw=edgeStrokeWidth(edge, isBold?(active?2.2:1.8):(active?1.4:1));
  const mid=edgeMidpoint(edge.points);
  const arrowE=active?'url(#bp-arrow-a)':'url(#bp-arrow)';
  return g(null,
    isRealtime ? e('path', { d:edge.d, fill:'none', stroke:'#ffd166', opacity:.3, strokeWidth:sw+2.5 }) : '',
    e('path', { d:edge.d, fill:'none', stroke:isRealtime?'#ffd166':stroke, strokeWidth:sw, strokeDasharray:dash, strokeLinecap:isDotted?'round':'butt', markerEnd:arrowE, markerStart:isBidir?arrowE:undefined },
      isRealtime ? `<animate attributeName="stroke-dashoffset" from="0" to="-16" dur=".5s" repeatCount="indefinite"/>` : '',
    ),
    active&&!isRealtime ? `<circle r="2.5" fill="${isError?errC:'#ffd166'}"><animateMotion dur="1.5s" repeatCount="indefinite" path="${edge.d}" rotate="auto"/></circle>` : '',
    isSecure ? g({ transform:`translate(${mid.x} ${mid.y-13})`, fill:'#0b2545', stroke:secC, strokeWidth:1 },
      e('rect', { x:-6, y:-7, width:12, height:11, rx:1.5 }), e('path', { d:'M-2 -7 V-9.5 Q0 -11 2 -9.5 V-7', fill:'none' }),
    ) : '',
    isError ? g({ transform:`translate(${mid.x} ${mid.y-12})`, stroke:errC, strokeWidth:1.2, fill:'#0b2545' },
      e('circle', { r:6 }), e('line', { x1:-3, y1:-3, x2:3, y2:3 }), e('line', { x1:3, y1:-3, x2:-3, y2:3 }),
    ) : '',
    edge.label ? g({ transform:`translate(${mid.x} ${mid.y})` },
      e('rect', { x:-edge.label.length*3.3-4, y:-7, width:edge.label.length*6.6+8, height:14, fill:'#0b2545', stroke, strokeWidth:.5 }),
      text({ textAnchor:'middle', dominantBaseline:'middle', fontFamily:'JetBrains Mono', fontSize:9, fill:stroke, letterSpacing:'.05em' }, (edge.label||'').toUpperCase()),
    ) : '',
  );
}

// ── CITY defs ──────────────────────────────────────────────

function cityDefs() {
  return `<defs>
    <radialGradient id="grid-fade" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="white" stop-opacity="1"/>
      <stop offset="100%" stop-color="white" stop-opacity="0"/>
    </radialGradient>
    <mask id="grid-fade-mask">
      <rect x="-2000" y="-2000" width="6000" height="6000" fill="url(#grid-fade)"/>
    </mask>
    <pattern id="clay-iso-grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#EEEEEE" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
    </pattern>
    <filter id="clay-ao" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
      <feOffset in="blur1" dy="16" result="offset1"/>
      <feComponentTransfer in="offset1" result="ao"><feFuncA type="linear" slope=".06"/></feComponentTransfer>
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur2"/>
      <feOffset in="blur2" dy="2" result="offset2"/>
      <feComponentTransfer in="offset2" result="contact"><feFuncA type="linear" slope=".15"/></feComponentTransfer>
      <feMerge><feMergeNode in="ao"/><feMergeNode in="contact"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="clay-ao-sm" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
      <feOffset dy="3"/>
      <feComponentTransfer><feFuncA type="linear" slope=".15"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="clay-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#fdfdfd"/></linearGradient>
    <linearGradient id="clay-right" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f2f2f2"/><stop offset="1" stop-color="#e0e0e0"/></linearGradient>
    <linearGradient id="clay-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0e0e0"/><stop offset="1" stop-color="#cccccc"/></linearGradient>
    <linearGradient id="clay-wall-left" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e4e7"/><stop offset="1" stop-color="#d4d4d8"/></linearGradient>
    <linearGradient id="clay-wall-right" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f4f4f5"/></linearGradient>
    <linearGradient id="clay-pipe-cool" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#005bb5"/><stop offset=".5" stop-color="#4da6ff"/><stop offset="1" stop-color="#007AFF"/></linearGradient>
    <linearGradient id="clay-pipe-warm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cc9300"/><stop offset=".5" stop-color="#ffdb4d"/><stop offset="1" stop-color="#FFB800"/></linearGradient>
    <linearGradient id="clay-packet-warm" x1="1" y1="0.5" x2="0" y2="0.5"><stop offset="0%" stop-color="#FFBB0C" stop-opacity="1"/><stop offset="50%" stop-color="#FFDD86" stop-opacity="0.6"/><stop offset="100%" stop-color="#fef3c7" stop-opacity="0"/></linearGradient>
    <linearGradient id="clay-packet-cool" x1="1" y1="0.5" x2="0" y2="0.5"><stop offset="0%" stop-color="#3b82f6" stop-opacity="1"/><stop offset="50%" stop-color="#93c5fd" stop-opacity="0.6"/><stop offset="100%" stop-color="#dbeafe" stop-opacity="0"/></linearGradient>
    <filter id="clay-packet-glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>`;
}

function cityBackground(w, h) {
  return e('rect', { width:w*2, height:h*2, x:-w/2, y:-h/2, fill:'url(#clay-iso-grid)', mask:'url(#grid-fade-mask)' });
}

function cityNode(node, active) {
  const { w, h, kind } = node;
  const isBoundary = kind === 'boundary';

  if (kind === 'store') {
    const r=Math.min(w,h)/2, cx=r, cy=h/2, Z=56, E=1.225*Z;
    const tan1={x:cx+r/Math.sqrt(2),y:cy+r/Math.sqrt(2)};
    const tan2={x:cx-r/Math.sqrt(2),y:cy-r/Math.sqrt(2)};
    const pSplit={x:cx-r/Math.sqrt(2),y:cy+r/Math.sqrt(2)};
    return g({ transform:`translate(${node.x} ${node.y})` },
      active ? `<circle cx="${cx}" cy="${cy}" r="${r+3}" fill="none" stroke="#007AFF" stroke-width="2" opacity="0.7" vector-effect="non-scaling-stroke"><animate attributeName="opacity" values="0.7;0.15;0.7" dur="2s" repeatCount="indefinite"/></circle>` : '',
      e('ellipse', { cx:cx+8, cy:cy+10, rx:r, ry:r*0.577, fill:'rgba(0,0,0,0.35)', filter:'url(#clay-ao)' }),
      e('path', { d:`M ${tan2.x} ${tan2.y} L ${tan2.x+E} ${tan2.y-E} A ${r} ${r} 0 0 0 ${pSplit.x+E} ${pSplit.y-E} L ${pSplit.x} ${pSplit.y} A ${r} ${r} 0 0 1 ${tan2.x} ${tan2.y} Z`, fill:'url(#clay-wall-left)' }),
      e('path', { d:`M ${pSplit.x} ${pSplit.y} L ${pSplit.x+E} ${pSplit.y-E} A ${r} ${r} 0 0 0 ${tan1.x+E} ${tan1.y-E} L ${tan1.x} ${tan1.y} A ${r} ${r} 0 0 1 ${pSplit.x} ${pSplit.y} Z`, fill:'url(#clay-wall-right)' }),
      [.33,.66].map(f => e('path', { d:`M ${tan2.x+E*f} ${tan2.y-E*f} A ${r} ${r} 0 0 0 ${tan1.x+E*f} ${tan1.y-E*f}`, fill:'none', stroke:'#a1a1aa', strokeWidth:1, strokeDasharray:'2 2', opacity:.55 })).join(''),
      g({ transform:`translate(${E} ${-E})` },
        e('circle', { cx, cy, r, fill:'url(#clay-top)', stroke:'#e4e4e7', strokeWidth:1 }),
        e('circle', { cx, cy, r:r-4, fill:'none', stroke:'rgba(0,0,0,0.06)', strokeWidth:1 }),
        g({ transform:`translate(${cx} ${cy})` },
          g({ transform:'translate(-7 -16)' }, nodeIcon('store', { color:'#475569', mono:true })),
          text({ y:12, textAnchor:'middle', fill:'#334155', fontSize:14, fontWeight:600, fontFamily:'Inter Tight' }, node.label),
          node.sub ? text({ y:26, textAnchor:'middle', fill:'#64748b', fontSize:11, fontFamily:'JetBrains Mono' }, node.sub) : '',
        ),
      ),
    );
  }

  if (kind === 'gateway') {
    const i=Math.min(w*.14,16), Z=42, E=1.225*Z;
    const p=[{x:i,y:0},{x:w-i,y:0},{x:w,y:h/2},{x:w-i,y:h},{x:i,y:h},{x:0,y:h/2}];
    const t=p.map(pt=>({x:pt.x+E,y:pt.y-E}));
    const poly=pts=>pts.map(pt=>`${pt.x},${pt.y}`).join(' ');
    return g({ transform:`translate(${node.x} ${node.y})` },
      `<defs>
        <linearGradient id="gw-wall-1-${node.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cbd5e1"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>
        <linearGradient id="gw-wall-2-${node.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e4e7"/><stop offset="1" stop-color="#d4d4d8"/></linearGradient>
      </defs>`,
      active ? `<path d="M ${poly(p)} Z" fill="none" stroke="#007AFF" stroke-width="3" opacity="0.6" transform="scale(1.05) translate(-2 1)"><animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite"/></path>` : '',
      e('path', { d:`M ${poly(p)} Z`, fill:'rgba(0,0,0,0.35)', filter:'url(#clay-ao)' }),
      e('path', { d:`M ${p[0].x},${p[0].y} L ${p[5].x},${p[5].y} L ${t[5].x},${t[5].y} L ${t[0].x},${t[0].y} Z`, fill:`url(#gw-wall-1-${node.id})` }),
      e('path', { d:`M ${p[5].x},${p[5].y} L ${p[4].x},${p[4].y} L ${t[4].x},${t[4].y} L ${t[5].x},${t[5].y} Z`, fill:`url(#gw-wall-2-${node.id})` }),
      e('path', { d:`M ${p[4].x},${p[4].y} L ${p[3].x},${p[3].y} L ${t[3].x},${t[3].y} L ${t[4].x},${t[4].y} Z`, fill:'url(#clay-wall-right)' }),
      e('path', { d:`M ${poly(t)} Z`, fill:'url(#clay-top)' }),
      g({ transform:`translate(${w/2+E} ${h/2-E})` },
        g({ transform:'translate(-7 -16)' }, nodeIcon('gateway', { color:'#007AFF', mono:true })),
        text({ y:12, textAnchor:'middle', fill:'#334155', fontSize:14, fontWeight:600, fontFamily:'Inter Tight' }, node.label),
        node.sub ? text({ y:26, textAnchor:'middle', fill:'#64748b', fontSize:11, fontFamily:'JetBrains Mono' }, node.sub) : '',
      ),
    );
  }

  const Z=isBoundary?6:(kind==='client'||kind==='actor'?32:42);
  const E=1.225*Z, R=isBoundary?0:16;
  const topFill=isBoundary?'transparent':'url(#clay-top)';
  const icons=node.icons||[node.kind];
  const layout=node.layout||'center';

  return g({ transform:`translate(${node.x} ${node.y})` },
    e('rect', { width:w, height:h, rx:R, fill:isBoundary?'rgba(0,0,0,0.05)':'rgba(0,0,0,0.5)', filter:'url(#clay-ao)' }),
    active&&!isBoundary ? `<rect width="${w}" height="${h}" rx="${R}" fill="none" stroke="#007AFF" stroke-width="3" opacity="0.6" transform="scale(1.06) translate(-2 -2)"><animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite"/></rect>` : '',
    isBoundary ? g(null,
      e('path', { d:`M 0 0 L 0 ${h} L ${E} ${h-E} L ${E} ${-E} Z`, fill:'transparent', stroke:'#cbd5e1', strokeWidth:1, strokeLinejoin:'round' }),
      e('path', { d:`M 0 ${h} L ${w} ${h} L ${w+E} ${h-E} L ${E} ${h-E} Z`, fill:'transparent', stroke:'#cbd5e1', strokeWidth:1, strokeLinejoin:'round' }),
    ) : g(null,
      `<defs><linearGradient id="corner-grad-${node.id}" gradientUnits="userSpaceOnUse" x1="0" y1="${h-R}" x2="${R}" y2="${h}"><stop offset="0" stop-color="#d4d4d8"/><stop offset="1" stop-color="#f4f4f5"/></linearGradient></defs>`,
      e('path', { d:`M 0 ${R} L 0 ${h-R} L ${E} ${h-R-E} L ${E} ${R-E} Z`, fill:'url(#clay-wall-left)' }),
      e('path', { d:`M 0 ${h-R} A ${R} ${R} 0 0 0 ${R} ${h} L ${R+E} ${h-E} A ${R} ${R} 0 0 1 ${E} ${h-R-E} Z`, fill:`url(#corner-grad-${node.id})` }),
      e('path', { d:`M ${R} ${h} L ${w-R} ${h} L ${w-R+E} ${h-E} L ${R+E} ${h-E} Z`, fill:'url(#clay-wall-right)' }),
      e('path', { d:`M ${w-R} ${h} A ${R} ${R} 0 0 0 ${w} ${h-R} L ${w+E} ${h-R-E} A ${R} ${R} 0 0 1 ${w-R+E} ${h-E} Z`, fill:'url(#clay-wall-right)' }),
    ),
    !isBoundary ? g(null,
      g({ transform:`translate(${E*.06} ${h/2-E*.06})` },
        e('rect', { x:-2, y:-10, width:E*.08, height:20, rx:3, fill:'#1e293b', transform:'skewY(-45)' }),
        e('rect', { x:-1, y:-8, width:E*.04, height:16, rx:2, fill:'#007AFF', filter:'url(#clay-ao-sm)', transform:'skewY(-45)' }),
      ),
      g({ transform:`translate(${w/2+2} ${h-2})` },
        e('rect', { x:-10, y:-2, width:20, height:E*.08, rx:3, fill:'#1e293b', transform:'skewX(-45)' }),
        e('rect', { x:-8, y:-1, width:16, height:E*.04, rx:2, fill:'#007AFF', filter:'url(#clay-ao-sm)', transform:'skewX(-45)' }),
      ),
    ) : '',
    e('rect', { x:E, y:-E, width:w, height:h, rx:R, fill:topFill, stroke:isBoundary?'#cbd5e1':'none', strokeWidth:isBoundary?1:0 }),
    !isBoundary ? e('rect', { x:E+3, y:-E+3, width:w-6, height:h-6, rx:Math.max(2,R-3), fill:'transparent', stroke:'rgba(0,0,0,0.06)', strokeWidth:2 }) : '',
    g({ transform:`translate(${E} ${-E})` },
      isBoundary ? text({ x:18, y:28, fill:'#94a3b8', fontSize:18, fontWeight:600, fontFamily:'Inter Tight', letterSpacing:'0.05em' }, (node.label||'').toUpperCase()) :
      layout==='center' ? g({ transform:`translate(${w/2} ${h/2})` },
        g({ transform:'translate(-7 -16)' }, nodeIcon(icons[0], { color:'#475569', mono:true })),
        text({ y:12, textAnchor:'middle', fill:'#334155', fontSize:14, fontWeight:600, fontFamily:'Inter Tight' }, node.label),
        node.sub ? text({ y:26, textAnchor:'middle', fill:'#64748b', fontSize:11, fontFamily:'JetBrains Mono' }, node.sub) : '',
      ) : '',
    ),
  );
}

// City edges are split into TWO passes for correct z-ordering against 3D blocks:
//   cityEdge        → pipes, AO shadow, animated packets (rendered UNDER nodes)
//   cityEdgeOverlay → label chips + secure/error badges (rendered OVER nodes)
// Without this split, foreground blocks occlude edge labels of edges going
// behind them, since iso depth-sort puts edges before nodes.
function cityEdge(edge, active) {
  const kind=edge.kind||'solid';
  const isBold=kind==='bold', isAsync=kind==='async', isBidir=kind==='bidir';
  const isError=kind==='error', isRealtime=kind==='realtime';
  const isDashed=kind==='dashed', isDotted=kind==='dotted', isSecure=kind==='secure';
  const warm=active||kind==='warm'||isError||isRealtime;
  const errP='#dc2626', secP='#16a34a';
  const pipeFill=isError?errP:isSecure?secP:(warm?'url(#clay-pipe-warm)':'url(#clay-pipe-cool)');
  const dash=isDashed?'16 10':isDotted?'2 9':isAsync?'14 5 2 5':isRealtime?'10 6':undefined;
  const coreSw=edgeStrokeWidth(edge, isBold?8:6);
  const outerSw=edgeStrokeWidth(edge, isBold?11:8);
  return g(null,
    e('path', { d:edge.d, fill:'none', stroke:'rgba(0,0,0,.15)', strokeWidth:14, strokeLinecap:'round', strokeLinejoin:'round', filter:'url(#clay-ao-sm)' }),
    e('path', { d:edge.d, fill:'none', stroke:isError?'#7f1d1d':isSecure?'#14532d':'#64748b', strokeWidth:outerSw, strokeLinecap:'round', strokeLinejoin:'round' }),
    e('path', { d:edge.d, fill:'none', stroke:pipeFill, strokeWidth:coreSw, strokeLinecap:'round', strokeLinejoin:'round', strokeDasharray:dash },
      isRealtime ? `<animate attributeName="stroke-dashoffset" from="0" to="-32" dur=".7s" repeatCount="indefinite"/>` : '',
    ),
    e('path', { d:edge.d, fill:'none', stroke:'rgba(255,255,255,0.4)', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round', transform:'translate(-1, -1)' }),
    active&&!isRealtime ? [0,1,2,3].map(i =>
      `<g><animateMotion dur="1.8s" repeatCount="indefinite" path="${edge.d}" begin="${i*-0.45}s" rotate="auto"/><path d="M -24 0 L -6 -3.5 L 6 0 L -6 3.5 Z" fill="${isError?errP:warm?'url(#clay-packet-warm)':'url(#clay-packet-cool)'}" filter="url(#clay-packet-glow)"/><circle r="1.5" fill="white"/></g>`
    ).join('') : '',
    isBidir ? `<g><animateMotion dur="2s" repeatCount="indefinite" path="${edge.d}" keyPoints="1;0" keyTimes="0;1" rotate="auto"/><circle r="3.5" fill="#fff" filter="url(#clay-packet-glow)"/></g>` : '',
  );
}

// City overlay is rendered in SCREEN SPACE (outside the iso projection).
// This guarantees labels and badges:
//   - never get occluded by foreground 3D blocks
//   - stay axis-aligned and easy to read
//   - act like floating tooltips tethered to the projected edge midpoint
// The `project` helper converts canvas (x, y) → screen (x, y).
function cityEdgeOverlay(edge, active, helpers) {
  const kind=edge.kind||'solid';
  const isError=kind==='error', isSecure=kind==='secure', isRealtime=kind==='realtime';
  const warm=active||kind==='warm'||isError||isRealtime;
  if (!edge.label && !isSecure && !isError) return '';
  const midC=edgeMidpoint(edge.points);
  const project=helpers && helpers.project ? helpers.project : (x,y)=>({x,y});
  const mid=project(midC.x, midC.y);
  // Float label well above the projected midpoint so it clears any
  // building tops in iso projection. No tether — proximity alone tells
  // the user which edge it describes, and a tether often visually
  // attaches to whatever building the projected midpoint lands inside.
  const yLift=34;
  return g(null,
    isSecure ? g({ transform:`translate(${mid.x} ${mid.y-yLift})`, fill:'#fff', stroke:'#16a34a', strokeWidth:1.5, filter:'url(#clay-ao-sm)' },
      e('rect', { x:-9, y:-10, width:18, height:16, rx:3 }),
      e('path', { d:'M-3 -10 V-13.5 Q0 -16 3 -13.5 V-10', fill:'none' }),
      e('rect', { x:-3.5, y:-5, width:7, height:7, rx:1, fill:'#16a34a' }),
    ) : '',
    isError ? g({ transform:`translate(${mid.x} ${mid.y-yLift})`, fill:'#fff', stroke:'#dc2626', strokeWidth:2, filter:'url(#clay-ao-sm)' },
      e('circle', { r:9 }), e('line', { x1:-4.5, y1:-4.5, x2:4.5, y2:4.5 }), e('line', { x1:4.5, y1:-4.5, x2:-4.5, y2:4.5 }),
    ) : '',
    edge.label ? g({ transform:`translate(${mid.x} ${mid.y-yLift})` },
      e('rect', { x:-edge.label.length*3.6-8, y:-10, width:edge.label.length*7.2+16, height:20, rx:4, fill:'#ffffff', stroke:'#e2e8f0', strokeWidth:1.2, filter:'url(#clay-ao-sm)' }),
      text({ textAnchor:'middle', dominantBaseline:'middle', fontFamily:'JetBrains Mono', fontSize:10.5, fontWeight:600, fill:warm?'#b45309':'#1d4ed8' }, edge.label),
    ) : '',
  );
}

// ═══════════════════════════════════════════════════════════
// STYLE REGISTRY
// ═══════════════════════════════════════════════════════════

const SVG_STYLES = {
  sleek: {
    tokens: { bg:'#fffcf3', ink:'#26231d', muted:'#8f8779', accent:'#f5c518', line:'#e4decd' },
    defs: sleekDefs, background: sleekBackground, node: sleekNode, edge: sleekEdge,
  },
  sketch: {
    tokens: { bg:'#fbf7ec', ink:'#2b2a26', muted:'#5a5148', accent:'#d97757', line:'#3a362d' },
    defs: sketchDefs, background: sketchBackground, node: sketchNode, edge: sketchEdge,
  },
  iso: {
    tokens: { bg:'#f3f4f6', ink:'#1e293b', muted:'#64748b', accent:'#f5c518', line:'#cbd5e1' },
    defs: isoDefs, background: isoBackground, node: isoNode, edge: isoEdge,
  },
  blueprint: {
    tokens: { bg:'#0b2545', ink:'#e0fbfc', muted:'#8bb5d4', accent:'#ffd166', line:'#3b82a0' },
    defs: blueprintDefs, background: blueprintBackground, node: blueprintNode, edge: blueprintEdge,
  },
  city: {
    tokens: { bg:'#F9FAFB', ink:'#0f172a', muted:'#64748b', accent:'#007AFF', line:'#D1D5DB' },
    isometric: true,
    defs: cityDefs, background: cityBackground, node: cityNode,
    edge: cityEdge, edgeOverlay: cityEdgeOverlay,
  },
};

// ── Main render function ───────────────────────────────────

// Isometric projection used by City: scale(1, 0.577) rotate(-45)
// Equivalent linear map applied to (x,y) input coordinates.
//   X' = (cos(-45)) * x        + (-sin(-45)) * y       = 0.7071 x + 0.7071 y
//   Y' = (sin(-45) * 0.577) x  + (cos(-45)  * 0.577) y = -0.4081 x + 0.4081 y
function isoProject(x, y) {
  const c = Math.SQRT1_2;        // cos(45°) = 0.7071
  const s = Math.SQRT1_2 * 0.577; // sin(45°) * 0.577 ≈ 0.4081
  return { x: c * x + c * y, y: -s * x + s * y };
}

export function renderSVG(graphInput, opts = {}) {
  // Type dispatch — if the graph declares a non-flow type and a plugin
  // is registered for it, delegate to the plugin's renderer. Flow type
  // (or no type) falls through to the built-in flow renderer below.
  const declaredType = graphInput && typeof graphInput === 'object' && graphInput.type;
  if (declaredType && declaredType !== 'flow') {
    const plugin = getType(declaredType);
    if (plugin && typeof plugin.renderSVG === 'function') {
      return plugin.renderSVG(graphInput, opts);
    }
  }
  return renderFlowSVG(graphInput, opts);
}

function renderFlowSVG(graphInput, {
  styleName,
  activeNodes = [],
  activeEdges = [],
  padding = 28,
  width,
  height,
} = {}) {
  const G = resolveGraph(graphInput);
  // Style precedence: explicit option > graph.style directive > sleek default.
  const resolvedStyleName = styleName || G.style || 'sleek';
  const style = SVG_STYLES[resolvedStyleName] || SVG_STYLES.sleek;
  const isIso = !!style.isometric;

  // Sort nodes by iso depth so back blocks render first (painter's algorithm).
  // Depth heuristic: (y + h/2) - (x + w/2). Smaller = farther = drawn first.
  const orderedNodes = isIso
    ? [...G.nodes].sort((a, b) =>
        ((a.y + a.h / 2) - (a.x + a.w / 2)) - ((b.y + b.h / 2) - (b.x + b.w / 2)))
    : G.nodes;

  // Compute bounds. For iso styles, project all 8 corners of each node's
  // extruded cube (top + bottom face) so the viewBox includes the lifted
  // top face after the global rotate/scale transform.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const accept = (x, y) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };

  if (!isIso) {
    G.nodes.forEach(n => {
      accept(n.x, n.y);
      accept(n.x + n.w, n.y + n.h);
    });
    G.edges.forEach(e => e.points.forEach(p => accept(p.x, p.y)));
  } else {
    // Approximate extrusion height used by city kindBodies (see Z constants).
    const extrudeFor = (n) => {
      if (n.kind === 'boundary') return 6;
      if (n.kind === 'client' || n.kind === 'actor') return 32;
      if (n.kind === 'store') return 56;
      return 42;
    };
    G.nodes.forEach(n => {
      const E = 1.225 * extrudeFor(n);
      const corners = [
        // bottom face (z = 0)
        [n.x,       n.y      ],
        [n.x + n.w, n.y      ],
        [n.x,       n.y + n.h],
        [n.x + n.w, n.y + n.h],
        // top face (lifted by E in screen space)
        [n.x + E,       n.y - E      ],
        [n.x + n.w + E, n.y - E      ],
        [n.x + E,       n.y + n.h - E],
        [n.x + n.w + E, n.y + n.h - E],
      ];
      for (const [cx, cy] of corners) {
        const p = isoProject(cx, cy);
        accept(p.x, p.y);
      }
    });
    G.edges.forEach(e => e.points.forEach(pt => {
      const p = isoProject(pt.x, pt.y);
      accept(p.x, p.y);
    }));
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }

  const padX = padding + (isIso ? 30 : 10);
  const padY = padding + (isIso ? 40 : 15);
  const vbX = minX - padX;
  const vbY = minY - padY;
  const vbW = (maxX - minX) + padX * 2;
  const vbH = (maxY - minY) + padY * 2 + (isIso ? 10 : 25);

  const svgW = width  || '100%';
  const svgH = height || '100%';

  const edgesHTML = G.edges.map(ed => wrapEdge(ed, style.edge(ed, activeEdges.includes(ed.id)))).join('');
  const nodesHTML = orderedNodes.map(nd => wrapNode(nd, style.node(nd, activeNodes.includes(nd.id)))).join('');

  // Optional second-pass edge layer rendered in SCREEN SPACE (outside the
  // iso projection). Used by iso styles to float labels/badges above the
  // 3D scene like tooltips, immune to building occlusion. Overlay functions
  // receive a `project` helper to convert canvas coords → screen coords.
  const project = isIso ? isoProject : (x, y) => ({ x, y });
  const edgeOverlayHTML = style.edgeOverlay
    ? G.edges
        .map(ed => style.edgeOverlay(ed, activeEdges.includes(ed.id), { project, isIso }))
        .join('')
    : '';

  // For isometric styles, wrap background+edges+nodes in the global iso
  // transform so the entire scene is projected together.
  const sceneOpen  = isIso ? '<g transform="scale(1, 0.577) rotate(-45)">' : '';
  const sceneClose = isIso ? '</g>' : '';

  // Background rect must cover the full viewBox area so patterns/grids
  // fill the visible space correctly. For iso, the background lives inside
  // the projection transform so we use canvas-space coordinates.
  const bgInner = isIso
    ? style.background(G.canvas.w, G.canvas.h)
    : `<g transform="translate(${vbX} ${vbY})">${style.background(vbW, vbH)}</g>`;

  const a11yTitle = G.title ? `<title>${esc(G.title)}</title>` : '';

  // Inline stylesheet — travels with the SVG so the draw-on animation
  // and the reduced-motion guard work regardless of whether the host
  // page loaded viewport.js's stylesheet.
  const inlineStyle = `<style>
    @keyframes fd-edge-draw {
      from { stroke-dashoffset: var(--fd-edge-len, 600); }
      to   { stroke-dashoffset: 0; }
    }
    .fd-draw-on {
      stroke-dasharray: var(--fd-edge-len, 600);
      animation: fd-edge-draw .55s ease-out both;
    }
    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; transition: none !important; }
    }
  </style>`;

  return `<svg xmlns="http://www.w3.org/2000/svg"
    width="${svgW}" height="${svgH}"
    viewBox="${vbX} ${vbY} ${vbW} ${vbH}"
    preserveAspectRatio="xMidYMid meet"
    role="img" aria-roledescription="diagram"
    style="display:block;background:${style.tokens.bg}">
    ${a11yTitle}
    ${inlineStyle}
    ${style.defs()}
    ${sceneOpen}${bgInner}${edgesHTML}${nodesHTML}${sceneClose}
    ${edgeOverlayHTML}
  </svg>`;
}

export { SVG_STYLES };
export default renderSVG;
