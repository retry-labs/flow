// -----------------------------------------------------------
// Token architecture visualization.
// Shows the three-layer cascade: primitives → semantic → style-theme
// Plus the renderer contract list.
// -----------------------------------------------------------

function Tokens() {
  return (
    <div className="tokens-wrap">
      <div className="tokens-layers">
        <Layer num="01" name="Primitives"
          desc="Raw color ramps, type scales, spacing units. Style-agnostic."
          items={[
            { n: "ink-900", v: "#1a1814", sw: "#1a1814" },
            { n: "ink-500", v: "#6b6459", sw: "#6b6459" },
            { n: "paper",   v: "#faf7ef", sw: "#faf7ef", b: true },
            { n: "accent",  v: "#f5c518", sw: "#f5c518" },
            { n: "space-2", v: "8px",     mono: true },
            { n: "space-4", v: "16px",    mono: true },
            { n: "radius-md", v: "10px",  mono: true },
            { n: "font-sans", v: "Inter Tight", mono: true },
          ]}/>
        <LayerArrow/>
        <Layer num="02" name="Semantic"
          desc="What primitives mean in a diagram context. Shared across all styles."
          items={[
            { n: "d-bg",         v: "canvas background",  mono: true },
            { n: "d-grid",       v: "grid / paper",       mono: true },
            { n: "d-node-bg",    v: "node surface",       mono: true },
            { n: "d-node-ink",   v: "node label color",   mono: true },
            { n: "d-edge",       v: "connection stroke",  mono: true },
            { n: "d-edge-active",v: "active stroke",      mono: true },
            { n: "d-shadow",     v: "node elevation",     mono: true },
            { n: "motion-pulse", v: "2000ms ease",        mono: true },
          ]}/>
        <LayerArrow/>
        <Layer num="03" name="Style theme"
          desc="One file per style. Remaps semantic tokens + implements 4 renderer fns."
          items={[
            { n: "sleek.theme",     v: "themes/sleek.ts",     mono: true, sw: "#f5c518" },
            { n: "sketch.theme",    v: "themes/sketch.ts",    mono: true, sw: "#d97757" },
            { n: "iso.theme",       v: "themes/iso.ts",       mono: true, sw: "#2563eb" },
            { n: "blueprint.theme", v: "themes/blueprint.ts", mono: true, sw: "#0b2545" },
            { n: "+ your style",    v: "themes/_template.ts", mono: true, dashed: true },
          ]}/>
      </div>

      <div className="contract">
        <div className="contract-head">
          <div className="ch-label">Renderer contract</div>
          <div className="ch-sub">What a style module must export</div>
        </div>
        <ul className="contract-list">
          <li><code className="mono tok-key">Defs</code><span>Shared SVG defs — gradients, filters, arrow markers.</span></li>
          <li><code className="mono tok-key">Background</code><span>{`(w, h, grid) => <g/>`}</span></li>
          <li><code className="mono tok-key">Node</code><span>{`({ node, active, pulse }) => <g/>`}</span></li>
          <li><code className="mono tok-key">Edge</code><span>{`({ edge, active, progress }) => <g/>`}</span></li>
          <li><code className="mono tok-key">tokens</code><span>Color triplet the player UI uses for accents.</span></li>
          <li><code className="mono tok-key">motion</code><span>Optional — custom keyframes for this style.</span></li>
        </ul>
        <div className="contract-foot">
          <span className="mono">flow.registerStyle("neon", NeonStyle)</span>
          <span className="contract-foot-ok">✓ drops in, no core changes</span>
        </div>
      </div>

      <div className="pipeline">
        <div className="pipeline-head">Rendering pipeline</div>
        <div className="pipeline-row">
          {[
            { n: "01", k: "Parse",    v: "DSL / JSX / JSON → AST" },
            { n: "02", k: "Compile",  v: "AST → typed graph IR" },
            { n: "03", k: "Layout",   v: "Orthogonal router · manual override" },
            { n: "04", k: "Theme",    v: "Apply selected style theme" },
            { n: "05", k: "Render",   v: "SVG via style.Node / style.Edge" },
            { n: "06", k: "Animate",  v: "Player drives active set + progress" },
          ].map(s => (
            <div key={s.n} className="pipeline-step">
              <div className="ps-num mono">{s.n}</div>
              <div className="ps-name">{s.k}</div>
              <div className="ps-desc">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Layer({ num, name, desc, items }) {
  return (
    <div className="layer">
      <div className="layer-head">
        <span className="layer-num mono">{num}</span>
        <span className="layer-name">{name}</span>
      </div>
      <div className="layer-desc">{desc}</div>
      <div className="layer-items">
        {items.map((it, i) => (
          <div key={i} className={"tok-row" + (it.dashed ? " is-template" : "")}>
            {it.sw ? (
              <span className="tok-sw" style={{ background: it.sw, border: it.b ? "1px solid rgba(0,0,0,.1)" : "none" }}/>
            ) : (
              <span className="tok-sw tok-sw-empty"/>
            )}
            <span className="tok-n mono">{it.n}</span>
            <span className={"tok-v " + (it.mono ? "mono" : "")}>{it.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LayerArrow() {
  return (
    <div className="layer-arrow">
      <svg width="24" height="16" viewBox="0 0 24 16">
        <path d="M0 8 L20 8 M14 3 L20 8 L14 13" stroke="#b8b0a1" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

window.Flow = Object.assign(window.Flow || {}, { Tokens });
