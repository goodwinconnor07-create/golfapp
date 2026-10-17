import { expect, test } from '@playwright/test';
import { enterScore, newGame, pickAndReveal, shot } from './helpers';

test('mulligans: on by default, 2 for 9 holes, taken on the Go play! screen', async ({ page }) => {
  await page.goto('/');
  await newGame(page, ['Sam', 'Alex']);

  // The host sees the option in the lobby, on by default.
  await page.getByRole('button', { name: 'Game options' }).click();
  const option = page.getByRole('switch', { name: /Mulligans/ });
  await expect(option).toHaveAttribute('aria-checked', 'true');
  await expect(option).toContainText('2 re-hits each');
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: "Let's go!" }).click();
  await page.getByRole('button', { name: /PAR\s*4/ }).click();
  await pickAndReveal(page, 'Safe');
  await pickAndReveal(page, 'Safe');
  await expect(page.getByRole('heading', { name: 'Go play!' })).toBeVisible();

  // Taken during the hole, on the Go play! screen: what's left is in words, and it can be undone.
  const take = page.getByRole('button', { name: /Mulligan: re-hit a shot/ });
  // Only the open card (Sam's) shows the button; Alex's opens on a tap.
  await expect(take).toHaveCount(1);
  await take.first().click();
  await expect(page.getByText('🔁 Mulligan taken · 1 left')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(take.first()).toContainText('2 left');
  await take.first().click();
  await shot(page, '45-mulligan-play');

  // The score screen just reminds you.
  await page.getByRole('button', { name: /Hole done/ }).click();
  await expect(page.getByText(/Mulligan used: leave the re-hit out/)).toBeVisible();
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
