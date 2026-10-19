import { expect, test } from '@playwright/test';

// Older saved games still pick a level and flip the card over (ruleset 2 picks from a hand instead).
test('the card back is as tall as the card face, so the flip never changes size', async ({ page }) => {
  await page.goto('/');
  const device = await page.evaluate(() => JSON.parse(localStorage.getItem('sendit.device') ?? '""'));
  const game = {
    v: 1,
    id: 'flipgame01',
    code: null,
    hostDeviceId: device,
    createdAt: 1,
    updatedAt: 1,
    course: '',
    status: 'playing',
    holes: [1, 2, 3].map((number) => ({ number, par: 5 })),
    current: 0,
    players: [
      { id: 'sam0000001', name: 'Sam', color: 0, deviceId: device },
      { id: 'alex000001', name: 'Alex', color: 1, deviceId: null },
    ],
    entries: {},
    settings: { distanceCards: true, situationCards: false, tiebreakOnStrokes: false, mulligans: true },
    decks: {},
    seq: 1,
  };
  await page.evaluate(
    (g) => localStorage.setItem('sendit.session', JSON.stringify({ mode: 'local', code: null, game: g, pending: [] })),
    game,
  );
  await page.reload();
  await page.getByRole('radio', { name: /Insane/ }).click();
  await page.getByRole('button', { name: 'Draw my Insane card' }).click();
  // Still showing the back.
  await expect(page.locator('.ccard.winding')).toBeVisible();
  const before = await page.locator('.ccard-inner').evaluate((el) => (el as HTMLElement).offsetHeight);
  await expect(page.locator('.ccard.flipped .ccard-title')).toBeVisible();
  await page.waitForTimeout(600);
  const after = await page.locator('.ccard-inner').evaluate((el) => (el as HTMLElement).offsetHeight);
  expect(Math.abs(after - before)).toBeLessThan(1);
});
