// -----------------------------------------------------------
// Style renderers. Each implements: Defs, Background, Node, Edge, tokens.
// Nodes respect their `shape` (from graph.jsx shapeOf()).
// -----------------------------------------------------------

const { resolveGraph, pathFromPoints, roughPath, shapePath, shapeOf } = window.Flow;

function edgeMidpoint(pts) {
  if (pts.length >= 3) {
    const a = pts[Math.floor(pts.length / 2) - 1];
    const b = pts[Math.floor(pts.length / 2)];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
}

function EdgeLabel({ text, x, y, bg = "#faf7ef", fg = "#6b6459", mono = false }) {
  if (!text) return null;
  return (
    <g transform={`translate(${x} ${y - 12})`}>
      {/* Halo for readability without blocking the line animation completely */}
      <text textAnchor="middle" dominantBaseline="middle"
        fontFamily={mono ? "JetBrains Mono" : "Inter Tight"}
        fontSize="11" fill={bg} stroke={bg} strokeWidth="3.5" strokeLinejoin="round">{text}</text>
      <text textAnchor="middle" dominantBaseline="middle"
        fontFamily={mono ? "JetBrains Mono" : "Inter Tight"}
        fontSize="11" fill={fg} fontWeight="600">{text}</text>
    </g>
  );
}

// ---------- Shape-aware node shell used by most styles ----------
// Renders the outline using shapePath, handles rect rounded corners,
// cylinder top disc, etc. Label + sub go on top via children prop.
function ShapeShell({ node, fill, stroke, strokeWidth, strokeDasharray, shadowOpacity = 0.1 }) {
  const shape = shapeOf(node);
  const s = shapePath(shape, node.w, node.h);
  // Rect variants get rounded corners via <rect rx>, everything else uses <path>
  if (shape === "rect" || shape === "square") {
    const r = s.rx ?? 10;
    if (shape === "square") {
      const sz = Math.min(node.w, node.h), ox = (node.w - sz) / 2, oy = (node.h - sz) / 2;
      return <rect x={ox} y={oy} width={sz} height={sz} rx={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray}/>;
    }
    return <rect width={node.w} height={node.h} rx={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray}/>;
  }
  if (shape === "pill") {
    return <rect width={node.w} height={node.h} rx={node.h/2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray}/>;
  }
  if (shape === "circle" && s.circle) {
    return <circle cx={s.circle.cx} cy={s.circle.cy} r={s.circle.r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray}/>;
  }
  if (shape === "oval" && s.ellipse) {
    return <ellipse cx={s.ellipse.cx} cy={s.ellipse.cy} rx={s.ellipse.rx} ry={s.ellipse.ry} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray}/>;
  }
  if (shape === "cylinder") {
    return <g>
      <path d={s.body} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
      <path d={s.top}  fill={`color-mix(in oklch, ${fill} 92%, black)`} stroke={stroke} strokeWidth={strokeWidth}/>
    </g>;
  }
  return <path d={s.d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray}/>;
}

function NodeLabel({ node, fill, sub, subFill, fontFamily = "Inter Tight", fontWeight = 600, fontSize = 13, hand = false, mono = false, iconTop = 10, center = false }) {
  const shape = shapeOf(node);
  // decision / diamond / circle: center label, no icon row
  if (center || ["diamond","circle","oval","pill"].includes(shape)) {
    return (
      <g>
        <text x={node.w/2} y={node.h/2 + (sub ? -3 : 4)} textAnchor="middle" dominantBaseline="middle"
          fontFamily={fontFamily} fontWeight={fontWeight} fontSize={fontSize} fill={fill}>
          {node.label}
        </text>
        {sub && (
          <text x={node.w/2} y={node.h/2 + 12} textAnchor="middle" dominantBaseline="middle"
            fontFamily="JetBrains Mono" fontSize="9.5" fill={subFill}>{sub}</text>
        )}
      </g>
    );
  }
  return (
    <g>
      <text x={node.w/2} y={node.h/2 + 4} textAnchor="middle"
        fontFamily={fontFamily} fontWeight={fontWeight} fontSize={hand ? 20 : fontSize} fill={fill}>
        {node.label}
      </text>
      {sub && (
        <text x={node.w/2} y={node.h - 12} textAnchor="middle"
          fontFamily={hand ? "Caveat" : "JetBrains Mono"} fontSize={hand ? 13 : 9.5} fill={subFill}>
          {sub}
        </text>
      )}
    </g>
  );
}

