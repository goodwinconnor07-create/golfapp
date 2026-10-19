import { expect, test } from '@playwright/test';
import { newGame } from './helpers';

test('the card back is as tall as the card face, so the flip never changes size', async ({ page }) => {
  await page.goto('/');
  await newGame(page, ['Sam', 'Alex']);
  await page.getByRole('button', { name: "Let's go!" }).click();
  await page.getByRole('button', { name: /PAR\s*5/ }).click();
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
