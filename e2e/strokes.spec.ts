import { expect, test } from '@playwright/test';
import { newGame, pickAndReveal, shot } from './helpers';

test('stroke counter: tap or hold − and +, and the score name and colour follow', async ({ page }) => {
  await page.goto('/');
  await newGame(page, ['Sam']);
  await page.getByRole('button', { name: "Let's go!" }).click();
  await page.getByRole('button', { name: 'Start anyway' }).click();
  await page.getByRole('button', { name: /PAR\s*4/ }).click();
  await pickAndReveal(page, 'Safe');
  await page.getByRole('button', { name: /Hole done/ }).click();

  const value = page.locator('.stepper-value');
  const picker = page.locator('.stroke-picker');
  await expect(value).toHaveText('4');
  await expect(picker).toHaveClass(/tone-par/);

  // One tap down: birdie, in green.
  await page.getByRole('button', { name: 'Fewer strokes' }).click();
  await expect(value).toHaveText('3');
  await expect(page.locator('.score-name')).toContainText('Birdie');
  await expect(picker).toHaveClass(/tone-birdie/);
  await shot(page, '38-strokes-birdie');

  // Holding + keeps counting.
  const plus = page.getByRole('button', { name: 'More strokes' });
  const box = (await plus.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(async () => Number(await value.textContent()), { timeout: 4000 }).toBeGreaterThanOrEqual(8);
  await page.mouse.up();
  const held = Number(await value.textContent());
  await page.waitForTimeout(400);
  // It stops when you let go.
  await expect(value).toHaveText(String(held));
  await expect(picker).toHaveClass(/tone-worse/);
});
