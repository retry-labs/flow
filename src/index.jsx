/**
 * Flow Diagram Library - Main Entry Point
 * Versatile diagram system for React, Vue, Angular, or plain HTML
 */

// Core graph primitives
export { NODE_KINDS, SHAPES, EXAMPLE_GRAPH, EXAMPLE_GRAPH_FLAT, HERO_GRAPH } from './graph.jsx'
export { shapePath, shapeAnchor } from './shapes.jsx'

// Parser & utilities
export { parseDSL } from './parser.jsx'
export { resolveGraph, routeEdge, pathFromPoints, roughPath } from './graph.jsx'

// Renderers & styles
export { Diagram } from './diagram-component.jsx'
export * from './renderers.jsx'

// Styles
export { STYLES, registerStyle } from './styles/index.jsx'

// Export utilities
export { downloadSVG } from './export.jsx'

// Framework-specific components
export { FlowDiagram } from './wrappers/react.jsx'
export { FlowDiagram as VueFlowDiagram } from './wrappers/vue.jsx'
export { FlowDiagramModule } from './wrappers/angular.jsx'

// DSL / Config helpers
export { createGraphFromConfig } from './dsl-utils.jsx'

/**
 * Default export with everything
 */
const FlowDiagramLib = {
  // Core
  NODE_KINDS,
  SHAPES,
  EXAMPLE_GRAPH,
  EXAMPLE_GRAPH_FLAT,
  HERO_GRAPH,
  
  // Functions
  shapePath,
  shapeAnchor,
  parseDSL,
  resolveGraph,
  routeEdge,
  pathFromPoints,
  roughPath,
  downloadSVG,
  
  // Components
  Diagram,
  FlowDiagram: FlowDiagramLib,
  
  // Styles
  STYLES,
  registerStyle,
  
  // Utils
  createGraphFromConfig
}

export default FlowDiagramLib
