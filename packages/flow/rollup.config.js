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
  {
    input: 'src/standalone-entry.js',
    output: {
      file: 'dist/flow.standalone.js',
      format: 'iife',
      name: 'RLFlow',
      sourcemap: false,
    },
    plugins: [...sharedPlugins, minifyPlugin],
  },
]
