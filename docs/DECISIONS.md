# Product decisions

The spec ([SPEC.md](SPEC.md)) leaves some things open. This is what the app does today and who decided it. Anything here can change.

## Decided by the product owner

| Topic              | Decision                                                                                                                                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How a hole works   | Each player picks Safe, Bold or Insane first, then gets a random card from that level. Everyone gets a different card and picks their own level.                                                                                                                                                            |
| Distance cards     | Included as written, judged by eye (online, the group votes on claims). Metres for long shots, feet near the hole, as the spec has them. A game option turns them off. Cards show a pacing hint, such as "15 feet ≈ 5 big steps".                                                                           |
| Name               | Send It.                                                                                                                                                                                                                                                                                                    |
| Duplicate cards    | Switched off: **No Three-Putt** (same test as Two-Putt Limit) and **The Consistent Finish** (same as Par Hunter on a par 5). Both are still in `cards.ts` with `enabled: false`.                                                                                                                            |
| The Clean Par      | Reworded to "Finish the hole at par **or better** without taking a penalty stroke", so a clean birdie counts.                                                                                                                                                                                               |
| Long iron          | A 5-iron or longer. Any hybrid counts too. Shown on the card.                                                                                                                                                                                                                                               |
| One score          | One golf-style score everywhere: strokes taken, ± the challenge, against par. Lowest wins. Strokes taken show as a small detail line.                                                                                                                                                                       |
| Wording            | Challenges are **Completed** or **Failed** (not made/missed).                                                                                                                                                                                                                                               |
| Settled by strokes | When the strokes already prove the result, the app sets it and doesn't offer the other button. This covers par-or-better cards at par, and reach-the-green cards when the hole was finished within that many strokes. Cards that also depend on something else (like "without a penalty stroke") still ask. |
| Course search      | The host picks the course after entering their name, and hole pars fill in automatically. Recent courses are one tap. If a course has no hole pars, or setup is skipped, the app asks the par on each tee.                                                                                                  |

## Following the spec's recommended defaults

| Topic                | What the app does                                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Negative game scores | Kept as they are, never clamped.                                                                                                                                                                                              |
| Seeing other picks   | Online, picks stay hidden until the whole group has picked, then a 3-2-1 reveal shows everyone's level. Players on the host's phone pick one at a time.                                                                       |
| Situation cards      | Off by default (Short-Game Success, The Recovery Route, Bunker Escape, The Sand Save, The Comeback Birdie). A game option turns them on; then a card whose situation never happened counts as "didn't happen" with no change. |
| Ties                 | Ties stay ties. A game option breaks game-score ties on real strokes.                                                                                                                                                         |
| Round length         | Front 9, back 9, 18, or any 1 to 18 holes starting on any hole.                                                                                                                                                               |
| Real vs game score   | Stored separately. Game score is always worked out from the real strokes and the card result, so fixing a score recalculates everything.                                                                                      |

## My calls while building (easy to change)

- **Pars:** filled in from the course, or asked with one tap on each tee. They can also be set in Game options.
- **Cards that only fit some holes**, to avoid the same test showing up at two levels:
  - Green by Three: par 3 only. On a par 4 it's the same as Bold "Green in Regulation", and on a par 5 the same as Insane "Two-Shot Threat".
  - Green in Four: par 4 only. Trivially easy on a par 3, and the same as "Green in Regulation" on a par 5.
  - Pin Pointer, The Bullseye, The Wedge Shot and Wedge Perfection: par 4 and 5 only. On a par 3 the approach is the tee shot, which the par-3 cards already cover.
