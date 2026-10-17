# CardShot: notes for Claude

A golf party game: before each hole every player picks Safe, Bold or Insane, draws a random card from that level, plays the hole, then enters real strokes and whether they completed the card. Read `docs/SPEC.md` (the product spec), `docs/DECISIONS.md` (what's been decided since) and `docs/GAME_BALANCE.md` (the balance rulebook) before changing game rules.

## Commands

- `npm run dev`: app plus the Worker and Durable Object, all local (http://localhost:5173)
- `npm run typecheck`: `tsc -b` over app, worker and tooling projects
- `npm test`: Vitest unit tests for `src/game`
- `npm run e2e`: Playwright, phone-sized Chromium, starts its own dev server on 5174. In the cloud sandbox, Chromium is at `/opt/pw-browsers` and `@playwright/test` is pinned to 1.56.1 to match it. Set `SHOTS_DIR=/some/dir` to save a screenshot of each screen. `BROWSER=webkit` runs them in WebKit (Safari's engine) to catch iPhone-only bugs like the card flip; run `npx playwright install-deps webkit` first in the sandbox. Two tests (offline mode, and a page crash on `goto` after a reload) fail in headless WebKit even on older code.
- `npm run check`: typecheck + unit tests + build. Run it before committing.
- `npm run balance`: simulates thousands of rounds with the current deck and values and checks the balance targets in `docs/GAME_BALANCE.md`. Run it for any change to values, cards or scoring rules.
- `npm run deploy`: build and `wrangler deploy` (needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`)
- After editing `wrangler.jsonc`, run `npm run cf-typegen` and commit `worker-configuration.d.ts`.
- `npm run build:ios`: build for the iPhone app (with the live server's address) and copy it into `ios/`. TestFlight builds run on GitHub Actions (`.github/workflows/ios.yml`). See `docs/IOS.md`.

## Layout

- `src/game/`: pure TypeScript engine shared by the app and the server. No DOM or Node APIs here.
  Every game change goes through `applyAction()` in `reducer.ts`; screens never edit game objects.
- `src/state/store.ts`: the single app store and all screen commands. One-phone games apply actions locally; online games send them to the server and show a prediction until it confirms.
- `src/state/view.ts`: works out the in-game screen from the game data (never stored), so every phone lands on the right screen after a reconnect.
- `src/state/platform.ts` / `native.ts`: website vs iPhone app, the server's address, and the app's native extras. Use `apiUrl()`/`publicOrigin()` for server calls and shared links, never `location`.
- `worker/room.ts`: one `GameRoom` Durable Object per join code, the only true copy of an online game. `redactForDevice()` hides other players' picks until everyone has picked.

## Rules that matter

- Don't change the stroke modifiers in `tiers.ts` (Safe −1/+1, Bold −2/+2, Insane −9/+3; 2v2 team mode uses `TEAM_TIERS`: −3/+2, −4/+3, −12/+4) without the product owner asking, and never without passing `npm run balance`. They were tuned with the deck; see `docs/GAME_BALANCE.md`. The last 3 holes of a 6+ hole round count double, applied in `stakeFor()` in `rules.ts`, never by editing the tier values.
- Same rules for everyone: no rule may depend on the standings (no catch-up help for whoever's behind), and cards are dealt at random, never matched to a player. The free shot is switched off (`FREE_SHOT_ON` in `selectors.ts`).
- Never overwrite real strokes with game score. Game score is always derived from strokes + card result.
- Keep pass-condition text exactly as approved. Card ids are permanent: retire a card with `enabled: false`, never delete, renumber or move it to another level (saved games check the level). To move one, retire it and add a copy under a new id. A new card also needs a scene in `src/ui/shotArt.ts` and a check in `scripts/balance/checks.ts`.
- Anything arriving over the network goes through `parseAction()` / `sanitizeUpload()` in `validate.ts`.
- When a rule is ambiguous, ask the product owner rather than inventing one, then record the answer in `docs/DECISIONS.md`.

## UI style

White background (dark mode is built but switched off for now; see the note in `global.css`), big bold system font (SF Pro on iPhone), large colourful buttons, minimal text per screen, instant feedback (press scale, ripple, haptics, confetti, card flips) that never blocks play. Respect `prefers-reduced-motion`. The product owner prefers plain writing: no buzzwords, contractions are fine.

Every colour, font size, radius and shadow is a token in `:root` in `src/styles/global.css` (dark values sit in a switched-off block below it). Colours needed from code live in `src/ui/theme.ts`. Don't hard-code new values: spacing is on a 4px grid. `SMALL=1` and `REDUCED=1` run the e2e tests on a 360px phone or with Reduce Motion (`DARK=1` only matters once dark mode is back on).
