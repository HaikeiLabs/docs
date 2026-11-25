import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4192' },
  webServer: {
    command: 'npm run build:fixture && PREVIEW_DIR=dist-fixture PORT=4192 npm run preview',
    url: 'http://127.0.0.1:4192/agentware/course/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