- **No Bunker Visit** stays in the deck. If the hole has no bunker in play, the player can swap it once for a card that doesn't need one.
- **Cards the strokes decide** are judged by the app: Bogey Buffer, No Triple Bogey, Par Hunter and Birdie Time. Cards with a strokes condition plus something else (like The Clean Birdie) are marked missed automatically when the strokes rule them out; otherwise the player taps Completed or Failed.
- **Decks:** one shuffled pile per level for the whole round, so cards don't repeat until the pile runs out.
- **Who can do what online:** you enter your own score (and any guests' on your phone). See "Changing scores" below. Only the host can start, end early, change options, add guests, remove players, or change a par once cards are out.
- **Joining late:** new players can join until the first hole is finished. Anyone can claim a name the host typed in at any time.
- **Ending early:** only holes everyone finished count towards totals.
- **Join codes:** 5 consonants, so a code can never spell a word. Online games are deleted 14 days after their last change.
- **Colour-blind support:** the levels are teal, orange and violet, and each also has its own icon (shield, flame, bolt) and 1, 2 or 3 bars.
- **End-of-round awards:** fewest strokes, sent it (most Insane cards made), comeback, biggest swing, card shark, daredevil, ouch, and safety first. Only the ones that apply show up.

## Open questions for later

- **"Green in Regulation"** asks for the green in par minus 1 strokes. Golfers know GIR as par minus 2, so the name may confuse some players. Rename it?
- **Par Three Sniper** (within 10 feet) and **The Par Three Master** (within 6 feet) are both Insane par-3 tee-shot cards. Keep both?
- **Two-Shot Threat** is named for two shots but the condition allows three strokes.
- **The Chip-In Chance** is Bold but may play more like Insane for amateurs. Worth watching in playtests.
- **Code guessing:** anyone who guesses a live code could see first names and join. Codes are random (3.2 million combinations) and expire, but a Cloudflare rate-limit rule on `/api/games/*` would make guessing impractical. Worth adding before a public launch.
- **Playtest data:** the spec suggests tracking how often each card is made. The app collects nothing today. That could be added as opt-in stats.

## Course data

- **OpenGolfAPI** (in use, free, no key): about 17,000 courses with hole pars, mostly in the US. Outside the US it usually finds the course but not its pars. Data is ODbL, so the app shows "© OpenStreetMap contributors" under results.
- **GolfCourseAPI** (switched on 13 Oct 2026): about 30,000 courses worldwide, including Australia and the UK. Free plan is 35 lookups a day; paid is US$9.99 a month for 10,000. The key lives only in the Worker secret `GOLFCOURSE_API_KEY` and is sent as `Authorization: Bearer <key>`. Its results show first.
- **GolfCore** (added 15 Oct 2026): about 35,000 courses with hole-by-hole scorecards, and much better Australian coverage than the others (it had 8 of the 9 Queensland clubs no other source had, and Brisbane River, listed as "Karana Downs Golf Course"). Its results with a scorecard show first. Free plan is 500 requests a month (10 a minute); Basic is US$10 a month for 10,000. It answers without a key until 4 Dec 2026; after that set the Worker secret `GOLFCORE_API_KEY`. Its terms (golfcore.org/terms) still need checking for commercial use.
- OpenGolfAPI is called straight from the phone: it refuses requests from Cloudflare Workers (403) but allows browsers. GolfCore and GolfCourseAPI go through our Worker so their keys stay secret, and their answers are saved in a CourseStore Durable Object (courses for 180 days, searches for 30), so each course or search only uses one lookup.

## Playing without signal (online games)

- Picks, scores and next-hole taps made with no signal are saved on the phone and sent when signal returns. The badge under the header says how many are waiting.
- Cards are normally dealt by the server. With no signal (or if the server's card hasn't arrived after 4 seconds) the phone deals the card itself, from the same tier and only cards that fit the hole, so play doesn't stop.
- When it syncs, the server keeps the phone's card if it's still allowed. If someone else on that hole already holds it (two phones offline drew the same card), the server deals a different card and that player's card changes. This should be rare.

## Sharing results

- Share on the final screen sends a picture of the results (winner, standings, a few awards) with the text as a caption. On a computer it saves the picture and copies the text.

## Invite first (everyone on their own phone)

- The product owner doesn't want to encourage one-phone games, where the host ends up doing all the work.
- New game asks only for the host's name. Creating the game gets a join code straight away, and the host's lobby leads with the code and a Share invite button.
- Adding a player to the host's phone is still possible for someone without a phone, but it's a small link ("No phone? Add them here").
- Starting with nobody else in the game asks "Start on your own?" first.
- With no signal, the game is still created on the phone and the lobby offers "Get invite code" to try again.

## Round twists (approved by the product owner, Oct 2026)

- **2× finish.** In rounds of 6 holes or more, the last 3 holes count double: every card's complete and fail values are doubled (Insane −12 / +6). The tier values in `tiers.ts` are unchanged; the doubling is applied in `stakeFor()` in `rules.ts`. Shorter rounds play at normal stakes throughout.
- **Free shot** (switched off in Oct 2026, see Game balance v2). Whoever is in last place (after at least one finished hole; not when everyone is tied) can play one card a round where failing costs nothing. Completing it still counts in full (doubled on the last holes). Players tied for last can each use theirs. It's chosen on the pick screen before the card is drawn.
- **Redraw.** Each player can swap one card a round for another from the same tier, on the card screen, before scoring.
- **Group vote.** On cards judged by eye (distance cards), when a player says they completed it, everyone else in an online game gets 👍 Fair / 👎 No way on their own phone. More 👎 than 👍 turns it into a fail. Ties and no votes leave the claim standing. Voting is open while the hole is being played and closes when the group moves on. Players without their own phone don't vote. One-phone games have no vote.
- **Group reveal.** When everyone has picked, each phone counts down 3-2-1 and flips every player's level over at once.
- **Standings while picking.** The pick screen says how far you are behind the leader (or ahead of second).
- **Leaderboard movement.** Places gained or lost on the last hole show as ▲/▼, and the hole results say when someone takes the lead.

## Finishing a hole online (waiting room)

- "Hole done" plays the colour fill. In an online game where some players are on other phones, it marks this phone's players as done (everyone sees it) and goes straight to entering this phone's score(s).
- After scoring you're in the waiting room, which lists each player as Still playing, Done · scoring or Scored. Other players' numbers aren't shown there. Players who've finished but not scored can be scored from the room ("Enter for them"), in case their phone has died.
- No result splash online: the shared reveal shows everyone's result instead.
- When everyone has scored, each phone flips the hole's results over one player at a time, worst first, so the best score on the hole lands last with a 👑. The standings (with rank arrows and any lead change) then appear on the same screen, with Next hole. Votes can still be cast there until the group moves on.
- Hiding scores in the room is a screen choice, not a server secret: phones do receive the numbers.
- With everyone on one phone, there's no room: scoring works as before, with the splash.

## Showing a hole's score (Oct 2026)

- The product owner found "5 − 4 = 1" next to "−3 to par" confusing, so every hole now shows its working against par as two pills that add up to the big number: **[Bogey +1] + [✓ Card −4]** → **−3**. The golf pill uses the usual names (Birdie −1, Par, Bogey +1…; plain "Par", never "Par 0"). The card pill is green when made and red when missed, with ✓/✗ as well, and notes "(2×)" on double-stakes holes and "free shot" when a free shot makes a fail cost 0.
- The splash and the fix-a-score sheet show the pills large with the total: [Bogey +1] + [✓ Card −4] = −3. The splash no longer repeats "3 under on this hole".
- Display only: scoring is unchanged, and real strokes still show on the stroke picker, the splash, the leaderboard and the scorecard.

## Player pictures (Oct 2026)

- Players can pick a picture: one of 12 emojis (⛳ 🏌️ 🐦 🦅 🔥 😎 🦈 🐐 🍺 🎯 👑 🌵) or their first letter, on one of the 8 avatar colours. It's optional: the letter on a colour is still the default.
- Picked on the name screen ("Pick a picture" or tap the avatar), or later by tapping your own row in the lobby. The host can set one for guests on their phone. The phone remembers your pick for the next game.
- Colours stay unique within a game: a colour someone else has is greyed out. Emojis can repeat.
- The server only accepts emojis from the list (`isAvatarEmoji`). No photo uploads for now.

## Changing scores (Oct 2026)

Replaces "anyone can enter or fix any score". The product owner wanted real games protected but still fixable.

- **Entering:** online, you enter scores for your own players only (yourself, plus guests on your phone). The host can also enter for anyone, for a dead phone ("Enter for them" is host-only).
- **Typo window:** you can fix your own score freely until the group moves on to the next hole.
- **Locked in:** once the group moves on (or the round ends), a fix becomes a request. The player whose score it is approves it; if you're asking about your own, the host approves. The asker can cancel. One open request per score; a new one replaces it.
- **Host:** can fix any score directly, as referee.
- **Where requests show:** a bell next to the trophy (online games). A red iOS-style count shows how many wait on you; tapping it opens Notifications with Approve (green) and Deny (red), or "No new notifications".
- **Shown to everyone:** every change to a locked-in score (or to someone else's) is recorded and listed under "Score changes" on the scorecard and final results, and the cell gets a ✎ mark.
- **One-phone games:** unchanged; everyone's on one phone, so fixes are direct and unrecorded.
- Enforced on the server (`scoreAccess()` in `rules.ts`), not just hidden in the app.

## Drawing a card (Oct 2026)

- No confetti when a card is drawn: drawing isn't a win yet, and the card face should have the screen to itself. Confetti stays for completions and wins. The flip, the Insane wind-up and the haptic stay.
- Trial: putting cards show a short putt scene on the card. It starts after the flip has landed, plays once (tap to replay), gives a light tap on the phone as the ball drops, and settles on a still that explains the card: ball in the cup, the distance, and the card's extra condition ("for par", "2 putts max"). Reduce Motion shows that still straight away.
- Every card now has a scene (product owner approved after the putting trial): drive, trouble (stakes and water), approach (a ring sized to the card's distance), bunker, chip and score (a pencilled scorecard using the hole's par). Scenes and tags live in `src/ui/shotArt.ts`; tags sum a card up at a glance, the approved pass text is unchanged. A unit test fails if a card in play has no scene.

## Mulligans (Oct 2026)

- A mulligan is a re-hit of one bad shot that doesn't count. The player enters their real strokes without the re-hit; the app records that a mulligan was used on that hole. It doesn't change the card result or the stroke modifiers.
- Each player gets 2 for a round of 9 holes or fewer, 4 for longer rounds. One per hole.
- Host setting in Game options, on by default, set before the round and locked once it starts.
- Taken during the hole: a "Take a mulligan" button under each card on the Go play! screen, with tokens for what's left, and Undo until the hole locks. Online, other phones get a note ("Sam took a mulligan 🔁"); you can only take your own (the host can for anyone). The score screen just reminds you not to count the re-hit, with Remove. It shows as a "Mulligan" tag on the hole results and an "M" on the scorecard. The host can also change it in Fix a score; fix requests don't change it.

## Standings drama (Oct 2026)

- Every hole: standings rows slide from their old place to the new one, with a green glow for a climb and red for a drop; scores count up.
- Big moments only, once per hole, after the standings settle: a new leader (crown and confetti), a tie for the lead, halfway in an 18-hole round, and the double-stakes holes coming up. It fades on its own after about 2.5 seconds and never blocks taps (Next hole works straight through). No extra screen per hole.

## Small-phone layout (Oct 2026)

- Card reveal: "Redraw · once a round" sits in the footer above Got it, so a long card or a small phone never hides it. The shot strip is a little shorter on short phones (740px tall or less).
- Go play!: one card is open (your own online, or the first player's on a shared phone). Everyone else's is a one-line row with their card's title and level; tap to open it. Mulligans show under open cards.
- Pop-up messages sit just above the footer buttons instead of under the top bar, so they don't cover headings or the scorecard's labels.

## How to play, wording and the course name (Oct 2026)

- How to play is a swipeable slideshow, one idea per slide (pick your risk, get a card, play the hole, score it, lowest score wins, twists). Each slide has a small example built from the real game pieces (the level buttons, a card flip, the golfer scene, the score pills, the leaderboard reorder) that replays when you land on it. Next or a swipe moves on; the last slide's button is Let's play.
- The course is set once, at the start (New game → Where are you playing?, which also fills in the pars). The free-text course name is gone from Game options.
- The par screen no longer repeats "Hole 1" under the top bar.
- Standings say "1 of 3 cards made" instead of "1/3 cards".
- The trophy and Past games stay as icons with no labels (product owner's call).

## Rebrand to CardShot (Oct 2026)

- The app is now called **CardShot**. The logo (`public/icons/icon.svg`) is a playing card with a golf flag on it, fired out of a cannon. The app icons and link-preview image are rendered from it (`npm run icons`), and the home screen shows the same icon.
- Only the name and logo changed. The game, its levels (Safe / Bold / Insane) and the lobby's "Ready to send it?" stay as they are.
- Kept on purpose: the `sendit.*` storage keys (so saved games and settings survive the update) and the Worker name `send-it` (renaming it would change the web address and start fresh game rooms).

## The iPhone app and who pays (Oct 2026)

- Logo: the driver knocking the card off a tee (not the cannon). It's the app icon and launch screen.
- The iPhone app is the web app wrapped with Capacitor (details in `docs/IOS.md`). It adds real haptics, the iOS share sheet, invite links that open the app and a native backup of saved games.
- **The host pays** for the app (planned $4.99). Friends join free on the website with the link or code. Once the app is in the App Store, the website stops starting games (`VITE_WEB_HOSTING=off`): Home shows Join a game first, and "Host · get the app" goes to the App Store.

## Names, lobby wording, privacy and support (Oct 2026)

- Player names go through a light filter (`src/game/names.ts`): slurs and obvious sexual or abusive words are refused with "Pick a different name.", including l33t and spaced-out spellings, without blocking real names like Dickson or Scunthorpe. Enforced in the reducer and on upload. Hosts can still remove players in the lobby.
- The host's lobby heading is "Ready to tee off?" (was the old brand's "Ready to send it?").
- `/privacy` and `/support` are plain pages on the website, linked from the last How to play slide (so they're one tap away in the app, as Apple asks). The contact email is a placeholder (`SUPPORT_EMAIL`) until the product owner picks one.

## Push notifications (Oct 2026)

- iPhone app only. It asks permission the first time it's in an online game.
- Four moments, never to the phone that caused them: the host starts the round; a hole's last score lands ("Hole 3 results are in"); someone claims a card judged by eye (the others are asked to vote); a score fix is waiting on your answer. Nothing for every pick or tap, to keep it from being noisy on the course.
- No banner while the app is open (the screen already shows it). Tokens are stored with the online game and deleted with it after 14 days; tokens Apple says are dead are dropped straight away.

## Game balance v2 (Oct 2026)

Decided by the product owner after the balance simulations. The full rulebook, targets and reasoning are in [GAME_BALANCE.md](GAME_BALANCE.md); `npm run balance` re-checks them.

- **Values:** Safe −1/+1, Bold −2/+2, Insane −9/+3 (was −2/+1, −4/+2, −6/+3). The old values made Safe the right pick almost every time.
- **Same rules for everyone:** nothing depends on the standings. The **free shot is switched off** (old games that used one still score it). The 2× finish on the last 3 holes stays.
- **Deck v2:** 8 Safe, 5 Bold, 7 Insane, mostly skill-flat cards. 12 new cards (S16, B16–B18, I16–I22) and Fairway Finder and The Lay-Up re-added as Bold (B19, B20; their Safe ids S03 and S15 are retired). Every other card is retired with `enabled: false`, including all situation cards, so the Situation cards option is hidden.
- **Cards judged against your own last hole** (B16 Hold the Line, I18 Bounce Back, I21 Big Improvement): the app compares this hole's score against par with your last hole's. With no last hole (first hole, joined late) each card has its own first-hole target. Correcting the last hole re-judges them.
- **10 strokes max per hole** (casual pick-up). Saved games with up to 20 still load.
- **No hidden dealing:** a skill-matched dealer was tested and made no difference once the deck was skill-flat.
- **Tested and not adopted:** chaser's shield, leader can't pick Safe on 2× holes, bounce-back and momentum boosts, a Safe streak, per-card values, capping holes at bogey, players declaring a skill level. Reasons in GAME_BALANCE.md.
- This answers the open questions about Green in Regulation, Par Three Sniper vs Master, Two-Shot Threat and The Chip-In Chance: all retired.

## Race standings, skins and reactions (Oct 2026)

Asked for by the product owner. None of these change the score or the rules (docs/GAME_BALANCE.md still holds).

- **Race standings (Mario Kart style):** every standings row (hole results, the online results reveal, the leaderboard and the final screen) leads with a big place badge (1st gold, 2nd silver, 3rd bronze, "=2nd" for ties). After a hole, rows slide from their old place to the new one, the place pops, and a ▲2 / ▼1 chip shows places gained or lost. Under the hole's title, "🏎️ Sam overtakes Alex" lines name each pass (up to 3; the new leader keeps the existing "takes the lead" banner instead).
- **Skins, scorecard only:** the single best game score on a finished hole wins its skin; ties roll it over to the next finished hole (a tie on the last hole means nobody wins it). The winning cell gets a frame and a ribbon in the winner's avatar colour with their emoji (or initial), and "×2", "×3"… when it carried over. No prize, no other screen, no setting. Worked out from the scores (`skins()` in `selectors.ts`), never stored.
- **One-tap reactions and heckles:** 🔥 👏 😂 🫣 🤡 under other players' hole results, for players on another phone (heckling someone on your own phone happens out loud). One reaction per player per result; tap it again to take it back. Everyone sees the tallies. Open until the group moves on, like votes. Enforced in the reducer (`react` action), only listed emojis pass `parseAction()` / `sanitizeUpload()`. No push notifications for them.