// -----------------------------------------------------------
// sleekKindBody — per-kind premium silhouettes for the Sleek style.
// Returns { body, decor, label?, noShadow? } — body goes under the
// soft-shadow filter; decor stays crisp on top.
// Designed so every kind reads as a distinct "thing" at a glance,
// without relying on a tiny corner icon.
// -----------------------------------------------------------
function sleekKindBody(node, t) {
  const { fill, stroke, strokeW, ink, muted, accent, active } = t;
  const { w, h } = node;
  const headerH = 22;
  const subtleBand = active ? "#fef3c7" : "#f3ecd8";
  const K = node.kind;

  const card = (r = 12) => (
    <rect width={w} height={h} rx={r} fill={fill} stroke={stroke} strokeWidth={strokeW}/>
  );
  const centerLabel = (yOffset = 0) => (
    <g>
      <text x={w/2} y={h/2 + 4 + yOffset} textAnchor="middle"
        fontFamily="Inter Tight" fontWeight={600} fontSize={13} fill={ink}>{node.label}</text>
      {node.sub && (
        <text x={w/2} y={h/2 + 18 + yOffset} textAnchor="middle"
          fontFamily="JetBrains Mono" fontSize={9.5} fill={muted}>{node.sub}</text>
      )}
    </g>
  );
  const headerLabel = (badge) => (
    <g>
      <text x={12} y={14.5} fontFamily="JetBrains Mono" fontSize={9} letterSpacing=".08em"
        fill={active ? "#7a5a00" : muted}>{badge}</text>
      <text x={w/2} y={headerH + (h - headerH)/2 + 2.5} textAnchor="middle"
        fontFamily="Inter Tight" fontWeight={600} fontSize={14} fill={ink}>{node.label}</text>
      {node.sub && (
        <text x={w/2} y={headerH + (h - headerH)/2 + 16} textAnchor="middle"
          fontFamily="JetBrains Mono" fontSize={9.5} fill={muted}>{node.sub}</text>
      )}
    </g>
  );

  switch (K) {
    case "service": {
      return {
        body: (
          <g>
            {card(12)}
            <path d={`M0 ${headerH} H${w}`} stroke={stroke} strokeWidth={strokeW} opacity=".7"/>
            <rect x={1} y={1} width={w-2} height={headerH-1} rx={11} fill={subtleBand} opacity=".55"
              style={{ clipPath: "inset(0 0 50% 0)" }}/>
          </g>
        ),
        decor: (
          <g>
            <circle cx={10} cy={11} r="2.2" fill={active ? accent : "#c9bf9e"}/>
            <circle cx={17} cy={11} r="2.2" fill="#e4decd"/>
            <circle cx={24} cy={11} r="2.2" fill="#e4decd"/>
          </g>
        ),
        label: headerLabel("SERVICE"),
      };
    }
    case "process": {
      const notch = 10;
      const d = `M12 0 H${w-12} Q${w} 0 ${w} 12 V${h-notch} L${w-notch} ${h} H${notch} L0 ${h-notch} V12 Q0 0 12 0 Z`;
      return {
        body: (
          <g>
            <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeW}/>
            <rect x={0} y={0} width={w} height={4} rx={2} fill={active ? accent : "#e4decd"}/>
          </g>
        ),
        decor: (
          <g transform={`translate(${w-22} 10)`} stroke={active ? "#7a5a00" : muted} strokeWidth="1.1" fill="none">
            <circle cx="6" cy="6" r="3"/>
            <circle cx="6" cy="6" r="1" fill={active ? "#7a5a00" : muted}/>
            {[0,60,120,180,240,300].map(a => <line key={a} x1="6" y1="1.5" x2="6" y2="2.5" transform={`rotate(${a} 6 6)`}/>)}
          </g>
        ),
        label: centerLabel(),
      };
    }
    case "store": {
      const ry = 10;
      return {
        body: (
          <g>
            <path d={`M0 ${ry} V${h-ry} a${w/2} ${ry} 0 0 0 ${w} 0 V${ry}`}
              fill={fill} stroke={stroke} strokeWidth={strokeW}/>
            <path d={`M0 ${ry} a${w/2} ${ry} 0 1 0 ${w} 0 a${w/2} ${ry} 0 1 0 ${-w} 0`}
              fill={active ? "#fef3c7" : "#fbf6e7"} stroke={stroke} strokeWidth={strokeW}/>
          </g>
        ),
        decor: (
          <g>
            <path d={`M6 ${h*0.5} Q${w/2} ${h*0.5 + 4} ${w-6} ${h*0.5}`}
              stroke={active ? "#e7c97a" : "#e4decd"} strokeWidth="0.8" fill="none"/>
            <path d={`M10 ${h*0.72} Q${w/2} ${h*0.72 + 3} ${w-10} ${h*0.72}`}
              stroke={active ? "#e7c97a" : "#ece7db"} strokeWidth="0.6" fill="none"/>
          </g>
        ),
        label: (
          <g>
            <text x={w/2} y={h/2 + 10} textAnchor="middle"
              fontFamily="Inter Tight" fontWeight={600} fontSize={13} fill={ink}>{node.label}</text>
            {node.sub && (
              <text x={w/2} y={h/2 + 24} textAnchor="middle"
                fontFamily="JetBrains Mono" fontSize={9.5} fill={muted}>{node.sub}</text>
            )}
          </g>
        ),
      };
    }
    case "cache": {
      // RAM/cache card: top label, chip row, subtle contact strip at bottom
      return {
        body: card(10),
        decor: (
          <g>
            {/* chip row */}
            {[0,1,2,3].map(i => (
              <rect key={i} x={12 + i*((w-24)/4) + 2} y={h/2 - 4} width={(w-24)/4 - 4} height={12} rx={1.5}
                fill={active ? "#fde68a" : "#f0e9d6"} stroke={active ? accent : "#d9d0b8"} strokeWidth=".8"/>
            ))}
            {/* contact strip */}
            <g transform={`translate(0 ${h-7})`}>
              {Array.from({length: Math.max(10, Math.floor(w/8))}).map((_, i, a) => {
                const cw = (w - 24) / a.length;
                return <rect key={i} x={12 + i*cw + 0.5} y={0} width={cw - 1} height={3}
                  fill={active ? "#d4a315" : "#c9bf9e"} opacity=".55"/>;
              })}
            </g>
          </g>
        ),
        label: (
          <text x={w/2} y={16} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={13} fill={ink}>{node.label}</text>
        ),
      };
    }
    case "queue": {
      // Label up top; 3 FIFO pills below, front is highlighted
      const labelH = 20;
      const gap = 5;
      const rowCount = 3;
      const rowH = Math.max(8, (h - labelH - 8 - gap*(rowCount-1)) / rowCount);
      const rowColors = [
        active ? accent : "#e8b820",
        "#f2d664",
        "#e8deb5",
      ];
      return {
        body: card(10),
        decor: (
          <g>
            {Array.from({length: rowCount}).map((_, i) => {
              const y = labelH + i*(rowH + gap);
              const isFront = i === 0;
              return (
                <rect key={i} x={12} y={y} width={w-24} height={rowH} rx={Math.min(rowH/2, 5)}
                  fill={rowColors[i]} stroke={isFront ? (active ? "#7a5a00" : "#b79414") : "#d9c98b"}
                  strokeWidth={isFront ? 1 : .6}/>
              );
            })}
            <path d={`M${w-8} ${labelH + rowH/2} l5 -3.5 v7 z`}
              fill={active ? "#7a5a00" : "#b79414"}/>
          </g>
        ),
        label: (
          <text x={w/2} y={14} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={12.5} fill={ink}>{node.label}</text>
        ),
      };
    }
    case "actor": {
      const headR = 9;
      return {
        body: (
          <rect y={headR + 3} width={w} height={h - headR - 3} rx={12}
            fill={fill} stroke={stroke} strokeWidth={strokeW}/>
        ),
        decor: (
          <g>
            <circle cx={w/2} cy={headR + 1} r={headR} fill={fill} stroke={stroke} strokeWidth={strokeW}/>
            <circle cx={w/2} cy={headR - 1} r="2.2" fill={active ? "#7a5a00" : muted}/>
            <path d={`M${w/2 - 4} ${headR + 4} Q${w/2} ${headR + 7} ${w/2 + 4} ${headR + 4}`}
              stroke={active ? "#7a5a00" : muted} strokeWidth="1.2" fill="none"/>
          </g>
        ),
        label: (
          <g>
            <text x={w/2} y={headR + 3 + (h - headR - 3)/2 + 8} textAnchor="middle"
              fontFamily="Inter Tight" fontWeight={600} fontSize={13} fill={ink}>{node.label}</text>
            {node.sub && (
              <text x={w/2} y={headR + 3 + (h - headR - 3)/2 + 22} textAnchor="middle"
                fontFamily="JetBrains Mono" fontSize={9.5} fill={muted}>{node.sub}</text>
            )}
          </g>
        ),
      };
    }
    case "gateway": {
      const i = Math.min(w * 0.14, 16);
      return {
        body: (
          <path d={`M${i} 0 L${w-i} 0 L${w} ${h/2} L${w-i} ${h} L${i} ${h} L0 ${h/2} Z`}
            fill={fill} stroke={stroke} strokeWidth={strokeW}/>
        ),
        decor: (
          <g>
            <path d={`M${i} 6 L${w-i} 6`} stroke={active ? accent : "#e4decd"} strokeWidth="1"/>
            <path d={`M${i} ${h-6} L${w-i} ${h-6}`} stroke={active ? accent : "#e4decd"} strokeWidth="1"/>
          </g>
        ),
        label: centerLabel(),
      };
    }
    case "external": {
      const cd = `M${w*0.18} ${h*0.6} C ${w*0.02} ${h*0.6}, ${w*0.02} ${h*0.2}, ${w*0.22} ${h*0.25} C ${w*0.28} ${h*0.02}, ${w*0.58} ${h*0.02}, ${w*0.62} ${h*0.22} C ${w*0.85} ${h*0.15}, ${w*0.98} ${h*0.35}, ${w*0.9} ${h*0.6} C ${w*0.98} ${h*0.82}, ${w*0.75} ${h*0.98}, ${w*0.6} ${h*0.88} C ${w*0.4} ${h*1.02}, ${w*0.1} ${h*0.95}, ${w*0.18} ${h*0.6} Z`;
      return {
        body: <path d={cd} fill={fill} stroke={stroke} strokeWidth={strokeW}/>,
        decor: (
          <g>
            <path d={`M${w*0.35} ${h*0.42} A 10 10 0 0 1 ${w*0.65} ${h*0.42}`}
              stroke={active ? accent : muted} strokeWidth="1.2" fill="none"/>
            <path d={`M${w*0.4} ${h*0.47} A 6 6 0 0 1 ${w*0.6} ${h*0.47}`}
              stroke={active ? accent : muted} strokeWidth="1.2" fill="none"/>
            <circle cx={w/2} cy={h*0.54} r="1.4" fill={active ? accent : muted}/>
          </g>
        ),
        label: (
          <text x={w/2} y={h*0.8} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={12.5} fill={ink}>{node.label}</text>
        ),
      };
    }
    case "boundary": {
      const chipW = Math.max(70, node.label.length * 7);
      return {
        noShadow: true,
        body: (
          <rect width={w} height={h} rx={10} fill="transparent"
            stroke={active ? accent : "#a89e84"} strokeDasharray="5 4" strokeWidth="1.2"/>
        ),
        decor: (
          <g>
            <rect x={10} y={-8} width={chipW} height="16" rx="8"
              fill={active ? "#fef3c7" : "#fbf7ea"} stroke={active ? accent : "#d9d0b8"} strokeWidth=".8"/>
            <text x={10 + chipW/2} y={3} textAnchor="middle"
              fontFamily="JetBrains Mono" fontSize={10} fill={active ? "#7a5a00" : "#7a7060"}
              letterSpacing=".06em">{node.label}</text>
          </g>
        ),
        label: null,
      };
    }
    case "start": {
      return {
        body: (
          <rect width={w} height={h} rx={h/2} fill={active ? "#fef3c7" : "#eef8e6"}
            stroke={active ? accent : "#bfdfa8"} strokeWidth={strokeW}/>
        ),
        decor: (
          <g>
            <circle cx={18} cy={h/2} r="8" fill={active ? accent : "#9fcd7b"}/>
            <path d={`M${18-2} ${h/2 - 4} L${18+4} ${h/2} L${18-2} ${h/2 + 4} Z`} fill="#fff"/>
          </g>
        ),
        label: (
          <text x={w/2 + 6} y={h/2 + 4.5} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={13} fill={ink}>{node.label}</text>
        ),
      };
    }
    case "stop": {
      return {
        body: (
          <rect width={w} height={h} rx={h/2} fill={active ? "#fef3c7" : "#fdecec"}
            stroke={active ? accent : "#ecc7c7"} strokeWidth={strokeW}/>
        ),
        decor: (
          <g>
            <circle cx={18} cy={h/2} r="8" fill={active ? accent : "#d57a7a"}/>
            <rect x={18-3.5} y={h/2-3.5} width="7" height="7" rx="1" fill="#fff"/>
          </g>
        ),
        label: (
          <text x={w/2 + 6} y={h/2 + 4.5} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={13} fill={ink}>{node.label}</text>
        ),
      };
    }
    case "decision": {
      return {
        body: (
          <path d={`M${w/2} 0 L${w} ${h/2} L${w/2} ${h} L0 ${h/2} Z`}
            fill={fill} stroke={stroke} strokeWidth={strokeW}/>
        ),
        decor: null,
        label: (
          <text x={w/2} y={h/2 + 4} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={13} fill={ink}>{node.label}</text>
        ),
      };
    }
    case "event": {
      const r = Math.min(w, h)/2 - 2;
      return {
        body: (
          <circle cx={w/2} cy={h/2} r={r}
            fill={active ? "#fef3c7" : "#fdf8e4"} stroke={active ? accent : "#d9c98b"} strokeWidth={strokeW}/>
        ),
        decor: (
          <path d={`M ${w/2 + 2} ${h/2 - 8} L ${w/2 - 4} ${h/2 + 1} H ${w/2} L ${w/2 - 2} ${h/2 + 8} L ${w/2 + 4} ${h/2 - 1} H ${w/2} Z`}
            fill={active ? "#7a5a00" : "#b79414"}/>
        ),
        label: (
          <text x={w/2} y={h + 14} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={12.5} fill={ink}>{node.label}</text>
        ),
      };
    }
    case "step":
    case "tree": {
      return {
        body: (
          <circle cx={w/2} cy={h/2} r={Math.min(w,h)/2 - 2}
            fill={fill} stroke={stroke} strokeWidth={strokeW}/>
        ),
        decor: <circle cx={w/2} cy={h/2} r="3" fill={active ? accent : muted}/>,
        label: (
          <text x={w/2} y={h + 14} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={12.5} fill={ink}>{node.label}</text>
        ),
      };
    }
    case "image": {
      return {
        body: card(10),
        decor: (
          <g>
            <rect x={10} y={10} width={w-20} height={h-30} rx={4}
              fill={active ? "#fef3c7" : "#faf3dc"} stroke="#e4decd"/>
            <circle cx={18} cy={18} r="3" fill={active ? accent : "#d9c98b"}/>
            <path d={`M12 ${h-24} L ${w/2} ${h-34} L ${w-12} ${h-22}`}
              stroke={active ? "#7a5a00" : muted} strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
          </g>
        ),
        label: (
          <text x={w/2} y={h - 6} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={11.5} fill={ink}>{node.label}</text>
        ),
      };
    }
    default:
      return null;
  }
}

