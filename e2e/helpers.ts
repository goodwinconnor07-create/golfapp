import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS_DIR;

/** Saves a screenshot when SHOTS_DIR is set (used to review the design). */
export async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(450); // let entry animations settle
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

export async function newGame(page: Page, names: string[], holes: 'Front 9' | 'Back 9' | '18 holes' = 'Front 9') {
  await page.getByRole('button', { name: 'New game' }).click();
  for (let i = 0; i < names.length; i++) {
    if (i > 0) await page.getByRole('button', { name: 'Add player' }).click();
    await page.getByRole('textbox').nth(i).fill(names[i]);
  }
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Skip/ }).click();
  await page.getByRole('button', { name: new RegExp(holes) }).click();
  await expect(page.getByText('Lobby')).toBeVisible();
}

/** Picks a tier for whoever's turn it is and dismisses the card. Returns the card title. */
export async function pickAndReveal(page: Page, tier: 'Safe' | 'Bold' | 'Insane'): Promise<string> {
  await page.getByRole('radio', { name: new RegExp(tier) }).click();
  await page.getByRole('button', { name: `Draw my ${tier} card` }).click();
  const title = page.locator('.ccard-title');
  await expect(title).toBeVisible();
  const text = (await title.textContent()) ?? '';
  await page.getByRole('button', { name: /^Got it/ }).click();
  return text;
}

/** Enters a score on the score screen, whichever kind of card it is. */
export async function enterScore(page: Page, strokes: number, made: boolean, shotName?: string) {
  const value = page.locator('.stepper-value');
  for (let guard = 0; guard < 20; guard++) {
    const current = Number(await value.textContent());
    if (current === strokes) break;
    await page.getByRole('button', { name: current < strokes ? 'More strokes' : 'Fewer strokes' }).click();
  }
  await expect(value).toHaveText(String(strokes));
  const save = page.getByRole('button', { name: 'Save score' });
  if (await save.isVisible()) await save.click();
  else await page.getByRole('button', { name: made ? /Completed/ : /Failed/ }).click();
  // Dismiss the result splash.
  const flash = page.locator('.flash');
  await expect(flash).toBeVisible();
  // The splash names the result (on its stamp, or as a heading when there's no card).
  await expect(flash).toContainText(made ? /Completed/ : /Failed/);
  if (shotName && process.env.SHOTS_DIR) {
    await page.waitForTimeout(600); // let the stamp land
    await page.screenshot({ path: `${process.env.SHOTS_DIR}/${shotName}.png` });
  }
  await flash.click();
  await expect(flash).toBeHidden();
}
