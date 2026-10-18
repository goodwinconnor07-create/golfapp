// Scores a concept on the same tests for every design.
import { buildBank, mulberry32, playRound, type Concept, type Persona, type Rng, type RoundOut, winners } from './engine';

const u = (rng: Rng, a: number, b: number) => a + rng() * (b - a);
export const similar = (rng: Rng, k: number, lo = 10, hi = 32) => {
  const c = u(rng, lo, hi);
  return Array.from({ length: k }, () => Math.round(c + u(rng, -3, 3)));
};
export function person(rng: Rng): Persona {
  return persona(rng);
}
function persona(rng: Rng): Persona {
  const r = rng();
  return r < 0.25 ? 'cautious' : r < 0.7 ? 'balanced' : 'reckless';
}

export interface Metrics {
  name: string;
  // strategy
  fixed: number[]; // win share ÷ fair for always level 0..k
  thinker: number; // one thinker vs 3 people
  randomVsPeople: number; // one random picker vs 3 people
  protect: number; // one "lead→Safe, else top level" vs 3 people
  // drama
  leaderAt3: number;
  decidedLast3: number;
  comeback: number;
  leadChanges: number;
  surprise: number; // total movement in win chances per round (0..)
  lateSurprise: number; // share of it in the last 3 holes
  aliveAt3: number; // players with ≥15% to win with 3 to go
  deadEarly: number; // share of players under 3% with 7 to go
  lastHoleLive: number; // rounds where 2+ players had ≥10% before the last hole
  // skill and fairness
  bestMixed: number; // best of 12/18/24/30 (fair = 1)
  worstMixed: number;
  oneVone: number; // 10 hcp beats 20 hcp, 18 holes
  golfWinner: number; // winner also had the best golf score (similar group)
  cardVarShare: number; // share of score spread that comes from cards (stroke units)
  // luck and disputes
  eyeClaims: number;
  eyeStrokes: number;
  drawLuckSD: number;
  repeatRate: number; // share of cards shown that the player had already been shown this round
  distinct: number; // different cards a player sees in a round
  picks: Record<string, number>;
  made: Record<string, number>;
}

