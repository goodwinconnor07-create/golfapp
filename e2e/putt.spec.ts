import { expect, test } from '@playwright/test';

// Trial: putting cards show a short putt animation on the card. The deck is stacked so the draw is known.
for (const card of ['B12', 'S04'])
  test(`putting card ${card} shows the putt animation`, async ({ page }) => {
    await page.goto('/');
    const dev = await page.evaluate(() => JSON.parse(localStorage.getItem('sendit.device') ?? '""'));
    const g = {
      v: 1,
      id: 'putt0000' + card,
      code: null,
      hostDeviceId: dev,
      createdAt: 1,
      updatedAt: 1,
      course: '',
      status: 'playing',
      holes: [1, 2, 3].map((number) => ({ number, par: 4 })),
      current: 0,
      players: [{ id: 'sam0000001', name: 'Sam', color: 0, deviceId: dev }],
      entries: {},
      settings: { distanceCards: true, situationCards: false, tiebreakOnStrokes: false },
      decks: { bold: ['B12', 'B12'], safe: ['S04', 'S04'] },
      seq: 1,
    };
    await page.evaluate(
      (g) => localStorage.setItem('sendit.session', JSON.stringify({ mode: 'local', code: null, game: g, pending: [] })),
      g,
    );
    await page.reload();
    const tier = card === 'S04' ? 'Safe' : 'Bold';
    await page.getByRole('radio', { name: new RegExp(tier) }).click();
    await page.getByRole('button', { name: `Draw my ${tier} card` }).click();
    const scene = page.locator('.putt-scene');
    await expect(scene).toBeVisible();
    await expect(scene).toHaveAttribute('aria-label', card === 'S04' ? /lag putt and a tap-in/ : /8 foot putt/);
    if (process.env.SHOTS_DIR) {
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${process.env.SHOTS_DIR}/44-putt-${card}.png` });
    }
  });
