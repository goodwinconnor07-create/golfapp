// Balance simulator: plays whole rounds with the real deck and values from src/game.
// See docs/GAME_BALANCE.md for what it measures and the targets a change has to meet.
import { CARDS } from '../../src/game/cards';
import { DOUBLE_STAKES_HOLES, DOUBLE_STAKES_MIN_ROUND } from '../../src/game/rules';
import { TIERS as TIER_DEFS } from '../../src/game/tiers';
import type { Tier } from '../../src/game/types';
import { CANDIDATES } from './checks';
import { facts, makeHole, playHole, skill, type Rng } from './golf';

export const TIERS: Tier[] = ['safe', 'bold', 'insane'];
const CHECKS = Object.fromEntries(CANDIDATES.map((c) => [c.id, c]));
const PARS18 = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5];
const PAR_W: Record<number, number> = { 3: 4, 4: 10, 5: 4 };
/** The audience: groups anywhere from about 10 to 36 handicap. */
export const MIX_H = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36];
const H_GRID = Array.from({ length: 21 }, (_, i) => i * 2);

export interface Config {
  /** card id → tier, for every card that can be dealt */
  deck: Record<string, Tier>;
  made: Record<Tier, number>;
  fail: Record<Tier, number>;
  doubleMult: number;
}

/** The game as it is in the code right now (distance cards on, situation cards off). */
export function currentConfig(): Config {
  const deck: Record<string, Tier> = {};
  for (const c of CARDS) if (c.enabled && !c.situational) deck[c.id] = c.tier;
  const missing = Object.keys(deck).filter((id) => !CHECKS[id]);
  if (missing.length) throw new Error(`No balance check for card(s) ${missing.join(', ')}. Add them to scripts/balance/checks.ts.`);
  return {
    deck,
    made: { safe: TIER_DEFS.safe.made, bold: TIER_DEFS.bold.made, insane: TIER_DEFS.insane.made },
    fail: { safe: TIER_DEFS.safe.missed, bold: TIER_DEFS.bold.missed, insane: TIER_DEFS.insane.missed },
    doubleMult: 2,
  };
}

// ── Card odds table (how often a golfer of each handicap completes each card) ──
export type Table = Record<string, Record<number, number>>;
export function buildTable(rng: Rng, samples: number): Table {
  const out: Table = {};
  for (const h of H_GRID) {
    for (const par of [3, 4, 5]) {
      const cs = CANDIDATES.filter((c) => c.pars.includes(par as 3 | 4 | 5));
      const made: Record<string, number> = {};
      const dist = Array(13).fill(0);
      for (let i = 0; i < samples; i++) {
        const pp = [4, 4, 4, 4, 4, 3, 3, 5, 5][Math.floor(rng() * 9)];
        const prev = playHole(skill(h), makeHole(pp, rng), rng, rng() < 0.2);
        const log = playHole(skill(h), makeHole(par, rng), rng, rng() < 0.2);
        const f = facts(log);
        const ctx = { prevToPar: rng() < 1 / 18 ? null : prev.strokes - pp };
        for (const c of cs) if (c.check(f, log, ctx)) made[c.id] = (made[c.id] ?? 0) + 1;
        dist[Math.max(0, Math.min(12, log.strokes - par + 2))]++;
      }
      for (const c of cs) (out[`${c.id}|${par}`] ??= {})[h] = (made[c.id] ?? 0) / samples;
      dist.forEach((n: number, d: number) => ((out[`D|${par}|${d}`] ??= {})[h] = (n + 0.5) / (samples + 6.5)));
    }
  }
  return out;
}

export function odds(t: Table, id: string, par: number, h: number): number {
  const row = t[`${id}|${par}`];
  const hh = Math.max(0, Math.min(40, h));
  const lo = Math.min(38, Math.floor(hh / 2) * 2);
  const w = (hh - lo) / 2;
  return row[lo] * (1 - w) + row[lo + 2] * w;
}

