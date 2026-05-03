# flow-diagram

A versatile SVG diagram library for system architecture, flow charts, and data pipelines. Works in **React**, **Vue 3**, **Angular**, **plain HTML**, **Docusaurus**, **Confluence**, and anywhere you can embed a `<script>` tag.

## Features

- 5 built-in styles — **Sleek**, **Sketch**, **Iso** (isometric), **City** (3D isometric), **Blueprint**
- DSL parser — define diagrams as simple YAML-like text
- Step-by-step animation support (walkthrough stories)
- Zoom, pan, fullscreen, SVG/PNG export — built-in
- `<flow-diagram>` Web Component — zero framework required
- Tree-shakeable ESM, CJS, and UMD bundles
- Zero runtime dependencies (React/Vue are peer deps)

---

## One file. Zero dependencies.

Like Mermaid — drop one `<script>` tag and start drawing:

```html
<script src="https://unpkg.com/flow-diagram/dist/flow-diagram.standalone.js"></script>

<flow-diagram id="d1" diagram-style="sleek" height="340px"></flow-diagram>

<script>
  document.getElementById('d1').config = {
    canvas: { w: 700, h: 300 },
    nodes: [
      { id: 'client',  kind: 'actor',   label: 'Client',   x: 40,  y: 110, w: 130, h: 70 },
      { id: 'gateway', kind: 'gateway', label: 'Gateway',  x: 230, y: 110, w: 150, h: 70 },
      { id: 'db',      kind: 'store',   label: 'Postgres', x: 450, y: 110, w: 130, h: 70 },
    ],
    edges: [
      { id: 'e1', from: 'client',  to: 'gateway', label: 'HTTPS' },
      { id: 'e2', from: 'gateway', to: 'db',      label: 'SQL' },
    ],
  };
</script>
```

**Zero dependencies — not even React.** The standalone file is a pure SVG renderer (52KB). It works safely on any page including Confluence, Notion, React apps, Angular apps — no framework conflicts possible.

| File | Size | Use case |
|------|------|----------|
| `flow-diagram.standalone.js` | 52KB | Static HTML, Confluence, Notion, wikis — **no React needed** |
| `flow-diagram.umd.js` | 149KB | CDN pages that already load React/ReactDOM |
| `index.mjs` | 142KB | React/Vue npm projects (React is peer dep) |

---

## Installation (npm)

```bash
npm install flow-diagram
```

---

## Quick Start

### React

```jsx
import { FlowDiagram } from 'flow-diagram';

const dsl = `
nodes:
  - id: client  kind: actor    label: Client     x: 40  y: 100 w: 120 h: 60
  - id: api     kind: gateway  label: API Gateway x: 220 y: 100 w: 150 h: 60
  - id: db      kind: store    label: Postgres    x: 440 y: 100 w: 130 h: 70
edges:
  - client -> api  label: "HTTPS"
  - api -> db      label: "SQL"
`;

export default function App() {
  return (
    <div style={{ height: 300 }}>
      <FlowDiagram dsl={dsl} style="sleek" />
    </div>
  );
}
```

Pass a JS object instead of DSL:

```jsx
import { FlowDiagram } from 'flow-diagram';

const graph = {
  canvas: { w: 600, h: 300 },
  nodes: [
    { id: 'client', kind: 'actor',   label: 'Client',  x: 40,  y: 110, w: 120, h: 60 },
    { id: 'api',    kind: 'gateway', label: 'Gateway', x: 220, y: 110, w: 150, h: 60 },
  ],
  edges: [
    { id: 'e1', from: 'client', to: 'api', kind: 'solid', label: 'HTTPS' },
  ],
};

<FlowDiagram config={graph} style="blueprint" activeNodes={['client']} />
```

Available props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `dsl` | `string` | — | DSL text (alternative to `config`) |
| `config` | `object` | — | Graph object |
| `style` | `string` | `"sleek"` | `sleek` \| `sketch` \| `iso` \| `city` \| `blueprint` |
| `activeNodes` | `string[]` | `[]` | Highlighted node IDs |
| `activeEdges` | `string[]` | `[]` | Highlighted edge IDs |
| `onNodeClick` | `fn(node)` | — | Node click handler |
| `onEdgeClick` | `fn(edge)` | — | Edge click handler |
| `padding` | `number` | `28` | SVG padding in px |
| `className` | `string` | — | CSS class on container |

---

### Vue 3

```vue
<script setup>
import { VueFlowDiagram } from 'flow-diagram';

const dsl = `
nodes:
  - id: svc  kind: service  label: Orders  x: 40  y: 60 w: 140 h: 70
  - id: db   kind: store    label: Postgres x: 240 y: 60 w: 130 h: 70
