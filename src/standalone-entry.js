// -----------------------------------------------------------
// Standalone entry — zero React, zero dependencies.
// Uses the pure SVG string renderer. Safe on any page including
// Confluence, Notion, React apps — no framework conflicts possible.
// -----------------------------------------------------------

import { renderSVG, SVG_STYLES } from './svg-renderer.js';
import { parseDSL, graphToDSL } from './parser.js';
import { resolveGraph, NODE_KINDS, SHAPES, EXAMPLE_GRAPH } from './graph.js';

// ── <flow-diagram> Web Component ──────────────────────────

const OBSERVED = ['dsl', 'config', 'diagram-style', 'active-nodes', 'active-edges', 'height', 'width'];

class FlowDiagramElement extends HTMLElement {
  static get observedAttributes() { return OBSERVED; }

  connectedCallback() { this._render(); }
  attributeChangedCallback() { if (this.isConnected) this._render(); }

  set config(val) { this._config = val; this._render(); }

  _render() {
    const dsl         = this.getAttribute('dsl');
    const styleName   = this.getAttribute('diagram-style') || 'sleek';
    const rawAN       = this.getAttribute('active-nodes') || '';
    const rawAE       = this.getAttribute('active-edges') || '';
    const activeNodes = rawAN ? rawAN.split(',').map(s => s.trim()) : [];
    const activeEdges = rawAE ? rawAE.split(',').map(s => s.trim()) : [];
    const h           = this.getAttribute('height') || '400px';
    const w           = this.getAttribute('width')  || '100%';

    let graph = null;
    try {
      const configAttr = this.getAttribute('config');
      if      (configAttr)    graph = JSON.parse(configAttr);
      else if (this._config)  graph = this._config;
      else if (dsl)           graph = parseDSL(dsl);
    } catch (err) {
      this.innerHTML = `<div style="color:red;padding:12px;font-family:monospace">flow-diagram error: ${err.message}</div>`;
      return;
    }

    if (!graph) {
      this.innerHTML = `<div style="color:#94a3b8;padding:12px;font-family:sans-serif;font-size:13px">Add nodes to see a diagram</div>`;
      return;
    }

    this.style.display = 'block';
    this.style.width   = w;
    this.style.height  = h;
    this.style.overflow = 'hidden';

    try {
      this.innerHTML = renderSVG(graph, { styleName, activeNodes, activeEdges });
    } catch (err) {
      this.innerHTML = `<div style="color:red;padding:12px;font-family:monospace">flow-diagram render error: ${err.message}</div>`;
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('flow-diagram')) {
  customElements.define('flow-diagram', FlowDiagramElement);
}

// ── Global API (window.FlowDiagram) ───────────────────────

if (typeof window !== 'undefined') {
  window.FlowDiagram = {
    renderSVG,
    parseDSL,
    graphToDSL,
    resolveGraph,
    NODE_KINDS,
    SHAPES,
    EXAMPLE_GRAPH,
    styles: Object.keys(SVG_STYLES),
    SVG_STYLES,
  };
}

export { renderSVG, parseDSL, graphToDSL, resolveGraph, NODE_KINDS, SHAPES, EXAMPLE_GRAPH, SVG_STYLES, FlowDiagramElement };
