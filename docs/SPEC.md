**MASTER PRODUCT SPECIFICATION**

A recreational golf round transformed into a strategic, social
risk-and-reward game.

Purpose: Give Claude Code a single source of truth for the product
vision, gameplay, scoring, challenge catalogue, UX principles, edge
cases and implementation expectations.

Status: Product concept / working specification. Items explicitly marked
“open decision” are not yet finalised.

# 1. Executive summary

This is a mobile-first companion game for teenagers and young people who
play golf recreationally with friends. It adds a risk-and-reward
challenge layer to an ordinary round of golf. Before a hole, players see
a challenge and choose a difficulty/risk level: Safe, Bold or Insane.
They then play the hole normally. At the end of the hole, the app checks
whether each player's challenge was completed and adjusts that player's
golf score using a fixed stroke modifier. The goal is to make a casual
round more competitive, surprising and memorable without turning it into
a conventional golf-statistics app or forcing players to use their
phones constantly.

The defining mechanic is that challenge success or failure changes the
player's game score by adding or subtracting strokes. Lower adjusted
scores are better. Actual strokes must still be recorded and displayed
separately so the app never confuses a challenge-adjusted result with
the number of shots the player physically took.

# 2. Product vision and audience

## 2.1 Target audience

- Primary audience: teenagers and young adults who play golf
  recreationally with friends.

- Assume amateur-to-intermediate skill, not club-level or professional
  performance.

- The product should feel fun, competitive, social and easy to
  understand; it should not require expert golf knowledge.

- Challenges must be realistically achievable for this audience. Insane
  means difficult and exciting, not effectively impossible.

## 2.2 What the app is

- A party-game layer that sits on top of a real golf round.

- A simple, shared game for a group of friends playing the same course
  and holes.

- A risk-choice game: players decide how much score swing they are
  willing to accept.

- A game where ordinary golf ability still matters, but challenge
  choices can create comebacks and dramatic swings.

## 2.3 What the app is not

- Not primarily a GPS rangefinder, shot-tracking, handicap, coaching or
  analytics app.

- Not a replacement for normal golf scoring or the course's official
  scorecard.

- Not a game that requires players to take extra shots, repeat shots,
  play dangerously or slow down other groups.

- Not intended to require continuous phone use during a shot or every
  time a ball is hit.

# 3. Core gameplay loop

1.  Start a session and add the players in the group.

2.  Set up the round and hole information needed by the challenge pool,
    including hole number and par. Course-specific yardages are optional
    unless a selected challenge requires a distance.

3.  Before playing a hole, reveal the challenge for that hole. Each
    player chooses Safe, Bold or Insane.

4.  Players play golf normally. The app must not encourage unsafe shots
    or repeated attempts to satisfy a challenge.

5.  At the end of the hole, each player records their actual stroke
    count and resolves the challenge as completed or failed.

6.  The app applies the chosen difficulty's stroke modifier, shows
    actual strokes, challenge result, adjustment and adjusted hole
    score.

7.  Update the running adjusted leaderboard and the actual-strokes
    scorecard separately.

8.  Move to the next hole and repeat. At the end of the round, show both
    results and a recap of memorable challenge outcomes.

# 4. Scoring system: challenge-adjusted golf score

The challenge outcome modifies the number of strokes used for the app's
competitive game score. This is a custom party-game score, not an
official golf score or handicap score.

| **Risk choice** | **If challenge succeeds** | **If challenge fails** | **Meaning**                |
|-----------------|---------------------------|------------------------|----------------------------|
| Safe            | Subtract 2 strokes        | Add 1 stroke           | Smaller reward and penalty |
| Bold            | Subtract 4 strokes        | Add 2 strokes          | Medium reward and penalty  |
| Insane          | Subtract 6 strokes        | Add 3 strokes          | Largest reward and penalty |

## 4.1 Formula

Adjusted hole score = actual strokes − success bonus (if completed) +
failure penalty (if failed).

Equivalent implementation:

- Safe success: adjusted = actual strokes − 2.

- Safe failure: adjusted = actual strokes + 1.

- Bold success: adjusted = actual strokes − 4.

- Bold failure: adjusted = actual strokes + 2.

