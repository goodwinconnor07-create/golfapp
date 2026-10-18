// Concept simulator: plays whole rounds of alternative CardShot designs on the balance golf model.
// Holes are pre-played into a bank per handicap and par, so a round is just lookups. That makes
// Monte Carlo lookahead (the "thinker" player) and live win-probability tracking affordable.
import { CANDIDATES } from '../balance/checks';
import { facts, makeHole, mulberry32, playHole, skill, type Rng } from '../balance/golf';

export { mulberry32 };
export type { Rng };

// ── Hole bank ──────────────────────────────────────────────────────────────
export const H_GRID = Array.from({ length: 21 }, (_, i) => i * 2); // 0..40
const BANK_CARDS = CANDIDATES.filter((c) => !c.relative);
const K = BANK_CARDS.length;
const IDX: Record<string, number> = Object.fromEntries(BANK_CARDS.map((c, i) => [c.id, i]));
const TP_OFF = 3;
const TP_N = 12; // to par −3..+8
export const EYE = new Set(CANDIDATES.filter((c) => c.eye).map((c) => c.id));
export const PARS_OF: Record<string, readonly number[]> = Object.fromEntries(CANDIDATES.map((c) => [c.id, c.pars]));

interface Bank {
  n: number;
  tp: Int8Array;
  out: Uint8Array;
  odds: Float64Array; // per card
  dist: Float64Array; // toPar histogram
  mean: number;
}
let BANKS: Bank[][] = [];

export function buildBank(N = 6000, seed = 11) {
  const rng = mulberry32(seed);
  BANKS = H_GRID.map((h) =>
    [3, 4, 5].map((par) => {
      const tp = new Int8Array(N);
      const out = new Uint8Array(N * K);
      const odds = new Float64Array(K);
      const dist = new Float64Array(TP_N);
      for (let j = 0; j < N; j++) {
        const log = playHole(skill(h), makeHole(par, rng), rng, rng() < 0.22);
        const f = facts(log);
        tp[j] = log.strokes - par;
        dist[Math.min(TP_N - 1, Math.max(0, tp[j] + TP_OFF))] += 1 / N;
        for (let c = 0; c < K; c++) {
          const card = BANK_CARDS[c];
          if (!card.pars.includes(par as 3 | 4 | 5)) continue;
          const m = card.check(f, log, { prevToPar: null }) ? 1 : 0;
          out[j * K + c] = m;
          odds[c] += m / N;
        }
      }
      let mean = 0;
      for (let j = 0; j < N; j++) mean += tp[j] / N;
      return { n: N, tp, out, odds, dist, mean };
    }),
  );
}
const bank = (hi: number, par: number) => BANKS[hi][par - 3];
export const hIndex = (h: number) => Math.max(0, Math.min(20, Math.round(h / 2)));

// Cards resolved at the end of the hole rather than from the bank.
// Relative to your own last hole (ids as in the app):
const REL: Record<string, { by: number; first: number }> = {
  B16: { by: 0, first: 2 },
  I18: { by: 1, first: 1 },
  I21: { by: 2, first: 0 },
};
// Head-to-head cards (new ideas):
//  D01 Beat a Rival: fewer strokes than a randomly named opponent this hole.
//  D02 Top of the Hole: the outright lowest strokes in the group on this hole.
//  D03 Match a Rival: same or fewer strokes than a randomly named opponent.
export const DUEL = new Set(['D01', 'D02', 'D03']);
// Personal par (new idea): your running average to par this round, starting from bogey
// (as if you'd played two bogey holes). P01 match or beat it, P02 beat it by 1+, P03 by 2+.
const PP: Record<string, number> = { P01: 0, P02: 1, P03: 2 };
const personalPar = (g: G, i: number) => (g.golf[i] + 2) / (g.hole + 2);
for (const id of [...Object.keys(REL), ...DUEL, ...Object.keys(PP)]) PARS_OF[id] ??= [3, 4, 5];
export const CARD_TITLES: Record<string, string> = {
  ...Object.fromEntries(CANDIDATES.map((c) => [c.id, c.title])),
  D01: 'Beat a Rival',
  D02: 'Top of the Hole',
  D03: 'Match a Rival',
  P01: 'Personal Par',
  P02: 'Beat Your Average',
  P03: 'Way Above Average',
};

