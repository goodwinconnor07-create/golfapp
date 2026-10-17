# Game balance rulebook

How CardShot's scoring and cards are balanced, why, and how to judge any future change to them. It comes from well over a million simulated rounds run in October 2026 with the product owner (and Oliver). Read this before touching `tiers.ts`, `cards.ts`, `stakeFor()` or any rule that changes a score.

**Status:** live in the app since deck v2 (Oct 2026). Re-check with `npm run balance`.

---

## 1. What the game is trying to be

These are the product owner's goals. Every change is judged against them.

1. **No obvious strategy.** Over many rounds, no single level (Safe, Bold or Insane) should be the one to pick every time. There should usually be a right play for the moment, but it shouldn't always be the same card. As a guide, each level should be picked roughly a third of the time.
2. **Real risk and reward.** Bold and Insane must always feel riskier than Safe: bigger rewards and bigger fail costs. Equal risk across the levels takes the fun out.
3. **Highs, lows and a winner not decided early.** Comebacks must be _possible_ through good golf and smart gambles. We don't force them or aim for a set comeback rate; sometimes a round just runs away, and that's fine.
4. **Same rules for everyone.** The leader and the player in last place play by exactly the same rules. If the leader can gain X, the player behind can win X back. Like basketball: 1, 2 or 3 points, play better than your opponent. No catch-up rules that only help whoever's behind.
5. **Real golf counts.** Players are playing real golf underneath the whole game, and they don't always play to their handicap. Strokes count in full; blow-up holes are part of golf.
6. **Skill matters, but cards shouldn't add to it.** Groups are usually similar skill (teen mates, dads' groups). If an 8 handicap plays a 28, the 8 should usually win. The cards must not give the better golfer _more_ of an edge, and the weaker player should still have a strategy that gives them a chance.
7. **Simple to play.** Whole-number values, one value per level, nothing hidden from players.

## 2. Hard rules (don't break these)

| Rule                                                                                                                                                                                                         | Where                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| Every level's fail cost is higher than the level below it, and so is its reward.                                                                                                                             | `tiers.ts`               |
| Values are whole numbers, one per level (not per card).                                                                                                                                                      | `tiers.ts`               |
| The same rules apply to every player at every point in the round. No rule may depend on the standings.                                                                                                       | `rules.ts`, `reducer.ts` |
| No hidden dealing. Cards are a fair random draw from the level's pile.                                                                                                                                       | `deck.ts`                |
| Real strokes are never changed; the game score is always strokes + card.                                                                                                                                     | `rules.ts`               |
| A hole counts at most 10 strokes (casual pick-up). No other cap on blow-ups.                                                                                                                                 | `LIMITS.maxStrokes`      |
| Card ids are permanent. Retire with `enabled: false`; never delete, renumber or move an existing id to another level (saved games check the level). To move a card, retire it and add a copy under a new id. | `cards.ts`               |
| Keep approved pass text exactly as written.                                                                                                                                                                  | `cards.ts`               |
| Any change to values, cards or scoring rules must pass `npm run balance` (section 5) and be recorded in `DECISIONS.md`.                                                                                      | —                        |

## 3. The current setup (deck v2)

### Values

| Level  | Completed | Failed | Odds (12 / 22 / 32 hcp) |
| ------ | --------- | ------ | ----------------------- |
| Safe   | −1        | +1     | 94% / 90% / 82%         |
| Bold   | −2        | +2     | 71% / 64% / 56%         |
| Insane | −9        | +3     | 26% / 24% / 24%         |

The last 3 holes of a round of 6+ holes count double (Insane −18 / +6). That is the only twist.

### Rules in play

- Pick a level, then draw a random card from that level. Score real strokes (max 10) and whether the card was completed.
- Mulligans (2 for 9 holes, 4 for 18) and one redraw a round: same for everyone.
- Cards judged by eye go to a group vote online.

### Switched off (and why)

| Rule                     | Why it's off                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Free shot for last place | Only helps whoever is behind (breaks rule 4). It also barely changed anything once values were balanced. Old games that used one still score it. |
| Situation cards          | All retired: they rarely apply and are hard to balance. The option is hidden.                                                                    |

