// Calibration of src/game/winChance.ts: when it says 30%, does that player win about 30% of the time?
// Plays simulated v5 rounds, asks the estimator after every hole (using only what the app would see),
// and compares with who actually won. Also compares with the simulator's own chances, which know true handicaps.
import { winChances, type WinInput } from '../../src/game/winChance';
import { CONCEPTS } from './catalog';
import { buildBank, mulberry32, newGame, playOneHole, winProbs, winners, type G } from './engine';
import { person, similar } from './eval';

buildBank(4000);
const c = CONCEPTS[process.argv[2] ?? 'v5'];
const rng = mulberry32(77);
const G_N = Number(process.env.G ?? 500);
const ORACLE = Number(process.env.ORACLE ?? 120);
const buckets = Array.from({ length: 10 }, () => ({ n: 0, p: 0, w: 0 }));
let brier = 0, brierO = 0, nO = 0, n = 0, base = 0;
const toInput = (g: G, picks: Record<string, number>[]): WinInput => ({
  units: g.pl.map((_, i) => ({
    id: String(i),
    toPar: g.tot[i],
    golfToPar: g.golf[i],
    holes: g.hole,
    picks: picks[i] as WinInput['units'][0]['picks'],
    pending: g.pending
      .filter((p) => p.i === i)
      .map((p) => ({ made: g.c.values[p.tier][0] * p.m, missed: g.c.values[p.tier][1] * p.m, chance: { M01: 0.45, M02: 0.4, M04: 0.8, M05: 0.75 }[p.id] ?? 0.5 })),
  })),
  remaining: g.pars.slice(g.hole).map((par, k) => ({ par: par as 3 | 4 | 5, mult: g.c.double && g.hole + k >= g.n - 3 ? 2 : 1 })),
  values: Object.fromEntries(Object.entries(g.c.values).map(([t, [m, x]]) => [t, { made: m, missed: x }])) as WinInput['values'],
  crown: Boolean(g.c.addons?.king),
  wild: Boolean(g.c.addons?.wild),
  gold: Boolean(g.c.addons?.gold),
  seed: Math.floor(rng() * 1e9),
});
for (let k = 0; k < G_N; k++) {
  const g = newGame(c, similar(rng, 4), [0, 1, 2, 3].map(() => person(rng)), 18, rng);
  const picks = g.pl.map(() => ({ safe: 0, bold: 0, insane: 0 }) as Record<string, number>);
  const snaps: { est: Record<string, number>; oracle?: number[] }[] = [];
  while (g.hole < g.n) {
    const t = playOneHole(g, rng, null, false);
    t.tiers.forEach((tier, i) => (picks[i][tier] += 1));
    if (g.hole < g.n) snaps.push({ est: winChances(toInput(g, picks)), oracle: k < ORACLE ? winProbs(g, 100, rng) : undefined });
  }
  const w = winners(g);
  for (const s of snaps)
    for (let i = 0; i < 4; i++) {
      const p = s.est[String(i)];
      const won = w.includes(i) ? 1 / w.length : 0;
      brier += (p - won) ** 2;
      base += (0.25 - won) ** 2;
      n++;
      const b = buckets[Math.min(9, Math.floor(p * 10))];
      b.n++; b.p += p; b.w += won;
      if (s.oracle) { brierO += (s.oracle[i] - won) ** 2; nO++; }
    }
}
console.log(`Brier: estimator ${(brier / n).toFixed(4)}  simulator (knows true handicaps) ${(brierO / nO).toFixed(4)}  coin flip 25% ${(base / n).toFixed(4)}`);
console.log('said → happened');
for (const b of buckets) if (b.n) console.log(`  ${(100 * b.p / b.n).toFixed(0).padStart(3)}% → ${(100 * b.w / b.n).toFixed(0).padStart(3)}%  (${b.n})`);
