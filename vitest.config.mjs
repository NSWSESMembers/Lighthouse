import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Scoped to src/shared and src/pages/tasking (unit-testable). The
      // content/inject scripts use a custom JSX pragma (DOM) that rolldown's
      // parser (used for v8's 0%-baseline instrumentation pass) can't handle,
      // which would flood the report with parse errors for files nothing
      // tests and isn't planned to.
      include: ['src/shared/**/*.js', 'src/pages/tasking/**/*.js'],
      exclude: ['src/**/*.test.js'],
    },
  },
});
