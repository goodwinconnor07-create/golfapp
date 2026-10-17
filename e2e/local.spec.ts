import { expect, test } from '@playwright/test';
import { enterScore, passGroupReveal, pickAndReveal, shot } from './helpers';

test('a one-phone round: setup, picks, scores, fixes and final results', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CARDSHOT' })).toBeVisible();
  await shot(page, '01-home');

  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByLabel('Your name').fill('Sam');
  await shot(page, '02-setup-players');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Where are you playing?')).toBeVisible();
  await page.getByRole('button', { name: /Skip/ }).click();
  await shot(page, '03-setup-holes');
  await page.getByRole('button', { name: /Front 9/ }).click();

  await expect(page.getByText('Ready to tee off?')).toBeVisible();
  // Invite first: the code is up straight away, and starting alone asks first.
  await expect(page.locator('.invite-panel .code-tiles')).toBeVisible();
  await shot(page, '04-lobby');
  await page.getByRole('button', { name: "Let's go!" }).click();
  await expect(page.getByText('Start on your own?')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  // Alex has no phone, so Sam adds them to this one.
  await page.getByRole('button', { name: /No phone\? Add them/ }).click();
  await page.getByLabel('Name').fill('Alex');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.roster-item', { hasText: 'Alex' })).toBeVisible();
  await shot(page, '04b-lobby-with-guest');
  await page.getByRole('button', { name: 'Game options' }).click();
  await shot(page, '05-options');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: "Let's go!" }).click();

  // Hole 1: par, picks, reveal.
  await expect(page.getByText("What's the par?")).toBeVisible();
  await shot(page, '06-par');
  await page.getByRole('button', { name: /PAR\s*4/ }).click();

  await expect(page.getByRole('heading', { name: 'Sam' })).toBeVisible();
  await shot(page, '07-pick');
  await page.getByRole('radio', { name: /Bold/ }).click();
  await shot(page, '08-pick-selected');
  await page.getByRole('button', { name: 'Draw my Bold card' }).click();
  await expect(page.locator('.ccard.flipped')).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, '09-reveal');
  await page.getByRole('button', { name: 'Got it · pass to Alex' }).click();

  await expect(page.getByRole('heading', { name: 'Alex' })).toBeVisible();
  await pickAndReveal(page, 'Insane');

  await passGroupReveal(page, '09b-group-reveal');
  // The first card is open; Alex's is a one-line row with its title.
  await expect(page.locator('.ccard')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /^Alex: .*show card/ })).toBeVisible();
  await shot(page, '10-play');
  await page.getByRole('button', { name: /Hole done/ }).click();

  // Scores: Sam makes the card with 5, Alex misses with 6.
  await expect(page.locator('.stepper-value')).toHaveText('4');
  await shot(page, '11-score');
  await enterScore(page, 5, true, '11b-flash-made');
  await expect(page.getByRole('heading', { name: 'Alex' })).toBeVisible();
  await enterScore(page, 6, false, '11c-flash-missed');

  await expect(page.getByText('Hole 1 done!')).toBeVisible();
  await shot(page, '12-results');
  const rows = page.locator('.board-row');
  await expect(rows).toHaveCount(2);

  // Leaderboard and scorecard keep real strokes separate from game score.
  await page.getByRole('button', { name: /^Standings/ }).click();
  await shot(page, '13-leaderboard');
  // One golf-style leaderboard; strokes taken show as a detail line.
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.locator('.standings-row', { hasText: 'Sam' })).toContainText('5 strokes');
  // Tap a row: the round hole by hole, and how golf and cards add up.
  await page.locator('.standings-row', { hasText: 'Sam' }).getByRole('button').click();
  await expect(page.locator('.standings-row', { hasText: 'Sam' }).locator('.sum-line')).toContainText('Golf +1');
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Fix a score' }).click();
  await expect(page.getByRole('heading', { name: 'Scorecard' }).or(page.getByText('Scorecard'))).toBeVisible();
  await shot(page, '14-scorecard');
  // Correct Sam's strokes from 5 to 6: the real total updates.
  await page.getByRole('button', { name: 'Sam, hole 1' }).click();
  await shot(page, '15-edit');
  await page.getByRole('button', { name: 'More strokes' }).click();
  await page.getByRole('button', { name: 'Save score' }).click();
  await expect(page.locator('.note', { hasText: 'Strokes taken:' })).toContainText('Sam 6');
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: /Next hole/ }).click();
  await expect(page.getByText("What's the par?")).toBeVisible();
  await expect(page.locator('.hole-tag b')).toHaveText('Hole 2');

  // End early from the menu.
  await page.getByRole('button', { name: 'Menu' }).click();
  await shot(page, '16-menu');
  await page.getByRole('button', { name: 'End round now' }).click();
  await page.getByRole('button', { name: 'End round' }).click();
  await expect(page.getByText(/wins!|tie!/)).toBeVisible();
  await page.waitForTimeout(1200);
  await shot(page, '17-final');
  await page.locator('.screen').evaluate((el) => window.scrollTo(0, el.scrollHeight));
  await shot(page, '18-final-bottom');

  // On a computer, Share saves the results picture.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Share results' }).click()]);
  expect(download.suggestedFilename()).toBe('cardshot-results.png');
  if (process.env.SHOTS_DIR) await download.saveAs(`${process.env.SHOTS_DIR}/30-results-picture.png`);

  // The game survives a reload.
  await page.reload();
  await expect(page.getByText(/wins!|tie!/).or(page.getByText('CARDSHOT'))).toBeVisible();

  // The round is saved in Past games, behind the small clock button on Home.
  await page.goto('/');
  if (!(await page.getByRole('button', { name: 'Past games' }).isVisible())) {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Home' }).click();
  }
  await page.getByRole('button', { name: 'Past games' }).click();
  const round = page.locator('.history-row');
  await expect(round).toHaveCount(1);
  await round.click();
  await expect(round.locator('.history-player')).toHaveCount(2);
  await shot(page, '28-past-games');
  await page.getByRole('button', { name: 'See full results' }).click();
  await expect(page.getByText(/wins!|tie!/)).toBeVisible();

  // A round finished before Past games existed is picked up on the next visit.
  await page.evaluate(() => localStorage.removeItem('sendit.history'));
  await page.goto('/');
  if (!(await page.getByRole('button', { name: 'Past games' }).isVisible())) {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'Home' }).click();
  }
  await page.getByRole('button', { name: 'Past games' }).click();
  await expect(page.locator('.history-row')).toHaveCount(1);
});

