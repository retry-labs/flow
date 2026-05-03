// -----------------------------------------------------------
// UMD / Browser bundle entry.
// Registers the <flow-diagram> Web Component and exposes the
// full API on window.FlowDiagram for plain-HTML usage.
// -----------------------------------------------------------

import { Diagram } from './diagram-component.jsx';
import { parseDSL } from './parser.js';
import { shapePath, shapeAnchor } from './shapes.js';
import { downloadSVG, svgToString, downloadPNG } from './export.js';
import { resolveGraph, NODE_KINDS, SHAPES, EXAMPLE_GRAPH } from './graph.js';
import { STYLES, registerStyle, getStyle, listStyles } from './styles/index.jsx';
import { NodeIcon, BUILTIN_STYLES } from './styles/renderers.jsx';
import FlowDiagramElement from './wrappers/angular.jsx';

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
  FlowDiagramElement,
};

if (typeof window !== 'undefined') {
  window.FlowDiagram = {
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
