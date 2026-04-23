// -----------------------------------------------------------
// Shape library — SVG path generators. Styles call these.
// Each returns { path, cx, cy } where (cx,cy) is the label anchor.
// -----------------------------------------------------------

function shapePath(shape, w, h) {
  switch (shape) {
    case "rect":   return { d: `M0 0 H${w} V${h} H0 Z`, cx: w/2, cy: h/2, rx: 10 };
    case "square": {
      const s = Math.min(w, h);
      const ox = (w - s) / 2, oy = (h - s) / 2;
      return { d: `M${ox} ${oy} h${s} v${s} h${-s} z`, cx: w/2, cy: h/2, rx: 4 };
    }
    case "circle": {
      const r = Math.min(w, h) / 2;
      return { d: `M${w/2 - r} ${h/2} a${r} ${r} 0 1 0 ${r*2} 0 a${r} ${r} 0 1 0 ${-r*2} 0`, cx: w/2, cy: h/2, circle: { cx: w/2, cy: h/2, r } };
    }
    case "oval":   return { d: `M0 ${h/2} a${w/2} ${h/2} 0 1 0 ${w} 0 a${w/2} ${h/2} 0 1 0 ${-w} 0`, cx: w/2, cy: h/2, ellipse: { cx: w/2, cy: h/2, rx: w/2, ry: h/2 } };
    case "diamond":return { d: `M${w/2} 0 L${w} ${h/2} L${w/2} ${h} L0 ${h/2} Z`, cx: w/2, cy: h/2 };
    case "hex": {
      const i = Math.min(w * 0.18, 18);
      return { d: `M${i} 0 L${w-i} 0 L${w} ${h/2} L${w-i} ${h} L${i} ${h} L0 ${h/2} Z`, cx: w/2, cy: h/2 };
    }
    case "pill": {
      const r = h / 2;
      return { d: `M${r} 0 H${w-r} A${r} ${r} 0 0 1 ${w-r} ${h} H${r} A${r} ${r} 0 0 1 ${r} 0 Z`, cx: w/2, cy: h/2, rx: r };
    }
    case "cylinder": {
      const ry = 7;
      return {
        d: `M0 ${ry} a${w/2} ${ry} 0 1 0 ${w} 0 a${w/2} ${ry} 0 1 0 ${-w} 0 M0 ${ry} V${h-ry} a${w/2} ${ry} 0 0 0 ${w} 0 V${ry}`,
        top: `M0 ${ry} a${w/2} ${ry} 0 1 0 ${w} 0 a${w/2} ${ry} 0 1 0 ${-w} 0`,
        body: `M0 ${ry} V${h-ry} a${w/2} ${ry} 0 0 0 ${w} 0 V${ry}`,
        cx: w/2, cy: h/2 + ry/2,
      };
    }
    case "cloud": {
      return { d: `M${w*0.18} ${h*0.55} C ${w*0.02} ${h*0.55}, ${w*0.02} ${h*0.15}, ${w*0.22} ${h*0.22} C ${w*0.28} ${h*0.02}, ${w*0.6} ${h*0.02}, ${w*0.62} ${h*0.22} C ${w*0.82} ${h*0.15}, ${w*0.98} ${h*0.3}, ${w*0.9} ${h*0.55} C ${w*0.98} ${h*0.75}, ${w*0.78} ${h*0.95}, ${w*0.6} ${h*0.85} C ${w*0.4} ${h*1.02}, ${w*0.1} ${h*0.95}, ${w*0.18} ${h*0.55} Z`, cx: w/2, cy: h/2 };
    }
    case "parallelogram": {
      const skew = 14;
      return { d: `M${skew} 0 H${w} L${w-skew} ${h} H0 Z`, cx: w/2, cy: h/2 };
    }
    default:
      return { d: `M0 0 H${w} V${h} H0 Z`, cx: w/2, cy: h/2, rx: 10 };
  }
}

// Anchor a point on the OUTSIDE of a non-rect shape, for edge routing
function shapeAnchor(node, side) {
  const { w, h } = node;
  const cx = node.x + w/2, cy = node.y + h/2;
  switch (side) {
    case "l": return { x: node.x,         y: cy };
    case "r": return { x: node.x + w,     y: cy };
    case "t": return { x: cx,             y: node.y };
    case "b": return { x: cx,             y: node.y + h };
  }
}

window.Flow = Object.assign(window.Flow || {}, { shapePath, shapeAnchor });
