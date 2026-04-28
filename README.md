/**
 * README - Flow Diagram Library
 * 
 * A versatile diagramming library for system architecture and flow diagrams.
 * Zero-dependency, works in React, Vue, Angular, or plain HTML.
 * 
 * @package flow-diagram
 * @version 0.1.0
 */

# Flow Diagram

[![npm version](https://img.shields.io/npm/v/flow-diagram.svg)](https://www.npmjs.com/package/flow-diagram)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/flow-diagram)](https://bundlephobia.com/package/flow-diagram)

A visual library for system, process, and architecture diagrams. Write a few lines of config; get a diagram you can render in four distinct aesthetics, animate step-by-step, and drop into docs, a Notion page, or a Docusaurus site.

## Features

- **Zero Dependencies** (React is optional peer dependency for React wrapper)
- **Multiple Framework Support**: React, Vue, Angular, or plain JavaScript
- **Built-in Styles**: Sleek, Sketch, Isometric, Blueprint
- **DSL Support**: YAML-like syntax for quick diagramming
- **Animation**: Step-by-step playback for narrating systems
- **Export**: Download diagrams as SVG
- **TypeScript Support**: Full type definitions included
- **Extensible**: Register your own styles and node types

## Installation

### NPM / Yarn

```bash
npm install flow-diagram
# or
yarn add flow-diagram
```

### CDN (UMD)

```html
<script src="https://unpkg.com/flow-diagram/dist/flow-diagram.umd.js"></script>
```

## Quick Start

### React

```jsx
import { FlowDiagram } from 'flow-diagram'

function App() {
  const dslConfig = `# My System
nodes:
  - id: client type: actor label: "Client"
  - id: api type: gateway label: "API"
  - id: db type: store label: "Database"

edges:
  - client -> api label: "Request"
  - api -> db label: "Query"`

  return (
    <FlowDiagram 
      dsl={dslConfig}
      style="sleek"
      animate={true}
    />
  )
}
```

### Vue 3

```vue
<script setup>
import { FlowDiagram } from 'flow-diagram'

const graphConfig = {
  nodes: [
    { id: 'client', kind: 'actor', label: 'Client', x: 40, y: 100, w: 100, h: 60 },
    { id: 'server', kind: 'service', label: 'Server', x: 200, y: 100, w: 120, h: 60 }
  ],
  edges: [
    { id: 'e1', from: 'client', to: 'server', kind: 'solid', label: 'Request' }
  ]
}
</script>

<template>
  <FlowDiagram 
    :config="graphConfig"
    style="sleek"
    :animate="true"
    @node-click="handleNodeClick"
  />
</template>
```

### Angular

```typescript
import { Component } from '@angular/core'
import { FlowDiagramModule } from 'flow-diagram'

@Component({
  selector: 'app-diagram',
  template: `
    <flow-diagram 
      [config]="graphConfig"
      style="sleek"
      [animate]="true"
      (nodeClick)="onNodeClick($event)">
    </flow-diagram>
  `,
  imports: [FlowDiagramModule]
})
export class DiagramComponent {
  graphConfig = {
    nodes: [
      { id: 'client', kind: 'actor', label: 'Client', x: 40, y: 100, w: 100, h: 60 }
    ],
    edges: []
  }

  onNodeClick(node: any) {
    console.log('Node clicked:', node)
  }
}
```

### Plain JavaScript / Static HTML

```html
<script type="module">
  import { Diagram } from 'flow-diagram'

  const graph = {
    nodes: [
      { id: 'a', kind: 'service', label: 'Service A', x: 50, y: 50, w: 120, h: 60 },
      { id: 'b', kind: 'store', label: 'DB', x: 250, y: 50, w: 100, h: 70 }
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b', kind: 'solid', label: 'Query' }
    ]
  }

  const diagram = new Diagram({
    container: '#diagram',
    graph,
    style: 'sleek'
  })
</script>

<div id="diagram"></div>
```

## DSL Syntax

Flow includes a simple YAML-like DSL for defining diagrams:

```yaml
# flow.yml
nodes:
  - id: client    type: actor     label: "Client"
  - id: api       type: gateway   label: "API Gateway"
  - id: orders    type: service   label: "Orders"     sub: "v4.2.1"
  - id: db        type: store     label: "Postgres"

edges:
  - client  -> api    label: "HTTPS"
  - api     -> orders label: "POST /order"
  - orders  -> db     label: "Write"
  - api     -> db     label: "Audit"     # optional
```

### Edge Types

- `->` : Solid line
- `..>` : Dashed line

### Node Types

**System:** `service`, `store`, `cache`, `queue`, `actor`, `gateway`, `external`, `boundary`  
**Process:** `start`, `stop`, `decision`, `process`, `event`, `step`, `tree`  
**Media:** `image`  
**Special:** `function`, `worker`, `loadbalancer`, `cdn`, `auth`, `monitor`, `bus`, `stream`, `firewall`, `mobile`

## API Reference

### Diagram Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `graph` | Object | - | Graph configuration with nodes, edges, canvas |
| `style` | String | `'sleek'` | Style name: `sleek`, `sketch`, `iso`, `blueprint` |
| `activeNodes` | Array | `[]` | Node IDs to highlight |
| `activeEdges` | Array | `[]` | Edge IDs to highlight |
| `padding` | Number | `0` | Padding around diagram |
| `animate` | Boolean | `true` | Enable animations |
| `onNodeClick` | Function | - | Click handler for nodes |
| `onEdgeClick` | Function | - | Click handler for edges |
| `showControls` | Boolean | `false` | Show download/fullscreen controls |

### Graph Object Structure

```typescript
interface Graph {
  canvas: {
    w: number  // width
    h: number  // height
    grid?: number
  }
  nodes: Array<{
    id: string
    label: string
    kind?: string
    shape?: string
    x?: number
    y?: number
    w?: number
    h?: number
    sub?: string
  }>
  edges: Array<{
    id: string
    from: string
    to: string
    kind?: 'solid' | 'dashed'
    label?: string
  }>
}
```

### Core Functions

```javascript
import { parseDSL, resolveGraph, Diagram } from 'flow-diagram'

// Parse DSL string
const graph = parseDSL(`
  nodes:
    - id: a label: "Node A"
  edges:
    - from: a to: b
`)

// Resolve graph (compute layouts)
const resolved = resolveGraph(graph)

// Use in React
<Diagram graph={resolved} />
```

### Style Registration

```javascript
import { registerStyle } from 'flow-diagram'

const neonStyle = {
  id: 'neon',
  tokens: {
    bg: '#0a0a0f',
    nodeBg: '#1a1a2e',
    nodeBorder: '#00f5ff',
    edge: '#00f5ff',
    edgeActive: '#ff00ff'
  },
  Node: ({ node, active, pulse }) => {
    // Custom node renderer
    return <g>...</g>
  },
  Edge: ({ edge, active, progress }) => {
    // Custom edge renderer
    return <g>...</g>
  },
  Defs: () => {
    // SVG definitions
    return <defs>...</defs>
  },
  Background: ({ width, height, grid }) => {
    // Background renderer
    return <rect width={width} height={height} fill="#0a0a0f" />
  }
}

registerStyle('neon', neonStyle)
```

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build library
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## Examples

### Microservices Architecture

```yaml
nodes:
  - id: client  type: actor    label: "Web App"
  - id: api     type: gateway  label: "API Gateway"
  - id: auth    type: service  label: "Auth"
  - id: orders  type: service  label: "Orders"
  - id: db      type: store    label: "Postgres"

edges:
  - web    -> api      label: "HTTPS"
  - api    -> auth     label: "verify"
  - api    -> orders   label: "POST /order"
  - orders -> db       label: "write"
```

### Event-Driven System

```yaml
nodes:
  - id: producer type: service  label: "Producer"
  - id: broker   type: queue    label: "Message Broker"
  - id: consumer type: service  label: "Consumer"

edges:
  - producer -> broker   label: "Publish"
  - broker    -> consumer label: "Subscribe"
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT
