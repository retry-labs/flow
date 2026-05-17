// -----------------------------------------------------------
// UMD / Browser bundle entry.
// Registers the <rl-flow> Web Component and exposes the
// full API on window.RLFlow for plain-HTML usage.
// -----------------------------------------------------------

import { Diagram } from './diagram-component.jsx';
import { parseDSL } from './parser.js';
import { shapePath, shapeAnchor } from './shapes.js';
import { downloadSVG, svgToString, downloadPNG } from './export.js';
import { resolveGraph, NODE_KINDS, SHAPES, EXAMPLE_GRAPH } from './graph.js';
import { STYLES, registerStyle, getStyle, listStyles } from './styles/index.jsx';
import { NodeIcon, BUILTIN_STYLES } from './styles/renderers.jsx';
import { RLFlowElement, registerElement } from './element.js';

registerElement();

export {
  Diagram,
  parseDSL,
  shapePath,
  shapeAnchor,
  downloadSVG,
  svgToString,
  downloadPNG,
  resolveGraph,
  NODE_KINDS,
  SHAPES,
  EXAMPLE_GRAPH,
  STYLES,
  BUILTIN_STYLES,
  NodeIcon,
  registerStyle,
  getStyle,
  listStyles,
  RLFlowElement,
};

if (typeof window !== 'undefined') {
  window.RLFlow = {
    Diagram,
    parseDSL,
    shapePath,
    shapeAnchor,
    downloadSVG,
    svgToString,
    downloadPNG,
    resolveGraph,
    NODE_KINDS,
    SHAPES,
    EXAMPLE_GRAPH,
    STYLES,
    NodeIcon,
    registerStyle,
    getStyle,
    listStyles,
  };
}
