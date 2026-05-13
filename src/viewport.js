// -----------------------------------------------------------
// Vanilla viewport — zoom / pan / fullscreen / download
// shell around a renderSVG() output. Used by the standalone
// bundle and the <flow-diagram> Web Component so non-React
// pages get the same interactive controls as the React
// <Diagram> component.
// -----------------------------------------------------------

import { renderSVG } from './svg-renderer.js';

// ---- Inline SVG icon strings for the floating buttons. ----
const SVG_ATTRS = 'width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const ICONS = {
  zoomIn:
    `<svg ${SVG_ATTRS}>` +
      '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
      '<line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>' +
    '</svg>',
  zoomOut:
    `<svg ${SVG_ATTRS}>` +
      '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
      '<line x1="8" y1="11" x2="14" y2="11"/>' +
    '</svg>',
  fsEnter:
    `<svg ${SVG_ATTRS}>` +
      '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>' +
    '</svg>',
  fsExit:
    `<svg ${SVG_ATTRS}>` +
      '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>' +
    '</svg>',
  download:
    `<svg ${SVG_ATTRS}>` +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
      '<polyline points="7 10 12 15 17 10"/>' +
      '<line x1="12" y1="15" x2="12" y2="3"/>' +
    '</svg>',
  prev:
    `<svg ${SVG_ATTRS}>` +
      '<polyline points="15 18 9 12 15 6"/>' +
    '</svg>',
  next:
    `<svg ${SVG_ATTRS}>` +
      '<polyline points="9 18 15 12 9 6"/>' +
    '</svg>',
  play:
    `<svg ${SVG_ATTRS}>` +
      '<polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/>' +
    '</svg>',
  pause:
    `<svg ${SVG_ATTRS}>` +
      '<rect x="6" y="5" width="4" height="14" fill="currentColor"/>' +
      '<rect x="14" y="5" width="4" height="14" fill="currentColor"/>' +
    '</svg>',
};

