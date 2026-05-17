# @retry-labs/flow

A versatile SVG diagram library for system architecture, flow charts, and data pipelines. Works in **React**, **Vue 3**, **Angular**, **plain HTML**, **Docusaurus**, **Confluence**, and anywhere you can embed a `<script>` tag.

## Features

- **5 built-in styles** — Sleek, Sketch, Iso, City (3D isometric), Blueprint.
- **DSL parser** — define diagrams as simple YAML-like text. `parseDSL` + `graphToDSL` round-trip cleanly.
- **19 shapes** including `rect`, `cylinder`, `cloud`, `hex`, `pill`, `shield`, `document`, `folder`, `sticky-note`, `person`, plus a `custom-path` escape hatch for arbitrary SVG path data.
- **Images on any node** — drop a logo, screenshot, or data URL into any kind via `image:` with `imageFit` / `imagePosition` for full-bleed or corner placement.
- **Built-in icon sprite library** — `icon: "postgres"` (or `aws-s3`, `kafka`, `nginx`, `k8s`, `docker`, `github`, `react`, etc.) renders a bundled SVG glyph. ~30 common service marks.
- **Smart auto-layout** — omit `x`/`y` and the library lays nodes out by rank.
- **Step player (basic + advanced)** — declare a `steps:` section; the advanced tier adds a progress bar, clickable step dots, and a speed selector.
- **Animated edges** — solid edges draw on when they become active; respects `prefers-reduced-motion`.
- **Bezier curves + self-loops** — `curve: bezier` for a smooth path, `from === to` for a self-loop arc.
- **Sankey-style edge thickness** — `weight: N` scales the stroke width proportionally.
- **Zoom, pan, fullscreen, SVG download** — floating control panel built into every viewport.
- **`mount()` vanilla API** — one call mounts an interactive viewport into any `<div>`. No React required.
- **`<rl-flow>` custom element** — same controls, drop-in for any framework or plain HTML.
- **`RLFlow` framework wrappers** — idiomatic React and Vue components with real props and event handlers.
- **Accessible** — every node and edge gets `<title>` / `<desc>`; the host SVG has `role="img"` + `aria-roledescription="diagram"`.
- **Tree-shakeable ESM and CJS** for bundler stacks; **standalone IIFE** (React bundled in) for `<script>` tags.
- **[Live editor](https://retry-labs.github.io/flow/editor.html)** and **[showcase](https://retry-labs.github.io/flow/showcase.html)** for exploring styles and DSL.
- **Zero runtime dependencies** (React/Vue are peer deps for the npm wrappers; the standalone bundle is fully self-contained).

---

## Install

**From npm** (React, Vue, Svelte, Solid, Angular, Astro, any bundler-based stack):

```bash
npm install @retry-labs/flow
```

Optional peers — only required if you import the matching wrapper:

- `react` and `react-dom` ≥ 17 (for the `RLFlow` React wrapper)
- `vue` ≥ 3 (for the `RLFlow` Vue wrapper)

**From a CDN** (plain HTML, no build step):

```html
<script src="https://unpkg.com/@retry-labs/flow/dist/flow.standalone.js"></script>
```

The standalone bundle is ~78 KB minified, has React bundled in, registers
`<rl-flow>` as a custom element, and exposes the full API on `window.RLFlow`.

| Bundle | Format | Size | Use case |
|---|---|---|---|
| `dist/flow.standalone.js` | IIFE | ~78 KB min | Drop-in script tag. Confluence, Notion, wikis, static HTML. React bundled in. |
| `dist/flow.umd.js` | UMD | ~80 KB | `<script>` tag pages that already load React/ReactDOM. |
| `dist/index.mjs` / `dist/index.js` | ESM / CJS | tree-shakeable | Bundler-based projects. React/Vue are peer deps. |

---

## Usage

The same renderer is exposed through two surfaces. Pick whichever fits your stack — both produce identical SVG output.

| | Wrapper component | `<rl-flow>` custom element |
|---|---|---|
| Import | `import { RLFlow } from '@retry-labs/flow'` | one `<script>` tag or `import '@retry-labs/flow/dist/flow.standalone.js'` |
| Props | real JS props, any type | DOM attributes (strings) + JS properties (objects) |
| Events | `onNodeClick={fn}` | `addEventListener('node-click', fn)` |
| Tree-shaking | yes | no — bundle ships the whole IIFE |
| Idiomatic in | React, Vue | any framework, plain HTML |

Jump to: [Plain HTML](#plain-html--cdn) · [React](#react) · [Next.js](#nextjs-app--pages-router) · [Vue 3](#vue-3) · [Svelte](#svelte) · [Solid](#solidjs) · [Angular](#angular) · [Docusaurus](#docusaurus--mdx) · [Confluence / wikis](#confluence--notion--wikis) · [TypeScript](#typescript)

---

### Plain HTML / CDN

**Imperative — `RLFlow.mount(target, options)`** returns a viewport handle with zoom / pan / fullscreen / download / step playback:

```html
<script src="https://unpkg.com/@retry-labs/flow/dist/flow.standalone.js"></script>

<div id="arch" style="height: 420px"></div>

<script>
  const vp = RLFlow.mount('#arch', {
    graph: RLFlow.parseDSL(`
nodes:
  - id: client, kind: actor,   label: Client
  - id: api,    kind: service, label: API
  - id: db,     kind: store,   label: Postgres
edges:
  - client -> api, label: HTTPS
  - api    -> db,  label: query
    `),
    styleName: 'sleek',
    onNodeClick: (id) => console.log('clicked', id),
  });

  // Later:
  vp.setStyle('city');
  vp.setActive(['client'], ['e-client-api-0']);
  vp.toggleFullscreen();
</script>
```

**Declarative — `<rl-flow>`** is a normal HTML element after the script tag loads:

```html
<script src="https://unpkg.com/@retry-labs/flow/dist/flow.standalone.js"></script>

<rl-flow
  diagram-style="sleek"
  height="420px"
  dsl="
    nodes:
      - id: client, kind: actor,   label: Client
      - id: api,    kind: service, label: API
      - id: db,     kind: store,   label: Postgres
    edges:
      - client -> api, label: HTTPS
      - api    -> db,  label: query
  "
></rl-flow>
```

Observed attributes: `dsl`, `config`, `diagram-style`, `active-nodes`, `active-edges`, `height`, `width`, `controls`, `autoplay`, `interval`, `speed`, `player`. Dispatched events: `node-click`, `edge-click`, `step-change` (all `CustomEvent`s, `event.detail` holds the payload).

#### Step player tiers

`player` accepts:

| Value | What renders |
|---|---|
| `"basic"` (default when `steps:` exists) | Prev / play-pause / next + step counter + caption with the current step's title. |
| `"advanced"` | Basic, plus clickable step dots, a 0.5× / 1× / 2× / 4× speed selector, and a progress bar that fills as the interval ticks. |
| `"off"` (or `false`) | No player UI. Active nodes/edges are still derived from `steps` if you drive them externally. |

The same prop works in every surface — `<rl-flow player="advanced">` in HTML, `<RLFlow player="advanced" />` in React/Vue, and `mount(el, { player: 'advanced' })` from vanilla JS.

---

### React

**Wrapper component (recommended for React apps):**

```jsx
import { RLFlow } from '@retry-labs/flow';

export default function Architecture() {
  return (
    <div style={{ height: 360 }}>
      <RLFlow
        dsl={`
nodes:
  - id: client, kind: actor,   label: Client
  - id: api,    kind: service, label: API
  - id: db,     kind: store,   label: Postgres
edges:
  - client -> api, label: HTTPS
  - api    -> db,  label: query
        `}
        style="sleek"
        activeNodes={['client']}
        onNodeClick={(node) => console.log(node)}
      />
    </div>
  );
}
```

Wrapper props:

| Prop | Type | Description |
|---|---|---|
| `dsl` | `string` | DSL text (alternative to `config`) |
| `config` | `object` | Graph object (alternative to `dsl`) |
| `style` | `string` | `sleek` \| `sketch` \| `iso` \| `city` \| `blueprint` |
| `activeNodes` / `activeEdges` | `string[]` | Highlighted IDs |
| `autoplay`, `interval`, `stepIndex`, `onStepChange` | step player | Enabled when the graph has a `steps:` section |
| `onNodeClick(node)` / `onEdgeClick(edge)` | `fn` | Click handlers |
| `padding` / `className` | misc | |

**Native `<rl-flow>` element** — when you want the universal API or want to avoid pulling React props into the bundle:

```jsx
import { useEffect, useRef } from 'react';
import '@retry-labs/flow/dist/flow.standalone.js'; // registers <rl-flow>

export default function Architecture() {
  const ref = useRef(null);

  useEffect(() => {
    // Object/array props go via the DOM property, not the attribute.
    ref.current.config = {
      nodes: [{ id: 'client', kind: 'actor', label: 'Client', x: 40, y: 100, w: 120, h: 60 }],
      edges: [],
    };
    const onNode = (e) => console.log('clicked', e.detail);
    ref.current.addEventListener('node-click', onNode);
    return () => ref.current?.removeEventListener('node-click', onNode);
  }, []);

  return <rl-flow ref={ref} diagram-style="sleek" height="360px" />;
}
```

On React ≥ 19, lowercase-hyphenated JSX tags write non-string props directly to DOM properties, so the `useEffect` + ref pattern is optional. On React 17/18, use the ref for any object/array props.

---

### Next.js (App or Pages Router)

The standalone bundle touches `window` and registers a custom element — it must only run in the browser. The wrapper component renders to SVG without `window`, but the step player uses `setInterval`, so a client boundary is the cleanest approach:

```jsx
// app/diagram.jsx
'use client';
import { RLFlow } from '@retry-labs/flow';
export default function Diagram(props) { return <RLFlow {...props} />; }
```

```jsx
// app/page.jsx
import dynamic from 'next/dynamic';
const Diagram = dynamic(() => import('./diagram'), { ssr: false });

export default function Page() {
  return <Diagram dsl="…" style="sleek" />;
}
```

For the Pages Router, the same `dynamic(..., { ssr: false })` pattern works in any page file. If you need `<rl-flow>` directly in a Next.js page, gate the bundle import with `useEffect` so it never runs during SSR.

---

### Vue 3

**Wrapper component:**

```vue
<script setup>
import { RLFlow } from '@retry-labs/flow/vue';

const dsl = `
nodes:
  - id: client, kind: actor,   label: Client
  - id: api,    kind: service, label: API
edges:
  - client -> api, label: HTTPS
`;
</script>

<template>
  <RLFlow
    :dsl="dsl"
    style="sleek"
    :active-nodes="['client']"
    @node-click="(n) => console.log(n)"
  />
</template>
```

Player props mirror the React wrapper (`autoplay`, `interval`, `stepIndex`) and an extra `step-change` event is emitted.

**Native `<rl-flow>` element** — tell the Vue compiler to leave the tag alone, then use it like any DOM element:

```js
// vite.config.js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue({
    template: { compilerOptions: { isCustomElement: (tag) => tag === 'rl-flow' } },
  })],
});
```

```vue
<script setup>
import '@retry-labs/flow/dist/flow.standalone.js'; // registers <rl-flow>
import { ref, onMounted } from 'vue';

const el = ref(null);
const graph = { nodes: [/* … */], edges: [/* … */] };

onMounted(() => {
  el.value.config = graph; // object → DOM property
  el.value.addEventListener('node-click', (e) => console.log(e.detail));
});
</script>

<template>
  <rl-flow ref="el" diagram-style="sleek" height="360px" />
</template>
```

`:dsl="dsl"` binds a string attribute directly. For graph objects, set `config` as a JS property as shown (or use the `.prop` modifier in Vue 3.4+).

---

### Svelte

Svelte renders custom elements natively — no compiler config needed:

```svelte
<script>
  import '@retry-labs/flow/dist/flow.standalone.js'; // registers <rl-flow>
  import { onMount } from 'svelte';

  let el;
  const graph = { nodes: [/* … */], edges: [/* … */] };

  onMount(() => {
    el.config = graph;
    el.addEventListener('node-click', (e) => console.log(e.detail));
  });
</script>

<rl-flow bind:this={el} diagram-style="sleek" height="360px" />
```

For pure-DSL diagrams the binding isn't necessary:

```svelte
<rl-flow diagram-style="city" height="360px" dsl="
  nodes:
    - id: a, kind: service, label: A
    - id: b, kind: store,   label: B
  edges:
    - a -> b
"></rl-flow>
```

---

### SolidJS

```jsx
import '@retry-labs/flow/dist/flow.standalone.js';
import { onMount } from 'solid-js';

export default function Diagram() {
  let el;
  onMount(() => {
    el.config = { nodes: [/* … */], edges: [/* … */] };
    el.addEventListener('node-click', (e) => console.log(e.detail));
  });
  return <rl-flow ref={el} diagram-style="sleek" height="360px" />;
}
```

Solid writes JSX non-string props directly to DOM properties on lowercase-hyphenated tags, so the ref pattern is only needed if you set the prop after mount. For DSL strings, `dsl="…"` works as an attribute.

---

### Angular

Angular doesn't ship a wrapper — use `<rl-flow>` directly. Tell the compiler that unknown tags are OK with `CUSTOM_ELEMENTS_SCHEMA`:

```typescript
// app.module.ts
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import '@retry-labs/flow/dist/flow.standalone.js'; // registers <rl-flow>

@NgModule({ schemas: [CUSTOM_ELEMENTS_SCHEMA] })
export class AppModule {}
```

Template — attribute binding for strings (`[attr.foo]`), property binding for objects (`[foo]`), event binding for `CustomEvent`s (`(node-click)`):

```html
<rl-flow
  [attr.dsl]="dsl"
  diagram-style="blueprint"
  active-nodes="client,api"
  height="420px"
  [config]="graph"
  (node-click)="onNode($event)"
  (edge-click)="onEdge($event)">
</rl-flow>
```

```typescript
@Component({/* … */})
export class ArchComponent {
  dsl = 'nodes:\n  - id: a, kind: service, label: A\nedges:';
  graph = null; // or a parsed graph object
  onNode(ev: CustomEvent) { console.log(ev.detail); }
  onEdge(ev: CustomEvent) { console.log(ev.detail); }
}
```

For standalone-components projects, add `CUSTOM_ELEMENTS_SCHEMA` to the component's `schemas:` array instead of the module's.

---

### Docusaurus / MDX

Custom elements only exist in the browser — wrap with `BrowserOnly`:

```jsx
// src/components/RLFlow.jsx
import React from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

export default function RLFlow(props) {
  return (
    <BrowserOnly>
      {() => {
        const { RLFlow } = require('@retry-labs/flow');
        return (
          <div style={{ height: props.height || 350, borderRadius: 12, overflow: 'hidden' }}>
            <RLFlow {...props} />
          </div>
        );
      }}
    </BrowserOnly>
  );
}
```

```mdx
import RLFlow from '@site/src/components/RLFlow';

<RLFlow style="city" dsl={`
nodes:
  - id: user, kind: actor,   label: User
  - id: api,  kind: gateway, label: API
  - id: db,   kind: store,   label: DB
edges:
  - user -> api, label: request
  - api  -> db,  label: query
`} />
```

---

### Confluence / Notion / wikis

Most wikis expose an HTML / iframe macro. Paste the standalone bundle and a `<rl-flow>`:

```html
<rl-flow
  diagram-style="sleek"
  height="380px"
  dsl="
    nodes:
      - id: fe, kind: service, label: Frontend
      - id: be, kind: service, label: Backend
      - id: db, kind: store,   label: Database
    edges:
      - fe -> be, label: REST
      - be -> db, label: SQL
  ">
</rl-flow>
<script src="https://unpkg.com/@retry-labs/flow/dist/flow.standalone.js"></script>
```

For diagrams that change at runtime, set `.config` (object) on the element imperatively:

```html
<rl-flow id="fd" height="380px"></rl-flow>
<script src="https://unpkg.com/@retry-labs/flow/dist/flow.standalone.js"></script>
<script>
  document.getElementById('fd').config = {
    nodes: [
      { id: 'fe', kind: 'service', label: 'Frontend',  x: 40,  y: 150, w: 140, h: 70 },
      { id: 'be', kind: 'service', label: 'Backend',   x: 240, y: 150, w: 140, h: 70 },
      { id: 'db', kind: 'store',   label: 'Database',  x: 440, y: 150, w: 130, h: 70 },
    ],
    edges: [
      { id: 'e1', from: 'fe', to: 'be', label: 'REST' },
      { id: 'e2', from: 'be', to: 'db', label: 'SQL'  },
    ],
  };
</script>
```

---

### TypeScript

Types ship with the package — no `@types/...` install needed:

```typescript
import {
  mount,
  parseDSL,
  renderSVG,
  RLFlow,
} from '@retry-labs/flow';
```

If you reference `<rl-flow>` inside JSX/TSX, add this declaration once so the compiler accepts the tag:

```typescript
// src/types/rl-flow.d.ts
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'rl-flow': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        dsl?: string;
        config?: object;
        'diagram-style'?: string;
        'active-nodes'?: string;
        'active-edges'?: string;
        height?: string;
        width?: string;
      };
    }
  }
}
```

For Vue templates the equivalent goes in `env.d.ts`:

```typescript
declare module 'vue' {
  interface GlobalComponents {
    'rl-flow': any;
  }
}
```

---

## Diagram types

The DSL's first `type:` directive selects the diagram engine. Default
is `flow` (the system-architecture renderer described below). Other
types extend the same parser → IR → SVG pipeline with their own
shape vocabulary.

| Type | Status | Use case |
|---|---|---|
| `flow` (default) | ✅ shipped | System architecture, microservices, data pipelines, generic node-edge diagrams. |
| `sequence` | ✅ shipped | UML-style sequence diagrams: actors, messages, lifelines, activations, loops/alts. |
| `state` | 🚧 roadmap | State machines: states, transitions, entry/exit actions. |
| `er` | 🚧 roadmap | Entity-relationship: tables, attributes, crow's-foot cardinality. |
| `mindmap` | 🚧 roadmap | Radial tree from a root concept. |

Register your own type via `registerType('myType', { parse, renderSVG })`.

### Sequence diagrams

```yaml
type: sequence
title: Login flow

participant Client
participant Server
actor       User
participant DB

User   ->>  Client: enter creds
Client ->>  Server: login(creds)
activate Server
  Server ->> DB:      SELECT user
  DB     -->> Server: row
  Server -->> Client: token
deactivate Server
Note over Server, DB: secured channel

loop every 5 min
  Client ->> Server: heartbeat
  Server -->> Client: ok
end

alt valid
  Server ->> Client: 200 OK
else invalid
  Server ->> Client: 401
end
```

| Syntax | Meaning |
|---|---|
| `participant X` / `actor X` | Declare a column. `actor` renders a stick figure; `participant` a rectangle. |
| `A ->> B: text` | Sync arrow (solid, filled head). |
| `A -->> B: text` | Reply / async arrow (dashed, open head). |
| `A -x B` / `A --x B` | Lost message (red `×` at the target). |
| `A ->> A: text` | Self-message — auto-renders as a loop-back arc. |
| `activate X` / `deactivate X` | Pushes/pops an activation bar on X's lifeline. |
| `Note over A, B: text` | Yellow note spanning the two columns. |
| `Note left of A: text` / `Note right of A: text` | Single-side note. |
| `loop label … end` | Loop frame around contained events. |
| `opt label … end` | Optional frame. |
| `alt label … else label2 … end` | Branching frame; any number of `else` branches. |
| `par label … and label2 … end` | Parallel branches. |

Nesting works (e.g. `alt` inside `loop`). Frames render as labelled
boxes around their contents.

---

## Layout engines

The auto-layout used when nodes have no explicit `x`/`y` is pluggable:

| Engine | Bundled | Default for | Good fit |
|---|---|---|---|
| `dagre` | ✅ | any flow with edges | Sugiyama layered DAG layout. Few crossings, predictable. |
| `rank` | ✅ | edgeless graphs | Cheap left-to-right column placement. |
| `force` | ✅ | — | Fruchterman-Reingold simulation. Deterministic per-id seed. Best for networks. |
| `radial` | ✅ | — | Root-centred concentric rings. Best for mindmaps + hierarchies. |
| `elk` | 🚧 opt-in | — | Heavy ELK port; ships from `@retry-labs/flow/elk`, never bundled in standalone. |

Select per-graph via the `layout:` directive:

```yaml
type: flow
layout: force

nodes:
  - id: a, kind: service, label: A
  - id: b, kind: service, label: B
  ...
```

Register a custom engine via `registerLayout('myLayout', fn)`. The
function receives `(nodes, edges, opts)` and mutates each node's
`x`/`y` in place.

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

### Edge attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `curve` | `'ortho'` (default) \| `'bezier'` | `bezier` draws a smooth curve between the two endpoints instead of the orthogonal routed path. |
| `weight` | number | Scales the stroke width by `sqrt(weight)`. Use this for sankey-style flow diagrams where edge thickness encodes volume. |
| `label` | string | Inline label rendered above the edge midpoint. |

Self-loops are automatic: when `from === to`, the router draws a small arc anchored on the right side of the node.

```yaml
edges:
  - api -> db,  curve: bezier
  - api -> db,  weight: 12         # thick line
  - service -> service             # self-loop
```

### Images & icons on any node

Three ways to put visuals inside a node:

```yaml
nodes:
  # 1. Logo / screenshot via URL or data URL — works on any kind.
  - id: api,    kind: service, label: Orders API,
    image: "https://example.com/orders.svg",
    imageFit: contain,                     # contain (default) | cover | fill
    imagePosition: top                     # top (default) | center | bottom | fill

  # 2. Full-bleed background (image fills the entire shape).
  - id: ui,     kind: rect, label: "",
    image: "data:image/png;base64,iVBORw0...",
    imageFit: cover, imagePosition: fill

  # 3. Built-in icon sprite — no URL needed.
  - id: pg,     kind: store, label: Postgres,  icon: postgres
  - id: cache,  kind: cache, label: Redis,     icon: redis
  - id: queue,  kind: queue, label: Kafka,     icon: kafka
```

Bundled icons (subject to growth): `postgres`, `mysql`, `mongo`, `redis`, `sqlite`, `kafka`, `rabbitmq`, `aws-s3` (alias `s3`), `aws`, `gcp`, `azure`, `k8s`, `docker`, `nginx`, `cloudflare`, `github`, `gitlab`, `git`, `node`, `python`, `go`, `rust`, `java`, `react`, `vue`, `angular`, `svelte`, `graphql`, `jwt`, `user`, `globe`. `listIcons()` returns the full list at runtime.

### Custom shape via raw SVG path

For shapes the built-in catalog doesn't cover, supply your own:

```yaml
nodes:
  - id: star, kind: service, shape: custom-path,
    d: "M50 0 L60 40 L100 50 L60 60 L50 100 L40 60 L0 50 L40 40 Z",
    label: Favorite, w: 100, h: 100
```

`d` is the standard SVG `path` "d" attribute, evaluated in the node's local coordinate system (0,0 → w,h). All edges, labels, and styling still apply.

### Accessibility

Every diagram is screen-reader friendly out of the box:

- The host `<svg>` carries `role="img"` and `aria-roledescription="diagram"` (plus `aria-label` from the graph's optional `title:` directive).
- Every node group has `data-node-id`, `role="img"`, an inline `<title>` (the label), and a `<desc>` (kind + sub).
- Every edge has `data-edge-id` and a `<title>` like `"HTTPS (api → db)"`.
- All step-player animations honour `@media (prefers-reduced-motion: reduce)` — when the user prefers reduced motion, pulse glows, edge draw-on, and the active-edge traveling dot are all suppressed.

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
import { registerStyle } from '@retry-labs/flow';

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
import {
  parseDSL,        // DSL text  → graph object
  graphToDSL,      // graph object → DSL text (round-trip)
  resolveGraph,    // graph → resolved graph (layout + routing)
  renderSVG,       // graph + options → self-contained SVG string
  mount,           // host + options → interactive viewport handle
  downloadSVG,     // svgElement → triggers a download
  listStyles,      // → ['sleek','sketch','iso','city','blueprint']
  registerStyle,   // register your own style module
} from '@retry-labs/flow';

const graph = parseDSL(dsl);
const svg   = renderSVG(graph, { styleName: 'city' });          // SSR-safe
const vp    = mount('#arch', { graph, styleName: 'city' });     // interactive
vp.setStyle('blueprint'); vp.nextStep(); vp.download(); vp.destroy();
```

### Demo pages

Live at [retry-labs.github.io/flow](https://retry-labs.github.io/flow/), source in `website/`:

| Page | Purpose |
|------|---------|
| [Landing](https://retry-labs.github.io/flow/) | Hero, features, install snippets, live example. |
| [Showcase](https://retry-labs.github.io/flow/showcase.html) | Curated gallery of real-world diagrams with DSL/JSON toggles. |
| [Editor](https://retry-labs.github.io/flow/editor.html) | Live DSL editor with style picker and shareable link. |
| [Docs](https://retry-labs.github.io/flow/docs.html) | Full reference — DSL grammar, node/edge gallery, JS API. |

---

## Building from Source

```bash
git clone https://github.com/retry-labs/flow.git
cd flow/packages/flow
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
| `flow.umd.js` | UMD | `<script>` tag, CDN |
| `flow.umd.min.js` | UMD min | Production CDN |

---

## License

MIT © Retry Labs

