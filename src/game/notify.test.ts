import { describe, expect, it } from 'vitest';
import { applyAction, createGame, entryKey, getCard, makeHoles, notesFor, type Action, type Game } from './index';

const HOST = 'host-device-1';
const GUEST = 'guest-device-2';

function act(game: Game, action: Action, device = HOST): { game: Game; notes: ReturnType<typeof notesFor> } {
  const r = applyAction(game, action, { deviceId: device, now: 1_000, rng: () => 0.5 });
  if (!r.ok) throw new Error(r.error);
  return { game: r.game, notes: notesFor(game, r.game, action, device) };
}

/** An online game: Sam hosts, Gus joined on his own phone. Both have cards on hole 1 (par 4). */
function onlineGame(): Game {
  let g = createGame({
    id: 'game000001',
    hostDeviceId: HOST,
    now: 0,
    course: 'Pine Hollow',
    players: [{ id: 'player0sam', name: 'Sam' }],
    holes: makeHoles(3).map((h) => ({ ...h, par: 4 as const })),
  });
  g.code = 'BCDFG';
  g = act(g, { type: 'addPlayer', id: 'player0gus', name: 'Gus', claim: true }, GUEST).game;
  for (const [id, card] of [['player0sam', 'S01'], ['player0gus', 'B03']] as const) {
    g.entries[entryKey(id, 0)] = { tier: getCard(card)!.tier, cardId: card, pickedBy: HOST };
  }
  return g;
}

describe('push notifications', () => {
  it("tells everyone but the host when the round starts", () => {
    const { notes } = act(onlineGame(), { type: 'start' });
    expect(notes).toEqual([{ devices: [GUEST], title: 'Pine Hollow', body: 'Sam started the round. Pick your risk for hole 1.' }]);
  });

  it('says results are in only when the last score of the hole lands, to the others', () => {
    let { game, notes } = act(onlineGame(), { type: 'start' });
    ({ game, notes } = act(game, { type: 'score', playerId: 'player0sam', hole: 0, strokes: 5 }));
    expect(notes).toEqual([]);
    ({ game, notes } = act(game, { type: 'score', playerId: 'player0gus', hole: 0, strokes: 4, outcome: 'missed' }, GUEST));
    expect(notes.map((n) => n.body)).toEqual(['Hole 1 results are in. See who moved up.']);
    expect(notes[0].devices).toEqual([HOST]);
  });

  it('asks the other players to vote on a claim judged by eye', () => {
    const { game } = act(onlineGame(), { type: 'start' });
    const { notes } = act(game, { type: 'score', playerId: 'player0gus', hole: 0, strokes: 4, outcome: 'made' }, GUEST);
    expect(notes).toContainEqual({ devices: [HOST], title: 'Pine Hollow', body: 'Gus says they made "The Long Drive". Do you agree? Vote now.' });
  });

  it('tells the approver about a score fix request', () => {
    let { game } = act(onlineGame(), { type: 'start' });
    game = act(game, { type: 'score', playerId: 'player0sam', hole: 0, strokes: 5 }).game;
    game = act(game, { type: 'score', playerId: 'player0gus', hole: 0, strokes: 4, outcome: 'missed' }, GUEST).game;
    game = act(game, { type: 'nextHole', from: 0 }).game;
    const { notes } = act(game, { type: 'requestFix', id: 'fix0000001', playerId: 'player0gus', hole: 0, strokes: 3, outcome: 'missed' }, GUEST);
    expect(notes).toEqual([{ devices: [HOST], title: 'Pine Hollow', body: 'Gus wants to change their score on hole 1.' }]);
  });

  it('never notifies in a one-phone game', () => {
    const g = createGame({ id: 'game000002', hostDeviceId: HOST, now: 0, players: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }], holes: makeHoles(3) });
    expect(notesFor(g, { ...g, status: 'playing' }, { type: 'start' }, HOST)).toEqual([]);
  });
});
