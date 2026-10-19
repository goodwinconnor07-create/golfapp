// npx tsx tune-one.ts <key>: one-plan-vs-people shares for a concept's own values (quick balance check).
import { CONCEPTS } from './catalog';
import { buildBank } from './engine';
import { fixedSpread } from './tune';
buildBank(4000);
for (const k of process.argv.slice(2)) {
  const r = fixedSpread(CONCEPTS[k], 2500, 21);
  console.log(k, JSON.stringify(CONCEPTS[k].values), r.sh.map((x) => x.toFixed(2)).join(' '), 'spread', r.spread.toFixed(2));
}
