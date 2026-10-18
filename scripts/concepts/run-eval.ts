// npx tsx run-eval.ts <key> ['<values json>']: full metrics for one concept, as a JSON line.
import { CONCEPTS } from './catalog';
import { buildBank, setThinkR } from './engine';
import { evaluate, print } from './eval';

buildBank(Number(process.env.BANK ?? 5000));
setThinkR(Number(process.env.THINK_R ?? 64));
const key = process.argv[2];
const c = { ...CONCEPTS[key] };
if (process.argv[3]) c.values = JSON.parse(process.argv[3]);
const m = evaluate(c, {
  games: Number(process.env.G ?? 1500),
  probGames: Number(process.env.PG ?? 200),
  probR: Number(process.env.PR ?? 100),
  thinkGames: Number(process.env.TG ?? 120),
});
print(m);
console.log('JSON ' + JSON.stringify({ key, values: c.values, ...m }));
