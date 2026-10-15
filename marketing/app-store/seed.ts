import { applyAction, createGame, makeHoles, type Action, type Game, type Tier, type Outcome } from '../../src/game/index';
import { writeFileSync } from 'node:fs';

let s = 7;
const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const dev = 'DEVICE_PLACEHOLDER';
let now = Date.UTC(2026, 9, 11, 15, 0);
const ctx = () => ({ deviceId: dev, now: (now += 60000), rng });

function act(g: Game, a: Action): Game {
  const r = applyAction(g, a, ctx());
  if (!r.ok) throw new Error(`${a.type}: ${r.error}`);
  return r.game;
}

const players = [
  { id: 'maya000001', name: 'Maya', emoji: '🦈', color: 0 },
  { id: 'jake000001', name: 'Jake', emoji: '🔥', color: 1 },
  { id: 'priya00001', name: 'Priya', emoji: '😎', color: 4 },
  { id: 'leo0000001', name: 'Leo', emoji: '🐐', color: 6 },
];
const PARS = [4, 5, 3, 4, 4, 4, 5, 4, 4] as const;

// Per hole: [tier, strokes, outcome] for each player in order.
type Plan = [Tier, number, Outcome][];
const ROUND: Plan[] = [
  [['bold', 5, 'missed'], ['safe', 4, 'made'], ['insane', 4, 'made'], ['safe', 5, 'made']],
  [['safe', 5, 'made'], ['bold', 6, 'made'], ['safe', 6, 'missed'], ['insane', 7, 'missed']],
  [['insane', 3, 'made'], ['safe', 4, 'made'], ['bold', 3, 'missed'], ['safe', 3, 'made']],
  [['bold', 4, 'made'], ['insane', 6, 'missed'], ['safe', 5, 'made'], ['bold', 5, 'made']],
  [['safe', 4, 'made'], ['bold', 4, 'made'], ['bold', 5, 'missed'], ['safe', 6, 'missed']],
  [['bold', 4, 'made'], ['safe', 4, 'made'], ['insane', 5, 'missed'], ['bold', 5, 'made']],
  [['insane', 4, 'made'], ['bold', 5, 'made'], ['safe', 5, 'made'], ['safe', 6, 'made']],
  [['bold', 5, 'missed'], ['safe', 4, 'made'], ['bold', 4, 'made'], ['insane', 5, 'missed']],
  [['safe', 4, 'made'], ['bold', 5, 'missed'], ['insane', 3, 'made'], ['safe', 4, 'made']],
];

function play(holes: number, finish: boolean): Game {
  let g = createGame({ id: 'mktg' + holes + 'xxxxxxx'.slice(0, 7), hostDeviceId: dev, now, players, holes: makeHoles(9), course: 'Pine Hollow', settings: { situationCards: true } });
  PARS.forEach((par, hole) => (g = act(g, { type: 'setPar', hole, par })));
  g = act(g, { type: 'start' });
  for (let h = 0; h < holes; h++) {
    ROUND[h].forEach(([tier], i) => (g = act(g, { type: 'pick', playerId: players[i].id, hole: h, tier })));
    ROUND[h].forEach(([, strokes, outcome], i) => {
      const r = applyAction(g, { type: 'score', playerId: players[i].id, hole: h, strokes, outcome }, ctx());
      g = r.ok ? r.game : act(g, { type: 'score', playerId: players[i].id, hole: h, strokes });
    });
    if (h < 8) g = act(g, { type: 'nextHole', from: h });
  }
  if (finish) g = act(g, { type: 'finish' });
  return g;
}

writeFileSync(new URL('./seed/' + 'midround.json', import.meta.url), JSON.stringify(play(5, false)));
writeFileSync(new URL('./seed/' + 'last.json', import.meta.url), JSON.stringify(play(9, false)));
console.log('ok');
