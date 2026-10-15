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
