// -----------------------------------------------------------
// DSL section — shows the YAML-like input side by side with its rendered diagram.
// -----------------------------------------------------------

const { Diagram: FlowDiagram } = window.Flow;

const DSL_SAMPLE = `# flow.yml — a tiny DSL that compiles to a graph
version: 1
style: sleek

nodes:
  - id: client    type: actor     label: "Client"
  - id: api       type: gateway   label: "API Gateway"
  - id: orders    type: service   label: "Orders"     sub: "v4.2.1"
  - id: db        type: store     label: "Postgres"

edges:
  - client -> api                  label: "HTTPS"
  - api    -> orders               label: "POST /order"
  - orders -> db                   label: "write"
  - api   ..> logs                 label: "audit"     # dashed

# narrate it
story:
  - "Client calls the gateway":
      active: [client, api]
  - "Gateway routes to Orders":
      active: [api, orders]
  - "Orders persists to DB":
      active: [orders, db]`;

const DSL_GRAPH = {
  canvas: { w: 560, h: 280, grid: 16 },
  nodes: [
    { id: "client", kind: "actor",   label: "Client",   x: 30,  y: 110, w: 100, h: 60 },
    { id: "api",    kind: "gateway", label: "API Gateway", x: 170, y: 110, w: 130, h: 60 },
    { id: "orders", kind: "service", label: "Orders",   x: 340, y: 40,  w: 120, h: 60, sub: "v4.2.1" },
    { id: "db",     kind: "store",   label: "Postgres", x: 360, y: 180, w: 100, h: 70 },
  ],
  edges: [
    { id: "e1", from: "client", to: "api",    kind: "solid",  label: "HTTPS" },
    { id: "e2", from: "api",    to: "orders", kind: "solid",  label: "POST /order" },
    { id: "e3", from: "orders", to: "db",     kind: "solid",  label: "write" },
    { id: "e4", from: "api",    to: "db",     kind: "dashed", label: "audit" },
  ],
};

function DSL() {
  const [tab, setTab] = React.useState("yaml");
  const [activeStep, setActiveStep] = React.useState(1);
  const steps = [
    { active: ["client", "api"], edges: ["e1"] },
    { active: ["api", "orders"], edges: ["e2"] },
    { active: ["orders", "db"], edges: ["e3"] },
  ];
  React.useEffect(() => {
    const t = setInterval(() => setActiveStep(s => (s + 1) % steps.length), 1800);
    return () => clearInterval(t);
  }, []);
  const cur = steps[activeStep];

  return (
    <div className="dsl">
      <div className="dsl-left">
        <div className="dsl-tabs">
          {[["yaml", "flow.yml"], ["mermaid", "mermaid-like"], ["jsx", "React"]].map(([id, lbl]) => (
            <button key={id} className={"dsl-tab " + (tab === id ? "is-active" : "")} onClick={() => setTab(id)}>{lbl}</button>
          ))}
        </div>
        <pre className="dsl-code">
{tab === "yaml" && syntaxHighlight(DSL_SAMPLE)}
{tab === "mermaid" && syntaxHighlight(`flow sleek
  client[Client]:actor --"HTTPS"--> api[API Gateway]:gateway
  api --"POST /order"--> orders[Orders v4.2.1]:service
  orders -- "write" --> db[Postgres]:store
  api ..> db : "audit"

  story:
    - "Client calls gateway"   :: client, api
    - "Gateway routes"         :: api, orders
    - "Persist"                :: orders, db`)}
{tab === "jsx" && syntaxHighlight(`<Flow style="sleek">
  <Actor    id="client" label="Client"/>
  <Gateway  id="api"    label="API Gateway"/>
  <Service  id="orders" label="Orders" sub="v4.2.1"/>
  <Store    id="db"     label="Postgres"/>

  <Edge from="client" to="api"    label="HTTPS"/>
  <Edge from="api"    to="orders" label="POST /order"/>
  <Edge from="orders" to="db"     label="write"/>
  <Edge from="api"    to="db"     label="audit" dashed/>

  <Story>
    <Step active={["client","api"]}>Client calls gateway</Step>
    <Step active={["api","orders"]}>Gateway routes</Step>
    <Step active={["orders","db"]}>Persist</Step>
  </Story>
</Flow>`)}
        </pre>
        <div className="dsl-foot">
          <span className="dsl-foot-k">compiles to</span>
          <span className="dsl-foot-arr">→</span>
          <span className="dsl-foot-v mono">graph IR</span>
          <span className="dsl-foot-arr">→</span>
          <span className="dsl-foot-v mono">renderer(style)</span>
        </div>
      </div>
      <div className="dsl-right">
        <div className="dsl-render-frame">
          <FlowDiagram graph={DSL_GRAPH} style="sleek"
            activeNodes={cur.active} activeEdges={cur.edges} padding={28}/>
          <div className="dsl-caption">
            <span className="mono">step {activeStep + 1}/3</span> · live re-render on every keystroke
          </div>
        </div>
      </div>
    </div>
  );
}

function syntaxHighlight(src) {
  // very tiny, visual-only syntax highlight
  const lines = src.split("\n");
  return lines.map((ln, i) => {
    const parts = [];
    let rest = ln;
    // comments
    const cIdx = rest.indexOf("#");
    let comment = null;
    if (cIdx >= 0 && !/["']/.test(rest.slice(0, cIdx))) {
      comment = rest.slice(cIdx);
      rest = rest.slice(0, cIdx);
    }
    // tokens
    const toks = rest.split(/("[^"]*"|->|\.\.>|::|:|\[|\]|,|\s+)/g).filter(Boolean);
    toks.forEach((t, j) => {
      if (/^".*"$/.test(t)) parts.push(<span key={j} className="tok-str">{t}</span>);
      else if (/^(version|style|nodes|edges|story|active|id|type|label|sub|from|to)$/.test(t.trim())) parts.push(<span key={j} className="tok-key">{t}</span>);
      else if (/^(actor|gateway|service|store|cache|queue|external|boundary)$/.test(t.trim())) parts.push(<span key={j} className="tok-type">{t}</span>);
      else if (/^(->|\.\.>|::)$/.test(t.trim())) parts.push(<span key={j} className="tok-op">{t}</span>);
      else if (/^<\/?[A-Z]\w*/.test(t)) parts.push(<span key={j} className="tok-jsx">{t}</span>);
      else parts.push(<span key={j}>{t}</span>);
    });
    if (comment) parts.push(<span key="c" className="tok-com">{comment}</span>);
    return <div key={i} className="dsl-ln"><span className="dsl-ln-no">{String(i+1).padStart(2, "0")}</span><span>{parts}</span></div>;
  });
}

window.Flow = Object.assign(window.Flow || {}, { DSL });
