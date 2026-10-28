/** Isolate source unit tests from browser journeys. */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
    coverage: { provider: 'v8', include: ['src/**/*.{js,jsx}'], exclude: ['src/**/*.test.*', 'src/test/**', 'src/main.jsx'] },
  },
});
