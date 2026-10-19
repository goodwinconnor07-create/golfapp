import { expect, test } from '@playwright/test';
import { newGame, shot, startGame } from './helpers';

const origin = new URL(process.env.BASE_URL ?? 'http://localhost:5174').origin;
/** Local storage for a phone, as the config's default but with these keys. */
const phone = (keys: Record<string, string>) => ({
  cookies: [],
  origins: [{ origin, localStorage: Object.entries(keys).map(([name, value]) => ({ name, value })) }],
});

test('Back to your game sits under the logo on Home', async ({ page }) => {
  await page.goto('/');
  await newGame(page, ['Sam', 'Alex']);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
  await shot(page, '31-home-back-to-game');
  await page.getByRole('button', { name: /Back to your game/ }).click();
  await expect(page.getByText('2 players ready')).toBeVisible();
});

test.describe('after a round', () => {
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
  };
  test.use({
    storageState: phone({
      'sendit.howto': 'true',
      'sendit.appHome': 'true',
      'sendit.name': JSON.stringify('Kavi'),
      'sendit.history': JSON.stringify([record]),
    }),
  });

  test('Home has News for regulars, and the story opens in a sheet', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /The Showdown update/ }).click();
    await expect(page.getByRole('dialog')).toContainText('The Crown');
    await shot(page, '01d-news');
    await page.getByRole('button', { name: "Let's play" }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('Play again starts with the same group', async ({ page }) => {
    await page.goto('/');
    await shot(page, '01b-home-play-again');
    await page.getByRole('button', { name: /Play again.*Sam & Jo/ }).click();
    // The host's name is known, so it goes straight to the course.
    await page.getByRole('button', { name: /Skip/ }).click();
    await page.getByRole('button', { name: /Front 9/ }).click();
    for (const name of ['Kavi', 'Sam', 'Jo']) await expect(page.locator('.roster-item', { hasText: name })).toBeVisible();
  });
});

test.describe('first time', () => {
  // A phone that has never opened How to play (the other tests start as if it had).
  test.use({ storageState: phone({ 'sendit.appHome': 'true' }) });

  test('Home leads with How to play for someone who has never played', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'CardShot' })).toBeVisible();
    await shot(page, '01a-home');
    await expect(page.getByRole('button', { name: /The Showdown update/ })).toHaveCount(0);
    await page.getByRole('button', { name: /^How to play/ }).click();
    await expect(page.getByRole('heading', { name: 'Pick your card' })).toBeVisible();
  });

  test('a new host sees How to play once and can skip it', async ({ page }) => {
    await page.goto('/');
    await startGame(page);
    await expect(page.getByRole('heading', { name: 'Pick your card' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByRole('textbox', { name: 'Your name' })).toBeVisible();
    // The second time goes straight to the name screen.
    await page.getByRole('button', { name: 'Back' }).click();
    await startGame(page);
    await expect(page.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  });

  test('finishing How to play lands on the name screen', async ({ page }) => {
    await page.goto('/');
    await startGame(page);
    // Let each slide settle before tapping Next again (the slides scroll across).
    for (const title of ['Your hand', 'Play the hole', 'Score it', 'Lowest score wins', 'Extras']) {
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByRole('heading', { name: title })).toBeInViewport({ ratio: 0.9 });
    }
    await expect(page.getByRole('button', { name: "Let's play" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip' })).toBeHidden();
    await page.getByRole('button', { name: "Let's play" }).click();
    await expect(page.getByRole('textbox', { name: 'Your name' })).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'Pick your card' })).toBeVisible();
  });
});
