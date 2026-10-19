// Odds for a reworded Knee-Knocker: "Sink your first putt, from at least N feet."
import { facts, makeHole, mulberry32, playHole, skill } from '../balance/golf';
const FT = 0.3048;
const rng = mulberry32(8);
for (const ft of [3, 4, 6]) {
  const row: string[] = [];
  for (const h of [8, 14, 20, 26, 32]) {
    let m = 0;
    const N = 30000;
    for (let i = 0; i < N; i++) {
      const f = facts(playHole(skill(h), makeHole([3, 4, 4, 4, 5][i % 5], rng), rng, false));
      const p = f.shots.find((s) => s.kind === 'putt');
      if (p && p.holed && p.from >= ft * FT) m++;
    }
    row.push(`${h}:${Math.round((100 * m) / N)}%`);
  }
  console.log(`first putt from ${ft}+ ft`, row.join(' '));
}
