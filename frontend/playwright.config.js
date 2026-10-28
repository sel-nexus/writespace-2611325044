/** Run tier-local browser journeys with one server and one worker. */
import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

const env = { ...loadEnv('test', process.cwd(), ''), ...process.env };
const baseURL = env.E2E_BASE_URL || `http://127.0.0.1:${env.E2E_PORT || 5173}`;
const origin = new URL(baseURL);
const port = env.E2E_PORT || origin.port || (origin.protocol === 'https:' ? '443' : '80');

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: { baseURL, browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js',
    url: baseURL,
    env: { DEV_HOST: origin.hostname, DEV_PORT: port },
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
