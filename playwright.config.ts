import { defineConfig, devices } from '@playwright/test';

const live = process.env.QA_LIVE_BASE_URL;
const negative = process.env.QA_INJECT_HTML === '1';
const artifacts = `qa/artifacts/${live ? 'live' : negative ? 'html-negative' : 'fixture'}`;

export default defineConfig({
  testDir: './qa',
  testMatch: live ? 'live.spec.ts' : 'journeys.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: live ? 90_000 : 30_000,
  expect: { timeout: 10_000 },
  forbidOnly: !!process.env.CI,
  outputDir: `${artifacts}/results`,
  reporter: [
    ['list'],
    ['json', { outputFile: `${artifacts}/report.json` }],
    ['html', { outputFolder: `${artifacts}/html`, open: 'never' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: live || 'http://127.0.0.1:4183',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  webServer: live ? undefined : [
    {
      command: 'node --import tsx qa/service.ts',
      url: 'http://127.0.0.1:4319/__qa/health',
      reuseExistingServer: false,
      timeout: 30_000,
      env: { QA_INJECT_HTML: negative ? '1' : '0' },
    },
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4183 --strictPort',
      url: 'http://127.0.0.1:4183',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { LICK_API_ORIGIN: 'http://127.0.0.1:4319' },
    },
  ],
});
