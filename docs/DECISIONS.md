# Product decisions

The spec ([SPEC.md](SPEC.md)) leaves some things open. This is what the app does today and who decided it. Anything here can change.

## Decided by the product owner

| Topic            | Decision                                                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How a hole works | Each player picks Safe, Bold or Insane first, then gets a random card from that level. Everyone gets a different card and picks their own level.                                               |
| Distance cards   | Included as written (honour system). Metres for long shots, feet near the hole, as the spec has them. A game option turns them off. Cards show a pacing hint, such as "15 feet ≈ 5 big steps". |
| Name             | Send It.                                                                                                                                                                                       |
| Duplicate cards  | Switched off: **No Three-Putt** (same test as Two-Putt Limit) and **The Consistent Finish** (same as Par Hunter on a par 5). Both are still in `cards.ts` with `enabled: false`.               |
| The Clean Par    | Reworded to "Finish the hole at par **or better** without taking a penalty stroke", so a clean birdie counts.                                                                                  |
| Long iron        | A 5-iron or longer. Any hybrid counts too. Shown on the card.                                                                                                                                  |

| One score | One golf-style score everywhere: strokes taken, ± the challenge. Lowest wins. No switching between views; strokes taken show as a small detail line. |
| Wording | Challenges are **Completed** or **Failed** (not made/missed). |
| Settled by strokes | When the strokes already prove the result, the app sets it and doesn't offer the other button. This covers par-or-better cards at par, and reach-the-green cards when the hole was finished within that many strokes. Cards that also depend on something else (like "without a penalty stroke") still ask. |

| Course search | The host searches for the course after adding players, and hole pars fill in automatically. Recent courses are one tap. If a course has no hole pars, or setup is skipped, the app asks the par on each tee. |

## Following the spec's recommended defaults

| Topic                | What the app does                                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Negative game scores | Kept as they are, never clamped.                                                                                                                                                                                              |
| Seeing other picks   | Online, picks stay hidden until the whole group has picked. On one phone, the pass-the-phone flow shows one player at a time.                                                                                                 |
| Situation cards      | Off by default (Short-Game Success, The Recovery Route, Bunker Escape, The Sand Save, The Comeback Birdie). A game option turns them on; then a card whose situation never happened counts as "didn't happen" with no change. |
| Ties                 | Ties stay ties. A game option breaks game-score ties on real strokes.                                                                                                                                                         |
| Round length         | Front 9, back 9, 18, or any 1 to 18 holes starting on any hole.                                                                                                                                                               |
| Real vs game score   | Stored separately. Game score is always worked out from the real strokes and the card result, so fixing a score recalculates everything.                                                                                      |

## My calls while building (easy to change)

- **Pars:** asked with one tap on each tee, so setup is just names and number of holes. They can also be set up front in Game options.
- **Cards that only fit some holes**, to avoid the same test showing up at two levels:
  - Green by Three: par 3 only. On a par 4 it's the same as Bold "Green in Regulation", and on a par 5 the same as Insane "Two-Shot Threat".
  - Green in Four: par 4 only. Trivially easy on a par 3, and the same as "Green in Regulation" on a par 5.
  - Pin Pointer, The Bullseye, The Wedge Shot and Wedge Perfection: par 4 and 5 only. On a par 3 the approach is the tee shot, which the par-3 cards already cover.
- **No Bunker Visit** stays in the deck. If the hole has no bunker in play, the player can swap it once for a card that doesn't need one.
- **Cards the strokes decide** are judged by the app: Bogey Buffer, No Triple Bogey, Par Hunter and Birdie Time. Cards with a strokes condition plus something else (like The Clean Birdie) are marked missed automatically when the strokes rule them out; otherwise the player taps Made it or Missed.
- **Decks:** one shuffled pile per level for the whole round, so cards don't repeat until the pile runs out.
- **Who can do what online:** anyone can enter or fix any score (it's a game between friends). Only the host can start, end early, change options, add guests, remove players, or change a par once cards are out.
- **Joining late:** new players can join until the first hole is finished. Anyone can claim a name the host typed in at any time.
- **Ending early:** only holes everyone finished count towards totals.
- **Join codes:** 5 consonants, so a code can never spell a word. Online games are deleted 14 days after their last change.
- **Colour-blind support:** the levels are teal, orange and violet, and each also has its own icon (shield, flame, bolt) and 1, 2 or 3 bars.
- **End-of-round awards:** best real golf, sent it (most Insane cards made), comeback, biggest swing, card shark, daredevil, ouch, and safety first. Only the ones that apply show up.

## Open questions for later

- **"Green in Regulation"** asks for the green in par minus 1 strokes. Golfers know GIR as par minus 2, so the name may confuse some players. Rename it?
- **Par Three Sniper** (within 10 feet) and **The Par Three Master** (within 6 feet) are both Insane par-3 tee-shot cards. Keep both?
- **Two-Shot Threat** is named for two shots but the condition allows three strokes.
- **The Chip-In Chance** is Bold but may play more like Insane for amateurs. Worth watching in playtests.
- **Code guessing:** anyone who guesses a live code could see first names and join. Codes are random (3.2 million combinations) and expire, but a Cloudflare rate-limit rule on `/api/games/*` would make guessing impractical. Worth adding before a public launch.
- **Online games without signal:** scores entered offline queue up and sync later, but drawing a card needs the server, so a pick waits until the phone reconnects. One-phone games work fully offline.
- **Playtest data:** the spec suggests tracking how often each card is made. The app collects nothing today. That could be added as opt-in stats.

## Course data

- **OpenGolfAPI** (in use, free, no key): about 17,000 courses with hole pars, mostly in the US. Outside the US it usually finds the course but not its pars. Data is ODbL, so the app shows "© OpenStreetMap contributors" under results.
- **GolfCourseAPI** (switched on 13 Oct 2026): about 30,000 courses worldwide, including Australia and the UK. Free plan is 35 lookups a day; paid is US$9.99 a month for 10,000. The key lives only in the Worker secret `GOLFCOURSE_API_KEY` and is sent as `Authorization: Bearer <key>`. Its results show first.
- OpenGolfAPI is called straight from the phone: it refuses requests from Cloudflare Workers (403) but allows browsers. GolfCourseAPI goes through our Worker so its key stays secret, and its answers are saved in a CourseStore Durable Object (courses for 180 days, searches for 30), so each course or search only uses one lookup.
