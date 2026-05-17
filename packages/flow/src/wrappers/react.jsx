'use client'

/**
 * React Wrapper Component
 *
 * Thin wrapper around the low-level <Diagram>. Adds:
 *   - DSL parsing (pass `dsl="..."` instead of `config={...}`).
 *   - Step player when the graph has a `steps:` section.
 *     `player="basic" | "advanced" | "off"` (default: "basic" when steps exist).
 *     Honors `autoplay`, `interval`, `speed`, `stepIndex`, `onStepChange`,
 *     and derives `activeNodes` / `activeEdges` from the current step.
 *   - Forwards all unknown props down to <Diagram> (so zoom / pan /
 *     fullscreen / download / onNodeClick / onEdgeClick all still work).
 *
 * The 'use client' directive above tells Next.js App Router that this
 * module must run on the client (it uses useState / useEffect / DOM
 * fullscreen API). It is a no-op in Vite / CRA / other bundlers.
 */

import React from 'react'
import { Diagram } from '../diagram-component.jsx'
import { parseDSL } from '../parser.js'

function normalizePlayer(player, hasSteps) {
  if (player === false || player === 'off') return 'off'
  if (player === 'advanced') return 'advanced'
  if (player === true || player === 'basic') return 'basic'
  return hasSteps ? 'basic' : 'off'
}

/**
 * Internal hook: owns step index + playing state + speed. Returns the
 * derived values + the imperative handlers Diagram needs for its player UI.
 */
function useStepPlayer(graph, {
  player, autoplay, interval, speed: speedProp, stepIndex, onStepChange,
}) {
  const steps = (graph && Array.isArray(graph.steps)) ? graph.steps : null
  const hasSteps = !!(steps && steps.length)
  const mode = normalizePlayer(player, hasSteps)

  const controlled = typeof stepIndex === 'number'
  const [internalIdx, setInternalIdx] = React.useState(controlled ? stepIndex : 0)
  const idx = controlled ? stepIndex : internalIdx
  const [playing, setPlaying] = React.useState(!!autoplay && hasSteps)
  const [speed, setSpeed] = React.useState(typeof speedProp === 'number' && speedProp > 0 ? speedProp : 1)

  const stepChangeRef = React.useRef(onStepChange)
  React.useEffect(() => { stepChangeRef.current = onStepChange }, [onStepChange])

  // Notify on index change
  React.useEffect(() => {
    if (!hasSteps) return
    const safe = ((idx % steps.length) + steps.length) % steps.length
    if (stepChangeRef.current) stepChangeRef.current(safe, steps[safe])
  }, [idx, hasSteps, steps])

  // Autoplay timer
  React.useEffect(() => {
    if (!hasSteps || !playing || controlled || mode === 'off') return undefined
    const effInterval = Math.max(80, (Number(interval) > 0 ? Number(interval) : 2000) / (speed || 1))
    const t = setInterval(() => setInternalIdx((i) => (i + 1) % steps.length), effInterval)
    return () => clearInterval(t)
  }, [hasSteps, playing, controlled, interval, speed, mode, steps])

  if (!hasSteps || mode === 'off') {
    return { mode: 'off', activeNodes: null, activeEdges: null, controls: null }
  }

  const safe = ((idx % steps.length) + steps.length) % steps.length
  const step = steps[safe] || {}
  const stepTitle = step.title || step.label || `Step ${safe + 1}`

  const goto = (i) => {
    const n = steps.length
    const next = ((i % n) + n) % n
    if (!controlled) setInternalIdx(next)
  }

  return {
    mode,
    activeNodes: Array.isArray(step.nodes) ? step.nodes : (step.active?.nodes || []),
    activeEdges: Array.isArray(step.edges) ? step.edges : (step.active?.edges || []),
    controls: {
      mode,
      stepIndex: safe,
      totalSteps: steps.length,
      stepTitle,
      playing,
      speed,
      interval: Number(interval) > 0 ? Number(interval) : 2000,
      onPrev: () => goto(safe - 1),
      onNext: () => goto(safe + 1),
      onPlayPause: () => setPlaying((p) => !p),
      onGoto: goto,
      onSpeedChange: setSpeed,
    },
  }
}

/**
 * RLFlow — React component with DSL support and optional step player.
 */
export function RLFlow({
  children,
  config,
  dsl,
  style,
  className = '',
  activeNodes,
  activeEdges,
  player,
  autoplay = false,
  interval = 2000,
  speed,
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
        console.error('rl-flow: Failed to parse DSL', e)
        return null
      }
    }
    return null
  }, [config, dsl])

  const player$ = useStepPlayer(graph, { player, autoplay, interval, speed, stepIndex, onStepChange })

  if (!graph) {
    return (
      <div className={`rl-flow-error ${className}`}>
        <div className="rl-flow-error-content">
          <h3>RLFlow Error</h3>
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
  const finalActiveNodes = activeNodes != null ? activeNodes : (player$.activeNodes || [])
  const finalActiveEdges = activeEdges != null ? activeEdges : (player$.activeEdges || [])

  return (
    <Diagram
      className={`rl-flow-react ${className}`}
      graph={graph}
      style={resolvedStyle}
      activeNodes={finalActiveNodes}
      activeEdges={finalActiveEdges}
      playerControls={player$.controls}
      {...diagramProps}
    />
  )
}

RLFlow.displayName = 'RLFlow'

export default RLFlow
