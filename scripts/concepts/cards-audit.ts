// Card audit: odds per enabled card by handicap, skill slope, and how it's judged.
import { CARDS } from '../../src/game/cards';
import { TIERS } from '../../src/game/tiers';
import { CANDIDATES } from '../balance/checks';
import { mulberry32 } from '../balance/golf';
import { buildTable, odds } from '../balance/sim';

const rng = mulberry32(7);
const t = buildTable(rng, Number(process.env.SAMPLES ?? 6000));
const C = Object.fromEntries(CANDIDATES.map((c) => [c.id, c]));
const PAR_W: Record<number, number> = { 3: 4, 4: 10, 5: 4 };
const HS = [8, 14, 20, 26, 32];
const ids = process.env.ALL ? CANDIDATES.map((c) => c.id) : CARDS.filter((c) => c.enabled).map((c) => c.id);
const pct = (x: number) => `${Math.round(100 * x)}`.padStart(3);
console.log('id   tier    title                     pars   ' + HS.map((h) => `h${h}`.padStart(4)).join('') + '  slope  EV@20  judged');
for (const id of ids) {
  const c = C[id];
  const def = CARDS.find((d) => d.id === id);
  const tier = def?.tier ?? '-';
  const row = HS.map((h) => {
    let s = 0,
      w = 0;
    for (const p of c.pars) {
      s += PAR_W[p] * odds(t, id, p, h);
      w += PAR_W[p];
    }
    return s / w;
  });
  const ev = def ? row[2] * TIERS[def.tier].made + (1 - row[2]) * TIERS[def.tier].missed : NaN;
  const judged = c.auto ? 'strokes' : c.eye ? 'EYE' : 'honour';
  console.log(
    `${id.padEnd(4)} ${String(tier).padEnd(7)} ${c.title.slice(0, 25).padEnd(25)} ${c.pars.join('').padEnd(6)} ${row.map((x) => pct(x).padStart(4)).join('')}  ${(row[0] / Math.max(row[4], 0.001)).toFixed(2).padStart(5)}  ${ev.toFixed(2).padStart(5)}  ${judged}`,
  );
}
