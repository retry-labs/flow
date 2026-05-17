// -----------------------------------------------------------
// DSL Parser — converts YAML-like text into a Graph IR.
// Zero dependencies. Works in any environment.
//
// Dispatch: if the DSL begins with a `type: <name>` directive AND a
// diagram-type plugin is registered under that name, delegate parsing
// to the plugin. Otherwise fall back to the built-in `flow` parser.
// -----------------------------------------------------------

import { sniffType, getType } from './types.js';

export function parseDSL(text) {
  // Type dispatch — sequence / state / ER / mindmap / etc. plugins
  // intercept here before the flow parser sees the text.
  const declaredType = sniffType(text);
  if (declaredType) {
    const plugin = getType(declaredType);
    if (plugin && typeof plugin.parse === 'function') {
      const ir = plugin.parse(text);
      // Guarantee the IR carries the type tag so renderSVG can dispatch.
      if (ir && typeof ir === 'object' && !ir.type) ir.type = declaredType;
      return ir;
    }
    // Declared a type with no plugin → fall through to flow parser so
    // unknown directives become inert meta; render will still work.
  }
  return parseFlowDSL(text);
}

function parseFlowDSL(text) {
  const lines = text.split('\n');
  const nodes = [];
  const edges = [];
  const steps = [];
  const config = { gapX: 180, gapY: 120, nodesPerRow: 3 };
  const meta = {}; // top-level scalars like `style: city`, `title: "..."`
  let mode = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const lower = trimmed.toLowerCase();
    if (lower === 'nodes:')  { mode = 'nodes';  return; }
    if (lower === 'edges:')  { mode = 'edges';  return; }
    if (lower === 'steps:')  { mode = 'steps';  return; }
    if (lower === 'story:')  { mode = 'steps';  return; }
    if (lower === 'config:') { mode = 'config'; return; }

    // Top-level scalar: `key: value` outside any section. Captures `style:`,
    // `title:`, etc. so DSLs can carry per-graph metadata.
    if (mode === null) {
      const m = trimmed.match(/^(\w+):\s*(.+)$/);
      if (m) {
        let [, k, v] = m;
        v = v.trim();
        if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
        meta[k] = v;
        return;
      }
    }

    if (mode === 'config') {
      const m = trimmed.match(/^(\w+):\s*(\d+)/);
      if (m) {
        const val = parseInt(m[2], 10);
        if (!isNaN(val)) config[m[1]] = val;
      }
      return;
    }

    if (mode === 'nodes' && trimmed.startsWith('-')) {
      const parts = trimmed.slice(1).trim();
      const node = {};
      // Unquoted values must not include commas (which separate inline pairs)
      // or whitespace. Quoted values ("...") accept anything but quotes.
      const pairs = parts.match(/(\w+):\s*("[^"]*"|[^,\s][^,]*?)(?=\s*(?:,|$))/g);
      if (pairs) {
        pairs.forEach(p => {
          const m = p.match(/^(\w+):\s*(.*)$/);
          if (m) {
            let [, k, v] = m;
            v = v.trim();
            v = v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v;
            node[k] = ['x', 'y', 'w', 'h'].includes(k) ? Number(v) : v;
          }
        });
      }
      if (node.id) {
        node.w    = node.w    || 140;
        node.h    = node.h    || 70;
        node.kind = node.kind || node.type || 'service';
        nodes.push(node);
      }
      return;
    }

    if (mode === 'edges' && trimmed.startsWith('-')) {
      const parts = trimmed.slice(1).trim();
      const m = parts.match(/(\S+)\s*(->|\.\.>?|-->)\s*([^,\s]+)/);
      if (m) {
        const [, from, op, to] = m;
        const edge = {
          id:   `e-${from}-${to}-${edges.length}`,
          from, to,
          kind: (op === '..>' || op === '..') ? 'dashed' : 'solid',
        };
        const labelM = parts.match(/label:\s*"([^"]*)"/);
        if (labelM) edge.label = labelM[1];
        const kindM = parts.match(/kind:\s*([^,\s]+)/);
        if (kindM) edge.kind = kindM[1];
        // `curve: ortho | bezier` — overrides default ortho routing.
        const curveM = parts.match(/curve:\s*([^,\s]+)/);
        if (curveM) edge.curve = curveM[1];
        // `weight: N` — drives stroke thickness (used by sankey-style flows).
        const weightM = parts.match(/weight:\s*([0-9.]+)/);
        if (weightM) edge.weight = Number(weightM[1]);
        edges.push(edge);
      }
      return;
    }

    if (mode === 'steps' && trimmed.startsWith('-')) {
      const parts = trimmed.slice(1).trim();
      const step = { id: `s${steps.length}`, active: { nodes: [], edges: [] } };
      const titleM = parts.match(/title:\s*"([^"]*)"/);
      if (titleM) step.title = titleM[1];
      const narM = parts.match(/narration:\s*"([^"]*)"/);
      if (narM) step.narration = narM[1];
      const nodesM = parts.match(/nodes:\s*\[([^\]]*)\]/);
      if (nodesM) step.active.nodes = nodesM[1].split(',').map(s => s.trim().replace(/"/g, ''));
      const edgesM = parts.match(/edges:\s*\[([^\]]*)\]/);
      if (edgesM) step.active.edges = edgesM[1].split(',').map(s => s.trim().replace(/"/g, ''));
      steps.push(step);
      return;
    }
  });

  // Coerce any provided positions/sizes to numbers; leave undefined ones
  // alone so resolveGraph's smart auto-layout can position them.
  nodes.forEach(n => {
    if (n.x !== undefined) n.x = Number(n.x);
    if (n.y !== undefined) n.y = Number(n.y);
    if (n.w !== undefined) n.w = Number(n.w);
    if (n.h !== undefined) n.h = Number(n.h);
  });

  return {
    // Canvas is computed by resolveGraph from final node positions when
    // unspecified. Users can override with `canvasW: ...` config keys if
    // they need a fixed viewport.
    type: 'flow',
    canvas: { grid: 20 },
    ...(meta.style  ? { style:  meta.style  } : {}),
    ...(meta.title  ? { title:  meta.title  } : {}),
    ...(meta.layout ? { layout: meta.layout } : {}),
    nodes,
    edges,
    ...(steps.length > 0 ? { steps } : {}),
  };
}

