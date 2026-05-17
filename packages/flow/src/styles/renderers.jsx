import React from 'react';
import { shapePath } from '../shapes.js';
import { shapeOf, edgeMidpoint, roughPath } from '../graph.js';
import { getIcon } from '../icons.js';

// ---------- Shared helpers ----------

// Renders the node's `image:` (URL or data URL) or `icon:` (bundled
// sprite). Backwards-compatible with `kind: image` + `src:`. Returns
// null when the node has no media.
//
// `imagePosition: 'top' (default) | 'center' | 'bottom' | 'fill'`
// `imageFit:      'contain' (default) | 'cover' | 'fill'`
function NodeImageOrIcon({ node }) {
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
      const shape = shapeOf(node);
      const s = shapePath(shape, w, h, node);
      const clipId = `fd-clip-${node.id}`;
      return (
        <g>
          <clipPath id={clipId}><path d={s.d} /></clipPath>
          <image href={imageUrl} x={0} y={0} width={w} height={h}
                 preserveAspectRatio={preserve} clipPath={`url(#${clipId})`} />
        </g>
      );
    }

    const size = Math.min(40, Math.min(w, h) - 16);
    const x = w/2 - size/2;
    const y = position === 'bottom' ? h - size - 8
            : position === 'center' ? h/2 - size/2
                                    : 8;
    const preserve = fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
    return <image href={imageUrl} x={x} y={y} width={size} height={size} preserveAspectRatio={preserve} />;
  }

  if (iconName) {
    const fragment = getIcon(iconName);
    if (!fragment) return null;
    const size = Math.min(28, Math.min(w, h) - 20);
    if (size <= 0) return null;
    const x = w/2 - size/2;
    const y = node.imagePosition === 'center' ? h/2 - size/2
            : node.imagePosition === 'bottom' ? h - size - 8
                                              : 6;
    const scale = size / 24;
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`} style={{ color: '#1e293b' }}
         dangerouslySetInnerHTML={{ __html: fragment }} />
    );
  }

  return null;
}

function hasMedia(node) {
  return !!(node.image || node.icon || (node.kind === 'image' && node.src));
}

// Sankey-style edge thickness: scale the base stroke width by sqrt(weight).
function edgeStrokeWidth(edge, base) {
  if (edge && typeof edge.weight === 'number' && edge.weight > 0) {
    const scale = Math.max(0.5, Math.min(6, Math.sqrt(edge.weight)));
    return Math.max(0.5, base * scale);
  }
  return base;
}

function EdgeLabel({ text, x, y, bg = '#faf7ef', fg = '#6b6459', mono = false }) {
  if (!text) return null;
  return (
    <g transform={`translate(${x} ${y - 12})`}>
      <text textAnchor="middle" dominantBaseline="middle"
        fontFamily={mono ? 'JetBrains Mono' : 'Inter Tight'}
        fontSize="11" fill={bg} stroke={bg} strokeWidth="3.5" strokeLinejoin="round">{text}</text>
      <text textAnchor="middle" dominantBaseline="middle"
        fontFamily={mono ? 'JetBrains Mono' : 'Inter Tight'}
        fontSize="11" fill={fg} fontWeight="600">{text}</text>
    </g>
  );
}

function ShapeShell({ node, fill, stroke, strokeWidth, strokeDasharray }) {
  const shape = shapeOf(node);
  const s = shapePath(shape, node.w, node.h, node);
  if (shape === 'rect') {
    return <rect width={node.w} height={node.h} rx={s.rx ?? 10} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray}/>;
  }
  if (shape === 'square') {
    const sz = Math.min(node.w, node.h), ox = (node.w - sz) / 2, oy = (node.h - sz) / 2;
    return <rect x={ox} y={oy} width={sz} height={sz} rx={4} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray}/>;
  }
  if (shape === 'pill') {
    return <rect width={node.w} height={node.h} rx={node.h/2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray}/>;
  }
  if (shape === 'circle' && s.circle) {
    return <circle cx={s.circle.cx} cy={s.circle.cy} r={s.circle.r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray}/>;
  }
  if (shape === 'oval' && s.ellipse) {
    return <ellipse cx={s.ellipse.cx} cy={s.ellipse.cy} rx={s.ellipse.rx} ry={s.ellipse.ry} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray}/>;
  }
  if (shape === 'cylinder') {
    return (
      <g>
        <path d={s.body} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
        <path d={s.top}  fill={fill} stroke={stroke} strokeWidth={strokeWidth}/>
      </g>
    );
  }
  return <path d={s.d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={strokeDasharray}/>;
}

function NodeLabel({ node, fill, sub, subFill, fontFamily = 'Inter Tight', fontWeight = 600, fontSize = 13, hand = false, centerOffsetY = 0 }) {
  const shape = shapeOf(node);
  if (['diamond', 'circle', 'oval', 'pill'].includes(shape)) {
    return (
      <g>
        <text x={node.w/2} y={node.h/2 + (sub ? -3 : 4) + centerOffsetY} textAnchor="middle" dominantBaseline="middle"
          fontFamily={fontFamily} fontWeight={fontWeight} fontSize={fontSize} fill={fill}>{node.label}</text>
        {sub && (
          <text x={node.w/2} y={node.h/2 + 12 + centerOffsetY} textAnchor="middle" dominantBaseline="middle"
            fontFamily="JetBrains Mono" fontSize="9.5" fill={subFill}>{sub}</text>
        )}
      </g>
    );
  }
  return (
    <g>
      <text x={node.w/2} y={node.h/2 + 4} textAnchor="middle"
        fontFamily={fontFamily} fontWeight={fontWeight} fontSize={hand ? 20 : fontSize} fill={fill}>{node.label}</text>
      {sub && (
        <text x={node.w/2} y={node.h - 12} textAnchor="middle"
          fontFamily={hand ? 'Caveat' : 'JetBrains Mono'} fontSize={hand ? 13 : 9.5} fill={subFill}>{sub}</text>
      )}
    </g>
  );
}

// ---------- NodeIcon ----------

export function NodeIcon({ kind, color = '#8f8779', sketchy = false, mono = false }) {
  const s = 14;
  const sw = mono ? 1 : 1.2;
  const common = { stroke: color, strokeWidth: sw, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const filter = sketchy ? { filter: 'url(#sk-rough)' } : {};

  switch (kind) {
    case 'actor':
    case 'client':
    case 'person':
      return <g {...filter}><circle cx={s/2} cy={4} r="2.5" {...common}/><path d={`M1 ${s} C 2 9, 5 9, ${s/2} 9 C ${s-5} 9, ${s-2} 9, ${s-1} ${s}`} {...common}/></g>;
    case 'service':
    case 'process':
      return <g {...filter}><rect x="1" y="2" width={s-2} height={s-4} rx="1.5" {...common}/><line x1="1" y1="6" x2={s-1} y2="6" {...common}/></g>;
    case 'gateway':
      return <g {...filter}><path d={`M${s/2} 1 L${s-1} ${s/2} L${s/2} ${s-1} L1 ${s/2} Z`} {...common}/></g>;
    case 'store':
      return <g {...filter}>
        <ellipse cx={s/2} cy="3" rx="5.5" ry="1.8" {...common}/>
        <path d={`M1 3 L1 ${s-3} C 1 ${s-1}, ${s-1} ${s-1}, ${s-1} ${s-3} L${s-1} 3`} {...common}/>
      </g>;
    case 'cache':
      return <g {...filter}><circle cx={s/2} cy={s/2} r="5.5" {...common}/><circle cx={s/2} cy={s/2} r="1.2" {...common}/></g>;
    case 'queue':
      return <g {...filter}>
        <rect x="1" y="3" width={s-2} height="3" {...common}/>
        <rect x="1" y="7.5" width={s-2} height="3" {...common}/>
      </g>;
    case 'external':
      return <g {...filter}>
        <path d={`M3 ${s/2+2} C 1 ${s/2+2}, 1 ${s/2-1}, 3 ${s/2-1} C 3 3, 8 2, 10 ${s/2-2} C 13 ${s/2-2}, 13 ${s/2+2}, ${s-2} ${s/2+2} Z`} {...common}/>
      </g>;
    case 'boundary':
      return <g {...filter}><rect x="1" y="1" width={s-2} height={s-2} rx="1" strokeDasharray="2 1.5" {...common}/></g>;
    case 'start':
      return <g {...filter}><path d="M4 2 L11 7 L4 12 Z" fill={color} stroke="none"/></g>;
    case 'stop':
      return <g {...filter}><rect x="3" y="3" width="8" height="8" fill={color} stroke="none"/></g>;
    case 'decision':
      return <g {...filter}><text x={s/2} y={s-3} textAnchor="middle" fontSize="11" fontFamily="Inter Tight" fontWeight="700" fill={color}>?</text></g>;
    case 'event':
      return <g {...filter}><path d="M8 1 L3 8 H7 L6 13 L11 6 H7 L8 1 Z" fill={color} stroke="none"/></g>;
    case 'step':
    case 'tree':
      return <g {...filter}><circle cx={s/2} cy={s/2} r="3" {...common}/></g>;
    case 'image':
      return <g {...filter}><rect x="1" y="2" width={s-2} height={s-4} rx="1" {...common}/><circle cx="5" cy="6" r="1.2" {...common}/><path d={`M1 ${s-4} L5 ${s-7} L9 ${s-5} L${s-1} ${s-2}`} {...common}/></g>;
    case 'function':
      return <g {...filter}><text x={s/2} y={s-2} textAnchor="middle" fontSize="13" fontFamily="Inter Tight" fontWeight="500" fill={color}>λ</text></g>;
    case 'worker': {
      const teeth = [];
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        teeth.push(<line key={i} x1={s/2 + Math.cos(a)*5} y1={s/2 + Math.sin(a)*5} x2={s/2 + Math.cos(a)*6.7} y2={s/2 + Math.sin(a)*6.7} {...common}/>);
      }
      return <g {...filter}><circle cx={s/2} cy={s/2} r="3.5" {...common}/>{teeth}</g>;
    }
    case 'loadbalancer':
      return <g {...filter}>
        <circle cx={s/2} cy="3" r="1.6" {...common}/>
        <line x1={s/2} y1="4.5" x2={s/2} y2={s-2} {...common}/>
        <line x1="2" y1={s-2} x2={s-2} y2={s-2} {...common}/>
        <path d={`M2 ${s-2} L${s/2} 7 L${s-2} ${s-2}`} {...common}/>
      </g>;
    case 'cdn':
      return <g {...filter}>
        <circle cx={s/2} cy={s/2} r="5.5" {...common}/>
        <path d={`M1.5 ${s/2} H${s-1.5}`} {...common}/>
        <path d={`M${s/2} 1.5 C 4 ${s/2}, 4 ${s/2}, ${s/2} ${s-1.5}`} {...common}/>
        <path d={`M${s/2} 1.5 C 10 ${s/2}, 10 ${s/2}, ${s/2} ${s-1.5}`} {...common}/>
      </g>;
    case 'auth':
      return <g {...filter}>
        <circle cx="4" cy={s/2} r="2.5" {...common}/>
        <line x1="6" y1={s/2} x2={s-1} y2={s/2} {...common}/>
        <line x1={s-3} y1={s/2} x2={s-3} y2={s/2+2.5} {...common}/>
        <line x1={s-1} y1={s/2} x2={s-1} y2={s/2+2.5} {...common}/>
      </g>;
    case 'monitor':
      return <g {...filter}>
        <line x1="1.5" y1="2" x2="1.5" y2={s-1.5} {...common}/>
        <line x1="1.5" y1={s-1.5} x2={s-1} y2={s-1.5} {...common}/>
        <path d={`M3 ${s-4} L6 ${s-7} L9 ${s-5} L12 ${s-9}`} {...common}/>
      </g>;
    case 'bus':
      return <g {...filter}>
        <line x1="1" y1={s/2} x2={s-1} y2={s/2} {...common}/>
        <circle cx="3" cy={s/2-3} r="1.4" {...common}/>
        <line x1="3" y1={s/2-1.6} x2="3" y2={s/2} {...common}/>
        <circle cx={s/2} cy={s/2+3} r="1.4" {...common}/>
        <line x1={s/2} y1={s/2} x2={s/2} y2={s/2+1.6} {...common}/>
        <circle cx={s-3} cy={s/2-3} r="1.4" {...common}/>
        <line x1={s-3} y1={s/2-1.6} x2={s-3} y2={s/2} {...common}/>
      </g>;
    case 'stream':
      return <g {...filter}>
        <path d={`M1 ${s/2} Q 3 ${s/2-3}, 5 ${s/2} T 9 ${s/2} T 13 ${s/2}`} {...common}/>
        <path d={`M1 ${s/2+3} Q 3 ${s/2}, 5 ${s/2+3} T 9 ${s/2+3} T 13 ${s/2+3}`} {...common} opacity=".55"/>
      </g>;
    case 'firewall':
      return <g {...filter}>
        <rect x="1" y="2" width={s-2} height="3" {...common}/>
        <rect x="1" y="5.5" width={s-2} height="3" {...common}/>
        <rect x="1" y="9" width={s-2} height="3" {...common}/>
        <line x1="5" y1="2" x2="5" y2="5" {...common}/><line x1="9" y1="2" x2="9" y2="5" {...common}/>
        <line x1="3" y1="5.5" x2="3" y2="8.5" {...common}/><line x1="7" y1="5.5" x2="7" y2="8.5" {...common}/><line x1="11" y1="5.5" x2="11" y2="8.5" {...common}/>
        <line x1="5" y1="9" x2="5" y2="12" {...common}/><line x1="9" y1="9" x2="9" y2="12" {...common}/>
      </g>;
    case 'mobile':
      return <g {...filter}>
        <rect x="3.5" y="1" width="7" height={s-2} rx="1.2" {...common}/>
        <line x1="6" y1={s-2.5} x2="8" y2={s-2.5} {...common}/>
      </g>;
    default:
      return <rect x="2" y="2" width={s-4} height={s-4} {...common}/>;
  }
}

// ---------- sleekKindBody ----------

function sleekKindBody(node, { fill, stroke, strokeW, ink, muted, accent, active }) {
  const { w, h } = node;
  const card = (rx = 10) => <rect width={w} height={h} rx={rx} fill={fill} stroke={stroke} strokeWidth={strokeW}/>;
  const centerLabel = (dy = 0) => (
    <text x={w/2} y={h/2 + 4 + dy} textAnchor="middle"
      fontFamily="Inter Tight" fontWeight={600} fontSize={13} fill={ink}>{node.label}</text>
  );

  switch (node.kind) {
    case 'service': {
      return {
        body: card(10),
        decor: (
          <g>
            <rect x={8} y={8} width={16} height={16} rx={4} fill={active ? accent : '#faf3dc'} stroke={active ? accent : '#e4decd'} strokeWidth=".8"/>
            <line x1={11} y1={16} x2={21} y2={16} stroke={active ? '#7a5a00' : muted} strokeWidth="1.3" strokeLinecap="round"/>
            <line x1={11} y1={19} x2={18} y2={19} stroke={active ? '#7a5a00' : muted} strokeWidth="1.3" strokeLinecap="round"/>
          </g>
        ),
        label: centerLabel(),
      };
    }
    case 'store': {
      const ry = 6;
      return {
        noShadow: true,
        body: (
          <g>
            <path d={`M0 ${ry} a${w/2} ${ry} 0 1 0 ${w} 0 a${w/2} ${ry} 0 1 0 ${-w} 0 M0 ${ry} V${h-ry} a${w/2} ${ry} 0 0 0 ${w} 0 V${ry}`}
              fill={fill} stroke={stroke} strokeWidth={strokeW}/>
            <path d={`M0 ${ry} a${w/2} ${ry} 0 1 0 ${w} 0 a${w/2} ${ry} 0 1 0 ${-w} 0`}
              fill={active ? '#fffbea' : '#fff'} stroke={stroke} strokeWidth={strokeW}/>
          </g>
        ),
        decor: (
          <g>
            {[1,2,3].map(i => (
              <path key={i} d={`M4 ${ry + i * 9} a${w/2-4} ${ry*0.5} 0 0 0 ${w-8} 0`}
                stroke={active ? accent : '#e4decd'} strokeWidth=".8" fill="none"/>
            ))}
          </g>
        ),
        label: (
          <text x={w/2} y={h/2 + ry + 4} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={13} fill={ink}>{node.label}</text>
        ),
      };
    }
    case 'cache': {
      return {
        body: card(10),
        decor: (
          <g>
            <circle cx={w/2} cy={h/2} r={Math.min(w,h)/2 - 8} fill="none" stroke={active ? accent : '#e4decd'} strokeWidth=".8" strokeDasharray="3 2"/>
            <circle cx={w/2} cy={h/2} r={4} fill={active ? accent : '#d9c98b'}/>
          </g>
        ),
        label: centerLabel(),
      };
    }
    case 'queue': {
      const pw = (w - 24) / 3;
      return {
        body: card(10),
        decor: (
          <g>
            {[0,1,2].map(i => (
              <rect key={i} x={10 + i*(pw+2)} y={h/2 - 8} width={pw} height={16} rx={4}
                fill={active && i === 2 ? accent : '#faf3dc'} stroke={active ? accent : '#e4decd'} strokeWidth=".8"/>
            ))}
            <path d={`M${w-14} ${h/2-5} L${w-6} ${h/2} L${w-14} ${h/2+5}`}
              stroke={active ? '#7a5a00' : muted} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </g>
        ),
        label: (
          <text x={w/2} y={h/2 - 16} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={12} fill={ink}>{node.label}</text>
        ),
      };
    }
    case 'actor': {
      return {
        body: card(10),
        decor: (
          <g>
            <circle cx={w/2} cy={h/2 - 10} r={7} fill={active ? '#fef3c7' : '#f5f0e8'} stroke={active ? accent : '#e4decd'} strokeWidth="1"/>
            <path d={`M${w/2-12} ${h/2+8} Q${w/2} ${h/2-2} ${w/2+12} ${h/2+8}`}
              fill={active ? '#fef3c7' : '#f5f0e8'} stroke={active ? accent : '#e4decd'} strokeWidth="1"/>
          </g>
        ),
        label: (
          <text x={w/2} y={h - 8} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={12} fill={ink}>{node.label}</text>
        ),
      };
    }
    case 'gateway': {
      const i = Math.min(w * 0.18, 18);
      return {
        body: (
          <path d={`M${i} 0 L${w-i} 0 L${w} ${h/2} L${w-i} ${h} L${i} ${h} L0 ${h/2} Z`}
            fill={fill} stroke={stroke} strokeWidth={strokeW}/>
        ),
        decor: (
          <g>
            {[{cx: w/2, cy: h/2, r: 5}, {cx: w/2-10, cy: h/2, r: 3}, {cx: w/2+10, cy: h/2, r: 3}].map((c, j) => (
              <circle key={j} cx={c.cx} cy={c.cy} r={c.r} fill={active ? accent : '#e4decd'}/>
            ))}
          </g>
        ),
        label: centerLabel(),
      };
    }
    case 'external': {
      const d = `M${w*0.18} ${h*0.6} C ${w*0.02} ${h*0.6}, ${w*0.02} ${h*0.2}, ${w*0.22} ${h*0.25} C ${w*0.28} ${h*0.02}, ${w*0.58} ${h*0.02}, ${w*0.62} ${h*0.22} C ${w*0.85} ${h*0.15}, ${w*0.98} ${h*0.35}, ${w*0.9} ${h*0.6} C ${w*0.98} ${h*0.82}, ${w*0.75} ${h*0.98}, ${w*0.6} ${h*0.88} C ${w*0.4} ${h*1.02}, ${w*0.1} ${h*0.95}, ${w*0.18} ${h*0.6} Z`;
      return {
        body: <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeW}/>,
        decor: null,
        label: (
          <text x={w/2} y={h*0.6} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={12.5} fill={ink}>{node.label}</text>
        ),
      };
    }
    case 'boundary': {
      return {
        body: <rect width={w} height={h} rx={14} fill="transparent" stroke={active ? accent : '#d9c98b'} strokeWidth={1.5} strokeDasharray="8 5"/>,
        decor: null,
        label: (
          <text x={16} y={22} fontFamily="Inter Tight" fontWeight={600} fontSize={12}
            fill={active ? '#7a5a00' : muted} letterSpacing=".05em">{node.label.toUpperCase()}</text>
        ),
      };
    }
    case 'start': {
      return {
        body: <rect width={w} height={h} rx={h/2} fill={active ? '#fef3c7' : '#26231d'} stroke={active ? accent : '#26231d'} strokeWidth={strokeW}/>,
        decor: null,
        label: (
          <text x={w/2} y={h/2 + 4.5} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={13} fill={active ? '#7a5a00' : '#fff'}>{node.label}</text>
        ),
      };
    }
    case 'stop': {
      return {
        body: (
          <rect width={w} height={h} rx={h/2} fill={active ? '#fef3c7' : '#fdecec'}
            stroke={active ? accent : '#ecc7c7'} strokeWidth={strokeW}/>
        ),
        decor: (
          <g>
            <circle cx={18} cy={h/2} r="8" fill={active ? accent : '#d57a7a'}/>
            <rect x={18-3.5} y={h/2-3.5} width="7" height="7" rx="1" fill="#fff"/>
          </g>
        ),
        label: (
          <text x={w/2 + 6} y={h/2 + 4.5} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={13} fill={ink}>{node.label}</text>
        ),
      };
    }
    case 'decision': {
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
    case 'event': {
      const r = Math.min(w, h)/2 - 2;
      return {
        body: (
          <circle cx={w/2} cy={h/2} r={r}
            fill={active ? '#fef3c7' : '#fdf8e4'} stroke={active ? accent : '#d9c98b'} strokeWidth={strokeW}/>
        ),
        decor: (
          <path d={`M ${w/2+2} ${h/2-8} L ${w/2-4} ${h/2+1} H ${w/2} L ${w/2-2} ${h/2+8} L ${w/2+4} ${h/2-1} H ${w/2} Z`}
            fill={active ? '#7a5a00' : '#b79414'}/>
        ),
        label: (
          <text x={w/2} y={h+14} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={12.5} fill={ink}>{node.label}</text>
        ),
      };
    }
    case 'function': {
      return {
        body: card(12),
        decor: (
          <g>
            <rect x={1} y={1} width={w-2} height={4} rx={2} fill={active ? accent : '#e4decd'}/>
            <g transform={`translate(${w-26} 8)`}>
              <rect width="20" height="14" rx="3" fill={active ? '#fef3c7' : '#faf3dc'} stroke={active ? accent : '#d9c98b'} strokeWidth=".8"/>
              <text x="10" y="11" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize="10" fill={active ? '#7a5a00' : muted}>λ</text>
            </g>
          </g>
        ),
        label: centerLabel(),
      };
    }
    case 'worker': {
      return {
        body: card(10),
        decor: (
          <g>
            <g transform={`translate(${w-22} 10)`} stroke={active ? '#7a5a00' : muted} strokeWidth="1.1" fill="none">
              <circle cx="6" cy="6" r="3.6"/>
              <circle cx="6" cy="6" r="1.2" fill={active ? '#7a5a00' : muted}/>
              {[0,45,90,135,180,225,270,315].map(a => <line key={a} x1="6" y1="1.5" x2="6" y2="2.5" transform={`rotate(${a} 6 6)`}/>)}
            </g>
            <g transform={`translate(12 ${h-12})`}>
              {[0,1,2].map(i => <circle key={i} cx={i*7} cy="0" r="2" fill={active ? accent : '#d9c98b'} opacity={1 - i*0.25}/>)}
            </g>
          </g>
        ),
        label: centerLabel(-2),
      };
    }
    case 'loadbalancer': {
      return {
        body: card(10),
        decor: (
          <g transform={`translate(${w-30} ${h/2})`} stroke={active ? '#7a5a00' : muted} strokeWidth="1.3" fill="none" strokeLinecap="round">
            <circle cx="0" cy="0" r="3" fill={active ? accent : '#fbf6e7'}/>
            <line x1="3" y1="0" x2="14" y2="-7"/>
            <line x1="3" y1="0" x2="16" y2="0"/>
            <line x1="3" y1="0" x2="14" y2="7"/>
            <circle cx="14" cy="-7" r="1.5" fill={active ? '#7a5a00' : muted}/>
            <circle cx="16" cy="0" r="1.5" fill={active ? '#7a5a00' : muted}/>
            <circle cx="14" cy="7" r="1.5" fill={active ? '#7a5a00' : muted}/>
          </g>
        ),
        label: centerLabel(),
      };
    }
    case 'auth': {
      const r = Math.min(w * 0.18, 14);
      const d = `M${r} 0 H${w-r} Q${w} 0 ${w} ${r} V${h*0.55} Q${w} ${h*0.85} ${w/2} ${h} Q0 ${h*0.85} 0 ${h*0.55} V${r} Q0 0 ${r} 0 Z`;
      return {
        body: <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeW}/>,
        decor: (
          <g transform={`translate(${w/2} ${h*0.34})`} stroke={active ? '#7a5a00' : muted} strokeWidth="1.4" fill="none">
            <rect x="-4" y="-1" width="8" height="7" rx="1.2" fill={active ? '#fef3c7' : '#faf3dc'}/>
            <path d="M-2.5 -1 V-3.5 Q0 -5.5 2.5 -3.5 V-1"/>
          </g>
        ),
        label: (
          <text x={w/2} y={h*0.74} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={12.5} fill={ink}>{node.label}</text>
        ),
      };
    }
    case 'monitor': {
      return {
        body: card(10),
        decor: (
          <g transform={`translate(10 ${h/2 - 6})`}>
            <rect width={w-20} height="24" rx="3" fill={active ? '#fef3c7' : '#faf3dc'} stroke={active ? accent : '#d9c98b'} strokeWidth=".7"/>
            <polyline points={`4,18 ${(w-20)*0.25},10 ${(w-20)*0.45},14 ${(w-20)*0.7},6 ${w-24},12`}
              fill="none" stroke={active ? '#7a5a00' : muted} strokeWidth="1.4"/>
          </g>
        ),
        label: (
          <text x={w/2} y={14} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={12.5} fill={ink}>{node.label}</text>
        ),
      };
    }
    case 'bus': {
      return {
        body: card(10),
        decor: (
          <g>
            <rect x={10} y={h/2-4} width={w-20} height="8" rx="3"
              fill={active ? accent : '#e8deb5'} stroke={active ? '#7a5a00' : '#b79414'} strokeWidth=".7"/>
            {[0.2,0.5,0.8].map((p, i) => (
              <g key={i} transform={`translate(${10+(w-20)*p} ${h/2})`}>
                <line x1="0" y1="-4" x2="0" y2="-9" stroke={active ? '#7a5a00' : muted} strokeWidth="1"/>
                <circle cx="0" cy="-11" r="2" fill={active ? '#7a5a00' : muted}/>
                <line x1="0" y1="4" x2="0" y2="9" stroke={active ? '#7a5a00' : muted} strokeWidth="1"/>
                <circle cx="0" cy="11" r="2" fill={active ? '#7a5a00' : muted}/>
              </g>
            ))}
          </g>
        ),
        label: (
          <text x={w/2} y={14} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={12.5} fill={ink}>{node.label}</text>
        ),
      };
    }
    case 'stream': {
      return {
        body: card(10),
        decor: (
          <g>
            {[0,1,2].map(row => (
              <path key={row}
                d={`M10 ${20+row*10} Q ${(w-20)*0.25+10} ${14+row*10}, ${(w-20)*0.5+10} ${20+row*10} T ${w-10} ${20+row*10}`}
                fill="none" stroke={active ? (row===0 ? accent : '#e0c870') : (row===0 ? '#b79414' : '#d9c98b')}
                strokeWidth={row===0 ? '1.6' : '1'} strokeLinecap="round" opacity={1-row*0.25}>
                {active && row===0 && (
                  <animate attributeName="d"
                    values={`M10 ${20} Q ${(w-20)*0.25+10} ${14}, ${(w-20)*0.5+10} ${20} T ${w-10} ${20};M10 ${20} Q ${(w-20)*0.25+10} ${26}, ${(w-20)*0.5+10} ${20} T ${w-10} ${20};M10 ${20} Q ${(w-20)*0.25+10} ${14}, ${(w-20)*0.5+10} ${20} T ${w-10} ${20}`}
                    dur="2s" repeatCount="indefinite"/>
                )}
              </path>
            ))}
          </g>
        ),
        label: (
          <text x={w/2} y={14} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={12.5} fill={ink}>{node.label}</text>
        ),
      };
    }
    case 'firewall': {
      return {
        body: card(10),
        decor: (
          <g stroke={active ? '#7a5a00' : muted} strokeWidth=".7" fill="none">
            {[0,1,2].map(row => {
              const y = 22 + row * 8;
              const offset = row % 2 === 0 ? 0 : (w-20)/4;
              return (
                <g key={row}>
                  <line x1={10} y1={y} x2={w-10} y2={y}/>
                  {[0,1,2,3].map(c => <line key={c} x1={10+offset+c*(w-20)/2} y1={y-8} x2={10+offset+c*(w-20)/2} y2={y}/>)}
                </g>
              );
            })}
          </g>
        ),
        label: (
          <text x={w/2} y={14} textAnchor="middle"
            fontFamily="Inter Tight" fontWeight={600} fontSize={12} fill={ink}>{node.label}</text>
        ),
      };
    }
    case 'mobile': {
      const pw = Math.min(w*0.45, 44), ph = h - 12;
      const px = (w - pw) / 2, py = 6;
      return {
        body: (
          <g>
            <rect width={w} height={h} rx={12} fill="transparent"/>
            <rect x={px} y={py} width={pw} height={ph} rx="6" fill={fill} stroke={stroke} strokeWidth={strokeW}/>
            <rect x={px+4} y={py+8} width={pw-8} height={ph-16} rx="2" fill={active ? '#fef3c7' : '#faf3dc'}/>
          </g>
        ),
        decor: (
          <g>
            <circle cx={w/2} cy={py+4} r="1" fill={muted}/>
            <rect x={w/2-4} y={py+ph-4} width="8" height="1.5" rx=".5" fill={muted}/>
          </g>
        ),
        label: (
          <text x={px-4} y={h/2+4} textAnchor="end"
            fontFamily="Inter Tight" fontWeight={600} fontSize={12.5} fill={ink}>{node.label}</text>
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
export const SleekStyle = {
  id: 'sleek', name: 'Sleek', tagline: 'Soft whites, yellow accent, calm.',
  tokens: { bg: '#fffcf3', ink: '#26231d', muted: '#8f8779', accent: '#f5c518', line: '#e4decd' },
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
      <marker id="sleek-arrow-err" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="#c0392b"/>
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
    const ink = '#26231d', muted = '#8f8779';
    const fill = active ? 'url(#sleek-node-a)' : 'url(#sleek-node)';
    const stroke = active ? '#f5c518' : '#e4decd';
    const strokeW = active ? 1.5 : 1;
    const shape = shapeOf(node);
    const useKind = !node.shape && node.kind && !hasMedia(node);
    const kindBody = useKind ? sleekKindBody(node, { fill, stroke, strokeW, ink, muted, accent: '#f5c518', active }) : null;
    return (
      <g transform={`translate(${node.x} ${node.y})`}>
        {active && shape !== 'cylinder' && (
          <rect x={-10} y={-10} width={node.w+20} height={node.h+20} rx={18} fill="url(#sleek-glow)"/>
        )}
        {kindBody ? (
          <g filter={kindBody.noShadow ? undefined : 'url(#sleek-soft)'}>{kindBody.body}</g>
        ) : (
          <g filter="url(#sleek-soft)">
            <ShapeShell node={node} fill={fill} stroke={stroke} strokeWidth={strokeW}/>
          </g>
        )}
        {kindBody && kindBody.decor}
        <NodeImageOrIcon node={node} />
        {kindBody && kindBody.label !== undefined ? kindBody.label : (
          <NodeLabel node={node} fill={ink} sub={node.sub} subFill={muted}/>
        )}
      </g>
    );
  },
  Edge: ({ edge, active }) => {
    const kind = edge.kind || 'solid';
    const isDashed = kind === 'dashed', isDotted = kind === 'dotted', isBold = kind === 'bold';
    const isAsync = kind === 'async', isBidir = kind === 'bidir', isError = kind === 'error';
    const isSecure = kind === 'secure', isRealtime = kind === 'realtime';
    const errorColor = '#c0392b', secureColor = '#3a6b3a';
    const baseStroke = isError ? errorColor : isSecure ? secureColor : (active ? '#f5c518' : '#b8b0a1');
    const dashAttr = isDashed ? '5 4' : isDotted ? '1 5' : isAsync ? '8 4 1 4' : isRealtime ? '6 3' : undefined;
    const sw = edgeStrokeWidth(edge, isBold ? (active ? 3 : 2.4) : (active ? 2 : 1.4));
    const mid = edgeMidpoint(edge.points);
    const arrowEnd = isError ? 'url(#sleek-arrow-err)' : active ? 'url(#sleek-arrow-a)' : 'url(#sleek-arrow)';
    const arrowStart = isBidir ? (active ? 'url(#sleek-arrow-a)' : 'url(#sleek-arrow)') : undefined;
    return (
      <g>
        {isBold && <path d={edge.d} fill="none" stroke={baseStroke} opacity=".18" strokeWidth={sw+6} strokeLinecap="round" strokeLinejoin="round"/>}
        {isRealtime && <path d={edge.d} fill="none" stroke="#f5c518" opacity=".35" strokeWidth={sw+3} strokeLinecap="round" strokeLinejoin="round"/>}
        <path d={edge.d} fill="none" stroke={isRealtime ? '#b8860b' : baseStroke}
          strokeWidth={sw} strokeDasharray={dashAttr} strokeLinecap={isDotted ? 'round' : 'butt'}
          markerEnd={arrowEnd} markerStart={arrowStart} strokeLinejoin="round">
          {isRealtime && <animate attributeName="stroke-dashoffset" from="0" to="-18" dur=".5s" repeatCount="indefinite"/>}
        </path>
        {active && !isRealtime && (
          <circle r="3.5" fill={isError ? errorColor : '#f5c518'}>
            <animateMotion dur="1.4s" repeatCount="indefinite" path={edge.d} rotate="auto"/>
          </circle>
        )}
        {isSecure && (
          <g transform={`translate(${mid.x} ${mid.y-14})`}>
            <rect x="-7" y="-8" width="14" height="13" rx="2.5" fill="#fffcf3" stroke={secureColor} strokeWidth="1"/>
            <rect x="-3" y="-3" width="6" height="6" rx=".8" fill={secureColor}/>
            <path d="M-2 -3 V-5 Q0 -7 2 -5 V-3" fill="none" stroke={secureColor} strokeWidth="1"/>
          </g>
        )}
        {isError && (
          <g transform={`translate(${mid.x} ${mid.y-12})`} stroke={errorColor} strokeWidth="1.4" fill="#fffcf3">
            <circle r="6"/>
            <line x1="-3" y1="-3" x2="3" y2="3"/><line x1="3" y1="-3" x2="-3" y2="3"/>
          </g>
        )}
        <EdgeLabel text={edge.label} x={mid.x} y={mid.y} bg="#fffcf3"
          fg={isError ? errorColor : isSecure ? secureColor : active ? '#7a5a00' : '#8f8779'} mono/>
      </g>
    );
  },
};

// ===========================================================
// SKETCH
// ===========================================================
export const SketchStyle = {
  id: 'sketch', name: 'Sketch', tagline: 'Like a whiteboard photo — warm and honest.',
  tokens: { bg: '#fbf7ec', ink: '#2b2a26', muted: '#5a5148', accent: '#d97757', line: '#3a362d' },
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
        <line key={i} x1="0" x2={w} y1={i*28+14} y2={i*28+14}
          stroke="#ded6c2" strokeWidth=".6" strokeDasharray="2 3"/>
      ))}
    </g>
  ),
  Node: ({ node, active }) => {
    const seed = node.id.charCodeAt(0) + node.id.length;
    const jitter = (n) => ((seed * (n+1)) % 7) * 0.35 - 1;
    const ink = active ? '#d97757' : '#2b2a26';
    const fill = active ? '#fce7d6' : '#ffffff';
    const shape = shapeOf(node);
    const media = hasMedia(node);
    return (
      <g transform={`translate(${node.x} ${node.y})`}>
        <g transform={`translate(${jitter(0)} ${jitter(1)+3})`} opacity=".55">
          <ShapeShell node={node} fill="#f0e9d6" stroke="none" strokeWidth={0}/>
        </g>
        <g filter="url(#sk-rough)">
          <ShapeShell node={node} fill={fill} stroke={ink} strokeWidth={1.8}/>
        </g>
        <g filter="url(#sk-rough)" opacity=".5">
          <ShapeShell node={node} fill="none" stroke={ink} strokeWidth={1}/>
        </g>
        <NodeImageOrIcon node={node} />
        {!media && !['diamond','circle','oval','pill'].includes(shape) && (
          <g transform="translate(12, 10)"><NodeIcon kind={node.kind} color={ink} sketchy/></g>
        )}
        {!media && ['diamond','circle','oval','pill'].includes(shape) && (
          <g transform={`translate(${node.w/2-7} ${node.h/2-18})`}><NodeIcon kind={node.kind} color={ink} sketchy/></g>
        )}
        <NodeLabel node={node} fill={ink} sub={node.sub} subFill="#5a5148"
          fontFamily="Caveat" fontWeight={600} fontSize={18} hand
          centerOffsetY={['diamond','circle','oval','pill'].includes(shape) ? 8 : 0}/>
      </g>
    );
  },
  Edge: ({ edge, active }) => {
    const kind = edge.kind || 'solid';
    const isDashed = kind === 'dashed', isDotted = kind === 'dotted', isBold = kind === 'bold';
    const isAsync = kind === 'async', isBidir = kind === 'bidir', isError = kind === 'error';
    const isSecure = kind === 'secure', isRealtime = kind === 'realtime';
    const errorColor = '#c14a3a', secureColor = '#3d6b3d';
    const baseStroke = isError ? errorColor : isSecure ? secureColor : (active ? '#d97757' : '#3a362d');
    const dashAttr = isDashed ? '6 5' : isDotted ? '1.5 5' : isAsync ? '9 4 1.5 4' : isRealtime ? '7 4' : undefined;
    const sw = edgeStrokeWidth(edge, isBold ? (active ? 3 : 2.6) : (active ? 2.2 : 1.5));
    const d1 = roughPath(edge.points, 1.6, edge.id.charCodeAt(0) * 7);
    const d2 = roughPath(edge.points, 1.2, edge.id.charCodeAt(0) * 13 + 1);
    const mid = edgeMidpoint(edge.points);
    return (
      <g>
        {isRealtime && <path d={d1} fill="none" stroke="#d97757" opacity=".25" strokeWidth={sw+3} strokeLinecap="round" filter="url(#sk-rough)"/>}
        <path d={d1} fill="none" stroke={isRealtime ? '#b85a3a' : baseStroke} strokeWidth={sw}
          strokeDasharray={dashAttr} strokeLinecap="round"
          markerEnd={active ? 'url(#sk-arrow-a)' : 'url(#sk-arrow)'}
          markerStart={isBidir ? (active ? 'url(#sk-arrow-a)' : 'url(#sk-arrow)') : undefined}
          filter="url(#sk-rough)">
          {isRealtime && <animate attributeName="stroke-dashoffset" from="0" to="-22" dur=".55s" repeatCount="indefinite"/>}
        </path>
        <path d={d2} fill="none" stroke={baseStroke} strokeWidth={isBold ? 1.4 : .7}
          strokeDasharray={dashAttr} opacity=".4" strokeLinecap="round"/>
        {active && !isRealtime && (
          <circle r="4" fill={isError ? errorColor : '#d97757'} stroke="#fbf7ec" strokeWidth="1.5">
            <animateMotion dur="1.6s" repeatCount="indefinite" path={edge.d} rotate="auto"/>
          </circle>
        )}
        {isSecure && (
          <g transform={`translate(${mid.x} ${mid.y-14}) rotate(-2)`} fill="#fbf7ec" stroke={secureColor} strokeWidth="1.4" filter="url(#sk-rough)">
            <rect x="-7" y="-7" width="14" height="13" rx="2"/>
            <path d="M-2.5 -7 V-10 Q0 -12 2.5 -10 V-7" fill="none"/>
          </g>
        )}
        {isError && (
          <g transform={`translate(${mid.x} ${mid.y-13}) rotate(-3)`} stroke={errorColor} strokeWidth="1.6" fill="#fbf7ec" filter="url(#sk-rough)">
            <circle r="7"/>
            <line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5"/><line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5"/>
          </g>
        )}
        {edge.label && (
          <g transform={`translate(${mid.x} ${mid.y-2}) rotate(-3)`}>
            <rect x={-edge.label.length*4.5-4} y={-10} width={edge.label.length*9+8} height={18} rx={3} fill="#fbf7ec"/>
            <text textAnchor="middle" dominantBaseline="middle" fontFamily="Caveat" fontSize="15"
              fill={isError ? errorColor : isSecure ? secureColor : active ? '#d97757' : '#5a5148'}>{edge.label}</text>
          </g>
        )}
      </g>
    );
  },
};

// ===========================================================
// ISO
// ===========================================================
export const IsoStyle = {
  id: 'iso', name: 'Iso', tagline: 'Flat isometric with pipe-style edges.',
  tokens: { bg: '#f3f4f6', ink: '#1e293b', muted: '#64748b', accent: '#f5c518', line: '#cbd5e1' },
  Defs: () => (
    <defs>
      <linearGradient id="iso-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#eef1f6"/></linearGradient>
      <linearGradient id="iso-top-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe28a"/><stop offset="1" stopColor="#f5c518"/></linearGradient>
      <linearGradient id="iso-right" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#dde2ea"/><stop offset="1" stopColor="#c7cfda"/></linearGradient>
      <linearGradient id="iso-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e7ebf1"/><stop offset="1" stopColor="#d2d8e1"/></linearGradient>
      <linearGradient id="iso-pipe" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2563eb"/><stop offset="1" stopColor="#60a5fa"/></linearGradient>
      <linearGradient id="iso-pipe-a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#f59e0b"/><stop offset="1" stopColor="#fde68a"/></linearGradient>
      <linearGradient id="iso-pipe-err" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#b91c1c"/><stop offset="1" stopColor="#ef4444"/></linearGradient>
      <linearGradient id="iso-pipe-sec" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#15803d"/><stop offset="1" stopColor="#4ade80"/></linearGradient>
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
    const topFill = active ? 'url(#iso-top-a)' : 'url(#iso-top)';
    const media = hasMedia(node);
    return (
      <g transform={`translate(${node.x} ${node.y})`}>
        <ellipse cx={w/2+4} cy={h+depth+6} rx={w*.4} ry="3.5" fill="#000" opacity=".07"/>
        {(shape === 'rect' || shape === 'square') && (
          <>
            <path d={`M 0 ${h} L ${w} ${h} L ${w} ${h+depth} L 0 ${h+depth} Z`} fill="url(#iso-front)" stroke="#c7cfda" strokeWidth=".8"/>
            <path d={`M ${w} 0 L ${w+depth*0.6} ${-depth*0.5} L ${w+depth*0.6} ${h-depth*0.5} L ${w} ${h} Z`} fill="url(#iso-right)" stroke="#c7cfda" strokeWidth=".8"/>
          </>
        )}
        <ShapeShell node={node} fill={topFill} stroke={active ? '#f59e0b' : '#cfd6e0'} strokeWidth={1}/>
        <NodeImageOrIcon node={node} />
        {!media && !['diamond','circle','oval','pill'].includes(shape) && (
          <g transform="translate(10, 8)"><NodeIcon kind={node.kind} color={active ? '#7a5a00' : '#475569'}/></g>
        )}
        {!media && ['diamond','circle','oval','pill'].includes(shape) && (
          <g transform={`translate(${w/2-7} ${h/2-18})`}><NodeIcon kind={node.kind} color={active ? '#7a5a00' : '#475569'}/></g>
        )}
        <NodeLabel node={node} fill={active ? '#3a2a00' : '#1e293b'} sub={node.sub}
          subFill={active ? '#7a5a00' : '#64748b'} fontSize={12.5}
          centerOffsetY={['diamond','circle','oval','pill'].includes(shape) ? 8 : 0}/>
      </g>
    );
  },
  Edge: ({ edge, active }) => {
    const kind = edge.kind || 'solid';
    const isDashed = kind === 'dashed', isDotted = kind === 'dotted', isBold = kind === 'bold';
    const isAsync = kind === 'async', isBidir = kind === 'bidir', isError = kind === 'error';
    const isSecure = kind === 'secure', isRealtime = kind === 'realtime';
    const mid = edgeMidpoint(edge.points);
    const stroke = isError ? 'url(#iso-pipe-err)' : isSecure ? 'url(#iso-pipe-sec)' : (active ? 'url(#iso-pipe-a)' : 'url(#iso-pipe)');
    const dashAttr = isDashed ? '10 6' : isDotted ? '2 7' : isAsync ? '12 5 2 5' : isRealtime ? '8 5' : undefined;
    const sw = edgeStrokeWidth(edge, isBold ? (active ? 8 : 6) : (active ? 6 : 4));
    const labelFg = isError ? '#7a1a1a' : isSecure ? '#1f4d1f' : active ? '#7a5a00' : '#475569';
    return (
      <g>
        <path d={edge.d} fill="none" stroke="rgba(0,0,0,.08)" strokeWidth={sw+2} transform="translate(1,2)" strokeLinecap="round" strokeLinejoin="round"/>
        {isRealtime && <path d={edge.d} fill="none" stroke="#f59e0b" opacity=".35" strokeWidth={sw+4} strokeLinecap="round" strokeLinejoin="round"/>}
        <path d={edge.d} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashAttr}>
          {isRealtime && <animate attributeName="stroke-dashoffset" from="0" to="-26" dur=".6s" repeatCount="indefinite"/>}
        </path>
        {active && !isRealtime && (
          <circle r="3" fill="#fff">
            <animateMotion dur="1.4s" repeatCount="indefinite" path={edge.d} rotate="auto"/>
          </circle>
        )}
        {isBidir && (
          <circle r="3" fill="#fff">
            <animateMotion dur="1.6s" repeatCount="indefinite" path={edge.d} rotate="auto" keyPoints="1;0" keyTimes="0;1"/>
          </circle>
        )}
        {isSecure && (
          <g transform={`translate(${mid.x} ${mid.y-14})`}>
            <rect x="-8" y="-9" width="16" height="14" rx="3" fill="#fff" stroke="#1f4d1f" strokeWidth="1.2"/>
            <rect x="-3" y="-3" width="6" height="6" rx=".8" fill="#1f4d1f"/>
            <path d="M-2.5 -3 V-6 Q0 -8 2.5 -6 V-3" fill="none" stroke="#1f4d1f" strokeWidth="1.2"/>
          </g>
        )}
        {isError && (
          <g transform={`translate(${mid.x} ${mid.y-14})`} stroke="#7a1a1a" strokeWidth="1.5" fill="#fff">
            <circle r="7"/>
            <line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5"/><line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5"/>
          </g>
        )}
        <EdgeLabel text={edge.label} x={mid.x} y={mid.y} bg="#f3f4f6" fg={labelFg} mono/>
      </g>
    );
  },
};

// ===========================================================
// BLUEPRINT
// ===========================================================
export const BlueprintStyle = {
  id: 'blueprint', name: 'Blueprint', tagline: 'Cyan on navy. Technical drawing.',
  tokens: { bg: '#0b2545', ink: '#e0fbfc', muted: '#8bb5d4', accent: '#ffd166', line: '#3b82a0' },
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
    const stroke = active ? '#ffd166' : '#80d0e0';
    const shape = shapeOf(node);
    const media = hasMedia(node);
    return (
      <g transform={`translate(${node.x} ${node.y})`}>
        <ShapeShell node={node} fill="none" stroke={stroke}
          strokeWidth={active ? 1.6 : 1}
          strokeDasharray={node.kind === 'external' ? '4 3' : undefined}/>
        <NodeImageOrIcon node={node} />
        {!media && !['diamond','circle','oval','pill'].includes(shape) && (
          <g transform="translate(10, 8)"><NodeIcon kind={node.kind} color={stroke} mono/></g>
        )}
        {!media && ['diamond','circle','oval','pill'].includes(shape) && (
          <g transform={`translate(${node.w/2-7} ${node.h/2-18})`}><NodeIcon kind={node.kind} color={stroke} mono/></g>
        )}
        <g>
          <text x={node.w/2} y={node.h/2 + 4 + (['diamond','circle','oval','pill'].includes(shape) ? 8 : 0)}
            textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="600" fontSize="11"
            fill={active ? '#ffd166' : '#e0fbfc'} letterSpacing=".04em">
            {node.label.toUpperCase()}
          </text>
          {node.sub && (
            <text x={node.w/2} y={node.h-8} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="8.5" fill="#8bb5d4">{node.sub}</text>
          )}
        </g>
      </g>
    );
  },
  Edge: ({ edge, active }) => {
    const kind = edge.kind || 'solid';
    const isDashed = kind === 'dashed', isDotted = kind === 'dotted', isBold = kind === 'bold';
    const isAsync = kind === 'async', isBidir = kind === 'bidir', isError = kind === 'error';
    const isSecure = kind === 'secure', isRealtime = kind === 'realtime';
    const errorColor = '#ff6b6b', secureColor = '#7eea9c';
    const stroke = isError ? errorColor : isSecure ? secureColor : (active ? '#ffd166' : '#80d0e0');
    const dashAttr = isDashed ? '4 3' : isDotted ? '1 4' : isAsync ? '7 3 1 3' : isRealtime ? '5 3' : undefined;
    const sw = edgeStrokeWidth(edge, isBold ? (active ? 2.2 : 1.8) : (active ? 1.4 : 1));
    const mid = edgeMidpoint(edge.points);
    const arrowEnd = active ? 'url(#bp-arrow-a)' : 'url(#bp-arrow)';
    return (
      <g>
        {isRealtime && <path d={edge.d} fill="none" stroke="#ffd166" opacity=".3" strokeWidth={sw+2.5}/>}
        <path d={edge.d} fill="none" stroke={isRealtime ? '#ffd166' : stroke}
          strokeWidth={sw} strokeDasharray={dashAttr} strokeLinecap={isDotted ? 'round' : 'butt'}
          markerEnd={arrowEnd} markerStart={isBidir ? arrowEnd : undefined}>
          {isRealtime && <animate attributeName="stroke-dashoffset" from="0" to="-16" dur=".5s" repeatCount="indefinite"/>}
        </path>
        {active && !isRealtime && (
          <circle r="2.5" fill={isError ? errorColor : '#ffd166'}>
            <animateMotion dur="1.5s" repeatCount="indefinite" path={edge.d} rotate="auto"/>
          </circle>
        )}
        {isSecure && (
          <g transform={`translate(${mid.x} ${mid.y-13})`} fill="#0b2545" stroke={secureColor} strokeWidth="1">
            <rect x="-6" y="-7" width="12" height="11" rx="1.5"/>
            <path d="M-2 -7 V-9.5 Q0 -11 2 -9.5 V-7" fill="none"/>
          </g>
        )}
        {isError && (
          <g transform={`translate(${mid.x} ${mid.y-12})`} stroke={errorColor} strokeWidth="1.2" fill="#0b2545">
            <circle r="6"/>
            <line x1="-3" y1="-3" x2="3" y2="3"/><line x1="3" y1="-3" x2="-3" y2="3"/>
          </g>
        )}
        {edge.label && (
          <g transform={`translate(${mid.x} ${mid.y})`}>
            <rect x={-edge.label.length*3.3-4} y={-7} width={edge.label.length*6.6+8} height={14}
              fill="#0b2545" stroke={stroke} strokeWidth=".5"/>
            <text textAnchor="middle" dominantBaseline="middle"
              fontFamily="JetBrains Mono" fontSize="9" fill={stroke} letterSpacing=".05em">
              {edge.label.toUpperCase()}
            </text>
          </g>
        )}
      </g>
    );
  },
};

// ===========================================================
// CITY — True Isometric 3D Map
// ===========================================================
export const CityStyle = {
  id: 'city', name: 'City', tagline: 'True 3D Map. City blocks, isometric projection.',
  tokens: { bg: '#F9FAFB', ink: '#0f172a', muted: '#64748b', accent: '#007AFF', line: '#D1D5DB' },
  isometric: true,
  Defs: () => (
    <defs>
      <radialGradient id="grid-fade" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="white" stopOpacity="1"/>
        <stop offset="100%" stopColor="white" stopOpacity="0"/>
      </radialGradient>
      <mask id="grid-fade-mask">
        <rect x="-2000" y="-2000" width="6000" height="6000" fill="url(#grid-fade)"/>
      </mask>
      <pattern id="clay-iso-grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#EEEEEE" strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
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
      <linearGradient id="clay-top" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#fdfdfd"/>
      </linearGradient>
      <linearGradient id="clay-right" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#f2f2f2"/><stop offset="1" stopColor="#e0e0e0"/>
      </linearGradient>
      <linearGradient id="clay-front" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e0e0e0"/><stop offset="1" stopColor="#cccccc"/>
      </linearGradient>
      <linearGradient id="clay-wall-left" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#e4e4e7"/><stop offset="1" stopColor="#d4d4d8"/>
      </linearGradient>
      <linearGradient id="clay-wall-right" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#f4f4f5"/>
      </linearGradient>
      <linearGradient id="clay-pipe-cool" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#005bb5"/><stop offset=".5" stopColor="#4da6ff"/><stop offset="1" stopColor="#007AFF"/>
      </linearGradient>
      <linearGradient id="clay-pipe-warm" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#cc9300"/><stop offset=".5" stopColor="#ffdb4d"/><stop offset="1" stopColor="#FFB800"/>
      </linearGradient>
      <linearGradient id="clay-packet-warm" x1="1" y1="0.5" x2="0" y2="0.5">
        <stop offset="0%" stopColor="#FFBB0C" stopOpacity="1"/>
        <stop offset="50%" stopColor="#FFDD86" stopOpacity="0.6"/>
        <stop offset="100%" stopColor="#fef3c7" stopOpacity="0"/>
      </linearGradient>
      <linearGradient id="clay-packet-cool" x1="1" y1="0.5" x2="0" y2="0.5">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity="1"/>
        <stop offset="50%" stopColor="#93c5fd" stopOpacity="0.6"/>
        <stop offset="100%" stopColor="#dbeafe" stopOpacity="0"/>
      </linearGradient>
      <filter id="clay-packet-glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>
  ),
  Background: ({ w, h }) => (
    <rect width={w*2} height={h*2} x={-w/2} y={-h/2} fill="url(#clay-iso-grid)" mask="url(#grid-fade-mask)"/>
  ),
  Node: ({ node, active }) => {
    const { w, h } = node;
    const kind = node.kind;
    const isBoundary = kind === 'boundary';

    if (kind === 'store') {
      const r = Math.min(w, h) / 2;
      const cx = r, cy = h / 2, Z = 56, E = 1.225 * Z;
      const tan1 = { x: cx + r / Math.sqrt(2), y: cy + r / Math.sqrt(2) };
      const tan2 = { x: cx - r / Math.sqrt(2), y: cy - r / Math.sqrt(2) };
      const pSplit = { x: cx - r / Math.sqrt(2), y: cy + r / Math.sqrt(2) };
      return (
        <g transform={`translate(${node.x} ${node.y})`}>
          {active && (
            <ellipse cx={0} cy={cy} rx={r+8} ry={28} fill="none" stroke="#007AFF" strokeWidth="3" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite"/>
            </ellipse>
          )}
          <ellipse cx={cx+8} cy={cy+10} rx={r} ry={r*0.577} fill="rgba(0,0,0,0.35)" filter="url(#clay-ao)"/>
          <path d={`M ${tan2.x} ${tan2.y} L ${tan2.x+E} ${tan2.y-E} A ${r} ${r} 0 0 0 ${pSplit.x+E} ${pSplit.y-E} L ${pSplit.x} ${pSplit.y} A ${r} ${r} 0 0 1 ${tan2.x} ${tan2.y} Z`} fill="url(#clay-wall-left)"/>
          <path d={`M ${pSplit.x} ${pSplit.y} L ${pSplit.x+E} ${pSplit.y-E} A ${r} ${r} 0 0 0 ${tan1.x+E} ${tan1.y-E} L ${tan1.x} ${tan1.y} A ${r} ${r} 0 0 1 ${pSplit.x} ${pSplit.y} Z`} fill="url(#clay-wall-right)"/>
          {[0.33, 0.66].map((f, i) => (
            <path key={i} d={`M ${tan2.x+E*f} ${tan2.y-E*f} A ${r} ${r} 0 0 0 ${tan1.x+E*f} ${tan1.y-E*f}`}
              fill="none" stroke="#a1a1aa" strokeWidth="1" strokeDasharray="2 2" opacity="0.55"/>
          ))}
          <g transform={`translate(${E} ${-E})`}>
            <circle cx={cx} cy={cy} r={r} fill="url(#clay-top)" stroke="#e4e4e7" strokeWidth="1"/>
            <circle cx={cx} cy={cy} r={r-4} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="1"/>
            <g transform={`translate(${cx} ${cy})`}>
              <g transform="translate(-7 -16)"><NodeIcon kind="store" color="#475569" mono/></g>
              <text y={12} textAnchor="middle" fill="#334155" fontSize="14" fontWeight="600" fontFamily="Inter Tight">{node.label}</text>
              {node.sub && <text y={26} textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="JetBrains Mono">{node.sub}</text>}
            </g>
          </g>
          <g transform={`translate(${E*0.06} ${cy - E*0.06})`}>
            <rect x="-2" y="-10" width={E*0.08} height="20" rx="3" fill="#1e293b" transform="skewY(-45)"/>
            <rect x="-1" y="-8" width={E*0.04} height="16" rx="2" fill="#007AFF" filter="url(#clay-ao-sm)" transform="skewY(-45)"/>
          </g>
        </g>
      );
    }

    if (kind === 'gateway') {
      const i = Math.min(w * 0.14, 16);
      const Z = 42, E = 1.225 * Z;
      const p0={x:i,y:0}, p1={x:w-i,y:0}, p2={x:w,y:h/2}, p3={x:w-i,y:h}, p4={x:i,y:h}, p5={x:0,y:h/2};
      const t0={x:i+E,y:-E}, t1={x:w-i+E,y:-E}, t2={x:w+E,y:h/2-E}, t3={x:w-i+E,y:h-E}, t4={x:i+E,y:h-E}, t5={x:E,y:h/2-E};
      const poly = (pts) => pts.map(p => `${p.x},${p.y}`).join(' ');
      return (
        <g transform={`translate(${node.x} ${node.y})`}>
          <defs>
            <linearGradient id={`gw-wall-1-${node.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#cbd5e1"/><stop offset="1" stopColor="#94a3b8"/>
            </linearGradient>
            <linearGradient id={`gw-wall-2-${node.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e4e4e7"/><stop offset="1" stopColor="#d4d4d8"/>
            </linearGradient>
          </defs>
          {active && (
            <path d={`M ${poly([p0,p1,p2,p3,p4,p5])} Z`} fill="none" stroke="#007AFF" strokeWidth="3" opacity="0.6" transform="scale(1.05) translate(-2 1)">
              <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite"/>
            </path>
          )}
          <path d={`M ${poly([p0,p1,p2,p3,p4,p5])} Z`} fill="rgba(0,0,0,0.35)" filter="url(#clay-ao)"/>
          <path d={`M ${p0.x},${p0.y} L ${p5.x},${p5.y} L ${t5.x},${t5.y} L ${t0.x},${t0.y} Z`} fill={`url(#gw-wall-1-${node.id})`}/>
          <path d={`M ${p5.x},${p5.y} L ${p4.x},${p4.y} L ${t4.x},${t4.y} L ${t5.x},${t5.y} Z`} fill={`url(#gw-wall-2-${node.id})`}/>
          <path d={`M ${p4.x},${p4.y} L ${p3.x},${p3.y} L ${t3.x},${t3.y} L ${t4.x},${t4.y} Z`} fill="url(#clay-wall-right)"/>
          <g transform={`translate(${p5.x*0.7 + p4.x*0.3} ${p5.y*0.7 + p4.y*0.3})`}>
            <ellipse cx={E*0.2} cy={-E*0.2 - 8} rx="1.5" ry="3.5" fill="#fcd34d" filter="url(#clay-ao-sm)"/>
            <ellipse cx={E*0.2} cy={-E*0.2 + 8} rx="1.5" ry="3.5" fill="#f59e0b" filter="url(#clay-ao-sm)"/>
          </g>
          <g transform={`translate(${p5.x + E*0.06} ${p5.y - E*0.06})`}>
            <rect x="-2" y="-10" width={E*0.08} height="20" rx="3" fill="#1e293b" transform="skewY(-45)"/>
            <rect x="-1" y="-8" width={E*0.04} height="16" rx="2" fill="#007AFF" filter="url(#clay-ao-sm)" transform="skewY(-45)"/>
          </g>
          <path d={`M ${poly([t0,t1,t2,t3,t4,t5])} Z`} fill="url(#clay-top)" stroke="none"/>
          <path d={`M ${poly([t0,t1,t2,t3,t4,t5])} Z`} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="2.5" transform="scale(0.9) translate(4 2)" style={{pointerEvents:'none'}}/>
          <g transform={`translate(${w/2 + E} ${h/2 - E})`}>
            <g transform="translate(-7 -16)"><NodeIcon kind="gateway" color="#007AFF" mono/></g>
            <text y={12} textAnchor="middle" fill="#334155" fontSize="14" fontWeight="600" fontFamily="Inter Tight">{node.label}</text>
            {node.sub && <text y={26} textAnchor="middle" fill="#64748b" fontSize="11" fontFamily="JetBrains Mono">{node.sub}</text>}
          </g>
        </g>
      );
    }

    const Z = isBoundary ? 6 : (kind === 'client' || kind === 'actor' ? 32 : 42);
    const E = 1.225 * Z;
    const R = isBoundary ? 0 : 16;
    const topFill = isBoundary ? 'transparent' : 'url(#clay-top)';
    const wallStroke = isBoundary ? '#cbd5e1' : 'none';
    const layout = node.layout || 'center';
    const icons = node.icons || [node.kind];

    return (
      <g transform={`translate(${node.x} ${node.y})`}>
        <rect width={w} height={h} rx={R} fill={isBoundary ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.5)'} filter="url(#clay-ao)"/>
        {active && !isBoundary && (
          <rect width={w} height={h} rx={R} fill="none" stroke="#007AFF" strokeWidth="3" opacity="0.6" transform="scale(1.06) translate(-2 -2)">
            <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite"/>
          </rect>
        )}
        {isBoundary ? (
          <g>
            <path d={`M 0 0 L 0 ${h} L ${E} ${h-E} L ${E} ${-E} Z`} fill="transparent" stroke={wallStroke} strokeWidth={1} strokeLinejoin="round"/>
            <path d={`M 0 ${h} L ${w} ${h} L ${w+E} ${h-E} L ${E} ${h-E} Z`} fill="transparent" stroke={wallStroke} strokeWidth={1} strokeLinejoin="round"/>
          </g>
        ) : (
          <g>
            <defs>
              <linearGradient id={`corner-grad-${node.id}`} gradientUnits="userSpaceOnUse" x1={0} y1={h-R} x2={R} y2={h}>
                <stop offset="0" stopColor="#d4d4d8"/><stop offset="1" stopColor="#f4f4f5"/>
              </linearGradient>
            </defs>
            <path d={`M 0 ${R} L 0 ${h-R} L ${E} ${h-R-E} L ${E} ${R-E} Z`} fill="url(#clay-wall-left)"/>
            <path d={`M 0 ${h-R} A ${R} ${R} 0 0 0 ${R} ${h} L ${R+E} ${h-E} A ${R} ${R} 0 0 1 ${E} ${h-R-E} Z`} fill={`url(#corner-grad-${node.id})`}/>
            <path d={`M ${R} ${h} L ${w-R} ${h} L ${w-R+E} ${h-E} L ${R+E} ${h-E} Z`} fill="url(#clay-wall-right)"/>
            <path d={`M ${w-R} ${h} A ${R} ${R} 0 0 0 ${w} ${h-R} L ${w+E} ${h-R-E} A ${R} ${R} 0 0 1 ${w-R+E} ${h-E} Z`} fill="url(#clay-wall-right)"/>
            <path d={`M 0 ${R} A ${R} ${R} 0 0 1 ${R} 0 L ${R+E} ${-E} A ${R} ${R} 0 0 0 ${E} ${R-E} Z`} fill="url(#clay-wall-left)"/>
          </g>
        )}
        {!isBoundary && (
          <g>
            <g transform={`translate(${E*0.06} ${h/2 - E*0.06})`}>
              <rect x="-2" y="-10" width={E*0.08} height="20" rx="3" fill="#1e293b" transform="skewY(-45)"/>
              <rect x="-1" y="-8" width={E*0.04} height="16" rx="2" fill="#007AFF" filter="url(#clay-ao-sm)" transform="skewY(-45)"/>
            </g>
            <g transform={`translate(${w/2 + 2} ${h - 2})`}>
              <rect x="-10" y="-2" width="20" height={E*0.08} rx="3" fill="#1e293b" transform="skewX(-45)"/>
              <rect x="-8" y="-1" width="16" height={E*0.04} rx="2" fill="#007AFF" filter="url(#clay-ao-sm)" transform="skewX(-45)"/>
            </g>
          </g>
        )}
        <rect x={E} y={-E} width={w} height={h} rx={R} fill={topFill} stroke={isBoundary ? '#cbd5e1' : 'none'} strokeWidth={isBoundary ? 1 : 0}/>
        {!isBoundary && (
          <rect x={E+3} y={-E+3} width={w-6} height={h-6} rx={Math.max(2, R-3)} fill="transparent" stroke="rgba(0,0,0,0.06)" strokeWidth="2"/>
        )}
        <g transform={`translate(${E} ${-E})`}>
          {layout === 'multi-row' && (
            <g>
              <line x1={0} y1={h/2} x2={w} y2={h/2} stroke="#e2e8f0" strokeWidth={1.5}/>
              {icons.map((ic, idx) => {
                const cellW = w / icons.length;
                return (
                  <g key={idx}>
                    {idx > 0 && <line x1={idx*cellW} y1={0} x2={idx*cellW} y2={h/2} stroke="#e2e8f0" strokeWidth={1.5}/>}
                    <g transform={`translate(${idx*cellW + cellW/2} ${h/4})`}><NodeIcon kind={ic} color="#475569" mono/></g>
                  </g>
                );
              })}
              <text x={w/2} y={h*0.75+4} textAnchor="middle" fill="#334155" fontSize="13" fontWeight="600" fontFamily="Inter Tight">{node.label}</text>
            </g>
          )}
          {layout === 'inline' && (
            <g>
              {icons.map((ic, idx) => {
                const cellW = w / icons.length;
                return (
                  <g key={idx}>
                    {idx > 0 && <line x1={idx*cellW} y1={0} x2={idx*cellW} y2={h} stroke="#e2e8f0" strokeWidth={1.5}/>}
                    <g transform={`translate(${idx*cellW + cellW/2} ${h/2})`}><NodeIcon kind={ic} color="#475569" mono/></g>
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
                  {kind === 'queue' && (
                    <g>
                      {[0,1,2].map(qi => {
                        const pw = (w-28)/3, px = 10 + qi*(pw+4);
                        return <rect key={qi} x={px} y={8} width={pw} height={14} rx="3" fill={qi===2 ? '#FFB800' : '#fde68a'} stroke="#b45309" strokeWidth="1"/>;
                      })}
                      <path d={`M ${w-14} 15 L ${w-6} 15 M ${w-10} 11 L ${w-6} 15 L ${w-10} 19`} stroke="#b45309" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                    </g>
                  )}
                  {kind === 'cache' && (
                    <g>
                      {[0,1,2,3].map(ci => {
                        const cw = (w-24)/4, cx2 = 10+ci*(cw+1);
                        return <rect key={ci} x={cx2} y={10} width={cw-1} height={10} rx="1.5" fill="#0f172a" stroke="#334155" strokeWidth="0.5"/>;
                      })}
                    </g>
                  )}
                  {(kind === 'client' || kind === 'actor') && (
                    <g>
                      <circle cx={w/2} cy={12} r="6" fill="#cbd5e1" stroke="#64748b" strokeWidth="1"/>
                      <path d={`M ${w/2-10} 22 Q ${w/2} 14, ${w/2+10} 22`} fill="none" stroke="#64748b" strokeWidth="1"/>
                    </g>
                  )}
                  {kind === 'external' && (
                    <g transform={`translate(${w/2} 16)`}>
                      <path d="M -8 4 Q 0 -6, 8 4" fill="none" stroke="#64748b" strokeWidth="1.5"/>
                      <path d="M -5 4 Q 0 -2, 5 4" fill="none" stroke="#64748b" strokeWidth="1.5"/>
                      <circle cx="0" cy="4" r="1.5" fill="#64748b"/>
                    </g>
                  )}
                  {kind === 'event' && (
                    <g>
                      <circle cx={w/2} cy={14} r="8" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1"/>
                      <path d={`M ${w/2+1} 9 L ${w/2-2} 15 L ${w/2+1} 15 L ${w/2-1} 19 L ${w/2+3} 13 L ${w/2} 13 Z`} fill="#f59e0b"/>
                    </g>
                  )}
                  <g transform={`translate(${w/2} ${['queue','cache','gateway','client','actor','external','event'].includes(kind) ? h/2+8 : h/2})`}>
                    {hasMedia(node) ? (
                      <g transform={`translate(${-node.w/2} ${-node.h/2})`}>
                        <NodeImageOrIcon node={node} />
                      </g>
                    ) : !['queue','cache','gateway','client','actor','external','event'].includes(kind) ? (
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
        {layout === 'inline' && (
          <g transform={`translate(${w/2 + E/2} ${h - E/2}) rotate(45) scale(1, 1.732)`}>
            <text textAnchor="middle" dominantBaseline="middle" fill="#64748b" fontSize="12" fontWeight="600" fontFamily="Inter Tight">{node.label}</text>
          </g>
        )}
      </g>
    );
  },
  Edge: ({ edge, active }) => {
    const kind = edge.kind || 'solid';
    const isDashed = kind === 'dashed', isDotted = kind === 'dotted';
    const isBold = kind === 'bold', isAsync = kind === 'async';
    const isBidir = kind === 'bidir', isError = kind === 'error';
    const isSecure = kind === 'secure', isRealtime = kind === 'realtime';
    const warm = active || kind === 'warm' || isError || isRealtime;
    const errorPipe = '#dc2626', securePipe = '#16a34a';
    const pipeFill = isError ? errorPipe : isSecure ? securePipe : (warm ? 'url(#clay-pipe-warm)' : 'url(#clay-pipe-cool)');
    const dash = isDashed ? '16 10' : isDotted ? '2 9' : isAsync ? '14 5 2 5' : isRealtime ? '10 6' : undefined;
    const coreSw = edgeStrokeWidth(edge, isBold ? 8 : 6);
    const outerSw = edgeStrokeWidth(edge, isBold ? 11 : 8);
    const mid = edgeMidpoint(edge.points);
    return (
      <g>
        <path d={edge.d} fill="none" stroke="rgba(0,0,0,.15)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" filter="url(#clay-ao-sm)"/>
        <path d={edge.d} fill="none" stroke={isError ? '#7f1d1d' : isSecure ? '#14532d' : '#64748b'} strokeWidth={outerSw} strokeLinecap="round" strokeLinejoin="round"/>
        <path d={edge.d} fill="none" stroke={pipeFill} strokeWidth={coreSw} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash}>
          {isRealtime && <animate attributeName="stroke-dashoffset" from="0" to="-32" dur=".7s" repeatCount="indefinite"/>}
        </path>
        <path d={edge.d} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" transform="translate(-1, -1)"/>
        {active && !isRealtime && (
          <g>
            {[0,1,2,3].map(i => (
              <g key={i}>
                <animateMotion dur="1.8s" repeatCount="indefinite" path={edge.d} begin={`${i * -0.45}s`} rotate="auto"/>
                <path d="M -24 0 L -6 -3.5 L 6 0 L -6 3.5 Z" fill={isError ? errorPipe : warm ? 'url(#clay-packet-warm)' : 'url(#clay-packet-cool)'} filter="url(#clay-packet-glow)"/>
                <path d="M -8 0 L 0 -4.5 L 8 0 L 0 4.5 Z" fill="#ffffff" filter="url(#clay-packet-glow)" opacity="0.9"/>
                <circle r="1.5" fill="white"/>
              </g>
            ))}
          </g>
        )}
        {isBidir && (
          <g>
            <animateMotion dur="2s" repeatCount="indefinite" path={edge.d} keyPoints="1;0" keyTimes="0;1" rotate="auto"/>
            <circle r="3.5" fill="#fff" filter="url(#clay-packet-glow)"/>
          </g>
        )}
        {isSecure && (
          <g transform={`translate(${mid.x} ${mid.y - 30}) rotate(45) scale(1, 1.732)`} fill="#fff" stroke="#16a34a" strokeWidth="1.5" filter="url(#clay-ao-sm)">
            <rect x="-9" y="-10" width="18" height="16" rx="3"/>
            <path d="M-3 -10 V-13.5 Q0 -16 3 -13.5 V-10" fill="none"/>
            <rect x="-3.5" y="-5" width="7" height="7" rx="1" fill="#16a34a"/>
          </g>
        )}
        {isError && (
          <g transform={`translate(${mid.x} ${mid.y - 30}) rotate(45) scale(1, 1.732)`} fill="#fff" stroke="#dc2626" strokeWidth="2" filter="url(#clay-ao-sm)">
            <circle r="9"/>
            <line x1="-4.5" y1="-4.5" x2="4.5" y2="4.5"/>
            <line x1="4.5" y1="-4.5" x2="-4.5" y2="4.5"/>
          </g>
        )}
        {edge.label && (
          <g transform={`translate(${mid.x} ${mid.y}) translate(0 -36) rotate(45) scale(1, 1.732)`}>
            <rect x={-edge.label.length*3.6 - 8} y={-10} width={edge.label.length*7.2 + 16} height={20}
              rx="4" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" filter="url(#clay-ao-sm)"/>
            <text textAnchor="middle" dominantBaseline="middle" fontFamily="JetBrains Mono" fontSize="10.5" fontWeight="600" fill={warm ? '#b45309' : '#1d4ed8'}>{edge.label}</text>
          </g>
        )}
      </g>
    );
  },
};

export const BUILTIN_STYLES = {
  sleek:     SleekStyle,
  sketch:    SketchStyle,
  iso:       IsoStyle,
  city:      CityStyle,
  blueprint: BlueprintStyle,
};
