# CardShot

Golf, but riskier. CardShot is a phone game that sits on top of a normal round of golf with friends.

Before each hole, every player picks **Safe**, **Bold** or **Insane** and draws a random challenge card from that pile. Everyone gets a different card. You play the hole for real, then enter your real strokes and whether you completed the card.

| Level  | Completed  | Failed     |
| ------ | ---------- | ---------- |
| Safe   | −2 strokes | +1 stroke  |
| Bold   | −4 strokes | +2 strokes |
| Insane | −6 strokes | +3 strokes |

Each hole: real strokes, minus or plus the card, scored over or under par like golf. Lowest total wins. Real strokes are always kept separately, and the app never passes a game score off as a real golf score.

Twists: the last 3 holes of a 6+ hole round count double, last place gets one free shot a round, everyone gets one redraw, and cards judged by eye go to a group vote online.

The product spec is in [docs/SPEC.md](docs/SPEC.md). Product calls made while building are in [docs/DECISIONS.md](docs/DECISIONS.md).

## Playing together

Everyone plays on their own phone. Starting a game gets a 5-letter code straight away, with a share link (`/j/CODE`) and a QR code. Friends open the link or type the code, then tap their name or add themselves. Picks stay hidden until the whole group has locked in, then a 3-2-1 reveal shows everyone's level. After a hole, each phone scores its own player and waits in a room until everyone's in, then the results flip over together.

Someone without a phone can be added to the host's phone ("No phone? Add them here"). Lost signal mid-round is fine: changes are kept on the phone and sent when signal returns.

## Run it on your computer

You need Node 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The dev server also runs the online game server (the Cloudflare Worker and its Durable Object) on your machine, so invite codes work locally with no Cloudflare account. To try it on your phone, open the "Network" address Vite prints while your phone is on the same Wi-Fi.

## Checks

```bash
npm run typecheck   # TypeScript, all three projects
npm test            # game engine unit tests (scoring, decks, rules, validation)
npm run e2e         # full rounds in a phone-sized Chromium, one-phone and two-phone
npm run check       # typecheck + unit tests + build
```

`npm run e2e` starts its own dev server. To test a production build instead, run `npm run build && npm run preview` and then `BASE_URL=http://localhost:4173 npm run e2e`.

## Putting it online (Cloudflare)

Everything is ready to deploy. One Worker serves the app and the online API, and each online game is its own Durable Object, so there's no database to set up. It fits in Cloudflare's free plan.

What's needed:

1. A Cloudflare account.
2. An API token made from the **Edit Cloudflare Workers** template (Cloudflare dashboard → My Profile → API Tokens).
3. Your Cloudflare **Account ID** (shown on the Workers & Pages overview page).

Please don't paste the token into a chat. Store it as a secret instead:

- **To let Claude deploy from a cloud session:** add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the Claude Code environment settings (the environment menu in the session's title bar, then **Edit**). A new session picks them up.
- **To deploy from GitHub automatically:** add the same two names as repository secrets (Settings → Secrets and variables → Actions). Every push to `main` then runs the checks and deploys.
- **To deploy by hand:** `CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npm run deploy`

The first deploy prints the live address (something like `https://send-it.<your-subdomain>.workers.dev`). Set that address as `PUBLIC_URL` when building (or as a GitHub Actions variable called `PUBLIC_URL`) so link previews in group chats show the Send It image.

Online games are deleted 14 days after their last change.

## Where things live

```
src/game/        The game engine. Plain TypeScript shared by the app and the server.
  cards.ts       The 45-card catalogue (data). Edit cards here.
  tiers.ts       Safe/Bold/Insane stroke modifiers.
  rules.ts       Eligibility, auto-judging from strokes, hole results.
  deck.ts        Shared shuffled deck per level, so players get different cards.
  reducer.ts     Every change to a game goes through applyAction().
  selectors.ts   Totals, leaderboards, end-of-round awards, hiding picks online.
  validate.ts    Checks everything that arrives over the network.
src/state/       App state, saving to the phone, the live connection, which screen to show.
src/screens/     One file per screen; game/ holds the in-round screens, sheets/ the pop-ups.
src/ui/          Shared pieces: buttons, the challenge card, icons, confetti and haptics.
worker/          Cloudflare Worker (API) and the GameRoom Durable Object (one per game).
e2e/             Playwright tests that play whole rounds.
scripts/         make-icons.ts redraws the app icons and link-preview image.
```

## Changing the game

- **Cards:** edit `src/game/cards.ts`. Keep each card's `id` forever, since saved games refer to cards by id. To retire a card, set `enabled: false`; don't delete or renumber it.
- **Which holes a card can appear on:** the `pars`, `distance`, `situational` and `needsBunker` fields.
- **Stroke modifiers:** `src/game/tiers.ts`. The spec treats these as a product decision, so change them on purpose.

## Tech

React 19 and Vite 8 for the app, a Cloudflare Worker with a SQLite-backed Durable Object (WebSocket hibernation) for online games, Vitest and Playwright for tests. The app is a PWA: add it to the home screen and it opens full screen, and the service worker keeps it working when the signal drops. No accounts, no tracking.

The font is the phone's system font. On iPhones that's SF Pro; other phones use their own bold system font, since Apple doesn't license SF Pro for use on the web.