### The deck

Most cards are **skill-flat**: about as makeable for a 32 handicap as for a 12. That keeps each level's value the same across the group, so the cards don't widen skill gaps. Three cards are judged against **your own last hole** (strokes against par), which is fair at every skill level and checked by the app from strokes.

| Level      | Cards                                                                                                                                                                                                                                                                                           |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safe (8)   | S01 Bogey Buffer, S02 Penalty-Free, S04 Two-Putt Limit, S06 Green by Three (par 3), S10 No Bunker Visit, S11 The Safe Start (par 4/5), S12 Triple Bogey Cap, S16 Get It Going (150 m drive, par 4/5)                                                                                             |
| Bold (5)   | B16 Hold the Line (match or beat your last hole), B17 Lag It Close (first putt within 3 ft), B18 Tidy Hole (no penalty, ≤2 putts), B19 Fairway Finder (par 4/5), B20 The Lay-Up (par 5)                                                                                                         |
| Insane (7) | I16 Short Knee-Knocker (sink a 4 ft+ putt), I17 Sink a Tiddler (hole a 3 ft+ putt), I18 Bounce Back (beat your last hole), I19 Approach Party (approach within 30 ft, par 4/5), I20 One and Done (≤1 putt, chip-in counts), I21 Big Improvement (beat your last hole by 2+), I22 One-Putt Green |

Everything else in `cards.ts` is retired. Full odds per card: run `npm run balance` or see the tables in the simulation notes.

## 4. What we learned (so nobody re-learns it the hard way)

1. **The old values had one right answer.** With every fail costing half the reward (−2/+1, −4/+2, −6/+3), every level breaks even at a 1-in-3 success rate. Safe cards landed ~87%, Insane ~8%, so Safe was worth about 4 strokes a pick more than Insane. Smart players picked Safe 97% of the time and "always Safe" won 2.5× its fair share.
2. **Equal average value is not balance.** You win a 4-player game by finishing _first_, so a swingy plan has extra value. With every level worth the same on average, "always Insane" won most. Safe has to be worth a little more on average to make up for its small swing. **Balance is measured by who wins, not by average value.**
3. **Whole numbers make balance sharp.** With the current deck, Insane at −8 makes "always Safe" best, −10 makes "always Insane" best, and −9 is the balance point. Bold at −3 instead of −2 makes Bold the obvious pick. Fine-tune by swapping cards (which shifts the odds), not by decimals.
4. **Hard Insane cards force huge numbers.** If Insane cards land ~17% (birdies, long putts), balance needs −14 to −29 for a completion. Insane cards around 25% keep the numbers sane.
5. **Skill-steep cards amplify skill.** "Par or better", "Birdie", "drive 200 m in the fairway" are far easier for good golfers, so they widen the gap. Putting cards and "beat your own last hole" cards are flat across skill.
6. **The 2× finish matters.** Without it, the leader with 3 to go wins 76% instead of ~59%.
7. **Ideas tested and rejected:**

| Idea                                                                                     | Result                                                                                                         |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Free shot / chaser's shield / leader can't pick Safe on 2× holes / bounce-back boost     | Help comebacks, but only for whoever is behind (rule 4).                                                       |
| Hidden dealer matching cards to skill, catch-up dealing                                  | No gain once the deck is skill-flat; hidden from players (rule 2).                                             |
| Per-card values                                                                          | Tilted the game toward Insane and widened margins.                                                             |
| Momentum boosts from your last hole's score (birdie boosts Insane, par Bold, bogey Safe) | Mostly boosted Safe and Bold (pars and bogeys are common), rewarded good golfers twice, and helped the leader. |
| Safe streak (Safe fail cost rises while you keep completing Safe)                        | Not needed on deck v2; it adds a rule to track for no real gain.                                               |
| Capping a hole at bogey, golf at half weight                                             | Hides real golf (rule 5).                                                                                      |
| Doubling the last 6 holes on 18 / a 3× finish                                            | Doubled the leader's safe gains too; worse.                                                                    |
| Players declaring a skill level                                                          | Easy to fake; new golfers don't know their handicap.                                                           |