test('how to play explains the stakes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'How to play' }).click();
  // A slideshow: Next (or a swipe) moves on, one idea per slide, ending with Let's play.
  const titles = ['Pick your risk', 'Get a card', 'Play the hole', 'Score it', 'Lowest score wins', 'Twists'];
  for (const [i, title] of titles.entries()) {
    await expect(page.getByRole('heading', { name: title })).toBeInViewport({ ratio: 0.9 });
    await page.waitForTimeout(1600); // let the example play
    await shot(page, `19-howto-${i + 1}`);
    if (i < titles.length - 1) await page.getByRole('button', { name: 'Next' }).click();
  }
  await page.getByRole('button', { name: "Let's play" }).click();
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
});

test('picking a course fills in the pars', async ({ page }) => {
  const pars = [4, 4, 5, 3, 4, 4, 4, 3, 5, 4, 3, 5, 4, 4, 4, 3, 4, 5];
  // Fake OpenGolfAPI answers (the app calls it directly) so the test doesn't depend on it.
  // Keep our server's GolfCourseAPI search out of it too (it has a small daily allowance).
  await page.route(
    (url) => url.pathname === '/api/courses',
    (route) => route.fulfill({ json: { courses: [] } }),
  );
  await page.route(
    (url) => url.hostname === 'api.opengolfapi.org' && url.pathname.endsWith('/courses/search'),
    (route) =>
      route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { courses: [{ id: 'test-course', name: 'Palmer Links', city: 'The Villages', state: 'FL', par: 72 }] },
      }),
  );
  await page.route(
    (url) => url.hostname === 'api.opengolfapi.org' && url.pathname.endsWith('/courses/test-course'),
    (route) =>
      route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: {
          id: 'test-course',
          name: 'Palmer Links',
          city: 'The Villages',
          state: 'FL',
          par: 72,
          scorecard: pars.map((par, i) => ({ hole: i + 1, par })),
        },
      }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('textbox').first().fill('Sam');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('Search for your course').fill('palmer');
  await page.getByRole('button', { name: /Palmer Links/ }).click();
  await expect(page.getByText('pars filled in for you')).toBeVisible();
  await expect(page.getByRole('button', { name: /Front 9/ })).toContainText('par 36');
  await shot(page, '27-holes-with-course');
  await page.getByRole('button', { name: /Front 9/ }).click();
  await page.getByRole('button', { name: "Let's go!" }).click();
  await page.getByRole('button', { name: 'Start anyway' }).click();
  // No par question: hole 1's par came from the course.
  await expect(page.locator('.par-tile')).toHaveAccessibleName('Par 4');
  await expect(page.getByRole('heading', { name: 'Sam' })).toBeVisible();

  // The course is remembered for next time.
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'New game' }).first().click();
  // A round is in progress, so the app asks first.
  await page.locator('.sheet').getByRole('button', { name: 'New game' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Recent')).toBeVisible();
  await expect(page.getByRole('button', { name: /Palmer Links/ })).toBeVisible();
  await shot(page, '26-course-recent');
});

