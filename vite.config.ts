import { defineConfig } from 'vitest/config';

// The dev server listens on localhost only (Vite's default). Do not set server.host.
export default defineConfig({
  build: { target: 'es2022', chunkSizeWarningLimit: 12000 },
  worker: { format: 'es' },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 20000 },
});