// ---- Stylesheet injected once into the page head. ---------
const STYLE_BLOCK = `
.fd-host {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Inter Tight", system-ui, sans-serif;
}
.fd-host:fullscreen { background: #fff; padding: 24px; }
.fd-host .fd-stage {
  width: 100%; height: 100%;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.fd-host .fd-stage.fd-grabbing { cursor: grabbing; }
.fd-host .fd-stage > svg { display: block; width: 100%; height: 100%; }
.fd-host .fd-controls {
  position: absolute; bottom: 12px; right: 12px;
  display: flex; gap: 6px; z-index: 10;
  opacity: 0; pointer-events: none;
  transition: opacity .18s ease;
}
.fd-host:hover .fd-controls,
.fd-host.fd-active .fd-controls,
.fd-host:fullscreen .fd-controls { opacity: 1; pointer-events: auto; }
.fd-host .fd-group {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
  display: flex; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08);
}
.fd-host .fd-btn {
  background: transparent; border: 0; padding: 7px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: #64748b; transition: background .15s, color .15s;
  font-family: inherit;
}
.fd-host .fd-btn:hover { background: #f8fafc; color: #1e293b; }
.fd-host .fd-divider { width: 1px; background: #e2e8f0; }
.fd-host .fd-pct {
  font-family: ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace;
  font-weight: 700; font-size: 10px; min-width: 44px;
}
.fd-host .fd-solo {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 8px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.08);
  display: flex; align-items: center; justify-content: center;
  color: #64748b; transition: background .15s, color .15s;
  font-family: inherit;
}
.fd-host .fd-solo:hover { background: #f8fafc; color: #1e293b; }
.fd-host .fd-caption {
  position: absolute; left: 12px; bottom: 12px; z-index: 9;
  display: flex; align-items: center; gap: 10px;
  padding: 7px 12px;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
  font-size: 12px; color: #1e293b;
  max-width: calc(100% - 230px);
  pointer-events: none;
  opacity: 0; transition: opacity .18s ease;
}
.fd-host:hover .fd-caption,
.fd-host:fullscreen .fd-caption,
.fd-host.fd-active .fd-caption { opacity: 1; }
.fd-host .fd-caption .fd-step {
  font-family: ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace;
  font-size: 10px; font-weight: 700;
  color: #64748b; letter-spacing: .04em;
}
.fd-host .fd-caption .fd-title { font-weight: 600; }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.setAttribute('data-flow-viewport', '');
  s.textContent = STYLE_BLOCK;
  document.head.appendChild(s);
  stylesInjected = true;
}

// Parse "x y w h" viewBox string → { x, y, w, h }
function parseViewBox(vb) {
  if (!vb) return null;
  const parts = vb.trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
}

/**
 * Mount an interactive Flow viewport into a container element.
 *
 *   const v = mount('#arch', { graph, styleName: 'sleek' })
 *   v.update({ activeNodes: ['client'], activeEdges: ['e1'] })
 *   v.setStyle('city')
 *   v.resetView()
 *   v.destroy()
 */
export function mount(target, opts = {}) {
  if (typeof document === 'undefined') {
    throw new Error('flow-diagram mount() requires a DOM environment');
  }
  const container = (typeof target === 'string')
    ? document.querySelector(target)
    : target;
  if (!container || container.nodeType !== 1) {
    throw new Error('flow-diagram mount() needs a valid DOM element or selector');
  }
  injectStyles();

  const state = {
    graph: opts.graph || null,
    styleName: opts.styleName || (opts.graph && opts.graph.style) || 'sleek',
    activeNodes: opts.activeNodes || [],
    activeEdges: opts.activeEdges || [],
    padding: opts.padding,
    showControls: opts.controls !== false,
    fileName: opts.fileName || 'flow-diagram',
    onNodeClick: typeof opts.onNodeClick === 'function' ? opts.onNodeClick : null,
    onEdgeClick: typeof opts.onEdgeClick === 'function' ? opts.onEdgeClick : null,
    onStepChange: typeof opts.onStepChange === 'function' ? opts.onStepChange : null,
    // Player: optional steps array overrides graph.steps. autoplay/interval
    // turn the timeline into a self-cycling diagram. autoStep just exposes
    // the controls without auto-advancing.
    steps: Array.isArray(opts.steps) ? opts.steps : null,
    showPlayer: opts.player !== false,
    autoplay: opts.autoplay === true,
    interval: typeof opts.interval === 'number' ? opts.interval : 2200,
    stepIndex: 0,
    _timer: null,
    zoom: 1,
    panX: 0,
    panY: 0,
  };
  if (!state.steps && state.graph && Array.isArray(state.graph.steps)) {
    state.steps = state.graph.steps;
  }

  // ── DOM scaffolding ─────────────────────────────────────
  container.innerHTML = '';
  const host = document.createElement('div');
  host.className = 'fd-host';
  const stage = document.createElement('div');
  stage.className = 'fd-stage';
  host.appendChild(stage);
  container.appendChild(host);

  // ── Floating control panel ──────────────────────────────
  let pctBtn = null;
  let fsBtn  = null;
  let playBtn = null;
  let stepIdxLabel = null;
  let captionEl = null;
  let captionStepEl = null;
  let captionTitleEl = null;

  const hasPlayer = () => state.showPlayer && Array.isArray(state.steps) && state.steps.length > 0;

  if (state.showControls) {
    const controls = document.createElement('div');
    controls.className = 'fd-controls';

    // ── Player group (only if steps exist) ─────────────
    if (hasPlayer()) {
      const pg = document.createElement('div');
      pg.className = 'fd-group';
      const bPrev = mkBtn('fd-btn', ICONS.prev, 'Previous step', () => api.prevStep());
      const bPlay = mkBtn('fd-btn', state.autoplay ? ICONS.pause : ICONS.play,
        state.autoplay ? 'Pause' : 'Play', () => api.togglePlay());
      playBtn = bPlay;
      const bIdx = mkBtn('fd-btn fd-pct', '1/' + state.steps.length, 'Reset to step 1', () => api.gotoStep(0));
      stepIdxLabel = bIdx;
      const bNext = mkBtn('fd-btn', ICONS.next, 'Next step', () => api.nextStep());
      pg.appendChild(bPrev); pg.appendChild(divider());
      pg.appendChild(bPlay); pg.appendChild(divider());
      pg.appendChild(bIdx);  pg.appendChild(divider());
      pg.appendChild(bNext);
      controls.appendChild(pg);
    }

    // Zoom group
    const zg = document.createElement('div');
    zg.className = 'fd-group';
    const bOut = mkBtn('fd-btn', ICONS.zoomOut, 'Zoom out', () => api.setZoom(state.zoom / 1.25));
    const bPct = mkBtn('fd-btn fd-pct', '100%', 'Reset view', () => api.resetView());
    pctBtn = bPct;
    const bIn  = mkBtn('fd-btn', ICONS.zoomIn,  'Zoom in',  () => api.setZoom(state.zoom * 1.25));
    zg.appendChild(bOut); zg.appendChild(divider());
    zg.appendChild(bPct); zg.appendChild(divider());
    zg.appendChild(bIn);

    // Fullscreen + download solos
    fsBtn = mkBtn('fd-solo', ICONS.fsEnter, 'Toggle fullscreen', () => api.toggleFullscreen());
    const dlBtn = mkBtn('fd-solo', ICONS.download, 'Download SVG', () => api.download());

    controls.appendChild(zg);
    controls.appendChild(fsBtn);
    controls.appendChild(dlBtn);
    host.appendChild(controls);

    // ── Step caption (left side) ───────────────────────
    if (hasPlayer()) {
      captionEl = document.createElement('div');
      captionEl.className = 'fd-caption';
      captionStepEl = document.createElement('span');
      captionStepEl.className = 'fd-step';
      captionTitleEl = document.createElement('span');
      captionTitleEl.className = 'fd-title';
      captionEl.appendChild(captionStepEl);
      captionEl.appendChild(captionTitleEl);
      host.appendChild(captionEl);
    }

    // Reflect fullscreen state in the toggle icon
    const onFsChange = () => {
      if (!fsBtn) return;
      fsBtn.innerHTML = (document.fullscreenElement === host) ? ICONS.fsExit : ICONS.fsEnter;
    };
    document.addEventListener('fullscreenchange', onFsChange);
    state._cleanupFs = () => document.removeEventListener('fullscreenchange', onFsChange);
  }

  // Apply the current step's highlights to active state.
  function applyStep() {
    if (!hasPlayer()) return;
    const step = state.steps[state.stepIndex] || {};
    const a = step.active || {};
    state.activeNodes = Array.isArray(a.nodes) ? a.nodes : (Array.isArray(step.nodes) ? step.nodes : []);
    state.activeEdges = Array.isArray(a.edges) ? a.edges : (Array.isArray(step.edges) ? step.edges : []);
    if (captionStepEl) captionStepEl.textContent = (state.stepIndex + 1) + '/' + state.steps.length;
    if (captionTitleEl) captionTitleEl.textContent = step.title || step.label || ('Step ' + (state.stepIndex + 1));
    if (stepIdxLabel) stepIdxLabel.innerHTML = (state.stepIndex + 1) + '/' + state.steps.length;
    if (state.onStepChange) state.onStepChange(state.stepIndex, step);
  }

  function startTimer() {
    stopTimer();
    if (!hasPlayer()) return;
    state._timer = setInterval(() => api.nextStep(), state.interval);
    if (playBtn) { playBtn.innerHTML = ICONS.pause; playBtn.title = 'Pause'; }
  }
  function stopTimer() {
    if (state._timer) { clearInterval(state._timer); state._timer = null; }
    if (playBtn) { playBtn.innerHTML = ICONS.play; playBtn.title = 'Play'; }
  }

  // ── Render + viewBox math ───────────────────────────────
  let baseVB = { x: 0, y: 0, w: 800, h: 400 };

  function render() {
    if (!state.graph) {
      stage.innerHTML = '<div style="padding:16px;color:#94a3b8;font-size:13px;font-family:inherit">No graph provided</div>';
      return;
    }
    let svgStr;
    try {
      svgStr = renderSVG(state.graph, {
        styleName: state.styleName,
        activeNodes: state.activeNodes,
        activeEdges: state.activeEdges,
        padding: state.padding,
      });
    } catch (err) {
      stage.innerHTML = '<div style="padding:16px;color:#c0392b;font-family:monospace;font-size:12px">flow-diagram render error: ' +
        String(err && err.message || err) + '</div>';
      return;
    }
    stage.innerHTML = svgStr;
    const svg = stage.querySelector('svg');
    if (svg) {
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.style.display = 'block';
      svg.style.width   = '100%';
      svg.style.height  = '100%';
      const vb = parseViewBox(svg.getAttribute('viewBox'));
      if (vb) baseVB = vb;
      attachInteraction(svg);
    }
    applyViewBox();
  }

  function applyViewBox() {
    const svg = stage.querySelector('svg');
    if (!svg) return;
    const vbW = baseVB.w / state.zoom;
    const vbH = baseVB.h / state.zoom;
    const cx  = baseVB.x + baseVB.w / 2 + state.panX;
    const cy  = baseVB.y + baseVB.h / 2 + state.panY;
    svg.setAttribute('viewBox', `${cx - vbW / 2} ${cy - vbH / 2} ${vbW} ${vbH}`);
    if (pctBtn) pctBtn.innerHTML = Math.round(state.zoom * 100) + '%';
  }

  // ── Mouse + wheel interaction ──────────────────────────
  function attachInteraction(svg) {
    let drag = null;

    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const point = pointerPos(e);
      drag = { mx: point.x, my: point.y, px: state.panX, py: state.panY };
      stage.classList.add('fd-grabbing');
    };
    const onMove = (e) => {
      if (!drag) return;
      const point = pointerPos(e);
      const rect = stage.getBoundingClientRect();
      const vbW = baseVB.w / state.zoom;
      const vbH = baseVB.h / state.zoom;
      const sx = rect.width  / vbW;
      const sy = rect.height / vbH;
      const scale = Math.min(sx, sy) || 1;
      state.panX = drag.px - (point.x - drag.mx) / scale;
      state.panY = drag.py - (point.y - drag.my) / scale;
      applyViewBox();
    };
    const onUp = () => { drag = null; stage.classList.remove('fd-grabbing'); };

    svg.addEventListener('mousedown', onDown);
    svg.addEventListener('mousemove', onMove);
    svg.addEventListener('mouseup',   onUp);
    svg.addEventListener('mouseleave', onUp);

    // Touch — single-finger pan only (pinch-zoom would be nice but adds complexity)
    svg.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      onDown({ button: 0, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }, { passive: true });
    svg.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;
      onMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
    }, { passive: true });
    svg.addEventListener('touchend', onUp);

    // Wheel zoom
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? (1 / 1.1) : 1.1;
      api.setZoom(state.zoom * factor);
    }, { passive: false });

    // Click delegation: walk up to find a node/edge group.
    if (state.onNodeClick || state.onEdgeClick) {
      svg.addEventListener('click', (e) => {
        if (drag) return;
        const t = e.target.closest('[data-node-id], [data-edge-id]');
        if (!t) return;
        const nid = t.getAttribute('data-node-id');
        const eid = t.getAttribute('data-edge-id');
        if (nid && state.onNodeClick) state.onNodeClick(nid, e);
        else if (eid && state.onEdgeClick) state.onEdgeClick(eid, e);
      });
    }
  }

  function pointerPos(e) {
    return { x: e.clientX, y: e.clientY };
  }

  // ── Public API ──────────────────────────────────────────
  const api = {
    update(next) {
      if (!next) return;
      let needRender = false;
      // Special-case `graph` so its embedded steps can flow through into
      // the player without forcing callers to repeat them.
      if ('graph' in next && next.graph !== state.graph) {
        state.graph = next.graph;
        if (!('steps' in next) && state.graph && Array.isArray(state.graph.steps)) {
          state.steps = state.graph.steps;
          state.stepIndex = 0;
        }
        needRender = true;
      }
      for (const k of ['styleName', 'activeNodes', 'activeEdges', 'padding']) {
        if (k in next && next[k] !== state[k]) { state[k] = next[k]; needRender = true; }
      }
      if ('steps' in next) {
        state.steps = Array.isArray(next.steps) ? next.steps : null;
        state.stepIndex = 0;
        applyStep();
        needRender = true;
      }
      for (const k of ['onNodeClick', 'onEdgeClick', 'fileName', 'onStepChange', 'interval']) {
        if (k in next) state[k] = next[k];
      }
      if (needRender) render();
    },
    setStyle(name) {
      if (!name || name === state.styleName) return;
      state.styleName = name;
      render();
    },
    setActive(nodes, edges) {
      state.activeNodes = Array.isArray(nodes) ? nodes : [];
      state.activeEdges = Array.isArray(edges) ? edges : [];
      render();
    },
    // ── Player API ─────────────────────────────────────
    play() {
      if (!hasPlayer()) return;
      state.autoplay = true;
      startTimer();
    },
    pause() {
      state.autoplay = false;
      stopTimer();
    },
    togglePlay() {
      if (state.autoplay) api.pause(); else api.play();
    },
    nextStep() {
      if (!hasPlayer()) return;
      state.stepIndex = (state.stepIndex + 1) % state.steps.length;
      applyStep();
      render();
    },
    prevStep() {
      if (!hasPlayer()) return;
      state.stepIndex = (state.stepIndex - 1 + state.steps.length) % state.steps.length;
      applyStep();
      render();
    },
    gotoStep(i) {
      if (!hasPlayer()) return;
      const n = state.steps.length;
      state.stepIndex = ((i % n) + n) % n;
      applyStep();
      render();
    },
    setInterval(ms) {
      state.interval = Math.max(200, ms | 0);
      if (state.autoplay) startTimer();
    },
    get stepIndex() { return state.stepIndex; },
    setZoom(z) {
      state.zoom = Math.max(0.2, Math.min(4, z));
      applyViewBox();
    },
    resetView() {
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      applyViewBox();
    },
    toggleFullscreen() {
      if (typeof document === 'undefined') return;
      if (document.fullscreenElement === host) {
        document.exitFullscreen && document.exitFullscreen();
      } else if (host.requestFullscreen) {
        host.requestFullscreen().catch((err) => {
          // Fullscreen rejected (e.g. iframe without allowfullscreen). Surface
          // the failure but keep the rest of the viewport functional.
          // eslint-disable-next-line no-console
          console.warn('flow-diagram fullscreen rejected:', err && err.message);
        });
      }
    },
    download() {
      const svg = stage.querySelector('svg');
      if (!svg) return;
      const clone = svg.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      // Restore the natural (unzoomed) viewBox so the export captures the
      // full diagram, regardless of the user's current zoom/pan.
      clone.setAttribute('viewBox', `${baseVB.x} ${baseVB.y} ${baseVB.w} ${baseVB.h}`);
      clone.setAttribute('width',  String(baseVB.w));
      clone.setAttribute('height', String(baseVB.h));
      let src = new XMLSerializer().serializeToString(clone);
      if (!src.startsWith('<?xml')) {
        src = '<?xml version="1.0" standalone="no"?>\n' + src;
      }
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
      const a = document.createElement('a');
      a.href = url;
      a.download = (state.fileName || 'flow-diagram') + '-' + state.styleName + '.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    destroy() {
      stopTimer();
      if (state._cleanupFs) state._cleanupFs();
      if (host.parentNode) host.parentNode.removeChild(host);
    },
    get host()  { return host; },
    get stage() { return stage; },
    get svg()   { return stage.querySelector('svg'); },
  };

  // Initialize player highlights before the first render so the diagram
  // opens on step 1 if a steps array was provided.
  if (hasPlayer()) applyStep();
  render();
  if (state.autoplay && hasPlayer()) startTimer();
  return api;
}

// Helper: build a button quickly.
function mkBtn(cls, content, title, fn) {
  const b = document.createElement('button');
  b.className = cls;
  b.title = title;
  b.setAttribute('aria-label', title);
  b.innerHTML = content;
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  return b;
}
function divider() {
  const d = document.createElement('div');
  d.className = 'fd-divider';
  return d;
}

export default mount;
