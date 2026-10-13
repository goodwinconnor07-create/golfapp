import { expect, test } from '@playwright/test';
import { enterScore, pickAndReveal, shot } from './helpers';

test('a one-phone round: setup, picks, scores, fixes and final results', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SEND IT' })).toBeVisible();
  await shot(page, '01-home');

  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByRole('textbox').first().fill('Sam');
  await page.getByRole('button', { name: 'Add player' }).click();
  await page.getByRole('textbox').nth(1).fill('Alex');
  await shot(page, '02-setup-players');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Where are you playing?')).toBeVisible();
  await page.getByRole('button', { name: /Skip/ }).click();
  await shot(page, '03-setup-holes');
  await page.getByRole('button', { name: /Front 9/ }).click();

  await expect(page.getByText('Ready to send it?')).toBeVisible();
  await shot(page, '04-lobby');
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

  await expect(page.getByText('Go play!')).toBeVisible();
  await expect(page.locator('.ccard')).toHaveCount(2);
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
  await page.getByRole('button', { name: 'Leaderboard' }).click();
  await shot(page, '13-leaderboard');
  // One golf-style leaderboard; strokes taken show as a detail line.
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.locator('.board-row', { hasText: 'Sam' })).toContainText('5 strokes');
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'Fix a score' }).click();
  await expect(page.getByRole('heading', { name: 'Scorecard' }).or(page.getByText('Scorecard'))).toBeVisible();
  await shot(page, '14-scorecard');
  // Correct Sam's strokes from 5 to 6: the real total updates.
  await page.getByRole('button', { name: 'Sam, hole 1' }).click();
  await shot(page, '15-edit');
  await page.getByRole('button', { name: 'More strokes' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
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

  // The game survives a reload.
  await page.reload();
  await expect(page.getByText(/wins!|tie!/).or(page.getByText('SEND IT'))).toBeVisible();
});

test('how to play explains the stakes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByText('Lowest score wins')).toBeVisible();
  await shot(page, '19-howto');
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
  // No par question: hole 1's par came from the course.
  await expect(page.locator('.par-chip')).toHaveText('PAR 4');
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
