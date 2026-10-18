// npx tsx tune-all.ts <concept> [<concept>…]: prints tuned values as JSON lines.
import { CONCEPTS } from './catalog';
import { buildBank } from './engine';
import { fixedSpread, grid3, tune } from './tune';

function* grid2(): Generator<Record<string, [number, number]>> {
  for (const sm of [-1, -2]) for (const im of [-4, -5, -6, -7, -8, -9, -10, -11, -12, -14]) for (const iff of [2, 3, 4]) yield { safe: [sm, 1], insane: [im, iff] };
}
function* grid4(): Generator<Record<string, [number, number]>> {
  for (const im of [-7, -8, -9, -10]) for (const lm of [-14, -16, -18, -20, -24, -28]) for (const lf of [4, 5])
    yield { safe: [-1, 1], bold: [-2, 2], insane: [im, 3], legend: [lm, lf] };
}

function* gridPts(): Generator<Record<string, [number, number]>> {
  for (const sf of [0, 1]) for (const bm of [-2, -3]) for (const bf of [1, 2]) for (const im of [-3, -4, -5, -6, -7, -8, -10]) for (const iff of [2, 3]) {
    if (bf <= sf || iff <= bf) continue;
    yield { safe: [-1, sf], bold: [bm, bf], insane: [im, iff] };
  }
}

buildBank(4000);
for (const key of process.argv.slice(2)) {
  const c = CONCEPTS[key];
  const g = c.tune === 'grid2' ? grid2() : c.tune === 'grid4' ? grid4() : c.tune === 'gridPts' ? gridPts() : grid3();
  const before = fixedSpread(c, 1500, 77);
  const top = tune(c, g, 400, 5, 1500);
  console.log(JSON.stringify({ key, before: { v: c.values, sh: before.sh, spread: before.spread }, best: top.slice(0, 3) }));
}
