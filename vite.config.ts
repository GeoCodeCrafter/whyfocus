import { defineConfig } from 'vite';

// Builds the demo for Pages. The library itself is built by tsup.
export default defineConfig({
  root: 'demo',
  base: './',
  build: { outDir: '../dist-demo', emptyOutDir: true, target: 'es2022' },
});
