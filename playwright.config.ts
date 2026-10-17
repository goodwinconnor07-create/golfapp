import { defineConfig } from '@playwright/test';

const PORT = 5174;
/** Set BASE_URL to test a running server instead (e.g. `npm run preview` or a deployed site). */
const external = process.env.BASE_URL;

// End-to-end tests run against the Vite dev server, which also runs the Worker
// and Durable Object locally, so online games are tested without a Cloudflare account.
const baseURL = external ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    browserName: (process.env.BROWSER as 'webkit') ?? 'chromium',
    // A first-time host is shown How to play before the name screen. Tests start as if they've seen it;
    // the first-time test clears this. sendit.appHome shows the iPhone app's Home (development only).
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(baseURL).origin,
          localStorage: [
            { name: 'sendit.howto', value: 'true' },
            { name: 'sendit.appHome', value: 'true' },
          ],
        },
      ],
    },
    // SMALL=1 checks a small phone (360×740) instead of a typical one.
    viewport: process.env.SMALL ? { width: 360, height: 740 } : { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    // DARK=1 runs everything in dark mode (for screenshots and QA).
    colorScheme: process.env.DARK ? 'dark' : 'light',
    // REDUCED=1 runs with Reduce Motion on.
    contextOptions: { reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' },
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
