import React, { useMemo, useEffect, useState, useRef } from 'react';
import { resolveGraph } from './graph.js';
import { getStyle, STYLES } from './styles/index.jsx';
import { downloadSVG } from './export.js';

const ICON = (paths, opts = {}) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={opts.fill || 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths}
  </svg>
);

const ZoomIn = () => ICON(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></>);
const ZoomOut = () => ICON(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></>);
const FsEnter = () => ICON(<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>);
const FsExit  = () => ICON(<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>);
const Download = () => ICON(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>);
const Prev = () => ICON(<polyline points="15 18 9 12 15 6"/>);
const Next = () => ICON(<polyline points="9 18 15 12 9 6"/>);
const Play = () => ICON(<polygon points="6 4 20 12 6 20 6 4" />, { fill: 'currentColor' });
const Pause = () => ICON(<><rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/></>);

/**
 * `playerControls` (optional): when present, Diagram renders a step player
 * overlay. Shape:
 *   {
 *     mode: 'basic' | 'advanced',
 *     stepIndex, totalSteps, stepTitle,
 *     playing, speed, interval,
 *     onPlayPause, onPrev, onNext, onGoto(i), onSpeedChange(s),
 *   }
 */
export function Diagram({
  graph,
  style = 'sleek',
  activeNodes = [],
  activeEdges = [],
  padding = 28,
  className,
  fullscreenTarget = null,
  onNodeClick,
  onEdgeClick,
  playerControls = null,
}) {
  const Style = getStyle(style) || STYLES.sleek;
  const G = useMemo(() => resolveGraph(graph), [graph]);

  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    G.nodes.forEach(n => {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
    });
    G.edges.forEach(e => e.points.forEach(p => {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }));
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 800; maxY = 600; }
    return { minX: minX - 10, minY: minY - 15, w: maxX - minX + 20, h: maxY - minY + 40 };
  }, [G]);

  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const baseW = bounds.w + padding * 2;
  const baseH = bounds.h + padding * 2;
  const vbW = baseW / zoom, vbH = baseH / zoom;
  const cx = bounds.minX - padding + baseW / 2 + pan.x;
  const cy = bounds.minY - padding + baseH / 2 + pan.y;

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragRef.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };
  const handleMouseMove = (e) => {
    if (!isDragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.mx;
    const dy = e.clientY - dragRef.current.my;
    const rect = containerRef.current?.getBoundingClientRect();
    const scale = rect ? Math.min(rect.width / vbW, rect.height / vbH) : 1;
    setPan({ x: dragRef.current.px - dx / scale, y: dragRef.current.py - dy / scale });
  };
  const handleMouseUp = () => { setIsDragging(false); dragRef.current = null; };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setZoom(z => Math.max(0.2, Math.min(4, z * (e.deltaY > 0 ? 0.9 : 1.1))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const showControls = isHovered || isDragging || isFullscreen;

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); handleMouseUp(); }}
      style={{ width: '100%', height: '100%', position: 'relative', background: Style.tokens.bg, overflow: 'hidden' }}
    >
      <svg
        ref={svgRef}
        viewBox={`${cx - vbW/2} ${cy - vbH/2} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-roledescription="diagram"
        aria-label={graph && graph.title ? graph.title : 'Diagram'}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ width: '100%', height: '100%', display: 'block', cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <style>{`
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
        `}</style>
        {Style.Defs && <Style.Defs />}
        <Style.Background w={G.canvas.w} h={G.canvas.h} grid={G.canvas.grid} />
        {G.edges.map(e => {
          const fromTo = `${e.from || ''} → ${e.to || ''}`;
          const desc = e.label ? `${e.label} (${fromTo})` : fromTo;
          return (
            <g key={e.id}
               data-edge-id={e.id}
               role="img"
               onClick={onEdgeClick ? () => onEdgeClick(e) : undefined}
               style={onEdgeClick ? { cursor: 'pointer' } : undefined}>
              <title>{desc}</title>
              <Style.Edge edge={e} active={activeEdges.includes(e.id)} />
            </g>
          );
        })}
        {G.nodes.map(n => {
          const descBits = [n.kind, n.sub].filter(Boolean).join(' — ');
          return (
            <g key={n.id}
               data-node-id={n.id}
               role="img"
               onClick={onNodeClick ? () => onNodeClick(n) : undefined}
               style={onNodeClick ? { cursor: 'pointer' } : undefined}>
              <title>{n.label || n.id}</title>
              {descBits && <desc>{descBits}</desc>}
              <Style.Node node={n} active={activeNodes.includes(n.id)} />
            </g>
          );
        })}
      </svg>

      {/* Bottom-right control bar: player + zoom + fullscreen + download */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        display: 'flex', gap: 6, zIndex: 10,
        opacity: showControls ? 1 : 0,
        pointerEvents: showControls ? 'auto' : 'none',
        transition: 'opacity 0.2s',
      }}>
        {playerControls && <PlayerGroup pc={playerControls} />}
        <ZoomGroup zoom={zoom} setZoom={setZoom} setPan={setPan} />
        <SoloButton title="Toggle fullscreen" onClick={() => {
          const target = fullscreenTarget?.current || containerRef.current;
          if (document.fullscreenElement) document.exitFullscreen();
          else target?.requestFullscreen?.();
        }}>
          {isFullscreen ? <FsExit /> : <FsEnter />}
        </SoloButton>
        <SoloButton title="Download SVG" onClick={() => downloadSVG(svgRef.current, `diagram-${style}.svg`)}>
          <Download />
        </SoloButton>
      </div>

      {/* Bottom-left caption (basic + advanced) */}
      {playerControls && (
        <PlayerCaption pc={playerControls} showControls={showControls} />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────

const groupStyle = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
  display: 'flex', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.08)',
};
const btnBase = {
  background: 'transparent', border: 'none', padding: '7px',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#64748b',
  font: 'inherit',
};
const dividerStyle = { width: 1, background: '#e2e8f0' };

function SoloButton({ title, onClick, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ ...btnBase, padding: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}
    >
      {children}
    </button>
  );
}

function ZoomGroup({ zoom, setZoom, setPan }) {
  return (
    <div style={groupStyle}>
      <button onClick={() => setZoom(z => Math.max(0.2, z / 1.25))} style={btnBase} title="Zoom out"><ZoomOut /></button>
      <div style={dividerStyle} />
      <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              style={{ ...btnBase, fontSize: 10, fontFamily: 'monospace', fontWeight: 700, width: 44 }}
              title="Reset">
        {Math.round(zoom * 100)}%
      </button>
      <div style={dividerStyle} />
      <button onClick={() => setZoom(z => Math.min(4, z * 1.25))} style={btnBase} title="Zoom in"><ZoomIn /></button>
    </div>
  );
}

function PlayerGroup({ pc }) {
  const { stepIndex, totalSteps, playing, onPrev, onNext, onPlayPause, onGoto } = pc;
  return (
    <div style={groupStyle}>
      <button onClick={onPrev} style={btnBase} title="Previous step"><Prev /></button>
      <div style={dividerStyle} />
      <button onClick={onPlayPause} style={btnBase} title={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause /> : <Play />}
      </button>
      <div style={dividerStyle} />
      <button onClick={() => onGoto(0)}
              style={{ ...btnBase, fontSize: 10, fontFamily: 'monospace', fontWeight: 700, width: 44 }}
              title="Reset to step 1">
        {`${stepIndex + 1}/${totalSteps}`}
      </button>
      <div style={dividerStyle} />
      <button onClick={onNext} style={btnBase} title="Next step"><Next /></button>
    </div>
  );
}

function PlayerCaption({ pc, showControls }) {
  const { mode, stepIndex, totalSteps, stepTitle, playing, speed, interval, onGoto, onSpeedChange } = pc;
  const advanced = mode === 'advanced';

  // Progress bar: track elapsed time within the current step while playing.
  const [progress, setProgress] = React.useState(0);
  const startedAtRef = React.useRef(0);
  const rafRef = React.useRef(null);
  React.useEffect(() => {
    if (!advanced) return undefined;
    startedAtRef.current = performance.now();
    setProgress(0);
    if (!playing) return undefined;
    const effInterval = Math.max(80, interval / (speed || 1));
    const tick = () => {
      const t = Math.min(1, (performance.now() - startedAtRef.current) / effInterval);
      setProgress(t);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [advanced, playing, speed, interval, stepIndex]);

  const captionBase = {
    position: 'absolute', left: 12, bottom: 12, zIndex: 9,
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,.08)',
    fontSize: 12, color: '#1e293b',
    opacity: showControls ? 1 : 0,
    transition: 'opacity .18s ease',
    maxWidth: 'calc(100% - 230px)',
  };

  if (!advanced) {
    return (
      <div style={{ ...captionBase, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none' }}>
        <span style={{
          fontFamily: 'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
          fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '.04em',
        }}>{`${stepIndex + 1}/${totalSteps}`}</span>
        <span style={{ fontWeight: 600 }}>{stepTitle}</span>
      </div>
    );
  }

  // Advanced
  return (
    <div style={{
      ...captionBase, padding: '10px 12px', minWidth: 220,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontFamily: 'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
          fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '.04em',
        }}>{`${stepIndex + 1}/${totalSteps}`}</span>
        <span style={{ fontWeight: 600 }}>{stepTitle}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <button key={i} onClick={() => onGoto(i)} title={`Go to step ${i + 1}`}
              aria-label={`Go to step ${i + 1}`}
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: i === stepIndex ? '#0f172a' : '#cbd5e1',
                border: 0, cursor: 'pointer', padding: 0,
                transition: 'background .15s, transform .15s',
              }}
            />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{
          display: 'inline-flex', border: '1px solid #e2e8f0', borderRadius: 6,
          overflow: 'hidden',
          fontFamily: 'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
          fontSize: 10, fontWeight: 700,
        }}>
          {[0.5, 1, 2, 4].map((v) => (
            <button key={v} onClick={() => onSpeedChange(v)}
              title={`Playback speed ${v}×`}
              style={{
                background: v === speed ? '#0f172a' : 'transparent',
                color: v === speed ? '#fff' : '#64748b',
                border: 0, padding: '4px 8px', cursor: 'pointer', font: 'inherit',
              }}>
              {v < 1 ? v.toString() : v}×
            </button>
          ))}
        </div>
      </div>
      <div style={{ height: 3, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
        <i style={{
          display: 'block', height: '100%',
          width: (progress * 100).toFixed(2) + '%',
          background: '#0f172a', borderRadius: 2,
        }} />
      </div>
    </div>
  );
}

export default Diagram;
