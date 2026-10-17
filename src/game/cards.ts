import type { Par, Tier } from './types';

/**
 * A challenge card. Ids are stable: never reuse or renumber one, because
 * saved games refer to cards by id. To retire a card, set enabled to false.
 */
export interface CardDef {
  id: string;
  tier: Tier;
  title: string;
  /** Exact pass condition from the spec. Don't reword without the product owner's sign-off. */
  pass: string;
  /** Eligibility / implementation note from the spec. */
  note: string;
  /** Pars this card may be dealt on. */
  pars: readonly Par[];
  /** Needs a distance judged by eye, pacing or course markers (honour system). */
  distance?: boolean;
  /** Only counts if a situation happens. If it never happens the card is "didn't happen" (no change). */
  situational?: boolean;
  /** Only fair with a bunker in play. The player can swap it for another card if there isn't one. */
  needsBunker?: boolean;
  /**
   * Strokes rule the app can check by itself.
   * decides = true: the strokes alone decide the result (no tap needed).
   * decides = false: the strokes can only rule it out (over the limit = missed); otherwise the player taps.
   */
  score?: { maxToPar: number; decides: boolean };
  /**
   * The strokes alone prove the card was completed: finishing in this many strokes
   * (or this many relative to par) means the ball reached the green that quickly.
   */
  doneWithin?: { strokes?: number; toPar?: number };
  /**
   * Judged against the player's own last hole (strokes against par), so it's equally hard at any skill.
   * Completed when this hole's score to par is at most last hole's minus `by`. With no last hole
   * (first hole, or joined late), completed at `first` to par or better. The strokes always decide it.
   */
  vsLastHole?: { by: number; first: number };
  /** Short helper line shown under the pass condition. */
  hint?: string;
  enabled: boolean;
}

const ANY: readonly Par[] = [3, 4, 5];
const P3: readonly Par[] = [3];
const P4: readonly Par[] = [4];
const P5: readonly Par[] = [5];
const P45: readonly Par[] = [4, 5];

const SITUATION_HINT = "If it doesn't happen, the card doesn't count.";
const BUNKER_HINT = 'No bunker in play? Swap this card.';

