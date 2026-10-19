// Finds per-level values that keep "always Safe / Bold / Insane" level for a concept.
import { buildBank, mulberry32, playRound, winners, type Concept, type Persona } from './engine';
import { person, similar } from './eval';

export function fixedSpread(c: Concept, G: number, seed = 3) {
  // One player on a fixed plan against three ordinary people.
  const rng = mulberry32(seed);
  const plans: Persona[] = [...c.tiers.map((_, t) => `fixed${t}` as Persona), 'random'];
  const sh = plans.map((p) => {
    let s = 0;
    for (let g = 0; g < G; g++) {
      const r = playRound(c, similar(rng, 4), [p, person(rng), person(rng), person(rng)], 18, rng);
      const w = winners(r.g);
      s += (w.includes(0) ? 1 / w.length : 0) * 4;
    }
    return s / G;
  });
  const fixed = sh.slice(0, c.tiers.length);
  return { sh, spread: Math.max(...fixed) - Math.min(...fixed), max: Math.max(...fixed) };
}

export function* grid3(): Generator<Record<string, [number, number]>> {
  for (const sm of [-1, -2])
    for (const bm of [-2, -3, -4])
      for (const bf of [2, 3])
        for (const im of [-5, -6, -7, -8, -9, -10, -11, -12, -14])
          for (const iff of [3, 4]) {
            if (iff <= bf || bm >= sm) continue;
            yield { safe: [sm, 1], bold: [bm, bf], insane: [im, iff] };
          }
}

export function tune(c: Concept, grid: Iterable<Record<string, [number, number]>>, G = 700, keep = 6, confirmG = 2500) {
  const res: { v: Record<string, [number, number]>; spread: number; max: number; sh: number[] }[] = [];
  for (const v of grid) {
    const cc = { ...c, name: `${c.name}#${JSON.stringify(v)}`, values: v };
    const r = fixedSpread(cc, G);
    res.push({ v, ...r });
  }
  res.sort((a, b) => a.spread + Math.max(0, a.max - 1.1) * 2 - (b.spread + Math.max(0, b.max - 1.1) * 2));
  const top = res.slice(0, keep).map((r) => {
    const cc = { ...c, name: `${c.name}#c${JSON.stringify(r.v)}`, values: r.v };
    return { v: r.v, ...fixedSpread(cc, confirmG, 77) };
  });
  top.sort((a, b) => a.spread - b.spread);
  return top;
}
export { buildBank };
