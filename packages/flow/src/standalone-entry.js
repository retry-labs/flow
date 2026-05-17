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
    version: '__VERSION__',
  };
}

export {
  renderSVG, mount, parseDSL, graphToDSL,
  resolveGraph, routeEdge, pathFromPoints, edgeMidpoint,
  shapePath, shapeAnchor,
  NODE_KINDS, SHAPES, EXAMPLE_GRAPH, SVG_STYLES, RLFlowElement,
};