// -----------------------------------------------------------
// graphToDSL — inverse of parseDSL.
// Serializes a graph object back to DSL text. The output is
// designed to round-trip cleanly through parseDSL: feeding
// graphToDSL(g) into parseDSL produces an equivalent graph.
// -----------------------------------------------------------

function quote(s) {
  if (s == null) return '';
  const str = String(s);
  // Quote when value has whitespace, leading/trailing space, or special chars
  return /[\s"',]/.test(str) ? `"${str.replace(/"/g, '\\"')}"` : str;
}

function pairs(obj, keys) {
  const out = [];
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') {
      out.push(`${k}: ${quote(obj[k])}`);
    }
  }
  return out;
}

export function graphToDSL(graph, options) {
  if (!graph || typeof graph !== 'object') return '';
  const compact = options && options.compact === true;

  const lines = [];
  lines.push(compact
    ? '# Compact DSL — logical structure only (auto-layout will position nodes)'
    : '# Auto-generated DSL — round-trips through parseDSL()');
  lines.push('');

  // Top-level metadata: style, title, layout.
  if (graph.style)  lines.push(`style: ${graph.style}`);
  if (graph.title)  lines.push(`title: ${quote(graph.title)}`);
  if (graph.layout) lines.push(`layout: ${graph.layout}`);
  if (graph.style || graph.title || graph.layout) lines.push('');

  // Nodes
  if (Array.isArray(graph.nodes) && graph.nodes.length) {
    lines.push('nodes:');
    const fullKeys    = ['id', 'kind', 'label', 'sub', 'shape', 'x', 'y', 'w', 'h',
                         'src', 'image', 'imageFit', 'imagePosition', 'icon', 'd'];
    const compactKeys = ['id', 'kind', 'label', 'sub', 'shape',
                         'src', 'image', 'imageFit', 'imagePosition', 'icon', 'd'];
    const nodeKeys = compact ? compactKeys : fullKeys;
    const skipExtras = compact ? new Set(['x', 'y', 'w', 'h']) : new Set();
    for (const n of graph.nodes) {
      const parts = pairs(n, nodeKeys);
      // Include any extra custom keys not in our known list
      for (const k of Object.keys(n)) {
        if (!nodeKeys.includes(k) && !skipExtras.has(k) && typeof n[k] !== 'object') {
          parts.push(`${k}: ${quote(n[k])}`);
        }
      }
      lines.push(`  - ${parts.join(', ')}`);
    }
    lines.push('');
  }

  // Edges — prefer the arrow shorthand for kind "solid" / "dashed"
  if (Array.isArray(graph.edges) && graph.edges.length) {
    lines.push('edges:');
    for (const e of graph.edges) {
      const arrow = e.kind === 'dashed' ? '..>' : '->';
      let line = `  - ${e.from} ${arrow} ${e.to}`;
      const extras = [];
      if (e.label) extras.push(`label: ${quote(e.label)}`);
      if (e.kind && e.kind !== 'solid' && e.kind !== 'dashed') {
        extras.push(`kind: ${e.kind}`);
      }
      if (e.curve && e.curve !== 'ortho') extras.push(`curve: ${e.curve}`);
      if (typeof e.weight === 'number') extras.push(`weight: ${e.weight}`);
      if (extras.length) line += ', ' + extras.join(', ');
      lines.push(line);
    }
    lines.push('');
  }

  // Steps
  if (Array.isArray(graph.steps) && graph.steps.length) {
    lines.push('steps:');
    for (const s of graph.steps) {
      const parts = [];
      if (s.title) parts.push(`title: ${quote(s.title)}`);
      if (s.narration) parts.push(`narration: ${quote(s.narration)}`);
      if (s.active) {
        if (Array.isArray(s.active.nodes) && s.active.nodes.length) {
          parts.push(`nodes: [${s.active.nodes.join(', ')}]`);
        }
        if (Array.isArray(s.active.edges) && s.active.edges.length) {
          parts.push(`edges: [${s.active.edges.join(', ')}]`);
        }
      }
      lines.push(`  - ${parts.join(', ')}`);
    }
  }

  return lines.join('\n').trim() + '\n';
}

export default parseDSL;
