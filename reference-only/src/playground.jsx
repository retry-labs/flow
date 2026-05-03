// -----------------------------------------------------------
// Playground — full-featured DSL editor with live preview,
// style swap, presets, share-via-URL, copy-code, error handling.
// -----------------------------------------------------------

const { Diagram: PG_Diagram } = window.Flow;
const PG_parse = (code) => window.Flow.parseDSL(code);

const PRESETS = {
  microservices: {
    label: "Microservices",
    sub: "API → services → store",
    code: `# Microservices request flow
nodes:
  - id: web      type: actor    label: "Web App"
  - id: api      type: gateway  label: "API Gateway"  sub: "v2.4"
  - id: auth     type: service  label: "Auth"
  - id: orders   type: service  label: "Orders"        sub: "go"
  - id: catalog  type: service  label: "Catalog"       sub: "rust"
  - id: db       type: store    label: "Postgres"
  - id: cache    type: cache    label: "Redis"

edges:
  - web    -> api      label: "HTTPS"
  - api    -> auth     label: "verify"
  - api    -> orders   label: "POST /order"
  - api    -> catalog  label: "GET /items"
  - orders -> db       label: "write"
  - catalog .. cache   label: "lookup"
  - catalog -> db      label: "fallback"

config:
  gapX: 170
  gapY: 130
  nodesPerRow: 4
`,
  },
  auth: {
    label: "Auth flow",
    sub: "OAuth round-trip",
    code: `# OAuth round-trip
nodes:
  - id: user    type: actor     label: "User"
  - id: app     type: service   label: "App"
  - id: idp     type: external  label: "Identity Provider"
  - id: tokens  type: store     label: "Tokens"
  - id: api     type: gateway   label: "API"

edges:
  - user   -> app      label: "click login"
  - app    -> idp      label: "redirect"
  - idp    -> user     label: "consent"
  - user   -> idp      label: "approve"
  - idp    -> app      label: "code"
  - app    -> idp      label: "exchange"
  - idp    -> app      label: "tokens"
  - app    -> tokens   label: "persist"
  - app    -> api      label: "Bearer ..."

config:
  gapX: 180
  gapY: 130
  nodesPerRow: 3
`,
  },
  etl: {
    label: "ETL pipeline",
    sub: "extract → transform → load",
    code: `# Nightly ETL
nodes:
  - id: src      type: store     label: "Source DB"
  - id: extract  type: service   label: "Extract"   sub: "cron"
  - id: queue    type: queue     label: "Raw Events"
  - id: worker   type: service   label: "Transform" sub: "spark"
  - id: warehouse type: store    label: "Warehouse"
  - id: bi       type: external  label: "BI Tools"

edges:
  - src     -> extract   label: "SELECT *"
  - extract -> queue     label: "publish"
  - queue   -> worker    label: "consume"
  - worker  -> warehouse label: "load"
  - warehouse .. bi      label: "query"

config:
  gapX: 175
  gapY: 130
  nodesPerRow: 3
`,
  },
  pubsub: {
    label: "Pub/Sub",
    sub: "fan-out events",
    code: `# Event-driven fan-out
nodes:
  - id: producer type: service label: "Producer"
  - id: bus      type: queue   label: "Event Bus"
  - id: a        type: service label: "Notifier"
  - id: b        type: service label: "Indexer"
  - id: c        type: service label: "Audit Log"
  - id: store    type: store   label: "Search Index"

edges:
  - producer -> bus    label: "publish"
  - bus      -> a      label: "subscribe"
  - bus      -> b      label: "subscribe"
  - bus      -> c      label: "subscribe"
  - b        -> store  label: "index"

config:
  gapX: 175
  gapY: 130
  nodesPerRow: 3
`,
  },
  blank: {
    label: "Blank",
    sub: "start from scratch",
    code: `# Your diagram
nodes:
  - id: a   type: service  label: "Service A"
  - id: b   type: service  label: "Service B"

edges:
  - a -> b   label: "calls"
`,
  },
};

const STYLE_OPTIONS = [
  { id: "sleek",     label: "Sleek" },
  { id: "sketch",    label: "Sketch" },
  { id: "iso",       label: "Iso" },
  { id: "city",      label: "City" },
  { id: "blueprint", label: "Blueprint" },
];

