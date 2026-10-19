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

/**
 * Taps whichever button starts a game on Home: New game, or the website's Hosting link
 * (phones without the app's Home, like the online tests' extra phones).
 */
export async function startGame(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /^(New game|Hosting\? Start a game)$/ })
    .first()
    .click();
}

/** On the name screen: type the name in the box under the picture. */
export async function enterName(page: Page, name: string) {
  await page.getByRole('textbox', { name: 'Your name' }).fill(name);
}

export async function newGame(page: Page, names: string[], holes: 'Front 9' | 'Back 9' | '18 holes' = 'Front 9') {
  await startGame(page);
  await enterName(page, names[0]);
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
    await expect(page.locator('.roster-item', { hasText: name })).toBeVisible();
  }
}

/**
 * Picks a card from the hand for whoever's turn it is: the card at that level (or, for a Name It card,
 * the target at that level), a friend if the card needs one, then Play. Returns the card title.
 */
export async function pickAndReveal(page: Page, tier: 'Safe' | 'Bold' | 'Insane'): Promise<string> {
  await page
    .locator('.hand-list')
    .getByRole('radio', { name: new RegExp(`^${tier}`) })
    .first()
    .click();
  const friends = page.locator('.friend-chips');
  if (await friends.isVisible()) await friends.getByRole('radio').first().click();
  const play = page.getByRole('button', { name: /^Play / });
  await expect(play).toBeEnabled();
  const title = ((await play.textContent()) ?? '').replace(/^Play /, '');
  await play.click();
  return title;
}

/** Older saved games (before the Showdown update): pick a level, then the card is drawn and flips. */
export async function pickLegacy(page: Page, tier: 'Safe' | 'Bold' | 'Insane'): Promise<string> {
  await page.getByRole('radio', { name: new RegExp(tier) }).click();
  await page.getByRole('button', { name: `Draw my ${tier} card` }).click();
  const title = page.locator('.ccard-title');
  await expect(title).toBeVisible();
  const text = (await title.textContent()) ?? '';
  await page.getByRole('button', { name: /^Got it/ }).click();
  return text;
}

/** Game options: only the core deck, so a test's results don't hang on which pack a card came from. */
export async function coreDeckOnly(page: Page) {
  for (const pack of ['Name It', 'Beat Yourself', 'Streaks', 'Par 3 & 5', 'Friends', 'Flag Length']) {
    const toggle = page.getByRole('switch', { name: new RegExp(`^${pack.replace(/[&]/g, '\\$&')}`) });
    if ((await toggle.getAttribute('aria-checked')) === 'true') await toggle.click();
  }
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
  // Cards drawn at random can be settled by strokes alone ("The Clean Par" fails on a bogey
  // whatever you tap). Then the splash must match what the score screen said, not what we wanted.
  const settled = page.locator('.auto-result');
  if (await settled.isVisible()) {
    made = (await settled.getAttribute('class'))?.includes('made') ?? made;
    await shot(page, '11a-score-settled');
  }
  // Cards about friends or streaks are worked out by the app: just save. Their result shows later.
  const save = page.getByRole('button', { name: 'Save score' });
  if (await save.isVisible()) {
    await save.click();
    await expect(value).toBeHidden();
    const flash = page.locator('.flash');
    if (await flash.isVisible()) await flash.click();
    return;
  }
  // Completed and Failed save in one tap; when the strokes settle the card, only the matching one is enabled.
  await page.getByRole('button', { name: made ? /^Completed/ : /^Failed/ }).click();
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

/**
 * Online, everyone has picked: the 3-2-1 group reveal plays. "Go play!" is never greyed out: a tap
 * during the countdown skips to the end, the next one moves on.
 */
export async function passGroupReveal(page: Page, shotName?: string) {
  await expect(page.getByRole('heading', { name: "Everyone's in!" })).toBeVisible();
  const go = page.getByRole('button', { name: 'Go play!' });
  await expect(go).toBeEnabled();
  if (shotName) {
    await page.waitForTimeout(3_200);
    await shot(page, shotName);
  }
  await go.click();
  // Skipped the countdown? Then the reveal is still up: tap again to move on.
  if (await page.getByRole('heading', { name: "Everyone's in!" }).isVisible()) await go.click();
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