- Insane success: adjusted = actual strokes − 6.

- Insane failure: adjusted = actual strokes + 3.

## 4.2 Example

A player takes 5 strokes on a par 3 (a double bogey). They chose Bold
and complete their challenge. Their adjusted game score is 5 − 4 = 1.
This is a net challenge-adjusted score of 1, but the player physically
took 5 shots. The interface must label this clearly and must not claim
the player actually made a hole-in-one.

## 4.3 Score display rules

- Always preserve the actual strokes entered by the player.

- Show the adjusted score as a separate value, clearly labelled, e.g.
  “Game score” or “Adjusted score”.

- Never overwrite actual strokes with adjusted values.

- The main competitive leaderboard may rank by total adjusted score,
  with lower being better.

- Show the actual-strokes total separately so the group can see how the
  round was played in normal golf terms.

- If adjusted scores go below zero, retain the mathematical result
  unless product testing leads to a different rule. Do not silently
  clamp it.

- Do not describe adjusted scores as official golf scores, handicaps, or
  course records.

## 4.4 Important balance implication

The modifiers are intentionally large. A successful challenge can
outweigh several strokes of actual golf, especially at Bold and Insane.
This may be desirable for a party game, but it must be playtested. Do
not silently change the numbers: treat any balance change as a product
decision.

# 5. Challenge design principles

- Every challenge must have a binary outcome: completed or failed. No
  partial credit, subjective grading or “almost succeeded”.

- Every challenge must have a precise, visible pass condition.

- Difficulty must match amateur-to-intermediate recreational golfers.

- Safe should be broadly achievable; Bold should require a good shot or
  solid result; Insane should be a difficult but plausible achievement.

- Do not use professional-level feats such as hole-in-ones or eagles as
  routine Insane challenges.

- Avoid duplicate challenges disguised with different names. Each
  challenge should have a distinct objective, not just a renamed version
  of another.

- Avoid challenges that reward merely attempting something rather than
  achieving an outcome.

- Do not require extra shots, retries, unsafe club choices or
  intentional rule-breaking.

- Some challenges naturally require a particular hole type or situation.
  They must only be offered when eligible.

- Distance-based challenges need a consistent measurement convention and
  may be excluded from a first version if measurement is too burdensome.

- The same challenge should be offered to the group for a hole where
  practical, but each player chooses their risk level independently.

- Challenge success is assessed after the hole, not by repeatedly
  opening the app during play.

# 6. Challenge catalogue

The following is the current working catalogue: 15 Safe, 15 Bold and 15
Insane challenges. The wording below defines the intended pass
condition. A challenge is successful only if its condition is met;
otherwise it fails.

## 6.1 Safe — success: −2 strokes; failure: +1 stroke

**1. Bogey Buffer**  
Pass condition: Finish the hole at double bogey or better.  
Eligibility / implementation note: Whole hole; any par.

**2. Penalty-Free**  
Pass condition: Finish the hole without taking any penalty strokes.  
Eligibility / implementation note: Whole hole; any par.

**3. Fairway Finder**  
Pass condition: On a par 4 or par 5, finish the tee shot on the
fairway.  
Eligibility / implementation note: Par 4 or 5.

**4. Two-Putt Limit**  
Pass condition: Finish the hole using no more than 2 putts.  
Eligibility / implementation note: Whole hole; any par.

**5. Keep It in Bounds**  
Pass condition: Finish the hole without hitting a ball out of bounds.  
Eligibility / implementation note: Whole hole; any par.

**6. Green by Three**  
Pass condition: Reach the putting green in 3 strokes or fewer.  
Eligibility / implementation note: Use only where this is a reasonable
target; hole eligibility needs testing.

**7. Par Three Landing**  
Pass condition: On a par 3, finish the tee shot on the green or
fringe.  
Eligibility / implementation note: Par 3.

**8. No Lost Ball**  
Pass condition: Complete the hole without losing a ball.  
Eligibility / implementation note: Whole hole; any par.

**9. Short-Game Success**  
Pass condition: If the approach misses the green, get the next shot onto
the green.  
Eligibility / implementation note: Only offer when the hole's layout and
challenge setup make this condition applicable.

