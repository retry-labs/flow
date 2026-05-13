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

// ── <flow-diagram> Web Component ──────────────────────────
// Uses the same `mount()` viewport as the vanilla API so the
// custom-element form gets zoom / pan / fullscreen / download
// controls — and now play / pause / step buttons when a graph
// has a `steps:` block — for free.

const OBSERVED = [
  'dsl', 'config', 'diagram-style', 'active-nodes', 'active-edges',
  'height', 'width', 'controls', 'autoplay', 'interval', 'player',
];

class FlowDiagramElement extends HTMLElement {
  static get observedAttributes() { return OBSERVED; }

  connectedCallback() { this._render(); }
  disconnectedCallback() {
    if (this._viewport) { this._viewport.destroy(); this._viewport = null; }
  }
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
    const controls    = this.getAttribute('controls') !== 'false';
    const player      = this.getAttribute('player')   !== 'false';
    const autoplay    = this.getAttribute('autoplay') === 'true' || this.hasAttribute('autoplay') && this.getAttribute('autoplay') !== 'false';
    const intervalRaw = this.getAttribute('interval');
    const interval    = intervalRaw && !isNaN(+intervalRaw) ? +intervalRaw : undefined;

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

    if (this._viewport) {
      this._viewport.update({ graph, styleName, activeNodes, activeEdges });
      return;
    }
    try {
      this._viewport = mount(this, {
        graph, styleName, activeNodes, activeEdges, controls,
        player, autoplay, interval,
        onNodeClick: (id) => this.dispatchEvent(new CustomEvent('node-click', { detail: { id }, bubbles: true })),
        onEdgeClick: (id) => this.dispatchEvent(new CustomEvent('edge-click', { detail: { id }, bubbles: true })),
        onStepChange: (i, step) => this.dispatchEvent(new CustomEvent('step-change', { detail: { index: i, step }, bubbles: true })),
      });
    } catch (err) {
      this.innerHTML = `<div style="color:red;padding:12px;font-family:monospace">flow-diagram render error: ${err.message}</div>`;
    }
  }

  // Imperative API mirrors the React Diagram component.
  play()        { this._viewport && this._viewport.play(); }
  pause()       { this._viewport && this._viewport.pause(); }
  togglePlay()  { this._viewport && this._viewport.togglePlay(); }
  nextStep()    { this._viewport && this._viewport.nextStep(); }
  prevStep()    { this._viewport && this._viewport.prevStep(); }
  gotoStep(i)   { this._viewport && this._viewport.gotoStep(i); }
  setStyle(s)   { this._viewport && this._viewport.setStyle(s); }
  setZoom(z)    { this._viewport && this._viewport.setZoom(z); }
  resetView()   { this._viewport && this._viewport.resetView(); }
  download()    { this._viewport && this._viewport.download(); }
  toggleFullscreen() { this._viewport && this._viewport.toggleFullscreen(); }
}

if (typeof customElements !== 'undefined' && !customElements.get('flow-diagram')) {
  customElements.define('flow-diagram', FlowDiagramElement);
}

// ── Global API (window.FlowDiagram) ───────────────────────

if (typeof window !== 'undefined') {
  window.FlowDiagram = {
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
    version: '0.1.0',
  };
}

export {
  renderSVG, mount, parseDSL, graphToDSL,
  resolveGraph, routeEdge, pathFromPoints, edgeMidpoint,
  shapePath, shapeAnchor,
  NODE_KINDS, SHAPES, EXAMPLE_GRAPH, SVG_STYLES, FlowDiagramElement,
};