// ---------- url hash helpers ----------
function encodeHash(state) {
  try {
    const json = JSON.stringify(state);
    // base64-url-safe
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return b64;
  } catch { return ""; }
}
function decodeHash(h) {
  try {
    const b64 = h.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch { return null; }
}

function Playground() {
  // Try to load from URL hash if it points at #pg=...
  const initial = (() => {
    const h = window.location.hash || "";
    const m = h.match(/pg=([A-Za-z0-9_-]+)/);
    if (m) {
      const decoded = decodeHash(m[1]);
      if (decoded && decoded.code) return decoded;
    }
    return { code: PRESETS.microservices.code, style: "sleek", presetId: "microservices" };
  })();

  const [code, setCode]       = React.useState(initial.code);
  const [style, setStyle]     = React.useState(initial.style || "sleek");
  const [presetId, setPreset] = React.useState(initial.presetId || "microservices");
  const [error, setError]     = React.useState(null);
  const [lastGood, setLast]   = React.useState(null);
  const [copied, setCopied]   = React.useState(false);
  const [shared, setShared]   = React.useState(false);
  const [showJson, setShowJson] = React.useState(false);

  // parse on every change
  const graph = React.useMemo(() => {
    try {
      const g = PG_parse(code);
      if (!g.nodes || g.nodes.length === 0) {
        setError("No nodes parsed — add at least one node under `nodes:`.");
        return lastGood;
      }
      setError(null);
      setLast(g);
      return g;
    } catch (e) {
      setError(String(e.message || e));
      return lastGood;
    }
  // eslint-disable-next-line
  }, [code]);

  // load preset
  function loadPreset(id) {
    setPreset(id);
    setCode(PRESETS[id].code);
  }

  // copy code
  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }

  // share — encode current state into URL hash
  function shareLink() {
    const hash = encodeHash({ code, style, presetId });
    const url = `${window.location.origin}${window.location.pathname}#pg=${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      setShared(true);
      setTimeout(() => setShared(false), 1600);
    });
    // also update the bar so the user sees it
    history.replaceState(null, "", `#pg=${hash}`);
  }

  function reset() {
    loadPreset(presetId);
  }

  const lineCount = code.split("\n").length;

  return (
    <div className="pg">
      {/* Top bar — presets + style + actions */}
      <div className="pg-bar">
        <div className="pg-bar-l">
          <span className="pg-bar-label">Preset</span>
          <div className="pg-presets">
            {Object.entries(PRESETS).map(([id, p]) => (
              <button key={id}
                className={"pg-preset " + (presetId === id ? "is-active" : "")}
                onClick={() => loadPreset(id)} title={p.sub}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="pg-bar-r">
          <span className="pg-bar-label">Style</span>
          <div className="pg-styles">
            {STYLE_OPTIONS.map(s => (
              <button key={s.id}
                className={"pg-style " + (style === s.id ? "is-active" : "")}
                onClick={() => setStyle(s.id)}>{s.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Main 2-column grid */}
      <div className="pg-grid">
        {/* Editor */}
        <div className="pg-editor-wrap">
          <div className="pg-editor-head">
            <div className="pg-editor-tabs">
              <button className={"pg-etab " + (!showJson ? "is-active" : "")} onClick={() => setShowJson(false)}>flow.yml</button>
              <button className={"pg-etab " + (showJson ? "is-active" : "")} onClick={() => setShowJson(true)}>JSON IR</button>
            </div>
            <div className="pg-editor-meta">
              <span className="mono">{lineCount} lines</span>
              <span className="mono">·</span>
              <span className="mono">{(graph?.nodes?.length || 0)} nodes</span>
              <span className="mono">·</span>
              <span className="mono">{(graph?.edges?.length || 0)} edges</span>
            </div>
          </div>
          {!showJson ? (
            <div className="pg-editor-shell">
              <div className="pg-gutter">
                {Array.from({length: Math.max(lineCount, 24)}).map((_, i) => (
                  <div key={i}>{String(i + 1).padStart(2, "0")}</div>
                ))}
              </div>
              <textarea
                className="pg-textarea"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck="false"
                wrap="off"
              />
            </div>
          ) : (
            <pre className="pg-json">{JSON.stringify(graph, null, 2)}</pre>
          )}
          <div className="pg-editor-foot">
            <button className="pg-action" onClick={copyCode}>
              {copied ? "✓ Copied" : "Copy DSL"}
            </button>
            <button className="pg-action" onClick={shareLink}>
              {shared ? "✓ Link copied" : "Share link"}
            </button>
            <button className="pg-action" onClick={reset}>Reset preset</button>
            <span className="pg-foot-hint">parses on every keystroke</span>
          </div>
        </div>

        {/* Preview */}
        <div className="pg-preview-wrap">
          <div className="pg-preview-head">
            <div className="pg-preview-title">
              <span className="pg-dot" data-style={style}></span>
              <span>{STYLE_OPTIONS.find(s => s.id === style)?.label} preview</span>
            </div>
            <div className="pg-preview-meta mono">
              live · {style}
            </div>
          </div>
          {error && (
            <div className="pg-error" role="alert">
              <span className="pg-error-dot"></span>
              <span className="pg-error-msg">{error}</span>
              <span className="pg-error-hint">Showing last good render</span>
            </div>
          )}
          <div className="pg-canvas" data-style={style}>
            {graph ? (
              <PG_Diagram graph={graph} style={style} padding={36}/>
            ) : (
              <div className="pg-empty">Add nodes to see a diagram</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

window.Flow = Object.assign(window.Flow || {}, { Playground });
