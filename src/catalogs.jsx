// -----------------------------------------------------------
// Catalogs — node kinds, shape primitives, edges, style showcase.
// -----------------------------------------------------------

const { STYLES, Diagram, NODE_KINDS, SHAPES, EXAMPLE_GRAPH } = window.Flow;

function nodeDemoGraph(kind, shape) {
  const size = shape === "circle" ? { w: 80, h: 80, x: 40, y: 10 }
             : shape === "diamond" ? { w: 110, h: 70, x: 25, y: 15 }
             : shape === "oval" ? { w: 120, h: 60, x: 20, y: 20 }
             : shape === "pill" ? { w: 120, h: 44, x: 20, y: 28 }
             : shape === "hex" ? { w: 120, h: 60, x: 20, y: 20 }
             : shape === "parallelogram" ? { w: 120, h: 58, x: 20, y: 21 }
             : shape === "cylinder" ? { w: 90, h: 72, x: 35, y: 14 }
             : shape === "cloud" ? { w: 130, h: 70, x: 15, y: 15 }
             : { w: 120, h: 64, x: 20, y: 18 };
  return {
    canvas: { w: 160, h: 100, grid: 14 },
    nodes: [{ id: "n", kind: kind || "service", shape, label: shape ? shape : NODE_KINDS[kind].label, ...size,
      sub: kind === "service" ? "v1.0" : undefined }],
    edges: [],
  };
}

