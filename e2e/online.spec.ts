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
  await host.getByRole('button', { name: 'Invite friends to join' }).click();
  const tiles = host.locator('.code-tiles');
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

  await host.getByRole('button', { name: 'Close' }).click();
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
  await host.getByRole('button', { name: 'Invite friends to join' }).click();
  const tiles = host.locator('.code-tiles');
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

  await host.getByRole('button', { name: 'Close' }).click();
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
