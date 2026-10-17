import { expect, test, type Browser, type Page } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { enterScore, newGame, pickAndReveal } from '../../e2e/helpers';

const OUT = new URL('./screens', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const snap = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png` });

async function seed(page: Page, file: string, tweak?: (g: any) => void) {
  await page.goto('/');
  const dev = await page.evaluate(() => JSON.parse(localStorage.getItem('sendit.device') ?? '""'));
  const game = JSON.parse(readFileSync(new URL('./seed/' + file, import.meta.url), 'utf8').replaceAll('DEVICE_PLACEHOLDER', dev));
  tweak?.(game);
  await page.evaluate((g) => {
    localStorage.setItem('sendit.session', JSON.stringify({ mode: 'local', code: null, game: g, pending: [] }));
    localStorage.setItem('sendit.moment', 'x');
  }, game);
  await page.reload();
}

test('mid-round', async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, 'midround.json', (g) => {
    const first = (tier: string, id: string) => (g.decks[tier] = [id, ...(g.decks[tier] ?? []).filter((c: string) => c !== id)]);
    first('bold', 'B03');
  });
  await expect(page.getByRole('heading', { name: 'Maya' })).toBeVisible();
  await page.getByRole('radio', { name: /Bold/ }).click();
  await page.waitForTimeout(600);
  await snap(page, 'pick');
  await page.getByRole('button', { name: 'Draw my Bold card' }).click();
  await page.waitForTimeout(5000);
  await snap(page, 'reveal');
  await page.getByRole('button', { name: /^Got it/ }).click();
  await pickAndReveal(page, 'Safe');
  await pickAndReveal(page, 'Insane');
  await pickAndReveal(page, 'Bold');
  await expect(page.getByRole('heading', { name: "Everyone's in!" })).toBeVisible();
  await page.waitForTimeout(4000);
  await snap(page, 'group');
  await page.getByRole('button', { name: 'Go play!' }).click();
  await page.waitForTimeout(1200);
  await snap(page, 'play');
  await page.getByRole('button', { name: /Hole done/ }).click();
  const value = page.locator('.stepper-value');
  await expect(value).toBeVisible();
  for (let i = 0; i < 6 && (await value.textContent()) !== '3'; i++) await page.getByRole('button', { name: 'Fewer strokes' }).click();
  await page.waitForTimeout(800);
  await snap(page, 'score');
  await page.getByRole('button', { name: /Completed/ }).click();
  await page.waitForTimeout(1100);
  await snap(page, 'stamp');
  await page.locator('.flash').click({ timeout: 2500 }).catch(() => undefined);
  await expect(page.locator('.flash')).toBeHidden();
  await enterScore(page, 4, true);
  await enterScore(page, 5, false);
  await enterScore(page, 5, true);
  await page.waitForTimeout(3500);
  await snap(page, 'results');
  await page.getByRole('button', { name: 'Leaderboard' }).click();
  await page.waitForTimeout(2000);
  await snap(page, 'leaderboard');
  await page.goBack();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: /Scorecard/ }).click();
  await page.waitForTimeout(1200);
  await snap(page, 'scorecard');
});

test('final', async ({ page }) => {
  await seed(page, 'last.json');
  await page.getByRole('button', { name: /Final results/ }).click();
  await page.waitForTimeout(4000);
  await snap(page, 'final');
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(1500);
  await snap(page, 'final-awards');
});

async function phone(browser: Browser, look: { emoji: string; color: number }): Promise<Page> {
  const { viewport, deviceScaleFactor, isMobile, hasTouch, baseURL } = test.info().project.use;
  const page = await (await browser.newContext({ viewport, deviceScaleFactor, isMobile, hasTouch, baseURL })).newPage();
  await page.goto('/');
  await page.evaluate((l) => localStorage.setItem('sendit.look', JSON.stringify(l)), look);
  await page.reload();
  return page;
}

test('lobby', async ({ browser }) => {
  test.setTimeout(120_000);
  const host = await phone(browser, { emoji: '🦈', color: 0 });
  await newGame(host, ['Maya']);
  const tiles = host.locator('.invite-panel .code-tiles');
  const code = ((await tiles.getAttribute('aria-label')) ?? '').replace('Game code', '').replace(/\s/g, '');
  for (const [name, look] of [['Jake', { emoji: '🔥', color: 1 }], ['Priya', { emoji: '😎', color: 4 }], ['Leo', { emoji: '🐐', color: 6 }]] as const) {
    const guest = await phone(browser, look);
    await guest.goto(`/j/${code}`);
    await guest.getByLabel('Your name').fill(name);
    await guest.getByRole('button', { name: `Join as ${name}` }).click();
    await expect(guest.getByText("You're in!")).toBeVisible();
    await expect(host.locator('.roster-item', { hasText: name })).toBeVisible();
  }
  await host.waitForTimeout(1500);
  await snap(host, 'lobby');
});
