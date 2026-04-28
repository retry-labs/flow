// -----------------------------------------------------------
// DSL Parser — converts YAML-like text into a Graph IR.
// -----------------------------------------------------------

function parseDSL(text) {
  const lines = text.split("\n");
  const nodes = [];
  const edges = [];
  const config = { gapX: 180, gapY: 120, nodesPerRow: 3 };
  let mode = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const lower = trimmed.toLowerCase();
    if (lower === "nodes:") { mode = "nodes"; return; }
    if (lower === "edges:") { mode = "edges"; return; }
    if (lower === "story:") { mode = "story"; return; }
    if (lower === "config:") { mode = "config"; return; }

    if (mode === "config") {
      const match = trimmed.match(/^(\w+):\s*(\d+)/);
      if (match) {
        const val = parseInt(match[2], 10);
        if (!isNaN(val)) config[match[1]] = val;
      }
    }

    if (mode === "nodes" && trimmed.startsWith("-")) {
      const parts = trimmed.slice(1).trim();
      const node = {};
      const pairs = parts.match(/(\w+):\s*("[^"]*"|\S+)/g);
      if (pairs) {
        pairs.forEach(p => {
          const match = p.match(/^(\w+):\s*(.*)$/);
          if (match) {
            let [_, k, v] = match;
            v = v.startsWith('"') ? v.slice(1, -1) : v;
            node[k] = (k === "x" || k === "y" || k === "w" || k === "h") ? Number(v) : v;
          }
        });
      }
      if (node.id) {
        node.w = node.w || 120;
        node.h = node.h || 60;
        node.kind = node.type || "service";
        nodes.push(node);
      }
    }

    if (mode === "edges" && trimmed.startsWith("-")) {
      const parts = trimmed.slice(1).trim();
      const edgeMatch = parts.match(/(\S+)\s*(\->|\.\.>)\s*(\S+)/);
      if (edgeMatch) {
        const [_, from, op, to] = edgeMatch;
        const edge = { 
          id: `e-${from}-${to}-${edges.length}`, 
          from, to, 
          kind: op === ".." ? "dashed" : "solid" 
        };
        const labelMatch = parts.match(/label:\s*"([^"]*)"/);
        if (labelMatch) edge.label = labelMatch[1];
        edges.push(edge);
      }
    }
  });

  // -----------------------------------------------------------
  // Simple Auto-Layout Pass
  // -----------------------------------------------------------
  const hasManualLayout = nodes.some(n => n.x !== undefined || n.y !== undefined);
  
  if (!hasManualLayout) {
    const gapX = Number(config.gapX) || 180;
    const gapY = Number(config.gapY) || 120;
    const nPerRow = Number(config.nodesPerRow) || 3;

    nodes.forEach((node, i) => {
      const col = i % nPerRow;
      const row = Math.floor(i / nPerRow);
      node.x = 60 + col * gapX;
      node.y = 60 + row * gapY;
    });
  } else {
    // Fill in defaults for those that still don't have them
    nodes.forEach(n => {
      n.x = Number(n.x) || 0;
      n.y = Number(n.y) || 0;
    });
  }

  return {
    canvas: { w: 800, h: 600, grid: 16 },
    nodes,
    edges
  };
}

window.Flow = Object.assign(window.Flow || {}, { parseDSL });
