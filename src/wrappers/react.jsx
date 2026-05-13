/**
 * React Wrapper Component
 *
 * Thin wrapper around the low-level <Diagram>. Adds:
 *   - DSL parsing (pass `dsl="..."` instead of `config={...}`).
 *   - Optional step player when the graph has a `steps:` section.
 *     Honors `autoplay`, `interval`, `stepIndex`, and `onStepChange`,
 *     and derives `activeNodes` / `activeEdges` from the current step.
 *   - Forwards all unknown props down to <Diagram> (so zoom / pan /
 *     fullscreen / download / onNodeClick / onEdgeClick all still work).
 */

import React from 'react'
import { Diagram } from '../diagram-component.jsx'
import { parseDSL } from '../parser.js'

/**
 * Internal hook: derives active nodes/edges from graph.steps + an optional
 * autoplay timer. No-op when graph has no steps.
 */
function useStepPlayer(graph, { autoplay, interval, stepIndex, onStepChange }) {
  const steps = (graph && Array.isArray(graph.steps)) ? graph.steps : null
  const controlled = typeof stepIndex === 'number'
  const [internalIdx, setInternalIdx] = React.useState(controlled ? stepIndex : 0)
  const idx = controlled ? stepIndex : internalIdx
  const stepChangeRef = React.useRef(onStepChange)
  React.useEffect(() => { stepChangeRef.current = onStepChange }, [onStepChange])

  // Notify on index change
  React.useEffect(() => {
    if (!steps || !steps.length) return
    const safe = ((idx % steps.length) + steps.length) % steps.length
    if (stepChangeRef.current) stepChangeRef.current(safe, steps[safe])
  }, [idx, steps])

  // Autoplay timer (only when uncontrolled — controlled callers drive it)
  React.useEffect(() => {
    if (!steps || !steps.length || !autoplay || controlled) return undefined
    const ms = Number(interval) > 0 ? Number(interval) : 2000
    const t = setInterval(() => setInternalIdx((i) => (i + 1) % steps.length), ms)
    return () => clearInterval(t)
  }, [steps, autoplay, interval, controlled])

  if (!steps || !steps.length) return { activeNodes: null, activeEdges: null }
  const safe = ((idx % steps.length) + steps.length) % steps.length
  const step = steps[safe] || {}
  return {
    activeNodes: Array.isArray(step.nodes) ? step.nodes : [],
    activeEdges: Array.isArray(step.edges) ? step.edges : [],
  }
}

/**
 * FlowDiagram - React component with DSL support and optional step player.
 */
export function FlowDiagram({
  children,
  config,
  dsl,
  style,
  className = '',
  activeNodes,
  activeEdges,
  autoplay = false,
  interval = 2000,
  stepIndex,
  onStepChange,
  ...diagramProps
}) {
  // Parse DSL if provided
  const graph = React.useMemo(() => {
    if (config) return config
    if (dsl) {
      try {
        return parseDSL(dsl)
      } catch (e) {
        console.error('Flow: Failed to parse DSL', e)
        return null
      }
    }
    return null
  }, [config, dsl])

  // Step player — derived active nodes / edges (only used if the caller
  // didn't pass explicit activeNodes / activeEdges).
  const player = useStepPlayer(graph, { autoplay, interval, stepIndex, onStepChange })

  if (!graph) {
    return (
      <div className={`flow-diagram-error ${className}`}>
        <div className="flow-error-content">
          <h3>Flow Diagram Error</h3>
          <p>No valid graph configuration provided.</p>
          <p>Provide either:
            <ul>
              <li><code>config</code> - a graph object</li>
              <li><code>dsl</code> - a DSL/YAML string</li>
            </ul>
          </p>
        </div>
      </div>
    )
  }

  // Pick the style: explicit prop wins, then graph.style directive, then 'sleek'.
  const resolvedStyle = style || graph.style || 'sleek'
  const finalActiveNodes = activeNodes != null ? activeNodes : (player.activeNodes || [])
  const finalActiveEdges = activeEdges != null ? activeEdges : (player.activeEdges || [])

  return (
    <Diagram
      className={`flow-react-diagram ${className}`}
      graph={graph}
      style={resolvedStyle}
      activeNodes={finalActiveNodes}
      activeEdges={finalActiveEdges}
      {...diagramProps}
    />
  )
}

FlowDiagram.displayName = 'FlowDiagram'

export default FlowDiagram