export function pool(cfg: Config, tier: Tier, par: number): string[] {
  return Object.entries(cfg.deck)
    .filter(([id, t]) => t === tier && CHECKS[id].pars.includes(par as 3 | 4 | 5))
    .map(([id]) => id);
}

/** Average completion rate of a tier for a golfer (par mix, or one par). */
export function tierOdds(t: Table, cfg: Config, tier: Tier, h: number, par?: number): number {
  let s = 0,
    w = 0;
  for (const pr of par ? [par] : [3, 4, 5]) {
    const ids = pool(cfg, tier, pr);
    if (!ids.length) continue;
    const ww = par ? 1 : PAR_W[pr];
    s += (ww * ids.reduce((a, id) => a + odds(t, id, pr, h), 0)) / ids.length;
    w += ww;
  }
  return s / w;
}

/** Expected strokes a tier adds, and its spread. */
export function tierEV(t: Table, cfg: Config, tier: Tier, h: number, par?: number, mult = 1) {
  const q = tierOdds(t, cfg, tier, h, par);
  const m = cfg.made[tier] * mult,
    x = cfg.fail[tier] * mult;
  const ev = q * m + (1 - q) * x;
  return { ev, sd: Math.abs(m - x) * Math.sqrt(q * (1 - q)) };
}

// ── Players ─────────────────────────────────────────────────────────────
/**
 * Personalities (a realistic group) and fixed plans (the strategy test).
 * smart: knows its own odds on this par and manages risk from the standings.
 */
export type Style = 'cautious' | 'balanced' | 'reckless' | 'smart' | 'aSafe' | 'aBold' | 'aInsane' | 'protect' | 'random';
export const PLANS: Style[] = ['aSafe', 'aBold', 'aInsane', 'protect', 'random', 'smart'];
const PERSONAS: [Style, number][] = [
  ['cautious', 0.2],
  ['balanced', 0.35],
  ['reckless', 0.2],
  ['smart', 0.25],
];
const BASE_W: Record<string, number[]> = {
  cautious: [0.65, 0.3, 0.05],
  balanced: [0.35, 0.45, 0.2],
  reckless: [0.12, 0.35, 0.53],
  random: [1, 1, 1],
};

const normal = (rng: Rng) => Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12))) * Math.cos(2 * Math.PI * rng());
function pickW(rng: Rng, w: number[]): number {
  const s = w.reduce((a, b) => a + b, 0);
  let r = rng() * s;
  for (let i = 0; i < w.length; i++) if ((r -= w[i]) < 0) return i;
  return w.length - 1;
}

interface Ctx {
  gap: number;
  lead: number;
  left: number;
  n: number;
  mult: number;
  par: number;
}
function chooseTier(t: Table, cfg: Config, h: number, style: Style, c: Ctx, rng: Rng): Tier {
  if (style === 'aSafe') return 'safe';
  if (style === 'aBold') return 'bold';
  if (style === 'aInsane') return 'insane';
  if (style === 'protect') return c.gap === 0 ? 'safe' : 'insane';
  if (style === 'smart') {
    const lam = c.gap > 0 ? -Math.min(1, c.gap / Math.max(1, c.left * c.mult * 2.5)) : c.lead > 0 ? 0.15 + 0.5 * (1 - c.left / c.n) : 0;
    let best: Tier = 'safe',
      bu = Infinity;
    for (const tier of TIERS) {
      const s = tierEV(t, cfg, tier, h, c.par, c.mult);
      const u = s.ev + lam * s.sd + 0.3 * normal(rng);
      if (u < bu) {
        bu = u;
        best = tier;
      }
    }
    return best;
  }
  const w = BASE_W[style].slice();
  if (style !== 'random') {
    // Everyone chases when well behind late on, and protects a lead.
    if (c.left <= Math.max(3, c.n / 3) && c.gap >= 4) {
      const s = w[0] * 0.6;
      w[0] -= s;
      w[2] += s;
    }
    if (c.left <= Math.max(3, c.n / 3) && c.lead >= 4) {
      const s = w[2] * 0.5;
      w[2] -= s;
      w[0] += s;
    }
  }
  return TIERS[pickW(rng, w)];
}

