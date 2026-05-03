/**
 * Vite configuration for Flow Diagram
 * Supports React and vanilla JS development
 */

import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: './',
  esbuild: {
    jsx: 'automatic',
  },
  build: {
    outDir: 'dist-demo',
    assetsDir: 'assets',
    sourcemap: true,
  },
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  optimizeDeps: {
    exclude: ['react', 'react-dom'],
  },
})
