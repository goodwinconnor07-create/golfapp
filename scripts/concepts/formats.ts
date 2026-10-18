// npx tsx formats.ts <key> ['<values json>']: drama in other group sizes and round lengths.
import { CONCEPTS } from './catalog';
import { buildBank, mulberry32, playRound, winners } from './engine';
import { person, similar } from './eval';

buildBank(5000);
const c = { ...CONCEPTS[process.argv[2]] };
if (process.argv[3]) c.values = JSON.parse(process.argv[3]);
const rng = mulberry32(5);
const G = Number(process.env.G ?? 2000);
const out: string[] = [];
for (const [label, k, n] of [['4p 18', 4, 18], ['3p 18', 3, 18], ['1v1 18', 2, 18], ['4p 9', 4, 9], ['1v1 9', 2, 9]] as const) {
  let l3 = 0, last3 = 0, cmb = 0;
  for (let g = 0; g < G; g++) {
    const hs = similar(rng, k);
    const r = playRound(c, hs, hs.map(() => person(rng)), n, rng);
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
  }
  out.push(`${label}: ldr@3 ${Math.round((100 * l3) / G)}% last3 ${Math.round((100 * last3) / G)}% cmbk ${Math.round((100 * cmb) / G)}%`);
}
console.log(`${process.argv[2]} | ${out.join(' | ')}`);
