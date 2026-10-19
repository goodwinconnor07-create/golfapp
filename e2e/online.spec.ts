import { expect, test, type Browser, type Page } from '@playwright/test';
import { enterScore, gameCode, holeDoneAndScore, newGame, passGroupReveal, passResultsReveal, pickAndReveal, shot } from './helpers';

/** web: a phone on the website (no app Home), like a friend opening the link. */
async function phone(browser: Browser, web = false): Promise<Page> {
  const { viewport, deviceScaleFactor, isMobile, hasTouch, baseURL } = test.info().project.use;
  // Left out, a new phone gets the config's storage (the app's Home); passed, it replaces it.
  const storage = web
    ? {
        storageState: {
          cookies: [],
          origins: [{ origin: new URL(baseURL!).origin, localStorage: [{ name: 'sendit.howto', value: 'true' }] }],
        },
      }
    : {};
  const context = await browser.newContext({ viewport, deviceScaleFactor, isMobile, hasTouch, baseURL, ...storage });
  return context.newPage();
}

test('a friend claims the name the host already typed in', async ({ browser }) => {
  const host = await phone(browser);
  const friend = await phone(browser, true);

  await host.goto('/');
  await newGame(host, ['Hana', 'Ollie']);
  const code = await gameCode(host, '.invite-panel');

  // Typing the code by hand works too (lowercase and spaces are fine). The website opens on it.
  await friend.goto('/');
  await friend.getByLabel('Game code').fill(code.toLowerCase().split('').join(' '));
  await expect(friend.getByText('Who are you?')).toBeVisible();
  await friend.locator('.player-row', { hasText: 'Ollie' }).click();
  await expect(friend.getByText("You're in!")).toBeVisible();
  await expect(friend.locator('.roster-item', { hasText: 'Ollie' }).getByText('You')).toBeVisible();

  await expect(host.locator('.roster-item', { hasText: 'Ollie' })).toBeVisible();

  // Only the host can start; the friend sees who they're waiting for.
  await expect(friend.getByText('Waiting for Hana to start')).toBeVisible();
  await host.getByRole('button', { name: "Let's go!" }).click();
  await expect(friend.getByText("What's the par?")).toBeVisible();
});

