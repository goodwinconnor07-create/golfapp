// How each card is judged from a simulated hole. Keyed by the real card ids in src/game/cards.ts.
// Adding a card to the game? Add a check here too, or the balance run will stop and say which one.
// Ids that aren't in the game (N.., R..) are spare ideas measured during the Oct 2026 redesign.
import type { Par, Tier } from '../../src/game/types';
import { facts, type HoleLog } from './golf';

type F = ReturnType<typeof facts>;
export interface Card2 {
  id: string;
  title: string;
  pass: string;
  pars: readonly Par[];
  /** judged from strokes alone (no tap needed) */
  auto?: boolean;
  /** judged by eye (group vote) */
  eye?: boolean;
  check: (f: F, log: HoleLog, ctx?: { prevToPar: number | null }) => boolean;
  /** depends on the player's previous hole */
  relative?: boolean;
  tier?: Tier; // assigned later from measured odds
}
const ANY: Par[] = [3, 4, 5];
const P3: Par[] = [3];
const P4: Par[] = [4];
const P5: Par[] = [5];
const P45: Par[] = [4, 5];
const FT = 0.3048;
const tp = (l: HoleLog) => l.strokes - l.par;
const holedFrom = (f: F, m: number) => f.holedPutt != null && f.holedPutt >= m;

