# Game balance rulebook

How CardShot's scoring and cards are balanced, why, and how to judge any future change to them. It comes from well over a million simulated rounds run in October 2026 with the product owner (and Oliver). Read this before touching `tiers.ts`, `cards.ts`, `stakeFor()` or any rule that changes a score.

**Status:** new rounds play ruleset 2 (the Showdown update, Oct 2026; section 3b). Older saved games keep deck v2 (section 3). `npm run balance` checks ruleset 2; `npm run balance:legacy` checks deck v2.

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
| No hidden dealing. Cards are a fair random draw from the level's pile (ruleset 2: a random hand from the packs in play, the same for every player).                                                          | `deck.ts`, `hand.ts`     |
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
| Safe (8)   | S01 Bogey Buffer, S02 Penalty-Free, S04 Two-Putt Limit, S06 Green by Three (par 3), S10 No Bunker Visit, S11 The Safe Start (par 4/5), S12 No Triple Bogey, S16 Get It Going (150 m drive, par 4/5)                                                                                             |
| Bold (5)   | B16 Hold the Line (match or beat your last hole), B17 Lag It Close (first putt within 3 ft), B18 Tidy Hole (no penalty, ≤2 putts), B19 Fairway Finder (par 4/5), B20 The Lay-Up (par 5)                                                                                                         |
| Insane (7) | I16 Short Knee-Knocker (sink a 4 ft+ putt), I17 Sink a Tiddler (hole a 3 ft+ putt), I18 Bounce Back (beat your last hole), I19 Approach Party (approach within 30 ft, par 4/5), I20 One and Done (≤1 putt, chip-in counts), I21 Big Improvement (beat your last hole by 2+), I22 One-Putt Green |

Everything else in `cards.ts` is retired. Full odds per card: run `npm run balance` or see the tables in the simulation notes.

## 3b. Ruleset 2: the Showdown update

New rounds (`game.rules === 2`) work differently from deck v2. The full reasoning is in `DECISIONS.md` ("The Showdown update").

- **A hand of three.** One card from each level, seen before picking. Hands come from the game's seed (`hand.ts`), so they're random and the same on every phone. No redraws, no repeats until the packs run out.
- **Values:** Safe −1/+1, Bold −2/+2, **Insane −9/+4** (`TIERS_V2`). Seeing the card makes Insane easier to choose well, so its fail cost is one higher. The 2× finish is the same.
- **The Crown:** whoever leads alone at the start of a hole wears it; beating their score that hole is worth −1 (−2 on 2× holes). It's the same for everyone and is what keeps the lead moving.
- **Packs:** Core (always), Name It, Beat Yourself, Streaks, Par 3 & 5, Friends and Flag Length are on by default (34 cards). Hard Mode (6 club-limit cards) is off.
- **Live win chances** are shown but don't change scoring.

### Ruleset 2 targets

`npm run balance` (`scripts/balance/v2.ts`) uses the concept simulator in `scripts/concepts` with the cards and values in `src/game`. Every ruleset 2 card needs a simulator check: map its app id in `scripts/concepts/simIds.ts` (the run stops and names a card without one). `BALANCE_PACKS="core,nameIt"` checks other pack mixes.

| Target                                                                        | Default packs (Oct 2026) |
| ----------------------------------------------------------------------------- | ------------------------ |
| "Always Safe/Bold/Insane" each win under 0.75× fair share vs real players     | 0.33 / 0.32 / 0.19       |
| The three fixed plans within 0.35 of each other                               | ✓                        |
| Each level picked 15–55% of the time                                          | 48% / 22% / 30%          |
| Leader with 3 to go wins ≤ 60%                                                | 51–53%                   |
| ≥ 45% of games decided in the last 3 holes                                    | 59–60%                   |
| The last hole is still live (2+ players with a 10% chance) in ≥ 65% of rounds | 79–84%                   |
| Best golfer in a mixed 12/18/24/30 group wins ≤ 2.6× fair share               | 2.48–2.51                |
| ≤ 30 strokes a round ride on cards judged by eye                              | 16–17                    |

Fixed plans are now judged against people picking from their hand, not against other fixed plans, which is why the numbers look lower than deck v2's. The skill target is looser than deck v2's (2.3) on purpose: the product owner wants groups of similar skill to be the focus and is fine with cards that suit better golfers a bit more, as long as personal cards keep weaker players in it.

### Ruleset 2 against deck v2 (similar 4 players, 18 holes)

| Measure                        | Deck v2 | Ruleset 2  |
| ------------------------------ | ------- | ---------- |
| Leader with 3 to go wins       | 60%     | 51–53%     |
| Decided in the last 3 holes    | 48%     | 59–60%     |
| Last hole still live           | 66%     | 79–84%     |
| Comeback wins                  | 37%     | 45–46%     |
| Different cards seen a round   | 11      | 34         |
| Strokes on cards judged by eye | 69      | 16–17      |
| Best golfer in a mixed group   | 2.07×   | 2.48–2.51× |
| A 10 beats a 20 (1v1)          | 73%     | 83%        |