function distOf(hi: number, par: number) {
  return bank(hi, par).dist;
}
function pLE(d: Float64Array, tp: number) {
  let s = 0;
  for (let k = 0; k < TP_N && k - TP_OFF <= tp; k++) s += d[k];
  return s;
}

// ── Concepts ──────────────────────────────────────────────────────────────
export type Format = 'stroke' | 'skins' | 'gp' | 'stableford' | 'match' | 'wolf';
export interface Concept {
  name: string;
  format: Format;
  /** blind: pick a level, then get a random card. hand: see one card from each level, then pick. */
  decision: 'blind' | 'hand';
  tiers: string[];
  values: Record<string, [number, number]>; // tier → [completed, failed] (strokes on the hole)
  deck: Record<string, string>; // card id → tier
  double: boolean; // last 3 holes of 6+ count double
  gp?: number[]; // Grand Prix points by place (4 players)
  /** Points formats: place on real strokes, then add card points (−value) on top, instead of the card moving the hole score. */
  cardPoints?: boolean;
  /** Points formats: place each hole on strokes against your own running average (a handicap the round builds). */
  net?: boolean;
  addons?: { holeWin?: boolean; hex?: boolean; callout?: boolean; king?: boolean; predict?: boolean; press?: boolean; showdown?: boolean };
}

export const BASE_DECK: Record<string, string> = {
  S01: 'safe', S02: 'safe', S04: 'safe', S06: 'safe', S10: 'safe', S11: 'safe', S12: 'safe', S16: 'safe',
  B16: 'bold', B17: 'bold', B18: 'bold', B19: 'bold', B20: 'bold',
  I16: 'insane', I17: 'insane', I18: 'insane', I19: 'insane', I20: 'insane', I21: 'insane', I22: 'insane',
};
export const BASE: Concept = {
  name: 'Today: stroke play, blind level, deck v2',
  format: 'stroke',
  decision: 'blind',
  tiers: ['safe', 'bold', 'insane'],
  values: { safe: [-1, 1], bold: [-2, 2], insane: [-9, 3] },
  deck: BASE_DECK,
  double: true,
};

// ── Players ───────────────────────────────────────────────────────────────
export type Persona = 'cautious' | 'balanced' | 'reckless' | 'thinker' | 'random' | `fixed${number}` | 'protect';
export interface Player {
  h: number;
  hi: number;
  persona: Persona;
}
const LAMBDA: Record<string, number> = { cautious: 0.7, balanced: 0.1, reckless: -0.55 };
const NOISE = 0.7; // how loosely people judge the odds (Gumbel scale, strokes)

// ── Game state ────────────────────────────────────────────────────────────
export interface G {
  c: Concept;
  n: number;
  pars: number[];
  pl: Player[];
  hole: number;
  tot: number[]; // sum of hole game scores (strokes vs par ± cards)
  golf: number[]; // strokes vs par only
  pts: number[]; // points (skins, GP, Stableford, match), higher better
  cpts: number[]; // the part of pts that came from card points
  carry: number;
  prev: (number | null)[];
  hex: number[]; // hex tokens held
  pressed: number[]; // 1 while a press is on for this nine, else 0
  pressUsed: number[];
  // stats
  eyeClaims: number; // eye-judged completions
  eyeStrokes: number; // strokes riding on them (completed − failed)
  drawLuck: number[]; // sum of (card EV − level EV) per player, blind only
}

