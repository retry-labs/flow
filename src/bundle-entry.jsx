/**
 * Flow Diagram - UMD Bundle Entry
 * Standalone browser bundle with React included + gallery components
 */

import FlowDiagramLib from './index.jsx'

// Gallery components (for landing page)
import { default as Player } from './player.jsx'
import { StyleShowcase, NodeCatalog, EdgeCatalog } from './catalogs.jsx'
import { DSL } from './dsl.jsx'
import { Playground } from './playground.jsx'
import { Tokens } from './tokens.jsx'

// Attach to window for browser usage
if (typeof window !== 'undefined') {
  window.Flow = window.Flow || {}
  window.FlowDiagram = FlowDiagramLib
  
  // Backwards compatibility
  Object.assign(window.Flow, FlowDiagramLib)
  
  // Gallery components for landing page
  window.Flow.Player = Player
  window.Flow.StyleShowcase = StyleShowcase
  window.Flow.NodeCatalog = NodeCatalog
  window.Flow.EdgeCatalog = EdgeCatalog
  window.Flow.DSL = DSL
  window.Flow.Playground = Playground
  window.Flow.Tokens = Tokens
  window.Flow.HeroDiagram = Player
  
  // Auto-initialize on DOM ready
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('[data-flow-diagram]').forEach(el => {
        try {
          const config = JSON.parse(el.getAttribute('data-flow-diagram'))
        } catch (e) {
          console.warn('Flow: Failed to parse diagram config', e)
        }
      })
    })
  }
}

export default FlowDiagramLib
