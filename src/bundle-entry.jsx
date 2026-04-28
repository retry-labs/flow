/**
 * Flow Diagram - UMD Bundle Entry
 * Standalone browser bundle with React included
 */

import FlowDiagramLib from './index.jsx'

// Attach to window for browser usage
if (typeof window !== 'undefined') {
  window.Flow = window.Flow || {}
  window.FlowDiagram = FlowDiagramLib
  
  // Backwards compatibility
  Object.assign(window.Flow, FlowDiagramLib)
  
  // Auto-initialize on DOM ready for simple embedded usage
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      // Auto-initialize any elements with data-flow-diagram attribute
      document.querySelectorAll('[data-flow-diagram]').forEach(el => {
        try {
          const config = JSON.parse(el.getAttribute('data-flow-diagram'))
          // Simple SVG renderer for static embeds
          // In practice, users would use the proper component
        } catch (e) {
          console.warn('Flow: Failed to parse diagram config', e)
        }
      })
    })
  }
}

export default FlowDiagramLib