// ===========================================================
// SLEEK
// ===========================================================
const SleekStyle = {
  id: "sleek", name: "Sleek", tagline: "Soft whites, yellow accent, calm.",
  tokens: { bg: "#fffcf3", ink: "#26231d", muted: "#8f8779", accent: "#f5c518", line: "#e4decd" },
  Defs: () => (
    <defs>
      <filter id="sleek-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
        <feOffset dy="3"/>
        <feComponentTransfer><feFuncA type="linear" slope="0.15"/></feComponentTransfer>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <linearGradient id="sleek-node" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#fbf6e7"/>
      </linearGradient>
      <linearGradient id="sleek-node-a" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fffbea"/><stop offset="1" stopColor="#fef3c7"/>
      </linearGradient>
      <radialGradient id="sleek-glow" cx=".5" cy=".5" r=".55">
        <stop offset="0" stopColor="#f5c518" stopOpacity=".28"/>
        <stop offset="1" stopColor="#f5c518" stopOpacity="0"/>
      </radialGradient>
      <marker id="sleek-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="#8f8779"/>
      </marker>
      <marker id="sleek-arrow-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="#f5c518"/>
      </marker>
      <pattern id="sleek-dots" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r=".8" fill="#d9d3c6"/>
      </pattern>
    </defs>
  ),
  Background: ({ w, h }) => (
    <g>
      <rect width={w} height={h} fill="#fffcf3"/>
      <rect width={w} height={h} fill="url(#sleek-dots)" opacity=".6"/>
    </g>
  ),
  Node: ({ node, active }) => {
    const ink = "#26231d";
    const muted = "#8f8779";
    const shape = shapeOf(node);
    const isImg = node.kind === "image" && node.src;
    const fill = active ? "url(#sleek-node-a)" : "url(#sleek-node)";
    const stroke = active ? "#f5c518" : "#e4decd";
    const strokeW = active ? 1.5 : 1;
    const accentInk = active ? "#7a5a00" : muted;

    // Kind-driven body: each semantic kind has its own silhouette + decoration.
    // If node.shape is explicitly set, fall back to generic ShapeShell.
    const useKind = !node.shape && node.kind;
    const kindBody = useKind ? sleekKindBody(node, { fill, stroke, strokeW, ink, muted, accent: "#f5c518", active }) : null;

    return (
      <g transform={`translate(${node.x} ${node.y})`}>
        {active && shape !== "cylinder" && (
          <rect x={-10} y={-10} width={node.w + 20} height={node.h + 20}
            rx={18} fill="url(#sleek-glow)" style={{ animation: "sleek-pulse 2s ease-in-out infinite" }}/>
        )}
        {kindBody ? (
          <g filter={kindBody.noShadow ? undefined : "url(#sleek-soft)"}>{kindBody.body}</g>
        ) : (
          <g filter="url(#sleek-soft)">
            <ShapeShell node={node} fill={fill} stroke={stroke} strokeWidth={strokeW}/>
          </g>
        )}
        {kindBody && kindBody.decor}
        {isImg && (
          <image href={node.src} x={node.w/2 - 16} y={node.h/2 - 22} width="32" height="32"/>
        )}
        {kindBody && kindBody.label !== undefined ? kindBody.label : (
          <NodeLabel node={node} fill={ink} sub={node.sub} subFill={muted} iconTop={isImg ? 28 : 10}/>
        )}
      </g>
    );
  },
  Edge: ({ edge, active }) => {
    const dash = edge.kind === "dashed" ? "5 4" : undefined;
    const stroke = active ? "#f5c518" : "#b8b0a1";
    const mid = edgeMidpoint(edge.points);
    return (
      <g>
        <path d={edge.d} fill="none" stroke={stroke}
          strokeWidth={active ? 2 : 1.4} strokeDasharray={dash}
          markerEnd={active ? "url(#sleek-arrow-a)" : "url(#sleek-arrow)"}
          strokeLinecap="round" strokeLinejoin="round"/>
        {active && (
          <circle r="3.5" fill="#f5c518">
            <animateMotion dur="1.4s" repeatCount="indefinite" path={edge.d} rotate="auto"/>
          </circle>
        )}
        <EdgeLabel text={edge.label} x={mid.x} y={mid.y} bg="#fffcf3" fg={active ? "#7a5a00" : "#8f8779"} mono/>
      </g>
    );
  },
};

// ===========================================================
// SKETCH (hand-drawn)
// ===========================================================
const SketchStyle = {
  id: "sketch", name: "Sketch", tagline: "Like a whiteboard photo — warm and honest.",
  tokens: { bg: "#fbf7ec", ink: "#2b2a26", muted: "#5a5148", accent: "#d97757", line: "#3a362d" },
  Defs: () => (
    <defs>
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
    </defs>
  ),
  Background: ({ w, h }) => (
    <g>
      <rect width={w} height={h} fill="url(#sk-paper)"/>
      {Array.from({ length: Math.ceil(h / 28) }).map((_, i) => (
        <line key={i} x1="0" x2={w} y1={i * 28 + 14} y2={i * 28 + 14}
          stroke="#ded6c2" strokeWidth=".6" strokeDasharray="2 3"/>
      ))}
    </g>
  ),
  Node: ({ node, active }) => {
    const seed = node.id.charCodeAt(0) + node.id.length;
    const jitter = (n) => ((seed * (n+1)) % 7) * 0.35 - 1;
    const ink = active ? "#d97757" : "#2b2a26";
    const fill = active ? "#fce7d6" : "#ffffff";
    const shape = shapeOf(node);
    const isImg = node.kind === "image" && node.src;
    return (
      <g transform={`translate(${node.x} ${node.y})`}>
        {/* shadow under */}
        <g transform={`translate(${jitter(0)} ${jitter(1)+3})`} opacity=".55">
          <ShapeShell node={node} fill="#f0e9d6" stroke="none" strokeWidth={0}/>
        </g>
        <g filter="url(#sk-rough)">
          <ShapeShell node={node} fill={fill} stroke={ink} strokeWidth={1.8}/>
        </g>
        <g filter="url(#sk-rough)" opacity=".5">
          <ShapeShell node={node} fill="none" stroke={ink} strokeWidth={1}/>
        </g>
        {isImg && (<image href={node.src} x={node.w/2 - 16} y={node.h/2 - 22} width="32" height="32"/>)}
        {!isImg && !["diamond","circle","oval","pill"].includes(shape) && (
          <g transform="translate(12, 10)"><NodeIcon kind={node.kind} color={ink} sketchy/></g>
        )}
        <NodeLabel node={node} fill={ink} sub={node.sub} subFill="#5a5148"
          fontFamily="Caveat" fontWeight={600} fontSize={18} hand/>
      </g>
    );
  },
  Edge: ({ edge, active }) => {
    const d1 = roughPath(edge.points, 1.6, edge.id.charCodeAt(0) * 7);
    const d2 = roughPath(edge.points, 1.2, edge.id.charCodeAt(0) * 13 + 1);
    const dash = edge.kind === "dashed" ? "6 5" : undefined;
    const stroke = active ? "#d97757" : "#3a362d";
    const mid = edgeMidpoint(edge.points);
    return (
      <g>
        <path d={d1} fill="none" stroke={stroke} strokeWidth={active ? 2.2 : 1.5}
          strokeDasharray={dash}
          markerEnd={active ? "url(#sk-arrow-a)" : "url(#sk-arrow)"}
          strokeLinecap="round" filter="url(#sk-rough)"/>
        <path d={d2} fill="none" stroke={stroke} strokeWidth={active ? 1 : .7}
          strokeDasharray={dash} opacity=".4" strokeLinecap="round"/>
        {active && (
          <circle r="4" fill="#d97757" stroke="#fbf7ec" strokeWidth="1.5">
            <animateMotion dur="1.6s" repeatCount="indefinite" path={edge.d} rotate="auto"/>
          </circle>
        )}
        {edge.label && (
          <g transform={`translate(${mid.x} ${mid.y - 2}) rotate(-3)`}>
            <rect x={-edge.label.length * 4.5 - 4} y={-10} width={edge.label.length * 9 + 8} height={18}
              rx={3} fill="#fbf7ec"/>
            <text textAnchor="middle" dominantBaseline="middle"
              fontFamily="Caveat" fontSize="15" fill={active ? "#d97757" : "#5a5148"}>
              {edge.label}
            </text>
          </g>
        )}
      </g>
    );
  },
};