test('two phones: invite by code, hidden picks, live scores, reconnect', async ({ browser }) => {
  const host = await phone(browser);
  const guest = await phone(browser);

  // Host sets up and goes online.
  await host.goto('/');
  await newGame(host, ['Hana']);
  const code = await gameCode(host, '.invite-panel');
  expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{5}$/);
  await shot(host, '20-invite');

  // A wrong code is caught.
  await guest.goto('/j/BBBBB');
  await expect(guest.getByText("There's no game with that code")).toBeVisible();
  await shot(guest, '21-join-bad-code');

  // Guest follows the link and adds themselves.
  await guest.goto(`/j/${code}`);
  await expect(guest.getByText('Who are you?')).toBeVisible();
  await guest.getByRole('textbox', { name: 'Your name' }).fill('Gus');
  await shot(guest, '22-join-who');
  await guest.getByRole('button', { name: 'Join as Gus' }).click();
  await expect(guest.getByText("You're in!")).toBeVisible();
  await shot(guest, '23-guest-lobby');

  await expect(host.locator('.roster-item', { hasText: 'Gus' })).toBeVisible();
  await shot(host, '24-host-lobby-online');
  await host.getByRole('button', { name: "Let's go!" }).click();

  // Either phone can set the par; the other follows.
  await expect(guest.getByText("What's the par?")).toBeVisible();
  await guest.getByRole('button', { name: /PAR\s*5/ }).click();
  await expect(host.getByRole('heading', { name: 'Hana' })).toBeVisible();
  await expect(guest.getByRole('heading', { name: 'Gus' })).toBeVisible();

  // Host picks first and waits. The guest can't see the host's card yet.
  await pickAndReveal(host, 'Safe');
  await expect(host.getByText('Locked in!')).toBeVisible();
  await shot(host, '25-host-waiting');
  const guestView = await guest.evaluate(() => JSON.parse(localStorage.getItem('sendit.session') ?? '{}'));
  const hostId = guestView.game.players.find((p: { name: string }) => p.name === 'Hana').id;
  expect(guestView.game.entries[`${hostId}:0`]).toMatchObject({ hidden: true });
  expect(guestView.game.entries[`${hostId}:0`].cardId).toBeUndefined();
  expect(guestView.game.decks).toBeUndefined();

  // Guest picks; now both phones show both cards.
  await pickAndReveal(guest, 'Insane');
  // Both phones get the 3-2-1 reveal of everyone's level.
  await passGroupReveal(guest);
  await passGroupReveal(host);
  // Each phone shows its own player's card, and the group underneath with everyone's level.
  await expect(host.locator('.ccard')).toHaveCount(1);
  await expect(guest.locator('.ccard')).toHaveCount(1);
  await expect(host.locator('.group-row')).toHaveCount(2);
  await expect(host.locator('.group-row', { hasText: 'Hana' })).toContainText('You');
  await shot(host, '10b-live-hole');

  // Gus finishes first: straight to his score, then the waiting room while Hana plays on.
  await holeDoneAndScore(guest, 6, false);
  await expect(guest.getByRole('heading', { name: 'Waiting for Hana' })).toBeVisible();
  await expect(guest.locator('.group-row', { hasText: 'Hana' })).toContainText('Playing');
  await expect(guest.locator('.group-row', { hasText: 'Gus' })).toContainText('Scored');
  // Gus sees his own result while he waits.
  await expect(guest.locator('.my-result')).toBeVisible();
  await shot(guest, '26-guest-room');
  // Hana sees Gus has scored, but not his numbers.
  await expect(host.locator('.group-row', { hasText: 'Gus' })).toContainText('Scored');

  await holeDoneAndScore(host, 5, true);

  // Both phones reveal everyone's hole together: one list that re-sorts into the standings.
  await passResultsReveal(guest, '26b-results-reveal');
  await passResultsReveal(host);
  await expect(guest.locator('.board-row')).toHaveCount(2);
  await expect(guest.locator('.prow-rank').first()).toContainText('1st');

  // Heckle: Gus taps React, picks 🤡, and Hana's phone fills with it.
  const hanaRow = guest.locator('.result-row', { hasText: 'Hana' });
  await hanaRow.getByRole('button', { name: 'React', exact: true }).click();
  await hanaRow.getByRole('button', { name: 'React 🤡' }).click();
  // The picker closes and Gus's pick shows once, as his outlined tally.
  await expect(hanaRow.locator('.react-picker')).toHaveCount(0);
  await expect(hanaRow.locator('.react-tally.mine')).toHaveText('🤡');
  await expect(host.locator('.flood')).toBeVisible();
  await expect(host.locator('.flood-tag')).toContainText('Gus 🤡');
  await shot(host, '26d-reaction-flood');
  await expect(host.locator('.result-row', { hasText: 'Hana' }).locator('.react-tally')).toHaveText('🤡');
  // You can't heckle yourself.
  await expect(guest.locator('.result-row', { hasText: 'Gus' }).getByRole('button', { name: 'React', exact: true })).toHaveCount(0);
  await shot(host, '26c-reactions');

  // Either phone moves the group on, but the other phone keeps its results until its player moves on.
  await guest.getByRole('button', { name: /Next hole/ }).click();
  await expect(guest.locator('.hole-tag b')).toHaveText('Hole 2');
  await expect(host.getByRole('heading', { name: 'Results' })).toBeVisible();
  await expect(host.locator('.hole-tag b')).toHaveText('Hole 1');
  await host.getByRole('button', { name: /Next hole/ }).click();
  await expect(host.locator('.hole-tag b')).toHaveText('Hole 2');

  // The guest drops out and comes back: same game, same hole.
  await guest.reload();
  await expect(guest.locator('.hole-tag b')).toHaveText('Hole 2');
  await expect(guest.getByText("What's the par?")).toBeVisible();
});

test('no signal mid-round: deal, score and catch up later', async ({ browser }) => {
  const host = await phone(browser);
  await host.goto('/');
  await newGame(host, ['Hana']);
  await host.getByRole('button', { name: "Let's go!" }).click();
  await host.getByRole('button', { name: 'Start anyway' }).click();
  await host.getByRole('button', { name: /PAR\s*4/ }).click();
  await expect(host.getByRole('heading', { name: 'Hana' })).toBeVisible();

  // Signal drops on the tee.
  await host.context().setOffline(true);
  await expect(host.locator('.conn-pill')).toContainText('No signal', { timeout: 15_000 });

  // The phone deals the card itself, so play goes on.
  await pickAndReveal(host, 'Bold');
  await host.getByRole('button', { name: /Hole done/ }).click();
  await enterScore(host, 4, true);
  await expect(host.locator('.conn-pill')).toContainText('to send');
  await shot(host, '29-offline-waiting');

  // Back in signal: everything reaches the server and the badge goes away.
  await host.context().setOffline(false);
  await expect(host.locator('.conn-pill')).toBeHidden({ timeout: 20_000 });

  // The server kept the same result: reloading (which loads from the server) still shows it.
  await host.reload();
  await expect(host.getByRole('heading', { name: 'Results' })).toBeVisible();
});

