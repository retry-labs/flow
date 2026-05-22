/**
 * Rollup configuration for @retry-labs/flow
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import terser from '@rollup/plugin-terser'
import babel from '@rollup/plugin-babel'
import replace from '@rollup/plugin-replace'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'))

const replaceVersion = replace({
  preventAssignment: true,
  values: { '__VERSION__': pkg.version },
})

const sharedPlugins = [
  replaceVersion,
  nodeResolve({
    browser: true,
    preferBuiltins: false,
    extensions: ['.jsx', '.js', '.json']
  }),
  commonjs({
    include: /node_modules/
  }),
  babel({
    babelHelpers: 'bundled',
    exclude: 'node_modules/**',
    extensions: ['.jsx', '.js'],
    presets: ['@babel/preset-react']
  })
]

const minifyPlugin = terser({
  compress: {
    drop_console: false,
    passes: 2
  },
  mangle: {
    reserved: ['RLFlow', 'NODE_KINDS', 'SHAPES']
  }
})

// For framework bundles — React/Vue are peer deps, not bundled in
const external = ['react', 'react-dom', 'react-dom/client', 'vue'];
const globals = { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM', vue: 'Vue' };

export default [
  // ESM bundle — main entry. React is a peer dep; Vue is NOT pulled in here
  // (Vue users import from '@retry-labs/flow/vue').
  {
    input: 'src/index.jsx',
    output: { file: 'dist/index.mjs', format: 'es', sourcemap: true },
    plugins: sharedPlugins,
    external,
  },

  // CommonJS bundle — Node.js / legacy bundlers (React is peer dep).
  // Note: extension is .cjs because the package is `"type": "module"`.
  {
    input: 'src/index.jsx',
    output: { file: 'dist/index.cjs', format: 'cjs', sourcemap: true, exports: 'named' },
    plugins: sharedPlugins,
    external,
  },

  // Vue subpath — ESM
  {
    input: 'src/wrappers/vue.jsx',
    output: { file: 'dist/vue.mjs', format: 'es', sourcemap: true },
    plugins: sharedPlugins,
    external,
  },

  // Vue subpath — CJS (.cjs because package is "type": "module")
  {
    input: 'src/wrappers/vue.jsx',
    output: { file: 'dist/vue.cjs', format: 'cjs', sourcemap: true, exports: 'named' },
    plugins: sharedPlugins,
    external,
  },

  // UMD bundle — requires React on window.React (like CDN users)
  {
    input: 'src/bundle-entry.js',
    output: {
      file: 'dist/flow.umd.js',
      format: 'umd',
      name: 'RLFlow',
      sourcemap: true,
      globals,
    },
    plugins: sharedPlugins,
    external,
  },

  // Standalone bundle — React BUNDLED IN. Intended for pages that do NOT
  // already use React (Confluence, wikis, static HTML, Notion embeds).
  // For React/Vue apps, use the ESM package (index.mjs) or the Vue subpath
  // instead — React is a peer dep there and only one copy ever exists.
  //
  // Double-load resilience: the `intro` lives inside the IIFE function
  // body. If a previous copy of the bundle has already published
  // `window.RLFlow.__loaded`, we return it immediately. Rollup's
  // `var RLFlow = (function (exports) { ... }({}))` wrapper then assigns
  // the existing window.RLFlow back to itself — so function identity is
  // preserved across duplicate <script> tags and any user-registered
  // types/layouts on the first load stay live.
  {
    input: 'src/standalone-entry.js',
    output: {
      file: 'dist/flow.standalone.js',
      format: 'iife',
      name: 'RLFlow',
      sourcemap: false,
      intro:
        'if (typeof window !== "undefined" && window.RLFlow && window.RLFlow.__loaded) {' +
          'if (!window.RLFlow.__warned) {' +
            'var __rlfv = window.RLFlow.version || "?";' +
            'var __rlfh = "' + pkg.version + '";' +
            'console.warn(__rlfv === __rlfh' +
              ' ? "[RLFlow] standalone bundle loaded more than once (v" + __rlfv + "); the first copy stays in effect."' +
              ' : "[RLFlow] standalone bundle loaded twice with different versions (existing v" + __rlfv + ", second v" + __rlfh + "); the first copy stays in effect. Consolidate your <script> tags.");' +
            'window.RLFlow.__warned = true;' +
          '}' +
          'return window.RLFlow;' +
        '}',
      // Belt-and-braces global assignment. Rollup's IIFE wrapper does
      // `var RLFlow = (function (exports) {...}({}))` which assigns to
      // `window.RLFlow` only in environments where top-level `var` lands
      // on the global object (browsers). In a Node `eval()` context that
      // doesn't happen — our test harness relies on the explicit
      // assignment, and so do `<script type="module">` consumers.
      outro: 'if (typeof window !== "undefined") window.RLFlow = exports;',
    },
    plugins: [...sharedPlugins, minifyPlugin],
  },
]
