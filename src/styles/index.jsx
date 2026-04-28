/**
 * Style definitions and registration system
 * Each style must export: Defs, Node, Edge, Background, tokens, motion
 */

// Import the 4 built-in styles from the renderers module
import { STYLES as BUILTIN_STYLES, Diagram as BuiltinDiagram } from '../renderers.jsx'

export const STYLES = {
  ...BUILTIN_STYLES
}

const registeredStyles = new Map()

/**
 * Register a new diagram style
 * Style modules must export: { Defs, Node, Edge, Background, tokens, motion }
 */
export function registerStyle(name, styleModule) {
  const requiredExports = ['Node', 'Edge', 'tokens']
  const missing = requiredExports.filter(exp => !styleModule[exp])

  if (missing.length > 0) {
    throw new Error(
      `Cannot register style "${name}": missing required exports: ${missing.join(', ')}\n` +
      `Required: Node, Edge, tokens\n` +
      `Optional: Defs, Background, motion`
    )
  }

  if (registeredStyles.has(name)) {
    console.warn(`Style "${name}" is being overwritten`)
  }

  registeredStyles.set(name, {
    ...styleModule,
    id: name
  })

  // Merge with built-in styles for backwards compatibility
  if (!STYLES[name]) {
    STYLES[name] = registeredStyles.get(name)
  }
}

// Auto-register built-in styles
Object.entries(BUILTIN_STYLES).forEach(([name, style]) => {
  registerStyle(name, style)
})

/**
 * Get a style by name
 */
export function getStyle(name) {
  return registeredStyles.get(name) || STYLES[name]
}

/**
 * List all registered styles
 */
export function listStyles() {
  return Array.from(registeredStyles.keys())
}

// Default export
export default {
  STYLES,
  registerStyle,
  getStyle,
  listStyles
}