export const CANDIDATES: Card2[] = [
  // Kept from today's deck (same ids)
  {
    id: 'S01',
    title: 'Bogey Buffer',
    pass: 'Finish the hole at double bogey or better.',
    pars: ANY,
    auto: true,
    check: (_f, l) => tp(l) <= 2,
  },
  {
    id: 'S02',
    title: 'Penalty-Free',
    pass: 'Finish the hole without taking any penalty strokes.',
    pars: ANY,
    check: (f) => f.penalties === 0,
  },
  {
    id: 'S03',
    title: 'Fairway Finder',
    pass: 'On a par 4 or par 5, finish the tee shot on the fairway.',
    pars: P45,
    check: (f) => f.teeFairway,
  },
  {
    id: 'B19',
    title: 'Fairway Finder',
    pass: 'On a par 4 or par 5, finish the tee shot on the fairway.',
    pars: P45,
    check: (f) => f.teeFairway,
  },
  { id: 'S04', title: 'Two-Putt Limit', pass: 'Finish the hole using no more than 2 putts.', pars: ANY, check: (f) => f.putts <= 2 },
  { id: 'S05', title: 'Keep It in Bounds', pass: 'Finish the hole without hitting a ball out of bounds.', pars: ANY, check: (f) => !f.ob },
  {
    id: 'S06',
    title: 'Green by Three',
    pass: 'Reach the putting green in 3 strokes or fewer.',
    pars: P3,
    check: (f) => f.green != null && f.green <= 3,
  },
  {
    id: 'S07',
    title: 'Par Three Landing',
    pass: 'On a par 3, finish the tee shot on the green or fringe.',
    pars: P3,
    check: (f) => f.teeGreenOrFringe,
  },
  {
    id: 'S10',
    title: 'No Bunker Visit',
    pass: 'Complete the hole without the ball entering a bunker.',
    pars: ANY,
    check: (f) => !f.bunker,
  },
  {
    id: 'S11',
    title: 'The Safe Start',
    pass: 'On a par 4 or 5, finish the tee shot in the fairway or rough without taking a penalty on that shot.',
    pars: P45,
    check: (f) => f.teeSafe,
  },
  {
    id: 'S12',
    title: 'Triple Bogey Cap',
    pass: 'Finish the hole at triple bogey or better.',
    pars: ANY,
    auto: true,
    check: (_f, l) => tp(l) <= 3,
  },
  {
    id: 'S13',
    title: 'Green in Four',
    pass: 'Reach the green in 4 strokes or fewer.',
    pars: P4,
    check: (f) => f.green != null && f.green <= 4,
  },
  {
    id: 'S15',
    title: 'The Lay-Up',
    pass: 'On a par 5, finish the second shot in the fairway.',
    pars: P5,
    check: (f) =>
      !!f.second && f.shots[0].penalty === 0 && f.second.penalty === 0 && (f.second.toLie === 'fw' || f.second.toLie === 'green'),
  },
  {
    id: 'B20',
    title: 'The Lay-Up',
    pass: 'On a par 5, finish the second shot in the fairway.',
    pars: P5,
    check: (f) =>
      !!f.second && f.shots[0].penalty === 0 && f.second.penalty === 0 && (f.second.toLie === 'fw' || f.second.toLie === 'green'),
  },
  { id: 'B01', title: 'Par Hunter', pass: 'Finish the hole at par or better.', pars: ANY, auto: true, check: (_f, l) => tp(l) <= 0 },
  {
    id: 'B02',
    title: 'Pin Pointer',
    pass: 'Finish an approach shot within 15 feet of the hole.',
    pars: P45,
    eye: true,
    check: (f) => f.shots.some((s) => s.approach && s.penalty === 0 && (s.toLie === 'green' || s.holed) && s.to <= 15 * FT),
  },
  {
    id: 'B03',
    title: 'The Long Drive',
    pass: 'On a par 4 or 5, hit a tee shot at least 170 metres.',
    pars: P45,
    eye: true,
    check: (f) => f.teeDist >= 170,
  },
  {
    id: 'B04',
    title: 'Pressure Putt',
    pass: 'Sink a putt from at least 6 feet away.',
    pars: ANY,
    eye: true,
    check: (f) => holedFrom(f, 6 * FT),
  },
  {
    id: 'B05',
    title: 'Green in Regulation',
    pass: 'Reach the green in par minus 1 strokes.',
    pars: ANY,
    check: (f, l) => f.green != null && f.green <= l.par - 1,
  },
  {
    id: 'B06',
    title: 'Par Three Challenge',
    pass: 'On a par 3, finish the tee shot within 20 feet of the hole.',
    pars: P3,
    eye: true,
    check: (f) => f.teeProx <= 20 * FT,
  },
  {
    id: 'B09',
    title: 'The Birdie Look',
    pass: 'On a par 4, reach the green in 2 strokes.',
    pars: P4,
    check: (f) => f.green != null && f.green <= 2,
  },
  {
    id: 'B10',
    title: 'The Clean Par',
    pass: 'Finish the hole at par or better without taking a penalty stroke.',
    pars: ANY,
    check: (f, l) => tp(l) <= 0 && f.penalties === 0,
  },
  {
    id: 'B12',
    title: 'The Long Putt',
    pass: 'Sink a putt from at least 8 feet away.',
    pars: ANY,
    eye: true,
    check: (f) => holedFrom(f, 8 * FT),
  },
  {
    id: 'B13',
    title: 'Fairway to Green',
    pass: 'On a par 4, hit the fairway from the tee and reach the green with the second shot.',
    pars: P4,
    check: (f) => f.teeFairway && !!f.second && f.second.penalty === 0 && (f.second.toLie === 'green' || f.second.holed),
  },
  {
    id: 'I01',
    title: 'Birdie Time',
    pass: 'Finish the hole at least 1 stroke under par.',
    pars: ANY,
    auto: true,
    check: (_f, l) => tp(l) <= -1,
  },
  {
    id: 'I03',
    title: 'Long-Putt Legend',
    pass: 'Sink a putt from at least 12 feet away.',
    pars: ANY,
    eye: true,
    check: (f) => holedFrom(f, 12 * FT),
  },
  {
    id: 'I05',
    title: 'The Perfect Par Four',
    pass: 'On a par 4, reach the green in 2 strokes and finish at par or better.',
    pars: P4,
    check: (f, l) => f.green != null && f.green <= 2 && tp(l) <= 0,
  },
  {
    id: 'I08',
    title: 'The Big Drive',
    pass: 'On a par 4 or 5, hit a tee shot at least 200 metres and finish in the fairway.',
    pars: P45,
    eye: true,
    check: (f) => f.teeDist >= 200 && f.teeFairway,
  },
  {
    id: 'I09',
    title: 'Two-Shot Threat',
    pass: 'On a par 5, reach the green in 3 strokes or fewer.',
    pars: P5,
    check: (f) => f.green != null && f.green <= 3,
  },
  {
    id: 'I11',
    title: 'Pressure Cooker',
    pass: 'Sink a putt from at least 10 feet to save par or better.',
    pars: ANY,
    eye: true,
    check: (f, l) => holedFrom(f, 10 * FT) && tp(l) <= 0,
  },

  // New cards
  { id: 'N01', title: 'Bogey or Better', pass: 'Finish the hole at bogey or better.', pars: ANY, auto: true, check: (_f, l) => tp(l) <= 1 },
  {
    id: 'N02',
    title: 'The Clean Bogey',
    pass: 'Finish at bogey or better without taking a penalty stroke.',
    pars: ANY,
    check: (f, l) => tp(l) <= 1 && f.penalties === 0,
  },
  {
    id: 'I20',
    title: 'One and Done',
    pass: 'Finish the hole with one putt or fewer (a chip-in counts).',
    pars: ANY,
    check: (f) => f.putts <= 1,
  },
  {
    id: 'N04',
    title: 'Green in Five',
    pass: 'On a par 5, reach the green in 5 strokes or fewer.',
    pars: P5,
    check: (f) => f.green != null && f.green <= 5,
  },
  {
    id: 'B18',
    title: 'Tidy Hole',
    pass: 'No penalty strokes and no more than 2 putts.',
    pars: ANY,
    check: (f) => f.penalties === 0 && f.putts <= 2,
  },
  {
    id: 'N06',
    title: 'Fairway and Two',
    pass: 'On a par 4 or 5, hit the fairway from the tee and take no more than 2 putts.',
    pars: P45,
    check: (f) => f.teeFairway && f.putts <= 2,
  },
  {
    id: 'N07',
    title: 'Clean Double',
    pass: 'Finish at double bogey or better without taking a penalty stroke.',
    pars: ANY,
    check: (f, l) => tp(l) <= 2 && f.penalties === 0,
  },
  {
    id: 'S16',
    title: 'Get It Going',
    pass: 'On a par 4 or 5, hit a tee shot at least 150 metres.',
    pars: P45,
    eye: true,
    check: (f) => f.teeDist >= 150,
  },
  {
    id: 'N09',
    title: 'Bomb and Find',
    pass: 'On a par 4 or 5, hit a tee shot at least 170 metres that finishes in the fairway.',
    pars: P45,
    eye: true,
    check: (f) => f.teeDist >= 170 && f.teeFairway,
  },
  {
    id: 'N10',
    title: 'Tee It Close',
    pass: 'On a par 3, finish the tee shot within 30 feet of the hole.',
    pars: P3,
    eye: true,
    check: (f) => f.teeProx <= 30 * FT,
  },
  {
    id: 'I16',
    title: 'Short Knee-Knocker',
    pass: 'Sink a putt from at least 4 feet away.',
    pars: ANY,
    eye: true,
    check: (f) => holedFrom(f, 4 * FT),
  },
  {
    id: 'I19',
    title: 'Approach Party',
    pass: 'Finish an approach shot on the green within 30 feet of the hole.',
    pars: P45,
    eye: true,
    check: (f) => f.shots.some((s) => s.approach && s.penalty === 0 && (s.toLie === 'green' || s.holed) && s.to <= 30 * FT),
  },
  {
    id: 'N13',
    title: 'One-Putt Par',
    pass: 'Finish at par or better with one putt or fewer.',
    pars: ANY,
    check: (f, l) => tp(l) <= 0 && f.putts <= 1,
  },
  {
    id: 'N14',
    title: 'Bogey, One Putt',
    pass: 'Finish at bogey or better with one putt or fewer.',
    pars: ANY,
    check: (f, l) => tp(l) <= 1 && f.putts <= 1,
  },
  {
    id: 'N15',
    title: 'Clean Sheet Par',
    pass: 'Par or better, no penalty, no more than 2 putts.',
    pars: ANY,
    check: (f, l) => tp(l) <= 0 && f.penalties === 0 && f.putts <= 2,
  },
  {
    id: 'N16',
    title: 'Green in Par',
    pass: 'On a par 4 or 5, reach the green in as many strokes as the par.',
    pars: P45,
    check: (f, l) => f.green != null && f.green <= l.par,
  },
  {
    id: 'N17',
    title: 'Fairway, Bogey or Better',
    pass: 'On a par 4 or 5, hit the fairway from the tee and finish at bogey or better.',
    pars: P45,
    check: (f, l) => f.teeFairway && tp(l) <= 1,
  },
  {
    id: 'N18',
    title: 'Par Three Pro',
    pass: 'On a par 3, land the tee shot on the green and finish at par or better.',
    pars: P3,
    check: (f, l) => f.teeProx < Infinity && tp(l) <= 0,
  },
  {
    id: 'N19',
    title: 'Two Good Ones',
    pass: 'On a par 4 or 5, hit the fairway from the tee and finish at par or better.',
    pars: P45,
    check: (f, l) => f.teeFairway && tp(l) <= 0,
  },
  {
    id: 'N20',
    title: 'Bogey on the Green',
    pass: 'Reach the green within par plus 1 strokes and finish at bogey or better.',
    pars: ANY,
    check: (f, l) => f.green != null && f.green <= l.par + 1 && tp(l) <= 1,
  },
  {
    id: 'B17',
    title: 'Lag It Close',
    pass: 'Your first putt finishes within 3 feet of the hole, or drops.',
    pars: ANY,
    eye: true,
    check: (f) => {
      const p = f.shots.find((s) => s.kind === 'putt');
      return !p ? f.holedFromOff != null : p.holed || p.to <= 3 * FT;
    },
  },
  {
    id: 'N22',
    title: 'Fairway or Green',
    pass: 'Hit the fairway from the tee, or reach the green in par minus 1 strokes. On a par 3, just the green in 2.',
    pars: ANY,
    check: (f, l) => (l.par > 3 && f.teeFairway) || (f.green != null && f.green <= l.par - 1),
  },
  {
    id: 'N23',
    title: 'Bogey With Two Putts',
    pass: 'Finish at bogey or better using no more than 2 putts.',
    pars: ANY,
    check: (f, l) => tp(l) <= 1 && f.putts <= 2,
  },
  { id: 'I17', title: 'Sink a Tiddler', pass: 'Hole a putt of at least 3 feet.', pars: ANY, eye: true, check: (f) => holedFrom(f, 3 * FT) },
  {
    id: 'I22',
    title: 'One-Putt Green',
    pass: 'Once on the green, hole out with one putt (not counting chip-ins).',
    pars: ANY,
    check: (f) => f.putts === 1,
  },
  {
    id: 'N26',
    title: 'Clean Double, Two Putts',
    pass: 'Double bogey or better, no penalty, no more than 2 putts.',
    pars: ANY,
    check: (f, l) => tp(l) <= 2 && f.penalties === 0 && f.putts <= 2,
  },
  {
    id: 'I18',
    title: 'Bounce Back',
    pass: 'Beat your score on the last hole (against par). First hole: bogey or better.',
    pars: ANY,
    auto: true,
    relative: true,
    check: (_f, l, c) => tp(l) < (c?.prevToPar ?? 2),
  },
  {
    id: 'B16',
    title: 'Hold the Line',
    pass: 'Match or beat your score on the last hole (against par). First hole: double bogey or better.',
    pars: ANY,
    auto: true,
    relative: true,
    check: (_f, l, c) => tp(l) <= (c?.prevToPar ?? 2),
  },
  {
    id: 'I21',
    title: 'Big Improvement',
    pass: 'Beat your score on the last hole by 2 or more (against par). First hole: par or better.',
    pars: ANY,
    auto: true,
    relative: true,
    check: (_f, l, c) => tp(l) <= (c?.prevToPar ?? 2) - 2,
  },
];
