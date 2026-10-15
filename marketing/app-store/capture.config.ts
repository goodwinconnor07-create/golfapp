// Captures the app screens used on the App Store cards: a seeded 4-player round on an
// iPhone Pro Max-sized screen (430×932 at 3×, so 1290×2796 screenshots).
// Run: npm run store:capture
import { fileURLToPath } from 'node:url';
import base from '../../playwright.config';

const root = fileURLToPath(new URL('../..', import.meta.url));

export default {
  ...base,
  testDir: '.',
  testMatch: 'capture.spec.ts',
  timeout: 180_000,
  use: { ...base.use, viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 },
  // The dev server runs from the repo root, not this folder.
  webServer: base.webServer && { ...base.webServer, cwd: root },
};
