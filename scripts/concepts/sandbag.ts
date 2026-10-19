// Does tanking the first 3 holes (2 strokes worse each, on purpose) pay off through average-based cards?
import { CONCEPTS } from './catalog';
import { buildBank, mulberry32, playRound, winners, type Persona } from './engine';
import { person, similar } from './eval';
buildBank(4000);
const c = CONCEPTS[process.argv[2] ?? 'v5'];
for (const who of ['balanced', 'sandbag'] as Persona[]) {
  const rng = mulberry32(31);
  let s = 0;
  const G = Number(process.env.G ?? 4000);
  for (let g = 0; g < G; g++) {
    const r = playRound(c, similar(rng, 4), [who, person(rng), person(rng), person(rng)], 18, rng);
    const w = winners(r.g);
    if (w.includes(0)) s += 4 / w.length;
  }
  console.log(c.name, who, (s / G).toFixed(3));
}
