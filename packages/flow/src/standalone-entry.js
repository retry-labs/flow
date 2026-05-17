// -----------------------------------------------------------
// Standalone entry — zero React, zero dependencies.
// Uses the pure SVG string renderer. Safe on any page including
// Confluence, Notion, React apps — no framework conflicts possible.
// -----------------------------------------------------------

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

registerElement();

if (typeof window !== 'undefined') {
  window.RLFlow = {
    renderSVG,
    mount,
    parseDSL,
    graphToDSL,
    resolveGraph,
    routeEdge,
    pathFromPoints,
    edgeMidpoint,
    shapePath,
    shapeAnchor,
    NODE_KINDS,
    SHAPES,
    EXAMPLE_GRAPH,
    styles: Object.keys(SVG_STYLES),
    SVG_STYLES,
    // Layout engines (rank | dagre | force | radial — all bundled).
    listLayouts, getLayout, registerLayout,
    // Diagram types (flow is the only built-in for now; plugins
    // register others).
    listTypes, getType, registerType,
    // Built-in icon sprite library.
    listIcons, getIcon,
    version: '__VERSION__',
  };
}

export {
  renderSVG, mount, parseDSL, graphToDSL,
  resolveGraph, routeEdge, pathFromPoints, edgeMidpoint,
  shapePath, shapeAnchor,
  NODE_KINDS, SHAPES, EXAMPLE_GRAPH, SVG_STYLES, RLFlowElement,
};