function deal(cfg: Config, tier: Tier, par: number, held: Set<string>, used: Set<string>, rng: Rng, exclude: string[] = []): string {
  const base = pool(cfg, tier, par).filter((id) => !held.has(id) && !exclude.includes(id));
  let ids = base.filter((id) => !used.has(id));
  if (!ids.length) {
    used.clear();
    ids = base.length ? base : pool(cfg, tier, par);
  }
  const id = ids[Math.floor(rng() * ids.length)];
  used.add(id);
  return id;
}

// ── A round ─────────────────────────────────────────────────────────────
export interface Round {
  n: number;
  players: { h: number; style: Style }[];
  cum: number[][];
  final: number[];
  picks: { style: Style; tier: Tier; made: boolean; h: number }[];
}

export function playRound(t: Table, cfg: Config, hs: number[], styles: (Style | null)[], n: number, rng: Rng): Round {
  const start = n === 9 && rng() < 0.5 ? 9 : 0;
  const pars = Array.from({ length: n }, (_, i) => PARS18[(start + i) % 18]);
  const course = pars.map((par) => makeHole(par, rng));
  const persona = (): Style => {
    let r = rng();
    for (const [s, w] of PERSONAS) if ((r -= w) < 0) return s;
    return 'balanced';
  };
  const pl = hs.map((h, i) => ({ h, style: styles[i] ?? persona(), mulls: n <= 9 ? 2 : 4, redrawn: false, prev: null as number | null }));
  const used: Record<Tier, Set<string>> = { safe: new Set(), bold: new Set(), insane: new Set() };
  const tot = pl.map(() => 0),
    cum: number[][] = pl.map(() => []);
  const picks: Round['picks'] = [];
  for (let i = 0; i < n; i++) {
    const par = pars[i];
    const mult = n >= DOUBLE_STAKES_MIN_ROUND && i >= n - DOUBLE_STAKES_HOLES ? cfg.doubleMult : 1;
    const best = Math.min(...tot);
    const sorted = tot.slice().sort((a, b) => a - b);
    const held = new Set<string>();
    const hand: { tier: Tier; id: string }[] = [];
    pl.forEach((P, k) => {
      const ctx: Ctx = { gap: tot[k] - best, lead: tot[k] === best ? (sorted[1] ?? best) - best : 0, left: n - i, n, mult, par };
      const tier = chooseTier(t, cfg, P.h, P.style, ctx, rng);
      let id = deal(cfg, tier, par, held, used[tier], rng);
      if (CHECKS[id].id === 'S10' && !course[i].hasBunker) id = deal(cfg, tier, par, held, used[tier], rng, ['S10']);
      // The once-a-round redraw, used on a card well below what the level usually gives you.
      if (!P.redrawn) {
        const pc = odds(t, id, par, P.h),
          avg = tierOdds(t, cfg, tier, P.h, par);
        if (pc < 0.5 * avg || (n - i <= 2 && pc < avg)) {
          id = deal(cfg, tier, par, held, used[tier], rng, [id]);
          P.redrawn = true;
        }
      }
      held.add(id);
      hand.push({ tier, id });
    });
    pl.forEach((P, k) => {
      const { tier, id } = hand[k];
      const log = playHole(skill(P.h), course[i], rng, P.mulls > 0);
      if (log.mulligan) P.mulls--;
      const made = CHECKS[id].check(facts(log), log, { prevToPar: P.prev });
      const tp = log.strokes - par;
      tot[k] += tp + (made ? cfg.made[tier] : cfg.fail[tier]) * mult;
      cum[k].push(tot[k]);
      picks.push({ style: P.style, tier, made, h: P.h });
      P.prev = tp;
    });
  }
  return { n, players: pl.map((x) => ({ h: x.h, style: x.style })), cum, final: tot, picks };
}

