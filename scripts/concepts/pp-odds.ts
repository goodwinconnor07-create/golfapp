import { BASE, buildBank, mulberry32, playRound } from './engine';
buildBank(5000);
const rng = mulberry32(2);
for (const id of ['P01', 'P02', 'P03', 'I18', 'B16']) {
  const c = { ...BASE, name: 'pp' + id, deck: { ...BASE.deck, [id]: 'insane' } };
  // only this card at insane
  for (const k of Object.keys(c.deck)) if (c.deck[k] === 'insane' && k !== id) delete c.deck[k];
  const row: string[] = [];
  for (const h of [8, 14, 20, 26, 32]) {
    let m = 0, n = 0;
    for (let g = 0; g < 400; g++) {
      const r = playRound(c, [h, h, h, h], ['fixed2', 'fixed2', 'fixed2', 'fixed2'], 18, rng);
      r.traces.forEach((t) => t.made.forEach((x) => { m += x ? 1 : 0; n++; }));
    }
    row.push(`${h}:${Math.round((100 * m) / n)}%`);
  }
  console.log(id, row.join(' '));
}