**10. No Bunker Visit**  
Pass condition: Complete the hole without the ball entering a bunker.  
Eligibility / implementation note: Only offer on a hole with a bunker in
play.

**11. The Safe Start**  
Pass condition: On a par 4 or 5, finish the tee shot in the fairway or
rough without taking a penalty on that shot.  
Eligibility / implementation note: Par 4 or 5.

**12. No Triple Bogey**  
Pass condition: Finish the hole at triple bogey or better.  
Eligibility / implementation note: Whole hole; any par.

**13. Green in Four**  
Pass condition: Reach the green in 4 strokes or fewer.  
Eligibility / implementation note: Only use where the target is not
trivially easy; hole eligibility needs testing.

**14. No Three-Putt**  
Pass condition: Do not take 3 or more putts on the hole.  
Eligibility / implementation note: Whole hole; any par.

**15. The Lay-Up**  
Pass condition: On a par 5, finish the second shot in the fairway.  
Eligibility / implementation note: Par 5; the second shot must be played
from a suitable lie.

## 6.2 Bold — success: −4 strokes; failure: +2 strokes

**1. Par Hunter**  
Pass condition: Finish the hole at par or better.  
Eligibility / implementation note: Whole hole; any par.

**2. Pin Pointer**  
Pass condition: Finish an approach shot within 15 feet of the hole.  
Eligibility / implementation note: Requires an approach shot and a
consistent distance-verification method.

**3. The Long Drive**  
Pass condition: On a par 4 or 5, hit a tee shot at least 170 metres.  
Eligibility / implementation note: Par 4 or 5; distance measurement
required.

**4. Pressure Putt**  
Pass condition: Sink a putt from at least 6 feet away.  
Eligibility / implementation note: Requires a putt from the stated
distance.

**5. Green in Regulation**  
Pass condition: Reach the green in par minus 1 strokes: 2 on a par 3, 3
on a par 4, or 4 on a par 5.  
Eligibility / implementation note: Whole hole; any par.

**6. Par Three Challenge**  
Pass condition: On a par 3, finish the tee shot within 20 feet of the
hole.  
Eligibility / implementation note: Par 3; distance verification
required.

**7. The Wedge Shot**  
Pass condition: Hit a wedge shot from 30–80 metres and finish within 15
feet of the hole.  
Eligibility / implementation note: Shot distance and club/landing
distance verification required.

**8. The Recovery Route**  
Pass condition: On a par 4 or 5, after a tee shot finishes in the rough,
reach the green in 3 additional strokes or fewer.  
Eligibility / implementation note: Par 4 or 5; only offer if rough is a
meaningful possible tee-shot outcome.

**9. The Birdie Look**  
Pass condition: On a par 4, reach the green in 2 strokes.  
Eligibility / implementation note: Par 4.

**10. The Clean Par**  
Pass condition: Finish the hole at par without taking a penalty
stroke.  
Eligibility / implementation note: Whole hole; any par.

**11. Bunker Escape**  
Pass condition: If the ball enters a greenside bunker, get it onto the
green with the next shot.  
Eligibility / implementation note: Only offer if the challenge's
required bunker situation is guaranteed or already known.

**12. The Long Putt**  
Pass condition: Sink a putt from at least 8 feet away.  
Eligibility / implementation note: Requires a putt from the stated
distance.

**13. Fairway to Green**  
Pass condition: On a par 4, hit the fairway from the tee and reach the
green with the second shot.  
Eligibility / implementation note: Par 4.

**14. The Chip-In Chance**  
Pass condition: Hole out from off the green in one shot.  
Eligibility / implementation note: Requires a shot from off the green;
situational.

**15. The Consistent Finish**  
Pass condition: Finish a par 5 in 5 strokes or fewer.  
Eligibility / implementation note: Par 5.

## 6.3 Insane — success: −6 strokes; failure: +3 strokes

**1. Birdie Time**  
Pass condition: Finish the hole at least 1 stroke under par.  
Eligibility / implementation note: Whole hole; any par.

**2. The Bullseye**  
Pass condition: Finish an approach shot within 6 feet of the hole.  
Eligibility / implementation note: Requires an approach shot and
distance verification.