edges:
  - svc -> db  label: "SQL"
`;
</script>

<template>
  <div style="height: 300px">
    <VueFlowDiagram :dsl="dsl" style-name="sleek" />
  </div>
</template>
```

---

### Angular

Angular projects use the `<flow-diagram>` Web Component. Register it in your module:

```typescript
// app.module.ts
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import 'flow-diagram/dist/flow-diagram.umd.js'; // registers <flow-diagram>

@NgModule({
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {}
```

In your template:

```html
<flow-diagram
  dsl="nodes:\n  - id: a  kind: service  label: Orders\nedges:"
  diagram-style="sleek"
  height="350px">
</flow-diagram>
```

Or set the `config` property imperatively:

```typescript
@ViewChild('diagram') diagramRef!: ElementRef;

ngAfterViewInit() {
  this.diagramRef.nativeElement.config = {
    canvas: { w: 600, h: 300 },
    nodes: [{ id: 'svc', kind: 'service', label: 'Orders', x: 40, y: 100, w: 140, h: 70 }],
    edges: [],
  };
}
```

The element fires `node-click` and `edge-click` custom events.

---

### Plain HTML / Static Sites

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/flow-diagram/dist/flow-diagram.umd.min.js"></script>
</head>
<body>
  <flow-diagram id="d1" diagram-style="sleek" height="400px"></flow-diagram>

  <script>
    document.getElementById('d1').config = {
      canvas: { w: 700, h: 350 },
      nodes: [
        { id: 'client',  kind: 'actor',   label: 'Client',  x: 40,  y: 140, w: 130, h: 70 },
        { id: 'gateway', kind: 'gateway', label: 'Gateway', x: 230, y: 140, w: 150, h: 70 },
        { id: 'db',      kind: 'store',   label: 'Postgres',x: 450, y: 140, w: 130, h: 70 },
      ],
      edges: [
        { id: 'e1', from: 'client',  to: 'gateway', label: 'HTTPS' },
        { id: 'e2', from: 'gateway', to: 'db',      label: 'SQL' },
      ],
    };
  </script>
</body>
</html>
```

---

## Docusaurus

In `docusaurus.config.js` add `customFields` and use a React MDX component:

```jsx
// src/components/FlowDiagram.jsx
import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

export default function Diagram(props) {
  return (
    <BrowserOnly>
      {() => {
        const { FlowDiagram } = require('flow-diagram');
        return (
          <div style={{ height: props.height || 350, borderRadius: 12, overflow: 'hidden' }}>
            <FlowDiagram {...props} />
          </div>
        );
      }}
    </BrowserOnly>
  );
}
```

Then in any `.mdx` page:

```mdx
import Diagram from '@site/src/components/FlowDiagram';

<Diagram style="sleek" dsl={`
nodes:
  - id: user   kind: actor    label: User    x: 40  y: 100 w: 120 h: 60
  - id: api    kind: gateway  label: API     x: 220 y: 100 w: 140 h: 60
  - id: store  kind: store    label: DB      x: 420 y: 100 w: 120 h: 70
edges:
  - user -> api   label: "request"
  - api -> store  label: "query"
`} />
```

---

## Confluence / Wiki (HTML macro)

Paste into a **HTML macro** or **iframe**:

```html
<div id="flow-root" style="height:400px"></div>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/flow-diagram/dist/flow-diagram.umd.min.js"></script>
<script>
  document.getElementById('flow-root').innerHTML = '<flow-diagram id="fd" height="380px"></flow-diagram>';
  document.getElementById('fd').config = {
    canvas: { w: 800, h: 380 },
    nodes: [
      { id: 'fe',  kind: 'service', label: 'Frontend',  x: 40,  y: 150, w: 140, h: 70 },
      { id: 'be',  kind: 'service', label: 'Backend',   x: 240, y: 150, w: 140, h: 70 },
      { id: 'db',  kind: 'store',   label: 'Database',  x: 440, y: 150, w: 130, h: 70 },
      { id: 'cdn', kind: 'cdn',     label: 'CDN',       x: 640, y: 150, w: 120, h: 70 },
    ],
    edges: [
      { id: 'e1', from: 'fe',  to: 'be',  label: 'REST' },
      { id: 'e2', from: 'be',  to: 'db',  label: 'SQL'  },
      { id: 'e3', from: 'fe',  to: 'cdn', label: 'assets', kind: 'dashed' },
    ],
  };
</script>
```

---

## DSL Reference

```yaml
# Optional canvas config
config:
  gapX: 180       # horizontal spacing for auto-layout
  gapY: 120       # vertical spacing
  nodesPerRow: 3  # columns before wrapping

