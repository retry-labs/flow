/**
 * React Wrapper Component
 */

import React from 'react'
import { Diagram } from '../diagram-component.jsx'
import { parseDSL } from '../parser.jsx'
import { STYLES } from '../styles/index.jsx'

/**
 * FlowDiagram - React component with DSL support
 */
export function FlowDiagram({
  children,
  config,
  dsl,
  style = 'sleek',
  className = '',
  ...diagramProps
}) {
  // Parse DSL if provided
  const graph = React.useMemo(() => {
    if (config) {
      return config
    }
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

  return (
    <Diagram
      className={`flow-react-diagram ${className}`}
      graph={graph}
      style={style}
      {...diagramProps}
    />
  )
}

FlowDiagram.displayName = 'FlowDiagram'

export default FlowDiagram