**3. Long-Putt Legend**  
Pass condition: Sink a putt from at least 12 feet away.  
Eligibility / implementation note: Requires a putt from the stated
distance.

**4. Par Three Sniper**  
Pass condition: On a par 3, finish the tee shot within 10 feet of the
hole.  
Eligibility / implementation note: Par 3; distance verification
required.

**5. The Perfect Par Four**  
Pass condition: On a par 4, reach the green in 2 strokes and finish at
par or better.  
Eligibility / implementation note: Par 4.

**6. The Sand Save**  
Pass condition: From a greenside bunker, finish the hole at par or
better.  
Eligibility / implementation note: Only offer if bunker situation is
guaranteed or known.

**7. Wedge Perfection**  
Pass condition: Hit a wedge shot from at least 50 metres away and finish
within 6 feet of the hole.  
Eligibility / implementation note: Requires shot and distance
verification.

**8. The Big Drive**  
Pass condition: On a par 4 or 5, hit a tee shot at least 200 metres and
finish in the fairway.  
Eligibility / implementation note: Par 4 or 5; distance measurement
required.

**9. Two-Shot Threat**  
Pass condition: On a par 5, reach the green in 3 strokes or fewer.  
Eligibility / implementation note: Par 5.

**10. The Comeback Birdie**  
Pass condition: After missing the fairway with the tee shot, finish the
hole at birdie or better.  
Eligibility / implementation note: Par 4 or 5 where birdie is possible;
situational.

**11. Pressure Cooker**  
Pass condition: Sink a putt from at least 10 feet to save par or
better.  
Eligibility / implementation note: Requires a putt from the stated
distance and a par-saving outcome.

**12. The Clean Birdie**  
Pass condition: Finish the hole at birdie or better without taking a
penalty stroke.  
Eligibility / implementation note: Whole hole; any par.

**13. The Short-Game Showoff**  
Pass condition: From at least 10 metres off the green, hole out in one
shot.  
Eligibility / implementation note: Requires a shot from off the green
and distance verification.

**14. The Par Three Master**  
Pass condition: On a par 3, finish the tee shot within 6 feet of the
hole.  
Eligibility / implementation note: Par 3; distance verification
required.

**15. The Long-Iron Challenge**  
Pass condition: On a par 4 or 5, reach the green using a long iron or
hybrid for the approach shot, then finish at par or better.  
Eligibility / implementation note: Par 4 or 5; club category needs a
clear definition.

# 7. Challenge eligibility and fairness

The catalogue includes whole-hole objectives and situational objectives.
A production version must not randomly assign a challenge that a player
cannot meaningfully attempt. A challenge such as “Bunker Escape” is
unfair if the player never enters a bunker, unless the game deliberately
defines that outcome as a failure; the recommended default is not to use
that challenge unless its eligibility is known.

- Tag each challenge with: difficulty, hole par eligibility, required
  shot situation, distance requirement, club requirement, verification
  method, and whether it can be selected before the hole.

- Only deal challenges that are valid for the hole and group.

- If a situation is not known before the hole, either use a whole-hole
  challenge or make the challenge a conditional challenge that activates
  only when the situation occurs.

- Open decision: for conditional challenges, decide whether a situation
  that never occurs means “not applicable” (no score adjustment) or
  whether only guaranteed/known situations are eligible. Recommended
  default: do not offer a challenge unless its pass/fail outcome can be
  fairly resolved.

- Use a consistent distance unit in the app. The current examples use
  metres for longer shot distances and feet for near-the-hole / putting
  distances because the catalogue was drafted that way; standardise this
  before release.

- Do not require GPS precision or a measurement device unless the
  product deliberately includes that functionality.

- No challenge should require a player to aim at people, take an unsafe
  line, ignore course rules or delay the group.

# 8. Gameplay and interaction design

## 8.1 Before the round

- A player creates a session and enters or selects the participating
  players.

- Collect only the minimum required round setup: players, number of
  holes, and hole par information. Course name and hole distance may be
  optional.

- Explain that the app uses a custom adjusted score and that actual
  strokes remain separately recorded.

## 8.2 Before each hole

- Show the hole number and par.