// ── What we measure ─────────────────────────────────────────────────────
const leaders = (a: number[]) => {
  const m = Math.min(...a);
  return a.map((x, i) => (x === m ? i : -1)).filter((i) => i >= 0);
};
export interface Summary {
  games: number;
  /** win share ÷ fair share, per style (1.00 = fair) */
  style: Record<string, number>;
  leaderWith3ToGo: number;
  decidedLast3: number;
  ledFromHalfway: number;
  comeback: number;
  leadChanges: number;
  margin: number;
  within2: number;
  bestGolfer: number;
  worstGolfer: number;
  picks: Record<Tier, number>;
  made: Record<Tier, number>;
  insanePerRound: number;
}
export function summarise(rounds: Round[]): Summary {
  const st: Record<string, [number, number]> = {};
  const pk: Record<Tier, [number, number]> = { safe: [0, 0], bold: [0, 0], insane: [0, 0] };
  let ldr3 = 0,
    last3 = 0,
    half = 0,
    cmb = 0,
    chg = 0,
    margin = 0,
    w2 = 0,
    best = 0,
    worst = 0;
  for (const r of rounds) {
    const n = r.n,
      np = r.final.length;
    const srt = r.final.slice().sort((a, b) => a - b);
    const win = leaders(r.final),
      share = 1 / win.length;
    margin += srt[1] - srt[0];
    if (srt[1] - srt[0] <= 2) w2++;
    const lb = leaders(r.cum.map((c) => c[n - 4]));
    ldr3 += lb.reduce((a, i) => a + (win.includes(i) ? share : 0), 0) / lb.length;
    if (!win.some((i) => lb.includes(i))) cmb++;
    let lockAt = n - 1;
    for (let h = n - 1; h >= 0; h--) {
      if (leaders(r.cum.map((c) => c[h])).includes(win[0])) lockAt = h;
      else break;
    }
    if (n - 1 - lockAt <= 2) last3++;
    if (n - 1 - lockAt >= Math.floor(n / 2)) half++;
    let prev = -1;
    for (let h = 0; h < n; h++) {
      const l = leaders(r.cum.map((c) => c[h]));
      if (l.length === 1) {
        if (prev !== -1 && l[0] !== prev) chg++;
        prev = l[0];
      }
    }
    r.players.forEach((p, i) => {
      const s = (st[p.style] ??= [0, 0]);
      s[0] += win.includes(i) ? share : 0;
      s[1] += 1 / np;
    });
    const order = r.players.map((p, i) => [p.h, i]).sort((a, b) => a[0] - b[0]);
    best += (win.includes(order[0][1]) ? share : 0) * np;
    worst += (win.includes(order[np - 1][1]) ? share : 0) * np;
    for (const p of r.picks) {
      pk[p.tier][0]++;
      if (p.made) pk[p.tier][1]++;
    }
  }
  const G = rounds.length;
  const total = pk.safe[0] + pk.bold[0] + pk.insane[0];
  return {
    games: G,
    style: Object.fromEntries(Object.entries(st).map(([k, [w, f]]) => [k, w / f])),
    leaderWith3ToGo: ldr3 / G,
    decidedLast3: last3 / G,
    ledFromHalfway: half / G,
    comeback: cmb / G,
    leadChanges: chg / G,
    margin: margin / G,
    within2: w2 / G,
    bestGolfer: best / G,
    worstGolfer: worst / G,
    picks: { safe: pk.safe[0] / total, bold: pk.bold[0] / total, insane: pk.insane[0] / total },
    made: { safe: pk.safe[1] / pk.safe[0], bold: pk.bold[1] / pk.bold[0], insane: pk.insane[1] / pk.insane[0] },
    insanePerRound: pk.insane[1] / G,
  };
}