export function evaluate(c: Concept, opts: { games?: number; probGames?: number; probR?: number; thinkGames?: number; seed?: number } = {}): Metrics {
  const G = opts.games ?? 1500;
  const PG = opts.probGames ?? 250;
  const PR = opts.probR ?? 120;
  const TG = opts.thinkGames ?? 300;
  const rng = mulberry32(opts.seed ?? 99);
  const share = (r: RoundOut, i: number) => {
    const w = winners(r.g);
    return w.includes(i) ? 1 / w.length : 0;
  };

  // 1. Fixed plans: one player always on the same level, against three ordinary people
  const fixed = c.tiers.map((_, t) => {
    let s = 0;
    for (let g = 0; g < G; g++) {
      const r = playRound(c, similar(rng, 4), [`fixed${t}` as Persona, persona(rng), persona(rng), persona(rng)], 18, rng);
      s += share(r, 0) * 4;
    }
    return s / G;
  });

  // 2. One thinker (or protect) among three people
  const vs = (who: Persona, games: number) => {
    let s = 0;
    for (let g = 0; g < games; g++) {
      const ps: Persona[] = [who, persona(rng), persona(rng), persona(rng)];
      const r = playRound(c, similar(rng, 4), ps, 18, rng);
      s += share(r, 0) * 4;
    }
    return s / games;
  };
  const thinker = TG ? vs('thinker', TG) : NaN;
  const protect = vs('protect', G);
  const randomVsPeople = vs('random', G);

  // 3. Drama: 4 similar people, 18 holes
  let l3 = 0,
    last3 = 0,
    cmb = 0,
    chg = 0,
    golfW = 0;
  const pick: Record<string, number> = {},
    madeN: Record<string, number> = {};
  let reps = 0,
    offs = 0,
    dist = 0;
  let eyeC = 0,
    eyeS = 0,
    luck2 = 0,
    luckN = 0,
    vCard = 0,
    vTot = 0;
  for (let g = 0; g < G; g++) {
    const hs = similar(rng, 4);
    const r = playRound(c, hs, hs.map(() => persona(rng)), 18, rng);
    const n = 18;
    const win = winners(r.g);
    const at = (h: number) => {
      const ks = r.keys[h];
      const m = Math.min(...ks);
      return ks.map((x, i) => (Math.abs(x - m) < 1e-9 ? i : -1)).filter((i) => i >= 0);
    };
    const lb = at(n - 4);
    l3 += lb.reduce((a, i) => a + (win.includes(i) ? 1 / win.length : 0), 0) / lb.length;
    if (!win.some((i) => lb.includes(i))) cmb++;
    let lockAt = n - 1;
    for (let h = n - 1; h >= 0; h--) {
      if (at(h).includes(win[0])) lockAt = h;
      else break;
    }
    if (n - 1 - lockAt <= 2) last3++;
    let prev = -1;
    for (let h = 0; h < n; h++) {
      const l = at(h);
      if (l.length === 1) {
        if (prev !== -1 && l[0] !== prev) chg++;
        prev = l[0];
      }
    }
    const bestGolf = Math.min(...r.g.golf);
    if (win.some((i) => r.g.golf[i] === bestGolf)) golfW++;
    for (const t of r.traces)
      t.tiers.forEach((tr, i) => {
        pick[tr] = (pick[tr] ?? 0) + 1;
        if (t.made[i]) madeN[tr] = (madeN[tr] ?? 0) + 1;
      });
    reps += r.g.repeats;
    offs += r.g.offers;
    dist += r.g.seen.reduce((a, x) => a + x.size, 0) / r.g.seen.length;
    eyeC += r.g.eyeClaims;
    eyeS += r.g.eyeStrokes;
    r.g.drawLuck.forEach((x) => {
      luck2 += x * x;
      luckN++;
    });
    // spread of the round's scores: golf part vs card part (within this round)
    // Points formats with card points: split points into card points and the rest. Otherwise strokes.
    const pf = c.cardPoints && c.format !== 'stroke';
    const card = pf ? r.g.cpts : r.g.tot.map((t, i) => t - r.g.golf[i]);
    const golfPart = pf ? r.g.pts.map((p, i) => p - r.g.cpts[i]) : r.g.golf;
    const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
    const vr = (a: number[]) => {
      const m = mean(a);
      return mean(a.map((x) => (x - m) ** 2));
    };
    vCard += vr(card);
    vTot += vr(card) + vr(golfPart);
  }
  const total = Object.values(pick).reduce((a, b) => a + b, 0);

  // 4. Win chances over the round
  let sur = 0,
    late = 0,
    alive = 0,
    dead = 0,
    live = 0;
  for (let g = 0; g < PG; g++) {
    const hs = similar(rng, 4);
    const r = playRound(c, hs, hs.map(() => persona(rng)), 18, rng, PR);
    const P = r.probs!;
    let s = 0,
      sl = 0;
    for (let t = 1; t < P.length; t++) {
      const d = P[t].reduce((a, p, i) => a + Math.abs(p - P[t - 1][i]), 0) / 2;
      s += d;
      if (t > P.length - 4) sl += d;
    }
    sur += s;
    late += sl / Math.max(s, 1e-9);
    alive += P[15].filter((p) => p >= 0.15).length;
    dead += P[11].filter((p) => p < 0.03).length / 4;
    if (P[17].filter((p) => p >= 0.1).length >= 2) live++;
  }

  // 5. Skill
  let best = 0,
    worst = 0,
    oneV = 0;
  for (let g = 0; g < G; g++) {
    const r = playRound(c, [12, 18, 24, 30], [persona(rng), persona(rng), persona(rng), persona(rng)], 18, rng);
    best += share(r, 0) * 4;
    worst += share(r, 3) * 4;
    const r2 = playRound(c, [10, 20], [persona(rng), persona(rng)], 18, rng);
    oneV += share(r2, 0);
  }

  return {
    name: c.name,
    fixed,
    thinker,
    randomVsPeople,
    protect,
    leaderAt3: l3 / G,
    decidedLast3: last3 / G,
    comeback: cmb / G,
    leadChanges: chg / G,
    surprise: sur / PG,
    lateSurprise: late / PG,
    aliveAt3: alive / PG,
    deadEarly: dead / PG,
    lastHoleLive: live / PG,
    bestMixed: best / G,
    worstMixed: worst / G,
    oneVone: oneV / G,
    golfWinner: golfW / G,
    cardVarShare: vCard / vTot,
    eyeClaims: eyeC / G,
    eyeStrokes: eyeS / G,
    drawLuckSD: Math.sqrt(luck2 / Math.max(1, luckN)),
    repeatRate: reps / Math.max(1, offs),
    distinct: dist / G,
    picks: Object.fromEntries(Object.entries(pick).map(([t, x]) => [t, x / total])),
    made: Object.fromEntries(Object.entries(pick).map(([t, x]) => [t, (madeN[t] ?? 0) / x])),
  };
}

export function print(m: Metrics) {
  const p = (x: number) => `${Math.round(100 * x)}%`;
  const f = (x: number) => x.toFixed(2);
  console.log(`\n## ${m.name}`);
  console.log(
    `  plans: always ${m.fixed.map(f).join('/')} | vs people: random ${f(m.randomVsPeople)} protect ${f(m.protect)} thinker ${f(m.thinker)}`,
  );
  console.log(
    `  drama: ldr@3 ${p(m.leaderAt3)} last3 ${p(m.decidedLast3)} cmbk ${p(m.comeback)} chg ${m.leadChanges.toFixed(1)} | surprise ${f(m.surprise)} late ${p(m.lateSurprise)} alive@3 ${f(m.aliveAt3)} dead@12 ${p(m.deadEarly)} lastHoleLive ${p(m.lastHoleLive)}`,
  );
  console.log(
    `  skill: best ${f(m.bestMixed)} worst ${f(m.worstMixed)} 10v20 ${p(m.oneVone)} golfWinner ${p(m.golfWinner)} cardVar ${p(m.cardVarShare)}`,
  );
  console.log(
    `  luck: eyeClaims ${m.eyeClaims.toFixed(1)} eyeStrokes ${m.eyeStrokes.toFixed(1)} drawSD ${f(m.drawLuckSD)} repeats ${p(m.repeatRate)} distinct ${m.distinct.toFixed(1)} | picks ${Object.entries(m.picks)
      .map(([t, x]) => `${t[0]}${p(x)}`)
      .join(' ')} made ${Object.entries(m.made)
      .map(([t, x]) => `${t[0]}${p(x)}`)
      .join(' ')}`,
  );
}

export { buildBank };
