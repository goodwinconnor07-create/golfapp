import { expect, test } from '@playwright/test';
import { newGame, pickAndReveal, shot } from './helpers';
test('the stroke wheel: swipe, tap a number, and the selected number sits in the middle', async ({ page }) => {
  await page.goto('/');
  await newGame(page, ['Sam']);
  await page.getByRole('button', { name: "Let's go!" }).click();
  await page.getByRole('button', { name: 'Start anyway' }).click();
  await page.getByRole('button', { name: /PAR\s*4/ }).click();
  await pickAndReveal(page, 'Safe');
  await page.getByRole('button', { name: /Hole done/ }).click();
  await expect(page.locator('.stepper-value')).toHaveText('4');
  // The picked number is centred in the wheel.
  const offCentre = async () => {
    const w = (await page.locator('.wheel').boundingBox())!;
    const p = (await page.locator('.stepper-value').boundingBox())!;
    return Math.abs(p.x + p.width / 2 - (w.x + w.width / 2));
  };
  await expect.poll(offCentre).toBeLessThan(4);
  await shot(page, '38-wheel-par');
  // Swipe: scroll the track two numbers right.
  await page.locator('.wheel-track').evaluate((el) => {
    // A finger goes down first, as in a real swipe.
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const items = el.querySelectorAll<HTMLElement>('.wheel-item');
    el.scrollBy({ left: 2 * (items[1].offsetLeft - items[0].offsetLeft) });
  });
  await expect(page.locator('.stepper-value')).toHaveText('6');
  await expect(page.locator('.score-name')).toContainText('Double bogey');
  // Tap a faded neighbour.
  await page.locator('.wheel-item', { hasText: /^5$/ }).click();
  await expect(page.locator('.stepper-value')).toHaveText('5');
  await shot(page, '39-wheel-bogey');

  // Let the tap's glide land (as it would before a person swipes again).
  await expect.poll(offCentre).toBeLessThan(4);

  // A swipe that stops between numbers settles on the nearest one, centred.
  await page.locator('.wheel-track').evaluate((el) => {
    // A finger goes down first, as in a real swipe.
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const items = el.querySelectorAll<HTMLElement>('.wheel-item');
    el.scrollBy({ left: -1.4 * (items[1].offsetLeft - items[0].offsetLeft) });
  });
  await expect(page.locator('.stepper-value')).toHaveText('4');
  await expect(page.locator('.score-name')).toContainText('Par');
  await expect.poll(offCentre).toBeLessThan(4);
});
