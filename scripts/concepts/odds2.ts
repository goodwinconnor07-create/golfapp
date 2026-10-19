// Completion odds for the round-2 card ideas, by handicap (player 0 holds the card every hole).
import { BASE, BASE_DECK, buildBank, CARD_TITLES, mulberry32, playRound } from './engine';
buildBank(5000);
const IDS = (
  process.argv[2] ??
  'F01,F02,F03,T01,T02,T03,T04,T05,T06,S20,S21,S22,S23,S24,S25,C01,C02,C03,G01,G02,G03,G04,G05,M01,M02,M03,M04,M05,K01,K02,K03,K04,K05,K06,P01,P02,I18,B16'
).split(',');
const rng = mulberry32(3);
const HS = [8, 14, 20, 26, 32];
for (const id of IDS) {
  const deck: Record<string, string> = { ...BASE_DECK };
  for (const k of Object.keys(deck)) if (deck[k] === 'insane') delete deck[k];
  deck[id] = 'insane';
  const c = {
    ...BASE,
    name: 'odds' + id,
    deck,
    double: false,
    values: { safe: [0, 0], bold: [0, 0], insane: [-1, 0] } as Record<string, [number, number]>,
  };
  // Hot Hand: the next two holes are played with whatever the player picks; model the easy route (Safe).
  const plan = id === 'M02' ? 'hotHand' : 'fixed2';
  const row = HS.map((h) => {
    let made = 0,
      holes = 0;
    for (let r = 0; r < 300; r++) {
      const out = playRound(c, [h, h, h, h], [plan as 'fixed2', 'fixed1', 'fixed1', 'fixed1'], 18, rng);
      const eligible = out.traces.filter((t) => t.cards[0] === id).length;
      made += out.g.golf[0] - out.g.tot[0];
      holes += eligible;
    }
    return made / holes;
  });
  console.log([id, CARD_TITLES[id] ?? id, ...row.map((x) => Math.round(100 * x)), (row[0] / Math.max(0.01, row[4])).toFixed(2)].join('\t'));
}
