// -----------------------------------------------------------
// Layout engine registry.
//
// A layout engine takes (nodes, edges, opts) and mutates each node's
// {x, y, w, h} in place (or returns positions to be applied). Engines
// only run when at least one node is missing x/y.
//
// Built-in engines registered by this module:
//
//   - 'rank'   : the original left-to-right rank-based layout
//                (rank = longest path from a source; nodes per rank
//                stacked vertically). Cheap, predictable.
//
//   - 'dagre'  : DAG-aware Sugiyama-style layered layout. Best for
//                flow/architecture/state/ER diagrams with clear
//                direction.
//
//   - 'force'  : Fruchterman-Reingold force simulation. Best for
//                network / undirected / mindmap diagrams.
//
//   - 'radial' : Root-centred tree placement. Best for mindmaps.
//
// New engines call `registerLayout(name, fn)` from their own module.
// The runtime `layout:` directive in DSL selects an engine per graph.
// -----------------------------------------------------------

import { layoutDagre } from './dagre.js';
import { layoutForce } from './force.js';
import { layoutRadial } from './radial.js';

const LAYOUT_ENGINES = new Map();

export function registerLayout(name, fn) {
  if (!name || typeof name !== 'string') {
    throw new Error('registerLayout: name must be a non-empty string');
  }
  if (typeof fn !== 'function') {
    throw new Error('registerLayout: fn must be a function');
  }
  if (LAYOUT_ENGINES.has(name)) {
    // eslint-disable-next-line no-console
    console.warn(`registerLayout: engine "${name}" is being overwritten`);
  }
  LAYOUT_ENGINES.set(name, fn);
}

export function getLayout(name) {
  if (!name) return null;
  return LAYOUT_ENGINES.get(name) || null;
}

export function listLayouts() {
  return Array.from(LAYOUT_ENGINES.keys()).sort();
}

export function hasLayout(name) {
  return !!name && LAYOUT_ENGINES.has(name);
}

// Register the built-in engines once at module load. New types call
// `registerLayout(...)` from their own modules.
//
// The 'rank' engine is registered lazily by graph.js to avoid a
// circular import (graph.js owns autoLayout, layouts/index.js is
// imported by graph.js).
registerLayout('dagre', layoutDagre);
registerLayout('force', layoutForce);
registerLayout('radial', layoutRadial);

export default { registerLayout, getLayout, listLayouts, hasLayout };
