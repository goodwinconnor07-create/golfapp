import { BASE, buildBank } from './engine';
import { fixedSpread, grid3, tune } from './tune';
buildBank(4000);
const t0 = Date.now();
console.log('today', fixedSpread(BASE, 2500, 77));
const top = tune(BASE, grid3(), 500, 6, 2000);
for (const r of top) console.log(JSON.stringify(r.v), r.sh.map((x) => x.toFixed(2)).join(' '), 'spread', r.spread.toFixed(2));
console.log((Date.now() - t0) / 1000, 's');