test('late in the round: 2× stakes, the gap to the leader, no free shot, and redraw', async ({ page }) => {
  await page.goto('/');
  const device = await page.evaluate(() => JSON.parse(localStorage.getItem('sendit.device') ?? '""'));
  const done = (tier: string, cardId: string, strokes: number, outcome: string) => ({ tier, cardId, pickedBy: device, strokes, outcome });
  // Six holes at par 4; three played. Sam leads, Alex has dropped to last on hole 3.
  const game = {
    v: 1,
    id: 'lategame01',
    code: null,
    hostDeviceId: device,
    createdAt: 1,
    updatedAt: 1,
    course: '',
    status: 'playing',
    holes: [1, 2, 3, 4, 5, 6].map((number) => ({ number, par: 4 })),
    current: 3,
    players: [
      { id: 'sam0000001', name: 'Sam', color: 0, deviceId: device },
      { id: 'alex000001', name: 'Alex', color: 1, deviceId: null },
    ],
    entries: {
      'sam0000001:0': done('bold', 'B01', 5, 'missed'),
      'alex000001:0': done('bold', 'B01', 4, 'made'),
      'sam0000001:1': done('bold', 'B01', 4, 'made'),
      'alex000001:1': done('bold', 'B01', 4, 'made'),
      'sam0000001:2': done('bold', 'B01', 4, 'made'),
      'alex000001:2': done('bold', 'B01', 6, 'missed'),
    },
    settings: { distanceCards: true, situationCards: false, tiebreakOnStrokes: false },
    decks: {},
    seq: 1,
  };
  await page.evaluate(
    (g) => localStorage.setItem('sendit.session', JSON.stringify({ mode: 'local', code: null, game: g, pending: [] })),
    game,
  );

  // The leaderboard shows who moved after the last hole.
  await page.reload();
  await page.getByRole('button', { name: /^Standings/ }).click();
  await expect(page.locator('.standings-row', { hasText: 'Sam' })).toHaveClass(/climbed/);
  await expect(page.locator('.standings-row', { hasText: 'Sam' }).locator('.move-chip')).toHaveText('▲1');
  await expect(page.locator('.standings-row', { hasText: 'Alex' })).toHaveClass(/dropped/);
  // Race style: places as "1st", and a chip for places gained or lost.
  await expect(page.locator('.standings-row', { hasText: 'Sam' }).locator('.standings-rank')).toContainText('1st');
  await shot(page, '34-leaderboard-moves');
  await page.getByRole('button', { name: 'Close' }).click();

  // The scorecard marks skins in the winner's colour: hole 1 went to Alex, hole 2 tied and
  // rolled over, so Sam's win on hole 3 is worth 2.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Scorecard & fixes' }).click();
  await expect(page.getByLabel('Alex, hole 1')).toHaveClass(/skin/);
  await expect(page.getByLabel('Sam, hole 3').locator('.sc-skin')).toContainText('×2');
  await expect(page.locator('.sc-cell.skin')).toHaveCount(2);
  await shot(page, '34b-scorecard-skins');
  await page.getByRole('button', { name: 'Back' }).click();

  // Hole 4 of 6: double stakes, and Sam sees how far ahead he is.
  await expect(page.getByRole('heading', { name: 'Sam' })).toBeVisible();
  await expect(page.getByText('You lead Alex by 1 stroke')).toBeVisible();
  await expect(page.locator('.double-banner')).toContainText('Double stakes');
  await expect(page.getByRole('radio', { name: /Safe/ })).toContainText('Complete −2 · Fail +2');
  await expect(page.getByRole('switch', { name: /free shot/i })).toHaveCount(0);
  await pickAndReveal(page, 'Safe');

  // Alex is last, but the same rules apply to everyone: no free shot (docs/GAME_BALANCE.md).
  await expect(page.getByRole('heading', { name: 'Alex' })).toBeVisible();
  await expect(page.getByText("You're 1 stroke behind Sam")).toBeVisible();
  await expect(page.getByRole('switch', { name: /free shot/i })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /Insane/ })).toContainText('Complete −18 · Fail +6');
  await shot(page, '35-pick-insane-doubled');
  await page.getByRole('radio', { name: /Insane/ }).click();
  await page.getByRole('button', { name: 'Draw my Insane card' }).click();

  // One redraw a round.
  const first = await page.locator('.ccard-title').textContent();
  await page.getByRole('button', { name: /Redraw/ }).click();
  await expect(page.locator('.ccard-title')).not.toHaveText(first ?? '');
  await expect(page.getByRole('button', { name: /Redraw/ })).toHaveCount(0);
  await shot(page, '36-redrawn');
  await page.getByRole('button', { name: /^Got it/ }).click();
  await passGroupReveal(page, '37-group-reveal-late');
});

