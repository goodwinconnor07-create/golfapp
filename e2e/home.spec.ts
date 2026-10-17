import { expect, test } from '@playwright/test';
import { newGame, shot, startGame } from './helpers';

const origin = new URL(process.env.BASE_URL ?? 'http://localhost:5174').origin;
/** Local storage for a phone, as the config's default but with these keys. */
const phone = (keys: Record<string, string>) => ({
  cookies: [],
  origins: [{ origin, localStorage: Object.entries(keys).map(([name, value]) => ({ name, value })) }],
});

test('the round in progress is a big card on Home', async ({ page }) => {
  await page.goto('/');
  await newGame(page, ['Sam', 'Alex']);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Home' }).click();
  const live = page.getByRole('button', { name: /Resume/ });
  await expect(live).toContainText('Waiting to start');
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
  await shot(page, '31-home-live-card');
  await live.click();
  await expect(page.getByText('2 players ready')).toBeVisible();
});

test.describe('after some rounds', () => {
  const record = {
    id: 'g1',
    finishedAt: Date.now() - 86_400_000,
    course: 'Riverside',
    holes: 9,
    players: [
      { name: 'Kavi', color: 0, emoji: '🐐', rank: 1, toPar: -3, strokes: 44 },
      { name: 'Sam', color: 2, emoji: '😈', rank: 2, toPar: 1, strokes: 42 },
      { name: 'Jo', color: 6, rank: 3, toPar: 4, strokes: 47 },
    ],
    mine: {
      name: 'Kavi',
      rank: 1,
      picks: { safe: 2, bold: 5, insane: 2 },
      made: { safe: 2, bold: 3, insane: 1 },
      cards: { B17: [3, 3], B18: [2, 0], S02: [2, 2], I20: [2, 1] },
    },
  };
  test.use({
    storageState: phone({
      'sendit.howto': 'true',
      'sendit.appHome': 'true',
      'sendit.name': JSON.stringify('Kavi'),
      'sendit.history': JSON.stringify([record]),
    }),
  });

  test('Home shows how you play and starts again with the same group', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'How you play' })).toBeVisible();
    await expect(page.getByText('Mostly Bold')).toBeVisible();
    await expect(page.getByText('1 of 2')).toBeVisible();
    await expect(page.getByText('Lag It Close')).toBeVisible();
    await shot(page, '01b-home-returning');

    await page.getByRole('button', { name: /Play again with Sam & Jo/ }).click();
    // The host's name is known, so it goes straight to the course.
    await page.getByRole('button', { name: /Skip/ }).click();
    await page.getByRole('button', { name: /Front 9/ }).click();
    for (const name of ['Kavi', 'Sam', 'Jo']) await expect(page.locator('.roster-item', { hasText: name })).toBeVisible();
  });
});

test.describe('first time', () => {
  // A phone that has never opened How to play (the other tests start as if it had).
  test.use({ storageState: phone({ 'sendit.appHome': 'true' }) });

  test('Home plays the game for you until the first round', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('img', { name: /How a round works/ })).toBeVisible();
    await expect(page.getByText('Everyone picks a level')).toBeVisible();
    await shot(page, '01a-home-first');
    // It steps through the round on its own.
    await expect(page.getByText('Draw a card')).toBeVisible({ timeout: 5000 });
  });

  test('a new host sees How to play once and can skip it', async ({ page }) => {
    await page.goto('/');
    await startGame(page);
    await expect(page.getByRole('heading', { name: 'Pick your risk' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByRole('button', { name: /your name and picture/ })).toBeVisible();
    // The second time goes straight to the name screen.
    await page.getByRole('button', { name: 'Back' }).click();
    await startGame(page);
    await expect(page.getByRole('button', { name: /your name and picture/ })).toBeVisible();
  });

  test('finishing How to play lands on the name screen', async ({ page }) => {
    await page.goto('/');
    await startGame(page);
    // Let each slide settle before tapping Next again (the slides scroll across).
    for (const title of ['Get a card', 'Play the hole', 'Score it', 'Lowest score wins', 'Twists']) {
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByRole('heading', { name: title })).toBeInViewport({ ratio: 0.9 });
    }
    await expect(page.getByRole('button', { name: "Let's play" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip' })).toBeHidden();
    await page.getByRole('button', { name: "Let's play" }).click();
    await expect(page.getByRole('button', { name: /your name and picture/ })).toBeVisible();
  });
});

test.describe('the website', () => {
  test.use({ storageState: phone({ 'sendit.howto': 'true' }) });

  test('opens straight on the join screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Join the game' })).toBeVisible();
    await expect(page.getByLabel('Game code')).toBeVisible();
    await shot(page, '01c-web-home');
    await page.getByRole('button', { name: 'How to play' }).click();
    await expect(page.getByRole('heading', { name: 'Pick your risk' })).toBeVisible();
  });
});