const PARS18 = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5];
export function newGame(c: Concept, hs: number[], personas: Persona[], n: number, rng: Rng): G {
  const start = n === 9 && rng() < 0.5 ? 9 : 0;
  return {
    c,
    n,
    pars: Array.from({ length: n }, (_, i) => PARS18[(start + i) % 18]),
    pl: hs.map((h, i) => ({ h, hi: hIndex(h), persona: personas[i] })),
    hole: 0,
    tot: hs.map(() => 0),
    golf: hs.map(() => 0),
    pts: hs.map(() => 0),
    cpts: hs.map(() => 0),
    carry: 0,
    prev: hs.map(() => null),
    hex: hs.map(() => 0),
    pressed: hs.map(() => 0),
    pressUsed: hs.map(() => 0),
    eyeClaims: 0,
    eyeStrokes: 0,
    drawLuck: hs.map(() => 0),
  };
}
function clone(g: G): G {
  return {
    ...g,
    tot: g.tot.slice(),
    golf: g.golf.slice(),
    pts: g.pts.slice(),
    cpts: g.cpts.slice(),
    prev: g.prev.slice(),
    hex: g.hex.slice(),
    pressed: g.pressed.slice(),
    pressUsed: g.pressUsed.slice(),
    drawLuck: g.drawLuck.slice(),
  };
}

/** Standings key, lower is better. */
export function key(g: G, i: number): number {
  const f = g.c.format;
  if (f === 'stroke') return g.tot[i];
  return -g.pts[i] + g.tot[i] * 1e-4;
}
export function winners(g: G): number[] {
  const ks = g.pl.map((_, i) => key(g, i));
  const m = Math.min(...ks);
  return ks.map((k, i) => (Math.abs(k - m) < 1e-9 ? i : -1)).filter((i) => i >= 0);
}
function rankOf(g: G, i: number) {
  const k = key(g, i);
  let r = 1;
  for (let j = 0; j < g.pl.length; j++) if (key(g, j) < k - 1e-9) r++;
  return r;
}
const mult = (g: G) => (g.c.double && g.n >= 6 && g.hole >= g.n - 3 ? 2 : 1);

// ── Odds the players reason with ───────────────────────────────────────────
interface Dealt {
  id: string;
  tier: string;
  rival: number; // for D01/D03
}
function cardOdds(g: G, i: number, d: Dealt): number {
  const par = g.pars[g.hole];
  const P = g.pl[i];
  const rel = REL[d.id];
  if (rel) {
    const prev = g.prev[i];
    return pLE(distOf(P.hi, par), prev == null ? rel.first : prev - rel.by);
  }
  if (d.id in PP) return pLE(distOf(P.hi, par), Math.floor(personalPar(g, i) - PP[d.id] + 1e-9));
  if (DUEL.has(d.id)) {
    const me = distOf(P.hi, par);
    if (d.id === 'D02') {
      let s = 0;
      for (let k = 0; k < TP_N; k++) {
        let q = me[k];
        for (let o = 0; o < g.pl.length; o++) if (o !== i) q *= 1 - pLE(distOf(g.pl[o].hi, par), k - TP_OFF);
        s += q;
      }
      return s;
    }
    const op = distOf(g.pl[d.rival].hi, par);
    let s = 0;
    for (let k = 0; k < TP_N; k++) s += me[k] * (1 - pLE(op, k - TP_OFF - (d.id === 'D03' ? 1 : 0)));
    return s;
  }
  return bank(P.hi, par).odds[IDX[d.id]];
}
function pool(c: Concept, tier: string, par: number): string[] {
  return Object.entries(c.deck)
    .filter(([id, t]) => t === tier && PARS_OF[id].includes(par))
    .map(([id]) => id);
}
const poolCache = new Map<string, string[]>();
function poolC(c: Concept, tier: string, par: number) {
  const k = `${c.name}|${tier}|${par}`;
  let p = poolCache.get(k);
  if (!p) poolCache.set(k, (p = pool(c, tier, par)));
  return p;
}
function deal(g: G, i: number, tier: string, held: Set<string>, rng: Rng): Dealt {
  const p = poolC(g.c, tier, g.pars[g.hole]);
  let ids = p.filter((id) => !held.has(id));
  if (!ids.length) ids = p;
  const id = ids[Math.floor(rng() * ids.length)];
  let rival = Math.floor(rng() * (g.pl.length - 1));
  if (rival >= i) rival++;
  return { id, tier, rival };
}
function tierOddsAvg(g: G, i: number, tier: string): number {
  const p = poolC(g.c, tier, g.pars[g.hole]);
  let s = 0;
  for (const id of p) s += cardOdds(g, i, { id, tier, rival: (i + 1) % g.pl.length });
  return s / p.length;
}

