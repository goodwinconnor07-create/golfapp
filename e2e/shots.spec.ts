import { expect, test } from '@playwright/test';

// Cards show a short shot animation (see src/ui/shotArt.ts). The deck is stacked so the draw is known.
const LABELS: Record<string, RegExp> = {
  I17: /3 foot putt/,
  S04: /lag putt and a tap-in, 2 putts max/,
  S16: /150 metre drive/,
  I19: /within 30 feet/,
  I18: /scorecard: first hole, so this hole needs bogey or better/,
  B17: /lag putt and a tap-in, 1st putt within 3 feet/,
  I21: /scorecard: bogey on the last hole, so this hole needs birdie or better/,
};
// Cards drawn on the second hole, after these strokes on the first (a par 4).
const LAST: Record<string, number> = { I21: 5 };

for (const card of Object.keys(LABELS)) {
  test(`card ${card} shows its shot animation`, async ({ page }) => {
    await page.goto('/');
    const dev = await page.evaluate(() => JSON.parse(localStorage.getItem('sendit.device') ?? '""'));
    const game = {
      v: 1,
      id: `shot0000${card}`,
      code: null,
      hostDeviceId: dev,
      createdAt: 1,
      updatedAt: 1,
      course: '',
      status: 'playing',
      holes: [1, 2, 3].map((number) => ({ number, par: 4 })),
      current: LAST[card] ? 1 : 0,
      players: [{ id: 'sam0000001', name: 'Sam', color: 0, deviceId: dev }],
      entries: LAST[card] ? { 'sam0000001:0': { tier: 'safe', cardId: 'S01', strokes: LAST[card], done: true } } : {},
      settings: { distanceCards: true, situationCards: true, tiebreakOnStrokes: false },
      decks: { bold: [card, card], safe: [card, card], insane: [card, card] },
      seq: 1,
    };
    await page.evaluate(
      (g) => localStorage.setItem('sendit.session', JSON.stringify({ mode: 'local', code: null, game: g, pending: [] })),
      game,
    );
    await page.reload();
    const tier = card.startsWith('S') ? 'Safe' : card.startsWith('I') ? 'Insane' : 'Bold';
    await page.getByRole('radio', { name: new RegExp(tier) }).click();
    await page.getByRole('button', { name: `Draw my ${tier} card` }).click();
    const scene = page.locator('.putt-scene');
    await expect(scene).toBeVisible();
    await expect(scene).toHaveAttribute('aria-label', LABELS[card]);
    // However long the card, Redraw and Got it stay on screen without scrolling.
    await expect(page.getByRole('button', { name: /Redraw/ })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: /^Got it/ })).toBeInViewport({ ratio: 1 });
    if (process.env.SHOTS_DIR) {
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `${process.env.SHOTS_DIR}/44-shot-${card}.png` });
    }
  });
}