nodes:
  - id: svc  kind: service   label: "Orders"    x: 40  y: 60  w: 140 h: 70
  - id: db   kind: store     label: "Postgres"  x: 240 y: 60  w: 130 h: 70
  - id: gw   kind: gateway   label: "Gateway"   x: 40  y: 200 w: 150 h: 70

edges:
  - svc -> db    label: "SQL"
  - gw  -> svc   label: "REST"   kind: solid
  - gw  ..> db   # dashed edge (..> shorthand)

# Optional step-by-step walkthrough
steps:
  - title: "Request arrives" nodes: [gw] edges: []
  - title: "Route to service" nodes: [gw, svc] edges: [e1]
  - title: "Persist" nodes: [svc, db] edges: [e2]
```

### Node kinds

| Kind | Shape | Description |
|------|-------|-------------|
| `service` | rect | Generic service / microservice |
| `store` | cylinder | Database / data store |
| `cache` | rect | Cache (Redis, Memcached) |
| `queue` | rect | Message queue / broker |
| `actor` | rect | User / client |
| `gateway` | hex | API gateway / load balancer |
| `external` | cloud | External system / SaaS |
| `boundary` | dashed rect | Logical boundary / zone |
| `start` / `stop` | pill | Flow start/end |
| `decision` | diamond | Decision point |
| `event` | circle | Event / trigger |
| `function` | rect | Serverless function / lambda |
| `worker` | rect | Background worker |
| `loadbalancer` | rect | Load balancer |
| `auth` | shield | Auth / security service |
| `monitor` | rect | Monitoring / metrics |
| `bus` | rect | Event bus |
| `stream` | rect | Data stream |
| `firewall` | rect | Firewall |
| `cdn` | cloud | CDN |
| `mobile` | tablet | Mobile app |

### Edge kinds

| Kind | Appearance |
|------|-----------|
| `solid` | Solid line with arrow |
| `dashed` | Dashed line |
| `dotted` | Dotted line |
| `bold` | Thick line |
| `async` | Dash-dot pattern |
| `bidir` | Bidirectional arrows |
| `realtime` | Animated flowing line |
| `secure` | Line with padlock icon |
| `error` | Red line with ✕ icon |

---

## Styles

| Style | Description |
|-------|-------------|
| `sleek` | Warm white, yellow accent, dot grid. Default. |
| `sketch` | Hand-drawn look on warm paper background. |
| `iso` | Flat isometric with coloured pipe edges. |
| `city` | True 3D isometric — clay blocks, volumetric pipes. |
| `blueprint` | Cyan on navy. Technical drawing aesthetic. |

---

## Custom Styles

```js
import { registerStyle } from 'flow-diagram';

registerStyle('dark', {
  id: 'dark',
  name: 'Dark',
  tokens: { bg: '#0f172a', ink: '#f8fafc', muted: '#94a3b8', accent: '#7c3aed', line: '#334155' },
  Defs: () => null,
  Background: ({ w, h }) => <rect width={w} height={h} fill="#0f172a" />,
  Node: ({ node, active }) => (
    <g transform={`translate(${node.x} ${node.y})`}>
      <rect width={node.w} height={node.h} rx={10} fill={active ? '#7c3aed' : '#1e293b'} stroke="#334155"/>
      <text x={node.w/2} y={node.h/2+4} textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="600">{node.label}</text>
    </g>
  ),
  Edge: ({ edge, active }) => (
    <path d={edge.d} fill="none" stroke={active ? '#7c3aed' : '#475569'} strokeWidth="1.5"
      markerEnd="url(#dark-arrow)"/>
  ),
});
```

---

## Programmatic API

```js
import { parseDSL, resolveGraph, downloadSVG, listStyles } from 'flow-diagram';

// Parse DSL text → graph object
const graph = parseDSL(dslText);

// Resolve graph (compute edge routes, sort nodes)
const resolved = resolveGraph(graph);

// Download the SVG from a ref
downloadSVG(svgElement, 'my-diagram.svg');

// List available styles
console.log(listStyles()); // ['sleek', 'sketch', 'iso', 'city', 'blueprint']
```

---

## Building from Source

```bash
git clone https://github.com/your-org/flow-diagram
cd flow-diagram
npm install

npm run dev        # dev server at http://localhost:3000
npm run build      # builds all bundles → dist/
npm run typecheck  # TypeScript check
npm run lint       # ESLint
```

Output files in `dist/`:

| File | Format | Use case |
|------|--------|----------|
| `index.mjs` | ESM | React, Vue, modern bundlers |
| `index.js` | CJS | Node.js, legacy bundlers |
| `flow-diagram.umd.js` | UMD | `<script>` tag, CDN |
| `flow-diagram.umd.min.js` | UMD min | Production CDN |

---

## License

MIT © Flow Team