function NodeCatalog() {
  const [styleId, setStyleId] = React.useState("sleek");
  const [tab, setTab] = React.useState("kinds"); // kinds | shapes
  const kinds = Object.keys(NODE_KINDS);
  const items = tab === "kinds" ? kinds.map(k => ({ k, shape: undefined })) : SHAPES.map(s => ({ k: undefined, shape: s }));
  return (
    <div className="catalog">
      <div className="catalog-head">
        <div className="catalog-title">
          <button className={"cat-tab " + (tab === "kinds" ? "is-active" : "")} onClick={() => setTab("kinds")}>Semantic kinds <span className="mono">× {kinds.length}</span></button>
          <button className={"cat-tab " + (tab === "shapes" ? "is-active" : "")} onClick={() => setTab("shapes")}>Geometric shapes <span className="mono">× {SHAPES.length}</span></button>
        </div>
        <div className="style-switcher sm">
          {Object.values(STYLES).map(s => (
            <button key={s.id} className={"style-chip " + (s.id === styleId ? "is-active" : "")} onClick={() => setStyleId(s.id)}>{s.name}</button>
          ))}
        </div>
      </div>
      <div className="node-grid">
        {items.map(({ k, shape }) => (
          <div key={(k||"") + (shape||"")} className="node-cell">
            <div className="node-frame" style={{ background: STYLES[styleId].tokens.bg }}>
              <Diagram graph={nodeDemoGraph(k || "service", shape)} style={styleId} padding={6}/>
            </div>
            <div className="node-cell-meta">
              <div className="nc-name">{shape ? capitalize(shape) : NODE_KINDS[k].label}</div>
              <div className="nc-slug mono">{shape ? `shape.${shape}` : `node.${k}`}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function capitalize(s) { return s[0].toUpperCase() + s.slice(1); }

function edgeDemoGraph(kind, label) {
  return {
    canvas: { w: 240, h: 80, grid: 14 },
    nodes: [
      { id: "a", kind: "service", label: "A", x: 10,  y: 18, w: 60, h: 44 },
      { id: "b", kind: "service", label: "B", x: 170, y: 18, w: 60, h: 44 },
    ],
    edges: [{ id: "e", from: "a", to: "b", kind, label }],
  };
}

function EdgeCatalog() {
  const [styleId, setStyleId] = React.useState("sleek");
  const samples = [
    { id: "solid", label: "request",  kind: "solid",  active: false, title: "Solid" },
    { id: "dash",  label: "optional", kind: "dashed", active: false, title: "Dashed" },
    { id: "act",   label: "writing",  kind: "solid",  active: true,  title: "Active (flowing)" },
    { id: "lab",   label: "POST /order", kind: "solid", active: false, title: "Labeled" },
  ];
  return (
    <div className="catalog">
      <div className="catalog-head">
        <div className="catalog-title">Edge variants <span className="mono">× 8</span></div>
        <div className="style-switcher sm">
          {Object.values(STYLES).map(s => (
            <button key={s.id} className={"style-chip " + (s.id === styleId ? "is-active" : "")} onClick={() => setStyleId(s.id)}>{s.name}</button>
          ))}
        </div>
      </div>
      <div className="edge-grid">
        {samples.map(sm => (
          <div key={sm.id} className="edge-cell">
            <div className="edge-frame" style={{ background: STYLES[styleId].tokens.bg }}>
              <Diagram graph={edgeDemoGraph(sm.kind, sm.label)} style={styleId}
                activeEdges={sm.active ? ["e"] : []}
                activeNodes={sm.active ? ["a","b"] : []}
                padding={6}/>
            </div>
            <div className="node-cell-meta">
              <div className="nc-name">{sm.title}</div>
              <div className="nc-slug mono">edge.{sm.kind}{sm.active ? ".active" : ""}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// A richer showcase diagram that mixes shapes so each style has something to do
const SHOWCASE_GRAPH = {
  canvas: { w: 560, h: 340, grid: 16 },
  nodes: [
    { id: "start", kind: "start",    shape: "pill",     label: "Start",     x: 20,  y: 150, w: 90,  h: 40 },
    { id: "user",  kind: "actor",    shape: "rect",     label: "User",      x: 140, y: 150, w: 90,  h: 52 },
    { id: "api",   kind: "gateway",  shape: "hex",      label: "API",       x: 260, y: 150, w: 100, h: 52 },
    { id: "dec",   kind: "decision", shape: "diamond",  label: "Auth ok?",  x: 390, y: 145, w: 100, h: 62 },
    { id: "proc",  kind: "process",  shape: "rect",     label: "Process",   x: 260, y: 40,  w: 100, h: 52, sub: "job" },
    { id: "db",    kind: "store",    shape: "cylinder", label: "DB",        x: 400, y: 40,  w: 80,  h: 70 },
    { id: "stop",  kind: "stop",     shape: "pill",     label: "Stop",      x: 260, y: 270, w: 90,  h: 40 },
  ],
  edges: [
    { id: "e1", from: "start", to: "user", kind: "solid" },
    { id: "e2", from: "user",  to: "api",  kind: "solid", label: "req" },
    { id: "e3", from: "api",   to: "dec",  kind: "solid" },
    { id: "e4", from: "dec",   to: "proc", kind: "solid", label: "yes" },
    { id: "e5", from: "proc",  to: "db",   kind: "solid", label: "write" },
    { id: "e6", from: "dec",   to: "stop", kind: "dashed", label: "no" },
  ],
};

function StyleShowcase() {
  const styles = Object.values(STYLES);
  return (
    <div className="showcase-grid">
      {styles.map(s => (
        <div key={s.id} className="showcase-cell">
          <div className="showcase-head">
            <div className="showcase-name">{s.name}</div>
            <div className="showcase-tag">{s.tagline}</div>
          </div>
          <div className="showcase-frame" style={{ background: s.tokens.bg }}>
            <Diagram graph={SHOWCASE_GRAPH} style={s.id}
              activeNodes={["api", "dec", "proc"]}
              activeEdges={["e3", "e4"]}
              padding={10}/>
          </div>
          <div className="showcase-foot">
            <code className="mono">style: "{s.id}"</code>
            <span className="showcase-swatches">
              {["bg","ink","accent","line"].map(k => (
                <span key={k} className="sw" title={`${k}: ${s.tokens[k]}`}
                  style={{ background: s.tokens[k], border: k === "bg" ? "1px solid rgba(0,0,0,.1)" : "none" }}/>
              ))}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function HeroDiagram() {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 2200);
    return () => clearInterval(t);
  }, []);
  const steps = EXAMPLE_GRAPH.steps;
  const step = steps[tick % steps.length];
  return (
    <Diagram graph={EXAMPLE_GRAPH} style="sleek"
      activeNodes={step.active.nodes} activeEdges={step.active.edges} padding={20}/>
  );
}

window.Flow = Object.assign(window.Flow || {}, { NodeCatalog, EdgeCatalog, StyleShowcase, HeroDiagram });
