import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.mjs',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1440, height: 900 }, headless: true },
  projects: [
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],
  reporter: [['list'], ['json', { outputFile: 'planning/test-results.json' }]],
});
