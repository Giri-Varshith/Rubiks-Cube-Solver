import { defineConfig } from 'vitest/config';

// The dev server listens on localhost only (Vite's default). Do not set server.host.
// For GitHub Pages the app lives under /Rubiks-Cube-Solver/; the deploy workflow sets PAGES_BASE.
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/',
  build: { target: 'es2022', chunkSizeWarningLimit: 12000 },
  worker: { format: 'es' },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 20000 },
});
