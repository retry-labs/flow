// -----------------------------------------------------------
// <rl-flow> custom element. Pure SVG renderer via mount() —
// no React. Single source of truth for the element shape used
// by both the standalone IIFE bundle and the UMD bundle.
// -----------------------------------------------------------

import { parseDSL } from './parser.js';
import { mount } from './viewport.js';

const OBSERVED = [
  'dsl', 'config', 'diagram-style', 'active-nodes', 'active-edges',
  'height', 'width', 'controls', 'autoplay', 'interval', 'player', 'speed',
];

// SSR safety: HTMLElement is undefined in Node. The class is only ever
// constructed by `customElements.define(...)` in a browser, but the
// `extends` clause runs at import time — so fall back to a no-op base
// when there's no DOM. This lets the package be imported from server
// components / SSR pipelines without crashing.
const _Base = (typeof HTMLElement !== 'undefined') ? HTMLElement : class {};

export class RLFlowElement extends _Base {
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
    // player attribute is a string: 'basic' | 'advanced' | 'off'. Falsy /
    // unknown values fall through as undefined so viewport.js applies its
    // default (basic when steps exist).
    const playerRaw   = this.getAttribute('player');
    const player      = playerRaw == null ? undefined : playerRaw;
    const autoplay    = this.getAttribute('autoplay') === 'true' || this.hasAttribute('autoplay') && this.getAttribute('autoplay') !== 'false';
    const intervalRaw = this.getAttribute('interval');
    const interval    = intervalRaw && !isNaN(+intervalRaw) ? +intervalRaw : undefined;
    const speedRaw    = this.getAttribute('speed');
    const speed       = speedRaw && !isNaN(+speedRaw) ? +speedRaw : undefined;

    let graph = null;
    try {
      const configAttr = this.getAttribute('config');
      if      (configAttr)    graph = JSON.parse(configAttr);
      else if (this._config)  graph = this._config;
      else if (dsl)           graph = parseDSL(dsl);
    } catch (err) {
      this.innerHTML = `<div style="color:red;padding:12px;font-family:monospace">rl-flow error: ${err.message}</div>`;
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
        player, autoplay, interval, speed,
        onNodeClick: (id) => this.dispatchEvent(new CustomEvent('node-click', { detail: { id }, bubbles: true })),
        onEdgeClick: (id) => this.dispatchEvent(new CustomEvent('edge-click', { detail: { id }, bubbles: true })),
        onStepChange: (i, step) => this.dispatchEvent(new CustomEvent('step-change', { detail: { index: i, step }, bubbles: true })),
      });
    } catch (err) {
      this.innerHTML = `<div style="color:red;padding:12px;font-family:monospace">rl-flow render error: ${err.message}</div>`;
    }
  }

  play()        { this._viewport && this._viewport.play(); }
  pause()       { this._viewport && this._viewport.pause(); }
  togglePlay()  { this._viewport && this._viewport.togglePlay(); }
  nextStep()    { this._viewport && this._viewport.nextStep(); }
  prevStep()    { this._viewport && this._viewport.prevStep(); }
  gotoStep(i)   { this._viewport && this._viewport.gotoStep(i); }
  setStyle(s)   { this._viewport && this._viewport.setStyle(s); }
  setSpeed(s)   { this._viewport && this._viewport.setSpeed(s); }
  setZoom(z)    { this._viewport && this._viewport.setZoom(z); }
  resetView()   { this._viewport && this._viewport.resetView(); }
  download()    { this._viewport && this._viewport.download(); }
  toggleFullscreen() { this._viewport && this._viewport.toggleFullscreen(); }
}

export function registerElement() {
  if (typeof customElements !== 'undefined' && !customElements.get('rl-flow')) {
    customElements.define('rl-flow', RLFlowElement);
  }
}
