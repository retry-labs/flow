import React, { useMemo, useEffect, useState, useRef } from 'react';
import { resolveGraph } from './graph.js';
import { getStyle, STYLES } from './styles/index.jsx';
import { downloadSVG } from './export.js';

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

  const btnBase = {
    background: 'transparent', border: 'none', padding: '7px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#64748b',
  };
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ width: '100%', height: '100%', display: 'block', cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {Style.Defs && <Style.Defs />}
        <Style.Background w={G.canvas.w} h={G.canvas.h} grid={G.canvas.grid} />
        {G.edges.map(e => (
          <g key={e.id} onClick={onEdgeClick ? () => onEdgeClick(e) : undefined}
            style={onEdgeClick ? { cursor: 'pointer' } : undefined}>
            <Style.Edge edge={e} active={activeEdges.includes(e.id)} />
          </g>
        ))}
        {G.nodes.map(n => (
          <g key={n.id} onClick={onNodeClick ? () => onNodeClick(n) : undefined}
            style={onNodeClick ? { cursor: 'pointer' } : undefined}>
            <Style.Node node={n} active={activeNodes.includes(n.id)} />
          </g>
        ))}
      </svg>

      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        display: 'flex', gap: 6, zIndex: 10,
        opacity: showControls ? 1 : 0,
        pointerEvents: showControls ? 'auto' : 'none',
        transition: 'opacity 0.2s',
      }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}>
          <button onClick={() => setZoom(z => Math.max(0.2, z / 1.25))} style={btnBase} title="Zoom out">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <div style={{ width: 1, background: '#e2e8f0' }} />
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ ...btnBase, fontSize: 10, fontFamily: 'monospace', fontWeight: 700, width: 44 }} title="Reset">
            {Math.round(zoom * 100)}%
          </button>
          <div style={{ width: 1, background: '#e2e8f0' }} />
          <button onClick={() => setZoom(z => Math.min(4, z * 1.25))} style={btnBase} title="Zoom in">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
        </div>
        <button
          onClick={() => {
            const target = fullscreenTarget?.current || containerRef.current;
            if (document.fullscreenElement) document.exitFullscreen();
            else target?.requestFullscreen?.();
          }}
          style={{ ...btnBase, padding: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}
          title="Toggle fullscreen"
        >
          {isFullscreen
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          }
        </button>
        <button
          onClick={() => downloadSVG(svgRef.current, `diagram-${style}.svg`)}
          style={{ ...btnBase, padding: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,.08)' }}
          title="Download SVG"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
      </div>
    </div>
  );
}

export default Diagram;
