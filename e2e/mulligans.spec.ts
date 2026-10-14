import { expect, test } from '@playwright/test';
import { enterScore, newGame, pickAndReveal, shot } from './helpers';

test('mulligans: on by default, 2 for 9 holes, used from the score screen', async ({ page }) => {
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
  await page.getByRole('button', { name: /Hole done/ }).click();

  // Sam uses one: 2 left before, 1 after.
  const used = page.getByRole('switch', { name: /Used a mulligan/ });
  await expect(used).toContainText('2 of 2 left');
  await used.click();
  await expect(used).toContainText('1 left after this');
  await shot(page, '45-mulligan-score');
  await enterScore(page, 5, true);
  await enterScore(page, 5, true);

  // It shows on the hole results.
  await expect(page.locator('.board-row', { hasText: 'Sam' }).locator('.tag-mulligan')).toBeVisible();
  await expect(page.locator('.board-row', { hasText: 'Alex' }).locator('.tag-mulligan')).toHaveCount(0);
  await shot(page, '46-mulligan-results');

  // Once the round has started, the option is locked.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Game options' }).click();
  await expect(page.getByRole('switch', { name: /Mulligans/ })).toBeDisabled();
});
