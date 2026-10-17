import { expect, test } from '@playwright/test';
import { newGame, shot } from './helpers';
test('Back to your game is a slim strip at the top of Home', async ({ page }) => {
  await page.goto('/');
  await newGame(page, ['Sam', 'Alex']);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Home' }).click();
  await expect(page.getByRole('button', { name: /Back to your game/ })).toBeVisible();
  await shot(page, '31-home-back-to-game');
  await page.getByRole('button', { name: /Back to your game/ }).click();
  await expect(page.getByText('Ready to tee off?')).toBeVisible();
});

test.describe('first time', () => {
  // A phone that has never opened How to play (the other tests start as if it had).
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a new host sees How to play once and can skip it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New game' }).click();
    await expect(page.getByRole('heading', { name: 'Pick your risk' })).toBeVisible();
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByLabel('Your name')).toBeVisible();
    // The second time goes straight to the name screen.
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'New game' }).click();
    await expect(page.getByLabel('Your name')).toBeVisible();
  });

  test('finishing How to play lands on the name screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New game' }).click();
    // Let each slide settle before tapping Next again (the slides scroll across).
    for (const title of ['Get a card', 'Play the hole', 'Score it', 'Lowest score wins', 'Twists']) {
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(page.getByRole('heading', { name: title })).toBeInViewport({ ratio: 0.9 });
    }
    await expect(page.getByRole('button', { name: "Let's play" })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip' })).toBeHidden();
    await page.getByRole('button', { name: "Let's play" }).click();
    await expect(page.getByLabel('Your name')).toBeVisible();
  });
});
