// -----------------------------------------------------------
// Mount — wires React components into DOM slots and injects
// the page-level CSS for sections that aren't styled inline.
// -----------------------------------------------------------

const css = `
/* ---------- Player ---------- */
.player {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 24px;
  min-height: 560px;
}
.player-canvas {
  position: relative;
  border-radius: var(--r-xl);
  border: 1px solid var(--line);
  overflow: hidden;
  min-height: 520px;
  box-shadow: var(--d-shadow);
}
.player-overlay {
  position: absolute; top: 14px; left: 14px;
  pointer-events: none;
}
.overlay-pill {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,.85);
  backdrop-filter: blur(8px);
  border: 1px solid var(--line);
  padding: 6px 12px 6px 10px; border-radius: 999px;
  font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-700);
  letter-spacing: .03em;
}
.overlay-dot {
  width: 7px; height: 7px; border-radius: 999px;
  background: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 30%, transparent);
  animation: pulse-dot 1.6s ease-in-out infinite;
}
@keyframes pulse-dot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.3);opacity:.6} }
@keyframes sleek-pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
@keyframes cache-flow { 
  0% { opacity: 0.4; transform: scale(1); } 
  50% { opacity: 1; transform: scale(1.05); } 
  100% { opacity: 0.4; transform: scale(1); } 
}

.player-side {
  display: flex; flex-direction: column; gap: 20px;
  padding: 22px; border: 1px solid var(--line); border-radius: var(--r-xl);
  background: var(--paper-2);
}
.side-head { display: flex; justify-content: space-between; align-items: center; }
.side-label {
  font-family: var(--font-mono); font-size: 10.5px;
  letter-spacing: .1em; text-transform: uppercase; color: var(--ink-400);
}
.style-switcher { display: inline-flex; gap: 2px; background: var(--ink-100); padding: 3px; border-radius: 8px; }
.style-switcher.sm .style-chip { font-size: 10.5px; padding: 4px 9px; }
.style-chip {
  border: 0; background: transparent;
  font-family: var(--font-sans); font-size: 11.5px; font-weight: 500;
  color: var(--ink-500); padding: 5px 10px; border-radius: 6px; cursor: pointer;
  transition: all .15s ease;
}
.style-chip:hover { color: var(--ink-800); }
.style-chip.is-active {
  background: #fff; color: var(--ink-800);
  box-shadow: 0 1px 2px rgba(0,0,0,.06);
}

.transport {
  display: flex; align-items: center; gap: 8px;
  padding: 12px; background: #fff; border: 1px solid var(--line); border-radius: 12px;
}
.transport-btn {
  width: 32px; height: 32px; border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--ink-700);
  display: grid; place-items: center; cursor: pointer;
  transition: all .15s;
}
.transport-btn:hover { background: var(--ink-100); }
.transport-btn.play {
  background: var(--ink-900); color: var(--accent); border-color: var(--ink-900);
  width: 38px; height: 38px; border-radius: 10px;
}
.transport-btn.play:hover { background: var(--ink-800); }
.transport-time {
  margin-left: auto;
  font-family: var(--font-mono); font-size: 13px; color: var(--ink-400);
}
.transport-time .tt-cur { color: var(--ink-800); font-weight: 600; }
.transport-time .tt-sep { margin: 0 3px; }

.step-list { display: flex; flex-direction: column; gap: 2px; }
.step-item {
  display: flex; gap: 14px; align-items: flex-start;
  padding: 12px 10px; border-radius: 10px;
  border: 0; background: transparent; text-align: left; cursor: pointer;
  transition: background .15s;
  font-family: inherit;
}
.step-item:hover { background: color-mix(in oklch, var(--ink-900) 3%, transparent); }
.step-item.is-active { background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.step-dot {
  flex: 0 0 24px; height: 24px; border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--paper);
  display: grid; place-items: center;
  font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-500);
  margin-top: 1px;
}
.step-item.is-done .step-dot { background: var(--ink-900); color: var(--accent); border-color: var(--ink-900); }
.step-item.is-active .step-dot {
  background: var(--accent); color: var(--ink-900); border-color: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in oklch, var(--accent) 25%, transparent);
}
.step-dot-num { line-height: 1; }
.step-body { flex: 1; }
.step-title { font-size: 13.5px; font-weight: 500; color: var(--ink-800); line-height: 1.3; }
.step-item.is-active .step-title { font-weight: 600; }
.step-nar { margin-top: 6px; font-size: 12.5px; color: var(--ink-500); line-height: 1.5; }

.side-foot {
  margin-top: auto;
  display: grid; grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--line); padding-top: 14px;
}
.side-foot-col .k { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-400); }
.side-foot-col .v { font-size: 14px; color: var(--ink-800); margin-top: 3px; }
.mono { font-family: var(--font-mono); }

/* ---------- Catalogs ---------- */
.catalog { padding: 0; }
.catalog-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.catalog-title { font-size: 15px; font-weight: 500; color: var(--ink-700); }
.catalog-title .mono { color: var(--ink-400); font-size: 12px; margin-left: 8px; }

.node-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.edge-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.node-cell, .edge-cell { display: flex; flex-direction: column; gap: 10px; }
.node-frame, .edge-frame {
  aspect-ratio: 16/10;
  border-radius: var(--r-md);
  border: 1px solid var(--line);
  overflow: hidden;
}
.node-cell-meta { display: flex; flex-direction: column; gap: 2px; padding: 0 2px; }
.nc-name { font-size: 13px; color: var(--ink-800); font-weight: 500; }
.nc-slug { font-size: 11px; color: var(--ink-400); }

/* ---------- Showcase ---------- */
.showcase-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px 24px; }
.catalog-title { display: inline-flex; gap: 16px; }
.cat-tab {
  border: 0; background: transparent; font-family: inherit; font-size: 15px; font-weight: 500;
  color: var(--ink-400); padding: 4px 0; cursor: pointer; border-bottom: 2px solid transparent;
}
.cat-tab.is-active { color: var(--ink-800); border-bottom-color: var(--accent); }
.cat-tab .mono { color: var(--ink-300); font-size: 11.5px; margin-left: 6px; }
.cat-tab.is-active .mono { color: var(--ink-500); }
.showcase-cell { display: flex; flex-direction: column; gap: 12px; }
.showcase-head { display: flex; align-items: baseline; gap: 12px; }
.showcase-name { font-family: var(--font-serif); font-size: 22px; color: var(--ink-800); }
.showcase-tag { font-size: 12.5px; color: var(--ink-500); }
.showcase-frame {
  aspect-ratio: 16/9;
  border-radius: var(--r-lg);
  border: 1px solid var(--line);
  overflow: hidden;
  box-shadow: var(--d-shadow);
}
.showcase-foot {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px;
}
.showcase-foot .mono { font-size: 11.5px; color: var(--ink-500); }
.showcase-swatches { display: inline-flex; gap: 4px; }
.sw { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }

/* ---------- DSL ---------- */
.dsl {
  display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
  border: 1px solid var(--line); border-radius: var(--r-xl); overflow: hidden;
  background: var(--paper-2);
}
.dsl-left { display: flex; flex-direction: column; border-right: 1px solid var(--line); background: #fff; }
.dsl-tabs { display: flex; border-bottom: 1px solid var(--line); padding: 0 8px; gap: 4px; background: var(--paper-2); }
.dsl-tab {
  padding: 10px 14px; border: 0; background: transparent;
  font-family: var(--font-mono); font-size: 12px; color: var(--ink-500); cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.dsl-tab.is-active { color: var(--ink-900); border-bottom-color: var(--accent); font-weight: 500; }
.dsl-code {
  flex: 1; margin: 0; padding: 18px 14px; overflow: auto;
  font-family: var(--font-mono); font-size: 12px; line-height: 1.7;
  color: var(--ink-800); white-space: pre;
}
.dsl-ln { display: flex; gap: 14px; }
.dsl-ln-no { color: var(--ink-300); user-select: none; flex: 0 0 22px; text-align: right; }
.tok-key { color: #b7791f; }
.tok-type { color: #2563eb; }
.tok-str { color: #5b8a3c; }
.tok-op  { color: var(--ink-500); font-weight: 600; }
.tok-com { color: var(--ink-400); font-style: italic; }
.tok-jsx { color: #8b5cf6; }
.dsl-foot {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-top: 1px solid var(--line);
  background: var(--paper-2);
  font-size: 11.5px; color: var(--ink-500);
}
.dsl-foot-k { color: var(--ink-400); }
.dsl-foot-arr { color: var(--ink-300); }
.dsl-foot-v { color: var(--ink-800); }
.dsl-right { padding: 20px; display: flex; align-items: center; justify-content: center; }
.dsl-render-frame {
  width: 100%;
  min-height: 340px;
  background: #fffcf3;
  border-radius: var(--r-lg);
  border: 1px solid var(--line);
  overflow: hidden;
  position: relative;
  box-shadow: var(--d-shadow);
}
.dsl-caption {
  position: absolute; bottom: 10px; right: 12px;
  font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-400);
  background: rgba(255,252,243,.85); padding: 4px 8px; border-radius: 4px;
  border: 1px solid var(--line);
}

/* ---------- Tokens / architecture ---------- */
.tokens-wrap { display: flex; flex-direction: column; gap: 32px; }
.tokens-layers {
  display: grid;
  grid-template-columns: 1fr 24px 1fr 24px 1fr;
  gap: 0;
  align-items: stretch;
}
.layer {
  padding: 20px;
  border: 1px solid var(--line); border-radius: var(--r-lg);
  background: var(--paper-2);
  display: flex; flex-direction: column; gap: 14px;
}
.layer-head { display: flex; align-items: baseline; gap: 10px; }
.layer-num { font-size: 11px; color: var(--ink-400); }
.layer-name { font-family: var(--font-serif); font-size: 22px; color: var(--ink-800); }
.layer-desc { font-size: 12.5px; color: var(--ink-500); line-height: 1.5; }
.layer-arrow { display: grid; place-items: center; }
.layer-items { display: flex; flex-direction: column; gap: 6px; border-top: 1px dashed var(--line); padding-top: 12px; }
.tok-row { display: grid; grid-template-columns: 16px 120px 1fr; align-items: center; gap: 10px; font-size: 11.5px; }
.tok-row.is-template .tok-n, .tok-row.is-template .tok-v { color: var(--ink-400); }
.tok-sw { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
.tok-sw-empty { background: transparent; border: 1px dashed var(--line-strong); }
.tok-n { color: var(--ink-700); }
.tok-v { color: var(--ink-500); }

.contract {
  border: 1px solid var(--line); border-radius: var(--r-lg);
  background: var(--ink-900); color: var(--paper);
  padding: 24px 28px;
  display: grid; grid-template-columns: auto 1fr auto; gap: 32px; align-items: center;
}
.contract-head .ch-label { font-family: var(--font-mono); font-size: 10.5px; color: var(--accent); letter-spacing: .1em; text-transform: uppercase; }
.contract-head .ch-sub { font-family: var(--font-serif); font-size: 22px; color: #fff; margin-top: 4px; }
.contract-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 24px; }
.contract-list li { display: grid; grid-template-columns: 110px 1fr; gap: 12px; font-size: 12px; color: rgba(255,255,255,.65); }
.contract-list code { color: var(--accent); font-size: 11.5px; }
.contract-foot { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
.contract-foot .mono { font-size: 11px; color: rgba(255,255,255,.9); }
.contract-foot-ok { font-size: 10.5px; color: var(--accent); }

.pipeline {
  border: 1px solid var(--line); border-radius: var(--r-lg);
  padding: 20px 24px; background: var(--paper-2);
}
.pipeline-head { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-400); margin-bottom: 14px; }
.pipeline-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }
.pipeline-step { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; background: #fff; border: 1px solid var(--line); border-radius: 10px; position: relative; }
.pipeline-step::after {
  content: "→"; position: absolute; right: -12px; top: 50%; transform: translateY(-50%);
  color: var(--ink-300); font-family: var(--font-mono); font-size: 14px;
}
.pipeline-step:last-child::after { display: none; }
.ps-num { font-size: 10px; color: var(--ink-400); }
.ps-name { font-size: 13.5px; font-weight: 600; color: var(--ink-800); }
.ps-desc { font-size: 11px; color: var(--ink-500); line-height: 1.4; }

/* responsive */
@media (max-width: 1080px) {
  .hero { grid-template-columns: 1fr; }
  .player { grid-template-columns: 1fr; }
  .node-grid, .edge-grid { grid-template-columns: repeat(2, 1fr); }
  .showcase-grid { grid-template-columns: 1fr; }
  .dsl { grid-template-columns: 1fr; }
  .tokens-layers { grid-template-columns: 1fr; gap: 10px; }
  .layer-arrow { transform: rotate(90deg); }
  .contract { grid-template-columns: 1fr; text-align: left; }
  .contract-list { grid-template-columns: 1fr 1fr; }
  .pipeline-row { grid-template-columns: repeat(3, 1fr); }
  .pipeline-step:nth-child(3n)::after { display: none; }
}
`;

// inject styles
const styleTag = document.createElement("style");
styleTag.textContent = css;
document.head.appendChild(styleTag);

// mount
function mount(id, Comp) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("ph");
  el.textContent = "";
  el.style.cssText = ""; // clear ph styling
  ReactDOM.createRoot(el).render(<Comp/>);
}

// hero gets a non-clickable ambient diagram
const heroEl = document.getElementById("hero-diagram-mount");
if (heroEl) ReactDOM.createRoot(heroEl).render(<window.Flow.HeroDiagram/>);

mount("player-mount", window.Flow.Player);
mount("styles-mount", window.Flow.StyleShowcase);
mount("nodes-mount", window.Flow.NodeCatalog);
mount("edges-mount", window.Flow.EdgeCatalog);
mount("dsl-mount", window.Flow.DSL);
mount("tokens-mount", window.Flow.Tokens);