// Hands are worked out on the phone, so picking never waits on the server.
test('a silently dead link: picking from the hand still works straight away', async ({ browser }) => {
  const host = await phone(browser);
  // Pass everything through, except that the server never hears about picks.
  let dropPicks = false;
  await host.routeWebSocket(/\/ws/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((m) => {
      if (dropPicks && String(m).includes('"pick"')) return;
      server.send(m);
    });
    server.onMessage((m) => ws.send(m));
  });
  await host.goto('/');
  await newGame(host, ['Hana']);
  await host.getByRole('button', { name: "Let's go!" }).click();
  await host.getByRole('button', { name: 'Start anyway' }).click();
  await host.getByRole('button', { name: /PAR\s*4/ }).click();
  await expect(host.getByRole('heading', { name: 'Hana' })).toBeVisible();

  dropPicks = true;
  const title = await pickAndReveal(host, 'Bold');
  await expect(host.getByRole('heading', { name: 'Go play!' })).toBeVisible();
  await expect(host.locator('.ccard-title').first()).toHaveText(title);
});

test('the group votes down an honour-system claim', async ({ browser }) => {
  const host = await phone(browser);
  const guest = await phone(browser);

  // Set up a round on the host's phone that's already on hole 1, where Hana has a card judged by eye.
  await host.goto('/');
  const hostDevice = await host.evaluate(() => JSON.parse(localStorage.getItem('sendit.device') ?? '""'));
  const game = {
    v: 1,
    id: 'votegame01',
    code: null,
    hostDeviceId: hostDevice,
    createdAt: 1,
    updatedAt: 1,
    course: '',
    status: 'playing',
    holes: [1, 2, 3].map((number) => ({ number, par: 4 })),
    current: 0,
    players: [
      { id: 'hana000001', name: 'Hana', color: 0, deviceId: hostDevice },
      { id: 'gus0000001', name: 'Gus', color: 1, deviceId: null },
    ],
    entries: {
      'hana000001:0': { tier: 'bold', cardId: 'B02', pickedBy: hostDevice }, // Pin Pointer
      'gus0000001:0': { tier: 'safe', cardId: 'S01', pickedBy: hostDevice }, // Bogey Buffer
    },
    settings: { distanceCards: true, situationCards: false, tiebreakOnStrokes: false },
    decks: {},
    seq: 1,
  };
  await host.evaluate((g) => {
    localStorage.setItem('sendit.session', JSON.stringify({ mode: 'local', code: null, game: g, pending: [] }));
    localStorage.setItem('sendit.revealed', `${g.id}:0`);
  }, game);
  await host.reload();
  await expect(host.getByRole('heading', { name: 'Go play!' })).toBeVisible();

  // Put it online and let Gus join on his own phone.
  await host.getByRole('button', { name: 'Menu' }).click();
  await host.getByRole('button', { name: 'Invite friends' }).click();
  const code = await gameCode(host);
  await host.getByRole('button', { name: 'Close' }).click();
  await guest.goto(`/j/${code}`);
  await guest.locator('.player-row', { hasText: 'Gus' }).click();
  await passGroupReveal(guest);

  // Hana says she made Pin Pointer.
  await holeDoneAndScore(host, 4, true);

  // Gus gets the vote on his phone and calls it.
  const vote = guest.getByRole('group', { name: "Vote on Hana's claim" });
  await expect(vote).toBeVisible();
  await shot(guest, '32-vote');
  await vote.getByRole('button', { name: /No way/ }).click();
  await expect(vote).toBeHidden();

  await holeDoneAndScore(guest, 4, true);
  await passResultsReveal(guest);
  await passResultsReveal(host);

  // Voted down: Hana's card counts as failed (+2), and both phones say so.
  for (const page of [host, guest]) {
    const hana = page.locator('.result-row', { hasText: 'Hana' });
    await expect(hana.locator('.working-delta.missed')).toContainText('+2');
    await expect(hana.getByText(/Voted down/)).toBeVisible();
    await expect(hana).toContainText('+2');
  }
  await shot(host, '33-vote-result');
});

