import { expect, test } from '@playwright/test';
import { handFor, nameItLabel, nameItTarget, getCard, type Game } from '../src/game';
import { enterScore, pickAndReveal, shot } from './helpers';

/** A ruleset 2 game, three holes in on a par-4 six: Sam leads, so Sam wears the crown on hole 4. */
function midRound(device: string, seed: number): Game {
  const done = (tier: 'safe' | 'bold', cardId: string, strokes: number, outcome: 'made' | 'missed') => ({
    tier,
    cardId,
    pickedBy: device,
    strokes,
    outcome,
  });
  return {
    v: 1,
    rules: 2,
    seed,
    id: 'showdown01',
    code: null,
    hostDeviceId: device,
    createdAt: 1,
    updatedAt: 1,
    course: '',
    status: 'playing',
    holes: [1, 2, 3, 4, 5, 6].map((number) => ({ number, par: 4 as const })),
    current: 3,
    players: [
      { id: 'sam0000001', name: 'Sam', color: 0, deviceId: device },
      { id: 'alex000001', name: 'Alex', color: 1, deviceId: null },
    ],
    entries: {
      'sam0000001:0': done('safe', 'S02', 4, 'made'),
      'alex000001:0': done('safe', 'S02', 5, 'made'),
      'sam0000001:1': done('safe', 'S04', 4, 'made'),
      'alex000001:1': done('safe', 'S04', 5, 'made'),
      'sam0000001:2': done('bold', 'B19', 5, 'made'),
      'alex000001:2': done('bold', 'B19', 5, 'missed'),
    },
    settings: {
      distanceCards: true,
      situationCards: false,
      tiebreakOnStrokes: false,
      mulligans: true,
      packs: ['core', 'nameIt'],
      crown: true,
    },
    decks: {},
    seq: 1,
  };
}

test('showdown: a hand of three, Name It, the Crown and live win chances', async ({ page }) => {
  await page.goto('/');
  const device = await page.evaluate(() => JSON.parse(localStorage.getItem('sendit.device') ?? '""'));
  // A seed whose hand for Sam on hole 4 holds Name Your Number (worked out exactly as the app does).
  let game: Game | null = null;
  for (let seed = 1; seed < 5000 && !game; seed++) {
    const g = midRound(device, seed);
    if (handFor(g, 'sam0000001', 3)?.bold === 'N01') game = g;
  }
  expect(game).not.toBeNull();
  await page.evaluate(
    (g) => localStorage.setItem('sendit.session', JSON.stringify({ mode: 'local', code: null, game: g, pending: [] })),
    game,
  );
  await page.reload();

  // Sam's turn: three cards, Name It offers a target per level, Sam wears the crown, win chance shown.
  await expect(page.getByRole('heading', { name: 'Sam' })).toBeVisible();
  await expect(page.locator('.crown-line')).toContainText('You wear the crown');
  await expect(page.locator('.win-line')).toContainText('% to win');
  await expect(page.locator('.hand-nameit .nameit-opt')).toHaveCount(3);
  const insane = nameItLabel(getCard('N01')!, 'insane', nameItTarget(game!, 'sam0000001', 3, getCard('N01')!, 'insane')!, 4);
  await expect(page.locator('.nameit-opt-insane')).toContainText(insane);
  await page.locator('.hand-nameit').scrollIntoViewIfNeeded();
  await shot(page, '50-hand-nameit');
  await page.locator('.nameit-opt-insane').click();
  await page.getByRole('button', { name: 'Play Name Your Number' }).click();

  // Alex's turn: Sam wears the crown, so beating Sam this hole is worth −2 on a 2× hole.
  await expect(page.getByRole('heading', { name: 'Alex' })).toBeVisible();
  await expect(page.locator('.crown-line')).toContainText('Sam wears the crown');
  await expect(page.locator('.crown-line')).toContainText('−2');
  await shot(page, '51-hand-crown');
  await pickAndReveal(page, 'Safe');

  // Go play: Sam's card shows the number called.
  await expect(page.getByRole('heading', { name: 'Go play!' })).toBeVisible();
  await expect(page.locator('.ccard-note').first()).toContainText(`Your call: ${insane}`);
  await page.getByRole('button', { name: /Hole done/ }).click();
  await enterScore(page, 6, false);
  await expect(page.getByRole('heading', { name: 'Alex' })).toBeVisible();
  await enterScore(page, 4, true);

  // Results: Alex beat the crown, and everyone's chance to win is under their total.
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(page.locator('.board-row', { hasText: 'Alex' }).locator('.hole-extra')).toContainText('Beat the leader');
  await expect(page.locator('.board-row .prow-score small').first()).toContainText('% to win');
  await shot(page, '52-results-crown');
});
