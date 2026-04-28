/**
 * Flow Diagram - Legacy renderers adapter
 * Exposes the existing renderers from renderers.jsx as modern modules
 */

// Re-export styles from the legacy system
export const STYLES = window.Flow?.STYLES || {}
export const Diagram = window.Flow?.Diagram || (() => null)
export const NodeIcon = window.Flow?.NodeIcon || (() => null)

// Shape utilities
export { shapePath, shapeAnchor } from './shapes.jsx'

// Default export
export default {
  STYLES,
  Diagram,
  NodeIcon,
  shapePath,
  shapeAnchor
}