// ===========================================================
// ISO — flat isometric (existing, slightly refined)
// ===========================================================
const IsoStyle = {
  id: "iso", name: "Iso", tagline: "Flat isometric with pipe-style edges.",
  tokens: { bg: "#f3f4f6", ink: "#1e293b", muted: "#64748b", accent: "#f5c518", line: "#cbd5e1" },
  Defs: () => (
    <defs>
      <linearGradient id="iso-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#eef1f6"/></linearGradient>
      <linearGradient id="iso-top-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe28a"/><stop offset="1" stopColor="#f5c518"/></linearGradient>
      <linearGradient id="iso-right" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#dde2ea"/><stop offset="1" stopColor="#c7cfda"/></linearGradient>
      <linearGradient id="iso-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e7ebf1"/><stop offset="1" stopColor="#d2d8e1"/></linearGradient>
      <linearGradient id="iso-pipe" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2563eb"/><stop offset="1" stopColor="#60a5fa"/></linearGradient>
      <linearGradient id="iso-pipe-a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#f59e0b"/><stop offset="1" stopColor="#fde68a"/></linearGradient>
      <pattern id="iso-grid" width="24" height="14" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)">
        <path d="M0 0 L24 0 M0 0 L0 14" stroke="#dbe0e7" strokeWidth=".6"/>
      </pattern>
    </defs>
  ),
  Background: ({ w, h }) => (
    <g>
      <rect width={w} height={h} fill="#f3f4f6"/>
      <rect width={w} height={h} fill="url(#iso-grid)" opacity=".9"/>
    </g>
  ),
  Node: ({ node, active }) => {
    const depth = 12;
    const w = node.w, h = node.h;
    const shape = shapeOf(node);
    const topFill = active ? "url(#iso-top-a)" : "url(#iso-top)";
    const isImg = node.kind === "image" && node.src;
    return (
      <g transform={`translate(${node.x} ${node.y})`}>
        <ellipse cx={w/2 + 4} cy={h + depth + 6} rx={w*.4} ry="3.5" fill="#000" opacity=".07"/>
        {/* extrusion only for rect/square-like; other shapes get a back-shadow */}
        {(shape === "rect" || shape === "square") && (
          <>
            <path d={`M 0 ${h} L ${w} ${h} L ${w} ${h + depth} L 0 ${h + depth} Z`} fill="url(#iso-front)" stroke="#c7cfda" strokeWidth=".8"/>
            <path d={`M ${w} 0 L ${w + depth*0.6} ${-depth*0.5} L ${w + depth*0.6} ${h - depth*0.5} L ${w} ${h} Z`} fill="url(#iso-right)" stroke="#c7cfda" strokeWidth=".8"/>
          </>
        )}
        <ShapeShell node={node} fill={topFill}
          stroke={active ? "#f59e0b" : "#cfd6e0"} strokeWidth={1}/>
        {isImg && (<image href={node.src} x={w/2 - 16} y={h/2 - 22} width="32" height="32"/>)}
        {!isImg && !["diamond","circle","oval","pill"].includes(shape) && (
          <g transform="translate(10, 8)"><NodeIcon kind={node.kind} color={active ? "#7a5a00" : "#475569"}/></g>
        )}
        <NodeLabel node={node} fill={active ? "#3a2a00" : "#1e293b"} sub={node.sub}
          subFill={active ? "#7a5a00" : "#64748b"} fontSize={12.5}/>
      </g>
    );
  },
  Edge: ({ edge, active }) => {
    const mid = edgeMidpoint(edge.points);
    const stroke = active ? "url(#iso-pipe-a)" : "url(#iso-pipe)";
    return (
      <g>
        <path d={edge.d} fill="none" stroke="rgba(0,0,0,.08)" strokeWidth={active ? 8 : 6}
          transform="translate(1,2)" strokeLinecap="round" strokeLinejoin="round"/>
        <path d={edge.d} fill="none" stroke={stroke} strokeWidth={active ? 6 : 4}
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={edge.kind === "dashed" ? "10 6" : undefined}/>
        {active && (
          <circle r="3" fill="#fff">
            <animateMotion dur="1.4s" repeatCount="indefinite" path={edge.d} rotate="auto"/>
          </circle>
        )}
        <EdgeLabel text={edge.label} x={mid.x} y={mid.y} bg="#f3f4f6" fg={active ? "#7a5a00" : "#475569"} mono/>
      </g>
    );
  },
};