(Deck v2's numbers here are from the concept simulator, so they differ a little from section 5's.)

### Pack mixes

| Packs                                       | Leader at 3 | Last hole live | Best golfer | Eye strokes | Note                                           |
| ------------------------------------------- | ----------- | -------------- | ----------- | ----------- | ---------------------------------------------- |
| Default                                     | 51%         | 79%            | 2.48×       | 16          | Ships                                          |
| Default without Go For It / Name Your Green | 53%         | 75%            | 2.41×       | 17          | The lever if the skill edge shows in playtests |
| Default + Hard Mode                         | 54%         | 79%            | 2.73×       | 13          | Over the skill target, so off by default       |
| Core only                                   | 51%         | 70%            | 2.00×       | 35          | Over the eye-strokes target; repeats a lot     |

## 4. What we learned (so nobody re-learns it the hard way)

1. **The old values had one right answer.** With every fail costing half the reward (−2/+1, −4/+2, −6/+3), every level breaks even at a 1-in-3 success rate. Safe cards landed ~87%, Insane ~8%, so Safe was worth about 4 strokes a pick more than Insane. Smart players picked Safe 97% of the time and "always Safe" won 2.5× its fair share.
2. **Equal average value is not balance.** You win a 4-player game by finishing _first_, so a swingy plan has extra value. With every level worth the same on average, "always Insane" won most. Safe has to be worth a little more on average to make up for its small swing. **Balance is measured by who wins, not by average value.**
3. **Whole numbers make balance sharp.** With the current deck, Insane at −8 makes "always Safe" best, −10 makes "always Insane" best, and −9 is the balance point. Bold at −3 instead of −2 makes Bold the obvious pick. Fine-tune by swapping cards (which shifts the odds), not by decimals.
4. **Hard Insane cards force huge numbers.** If Insane cards land ~17% (birdies, long putts), balance needs −14 to −29 for a completion. Insane cards around 25% keep the numbers sane.
5. **Skill-steep cards amplify skill.** "Par or better", "Birdie", "drive 200 m in the fairway" are far easier for good golfers, so they widen the gap. Putting cards and "beat your own last hole" cards are flat across skill.
6. **The 2× finish matters.** Without it, the leader with 3 to go wins 76% instead of ~59%.
7. **Free calls can be gamed.** Any card where the player names their own target lets them call something they'd make anyway (a double bogey on Insane). Name It cards set the targets per level instead (section 3b).
8. **Cards that reward a bad shot get played badly on purpose.** "Hole a 4 ft putt" made players lag short; "beat your last hole" plus a streak let players throw a hole. Those cards are legacy only in ruleset 2.
9. **Ideas tested and rejected:**

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
| Gold cards (rare cards worth double), wild holes (one random hole with a twist)          | Made the leader at 3 win more and the last hole matter less (ruleset 2 simulation).                            |

## 5. How to check a change: `npm run balance`

For ruleset 2 (new rounds) see section 3b. This section is `npm run balance:legacy`, which checks deck v2 for older saved games.

`npm run balance:legacy` plays thousands of simulated rounds with the deck and values **currently in the code**, using a golf model calibrated to real amateur stats (a 10 handicap shoots ~83, a 20 ~94, a 30 ~106). It takes a few minutes. Options:

- `BALANCE_VALUES="-1/1,-2/2,-9/3" npm run balance:legacy`: try values without editing code.
- `BALANCE_GAMES=800 npm run balance:legacy`: quicker and noisier, for exploring (works for `npm run balance` too).
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

### Team mode (2v2)

Teams use their own values because the card counts once for two players and either partner can complete it: Safe −3/+2, Bold −4/+3, Insane −12/+4. A team's hole score is the average of both golf scores plus the card result once. These were tuned in simulation (not in `npm run balance`, which only checks solo rounds). Don't change them, or the either-completes rule, without re-running a team simulation first.

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
- **Teams with hands.** 2v2 team values were tuned for the blind draw. They haven't been re-simulated with hands, the Crown or the new packs.
- **Ruleset 2's skill edge** (about 2.5× for the best golfer in a mixed group) is higher than deck v2's. It's within the target, but a playtest with a mixed group would show if it feels unfair.
- **Win chances** are a model of a model. They're within about 3 points of a full simulation (`scripts/concepts/wincheck.ts`), not of real rounds.
- **The model is a model.** Odds for new cards are simulated, not measured. Opt-in tracking of card completion rates in real games would confirm them.
