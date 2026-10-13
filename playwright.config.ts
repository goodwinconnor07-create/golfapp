import { defineConfig } from '@playwright/test';

const PORT = 5174;
/** Set BASE_URL to test a running server instead (e.g. `npm run preview` or a deployed site). */
const external = process.env.BASE_URL;

// End-to-end tests run against the Vite dev server, which also runs the Worker
// and Durable Object locally, so online games are tested without a Cloudflare account.
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: external ?? `http://localhost:${PORT}`,
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
    trace: 'retain-on-failure',
  },
  webServer: external
    ? undefined
    : {
        command: `npx vite --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
