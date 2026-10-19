// Live win chances: each player's chance of winning from here, worked out on the phone by playing the
// rest of the round out a couple of thousand times. It only uses what the app can see: scores so far
// (which say how well each player is playing), the levels they've been picking (how risky they are),
// the holes left, the 2× finish, the Crown, wild holes and gold cards. Checked against the full balance
// simulator in scripts/concepts/wincheck.ts (docs/GAME_BALANCE.md, "Live win chances").
import { HOLE_ODDS, WIN_HCPS } from './winTable';
import type { Par, Tier } from './types';

export interface WinUnit {
  id: string;
  /** Game score against par so far (lower is better). */
  toPar: number;
  /** Real strokes against par so far, and holes played: how well they're playing. */
  golfToPar: number;
  holes: number;
  /** Levels picked so far this round. */
  picks: Record<Tier, number>;
  /** Two players whose golf is averaged (2v2). */
  pair?: boolean;
  /** Multi-hole cards still running: what they'll pay, and the chance they come off. */
  pending?: { made: number; missed: number; chance: number }[];
}

export interface WinInput {
  units: WinUnit[];
  /** Holes still to play, in order. mult is 2 on the 2× finish. */
  remaining: { par: Par; mult: number }[];
  values: Record<Tier, { made: number; missed: number }>;
  crown: boolean;
  wild: boolean;
  gold: boolean;
  /** Same seed on every phone, so everyone sees the same numbers. */
  seed: number;
  sims?: number;
}

/** How often each level's card gets completed when players choose from a hand (simulated, deck v5). */
const MADE: Record<Tier, number> = { safe: 0.88, bold: 0.66, insane: 0.38 };
/** Level mix before we've seen a player pick (simulated groups: 45% Safe, 27% Bold, 28% Insane). */
const PRIOR: Record<Tier, number> = { safe: 0.45, bold: 0.27, insane: 0.28 };
const PRIOR_PICKS = 3;
/** How many holes of evidence a player's own scoring is worth against the typical 20 handicap. */
const PRIOR_HOLES = 4;
const WILD_CHANCE = 1 / 6;
const SOFTEN = 0.88;
const GOLD_CHANCE = 0.04;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Average score to par per hole for each handicap row, over a typical mix of pars. */
const ROW_MEAN = HOLE_ODDS.map((row) => {
  const weights = [4, 10, 4];
  let s = 0;
  row.forEach((bins, p) => bins.forEach((pm, k) => (s += (weights[p] * pm * (k - 2)) / 1000)));
  return s / 18;
});
const TYPICAL = WIN_HCPS.indexOf(20);

/** The handicap row that best matches how this player is scoring, pulled towards a typical 20 handicap early on. */
export function skillRow(golfToPar: number, holes: number): number {
  const avg = (golfToPar + ROW_MEAN[TYPICAL] * PRIOR_HOLES) / (holes + PRIOR_HOLES);
  let best = 0;
  ROW_MEAN.forEach((m, i) => {
    if (Math.abs(m - avg) < Math.abs(ROW_MEAN[best] - avg)) best = i;
  });
  return best;
}

/** Cumulative odds per handicap row and par, for fast sampling. */
const CUM = HOLE_ODDS.map((row) =>
  row.map((bins) => {
    let s = 0;
    return bins.map((pm) => (s += pm));
  }),
);
function sampleToPar(row: number, par: Par, r: number): number {
  const cum = CUM[row][par - 3];
  const x = r * 1000;
  let k = 0;
  while (k < cum.length - 1 && x >= cum[k]) k++;
  return k - 2;
}

/** Each unit's chance of winning (0..1), ties shared. Empty when there's nothing left to decide. */
export function winChances(input: WinInput): Record<string, number> {
  const { units, remaining } = input;
  const out: Record<string, number> = Object.fromEntries(units.map((u) => [u.id, 0]));
  if (units.length === 0) return out;
  const leaders = (scores: number[]) => {
    const m = Math.min(...scores);
    return scores.flatMap((s, i) => (s === m ? [i] : []));
  };
  if (remaining.length === 0) {
    const w = leaders(units.map((u) => u.toPar));
    w.forEach((i) => (out[units[i].id] = 1 / w.length));
    return out;
  }

  const rows = units.map((u) => skillRow(u.pair ? u.golfToPar / 2 : u.golfToPar, u.holes));
  const mix = units.map((u) => {
    const n = u.picks.safe + u.picks.bold + u.picks.insane;
    const w = (t: Tier) => (PRIOR[t] * PRIOR_PICKS + u.picks[t]) / (PRIOR_PICKS + n);
    return { safe: w('safe'), bold: w('bold'), insane: w('insane') };
  });
  const rng = mulberry32(input.seed);
  const sims = input.sims ?? 2000;
  const tot = new Array<number>(units.length);
  const hole = new Array<number>(units.length);

  for (let s = 0; s < sims; s++) {
    for (let i = 0; i < units.length; i++) {
      tot[i] = units[i].toPar;
      for (const p of units[i].pending ?? []) tot[i] += rng() < p.chance ? p.made : p.missed;
    }
    remaining.forEach(({ par, mult }, h) => {
      const left = remaining.length - h;
      const lead = leaders(tot);
      const crownHolder = input.crown && lead.length === 1 ? lead[0] : -1;
      for (let i = 0; i < units.length; i++) {
        const golf = units[i].pair
          ? (sampleToPar(rows[i], par, rng()) + sampleToPar(rows[i], par, rng())) / 2
          : sampleToPar(rows[i], par, rng());
        // Late on, whoever is behind goes for it and whoever leads plays safe.
        const m = mix[i];
        const late = left <= 4;
        const behind = !lead.includes(i);
        const ws = m.safe * (late && !behind ? 1.5 : 1);
        const wi = m.insane * (late && behind ? 3 : 1);
        const r = rng() * (ws + m.bold + wi);
        const tier: Tier = r < ws ? 'safe' : r < ws + m.bold ? 'bold' : 'insane';
        const v = input.values[tier];
        const gold = input.gold && rng() < GOLD_CHANCE ? 2 : 1;
        hole[i] = golf + (rng() < MADE[tier] ? v.made : v.missed) * mult * gold;
      }
      for (let i = 0; i < units.length; i++) {
        tot[i] += hole[i];
        if (crownHolder >= 0 && i !== crownHolder && hole[i] < hole[crownHolder]) tot[i] -= mult;
      }
      if (input.wild && h > 0 && rng() < WILD_CHANCE) {
        const lo = Math.min(...hole);
        const hi = Math.max(...hole);
        if (hole.filter((x) => x === lo).length === 1) tot[hole.indexOf(lo)] -= 2 * mult;
        if (hole.filter((x) => x === hi).length === 1) tot[hole.indexOf(hi)] += 2 * mult;
      }
    });
    const w = leaders(tot);
    for (const i of w) out[units[i].id] += 1 / w.length / sims;
  }
  // A light softening: the simulated players hedge a little less than real ones, so raw chances
  // run slightly too sure of the favourite (checked in scripts/concepts/wincheck.ts).
  const soft = units.map((u) => out[u.id] ** SOFTEN);
  const sum = soft.reduce((a, b) => a + b, 0);
  if (sum > 0) units.forEach((u, i) => (out[u.id] = soft[i] / sum));
  return out;
}
