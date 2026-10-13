import { expect, test, type Browser, type Page } from '@playwright/test';
import { enterScore, newGame, pickAndReveal, shot } from './helpers';

async function phone(browser: Browser): Promise<Page> {
  const { viewport, deviceScaleFactor, isMobile, hasTouch, baseURL } = test.info().project.use;
  const context = await browser.newContext({ viewport, deviceScaleFactor, isMobile, hasTouch, baseURL });
  return context.newPage();
}

test('a friend claims the name the host already typed in', async ({ browser }) => {
  const host = await phone(browser);
  const friend = await phone(browser);

  await host.goto('/');
  await newGame(host, ['Hana', 'Ollie']);
  const tiles = host.locator('.invite-panel .code-tiles');
  await expect(tiles).toBeVisible();
  const code = ((await tiles.getAttribute('aria-label')) ?? '').replace('Game code', '').replace(/\s/g, '');

  // Typing the code by hand works too (lowercase and spaces are fine).
  await friend.goto('/');
  await friend.getByRole('button', { name: 'Join a game' }).click();
  await friend.getByLabel('Game code').fill(code.toLowerCase().split('').join(' '));
  await expect(friend.getByText('Who are you?')).toBeVisible();
  await friend.locator('.player-row', { hasText: 'Ollie' }).click();
  await expect(friend.getByText("You're in!")).toBeVisible();
  await expect(friend.locator('.player-row', { hasText: 'Ollie' }).getByText('You')).toBeVisible();

  await expect(host.locator('.player-row', { hasText: 'Ollie' }).getByText('Joined')).toBeVisible();

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
  const tiles = host.locator('.invite-panel .code-tiles');
  await expect(tiles).toBeVisible();
  const code = ((await tiles.getAttribute('aria-label')) ?? '').replace('Game code', '').replace(/\s/g, '');
  expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{5}$/);
  await shot(host, '20-invite');

  // A wrong code is caught.
  await guest.goto('/j/BBBBB');
  await expect(guest.getByText("There's no game with that code")).toBeVisible();
  await shot(guest, '21-join-bad-code');

  // Guest follows the link and adds themselves.
  await guest.goto(`/j/${code}`);
  await expect(guest.getByText('Who are you?')).toBeVisible();
  await guest.getByLabel('Your name').fill('Gus');
  await shot(guest, '22-join-who');
  await guest.getByRole('button', { name: 'Join as Gus' }).click();
  await expect(guest.getByText("You're in!")).toBeVisible();
  await shot(guest, '23-guest-lobby');

  await expect(host.locator('.player-row', { hasText: 'Gus' }).getByText('Joined')).toBeVisible();
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
  await expect(guest.getByText('Go play!')).toBeVisible();
  await expect(host.getByText('Go play!')).toBeVisible();
  await expect(host.locator('.ccard')).toHaveCount(2);
  await expect(guest.locator('.ccard')).toHaveCount(2);

  // Each phone scores its own player.
  await guest.getByRole('button', { name: /Hole done/ }).click();
  await enterScore(guest, 6, false);
  await expect(guest.getByText('Nearly there')).toBeVisible();
  await shot(guest, '26-guest-waiting-scores');

  await host.getByRole('button', { name: /Hole done/ }).click();
  await enterScore(host, 5, true);
  await expect(host.getByText('Hole 1 done!')).toBeVisible();
  await expect(guest.getByText('Hole 1 done!')).toBeVisible();
  await expect(guest.locator('.board-row')).toHaveCount(2);

  // Either phone can move everyone on. (Both tapping at once only moves one hole: see the engine tests.)
  await guest.getByRole('button', { name: /Next hole/ }).click();
  await expect(host.locator('.hole-tag b')).toHaveText('Hole 2');
  await expect(guest.locator('.hole-tag b')).toHaveText('Hole 2');

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
  await expect(host.getByText(/Hole 1 done|done!/)).toBeVisible();
});

test('a silently dead link still gets a card after a few seconds', async ({ browser }) => {
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
  await host.getByRole('radio', { name: /Bold/ }).click();
  await host.getByRole('button', { name: 'Draw my Bold card' }).click();
  await expect(host.getByText('Drawing your card…')).toBeVisible();
  await expect(host.locator('.ccard-title')).toBeVisible({ timeout: 8_000 });
});
