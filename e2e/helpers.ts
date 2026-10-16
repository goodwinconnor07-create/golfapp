import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOTS = process.env.SHOTS_DIR;

/** Reads the join code from the invite tiles, waiting past the skeleton that shows while it's on its way. */
export async function gameCode(page: Page, scope = ''): Promise<string> {
  const tiles = page.locator(`${scope} .code-tiles[aria-label^="Game code"]`.trim());
  await expect(tiles).toBeVisible();
  return ((await tiles.getAttribute('aria-label')) ?? '').replace('Game code', '').replace(/\s/g, '');
}

/** Saves a screenshot when SHOTS_DIR is set (used to review the design). */
export async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(450); // let entry animations settle
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

export async function newGame(page: Page, names: string[], holes: 'Front 9' | 'Back 9' | '18 holes' = 'Front 9') {
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByLabel('Your name').fill(names[0]);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Skip/ }).click();
  await page.getByRole('button', { name: new RegExp(holes) }).click();
  await expect(page.getByText('Lobby')).toBeVisible();
  // The game gets its invite code straight away.
  await expect(page.locator('.invite-panel .code-tiles')).toBeVisible();
  // Anyone else in the list is added to this phone (someone without a phone).
  for (const name of names.slice(1)) {
    await page.getByRole('button', { name: /No phone\? Add them/ }).click();
    await page.getByLabel('Name').fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('.player-row', { hasText: name })).toBeVisible();
  }
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
export async function enterScore(page: Page, strokes: number, made: boolean, shotName?: string, splash = true) {
  const value = page.locator('.stepper-value');
  for (let guard = 0; guard < 20; guard++) {
    const current = Number(await value.textContent());
    if (current === strokes) break;
    await page.getByRole('button', { name: current < strokes ? 'More strokes' : 'Fewer strokes' }).click();
  }
  await expect(value).toHaveText(String(strokes));
  const save = page.getByRole('button', { name: 'Save score' });
  // Cards drawn at random can be settled by strokes alone ("The Clean Par" fails on a bogey
  // whatever you tap). Then the splash must match what the score screen said, not what we wanted.
  const settled = page.locator('.auto-result');
  if (await settled.isVisible()) made = (await settled.getAttribute('class'))?.includes('made') ?? made;
  if (await save.isVisible()) await save.click();
  else await page.getByRole('button', { name: made ? /Completed/ : /Failed/ }).click();
  // Online with friends there's no splash: the shared reveal shows results instead.
  const flash = page.locator('.flash');
  if (!splash) {
    await expect(value).toBeHidden();
    await expect(flash).toHaveCount(0);
    return;
  }
  // Dismiss the result splash.
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

/** Everyone has picked: the 3-2-1 group reveal plays, then "Go play!" moves on. */
export async function passGroupReveal(page: Page, shotName?: string) {
  await expect(page.getByRole('heading', { name: "Everyone's in!" })).toBeVisible();
  const go = page.getByRole('button', { name: 'Go play!' });
  await expect(go).toBeEnabled({ timeout: 8_000 });
  if (shotName) await shot(page, shotName);
  await go.click();
  await expect(page.getByRole('heading', { name: 'Go play!' })).toBeVisible();
}

/** Online with friends: "Hole done" goes straight to this phone's score, then the waiting room. */
export async function holeDoneAndScore(page: Page, strokes: number, made: boolean) {
  await page.getByRole('button', { name: /Hole done/ }).click();
  await enterScore(page, strokes, made, undefined, false);
}

/** Everyone has scored: results flip over one by one, then the rows re-sort into the standings. */
export async function passResultsReveal(page: Page, shotName?: string) {
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  // Settled: the list is no longer hidden from screen readers.
  await expect(page.locator('.reveal-list')).toHaveAttribute('aria-hidden', 'false', { timeout: 8_000 });
  await expect(page.getByRole('button', { name: /Next hole|Final results/ })).toBeVisible();
  if (shotName) await shot(page, shotName);
}
