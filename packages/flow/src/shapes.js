// -----------------------------------------------------------
// Shape library — SVG path generators. Pure JS, no React dep.
// Each returns { d, cx, cy, rx?, circle?, ellipse?, top?, body? }
//
// The optional `node` argument is forwarded for shapes that need
// to read a node-level attribute (currently only `custom-path`,
// which reads `node.d`).
// -----------------------------------------------------------

export function shapePath(shape, w, h, node) {
  switch (shape) {
    case 'rect':
      return { d: `M0 0 H${w} V${h} H0 Z`, cx: w/2, cy: h/2, rx: 10 };
    case 'square': {
      const s = Math.min(w, h);
      const ox = (w - s) / 2, oy = (h - s) / 2;
      return { d: `M${ox} ${oy} h${s} v${s} h${-s} z`, cx: w/2, cy: h/2, rx: 4 };
    }
    case 'circle': {
      const r = Math.min(w, h) / 2;
      return {
        d: `M${w/2 - r} ${h/2} a${r} ${r} 0 1 0 ${r*2} 0 a${r} ${r} 0 1 0 ${-r*2} 0`,
        cx: w/2, cy: h/2, circle: { cx: w/2, cy: h/2, r },
      };
    }
    case 'oval':
      return {
        d: `M0 ${h/2} a${w/2} ${h/2} 0 1 0 ${w} 0 a${w/2} ${h/2} 0 1 0 ${-w} 0`,
        cx: w/2, cy: h/2, ellipse: { cx: w/2, cy: h/2, rx: w/2, ry: h/2 },
      };
    case 'diamond':
      return { d: `M${w/2} 0 L${w} ${h/2} L${w/2} ${h} L0 ${h/2} Z`, cx: w/2, cy: h/2 };
    case 'hex': {
      const i = Math.min(w * 0.18, 18);
      return { d: `M${i} 0 L${w-i} 0 L${w} ${h/2} L${w-i} ${h} L${i} ${h} L0 ${h/2} Z`, cx: w/2, cy: h/2 };
    }
    case 'pill': {
      const r = h / 2;
      return { d: `M${r} 0 H${w-r} A${r} ${r} 0 0 1 ${w-r} ${h} H${r} A${r} ${r} 0 0 1 ${r} 0 Z`, cx: w/2, cy: h/2, rx: r };
    }
    case 'cylinder': {
      const ry = 7;
      return {
        d: `M0 ${ry} a${w/2} ${ry} 0 1 0 ${w} 0 a${w/2} ${ry} 0 1 0 ${-w} 0 M0 ${ry} V${h-ry} a${w/2} ${ry} 0 0 0 ${w} 0 V${ry}`,
        top:  `M0 ${ry} a${w/2} ${ry} 0 1 0 ${w} 0 a${w/2} ${ry} 0 1 0 ${-w} 0`,
        body: `M0 ${ry} V${h-ry} a${w/2} ${ry} 0 0 0 ${w} 0 V${ry}`,
        cx: w/2, cy: h/2 + ry/2,
      };
    }
    case 'cloud':
      return {
        d: `M${w*0.18} ${h*0.55} C ${w*0.02} ${h*0.55}, ${w*0.02} ${h*0.15}, ${w*0.22} ${h*0.22} C ${w*0.28} ${h*0.02}, ${w*0.6} ${h*0.02}, ${w*0.62} ${h*0.22} C ${w*0.82} ${h*0.15}, ${w*0.98} ${h*0.3}, ${w*0.9} ${h*0.55} C ${w*0.98} ${h*0.75}, ${w*0.78} ${h*0.95}, ${w*0.6} ${h*0.85} C ${w*0.4} ${h*1.02}, ${w*0.1} ${h*0.95}, ${w*0.18} ${h*0.55} Z`,
        cx: w/2, cy: h/2,
      };
    case 'parallelogram': {
      const skew = 14;
      return { d: `M${skew} 0 H${w} L${w-skew} ${h} H0 Z`, cx: w/2, cy: h/2 };
    }
    case 'shield': {
      const r = Math.min(w * 0.18, 14);
      return {
        d: `M${r} 0 H${w-r} Q${w} 0 ${w} ${r} V${h*0.55} Q${w} ${h*0.85} ${w/2} ${h} Q0 ${h*0.85} 0 ${h*0.55} V${r} Q0 0 ${r} 0 Z`,
        cx: w/2, cy: h/2,
      };
    }
    case 'tablet': {
      const r = Math.min(w, h) * 0.18;
      return {
        d: `M${r} 0 H${w-r} Q${w} 0 ${w} ${r} V${h-r} Q${w} ${h} ${w-r} ${h} H${r} Q0 ${h} 0 ${h-r} V${r} Q0 0 ${r} 0 Z`,
        cx: w/2, cy: h/2, rx: r,
      };
    }
    case 'trapezoid': {
      const i = Math.min(w * 0.16, 18);
      return { d: `M${i} 0 H${w-i} L${w} ${h} H0 Z`, cx: w/2, cy: h/2 };
    }
    case 'chevron': {
      const a = Math.min(w * 0.12, 14);
      return { d: `M0 0 H${w-a} L${w} ${h/2} L${w-a} ${h} H0 L${a} ${h/2} Z`, cx: w/2, cy: h/2 };
    }
    case 'document': {
      // Rectangle with a curled bottom-right corner.
      const fold = Math.min(w * 0.18, 22);
      return {
        d: `M0 0 H${w-fold} L${w} ${fold} V${h} H0 Z`,
        // Fold flap decor (rendered separately by styles that care).
        decor: `M${w-fold} 0 V${fold} H${w}`,
        cx: w/2, cy: h/2, rx: 4,
      };
    }
    case 'folder': {
      // Tab on top-left, body below.
      const tab = Math.min(w * 0.34, 70);
      const tabH = Math.min(h * 0.18, 14);
      return {
        d: `M0 ${tabH} H${tab*0.8} L${tab} 0 H${w-6} Q${w} 0 ${w} 6 V${h-6} Q${w} ${h} ${w-6} ${h} H6 Q0 ${h} 0 ${h-6} Z`,
        cx: w/2, cy: h/2 + tabH/2, rx: 6,
      };
    }
    case 'sticky-note':
    case 'note': {
      // Rectangle with a folded triangle in the bottom-right corner.
      const fold = Math.min(w * 0.16, 18);
      return {
        d: `M0 0 H${w} V${h-fold} L${w-fold} ${h} H0 Z`,
        decor: `M${w} ${h-fold} L${w-fold} ${h-fold} L${w-fold} ${h}`,
        cx: w/2, cy: h/2 - fold/4, rx: 2,
      };
    }
    case 'person': {
      // Stick figure: head circle + body rounded rect. Used for `actor`
      // when the style opts in.
      const headR = Math.min(w, h) * 0.18;
      const headCx = w / 2;
      const headCy = headR + 2;
      const bodyTop = headCy + headR + 4;
      const bodyW = Math.min(w * 0.7, 80);
      const bodyX = (w - bodyW) / 2;
      const bodyR = bodyW * 0.5;
      return {
        d: `M${headCx} ${headCy - headR} a${headR} ${headR} 0 1 0 0 ${headR*2} a${headR} ${headR} 0 1 0 0 ${-headR*2} ` +
           `M${bodyX} ${h} V${bodyTop + bodyR} Q${bodyX} ${bodyTop} ${bodyX + bodyR} ${bodyTop} H${bodyX + bodyW - bodyR} Q${bodyX + bodyW} ${bodyTop} ${bodyX + bodyW} ${bodyTop + bodyR} V${h} Z`,
        // Expose pieces so styles can render head + body separately if desired.
        head:  { cx: headCx, cy: headCy, r: headR },
        body:  `M${bodyX} ${h} V${bodyTop + bodyR} Q${bodyX} ${bodyTop} ${bodyX + bodyR} ${bodyTop} H${bodyX + bodyW - bodyR} Q${bodyX + bodyW} ${bodyTop} ${bodyX + bodyW} ${bodyTop + bodyR} V${h} Z`,
        cx: w/2, cy: h/2, noShadow: true,
      };
    }
    case 'custom-path':
    case 'path': {
      // User-supplied path data via node.d. Falls back to a rect if absent.
      const d = (node && typeof node.d === 'string' && node.d.trim()) ? node.d
                                                                      : `M0 0 H${w} V${h} H0 Z`;
      return { d, cx: w/2, cy: h/2, rx: 6 };
    }
    default:
      return { d: `M0 0 H${w} V${h} H0 Z`, cx: w/2, cy: h/2, rx: 10 };
  }
}

export function shapeAnchor(node, side) {
  const { w, h } = node;
  const cx = node.x + w/2, cy = node.y + h/2;
  switch (side) {
    case 'l': return { x: node.x,     y: cy };
    case 'r': return { x: node.x + w, y: cy };
    case 't': return { x: cx,         y: node.y };
    case 'b': return { x: cx,         y: node.y + h };
    default:  return { x: cx,         y: cy };
  }
}