// ── Decisions ─────────────────────────────────────────────────────────────
interface Opt {
  tier: string;
  dealt?: Dealt; // hand: the card is known
}
function gumbel(rng: Rng) {
  return -Math.log(-Math.log(Math.max(rng(), 1e-12)));
}
function personaPick(g: G, i: number, opts: Opt[], rng: Rng, persona: Persona): number {
  if (persona === 'random') return Math.floor(rng() * opts.length);
  if (persona.startsWith('fixed')) {
    const want = g.c.tiers[Number(persona.slice(5))];
    const k = opts.findIndex((o) => o.tier === want);
    return k >= 0 ? k : opts.length - 1;
  }
  if (persona === 'protect') {
    const lead = rankOf(g, i) === 1;
    const want = lead ? g.c.tiers[0] : g.c.tiers[g.c.tiers.length - 1];
    const k = opts.findIndex((o) => o.tier === want);
    return k >= 0 ? k : 0;
  }
  let lam = LAMBDA[persona] ?? LAMBDA.balanced;
  const left = g.n - g.hole;
  if (left <= Math.max(3, g.n / 3)) lam += rankOf(g, i) === 1 ? 0.8 : -0.8;
  const m = mult(g) * (g.pressed[i] ? 2 : 1);
  let best = 0,
    bu = Infinity;
  opts.forEach((o, k) => {
    const q = o.dealt ? cardOdds(g, i, o.dealt) : tierOddsAvg(g, i, o.tier);
    const [mv, fv] = g.c.values[o.tier];
    const ev = (q * mv + (1 - q) * fv) * m;
    const sd = Math.abs(mv - fv) * m * Math.sqrt(q * (1 - q));
    const u = ev + lam * sd - NOISE * gumbel(rng);
    if (u < bu) {
      bu = u;
      best = k;
    }
  });
  return best;
}

export let THINK_R = 48;
export function setThinkR(r: number) {
  THINK_R = r;
}
/** Monte Carlo lookahead: try each option, play the round out many times, keep the one that wins most. */
function thinkerPick(g: G, i: number, opts: Opt[], rng: Rng, hand: Dealt[] | null): number {
  if (opts.length === 1) return 0;
  const seed = Math.floor(rng() * 1e9);
  let best = 0,
    bw = -1;
  opts.forEach((_, k) => {
    let w = 0;
    for (let r = 0; r < THINK_R; r++) {
      const rr = mulberry32(seed + r * 7919);
      const h = clone(g);
      playOneHole(h, rr, { player: i, opt: k, opts, hand }, true);
      while (h.hole < h.n) playOneHole(h, rr, null, true);
      const win = winners(h);
      if (win.includes(i)) w += 1 / win.length;
    }
    if (w > bw) {
      bw = w;
      best = k;
    }
  });
  return best;
}

// ── One hole ──────────────────────────────────────────────────────────────
interface Override {
  player: number;
  opt: number;
  opts: Opt[];
  hand: Dealt[] | null;
}
export interface HoleTrace {
  tiers: string[];
  cards: string[];
  made: boolean[];
  tp: number[];
}

