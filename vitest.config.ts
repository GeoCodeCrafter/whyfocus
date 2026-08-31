import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/**/types.ts',
        // Needs a real browser: jsdom does no layout and has no focus model
        // worth trusting. Covered by the Playwright suite instead.
        'src/inspect/dom.ts',
        'src/ui/**',
        'src/entries/**',
      ],
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
    },
  },
});
