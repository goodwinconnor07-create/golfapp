# App Store cards

Nine App Store screenshots for CardShot, at Apple's 6.9" iPhone size (1320 × 2868), in `out/`.
Every phone screen is the real app, captured from a seeded four-player round.

| # | Card | Screen |
|---|------|--------|
| 1 | Golf, but riskier. | Card reveal with the golfer |
| 2 | Pick your risk | Safe / Bold / Insane |
| 3 | Nail it. Drop strokes. | The Completed stamp |
| 4 | Everyone on their own phone | Lobby with the join code |
| 5 | Score it in seconds | Stroke counter |
| 6 | One good card flips the lead | Hole results and standings |
| 7 | Crown a winner | Final results and two awards |
| 8 | A proper scorecard | Scorecard |
| 9 | All this. And plenty more. | Feature grid |

## How they're made

- `seed.ts` plays a believable round through the real game engine (`src/game`) and saves it to `seed/`.
- `capture.spec.ts` loads that round in the app on a 430 × 878 screen at 3× (a Pro Max minus its status bar) and saves `screens/`.
- `cards.html` lays out each card: caption, phone frame, real screen. `render.mjs` saves `out/`.

```
npm run store:seed      # only if seed.ts changed
npm run store:capture   # after any change to the app's screens
npm run store:render    # after any change to cards.html
```

Open `cards.html` in a browser to see them all side by side while editing.

## What the research said, and how the cards follow it

- **The first three do most of the work.** Most people never swipe past the third screenshot, so
  1–3 sell the whole idea on their own: what it is, the big choice, and the payoff.
- **Short captions, readable as thumbnails.** One idea per card, a 2–5 word headline and one line
  under it, set large.
- **Real UI, real-looking data.** Apple wants screenshots to show the app in use. The screens are
  the actual app with four named players and a round in progress, not empty states.
- **One look across the set.** The same layout on every card, with the background colour changing
  to match the moment (tier colours, green for a win, gold for the end).
- **Upload:** App Store Connect takes up to 10 screenshots per size. A 6.9" set (1320 × 2868) is
  scaled down for smaller iPhones, so it's the only iPhone set needed.

Sources: Apple's [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications),
[AppTweak](https://www.apptweak.com/en/aso-blog/how-to-optimize-your-app-screenshots),
[AppLaunchFlow](https://www.applaunchflow.com/blog/app-store-screenshot-best-practices-2026),
[Sonar](https://trysonar.app/blog/app-store-screenshot-captions).