- Show the challenge and its exact pass condition in plain language.

- Let each player choose Safe, Bold or Insane before they start the
  hole.

- The selection should be committed before the result is known. Consider
  hiding other players' choices until all players have selected, to
  prevent copying or pressure; this is a recommended design choice, not
  yet a confirmed requirement.

- Do not display a challenge that is ineligible for the hole.

## 8.3 After each hole

- Each player enters actual strokes.

- Resolve the challenge as success or failure using a simple tap.

- Show the calculation: actual strokes, challenge outcome, adjustment,
  adjusted score.

- Update both the actual-strokes scorecard and the adjusted leaderboard.

- Make corrections possible if someone enters the wrong number, with the
  score recalculated consistently.

## 8.4 End of round

- Show the winner by adjusted score, with lowest total adjusted score
  winning.

- Also show actual total strokes, clearly separated.

- Provide a fun recap: biggest score swing, most successful challenges,
  biggest comeback, and memorable outcomes. These are suggested
  features.

- Make it easy to share a result with the group, but avoid requiring
  account creation just to finish a casual round.

# 9. UX and visual principles

- Mobile-first; usable outdoors in bright sunlight.

- Large type, high contrast, large tap targets and minimal text during
  play.

- A player should be able to understand a challenge and make a choice in
  a few seconds.

- Avoid dense golf statistics, analytics dashboards, unnecessary menus
  or long explanations.

- Use clear visual distinction between Safe, Bold and Insane, while
  maintaining readable contrast for colour-blind users.

- Always make the selected risk level, challenge condition, actual
  strokes and adjusted score unambiguous.

- Prioritise the game flow over animations. Animations may celebrate a
  result but must not delay play.

- Do not require a player to pull out the phone after every shot.

# 10. MVP scope

## 10.1 Essential for first playable version

- Create a game session and add players.

- Set up holes and par values.

- Select and display eligible challenges.

- Choose Safe, Bold or Insane for each player.

- Enter actual strokes and mark challenge success/failure.

- Calculate adjusted hole scores correctly.

- Display separate actual-strokes and adjusted-score totals.

- Provide a running adjusted leaderboard.

- Allow correction of accidental data-entry mistakes.

## 10.2 Do not assume these are required for MVP

- GPS / automatic distance measurement.

- Official handicap calculations or integration with golf governing
  bodies.

- Automatic shot tracking.

- Complex accounts, friend graphs, matchmaking, subscriptions or social
  feeds.

- Advanced player profiles or long-term statistics.

# 11. Data model guidance

A simple conceptual model could include:

- Session: session ID, date, players, number of holes, course
  (optional), status.

- Hole: session ID, hole number, par, optional hole distance / notes.

- Player: session participant ID and display name.

- Player-hole result: player, hole, actual strokes, selected difficulty,
  challenge ID, challenge outcome, adjustment, adjusted score.

- Challenge definition: stable ID, title, difficulty, pass-condition
  text, eligibility tags, verification notes, enabled/disabled flag.

Store actual strokes and challenge-adjusted values separately. Prefer
calculating adjusted score from source fields rather than treating the
adjusted value as the only source of truth.

# 12. Validation and test cases

| **Test**               | **Input**                                 | **Calculation / rule**                    | **Expected result**                                                                                         |
|------------------------|-------------------------------------------|-------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| Safe success           | Actual 5 strokes                          | 5 − 2                                     | 3 adjusted strokes                                                                                          |
| Safe failure           | Actual 5 strokes                          | 5 + 1                                     | 6 adjusted strokes                                                                                          |
| Bold success           | Actual 5 strokes                          | 5 − 4                                     | 1 adjusted stroke                                                                                           |
| Bold failure           | Actual 5 strokes                          | 5 + 2                                     | 7 adjusted strokes                                                                                          |
| Insane success         | Actual 5 strokes                          | 5 − 6                                     | −1 adjusted strokes; decide whether negative scores are allowed, recommended default: retain mathematically |
| Insane failure         | Actual 5 strokes                          | 5 + 3                                     | 8 adjusted strokes                                                                                          |
| Actual-score integrity | Actual 5 strokes, Bold success            | Actual remains 5                          | Never rewrite actual strokes as 1                                                                           |
| Challenge eligibility  | Par-three-only challenge on a par four    | Ineligible                                | Do not offer it                                                                                             |
| Score correction       | Player changes actual strokes from 5 to 6 | Recalculate using same difficulty/outcome | All totals update                                                                                           |

