/**
 * AGENTS.md — Build and Development Commands for @retry-labs/flow
 *
 * This file documents the commands and workflows for building,
 * testing, and maintaining the @retry-labs/flow library.
 */

# @retry-labs/flow — Build Commands

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
  - Creates: dist/index.mjs, dist/index.js, dist/flow.umd.js, dist/flow.standalone.js

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
packages/flow/
├── src/
│   ├── index.jsx             # Main entry point (ESM/CJS)
│   ├── bundle-entry.js       # UMD bundle entry
│   ├── standalone-entry.js   # IIFE/standalone entry (defines <rl-flow>)
│   ├── viewport.js           # Vanilla mount() viewport
│   ├── graph.js              # Graph primitives (nodes, edges, routing)
│   ├── shapes.js             # SVG shape generators
│   ├── parser.js             # DSL parser
│   ├── export.js             # SVG export utilities
│   ├── svg-renderer.js       # String-based SVG renderer (no React)
│   ├── diagram-component.jsx # Core React Diagram component
│   ├── styles/
│   │   ├── index.jsx         # Style registration system
│   │   └── renderers.jsx     # Built-in style renderers
│   └── wrappers/
│       ├── react.jsx         # React <RLFlow> wrapper
│       ├── vue.jsx           # Vue 3 <RLFlow> wrapper
│       └── angular.jsx       # Custom element <rl-flow> (Angular-friendly)
├── dist/                     # Built files (generated)
└── scripts/                  # Node-based test suites
```

## Output Files

### dist/

- `index.mjs` — ES Module (modern bundlers, frameworks)
- `index.js` — CommonJS (Node.js, legacy bundlers)
- `flow.umd.js` — UMD bundle (browsers, CDN; requires React on window)
- `flow.standalone.js` — IIFE bundle, React bundled in; exposes `window.RLFlow` and registers `<rl-flow>`
- `*.d.ts` — TypeScript declarations

## Usage Patterns

### React Projects

```jsx
import { RLFlow } from '@retry-labs/flow'

<RLFlow
  dsl={`# DSL config...`}
  style="sleek"
  animate={true}
/>
```

### Vue 3 Projects

```vue
<script setup>
import { RLFlow } from '@retry-labs/flow/dist/wrappers/vue.js'
</script>

<template>
  <RLFlow :config="graph" style="sleek" />
</template>
```

### Plain JavaScript

```javascript
import { mount, parseDSL } from '@retry-labs/flow'

mount('#app', {
  graph: parseDSL(dsl),
  styleName: 'sleek',
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
