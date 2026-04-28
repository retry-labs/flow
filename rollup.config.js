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

export default [
  // UMD bundle for browsers (standalone)
  {
    input: 'src/bundle-entry.jsx',
    output: {
      file: 'dist/flow-diagram.umd.js',
      format: 'umd',
      name: 'FlowDiagram',
      sourcemap: true,
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM'
      }
    },
    plugins: [
      ...sharedPlugins,
      minifyPlugin
    ],
    external: ['react', 'react-dom']
  },

  // ESM bundle for modern frameworks
  {
    input: 'src/index.jsx',
    output: {
      file: 'dist/index.mjs',
      format: 'es',
      sourcemap: true
    },
    plugins: sharedPlugins,
    external: ['react', 'react-dom']
  },

  // CommonJS bundle for Node/legacy
  {
    input: 'src/index.jsx',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true
    },
    plugins: sharedPlugins,
    external: ['react', 'react-dom']
  }
]