# 13. Open product decisions

- Negative adjusted scores: allow them mathematically, or clamp at zero?
  Recommended for initial logic: do not clamp silently; decide after
  playtesting.

- Challenge visibility: should all players see each other's risk choice
  before the hole, or remain hidden until the hole ends? Recommended:
  hide until everyone commits.

- Challenge selection: one shared challenge for all players, or
  individual challenges? Current direction is a shared challenge per
  hole with individual risk selection.

- Situational challenge handling: only offer when applicable, or use a
  “not applicable” state? Recommended: filter them out unless
  eligibility is clear.

- Distance verification: self-reported, estimated by course markers,
  measured with a device, or avoid distance challenges in MVP? This
  needs a deliberate decision.

- Should the session be 9 holes, 18 holes, or custom length?
  Recommended: support 9 and 18 first, with custom length if easy.

- How to break ties in adjusted total: tie remains a tie, or use actual
  strokes as secondary tiebreaker? Recommended: show tied adjusted score
  and actual-stroke totals; use actual strokes as a transparent
  secondary tiebreaker only if the group wants one.

- Challenge catalogue quality: some current challenges overlap
  conceptually and some require situational eligibility. Playtest and
  replace challenges that are too easy, too hard, repetitive, hard to
  verify, or not applicable often enough.

# 14. Playtesting plan

- Test with groups of recreational teenagers / amateur golfers, not only
  strong golfers.

- Record completion rate by challenge and difficulty.

- Target feel: Safe is usually achievable, Bold is plausible but
  uncertain, Insane is rare but not absurd.

- If Safe is almost automatic, make the condition slightly harder. If
  Insane is almost never achieved, lower the difficulty.

- Check whether challenge-adjusted scores feel fun or overwhelm actual
  golf ability.

- Check whether the group can resolve a hole without slowing down or
  arguing.

- Remove or redesign any challenge that frequently produces “not
  applicable”, disputes or measurement friction.

- Test full-round score distributions to make sure one successful Insane
  challenge does not make the rest of the round feel irrelevant.

- Do not tune only for theoretical probability. Observe whether players
  understand the risk and feel the outcome is fair.

# 15. Instructions for Claude Code

Treat this document as the source of truth for product intent. Before
implementing a feature, preserve the core concept: a recreational golf
party game in which a player chooses a risk level for a hole, attempts a
binary challenge during normal golf, and has the result modify a
separate challenge-adjusted score while actual strokes remain intact.

- Do not turn this into a conventional golf GPS, statistics or coaching
  app.

- Do not replace the specified scoring modifiers without asking.

- Do not treat adjusted score as actual strokes or official golf score.

- Keep interactions short and suitable for outdoor use.

- Implement eligibility filtering so a challenge is not offered when its
  conditions cannot be fairly assessed.

- Use stable challenge IDs rather than challenge names as internal
  identifiers.

- Keep challenge text, difficulty, eligibility and scoring logic
  data-driven so the catalogue can be adjusted without rewriting the
  scoring engine.

- When a requirement is ambiguous or an open decision materially affects
  the experience, surface the decision instead of silently inventing a
  product rule.

- Use the challenge list as a working catalogue and expect
  playtesting-driven changes; preserve the exact pass conditions until
  the product owner approves edits.

# 16. Product in one paragraph

A mobile-first golf party game for recreational teenagers and young
adults. Before each hole, every player chooses Safe, Bold or Insane for
a shared binary challenge. Players then play normal golf and enter the
actual strokes they took. If they succeed, the chosen difficulty
subtracts 2, 4 or 6 strokes from their custom game score; if they fail,
it adds 1, 2 or 3. The app displays actual strokes separately from the
challenge-adjusted leaderboard, keeps interactions minimal, filters
challenges by hole/situation, and aims to make casual golf more
competitive, social and surprising without requiring professional-level
ability.
