import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './spec',
  outputDir: 'audit/playwright',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    headless: true,
    baseURL: 'http://localhost:54321',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'agent-primitives',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