test('pick a picture: emoji and colour, remembered and changeable in the lobby', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'Pick a picture' }).click();
  await page.getByRole('radio', { name: '🦈' }).click();
  await page.getByRole('radio', { name: 'Colour 4' }).click();
  await expect(page.locator('.look-preview .avatar')).toHaveText('🦈');
  await shot(page, '40-pick-picture');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.hero-pic .avatar')).toHaveText('🦈');
  await shot(page, '41-name-with-picture');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Skip/ }).click();
  await page.getByRole('button', { name: /Front 9/ }).click();

  const sam = page.locator('.roster-item', { hasText: 'Sam' });
  await expect(sam.locator('.avatar')).toHaveText('🦈');

  // Change it from the lobby: back to the letter, new colour.
  await sam.click();
  await page.getByRole('radio', { name: 'Your letter' }).click();
  await page.getByRole('radio', { name: 'Colour 2' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(sam.locator('.avatar')).toHaveText('S');

  // A guest can't take Sam's colour.
  await page.getByRole('button', { name: /No phone\? Add them/ }).click();
  await expect(page.getByRole('radio', { name: 'Colour 2, taken' })).toBeDisabled();
});

test('sheets slide away: swipe down to close, a short drag springs back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'Change your picture' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400); // let it finish sliding up before measuring
  const head = page.locator('.sheet-grip-zone');
  const box = (await head.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  // A short drag isn't enough.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 40, { steps: 5 });
  await page.mouse.up();
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(300); // spring back

  // A longer one closes it.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 200, { steps: 8 });
  await page.mouse.up();
  await expect(sheet).toBeHidden();
});