export const CARDS: readonly CardDef[] = [
  // ── Safe: made −2, missed +1 ────────────────────────────────────────────
  { id: 'S01', tier: 'safe', title: 'Bogey Buffer', pass: 'Finish the hole at double bogey or better.', note: 'Whole hole; any par.', pars: ANY, score: { maxToPar: 2, decides: true }, enabled: true },
  { id: 'S02', tier: 'safe', title: 'Penalty-Free', pass: 'Finish the hole without taking any penalty strokes.', note: 'Whole hole; any par.', pars: ANY, enabled: true },
  { id: 'S03', tier: 'safe', title: 'Fairway Finder', pass: 'On a par 4 or par 5, finish the tee shot on the fairway.', note: 'Par 4 or 5.', pars: P45, enabled: false },
  { id: 'S04', tier: 'safe', title: 'Two-Putt Limit', pass: 'Finish the hole using no more than 2 putts.', note: 'Whole hole; any par.', pars: ANY, enabled: true },
  { id: 'S05', tier: 'safe', title: 'Keep It in Bounds', pass: 'Finish the hole without hitting a ball out of bounds.', note: 'Whole hole; any par.', pars: ANY, enabled: false },
  // Par 3 only: on a par 4 it's the same test as Bold "Green in Regulation", on a par 5 the same as Insane "Two-Shot Threat".
  { id: 'S06', tier: 'safe', title: 'Green by Three', pass: 'Reach the putting green in 3 strokes or fewer.', note: 'Use only where this is a reasonable target; hole eligibility needs testing.', pars: P3, doneWithin: { strokes: 3 }, enabled: true },
  { id: 'S07', tier: 'safe', title: 'Par Three Landing', pass: 'On a par 3, finish the tee shot on the green or fringe.', note: 'Par 3.', pars: P3, enabled: false },
  { id: 'S08', tier: 'safe', title: 'No Lost Ball', pass: 'Complete the hole without losing a ball.', note: 'Whole hole; any par.', pars: ANY, enabled: false },
  { id: 'S09', tier: 'safe', title: 'Short-Game Success', pass: 'If the approach misses the green, get the next shot onto the green.', note: "Only offer when the hole's layout and challenge setup make this condition applicable.", pars: ANY, situational: true, hint: SITUATION_HINT, enabled: false },
  { id: 'S10', tier: 'safe', title: 'No Bunker Visit', pass: 'Complete the hole without the ball entering a bunker.', note: 'Only offer on a hole with a bunker in play.', pars: ANY, needsBunker: true, hint: BUNKER_HINT, enabled: true },
  { id: 'S11', tier: 'safe', title: 'The Safe Start', pass: 'On a par 4 or 5, finish the tee shot in the fairway or rough without taking a penalty on that shot.', note: 'Par 4 or 5.', pars: P45, enabled: true },
  { id: 'S12', tier: 'safe', title: 'Triple Bogey Cap', pass: 'Finish the hole at triple bogey or better.', note: 'Whole hole; any par.', pars: ANY, score: { maxToPar: 3, decides: true }, enabled: true },
  // Par 4 only: trivially easy on a par 3, and the same test as Bold "Green in Regulation" on a par 5.
  { id: 'S13', tier: 'safe', title: 'Green in Four', pass: 'Reach the green in 4 strokes or fewer.', note: 'Only use where the target is not trivially easy; hole eligibility needs testing.', pars: P4, doneWithin: { strokes: 4 }, enabled: false },
  // Off: the same test as Two-Putt Limit (product owner, Oct 2026).
  { id: 'S14', tier: 'safe', title: 'No Three-Putt', pass: 'Do not take 3 or more putts on the hole.', note: 'Whole hole; any par.', pars: ANY, enabled: false },
  { id: 'S15', tier: 'safe', title: 'The Lay-Up', pass: 'On a par 5, finish the second shot in the fairway.', note: 'Par 5; the second shot must be played from a suitable lie.', pars: P5, enabled: false },

  // ── Bold: made −4, missed +2 ────────────────────────────────────────────
  { id: 'B01', tier: 'bold', title: 'Par Hunter', pass: 'Finish the hole at par or better.', note: 'Whole hole; any par.', pars: ANY, score: { maxToPar: 0, decides: true }, enabled: false },
  // Par 4/5: on a par 3 the approach is the tee shot, which the par-3 cards already cover.
  { id: 'B02', tier: 'bold', title: 'Pin Pointer', pass: 'Finish an approach shot within 15 feet of the hole.', note: 'Requires an approach shot and a consistent distance-verification method.', pars: P45, distance: true, hint: '15 feet ≈ 5 big steps.', enabled: false },
  { id: 'B03', tier: 'bold', title: 'The Long Drive', pass: 'On a par 4 or 5, hit a tee shot at least 170 metres.', note: 'Par 4 or 5; distance measurement required.', pars: P45, distance: true, hint: '170 metres ≈ 186 yards. Use the course markers.', enabled: false },
  { id: 'B04', tier: 'bold', title: 'Pressure Putt', pass: 'Sink a putt from at least 6 feet away.', note: 'Requires a putt from the stated distance.', pars: ANY, distance: true, hint: '6 feet ≈ 2 big steps.', enabled: false },
  { id: 'B05', tier: 'bold', title: 'Green in Regulation', pass: 'Reach the green in par minus 1 strokes: 2 on a par 3, 3 on a par 4, or 4 on a par 5.', note: 'Whole hole; any par.', pars: ANY, doneWithin: { toPar: -1 }, enabled: false },
  { id: 'B06', tier: 'bold', title: 'Par Three Challenge', pass: 'On a par 3, finish the tee shot within 20 feet of the hole.', note: 'Par 3; distance verification required.', pars: P3, distance: true, hint: '20 feet ≈ 7 big steps.', enabled: false },
  { id: 'B07', tier: 'bold', title: 'The Wedge Shot', pass: 'Hit a wedge shot from 30–80 metres and finish within 15 feet of the hole.', note: 'Shot distance and club/landing distance verification required.', pars: P45, distance: true, hint: '30–80 metres ≈ 33–87 yards. 15 feet ≈ 5 big steps.', enabled: false },
  { id: 'B08', tier: 'bold', title: 'The Recovery Route', pass: 'On a par 4 or 5, after a tee shot finishes in the rough, reach the green in 3 additional strokes or fewer.', note: 'Par 4 or 5; only offer if rough is a meaningful possible tee-shot outcome.', pars: P45, situational: true, hint: SITUATION_HINT, enabled: false },
  { id: 'B09', tier: 'bold', title: 'The Birdie Look', pass: 'On a par 4, reach the green in 2 strokes.', note: 'Par 4.', pars: P4, doneWithin: { strokes: 2 }, enabled: false },
  // Reworded from "at par" to "at par or better" so a clean birdie counts (product owner, Oct 2026).
  { id: 'B10', tier: 'bold', title: 'The Clean Par', pass: 'Finish the hole at par or better without taking a penalty stroke.', note: 'Whole hole; any par.', pars: ANY, score: { maxToPar: 0, decides: false }, enabled: false },
  { id: 'B11', tier: 'bold', title: 'Bunker Escape', pass: 'If the ball enters a greenside bunker, get it onto the green with the next shot.', note: "Only offer if the challenge's required bunker situation is guaranteed or already known.", pars: ANY, situational: true, needsBunker: true, hint: SITUATION_HINT, enabled: false },
  { id: 'B12', tier: 'bold', title: 'The Long Putt', pass: 'Sink a putt from at least 8 feet away.', note: 'Requires a putt from the stated distance.', pars: ANY, distance: true, hint: '8 feet ≈ 3 big steps.', enabled: false },
  { id: 'B13', tier: 'bold', title: 'Fairway to Green', pass: 'On a par 4, hit the fairway from the tee and reach the green with the second shot.', note: 'Par 4.', pars: P4, enabled: false },
  { id: 'B14', tier: 'bold', title: 'The Chip-In Chance', pass: 'Hole out from off the green in one shot.', note: 'Requires a shot from off the green; situational.', pars: ANY, enabled: false },
  // Off: the same test as Par Hunter on a par 5 (product owner, Oct 2026).
  { id: 'B15', tier: 'bold', title: 'The Consistent Finish', pass: 'Finish a par 5 in 5 strokes or fewer.', note: 'Par 5.', pars: P5, score: { maxToPar: 0, decides: true }, enabled: false },

  // ── Insane: made −6, missed +3 ──────────────────────────────────────────
  { id: 'I01', tier: 'insane', title: 'Birdie Time', pass: 'Finish the hole at least 1 stroke under par.', note: 'Whole hole; any par.', pars: ANY, score: { maxToPar: -1, decides: true }, enabled: false },
  // Par 4/5: on a par 3 this is the same test as "The Par Three Master".
  { id: 'I02', tier: 'insane', title: 'The Bullseye', pass: 'Finish an approach shot within 6 feet of the hole.', note: 'Requires an approach shot and distance verification.', pars: P45, distance: true, hint: '6 feet ≈ 2 big steps.', enabled: false },
  { id: 'I03', tier: 'insane', title: 'Long-Putt Legend', pass: 'Sink a putt from at least 12 feet away.', note: 'Requires a putt from the stated distance.', pars: ANY, distance: true, hint: '12 feet ≈ 4 big steps.', enabled: false },
  { id: 'I04', tier: 'insane', title: 'Par Three Sniper', pass: 'On a par 3, finish the tee shot within 10 feet of the hole.', note: 'Par 3; distance verification required.', pars: P3, distance: true, hint: '10 feet ≈ 3 big steps.', enabled: false },
  { id: 'I05', tier: 'insane', title: 'The Perfect Par Four', pass: 'On a par 4, reach the green in 2 strokes and finish at par or better.', note: 'Par 4.', pars: P4, score: { maxToPar: 0, decides: false }, doneWithin: { strokes: 2 }, enabled: false },
  { id: 'I06', tier: 'insane', title: 'The Sand Save', pass: 'From a greenside bunker, finish the hole at par or better.', note: 'Only offer if bunker situation is guaranteed or known.', pars: ANY, situational: true, needsBunker: true, score: { maxToPar: 0, decides: false }, hint: SITUATION_HINT, enabled: false },
  { id: 'I07', tier: 'insane', title: 'Wedge Perfection', pass: 'Hit a wedge shot from at least 50 metres away and finish within 6 feet of the hole.', note: 'Requires shot and distance verification.', pars: P45, distance: true, hint: '50 metres ≈ 55 yards. 6 feet ≈ 2 big steps.', enabled: false },
  { id: 'I08', tier: 'insane', title: 'The Big Drive', pass: 'On a par 4 or 5, hit a tee shot at least 200 metres and finish in the fairway.', note: 'Par 4 or 5; distance measurement required.', pars: P45, distance: true, hint: '200 metres ≈ 219 yards. Use the course markers.', enabled: false },
  { id: 'I09', tier: 'insane', title: 'Two-Shot Threat', pass: 'On a par 5, reach the green in 3 strokes or fewer.', note: 'Par 5.', pars: P5, doneWithin: { strokes: 3 }, enabled: false },
  { id: 'I10', tier: 'insane', title: 'The Comeback Birdie', pass: 'After missing the fairway with the tee shot, finish the hole at birdie or better.', note: 'Par 4 or 5 where birdie is possible; situational.', pars: P45, situational: true, score: { maxToPar: -1, decides: false }, hint: SITUATION_HINT, enabled: false },
  { id: 'I11', tier: 'insane', title: 'Pressure Cooker', pass: 'Sink a putt from at least 10 feet to save par or better.', note: 'Requires a putt from the stated distance and a par-saving outcome.', pars: ANY, distance: true, score: { maxToPar: 0, decides: false }, hint: '10 feet ≈ 3 big steps.', enabled: false },
  { id: 'I12', tier: 'insane', title: 'The Clean Birdie', pass: 'Finish the hole at birdie or better without taking a penalty stroke.', note: 'Whole hole; any par.', pars: ANY, score: { maxToPar: -1, decides: false }, enabled: false },
  { id: 'I13', tier: 'insane', title: 'The Short-Game Showoff', pass: 'From at least 10 metres off the green, hole out in one shot.', note: 'Requires a shot from off the green and distance verification.', pars: ANY, distance: true, hint: '10 metres ≈ 11 big steps.', enabled: false },
  { id: 'I14', tier: 'insane', title: 'The Par Three Master', pass: 'On a par 3, finish the tee shot within 6 feet of the hole.', note: 'Par 3; distance verification required.', pars: P3, distance: true, hint: '6 feet ≈ 2 big steps.', enabled: false },
  { id: 'I15', tier: 'insane', title: 'The Long-Iron Challenge', pass: 'On a par 4 or 5, reach the green using a long iron or hybrid for the approach shot, then finish at par or better.', note: 'Par 4 or 5; club category needs a clear definition.', pars: P45, score: { maxToPar: 0, decides: false }, hint: 'Long iron = a 5-iron or longer. Any hybrid counts too.', enabled: false },
  // ── Deck v2 (Oct 2026, docs/GAME_BALANCE.md) ─────────────────────────────
  // Every card outside this deck is retired above (enabled: false). Fairway Finder and The Lay-Up
  // moved from Safe to Bold, so they're re-added under new ids rather than re-tiered, which would
  // break saved games that hold the Safe versions.
  { id: 'S16', tier: 'safe', title: 'Get It Going', pass: 'On a par 4 or 5, hit a tee shot at least 150 metres.', note: 'Par 4 or 5; distance judged by eye.', pars: P45, distance: true, hint: '150 metres ≈ 164 yards. Use the course markers.', enabled: true },
  { id: 'B16', tier: 'bold', title: 'Hold the Line', pass: 'Match or beat your score on the last hole (against par). First hole: double bogey or better.', note: 'Judged from strokes against your own last hole.', pars: ANY, vsLastHole: { by: 0, first: 2 }, enabled: true },
  { id: 'B17', tier: 'bold', title: 'Lag It Close', pass: 'Your first putt finishes within 3 feet of the hole, or drops.', note: 'Distance judged by eye. A chip-in counts.', pars: ANY, distance: true, hint: '3 feet ≈ 1 big step.', enabled: true },
  { id: 'B18', tier: 'bold', title: 'Tidy Hole', pass: 'No penalty strokes and no more than 2 putts.', note: 'Whole hole; any par.', pars: ANY, enabled: true },
  { id: 'B19', tier: 'bold', title: 'Fairway Finder', pass: 'On a par 4 or par 5, finish the tee shot on the fairway.', note: 'Par 4 or 5. Was S03 (Safe).', pars: P45, enabled: true },
  { id: 'B20', tier: 'bold', title: 'The Lay-Up', pass: 'On a par 5, finish the second shot in the fairway.', note: 'Par 5. Was S15 (Safe).', pars: P5, enabled: true },
  { id: 'I16', tier: 'insane', title: 'Short Knee-Knocker', pass: 'Sink a putt from at least 4 feet away.', note: 'Distance judged by eye.', pars: ANY, distance: true, hint: '4 feet ≈ 1½ big steps.', enabled: true },
  { id: 'I17', tier: 'insane', title: 'Sink a Tiddler', pass: 'Hole a putt of at least 3 feet.', note: 'Distance judged by eye.', pars: ANY, distance: true, hint: '3 feet ≈ 1 big step.', enabled: true },
  { id: 'I18', tier: 'insane', title: 'Bounce Back', pass: 'Beat your score on the last hole (against par). First hole: bogey or better.', note: 'Judged from strokes against your own last hole.', pars: ANY, vsLastHole: { by: 1, first: 1 }, enabled: true },
  { id: 'I19', tier: 'insane', title: 'Approach Party', pass: 'Finish an approach shot on the green within 30 feet of the hole.', note: 'Par 4 or 5; distance judged by eye.', pars: P45, distance: true, hint: '30 feet ≈ 10 big steps.', enabled: true },
  { id: 'I20', tier: 'insane', title: 'One and Done', pass: 'Finish the hole with one putt or fewer (a chip-in counts).', note: 'Whole hole; any par.', pars: ANY, enabled: true },
  { id: 'I21', tier: 'insane', title: 'Big Improvement', pass: 'Beat your score on the last hole by 2 or more (against par). First hole: par or better.', note: 'Judged from strokes against your own last hole.', pars: ANY, vsLastHole: { by: 2, first: 0 }, enabled: true },
  { id: 'I22', tier: 'insane', title: 'One-Putt Green', pass: 'Once on the green, hole out with one putt (not counting chip-ins).', note: 'Whole hole; any par.', pars: ANY, enabled: true },
];

export const CARDS_BY_ID: Readonly<Record<string, CardDef>> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export function getCard(id: string | undefined): CardDef | undefined {
  return id ? CARDS_BY_ID[id] : undefined;
}
