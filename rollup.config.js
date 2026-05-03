/**
 * Rollup configuration for Flow Diagram
 */

import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import terser from '@rollup/plugin-terser'
import babel from '@rollup/plugin-babel'

const sharedPlugins = [
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
    reserved: ['Flow', 'Diagram', 'NODE_KINDS', 'SHAPES']
  }
})

// For framework bundles — React/Vue are peer deps, not bundled in
const external = ['react', 'react-dom', 'react-dom/client', 'vue'];
const globals = { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM', vue: 'Vue' };

export default [
  // ESM bundle — for React, Vue, modern bundlers (React is peer dep)
  {
    input: 'src/index.jsx',
    output: { file: 'dist/index.mjs', format: 'es', sourcemap: true },
    plugins: sharedPlugins,
    external,
  },

  // CommonJS bundle — Node.js / legacy bundlers (React is peer dep)
  {
    input: 'src/index.jsx',
    output: { file: 'dist/index.js', format: 'cjs', sourcemap: true },
    plugins: sharedPlugins,
    external,
  },

  // UMD bundle — requires React on window.React (like CDN users)
  {
    input: 'src/bundle-entry.js',
    output: {
      file: 'dist/flow-diagram.umd.js',
      format: 'umd',
      name: 'FlowDiagram',
      sourcemap: true,
      globals,
    },
    plugins: sharedPlugins,
    external,
  },

  // Standalone bundle — React BUNDLED IN. Intended for pages that do NOT
  // already use React (Confluence, wikis, static HTML, Notion embeds).
  // For React/Vue apps, use the ESM package (index.mjs) instead — React
  // is a peer dep there and only one copy ever exists.
  {
    input: 'src/standalone-entry.js',
    output: {
      file: 'dist/flow-diagram.standalone.js',
      format: 'iife',
      name: 'FlowDiagram',
      sourcemap: false,
    },
    plugins: [...sharedPlugins, minifyPlugin],
  },
]
