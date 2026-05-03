import React from 'react';
import ReactDOM from 'react-dom/client';
import { Diagram } from '../diagram-component.jsx';
import { parseDSL } from '../parser.js';

const OBSERVED = ['dsl', 'config', 'style', 'active-nodes', 'active-edges', 'height'];

class FlowDiagramElement extends HTMLElement {
  static get observedAttributes() { return OBSERVED; }

  constructor() {
    super();
    this._root = null;
    this._reactRoot = null;
  }

  connectedCallback() {
    if (!this._root) {
      this._root = document.createElement('div');
      this._root.style.cssText = 'width:100%;height:100%;display:block;';
      this.appendChild(this._root);
    }
    this._mount();
  }

  disconnectedCallback() {
    if (this._reactRoot) {
      this._reactRoot.unmount();
      this._reactRoot = null;
    }
  }

  attributeChangedCallback() {
    if (this._root) this._mount();
  }

  _mount() {
    const dsl    = this.getAttribute('dsl');
    const style  = this.getAttribute('style') || this.getAttribute('diagram-style') || 'sleek';
    const height = this.getAttribute('height') || '400px';
    const rawAN  = this.getAttribute('active-nodes') || '';
    const rawAE  = this.getAttribute('active-edges') || '';
    const activeNodes = rawAN ? rawAN.split(',').map(s => s.trim()) : [];
    const activeEdges = rawAE ? rawAE.split(',').map(s => s.trim()) : [];

    let graph = null;
    try {
      const configAttr = this.getAttribute('config');
      if (configAttr) {
        graph = JSON.parse(configAttr);
      } else if (this._configProp) {
        graph = this._configProp;
      } else if (dsl) {
        graph = parseDSL(dsl);
      }
    } catch (e) {
      console.error('[flow-diagram] Failed to parse config/dsl:', e);
    }

    if (!graph) return;

    this._root.style.height = height;

    const el = React.createElement(Diagram, {
      graph, style, activeNodes, activeEdges,
      onNodeClick: (n) => this.dispatchEvent(new CustomEvent('node-click', { detail: n, bubbles: true })),
      onEdgeClick: (e) => this.dispatchEvent(new CustomEvent('edge-click', { detail: e, bubbles: true })),
    });

    if (!this._reactRoot) {
      this._reactRoot = ReactDOM.createRoot(this._root);
    }
    this._reactRoot.render(el);
  }

  set config(val) {
    this._configProp = val;
    if (this._root) this._mount();
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('flow-diagram')) {
  customElements.define('flow-diagram', FlowDiagramElement);
}

export { FlowDiagramElement };
export default FlowDiagramElement;
