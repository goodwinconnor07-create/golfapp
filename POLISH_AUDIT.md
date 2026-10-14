# Polish audit

Stack: React 18 + Vite web app, served by a Cloudflare Worker. Native tools here mean CSS
transitions and keyframes (GPU-friendly `transform`/`opacity`), the Vibration API for haptics,
`prefers-color-scheme` and `prefers-reduced-motion`.

Taken from screenshots of all 49 screens the end-to-end tests reach (390×844 phone) plus a
read of the stylesheets. Each item is tagged with how often players see it: **A** = every hole,
**B** = every game, **C** = now and then.

## 1. Inconsistencies

- **A · Corner radii.** 19 different values (3, 4, 11, 12, 14, 16, 17, 18, 20, 22, 24, 26, 28, 30, 34px…).
  Buttons are 20/24, cards 22/24, tiles 16/18, chips 999. It reads as hand-tuned, not a system.
- **A · Font sizes.** 32 distinct sizes. The type scale isn't written down anywhere.
- **A · Colours.** About 200 hard-coded hex values (144 in CSS, 56 in components). Many are
  near-duplicates of the tokens (`#166534` vs `--green-lo`, `#dcfce7` vs `--green-bg`,
  `#fafafd`/`#f4f4f9` vs `--bg-2`). 40 of them are `#fff`, which blocks dark mode.
- **A · Shadows.** Several one-off shadows next to the two tokens.
- **B · Auto-judged results look different in two places.** On the score screen: a quiet green
  line ("✓ Completed · your strokes prove it"). In Fix a score: a big pink block
  ("Failed (not possible with that many strokes)").
- **B · Button labels.** Generic labels sit next to specific ones ("Save" in Fix a score,
  "Done" in sheets, but "Save score" and "Draw my Bold card" elsewhere).
- **C · Icons.** One stroke set (good), but the empty-state and award icons are emoji while
  the UI icons are line icons. That's fine for a party game; leave it.

## 2. Dead moments

- **A · Top bar.** Since the bell was added, the hole count ("1/9") wraps under "Hole 1 PAR 4"
  on a normal phone, so the header changes height between screens.
- **A · Numbers jump.** The big to-par numbers on results and the leaderboard snap to new values.
  A short count-up would show the change.
- **B · Course search.** "Searching…" as plain text while results load; no skeleton. Typing a
  name that finds nothing shows a blank area with no next step.
- **B · Toasts** land on top of the hole title and the top bar buttons.
- **C · First open.** The logo just appears. No small branded moment.
- **C · Joining a game.** A spinner on an empty screen. That's acceptable (it's short), but the copy can be warmer.

## 3. Rough edges

- **A · Leaderboard and final results.** "0/1 cards · 5 strokes" wraps onto two lines in the rows.
- **B · Final results.** The award tiles sit under the sticky Share/New game buttons until you
  scroll, so the first row looks cut in half.
- **B · Small links.** "Pick a picture", "No phone? Add them here" and "Fix a score" are
  13–15px text links. The tap areas are 44px tall, but they're easy to miss.
- **C · Safe areas.** Top and bottom use `env(safe-area-inset-*)`, which is good. Toasts don't
  account for the notch in landscape. Minor.
- **C · Large text.** Most sizes are in px, so iOS Dynamic Type doesn't scale them. Browsers
  still zoom, and layouts mostly wrap. Not breaking, but not ideal.

## 4. Tone

Copy is mostly warm and specific already ("Golf, but riskier.", "Locked in!", "Go play!").
A few spots to tighten:

- "Save" in Fix a score: say what happens ("Save score" / "Ask to change").
- "Searching…" with no result: needs a friendly "Nothing found" line with a next step.
- "Couldn't start online play." and "Couldn't reach course search…": say what to do next.

## Not a problem (checked)

- Every button and row has a press scale (0.96) and ripple, plus haptics on key moments.
- Reduce Motion is respected globally.
- Icon-only buttons have labels. Pass/fail always has ✓/✗ as well as colour.
- Contrast passes AA after the earlier colour pass.
- Empty states exist for past games and notifications.

## Fix order

1. Design tokens: radii, type scale, spacing, shadows, colours; swap hard-coded values for tokens.
2. Dark mode built on those tokens.
3. Top bar (hole count wrap) and toast position.
4. Count-up numbers, course search skeleton and empty result, final results awards.
5. Copy and the remaining rough edges.
6. Small first-open logo moment.

## Deliberately skipped

- **Streaks, XP, levels, reminders.** These are new features, and the brief says not to add features. A
  round is a one-off with friends, so streaks don't fit the game yet.
- **Sound effects, home screen widget, settings screen, onboarding flow.** The first three are
  new features, and a web app can't add a home screen widget. How to play already covers
  onboarding, and Home gets you to a first game in two taps.
- **Shared list→detail transitions.** The View Transitions API isn't in iOS Safari for in-page
  state yet, so it would only work on some phones.

---

## What changed

- **Design system.** One token set in `global.css`: type scale (8 sizes; display numbers excepted),
  5 radii plus pill and circle, a 4px spacing grid, 3 shadow levels plus a press shadow, and a full
  colour palette (brand, neutrals, success, warning, error, the three tiers). All ~200 hard-coded colours
  in the stylesheets now use tokens; colours needed from code live in `src/ui/theme.ts`.
- **Dark mode**, following the phone's setting. Deep blue-black surfaces, the same saturated buttons
  (white text still passes), tinted panels as low-opacity washes, lighter text tones on tints, black
  buttons as raised dark grey, hairline rings on dark avatars, and a dark browser bar.
- **Top bar.** The hole count moved to a thin progress line under the header that fills hole by hole,
  so the title no longer wraps. Toasts sit under the top bar instead of on it.
- **Count-up scores.** Big to-par numbers on results and the leaderboard tick to their value (450ms, ease-out).
- **Course search.** Shimmering placeholder rows while loading; a friendly "No courses by that name" with
  the next step; a real error with **Try again**.
- **Consistency.** Fix a score shows the auto result exactly like the score screen; "Save" → "Save score".
- **Small phones.** "PAR 4" never splits; "2/3 cards · 13 strokes" wraps between phrases, not mid-word;
  result rows show the level chip as an icon under 380px so names have room.
- **First open.** The wordmark, tagline and level chips rise in after the logo pops, once per visit.
- **Copy.** "Couldn't start online play." → "Couldn't get a join code. Check your signal and try again."
- **QA hooks.** `DARK=1`, `SMALL=1` and `REDUCED=1` run the whole e2e suite in dark mode, on a 360px
  phone, and with Reduce Motion. All three pass, as does the normal run.

## Skipped, and why

- **Streaks, XP, levels, reminders, sounds, widgets, a settings screen, a new onboarding flow.**
  These are new features, and the brief says not to add any. Rounds are one-offs with friends.
- **Shared list→detail transitions.** iOS Safari doesn't support the View Transitions API for in-page changes yet.
- **Final results award tiles under the sticky buttons.** That's normal scrolling under a pinned footer. Making
  the footer scroll away would hide Share results, which is the main action there.
- **Dynamic Type.** Sizes are px tokens, so iOS text-size settings don't scale them (browser zoom still
  works). Switching the scale to rem is now a one-line change per token, but it needs a check of every
  screen at large sizes first.
- **Icon style.** UI icons are one line set at one weight. Emoji stay for awards and empty states on purpose (party-game tone).
- **Pull-to-refresh.** Online games update live, so there's nothing to pull for.
