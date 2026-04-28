/**
 * Vite configuration for Flow Diagram
 * Supports React and vanilla JS development
 */

import { defineConfig } from 'vite'
import react from '@babel-preset-react'

export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist-demo',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: '/index.html',
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['flow-diagram']
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
})
