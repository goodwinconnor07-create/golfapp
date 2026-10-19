// Odds for Name It targets and the reworded cards, by handicap.
import { BASE, buildBank, mulberry32, playRound, type Persona } from './engine';
buildBank(5000);
const rng = mulberry32(9);
const HS = [8, 14, 20, 26, 32];
const row = (label: string, deck: Record<string, string>, persona: Persona, want: (c: string) => boolean) => {
  const c = {
    ...BASE,
    name: label,
    decision: 'hand' as const,
    deck,
    double: false,
    values: { safe: [-1, 0], bold: [-1, 0], insane: [-1, 0] } as Record<string, [number, number]>,
  };
  const r = HS.map((h) => {
    let made = 0,
      n = 0;
    for (let k = 0; k < 250; k++) {
      const out = playRound(c, [h, h, h, h], [persona, 'balanced', 'balanced', 'balanced'], 18, rng);
      out.traces.forEach((t) => {
        if (want(t.cards[0])) {
          n++;
          if (t.made[0]) made++;
        }
      });
    }
    return Math.round((100 * made) / Math.max(1, n));
  });
  console.log(label.padEnd(28), r.join('\t'), '\tslope', (r[0] / Math.max(1, r[4])).toFixed(2));
};
for (const id of ['N1', 'N2', 'N3'])
  for (const call of id === 'N3' ? ['safe', 'insane'] : ['safe', 'bold', 'insane'])
    row(`${id} ${call}`, { S01: 'safe', [id]: 'bold', I18: 'insane' }, `call:${call}` as Persona, (c) => c === id);
for (const id of ['S26', 'F04']) row(id, { [id]: 'safe', B16: 'bold', I18: 'insane' }, 'fixed0', (c) => c === id);