export function playOneHole(g: G, rng: Rng, ov: Override | null, rollout: boolean): HoleTrace {
  const c = g.c;
  const n = g.pl.length;
  const par = g.pars[g.hole];
  const m = mult(g);
  const A = c.addons ?? {};
  const leaderNow = winners(g);
  const soleLeader = leaderNow.length === 1 ? leaderNow[0] : -1;

  // Press: once per nine, double your own card stakes for the rest of that nine.
  if (A.press) {
    if (g.hole % 9 === 0) for (let i = 0; i < n; i++) (g.pressed[i] = 0), (g.pressUsed[i] = 0);
    for (let i = 0; i < n; i++) {
      if (g.pressUsed[i] || g.hole % 9 > 6) continue;
      const behind = rankOf(g, i) > 1;
      const pr = g.pl[i].persona === 'reckless' ? 0.35 : 0.2;
      if (behind && rng() < pr) (g.pressed[i] = 1), (g.pressUsed[i] = 1);
    }
  }
  // Hex: a token won by completing an Insane card. Play it on someone: they can't pick Safe this hole.
  const hexed = new Array(n).fill(false);
  if (A.hex) {
    for (let i = 0; i < n; i++) {
      if (!g.hex[i]) continue;
      const target = soleLeader >= 0 && soleLeader !== i ? soleLeader : -1;
      if (target >= 0 && rng() < 0.7) {
        hexed[target] = true;
        g.hex[i]--;
      }
    }
  }

  // Deal and decide
  const held = new Set<string>();
  const dealt: Dealt[] = [];
  for (let i = 0; i < n; i++) {
    const tiers = hexed[i] ? c.tiers.slice(1) : c.tiers;
    let opts: Opt[];
    let hand: Dealt[] | null = null;
    if (c.decision === 'hand') {
      hand = ov && ov.player === i && ov.hand ? ov.hand : tiers.map((t) => deal(g, i, t, held, rng));
      opts = hand.map((d) => ({ tier: d.tier, dealt: d }));
    } else opts = tiers.map((t) => ({ tier: t }));
    let k: number;
    if (ov && ov.player === i) k = ov.opt;
    else if (g.pl[i].persona === 'thinker' && !rollout) k = thinkerPick(g, i, opts, rng, hand);
    else k = personaPick(g, i, opts, rng, g.pl[i].persona === 'thinker' ? 'balanced' : g.pl[i].persona);
    const o = (ov && ov.player === i ? ov.opts : opts)[k];
    const d = o.dealt ?? deal(g, i, o.tier, held, rng);
    if (!rollout && c.decision === 'blind') g.drawLuck[i] += valueOf(g, i, d) - tierValue(g, i, d.tier);
    held.add(d.id);
    dealt.push(d);
  }

  // Wolf: the rotating Wolf sees everyone's card, then picks a partner or goes it alone.
  let wolf = -1,
    partner = -1;
  if (c.format === 'wolf') {
    wolf = g.hole % n;
    const e = dealt.map((d, i) => {
      const q = cardOdds(g, i, d);
      const [mv, fv] = c.values[d.tier];
      return bank(g.pl[i].hi, par).mean + (q * mv + (1 - q) * fv) * m;
    });
    let best = -1;
    for (let i = 0; i < n; i++) if (i !== wolf && (best < 0 || e[i] < e[best])) best = i;
    const late = g.n - g.hole <= Math.max(3, g.n / 3);
    const lone = e[wolf] + 1 < e[best] || (late && rankOf(g, wolf) > 1 && rng() < 0.4) || rng() < 0.08;
    partner = lone ? -1 : best;
  }

  // Play the hole
  const tp: number[] = [];
  const rows: number[] = [];
  for (let i = 0; i < n; i++) {
    const b = bank(g.pl[i].hi, par);
    const j = Math.floor(rng() * b.n);
    rows.push(j);
    tp.push(b.tp[j]);
  }
  const made: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const d = dealt[i];
    let ok: boolean;
    const rel = REL[d.id];
    if (rel) {
      const p = g.prev[i];
      ok = tp[i] <= (p == null ? rel.first : p - rel.by);
    } else if (d.id in PP) ok = tp[i] <= personalPar(g, i) - PP[d.id] + 1e-9;
    else if (d.id === 'D01') ok = tp[i] < tp[d.rival];
    else if (d.id === 'D03') ok = tp[i] <= tp[d.rival];
    else if (d.id === 'D02') ok = tp.every((x, o) => o === i || tp[i] < x);
    else ok = bank(g.pl[i].hi, par).out[rows[i] * K + IDX[d.id]] === 1;
    made.push(ok);
  }

  // Score
  const ppBefore = g.pl.map((_, i) => personalPar(g, i));
  const hs: number[] = [];
  for (let i = 0; i < n; i++) {
    const [mv, fv] = c.values[dealt[i].tier];
    const adj = (made[i] ? mv : fv) * m * (g.pressed[i] ? 2 : 1);
    if (!rollout && made[i] && EYE.has(dealt[i].id)) {
      g.eyeClaims++;
      g.eyeStrokes += Math.abs(mv - fv) * m;
    }
    hs.push(tp[i] + adj);
    g.tot[i] += tp[i] + adj;
    g.golf[i] += tp[i];
  }
  const f = c.format;
  if (c.cardPoints && f !== 'stroke') {
    // Place on real strokes; the card is worth points on its own.
    for (let i = 0; i < n; i++) (g.pts[i] -= hs[i] - tp[i]), (g.cpts[i] -= hs[i] - tp[i]);
    for (let i = 0; i < n; i++) hs[i] = c.net ? tp[i] - ppBefore[i] : tp[i];
  }
  if (f === 'stableford') for (let i = 0; i < n; i++) g.pts[i] += Math.max(0, 2 - hs[i]);
  else if (f === 'skins') {
    const lo = Math.min(...hs);
    const at = hs.filter((x) => x === lo).length;
    const pot = g.carry + m;
    if (at === 1) {
      g.pts[hs.indexOf(lo)] += pot;
      g.carry = 0;
    } else g.carry = pot;
  } else if (f === 'wolf') {
    const side = (i: number) => i === wolf || i === partner;
    let a = Infinity,
      b = Infinity;
    for (let i = 0; i < n; i++) if (side(i)) a = Math.min(a, hs[i]);
      else b = Math.min(b, hs[i]);
    if (a !== b) {
      const wolfWins = a < b;
      for (let i = 0; i < n; i++) {
        if (partner < 0) {
          if (wolfWins && i === wolf) g.pts[i] += 4 * m;
          if (!wolfWins && i !== wolf) g.pts[i] += 1 * m;
        } else if (side(i) === wolfWins) g.pts[i] += (wolfWins ? 2 : 3) * m;
      }
    }
  } else if (f === 'gp' || f === 'match') {
    // gp: points by place. match: one point per opponent you beat on the hole (½ for a tie).
    const table = f === 'gp' ? (c.gp ?? [4, 2, 1, 0]) : null;
    for (let i = 0; i < n; i++) {
      if (table) {
        const better = hs.filter((x) => x < hs[i]).length;
        const same = hs.filter((x) => x === hs[i]).length;
        let s = 0;
        for (let p = better; p < better + same; p++) s += table[Math.min(p, table.length - 1)];
        g.pts[i] += (s / same) * m;
      } else {
        let s = 0;
        for (let o = 0; o < n; o++) if (o !== i) s += hs[i] < hs[o] ? 1 : hs[i] === hs[o] ? 0.5 : 0;
        g.pts[i] += s * m;
      }
    }
  }
  // Callout: before the hole you may call out one opponent. Lower hole score takes 1 off them (stroke) / 1 point.
  if (A.callout) {
    for (let i = 0; i < n; i++) {
      const behind = rankOf(g, i) > 1;
      if (rng() > (behind ? 0.45 : 0.25)) continue;
      let o = soleLeader >= 0 && soleLeader !== i && behind ? soleLeader : Math.floor(rng() * (n - 1));
      if (o >= i && !(soleLeader >= 0 && soleLeader !== i && behind)) o++;
      if (o === i) continue;
      const w = hs[i] < hs[o] ? i : hs[o] < hs[i] ? o : -1;
      if (w < 0) continue;
      const l = w === i ? o : i;
      const s = 2 * m;
      if (f === 'stroke') (g.tot[w] -= s / 2), (g.tot[l] += s / 2);
      else (g.pts[w] += s / 2), (g.pts[l] -= s / 2);
    }
  }
  // King of the hill: anyone who beats the sole leader's hole score gets a stroke (or point).
  if (A.king && soleLeader >= 0) {
    for (let i = 0; i < n; i++)
      if (i !== soleLeader && hs[i] < hs[soleLeader]) {
        if (f === 'stroke') g.tot[i] -= m;
        else g.pts[i] += m;
      }
  }
  // Hole winner: the outright best hole score in the group gets a stroke off (or a point). Same for everyone.
  if (A.holeWin) {
    const lo = Math.min(...hs);
    if (hs.filter((x) => x === lo).length === 1) {
      const w = hs.indexOf(lo);
      if (f === 'stroke') g.tot[w] -= m;
      else g.pts[w] += m;
    }
  }
  // Predict: call each friend's card (✓ or ✗). Each right call is half a stroke (or point).
  if (A.predict) {
    for (let i = 0; i < n; i++)
      for (let o = 0; o < n; o++) {
        if (o === i) continue;
        const q = cardOdds(g, o, dealt[o]) + 0.25 * (rng() - 0.5);
        const call = q > 0.5;
        if (call === made[o]) {
          if (f === 'stroke') g.tot[i] -= 0.5;
          else g.pts[i] += 0.5;
        }
      }
  }
  for (let i = 0; i < n; i++) {
    g.prev[i] = tp[i];
    if (A.hex && made[i] && dealt[i].tier === c.tiers[c.tiers.length - 1]) g.hex[i] = Math.min(1, g.hex[i] + 1);
  }
  g.hole++;
  return { tiers: dealt.map((d) => d.tier), cards: dealt.map((d) => d.id), made, tp };
}
function valueOf(g: G, i: number, d: Dealt) {
  const q = cardOdds(g, i, d);
  const [mv, fv] = g.c.values[d.tier];
  return q * mv + (1 - q) * fv;
}
function tierValue(g: G, i: number, tier: string) {
  const q = tierOddsAvg(g, i, tier);
  const [mv, fv] = g.c.values[tier];
  return q * mv + (1 - q) * fv;
}