test('a locked-in score: the guest asks, the host approves, and everyone sees the change', async ({ browser }) => {
  const host = await phone(browser);
  const guest = await phone(browser);
  await host.goto('/');
  await newGame(host, ['Hana']);
  const code = await gameCode(host, '.invite-panel');
  await guest.goto(`/j/${code}`);
  await guest.getByRole('textbox', { name: 'Your name' }).fill('Gus');
  await guest.getByRole('button', { name: 'Join as Gus' }).click();
  await expect(host.locator('.roster-item', { hasText: 'Gus' })).toBeVisible();
  await host.getByRole('button', { name: "Let's go!" }).click();
  await host.getByRole('button', { name: /PAR\s*4/ }).click();
  await pickAndReveal(host, 'Safe');
  await pickAndReveal(guest, 'Safe');
  await passGroupReveal(guest);
  await passGroupReveal(host);
  // Gus takes a mulligan (his phone only has the button for Gus); the host's phone hears about it.
  await expect(guest.getByRole('button', { name: /Mulligan: re-hit a shot/ })).toHaveCount(1);
  await guest.getByRole('button', { name: /Mulligan: re-hit a shot/ }).click();
  await expect(host.getByText('Gus took a mulligan 🔁')).toBeVisible();
  await expect(host.locator('.group-row', { hasText: 'Gus' })).toContainText('🔁 Mulligan');
  await holeDoneAndScore(guest, 6, false);
  await holeDoneAndScore(host, 5, true);
  await passResultsReveal(guest);
  await passResultsReveal(host);
  await host.getByRole('button', { name: /Next hole/ }).click();
  // Gus's phone keeps the results until he moves on.
  await guest.getByRole('button', { name: /Next hole/ }).click();
  await expect(guest.locator('.hole-tag b')).toHaveText('Hole 2');
  // Nothing waiting, so no bell in the top bar; Notifications is in the menu.
  await expect(guest.getByRole('button', { name: /^Notifications/ })).toHaveCount(0);
  await guest.getByRole('button', { name: 'Menu' }).click();
  await guest.getByRole('button', { name: 'Notifications' }).click();
  await expect(guest.getByText('No new notifications')).toBeVisible();
  await guest.getByRole('button', { name: 'Close' }).click();

  // Hole 1 is locked in: Gus can't change his own score directly, only ask.
  await guest.getByRole('button', { name: 'Menu' }).click();
  await guest.getByRole('button', { name: 'Scorecard & fixes' }).click();
  await guest.getByRole('button', { name: 'Gus, hole 1' }).click();
  const ask = guest.getByRole('button', { name: 'Ask to change' });
  await expect(ask).toBeDisabled();
  await guest.getByRole('button', { name: /^Fewer/ }).click();
  await ask.click();
  await expect(guest.getByText(/Waiting for the host to approve/)).toBeVisible();

  // The host's bell shows a red 1; the request is inside.
  const bell = host.getByRole('button', { name: /^Notifications/ });
  await expect(bell.locator('.badge')).toHaveText('1');
  await shot(host, '41b-bell-badge');
  await bell.click();
  const prompt = host.locator('.fix-card');
  await expect(prompt).toContainText('Gus wants to fix hole 1');
  await expect(prompt).toContainText('6 → 5 strokes');
  await shot(host, '42-fix-request');
  await prompt.getByRole('button', { name: 'Approve' }).click();
  await expect(prompt).toBeHidden();
  await expect(host.getByText('No new notifications')).toBeVisible();
  await host.getByRole('button', { name: 'Close' }).click();
  await expect(bell.locator('.badge')).toHaveCount(0);

  // Both scorecards show the new score and the record of the change.
  await expect(guest.locator('.edit-row')).toContainText('6 → 5 strokes');
  await expect(guest.locator('.edit-row')).toContainText('Gus asked · approved by the host');
  await shot(guest, '43-score-changes');
  await expect(guest.getByRole('button', { name: 'Gus, hole 1' })).toHaveClass(/edited/);
});
