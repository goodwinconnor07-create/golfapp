import { expect, test } from '@playwright/test';
import { enterScore, newGame, pickAndReveal, shot } from './helpers';

test('mulligans: on by default, 2 for 9 holes, taken on the Go play! screen', async ({ page }) => {
  await page.goto('/');
  await newGame(page, ['Sam', 'Alex']);

  // The host sees the option in the lobby, on by default.
  await page.getByRole('button', { name: 'Game options' }).click();
  const option = page.getByRole('switch', { name: /Mulligans/ });
  await expect(option).toHaveAttribute('aria-checked', 'true');
  await expect(option).toContainText('2 bad shots');
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: "Let's go!" }).click();
  await page.getByRole('button', { name: /PAR\s*4/ }).click();
  await pickAndReveal(page, 'Safe');
  await pickAndReveal(page, 'Safe');
  await page.getByRole('button', { name: 'Go play!' }).click();

  // Taken during the hole, on the Go play! screen: a token is spent, and it can be undone.
  const take = page.getByRole('button', { name: /Take a mulligan/ });
  // Only the open card (Sam's) shows the button; Alex's opens on a tap.
  await expect(take).toHaveCount(1);
  await take.first().click();
  await expect(page.getByText('🔁 Mulligan taken')).toBeVisible();
  await expect(page.getByLabel('1 of 2 mulligans left')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('2 of 2 mulligans left').first()).toBeVisible();
  await take.first().click();
  await shot(page, '45-mulligan-play');

  // The score screen just reminds you.
  await page.getByRole('button', { name: /Hole done/ }).click();
  await expect(page.getByText(/Mulligan used: don't count the re-hit/)).toBeVisible();
  await enterScore(page, 5, true);
  await enterScore(page, 5, true);

  // It shows on the hole results.
  await expect(page.locator('.board-row', { hasText: 'Sam' }).getByText('🔁 Mulligan')).toBeVisible();
  await expect(page.locator('.board-row', { hasText: 'Alex' }).getByText('🔁 Mulligan')).toHaveCount(0);
  await shot(page, '46-mulligan-results');

  // Once the round has started, the option is locked.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Game options' }).click();
  await expect(page.getByRole('switch', { name: /Mulligans/ })).toBeDisabled();
});
