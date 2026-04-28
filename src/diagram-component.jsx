/**
 * Core Diagram Component
 * Framework-agnostic React component for rendering diagrams
 */

import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'
import {
  resolveGraph,
  STYLES,
  shapePath,
  downloadSVG
} from './index.jsx'

/**
 * Diagram - Main diagram renderer component
 */
export function Diagram({
  graph,
  style = 'sleek',
  activeNodes = [],
  activeEdges = [],
  className = '',
  padding = 0,
  onNodeClick,
  onEdgeClick,
  fullscreenTarget,
  showControls = false,
  animate = true,
  children
}) {
  const containerRef = useRef(null)
  const [resolved, setResolved] = useState(null)
  const [svgElement, setSvgElement] = useState(null)

  // Resolve and cache the graph
  useEffect(() => {
    if (!graph) return
    try {
      const r = resolveGraph(graph)
      setResolved(r)
    } catch (e) {
      console.error('Flow: Failed to resolve graph', e)
    }
  }, [graph])

  const styleObj = STYLES[style] || STYLES.sleek

  // Download handler
  const handleDownload = useCallback(() => {
    if (svgElement) {
      downloadSVG(svgElement, `diagram-${Date.now()}.svg`)
    }
  }, [svgElement])

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen()
    }
  }, [])

  if (!resolved) {
    return <div className={`flow-diagram flow-loading ${className}`}>Loading diagram...</div>
  }

  const {
    nodes,
    edges,
    canvas
  } = resolved

  const width = canvas.w + padding * 2
  const height = canvas.h + padding * 2

  return (
    <div
      ref={containerRef}
      className={`flow-diagram ${className}`}
      style={{
        '--flow-bg': styleObj.tokens.bg,
        '--flow-grid': styleObj.tokens.grid
      }}
    >
      <svg
        ref={setSvgElement}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="flow-svg"
      >
        <defs>
          {styleObj.Defs && <styleObj.Defs />}
          
          {/* Arrow markers */}
          <marker
            id="flow-arrow-solid"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={styleObj.tokens.edge} />
          </marker>
          
          <marker
            id="flow-arrow-active"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={styleObj.tokens.edgeActive} />
          </marker>

          {/* Glow filter for active edges */}
          <filter id="flow-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect
          width={width}
          height={height}
          fill={styleObj.tokens.bg}
        />

        {/* Grid */}
        {styleObj.renderGrid && (
          <g className="flow-grid">
            {styleObj.renderGrid({ width, height, canvas })}
          </g>
        )}

        {/* Edges */}
        <g className="flow-edges">
          {edges.map((edge) => {
            const isActive = activeEdges.includes(edge.id)
            return (
              <g key={edge.id} className={`flow-edge ${isActive ? 'is-active' : ''}`}>
                {styleObj.Edge
                  ? <styleObj.Edge edge={edge} active={isActive} style={styleObj} />
                  : (
                    <>
                      <path
                        d={edge.d}
                        fill="none"
                        stroke={isActive ? styleObj.tokens.edgeActive : styleObj.tokens.edge}
                        strokeWidth={edge.kind === 'dashed' ? 2 : 2.5}
                        strokeDasharray={edge.kind === 'dashed' ? '8,4' : 'none'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter={isActive && animate ? 'url(#flow-glow)' : 'none'}
                      />
                      {edge.label && (
                        <text
                          x={edge.points[1]?.x || 0}
                          y={edge.points[1]?.y || 0}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="11"
                          fill={styleObj.tokens.edgeLabel}
                          fontFamily="JetBrains Mono"
                          dx={edge.dx || 0}
                          dy={edge.dy || 18}
                        >
                          {edge.label}
                        </text>
                      )}
                    </>
                  )
                }
              </g>
            )
          })}
        </g>

        {/* Nodes */}
        <g className="flow-nodes">
          {nodes.map((node) => {
            const isActive = activeNodes.includes(node.id)
            return (
              <g
                key={node.id}
                className={`flow-node ${isActive ? 'is-active' : ''}`}
                transform={`translate(${node.x + padding}, ${node.y + padding})`}
                onClick={() => onNodeClick?.(node)}
                style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
              >
                {styleObj.Node
                  ? <styleObj.Node node={node} active={isActive} style={styleObj} />
                  : (
                    <>
                      {/* Node shape */}
                      {(() => {
                        const shape = shapePath(node.shape || 'rect', node.w, node.h)
                        return <path d={shape.d} fill={styleObj.tokens.nodeBg} stroke={styleObj.tokens.nodeBorder} strokeWidth={1.5} />
                      })()}
                      
                      {/* Node label */}
                      <text
                        x={node.w / 2}
                        y={node.h / 2 - 4}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="13"
                        fontWeight="600"
                        fill={styleObj.tokens.nodeInk}
                        fontFamily="Inter Tight"
                      >
                        {node.label}
                      </text>
                      
                      {/* Node sublabel */}
                      {node.sub && (
                        <text
                          x={node.w / 2}
                          y={node.h / 2 + 12}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="9.5"
                          fill={styleObj.tokens.nodeSub}
                          fontFamily="JetBrains Mono"
                        >
                          {node.sub}
                        </text>
                      )}
                    </>
                  )
                }
              </g>
            )
          })}
        </g>
      </svg>

      {/* Controls */}
      {showControls && (
        <div className="flow-controls">
          <button onClick={handleDownload} title="Download SVG">
            <DownloadIcon />
          </button>
          <button onClick={handleFullscreen} title="Fullscreen">
            <FullscreenIcon />
          </button>
        </div>
      )}

      {children}
    </div>
  )
}

// PropTypes for better DX
Diagram.propTypes = {
  graph: PropTypes.shape({
    nodes: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      kind: PropTypes.string,
      shape: PropTypes.string,
      x: PropTypes.number,
      y: PropTypes.number,
      w: PropTypes.number,
      h: PropTypes.number,
      sub: PropTypes.string
    })),
    edges: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      from: PropTypes.string.isRequired,
      to: PropTypes.string.isRequired,
      label: PropTypes.string,
      kind: PropTypes.oneOf(['solid', 'dashed'])
    })),
    canvas: PropTypes.shape({
      w: PropTypes.number,
      h: PropTypes.number
    })
  }).isRequired,
  style: PropTypes.oneOf(['sleek', 'sketch', 'iso', 'blueprint']),
  activeNodes: PropTypes.arrayOf(PropTypes.string),
  activeEdges: PropTypes.arrayOf(PropTypes.string),
  className: PropTypes.string,
  padding: PropTypes.number,
  onNodeClick: PropTypes.func,
  onEdgeClick: PropTypes.func,
  fullscreenTarget: PropTypes.object,
  showControls: PropTypes.bool,
  animate: PropTypes.bool
}

// Icons
function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  )
}

function FullscreenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  )
}

export default Diagram
