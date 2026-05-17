// -----------------------------------------------------------
// Diagram-type registry.
//
// Adding a new diagram type (sequence, state, ER, mindmap, ...) means
// registering a small plugin object. The library's public entry
// points — parseDSL, renderSVG, the React <Diagram> component, the
// <rl-flow> custom element — all dispatch on `graph.type`.
//
// Plugin shape:
//
//   {
//     name: 'sequence',           // unique, used in the DSL `type:` directive
//     parse(text)    -> graph,    // text → IR. Must return { type, ...payload }
//     renderSVG(graph, opts) -> string,    // IR → SVG string
//     Render?({ graph, style, activeNodes, activeEdges, ... }) -> ReactNode
//                                  // optional React component renderer
//   }
//
// The IR shape is up to the plugin. The only required field is `type`
// (a string matching the registered name) so dispatch works.
//
// `flow` is the *default* (and only) built-in type; the existing
// parser and renderer handle it directly. New types call
// `registerType(...)` from their own module.
// -----------------------------------------------------------

const DIAGRAM_TYPES = new Map();

export function registerType(name, plugin) {
  if (!name || typeof name !== 'string') {
    throw new Error('registerType: name must be a non-empty string');
  }
  if (!plugin || typeof plugin !== 'object') {
    throw new Error('registerType: plugin must be an object');
  }
  if (DIAGRAM_TYPES.has(name)) {
    // eslint-disable-next-line no-console
    console.warn(`registerType: type "${name}" is being overwritten`);
  }
  DIAGRAM_TYPES.set(name, plugin);
}

export function getType(name) {
  return (name && DIAGRAM_TYPES.get(name)) || null;
}

export function listTypes() {
  return Array.from(DIAGRAM_TYPES.keys()).sort();
}

export function hasType(name) {
  return !!name && DIAGRAM_TYPES.has(name);
}

// Sniff the first lines of a DSL string for `type: <name>`. Returns the
// type name or null. Cheap pre-parse so dispatch can find the right
// plugin without parsing the whole document twice.
//
// The directive must appear before any of the flow-type section
// headers (`nodes:`, `edges:`, `steps:`, `story:`, `config:`); after
// one of those, sniff gives up.
export function sniffType(text) {
  if (typeof text !== 'string') return null;
  let scanned = 0;
  for (const raw of text.split('\n')) {
    if (scanned++ > 15) break;
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (/^(nodes|edges|steps|story|config):/i.test(line)) return null;
    const m = line.match(/^type:\s*([\w-]+)/i);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

export default { registerType, getType, listTypes, hasType, sniffType };