/** Each player's chance of winning from here (rollouts with everyone on their usual style). */
export function winProbs(g: G, R: number, rng: Rng): number[] {
  const p = g.pl.map(() => 0);
  if (g.hole >= g.n) {
    const w = winners(g);
    w.forEach((i) => (p[i] = 1 / w.length));
    return p;
  }
  for (let r = 0; r < R; r++) {
    const h = clone(g);
    while (h.hole < h.n) playOneHole(h, rng, null, true);
    const w = winners(h);
    w.forEach((i) => (p[i] += 1 / w.length / R));
  }
  return p;
}

// ── A full round with stats ─────────────────────────────────────────────────
export interface RoundOut {
  g: G;
  keys: number[][]; // standings key after each hole
  probs?: number[][]; // win chances before hole 1 and after each hole
  traces: HoleTrace[];
}
export function playRound(c: Concept, hs: number[], personas: Persona[], n: number, rng: Rng, probR = 0): RoundOut {
  const g = newGame(c, hs, personas, n, rng);
  const keys: number[][] = [];
  const traces: HoleTrace[] = [];
  const probs: number[][] = [];
  if (probR) probs.push(winProbs(g, probR, rng));
  while (g.hole < g.n) {
    traces.push(playOneHole(g, rng, null, false));
    keys.push(g.pl.map((_, i) => key(g, i)));
    if (probR) probs.push(winProbs(g, probR, rng));
  }
  return { g, keys, traces, probs: probR ? probs : undefined };
}
