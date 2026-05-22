// -----------------------------------------------------------
// Standalone entry — zero React, zero dependencies.
// Uses the pure SVG string renderer. Safe on any page including
// Confluence, Notion, React apps — no framework conflicts possible.
// -----------------------------------------------------------
//
// Note on the IIFE wrapper: rollup builds this as
//   var RLFlow = (function (exports) { ...module code...; return exports; }({}));
// which means the *returned* exports object is what becomes
// `window.RLFlow`. Any `window.RLFlow = {...}` assignment inside the
// module body gets overwritten by that final outer assignment. So this
// file exports every public symbol through `export { ... }` — that's
// what survives onto `window.RLFlow`.
//
// The double-load guard lives in rollup.config.js as an `intro`: if a
// previous copy of the bundle has already published `window.RLFlow`,
// the IIFE returns early with that existing object, leaving the first
// load's function identities and registries intact.

import { renderSVG, SVG_STYLES } from './svg-renderer.js';
import { parseDSL, graphToDSL } from './parser.js';
import {
  resolveGraph, routeEdge, pathFromPoints, edgeMidpoint,
  NODE_KINDS, SHAPES, EXAMPLE_GRAPH,
} from './graph.js';
import { shapePath, shapeAnchor } from './shapes.js';
import { mount } from './viewport.js';
import { RLFlowElement, registerElement } from './element.js';
import { listLayouts, getLayout, registerLayout } from './layouts/index.js';
import { listTypes, getType, registerType } from './types.js';
import { listIcons, getIcon } from './icons.js';

// Side-import diagram-type plugins to self-register them.
import './types/sequence.js';

// Custom element registration. `registerElement()` itself guards against
// double-define via `customElements.get('rl-flow')`, but if the bundle
// is being executed a second time we never reach here because the
// rollup intro early-returns first.
registerElement();

// Convenience surface (computed, not just re-exported bindings).
export const styles = Object.keys(SVG_STYLES);
export const version = '__VERSION__';
// Sentinel read by the rollup intro on subsequent loads. Must be on
// the exports object (not assigned to `window.RLFlow` after the fact —
// that would get overwritten by the IIFE wrapper).
export const __loaded = true;

export {
  // Core renderer + parser
  renderSVG, mount, parseDSL, graphToDSL, SVG_STYLES,
  // Graph helpers
  resolveGraph, routeEdge, pathFromPoints, edgeMidpoint,
  // Shape helpers
  shapePath, shapeAnchor,
  // Schema constants
  NODE_KINDS, SHAPES, EXAMPLE_GRAPH,
  // <rl-flow> custom element class (also auto-registered above)
  RLFlowElement,
  // Layout-engine registry (rank | dagre | force | radial — all bundled).
  listLayouts, getLayout, registerLayout,
  // Diagram-type registry (flow is built-in; plugins register others).
  listTypes, getType, registerType,
  // Icon sprite registry.
  listIcons, getIcon,
};
