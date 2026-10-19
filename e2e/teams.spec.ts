import { expect, test, type Page } from '@playwright/test';
import { getCard, handFor, type Game } from '../src/game';
import { enterScore, newGame, pickAndReveal, shot } from './helpers';

test('2v2 teams: switch on, drag to swap, start with teams', async ({ page }) => {
  await page.goto('/');
  await newGame(page, ['Sam', 'Alex', 'Jo', 'Kim']);
  await page.getByRole('button', { name: 'Play as 2v2 teams' }).click();
  const t1 = page.getByTestId('team-1');
  const t2 = page.getByTestId('team-2');
  await expect(t1).toContainText('Sam');
  await expect(t1).toContainText('Alex');
  await expect(t2).toContainText('Jo');
  await page.getByTestId('team-picker').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await shot(page, 'teams-lobby');

  // Drag Alex (team 1) onto Jo (team 2): they swap sides.
  const from = await t1.locator('[data-team-pid]', { hasText: 'Alex' }).boundingBox();
  const to = await t2.locator('[data-team-pid]', { hasText: 'Jo' }).boundingBox();
  if (!from || !to) throw new Error('no boxes');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(t1).toContainText('Jo');
  await expect(t2).toContainText('Alex');

  // Tap two to swap back.
  await t1.locator('[data-team-pid]', { hasText: 'Jo' }).click();
  await t2.locator('[data-team-pid]', { hasText: 'Alex' }).click();
  await expect(t1).toContainText('Alex');

  // Switching off returns the plain list.
  await page.getByRole('button', { name: '2v2 teams on' }).click();
  await expect(page.getByTestId('team-picker')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play as 2v2 teams' }).click();
  await page.getByRole('button', { name: "Let's go!" }).click();
  await page.getByRole('button', { name: /PAR\s*4/ }).click();
  await expect(page.locator('.team-note')).toContainText('shared with');
  await shot(page, 'teams-pick');
});

/** A 2v2 game on the first tee of a par-4 nine: Sam & Alex against Jo & Kim, core cards only. */
function teamGame(device: string, seed: number): Game {
  const player = (id: string, name: string, color: number) => ({ id, name, color, deviceId: id === 'sam0000001' ? device : null });
  return {
    v: 1,
    rules: 2,
    seed,
    id: 'teamgame01',
    code: null,
    hostDeviceId: device,
    createdAt: 1,
    updatedAt: 1,
    course: '',
    status: 'playing',
    holes: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => ({ number, par: 4 as const })),
    current: 0,
    players: [
      player('sam0000001', 'Sam', 0),
      player('alex000001', 'Alex', 1),
      player('jo00000001', 'Jo', 2),
      player('kim0000001', 'Kim', 3),
    ],
    teams: [
      { id: 'team1', players: ['sam0000001', 'alex000001'] },
      { id: 'team2', players: ['jo00000001', 'kim0000001'] },
    ],
    entries: {},
    settings: { distanceCards: true, situationCards: false, tiebreakOnStrokes: false, mulligans: true, packs: ['core'], crown: true },
    decks: {},
    seq: 1,
  };
}

test('2v2 teams: a team shares one card and scores as a pair', async ({ page }) => {
  await page.goto('/');
  const device = await page.evaluate(() => JSON.parse(localStorage.getItem('sendit.device') ?? '""'));
  // Hands are random, so find a seed where both teams' cards are judged by the players, not from strokes.
  const byPlayers = (id: string | undefined) => {
    const card = getCard(id);
    return Boolean(card && !card.score && !card.vsLastHole && !card.self);
  };
  let game: Game | null = null;
  for (let seed = 1; seed < 5000 && !game; seed++) {
    const g = teamGame(device, seed);
    if (byPlayers(handFor(g, 'sam0000001', 0)?.bold) && byPlayers(handFor(g, 'jo00000001', 0)?.safe)) game = g;
  }
  expect(game).not.toBeNull();
  await page.evaluate(
    (g) => localStorage.setItem('sendit.session', JSON.stringify({ mode: 'local', code: null, game: g, pending: [] })),
    game,
  );
  await page.reload();

  // Only one partner on each team picks: Sam for team 1, then Jo for team 2.
  await expect(page.getByRole('heading', { name: 'Sam' })).toBeVisible();
  await expect(page.locator('.team-note')).toContainText('shared with');
  await pickAndReveal(page, 'Bold');
  await expect(page.getByRole('heading', { name: 'Jo' })).toBeVisible();
  await pickAndReveal(page, 'Safe');
  // Everyone is on this phone, so no 3-2-1 reveal (that's online only): straight to Go play!.
  await expect(page.getByRole('heading', { name: 'Go play!' })).toBeVisible();
  await shot(page, 'teams-play');
  await page.getByRole('button', { name: /Hole done/ }).click();

  // Everyone scores their own strokes; Sam completes the shared card, so Alex's miss doesn't count against the team.
  await enterScore(page, 5, true);
  await scoreMiss(page, 6);
  await enterScore(page, 4, true);
  await scoreMiss(page, 5);
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await shot(page, 'teams-results');
  await expect(page.locator('.board-row')).toHaveCount(2);
  // Sam & Alex: golf (+1, +2) averages to +1½, the Bold card counts once at −4, so −2½.
  await page.getByRole('button', { name: /^Standings/ }).click();
  const team1 = page.locator('.standings-row', { hasText: 'Sam & Alex' });
  await expect(team1.locator('.standings-total')).toHaveText('−2½');
  await team1.getByRole('button').click();
  await expect(team1.locator('.row-sum')).toContainText(/Golf\s*\+1½/);
  await expect(team1.locator('.row-sum')).toContainText(/Cards\s*−4/);
  await shot(page, 'teams-standings');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Fix a score' }).click();
  await shot(page, 'teams-scorecard');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'End round now' }).click();
  await page.getByRole('button', { name: 'End round' }).click();
  await expect(page.getByText(/wins!|tie!/)).toBeVisible();
  await page.waitForTimeout(1200);
  await shot(page, 'teams-final');
});

/** A partner who misses the card: the team still completed it, so the splash says Completed. */
async function scoreMiss(page: Page, strokes: number) {
  const value = page.locator('.stepper-value');
  while (Number(await value.textContent()) !== strokes) {
    const current = Number(await value.textContent());
    await page.getByRole('button', { name: current < strokes ? 'More strokes' : 'Fewer strokes' }).click();
  }
  // When the strokes settle the card, only the matching button is enabled.
  const settled = page.locator('.auto-result');
  const made = (await settled.isVisible()) && ((await settled.getAttribute('class')) ?? '').includes('made');
  await page.getByRole('button', { name: made ? /^Completed/ : /^Failed/ }).click();
  const flash = page.locator('.flash');
  await expect(flash).toBeVisible();
  await flash.click();
  await expect(flash).toBeHidden();
}
