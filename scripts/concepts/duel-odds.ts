import { BASE, buildBank, mulberry32, newGame, playOneHole } from './engine';
buildBank(5000);
const rng = mulberry32(1);
for (const group of [[20, 20, 20, 20], [12, 18, 24, 30], [10, 20]]) {
  for (const id of ['D01', 'D02', 'D03']) {
    const c = { ...BASE, name: 'duel' + id, deck: { [id]: 'insane', S01: 'safe', B16: 'bold' } };
    const made = group.map(() => 0); const N = 20000;
    for (let k = 0; k < N; k++) {
      const g = newGame(c, group, group.map(() => 'fixed2' as const), 18, rng);
      g.hole = Math.floor(rng() * 18);
      const t = playOneHole(g, rng, null, true);
      t.made.forEach((m, i) => (made[i] += m ? 1 / N : 0));
    }
    console.log(group.join('/'), id, made.map((x) => Math.round(100 * x) + '%').join(' '));
  }
}
