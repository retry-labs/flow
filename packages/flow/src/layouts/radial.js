// -----------------------------------------------------------
// Radial layout — root in the center, children fanned out in
// concentric rings. The right choice for mindmaps, classification
// hierarchies, and small "central-concept" diagrams.
//
// Algorithm:
//   1. Pick a root. Either the first node with no incoming edges,
//      or a node explicitly tagged `root: true`, or simply nodes[0].
//   2. BFS to assign depth (= ring number) to each reachable node.
//   3. For each ring, distribute children evenly on an arc whose
//      total angle is proportional to the subtree size — so dense
//      branches get more space than sparse ones.
//
// Hand-rolled, zero deps. Mutates node x/y/w/h in place.
// -----------------------------------------------------------

const DEFAULTS = {
  ringStep:  140,   // px between concentric rings
  cx:        400,   // center x
  cy:        300,   // center y
  startAng:  -Math.PI / 2,  // first child placed straight up
  totalAng:  2 * Math.PI,   // full circle
  nodeW:     140,
  nodeH:     70,
};

export function layoutRadial(nodes, edges, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };

  const layoutables = (nodes || []).filter(n => n && n.kind !== 'boundary');
  if (layoutables.length === 0) return nodes;

  for (const n of layoutables) {
    n.w = n.w || cfg.nodeW;
    n.h = n.h || cfg.nodeH;
  }

  const idx = Object.fromEntries(layoutables.map((n, i) => [n.id, i]));
  const N = layoutables.length;

  // Build adjacency (directed, parent → child).
  const children = layoutables.map(() => []);
  for (const e of edges || []) {
    if (idx[e.from] !== undefined && idx[e.to] !== undefined && e.from !== e.to) {
      children[idx[e.from]].push(idx[e.to]);
    }
  }

  // Pick a root.
  let rootIdx = layoutables.findIndex(n => n.root === true);
  if (rootIdx < 0) {
    const inDeg = new Array(N).fill(0);
    for (const list of children) for (const c of list) inDeg[c]++;
    rootIdx = inDeg.findIndex(d => d === 0);
    if (rootIdx < 0) rootIdx = 0;
  }

  // BFS depth assignment.
  const depth = new Array(N).fill(-1);
  depth[rootIdx] = 0;
  const queue = [rootIdx];
  while (queue.length) {
    const i = queue.shift();
    for (const c of children[i]) {
      if (depth[c] < 0) {
        depth[c] = depth[i] + 1;
        queue.push(c);
      }
    }
  }
  for (let i = 0; i < N; i++) if (depth[i] < 0) depth[i] = 1;  // disconnected → ring 1

  // Subtree-size weighted angular distribution. We assign each child
  // an angular slice proportional to the number of descendants it
  // carries; that way busy branches don't bunch up.
  const size = new Array(N).fill(0);
  function computeSize(i, visited) {
    if (visited.has(i)) return 1;
    visited.add(i);
    let s = 1;
    for (const c of children[i]) s += computeSize(c, visited);
    size[i] = s;
    return s;
  }
  computeSize(rootIdx, new Set());

  // Each node has an angle interval [angStart, angEnd]. Children of
  // a node split their parent's interval proportionally to size[c].
  const angStart = new Array(N).fill(0);
  const angEnd   = new Array(N).fill(0);
  angStart[rootIdx] = cfg.startAng;
  angEnd[rootIdx]   = cfg.startAng + cfg.totalAng;

  function placeChildren(i, visited) {
    if (visited.has(i)) return;
    visited.add(i);
    const kids = children[i].filter(c => !visited.has(c));
    if (kids.length === 0) return;
    const totalKidSize = kids.reduce((a, c) => a + (size[c] || 1), 0);
    const span = angEnd[i] - angStart[i];
    let cursor = angStart[i];
    for (const c of kids) {
      const slice = (size[c] || 1) / totalKidSize * span;
      angStart[c] = cursor;
      angEnd[c]   = cursor + slice;
      cursor += slice;
    }
    for (const c of kids) placeChildren(c, visited);
  }
  placeChildren(rootIdx, new Set());

  // Place each node at the midpoint of its angle slice on its ring.
  for (let i = 0; i < N; i++) {
    const ring = depth[i];
    const mid = (angStart[i] + angEnd[i]) / 2;
    const r = ring * cfg.ringStep;
    const n = layoutables[i];
    if (n.x === undefined) n.x = Math.round(cfg.cx + Math.cos(mid) * r - n.w / 2);
    if (n.y === undefined) n.y = Math.round(cfg.cy + Math.sin(mid) * r - n.h / 2);
  }

  return nodes;
}

export default layoutRadial;
