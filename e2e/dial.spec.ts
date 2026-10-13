import { expect, test, type Page } from '@playwright/test';
import { newGame, pickAndReveal, shot } from './helpers';

/** Drags the dial's knob round the ring from one clock angle to another (0° = 12 o'clock). */
async function turn(page: Page, fromDeg: number, toDeg: number) {
  const box = (await page.locator('.dial-svg').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = box.width * 0.4;
  const at = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
  };
  await page.mouse.move(...at(fromDeg));
  await page.mouse.down();
  const steps = Math.max(4, Math.round(Math.abs(toDeg - fromDeg) / 6));
  for (let i = 1; i <= steps; i++) await page.mouse.move(...at(fromDeg + ((toDeg - fromDeg) * i) / steps));
  await page.mouse.up();
}

test('the stroke dial: turn the knob round the ring, or use − and +', async ({ page }) => {
  await page.goto('/');
  await newGame(page, ['Sam']);
  await page.getByRole('button', { name: "Let's go!" }).click();
  await page.getByRole('button', { name: 'Start anyway' }).click();
  await page.getByRole('button', { name: /PAR\s*4/ }).click();
  await pickAndReveal(page, 'Safe');
  await page.getByRole('button', { name: /Hole done/ }).click();

  // Starts on par, with the knob at 4 o'clock.
  const value = page.locator('.stepper-value');
  await expect(value).toHaveText('4');
  await shot(page, '38-dial-par');

  // Two notches clockwise: double bogey.
  await turn(page, 120, 182);
  await expect(value).toHaveText('6');
  await expect(page.locator('.score-name')).toContainText('Double bogey');
  await shot(page, '39-dial-double');

  // Back three notches anticlockwise: birdie.
  await turn(page, 180, 88);
  await expect(value).toHaveText('3');
  await expect(page.locator('.score-name')).toContainText('Birdie');

  // Past 12 o'clock carries on to 13+.
  await page.locator('.dial-svg').focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
  await expect(value).toHaveText('13');
  await shot(page, '40-dial-lapped');

  // The buttons step one at a time.
  await page.getByRole('button', { name: 'Fewer strokes' }).click();
  await expect(value).toHaveText('12');
});
