import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: { bookmarklet: 'src/entries/bookmarklet.ts' },
    format: ['iife'],
    minify: true,
    sourcemap: false,
  },
]);