// ===========================================================
// CITY — True Isometric Map
// ===========================================================
const CityStyle = {
  id: "city", name: "City", tagline: "True 3D Map. City blocks, isometric projection.",
  tokens: { bg: "#F9FAFB", ink: "#0f172a", muted: "#64748b", accent: "#007AFF", line: "#D1D5DB" },
  isometric: true,
  Defs: () => (
    <defs>
      <radialGradient id="grid-fade" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="white" stopOpacity="1" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </radialGradient>
      <mask id="grid-fade-mask">
        <rect x="-2000" y="-2000" width="6000" height="6000" fill="url(#grid-fade)" />
      </mask>
      <pattern id="clay-iso-grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#EEEEEE" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
      </pattern>
      
      {/* Complex Studio Shadows */}
      <filter id="clay-ao" x="-30%" y="-30%" width="160%" height="160%">
        {/* Ambient Occlusion */}
        <feGaussianBlur in="SourceAlpha" stdDeviation="12" result="blur1"/>
        <feOffset in="blur1" dy="16" result="offset1"/>
        <feComponentTransfer in="offset1" result="ao">
           <feFuncA type="linear" slope=".06"/>
        </feComponentTransfer>
        {/* Contact Shadow */}
        <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur2"/>
        <feOffset in="blur2" dy="2" result="offset2"/>
        <feComponentTransfer in="offset2" result="contact">
           <feFuncA type="linear" slope=".15"/>
        </feComponentTransfer>
        {/* Merge */}
        <feMerge><feMergeNode in="ao"/><feMergeNode in="contact"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      
      <filter id="clay-ao-sm" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
        <feOffset dy="3"/>
        <feComponentTransfer><feFuncA type="linear" slope=".15"/></feComponentTransfer>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>

      {/* Matte White & Cool Grays */}
      <linearGradient id="clay-top" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#fdfdfd"/>
      </linearGradient>
      <linearGradient id="clay-right" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#f2f2f2"/><stop offset="1" stopColor="#e0e0e0"/>
      </linearGradient>
      <linearGradient id="clay-front" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e0e0e0"/><stop offset="1" stopColor="#cccccc"/>
      </linearGradient>
      <linearGradient id="clay-body" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#e0e0e0"/>
        <stop offset="0.25" stopColor="#e8e8e8"/>
        <stop offset="1" stopColor="#f2f2f2"/>
      </linearGradient>
      
      {/* Vertical wall gradients for soft lighting falloff */}
      <linearGradient id="clay-wall-left" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e4e4e7"/>
        <stop offset="1" stopColor="#d4d4d8"/>
      </linearGradient>
      <linearGradient id="clay-wall-right" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff"/>
        <stop offset="1" stopColor="#f4f4f5"/>
      </linearGradient>
      
      {/* Vibrant Pipes with bright cores */}
      <linearGradient id="clay-pipe-cool" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#005bb5"/><stop offset=".5" stopColor="#4da6ff"/><stop offset="1" stopColor="#007AFF"/>
      </linearGradient>
      <linearGradient id="clay-pipe-warm" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#cc9300"/><stop offset=".5" stopColor="#ffdb4d"/><stop offset="1" stopColor="#FFB800"/>
      </linearGradient>
      
      {/* Path-aligned glowing segments */}
      <linearGradient id="clay-flow-glow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="transparent"/>
        <stop offset="0.5" stopColor="#60a5fa"/>
        <stop offset="1" stopColor="transparent"/>
      </linearGradient>
      <linearGradient id="clay-flow-glow-warm" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="transparent"/>
        <stop offset="0.5" stopColor="#fcd34d"/>
        <stop offset="1" stopColor="transparent"/>
      </linearGradient>
    </defs>
  ),
  Background: ({ w, h }) => (
    <rect width={w*2} height={h*2} x={-w/2} y={-h/2} fill="url(#clay-iso-grid)" mask="url(#grid-fade-mask)"/>
  ),
  Node: ({ node, active }) => {
    const w = node.w, h = node.h;
    const isBoundary = node.kind === "boundary";
    const kind = node.kind;

    // -----------------------------------------------------------------
    // STORE → proper isometric cylinder (not a stacked-block).
    // -----------------------------------------------------------------
    if (kind === "store") {
      const r = Math.min(w, h) / 2;
      // Shift cylinder left to naturally meet the incoming pipe at x=0
      const cx = r;
      const cy = h / 2;
      const Z = 56;                   // Database height
      const E = 1.225 * Z;            // Vertical offset in grid space
      
      // Tangent points for vertical side walls in projected view
      const tan1 = { x: cx + r / Math.sqrt(2), y: cy + r / Math.sqrt(2) };
      const tan2 = { x: cx - r / Math.sqrt(2), y: cy - r / Math.sqrt(2) };
      const pSplit = { x: cx - r / Math.sqrt(2), y: cy + r / Math.sqrt(2) }; // Front peak for lighting split

      return (
        <g transform={`translate(${node.x} ${node.y})`}>
          {/* AO ground shadow */}
          <ellipse cx={cx + 8} cy={cy + 10} rx={r} ry={r * 0.577} fill="rgba(0,0,0,0.35)" filter="url(#clay-ao)"/>
          
          {/* Cylinder side - Left Wall (Shadow tone) */}
          <path
            d={`M ${tan2.x} ${tan2.y}
                L ${tan2.x + E} ${tan2.y - E}
                A ${r} ${r} 0 0 0 ${pSplit.x + E} ${pSplit.y - E}
                L ${pSplit.x} ${pSplit.y}
                A ${r} ${r} 0 0 1 ${tan2.x} ${tan2.y} Z`}
            fill="url(#clay-wall-left)"
          />
          
          {/* Cylinder side - Right Wall (Mid tone) */}
          <path
            d={`M ${pSplit.x} ${pSplit.y}
                L ${pSplit.x + E} ${pSplit.y - E}
                A ${r} ${r} 0 0 0 ${tan1.x + E} ${tan1.y - E}
                L ${tan1.x} ${tan1.y}
                A ${r} ${r} 0 0 1 ${pSplit.x} ${pSplit.y} Z`}
            fill="url(#clay-wall-right)"
          />

          {/* Partition bands — the database signature */}
          {[0.33, 0.66].map((f, i) => (
            <path key={i} 
              d={`M ${tan2.x + E*f} ${tan2.y - E*f} A ${r} ${r} 0 0 0 ${tan1.x + E*f} ${tan1.y - E*f}`}
              fill="none" stroke="#a1a1aa" strokeWidth="1" strokeDasharray="2 2" opacity="0.55"/>
          ))}

          {/* Top cap */}
          <g transform={`translate(${E} ${-E})`}>
            <circle cx={cx} cy={cy} r={r} fill="url(#clay-top)" stroke="#e4e4e7" strokeWidth="1"/>
            <circle cx={cx} cy={cy} r={r - 4} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1"/>
            
            {/* DB icon + label on top cap */}
            <g transform={`translate(${cx} ${cy})`}>
              <g transform="translate(-7 -16)"><NodeIcon kind="store" color="#475569" mono/></g>
              <text y={12} textAnchor="middle" fill="#334155" fontSize="14" fontWeight="600" fontFamily="Inter Tight">{node.label}</text>
              {node.sub && <text y={26} textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="JetBrains Mono">{node.sub}</text>}
            </g>
          </g>

          {/* Hardware Port attached to the cylinder wall (Matching standard node style exactly) */}
          <g transform={`translate(${E*0.06} ${cy - E*0.06})`}>
            <rect x="-2" y="-10" width={E*0.08} height="20" rx="3" fill="#1e293b" transform="skewY(-45)"/>
            <rect x="-1" y="-8" width={E*0.04} height="16" rx="2" fill="#007AFF" filter="url(#clay-ao-sm)" transform="skewY(-45)"/>
          </g>

          {active && (
            <circle cx={cx + E} cy={cy - E} r={r + 6} fill="none" stroke="#007AFF" strokeWidth="2">
              <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>
            </circle>
          )}
        </g>
      );
    }

    if (kind === "gateway") {
      const i = Math.min(w * 0.14, 16);
      const Z = 42;
      const E = 1.225 * Z;
      const p0={x:i, y:0}, p1={x:w-i, y:0}, p2={x:w, y:h/2}, p3={x:w-i, y:h}, p4={x:i, y:h}, p5={x:0, y:h/2};
      const t0={x:i+E, y:-E}, t1={x:w-i+E, y:-E}, t2={x:w+E, y:h/2-E}, t3={x:w-i+E, y:h-E}, t4={x:i+E, y:h-E}, t5={x:E, y:h/2-E};

      const poly = (pts) => pts.map(p => `${p.x},${p.y}`).join(" ");

      return (
        <g transform={`translate(${node.x} ${node.y})`}>
          <defs>
            {/* Custom local gradients for hexagonal facets */}
            <linearGradient id={`gw-wall-1-${node.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#cbd5e1"/><stop offset="1" stopColor="#94a3b8"/>
            </linearGradient>
            <linearGradient id={`gw-wall-2-${node.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e4e4e7"/><stop offset="1" stopColor="#d4d4d8"/>
            </linearGradient>
          </defs>

          {/* AO ground shadow */}
          <path d={`M ${poly([p0, p1, p2, p3, p4, p5])} Z`} fill="rgba(0,0,0,0.35)" filter="url(#clay-ao)"/>
          
          {/* Side walls - 3 visible faces with distinct lighting */}
          <path d={`M ${p0.x},${p0.y} L ${p5.x},${p5.y} L ${t5.x},${t5.y} L ${t0.x},${t0.y} Z`} fill={`url(#gw-wall-1-${node.id})`}/>
          <path d={`M ${p5.x},${p5.y} L ${p4.x},${p4.y} L ${t4.x},${t4.y} L ${t5.x},${t5.y} Z`} fill={`url(#gw-wall-2-${node.id})`}/>
          <path d={`M ${p4.x},${p4.y} L ${p3.x},${p3.y} L ${t3.x},${t3.y} L ${t4.x},${t4.y} Z`} fill="url(#clay-wall-right)"/>
          
          {/* Status LEDs on front-left wall */}
          <g transform={`translate(${p5.x*0.7 + p4.x*0.3} ${p5.y*0.7 + p4.y*0.3})`}>
             <ellipse cx={E*0.2} cy={-E*0.2 - 8} rx="1.5" ry="3.5" fill="#fcd34d" filter="url(#clay-ao-sm)"/>
             <ellipse cx={E*0.2} cy={-E*0.2 + 8} rx="1.5" ry="3.5" fill="#f59e0b" filter="url(#clay-ao-sm)"/>
          </g>

          {/* Top face */}
          <path d={`M ${poly([t0, t1, t2, t3, t4, t5])} Z`} fill="url(#clay-top)" stroke="none"/>
          
          {/* Top face recessed lid effect */}
          <path d={`M ${poly([t0, t1, t2, t3, t4, t5])} Z`} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="2.5" 
            transform="scale(0.9) translate(4 2)" style={{pointerEvents: 'none'}}/>

          {/* Content on top face */}
          <g transform={`translate(${w/2 + E} ${h/2 - E})`}>
             <g transform="translate(-7 -16)"><NodeIcon kind="gateway" color="#007AFF" mono/></g>
             <text y={12} textAnchor="middle" fill="#334155" fontSize="14" fontWeight="600" fontFamily="Inter Tight">{node.label}</text>
             {node.sub && <text y={26} textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="JetBrains Mono">{node.sub}</text>}
          </g>

          {active && (
            <path d={`M ${poly([t0, t1, t2, t3, t4, t5])} Z`} fill="none" stroke="#007AFF" strokeWidth="2" transform="scale(1.1) translate(-6 2)">
              <animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/>
            </path>
          )}
        </g>
      );
    }

    // Substantial thickness for hardware feel
    const Z = isBoundary ? 6 : (kind === 'client' || kind === 'actor' ? 32 : 42);
    const E = 1.225 * Z;
    
    const topFill = isBoundary ? "transparent" : "url(#clay-top)";
    const rightFill = isBoundary ? "transparent" : "url(#clay-right)";
    const frontFill = isBoundary ? "transparent" : "url(#clay-front)";
    const wallStroke = isBoundary ? "#cbd5e1" : "none";
    
    const layout = node.layout || "center";
    const icons = node.icons || [node.kind];
    
    // Large, smooth corner radius
    const R = isBoundary ? 0 : 16;

    return (
      <g transform={`translate(${node.x} ${node.y})`}>
        {/* Deep Ground shadow with perfectly matching rounded footprint */}
        <rect width={w} height={h} rx={R} fill={isBoundary ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.5)"} filter="url(#clay-ao)"/>
        
        {isBoundary ? (
          <g>
            <path d={`M 0 0 L 0 ${h} L ${E} ${h-E} L ${E} ${-E} Z`} fill="transparent" stroke={wallStroke} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
            <path d={`M 0 ${h} L ${w} ${h} L ${w+E} ${h-E} L ${E} ${h-E} Z`} fill="transparent" stroke={wallStroke} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
          </g>
        ) : (
          <g>
            <defs>
              {/* Mathematically precise local gradient orthogonal to vertical cylinder */}
              <linearGradient id={`corner-grad-${node.id}`} gradientUnits="userSpaceOnUse" x1={0} y1={h-R} x2={R} y2={h}>
                <stop offset="0" stopColor="#d4d4d8"/>
                <stop offset="1" stopColor="#f4f4f5"/>
              </linearGradient>
            </defs>
            {/* Left solid wall (Shadow-tone) */}
            <path d={`M 0 ${R} L 0 ${h-R} L ${E} ${h-R-E} L ${E} ${R-E} Z`} fill="url(#clay-wall-left)" />
            
            {/* Front curved corner (Seamless transition) */}
            <path d={`M 0 ${h-R} A ${R} ${R} 0 0 0 ${R} ${h} L ${R+E} ${h-E} A ${R} ${R} 0 0 1 ${E} ${h-R-E} Z`} fill={`url(#corner-grad-${node.id})`} /> 
            
            {/* Right solid wall (Mid-tone) */}
            <path d={`M ${R} ${h} L ${w-R} ${h} L ${w-R+E} ${h-E} L ${R+E} ${h-E} Z`} fill="url(#clay-wall-right)" />
            
            {/* Right curved corner (Fades around the back) */}
            <path d={`M ${w-R} ${h} A ${R} ${R} 0 0 0 ${w} ${h-R} L ${w+E} ${h-R-E} A ${R} ${R} 0 0 1 ${w-R+E} ${h-E} Z`} fill="url(#clay-wall-right)" />
            
            {/* Left curved corner (Shadow wraps back) */}
            <path d={`M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${R+E} ${-E} A ${R} ${R} 0 0 0 ${E} ${R-E} Z`} fill="url(#clay-wall-left)" />
          </g>
        )}
        
        {/* Localized physical sockets */}
        {!isBoundary && (
          <g>
            {/* Left face socket */}
            <g transform={`translate(${E*0.06} ${h/2 - E*0.06})`}>
              <rect x="-2" y="-10" width={E*0.08} height="20" rx="3" fill="#1e293b" transform="skewY(-45)"/>
              <rect x="-1" y="-8" width={E*0.04} height="16" rx="2" fill="#007AFF" filter="url(#clay-ao-sm)" transform="skewY(-45)"/>
            </g>
            {/* Right face socket */}
            <g transform={`translate(${w/2 + 2} ${h - 2})`}>
              <rect x="-10" y="-2" width="20" height={E*0.08} rx="3" fill="#1e293b" transform="skewX(-45)"/>
              <rect x="-8" y="-1" width="16" height={E*0.04} rx="2" fill="#007AFF" filter="url(#clay-ao-sm)" transform="skewX(-45)"/>
            </g>
          </g>
        )}


        {/* Top face with crisp geometric boundary */}
        <rect x={E} y={-E} width={w} height={h} rx={R} fill={topFill} stroke={isBoundary ? "#cbd5e1" : "none"} strokeWidth={isBoundary ? 1 : 0} />
        
        {/* Recessed Bevel Lid Effect (Inner shadow ring) */}
        {!isBoundary && (
           <rect x={E + 3} y={-E + 3} width={w - 6} height={h - 6} rx={Math.max(2, R - 3)} fill="transparent" stroke="rgba(0,0,0,0.06)" strokeWidth="2" />
        )}

        {/* Top face contents SKEWED to the grid */}
        <g transform={`translate(${E} ${-E})`}>
          {layout === 'multi-row' && (
            <g>
              <line x1={0} y1={h/2} x2={w} y2={h/2} stroke="#e2e8f0" strokeWidth={1.5} vectorEffect="non-scaling-stroke"/>
              {icons.map((ic, i) => {
                const cellW = w / icons.length;
                const cx = i * cellW + cellW/2;
                return (
                  <g key={i}>
                    {i > 0 && <line x1={i * cellW} y1={0} x2={i * cellW} y2={h/2} stroke="#e2e8f0" strokeWidth={1.5} vectorEffect="non-scaling-stroke"/>}
                    <g transform={`translate(${cx} ${h/4})`}><NodeIcon kind={ic} color="#475569" mono/></g>
                  </g>
                );
              })}
              <text x={w/2} y={h*0.75 + 4} textAnchor="middle" fill="#334155" fontSize="13" fontWeight="600" fontFamily="Inter Tight">{node.label}</text>
              {node.ellipsis && <circle cx={w - 16} cy={h*0.75} r="1.5" fill="#94a3b8" />}
              {node.ellipsis && <circle cx={w - 11} cy={h*0.75} r="1.5" fill="#94a3b8" />}
              {node.ellipsis && <circle cx={w - 6} cy={h*0.75} r="1.5" fill="#94a3b8" />}
            </g>
          )}

          {layout === 'inline' && (
            <g>
              {icons.map((ic, i) => {
                const cellW = w / icons.length;
                const cx = i * cellW + cellW/2;
                return (
                  <g key={i}>
                    {i > 0 && <line x1={i * cellW} y1={0} x2={i * cellW} y2={h} stroke="#e2e8f0" strokeWidth={1.5} vectorEffect="non-scaling-stroke"/>}
                    <g transform={`translate(${cx} ${h/2})`}><NodeIcon kind={ic} color="#475569" mono/></g>
                  </g>
                );
              })}
            </g>
          )}

          {layout === 'center' && (
            <g>
              {isBoundary ? (
                <text x={18} y={28} fill="#94a3b8" fontSize="18" fontWeight="600" fontFamily="Inter Tight" letterSpacing="0.05em">{node.label.toUpperCase()}</text>
              ) : (
                <g>
                  {/* Kind-specific top-face decoration */}
                  {kind === "queue" && (
                    <g>
                      {[0, 1, 2].map(i => {
                        const pw = (w - 28) / 3;
                        const px = 10 + i * (pw + 4);
                        return (
                          <g key={i}>
                            <rect x={px} y={8} width={pw} height={14} rx="3"
                              fill={i === 2 ? "#FFB800" : "#fde68a"}
                              stroke="#b45309" strokeWidth="1"/>
                          </g>
                        );
                      })}
                      <path d={`M ${w - 14} 15 L ${w - 6} 15 M ${w - 10} 11 L ${w - 6} 15 L ${w - 10} 19`}
                        stroke="#b45309" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </g>
                  )}
                  {kind === "cache" && (
                    <g>
                      {[0, 1, 2, 3].map(i => {
                        const cw = (w - 24) / 4;
                        const cx = 10 + i * (cw + 1);
                        return (
                          <rect key={i} x={cx} y={10} width={cw - 1} height={10} rx="1.5"
                            fill="#0f172a" stroke="#334155" strokeWidth="0.5"/>
                        );
                      })}
                      {[0, 1, 2, 3].map(i => {
                        const cw = (w - 24) / 4;
                        const cx = 10 + i * (cw + 1);
                        return (
                          <g key={`pins-${i}`}>
                            {[0, 1, 2, 3].map(j => (
                              <rect key={j} x={cx + 2 + j * ((cw - 5) / 3)} y={20} width="1" height="2" fill="#334155"/>
                            ))}
                          </g>
                        );
                      })}
                    </g>
                  )}
                  {(kind === "client" || kind === "actor") && (
                    <g>
                      {/* Head dome on top face */}
                      <circle cx={w/2} cy={12} r="6" fill="#cbd5e1" stroke="#64748b" strokeWidth="1"/>
                      <path d={`M ${w/2 - 10} 22 Q ${w/2} 14, ${w/2 + 10} 22`} fill="none" stroke="#64748b" strokeWidth="1"/>
                    </g>
                  )}
                  {kind === "external" && (
                    <g>
                      {/* Wifi bars on top */}
                      <g transform={`translate(${w/2} 16)`}>
                        <path d="M -8 4 Q 0 -6, 8 4" fill="none" stroke="#64748b" strokeWidth="1.5"/>
                        <path d="M -5 4 Q 0 -2, 5 4" fill="none" stroke="#64748b" strokeWidth="1.5"/>
                        <circle cx="0" cy="4" r="1.5" fill="#64748b"/>
                      </g>
                    </g>
                  )}
                  {kind === "event" && (
                    <g>
                      <circle cx={w/2} cy={14} r="8" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1"/>
                      <path d={`M ${w/2 + 1} 9 L ${w/2 - 2} 15 L ${w/2 + 1} 15 L ${w/2 - 1} 19 L ${w/2 + 3} 13 L ${w/2} 13 Z`}
                        fill="#f59e0b"/>
                    </g>
                  )}

                  {/* Central icon + label (pushed down when decoration present on top) */}
                  <g transform={`translate(${w/2} ${
                    ["queue","cache","gateway","client","actor","external","event"].includes(kind) ? h/2 + 8 : h/2
                  })`}>
                    {node.kind === "image" && node.src ? (
                      <image href={node.src} x={-16} y={-16} width="32" height="32"/>
                    ) : !["queue","cache","gateway","client","actor","external","event"].includes(kind) ? (
                      <g transform="translate(-7 -16)"><NodeIcon kind={icons[0]} color="#475569" mono/></g>
                    ) : null}
                    <text y={12} textAnchor="middle" fill="#334155" fontSize="14" fontWeight="600" fontFamily="Inter Tight">{node.label}</text>
                    {node.sub && <text y={26} textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="JetBrains Mono">{node.sub}</text>}
                  </g>
                </g>
              )}
            </g>
          )}
        </g>
        
        {/* Unskewed floating text for inline layout */}
        {layout === 'inline' && (
           <g transform={`translate(${w/2 + E/2} ${h - E/2}) rotate(45) scale(1, 1.732)`}>
              <text textAnchor="middle" dominantBaseline="middle" fill="#64748b" fontSize="12" fontWeight="600" fontFamily="Inter Tight">{node.label}</text>
           </g>
        )}
      </g>
    );
  },
  Edge: ({ edge, active }) => {
    const warm = active || edge.warm || edge.kind === "warm";
    const pipeSide = warm ? "url(#clay-pipe-warm)" : "url(#clay-pipe-cool)";
    const dash = edge.kind === "dashed" ? "16 10" : undefined;
    
    const mid = window.Flow.edgeMidpoint ? window.Flow.edgeMidpoint(edge.points) : edge.points[Math.floor(edge.points.length/2)];
    
    return (
      <g>
        {/* Ground shadow (AO) */}
        <path d={edge.d} fill="none" stroke="rgba(0,0,0,.15)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" filter="url(#clay-ao-sm)"/>
        
        {/* Volumetric Pipe - Base Shadow/Outer Body */}
        <path d={edge.d} fill="none" stroke="#64748b" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        
        {/* Volumetric Pipe - Main Core */}
        <path d={edge.d} fill="none" stroke={pipeSide} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} vectorEffect="non-scaling-stroke"/>
        
        {/* Volumetric Pipe - Specular Highlight (shifted up/left) */}
        <path d={edge.d} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="translate(-1, -1)" vectorEffect="non-scaling-stroke"/>
        
        {/* Animated glowing segments inside the pipe */}
        {active && (
          <path d={edge.d} fill="none" stroke={warm ? "#fde68a" : "#93c5fd"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="32 128" filter="url(#clay-ao-sm)" vectorEffect="non-scaling-stroke">
            <animate attributeName="stroke-dashoffset" from="160" to="0" dur="2s" repeatCount="indefinite" />
          </path>
        )}
        
        {/* Label floating ABOVE the line, facing the camera */}
        {edge.label && (
          <g transform={`translate(${mid.x} ${mid.y}) translate(0 -36) rotate(45) scale(1, 1.732)`}>
            <rect x={-edge.label.length*3.6 - 8} y={-10} width={edge.label.length*7.2 + 16} height={20}
              rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" filter="url(#clay-ao-sm)"/>
            <text textAnchor="middle" dominantBaseline="middle" fontFamily="JetBrains Mono" fontSize="10.5" fontWeight="600" fill={warm ? "#b45309" : "#1d4ed8"}>{edge.label}</text>
          </g>
        )}
      </g>
    );
  },
};

// ===========================================================
// BLUEPRINT
// ===========================================================
const BlueprintStyle = {
  id: "blueprint", name: "Blueprint", tagline: "Cyan on navy. Technical drawing.",
  tokens: { bg: "#0b2545", ink: "#e0fbfc", muted: "#8bb5d4", accent: "#ffd166", line: "#3b82a0" },
  Defs: () => (
    <defs>
      <pattern id="bp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e3a62" strokeWidth=".6"/>
      </pattern>
      <pattern id="bp-grid-hi" width="100" height="100" patternUnits="userSpaceOnUse">
        <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#2a4d80" strokeWidth=".8"/>
      </pattern>
      <marker id="bp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 1 L10 5 L0 9" fill="none" stroke="#80d0e0" strokeWidth="1.3"/>
      </marker>
      <marker id="bp-arrow-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 1 L10 5 L0 9" fill="none" stroke="#ffd166" strokeWidth="1.5"/>
      </marker>
    </defs>
  ),
  Background: ({ w, h }) => (
    <g>
      <rect width={w} height={h} fill="#0b2545"/>
      <rect width={w} height={h} fill="url(#bp-grid)"/>
      <rect width={w} height={h} fill="url(#bp-grid-hi)"/>
    </g>
  ),
  Node: ({ node, active }) => {
    const stroke = active ? "#ffd166" : "#80d0e0";
    const shape = shapeOf(node);
    const isImg = node.kind === "image" && node.src;
    return (
      <g transform={`translate(${node.x} ${node.y})`}>
        <ShapeShell node={node} fill="none" stroke={stroke}
          strokeWidth={active ? 1.6 : 1}
          strokeDasharray={node.kind === "external" ? "4 3" : undefined}/>
        {isImg && (<image href={node.src} x={node.w/2 - 16} y={node.h/2 - 22} width="32" height="32" opacity=".9"/>)}
        {!isImg && !["diamond","circle","oval","pill"].includes(shape) && (
          <g transform="translate(10, 8)"><NodeIcon kind={node.kind} color={stroke} mono/></g>
        )}
        <g>
          <text x={node.w / 2} y={node.h / 2 + 4} textAnchor="middle"
            fontFamily="JetBrains Mono" fontWeight="600" fontSize="11" fill={active ? "#ffd166" : "#e0fbfc"}
            letterSpacing=".04em">
            {node.label.toUpperCase()}
          </text>
          {node.sub && (
            <text x={node.w / 2} y={node.h - 8} textAnchor="middle"
              fontFamily="JetBrains Mono" fontSize="8.5" fill="#8bb5d4">{node.sub}</text>
          )}
        </g>
      </g>
    );
  },
  Edge: ({ edge, active }) => {
    const dash = edge.kind === "dashed" ? "4 3" : undefined;
    const stroke = active ? "#ffd166" : "#80d0e0";
    const mid = edgeMidpoint(edge.points);
    return (
      <g>
        <path d={edge.d} fill="none" stroke={stroke}
          strokeWidth={active ? 1.4 : 1}
          strokeDasharray={dash}
          markerEnd={active ? "url(#bp-arrow-a)" : "url(#bp-arrow)"}/>
        {active && (
          <circle r="2.5" fill="#ffd166">
            <animateMotion dur="1.5s" repeatCount="indefinite" path={edge.d} rotate="auto"/>
          </circle>
        )}
        {edge.label && (
          <g transform={`translate(${mid.x} ${mid.y})`}>
            <rect x={-edge.label.length * 3.3 - 4} y={-7} width={edge.label.length * 6.6 + 8} height={14}
              fill="#0b2545" stroke={stroke} strokeWidth=".5"/>
            <text textAnchor="middle" dominantBaseline="middle"
              fontFamily="JetBrains Mono" fontSize="9" fill={active ? "#ffd166" : "#8bb5d4"}
              letterSpacing=".05em">
              {edge.label.toUpperCase()}
            </text>
          </g>
        )}
      </g>
    );
  },
};

// ===========================================================
// ICONS
// ===========================================================
function NodeIcon({ kind, color = "#8f8779", sketchy = false, mono = false }) {
  const s = 14;
  const sw = mono ? 1 : 1.2;
  const common = { stroke: color, strokeWidth: sw, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  const filter = sketchy ? { filter: "url(#sk-rough)" } : {};
  switch (kind) {
    case "actor":
      return <g {...filter}><circle cx={s/2} cy={4} r="2.5" {...common}/><path d={`M1 ${s} C 2 9, 5 9, ${s/2} 9 C ${s-5} 9, ${s-2} 9, ${s-1} ${s}`} {...common}/></g>;
    case "service":
    case "process":
      return <g {...filter}><rect x="1" y="2" width={s-2} height={s-4} rx="1.5" {...common}/><line x1="1" y1="6" x2={s-1} y2="6" {...common}/></g>;
    case "gateway":
      return <g {...filter}><path d={`M${s/2} 1 L${s-1} ${s/2} L${s/2} ${s-1} L1 ${s/2} Z`} {...common}/></g>;
    case "store":
      return <g {...filter}>
        <ellipse cx={s/2} cy="3" rx="5.5" ry="1.8" {...common}/>
        <path d={`M1 3 L1 ${s-3} C 1 ${s-1}, ${s-1} ${s-1}, ${s-1} ${s-3} L${s-1} 3`} {...common}/>
      </g>;
    case "cache":
      return <g {...filter}><circle cx={s/2} cy={s/2} r="5.5" {...common}/><circle cx={s/2} cy={s/2} r="1.2" {...common}/></g>;
    case "queue":
      return <g {...filter}>
        <rect x="1" y="3" width={s-2} height="3" {...common}/>
        <rect x="1" y="7.5" width={s-2} height="3" {...common}/>
      </g>;
    case "external":
      return <g {...filter}>
        <path d={`M3 ${s/2+2} C 1 ${s/2+2}, 1 ${s/2-1}, 3 ${s/2-1} C 3 3, 8 2, 10 ${s/2-2} C 13 ${s/2-2}, 13 ${s/2+2}, ${s-2} ${s/2+2} Z`} {...common}/>
      </g>;
    case "boundary":
      return <g {...filter}><rect x="1" y="1" width={s-2} height={s-2} rx="1" strokeDasharray="2 1.5" {...common}/></g>;
    case "start":
    case "play":
      return <g {...filter}><path d={`M4 2 L11 7 L4 12 Z`} fill={color} stroke="none"/></g>;
    case "stop":
    case "square":
      return <g {...filter}><rect x="3" y="3" width="8" height="8" fill={color} stroke="none"/></g>;
    case "decision":
      return <g {...filter}><text x={s/2} y={s-3} textAnchor="middle" fontSize="11" fontFamily="Inter Tight" fontWeight="700" fill={color}>?</text></g>;
    case "event":
      return <g {...filter}><path d={`M8 1 L3 8 H7 L6 13 L11 6 H7 L8 1 Z`} fill={color} stroke="none"/></g>;
    case "tree":
    case "step":
      return <g {...filter}><circle cx={s/2} cy={s/2} r="3" {...common}/></g>;
    case "image":
      return <g {...filter}><rect x="1" y="2" width={s-2} height={s-4} rx="1" {...common}/><circle cx="5" cy="6" r="1.2" {...common}/><path d={`M1 ${s-4} L5 ${s-7} L9 ${s-5} L${s-1} ${s-2}`} {...common}/></g>;
    default:
      return <rect x="2" y="2" width={s-4} height={s-4} {...common}/>;
  }
}

// ===========================================================
// Generic <Diagram>
// ===========================================================
function Diagram({ graph, style, activeNodes = [], activeEdges = [], padding = 24, className }) {
  const Style = STYLES[style] || SleekStyle;
  const [viewAngle, setViewAngle] = React.useState(0);

  const G = React.useMemo(() => {
    if (!Style.isometric || viewAngle === 0) return resolveGraph(graph);

    const cw = graph.canvas.w;
    const ch = graph.canvas.h;
    
    let newCanvasW = cw;
    let newCanvasH = ch;
    
    if (viewAngle === 90 || viewAngle === 270) {
       newCanvasW = ch;
       newCanvasH = cw;
    }

    const transformedNodes = graph.nodes.map(n => {
       let { x, y, w, h } = n;
       let nx = x, ny = y, nw = w, nh = h;
       
       if (viewAngle === 90) {
          nx = ch - y - h;
          ny = x;
          nw = h;
          nh = w;
       } else if (viewAngle === 180) {
          nx = cw - x - w;
          ny = ch - y - h;
       } else if (viewAngle === 270) {
          nx = y;
          ny = cw - x - w;
          nw = h;
          nh = w;
       }
       return { ...n, x: nx, y: ny, w: nw, h: nh };
    });

    const transformedGraph = {
       ...graph,
       canvas: { ...graph.canvas, w: newCanvasW, h: newCanvasH },
       nodes: transformedNodes
    };

    return resolveGraph(transformedGraph);
  }, [graph, viewAngle, Style.isometric]);
  
  // Config
  const showFullscreen = G.fullScreen !== false;
  const showZoom = G.zoomControl !== false;
  const alwaysShowControls = G.alwaysDisplayControls === true;

  const sortedNodes = React.useMemo(() => {
    if (!Style.isometric) return G.nodes;
    return [...G.nodes].sort((a, b) => 
      ((a.y + a.h/2) - (a.x + a.w/2)) - ((b.y + b.h/2) - (b.x + b.w/2))
    );
  }, [G.nodes, Style.isometric]);

  // Dynamically compute the tight bounding box
  const bounds = React.useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    if (!Style.isometric) {
      G.nodes.forEach(n => {
        minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
      });
      G.edges.forEach(e => e.points.forEach(p => {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }));
    } else {
      // Isometric projection mapping: rotate(-45) then scale(1, 0.577)
      // X' = 0.707 X + 0.707 Y
      // Y' = -0.408 X + 0.408 Y
      const iso = (x, y, z=0) => ({
        x: 0.707 * x + 0.707 * y,
        y: -0.408 * x + 0.408 * y - z
      });

      G.nodes.forEach(n => {
        const isBoundary = n.kind === "boundary";
        const Z = isBoundary ? 6 : (n.kind === 'store' ? 56 : 36);
        
        const pts = [
          iso(n.x, n.y, 0), iso(n.x+n.w, n.y, 0), iso(n.x, n.y+n.h, 0), iso(n.x+n.w, n.y+n.h, 0),
          iso(n.x, n.y, Z), iso(n.x+n.w, n.y, Z), iso(n.x, n.y+n.h, Z), iso(n.x+n.w, n.y+n.h, Z)
        ];
        pts.forEach(p => {
          minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        });
      });

      G.edges.forEach(e => e.points.forEach(p => {
        const pIso = iso(p.x, p.y, 0);
        minX = Math.min(minX, pIso.x); minY = Math.min(minY, pIso.y);
        maxX = Math.max(maxX, pIso.x); maxY = Math.max(maxY, pIso.y);
      }));
    }
    
    // Add a bit of extra vertical space for shadows/overflow
    minX -= 10;
    minY -= 15;
    maxX += 10;
    maxY += 25;

    return { minX, minY, w: maxX - minX, h: maxY - minY };
  }, [G.nodes, G.edges, Style.isometric]);

  const containerRef = React.useRef(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [zoom, setZoom] = React.useState(1.0);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const dragStartRef = React.useRef(null);

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.25, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.25, 0.25));
  const handleZoomReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Compute logic dimensions
  const baseW = bounds.w + padding * 2;
  const baseH = bounds.h + padding * 2;

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    // Scale screen drag delta to SVG viewBox coordinate system
    let scale = 1;
    if (containerRef.current) {
       const rect = containerRef.current.getBoundingClientRect();
       const displayedW = baseW / zoom;
       const displayedH = baseH / zoom;
       scale = Math.min(rect.width / displayedW, rect.height / displayedH) || 1;
    }
    
    setPan({
      x: dragStartRef.current.panX - (dx / scale),
      y: dragStartRef.current.panY - (dy / scale)
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  // Compute final viewBox accounting for zoom and pan (centered)
  const cx = bounds.minX - padding + baseW / 2 + pan.x;
  const cy = bounds.minY - padding + baseH / 2 + pan.y;
  const vbW = baseW / zoom;
  const vbH = baseH / zoom;
  const vbX = cx - vbW / 2;
  const vbY = cy - vbH / 2;

  const btnStyle = {
    background: "transparent", border: "none",
    padding: "8px", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--ink-600, #475569)", transition: "all 0.2s ease"
  };

  const showControls = alwaysShowControls || isHovered || isDragging || isFullscreen;

  return (
    <div 
      ref={containerRef} 
      className={className} 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: "100%", height: "100%", position: "relative", background: Style.tokens.bg }}>
      <svg 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ 
          width: "100%", height: "100%", display: "block", 
          cursor: isDragging ? "grabbing" : "grab",
          transition: isDragging ? "none" : "all 0.3s ease-out" 
        }}>
        <Style.Defs/>
        <g transform={Style.isometric ? `scale(1, 0.577) rotate(-45)` : ""}>
          <Style.Background w={G.canvas.w} h={G.canvas.h} grid={G.canvas.grid}/>
          {G.edges.map(e => (
            <Style.Edge key={e.id} edge={e} active={activeEdges.includes(e.id)}/>
          ))}
          {sortedNodes.map(n => (
            <Style.Node key={n.id} node={n} active={activeNodes.includes(n.id)}/>
          ))}
        </g>
      </svg>
      
      {/* Controls Container */}
      {(showFullscreen || showZoom) && (
        <div style={{ 
          position: "absolute", bottom: "16px", right: "16px", display: "flex", gap: "8px", zIndex: 10,
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? "auto" : "none",
          transition: "opacity 0.2s ease"
        }}>
          
          {/* Zoom Controls */}
          {showZoom && (
            <div style={{
              background: "var(--paper, #ffffff)", border: "1px solid var(--line, #e2e8f0)",
              borderRadius: "8px", display: "flex", overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
            }}>
              <button onClick={handleZoomOut} style={btnStyle} title="Zoom Out" onMouseOver={e => e.currentTarget.style.background = "var(--paper-2, #f8fafc)"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
              <div style={{ width: "1px", background: "var(--line, #e2e8f0)" }} />
              <button onClick={handleZoomReset} style={{...btnStyle, fontSize: "11px", fontFamily: "var(--font-mono, monospace)", fontWeight: "600", width: "48px"}} title="Reset Zoom" onMouseOver={e => e.currentTarget.style.background = "var(--paper-2, #f8fafc)"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                 {Math.round(zoom * 100)}%
              </button>
              <div style={{ width: "1px", background: "var(--line, #e2e8f0)" }} />
              <button onClick={handleZoomIn} style={btnStyle} title="Zoom In" onMouseOver={e => e.currentTarget.style.background = "var(--paper-2, #f8fafc)"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              </button>
            </div>
          )}

          {/* View Rotation Toggle */}
          {Style.isometric && (
            <button 
              onClick={() => setViewAngle(a => (a + 90) % 360)}
              style={{
                background: "var(--paper, #ffffff)", border: "1px solid var(--line, #e2e8f0)",
                borderRadius: "8px", padding: "8px", cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--ink-600, #475569)", transition: "all 0.2s ease"
              }}
              title="Rotate View 90°"
              onMouseOver={e => e.currentTarget.style.background = "var(--paper-2, #f8fafc)"}
              onMouseOut={e => e.currentTarget.style.background = "var(--paper, #ffffff)"}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
            </button>
          )}

          {/* Fullscreen Toggle */}
          {showFullscreen && (
            <button 
              onClick={toggleFullscreen}
              style={{
                background: "var(--paper, #ffffff)", border: "1px solid var(--line, #e2e8f0)",
                borderRadius: "8px", padding: "8px", cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--ink-600, #475569)", transition: "all 0.2s ease"
              }}
              title="Toggle Fullscreen"
              onMouseOver={e => e.currentTarget.style.background = "var(--paper-2, #f8fafc)"}
              onMouseOut={e => e.currentTarget.style.background = "var(--paper, #ffffff)"}
            >
              {isFullscreen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const STYLES = {
  sleek: SleekStyle,
  sketch: SketchStyle,
  iso: IsoStyle,
  city: CityStyle,
  blueprint: BlueprintStyle,
};

window.Flow = Object.assign(window.Flow || {}, { STYLES, Diagram, NodeIcon });