## 5. How to check a change: `npm run balance`

`npm run balance` plays thousands of simulated rounds with the deck and values **currently in the code**, using a golf model calibrated to real amateur stats (a 10 handicap shoots ~83, a 20 ~94, a 30 ~106). It takes a few minutes. Options:

- `BALANCE_VALUES="-1/1,-2/2,-9/3" npm run balance`: try values without editing code.
- `BALANCE_GAMES=800 npm run balance`: quicker and noisier, for exploring.
- New card? Add how it's judged to `scripts/balance/checks.ts` first; the run stops and names any card without a check.

### Targets

A change should pass all of these (the run prints PASS/FAIL):

| Target                                                                                             | Why                     | Deck v2            |
| -------------------------------------------------------------------------------------------------- | ----------------------- | ------------------ |
| "Always Safe", "always Bold" and "always Insane" win within 0.35 of each other (1.00 = fair share) | Goal 1: no obvious plan | 0.84 / 0.71 / 0.68 |
| No "always X" plan reaches 1.10                                                                    | Goal 1                  | ✓                  |
| The smart player beats every fixed plan                                                            | Thinking should pay     | 1.56               |
| Each level picked 28–40% of the time                                                               | Goal 1                  | 36% / 32% / 32%    |
| Leader with 3 to go wins ≤ 70% (similar 4 players, 18 holes)                                       | Goal 3                  | 58%                |
| ≥ 35% of games decided in the last 3 holes                                                         | Goal 3                  | 51%                |
| Best golfer in a mixed 12/18/24/30 group wins ≤ 2.3× fair share (it was 2.27 before deck v2)       | Goal 6                  | 2.10               |

Also look at (not pass/fail): the dads and teens rows of the strategy test, comebacks, lead changes, how often Insane cards land, and 1v1 and 9-hole rounds.

### Reference numbers

| Similar-skill 4 players, 18 holes | Before (Oct 2026) | Deck v2 |
| --------------------------------- | ----------------- | ------- |
| Leader with 3 to go wins          | 82%               | 58%     |
| Decided in the last 3 holes       | 21%               | 51%     |
| Winner led from halfway           | 58%               | 27%     |
| Comeback wins                     | 15%               | 39%     |
| Lead changes a round              | 2.2               | 3.2     |
| Winning margin (strokes)          | 19.8              | 12.7    |
| Insane completions a round        | 1.6               | 5.9     |

## 6. How to decide on a proposed change

1. **Check it against the goals and hard rules (sections 1–2).** If it breaks a hard rule, the answer is no unless the product owner changes the rule itself; then update this file first.
2. **Run `npm run balance` before and after** on the same seed. Note which targets move.
3. **Recommend it only if** it passes every target _and_ clearly improves at least one goal without making another worse. A change that is neutral in the numbers isn't worth the extra rule for players to learn (goal 7).
4. **Write the recommendation** as: what changes, the before/after numbers that matter, which goal it helps, any goal it costs, and implement / don't implement.
5. **Ask the product owner** before changing values, cards or rules, then record the decision in `DECISIONS.md` and update section 3 here.

## 7. Known gaps and open questions

- **Small skill tilt.** For teen-only groups "always Safe" does a bit better (0.95) and "always Bold" worse (0.49); for dads, Bold suits a little better. Teens hit fewer fairways. Swapping a Bold card for a flatter one is the lever if playtests show it.
- **3 players and 1v1** are less balanced than 4 (a swingy plan is worth less with fewer opponents), and 1v1 over 18 holes is the least dramatic format (leader with 3 to go wins 79%).
- **Bold has only 3 cards for a par 3** (B16, B17, B18). If 4+ players pick Bold on a par 3, someone repeats a card.
- **Some Insane cards may not _feel_ insane** (Sink a Tiddler is a 3-foot putt). The maths works; the wording may need a playtest.
- **"Beat your last hole" cards** are re-judged if the last hole's score is corrected later; that's intended (results always come from the strokes).
- **Teams** are a future idea. Re-run the balance checks with team scoring before shipping it.
- **The model is a model.** Odds for new cards are simulated, not measured. Opt-in tracking of card completion rates in real games would confirm them.
