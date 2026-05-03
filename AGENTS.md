/**
 * AGENTS.md - Build and Development Commands for Flow Diagram
 * 
 * This file documents the commands and workflows for building,
 * testing, and maintaining the Flow Diagram library.
 */

# Flow Diagram - Build Commands

## ⚠️ Hard Rule for AI Agents — Never Use Terminal for Code Changes

**ALL file creation and editing MUST go through dedicated editing tools
(`write_to_file`, `edit`, `multi_edit`).** The terminal is never used to
mutate files, not even for quick fixes.

Forbidden in terminal commands:
- `sed -i`, `awk -i`, `echo > file`, `cat > file`, `tee file`, `perl -i`,
  heredocs that write files, inline `node -e "... fs.writeFileSync ..."`.

Terminal is allowed only for:
- Running build, test, lint scripts (e.g. `npm run build`, `node scripts/smoke-test.cjs`).
- Read-only introspection (`ls`, `cat` to show output).
- Starting dev servers / long-running processes.

If a one-off verification needs a new script, create it as a real file
with `write_to_file` first, then execute it via `run_command`.

## Quick Start

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build library
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Available Commands

### Development

- `npm run dev`
  - Starts Vite dev server
  - Serves the demo at http://localhost:3000
  - Hot reload for development

- `npm run preview`
  - Preview production build locally

### Building

- `npm run build`
  - Runs full build pipeline
  - Generates ESM, CJS, and UMD bundles
  - Creates TypeScript declarations
  - Output: `dist/` directory

- `npm run build:lib`
  - Builds library bundles (Rollup)
  - Creates: dist/index.mjs, dist/index.js, dist/flow-diagram.umd.js

- `npm run build:types`
  - Generates TypeScript declarations only
  - Output: dist/*.d.ts

- `npm run build:watch`
  - Builds with Rollup in watch mode

### Quality Checks

- `npm run typecheck`
  - Runs TypeScript compiler (no emit)
  - Catches type errors

- `npm run lint`
  - Runs ESLint on source files
  - Enforces code style

## Project Structure

```
flow-diagram/
├── src/
│   ├── index.js              # Main entry point
│   ├── bundle-entry.js       # UMD bundle entry
│   ├── graph.js              # Graph primitives (nodes, edges, routing)
│   ├── shapes.js             # SVG shape generators
│   ├── parser.js             # DSL parser
│   ├── export.js             # SVG export utilities
│   ├── styles/
│   │   └── index.js          # Style registration system
│   ├── diagram-component.js  # Core Diagram React component
│   ├── wrappers/
│   │   ├── react.js          # React wrapper
│   │   ├── vue.js            # Vue 3 wrapper
│   │   └── angular.js        # Angular directive/module
│   └── dsl-utils.js          # DSL utilities and templates
├── dist/                     # Built files (generated)
├── src/renderers.jsx         # Style renderers (legacy)
├── src/graph.jsx             # Graph utilities (legacy)
└── index.html                # Demo application
```

## Output Files

### dist/

- `index.mjs` - ES Module (modern bundlers, frameworks)
- `index.js` - CommonJS (Node.js, legacy bundlers)
- `flow-diagram.umd.js` - UMD bundle (browsers, CDN)
- `flow-diagram.umd.min.js` - Minified UMD
- `*.d.ts` - TypeScript declarations

## Usage Patterns

### React Projects

```jsx
import { FlowDiagram } from 'flow-diagram'

<FlowDiagram
  dsl={`# DSL config...`}
  style="sleek"
  animate={true}
/>
```

### Vue 3 Projects

```vue
<script setup>
import { FlowDiagram } from 'flow-diagram'
</script>

<template>
  <FlowDiagram :config="graph" style="sleek" />
</template>
```

### Plain JavaScript

```javascript
import { Diagram } from 'flow-diagram'

const diagram = new Diagram({
  container: '#app',
  graph: config,
  style: 'sleek'
})
```

## Adding a New Style

1. Create style module in `src/styles/`
2. Implement: `Defs`, `Node`, `Edge`, `Background`, `tokens`
3. Register it: `registerStyle('my-style', MyStyle)`
4. Update tests and documentation

## Testing

The library uses the existing demo as a test bed. Run `npm run dev` and verify:
- All examples render correctly
- Styles switch properly
- DSL parsing works
- Animations play smoothly
- Export/download works

## Troubleshooting

### Build Fails

```bash
# Clean and rebuild
rm -rf dist node_modules/.cache
npm install
npm run build
```

### Type Errors

```bash
# Run type check
npm run typecheck

# Check TypeScript config
cat tsconfig.json
```

### Module Resolution

If importing fails, check:
- `package.json` exports field
- File paths in imports
- Build output in `dist/`

## Contributing

1. Make changes in `src/`
2. Run `npm run build` to verify
3. Run `npm run dev` to test
4. Update documentation
5. Submit PR

## License

MIT
