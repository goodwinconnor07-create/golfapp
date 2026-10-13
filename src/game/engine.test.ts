import { describe, expect, it } from 'vitest';
import {
  applyAction,
  CARDS,
  createGame,
  eligibleCards,
  entryKey,
  getCard,
  holeResult,
  formatToPar,
  toParWords,
  judgeFromStrokes,
  makeHoles,
  parseAction,
  recap,
  redactForDevice,
  sanitizeUpload,
  standings,
  TIER_ORDER,
  type Action,
  type ActionContext,
  type Game,
  type Par,
  type Settings,
  type Tier,
} from './index';

const HOST = 'host-device-1';
const OTHER = 'other-device-2';

/** Seeded RNG so draws are repeatable. */
function seeded(seed = 42): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function ctx(deviceId = HOST, rng = seeded()): ActionContext {
  return { deviceId, now: 1_000, rng };
}

function run(game: Game, action: Action, c: ActionContext = ctx()): Game {
  const r = applyAction(game, action, c);
  if (!r.ok) throw new Error(r.error);
  return r.game;
}

function newGame(names = ['Sam', 'Alex'], pars: Par[] = [4, 4, 4]): Game {
  const holes = makeHoles(pars.length).map((h, i) => ({ ...h, par: pars[i] }));
  return createGame({
    id: 'game000001',
    hostDeviceId: HOST,
    now: 0,
    players: names.map((name, i) => ({ id: `player0${i}`, name })),
    holes,
  });
}

/** Puts a specific card on a player's entry, as if it had been drawn. */
function giveCard(game: Game, playerId: string, hole: number, cardId: string): Game {
  const g = structuredClone(game);
  const card = getCard(cardId)!;
  g.entries[entryKey(playerId, hole)] = { tier: card.tier, cardId, pickedBy: HOST };
  return g;
}

describe('catalogue', () => {
  it('has 15 cards per tier with unique stable ids', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    for (const tier of TIER_ORDER) expect(CARDS.filter((c) => c.tier === tier)).toHaveLength(15);
    for (const c of CARDS) {
      expect(c.title.trim()).not.toBe('');
      expect(c.pass.trim()).not.toBe('');
      expect(c.pars.length).toBeGreaterThan(0);
    }
  });

  it('always has at least two cards for every tier, par and option combination', () => {
    for (const distanceCards of [true, false]) {
      for (const situationCards of [true, false]) {
        const settings: Settings = { distanceCards, situationCards, tiebreakOnStrokes: false };
        for (const tier of TIER_ORDER) {
          for (const par of [3, 4, 5] as Par[]) {
            expect(eligibleCards(tier, par, settings).length, `${tier} par ${par}`).toBeGreaterThanOrEqual(2);
          }
        }
      }
    }
  });
});

describe('scoring (spec section 12)', () => {
  const cases: [Tier, 'made' | 'missed', number][] = [
    ['safe', 'made', 3],
    ['safe', 'missed', 6],
    ['bold', 'made', 1],
    ['bold', 'missed', 7],
    ['insane', 'made', -1],
    ['insane', 'missed', 8],
  ];
  // Cards the player has to call (not judged from strokes), one per tier.
  const manualCard: Record<Tier, string> = { safe: 'S02', bold: 'B05', insane: 'I09' };

  for (const [tier, outcome, expected] of cases) {
    it(`${tier} ${outcome} with 5 actual strokes gives ${expected}`, () => {
      const pars: Par[] = [5];
      let g = run(newGame(['Sam'], pars), { type: 'start' });
      g = giveCard(g, 'player00', 0, manualCard[tier]);
      g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome });
      const r = holeResult(g, 'player00', 0)!;
      expect(r.gameScore).toBe(expected);
      // Actual-score integrity: real strokes are never rewritten.
      expect(r.strokes).toBe(5);
      expect(g.entries[entryKey('player00', 0)].strokes).toBe(5);
    });
  }

  it("scores against par like the product owner's example: +2 then -7 is 5 under", () => {
    let g = run(newGame(['Sam'], [5, 4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'S02'); // Safe
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 9, outcome: 'made' }); // 9 - 2 = 7 on a par 5
    expect(holeResult(g, 'player00', 0)!.toPar).toBe(2);
    g = run(g, { type: 'nextHole', from: 0 });
    g = giveCard(g, 'player00', 1, 'I12'); // Insane: The Clean Birdie
    g = run(g, { type: 'score', playerId: 'player00', hole: 1, strokes: 3, outcome: 'made' }); // 3 - 6 = -3 on a par 4
    expect(holeResult(g, 'player00', 1)!.toPar).toBe(-7);
    expect(standings(g)[0].totals.toPar).toBe(-5);
    expect(formatToPar(-5)).toBe('\u22125');
    expect(toParWords(-5)).toBe('5 under');
    expect(formatToPar(0)).toBe('E');
  });

  it('does not clamp negative game scores', () => {
    let g = run(newGame(['Sam'], [3]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'I01'); // Birdie Time
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 2 });
    expect(holeResult(g, 'player00', 0)!.gameScore).toBe(-4);
  });

  it('recalculates totals when strokes are corrected', () => {
    let g = run(newGame(['Sam'], [4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'B05');
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome: 'made' });
    expect(standings(g)[0].totals).toMatchObject({ real: 5, game: 1 });
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 6, outcome: 'made' });
    expect(standings(g)[0].totals).toMatchObject({ real: 6, game: 2 });
  });

  it('judges strokes-only cards automatically', () => {
    let g = run(newGame(['Sam'], [4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'B01'); // Par Hunter
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 4 });
    expect(holeResult(g, 'player00', 0)!.outcome).toBe('made');
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome: 'made' });
    expect(holeResult(g, 'player00', 0)!.outcome).toBe('missed');
  });

  it('rules out mixed cards over the limit but leaves the rest to the player', () => {
    let g = run(newGame(['Sam'], [4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'B10'); // The Clean Par
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome: 'made' });
    expect(holeResult(g, 'player00', 0)!.outcome).toBe('missed');
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 4, outcome: 'made' });
    expect(holeResult(g, 'player00', 0)!.outcome).toBe('made');
  });

  it('completes reach-the-green cards when the strokes prove it, and offers no fail', () => {
    let g = run(newGame(['Sam'], [4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'B05'); // Green in Regulation: green in par minus 1
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 3, outcome: 'missed' });
    expect(holeResult(g, 'player00', 0)!.outcome).toBe('made');
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome: 'missed' });
    expect(holeResult(g, 'player00', 0)!.outcome).toBe('missed');
    expect(judgeFromStrokes(getCard('B05')!, 4, 5)).toBeNull();
    expect(judgeFromStrokes(getCard('B01')!, 4, 4)).toBe('made'); // Par Hunter at par
    expect(judgeFromStrokes(getCard('B01')!, 4, 5)).toBe('missed');
  });

  it("gives no change when a situational card's situation never happens", () => {
    let g = newGame(['Sam'], [4]);
    g = run(g, { type: 'setSettings', settings: { situationCards: true } });
    g = run(g, { type: 'start' });
    g = giveCard(g, 'player00', 0, 'I06'); // The Sand Save
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 6, outcome: 'na' });
    expect(holeResult(g, 'player00', 0)).toMatchObject({ outcome: 'na', adjustment: 0, gameScore: 6 });
  });

  it("rejects 'didn't happen' on a normal card", () => {
    let g = run(newGame(['Sam'], [4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'S02');
    expect(applyAction(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 4, outcome: 'na' }, ctx()).ok).toBe(false);
  });
});

describe('dealing cards', () => {
  it("never deals a card that doesn't fit the hole's par", () => {
    for (const par of [3, 4, 5] as Par[]) {
      for (let seed = 1; seed <= 30; seed++) {
        const g = run(newGame(['Sam'], [par]), { type: 'start' });
        for (const tier of TIER_ORDER) {
          const after = run(g, { type: 'pick', playerId: 'player00', hole: 0, tier }, ctx(HOST, seeded(seed)));
          const card = getCard(after.entries[entryKey('player00', 0)].cardId)!;
          expect(card.pars).toContain(par);
          expect(card.tier).toBe(tier);
        }
      }
    }
  });

  it('never deals a switched-off card', () => {
    const off = CARDS.filter((c) => !c.enabled).map((c) => c.id);
    expect(off).toEqual(['S14', 'B15']);
    const pars = Array.from({ length: 18 }, () => 5 as Par);
    let g = run(newGame(['Sam', 'Alex'], pars), { type: 'start' });
    const rng = seeded(11);
    for (let h = 0; h < pars.length; h++) {
      g = run(g, { type: 'pick', playerId: 'player00', hole: h, tier: 'safe' }, ctx(HOST, rng));
      g = run(g, { type: 'pick', playerId: 'player01', hole: h, tier: 'bold' }, ctx(HOST, rng));
      for (const p of g.players) {
        expect(off).not.toContain(g.entries[entryKey(p.id, h)].cardId);
        g = run(g, { type: 'score', playerId: p.id, hole: h, strokes: 5, outcome: 'missed' });
      }
      if (h < pars.length - 1) g = run(g, { type: 'nextHole', from: h });
    }
  });

  it('gives players on the same hole different cards', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F'];
    let g = run(newGame(names, [4]), { type: 'start' });
    const rng = seeded(7);
    for (const p of g.players) g = run(g, { type: 'pick', playerId: p.id, hole: 0, tier: 'bold' }, ctx(HOST, rng));
    const ids = g.players.map((p) => g.entries[entryKey(p.id, 0)].cardId);
    expect(new Set(ids).size).toBe(names.length);
  });

  it("doesn't repeat a card until the deck runs out", () => {
    const pars = Array.from({ length: 15 }, () => 4 as Par);
    let g = run(newGame(['Sam'], pars), { type: 'start' });
    const rng = seeded(3);
    const seen: string[] = [];
    const pool = eligibleCards('safe', 4, g.settings).length;
    for (let h = 0; h < pool; h++) {
      g = run(g, { type: 'pick', playerId: 'player00', hole: h, tier: 'safe' }, ctx(HOST, rng));
      const e = g.entries[entryKey('player00', h)];
      seen.push(e.cardId!);
      g = run(g, { type: 'score', playerId: 'player00', hole: h, strokes: 4, outcome: 'made' });
      g = run(g, { type: 'nextHole', from: h });
    }
    expect(new Set(seen).size).toBe(pool);
  });

  it('locks a pick in: picking again changes nothing', () => {
    let g = run(newGame(['Sam'], [4]), { type: 'start' });
    g = run(g, { type: 'pick', playerId: 'player00', hole: 0, tier: 'safe' });
    const before = g.entries[entryKey('player00', 0)];
    const r = applyAction(g, { type: 'pick', playerId: 'player00', hole: 0, tier: 'insane' }, ctx());
    expect(r.ok && !r.changed).toBe(true);
    expect(r.ok && r.game.entries[entryKey('player00', 0)]).toEqual(before);
  });

  it('needs a par before dealing', () => {
    const g = run(
      createGame({ id: 'game000002', hostDeviceId: HOST, now: 0, players: [{ id: 'player00', name: 'Sam' }], holes: makeHoles(9) }),
      { type: 'start' },
    );
    expect(applyAction(g, { type: 'pick', playerId: 'player00', hole: 0, tier: 'safe' }, ctx()).ok).toBe(false);
  });

  it('only lets bunker cards be swapped, and never for another bunker card', () => {
    let g = run(newGame(['Sam'], [4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'S10'); // No Bunker Visit
    g = run(g, { type: 'swap', playerId: 'player00', hole: 0 });
    const card = getCard(g.entries[entryKey('player00', 0)].cardId)!;
    expect(card.id).not.toBe('S10');
    expect(card.needsBunker).toBeFalsy();
    expect(card.tier).toBe('safe');
    expect(applyAction(g, { type: 'swap', playerId: 'player00', hole: 0 }, ctx()).ok).toBe(false);
  });

  it('leaves the card to the server when predicting', () => {
    let g = run(newGame(['Sam'], [4]), { type: 'start' });
    g = run(g, { type: 'pick', playerId: 'player00', hole: 0, tier: 'bold' }, { ...ctx(), predict: true });
    expect(g.entries[entryKey('player00', 0)]).toMatchObject({ tier: 'bold' });
    expect(g.entries[entryKey('player00', 0)].cardId).toBeUndefined();
  });
});

describe('round flow', () => {
  function playHole(g: Game, hole: number, strokes: number[]): Game {
    g.players.forEach((p) => {
      g = run(g, { type: 'pick', playerId: p.id, hole, tier: 'bold' });
    });
    g.players.forEach((p, i) => {
      g = run(g, { type: 'score', playerId: p.id, hole, strokes: strokes[i], outcome: 'missed' });
    });
    return g;
  }

  it('only moves on when the hole is complete, and only once', () => {
    let g = run(newGame(['Sam', 'Alex'], [4, 4]), { type: 'start' });
    expect(applyAction(g, { type: 'nextHole', from: 0 }, ctx()).ok).toBe(false);
    g = playHole(g, 0, [4, 5]);
    g = run(g, { type: 'nextHole', from: 0 });
    expect(g.current).toBe(1);
    const again = applyAction(g, { type: 'nextHole', from: 0 }, ctx(OTHER));
    expect(again.ok && !again.changed && again.game.current).toBe(1);
    g = playHole(g, 1, [4, 4]);
    g = run(g, { type: 'nextHole', from: 1 });
    expect(g.status).toBe('finished');
  });

  it('shares ranks on ties unless the strokes tiebreak is on', () => {
    let g = run(newGame(['Sam', 'Alex'], [4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'S02');
    g = giveCard(g, 'player01', 0, 'B05');
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome: 'made' }); // 5 - 2 = 3
    g = run(g, { type: 'score', playerId: 'player01', hole: 0, strokes: 7, outcome: 'made' }); // 7 - 4 = 3
    expect(standings(g).map((r) => r.rank)).toEqual([1, 1]);
    g = run(g, { type: 'setSettings', settings: { tiebreakOnStrokes: true } });
    const rows = standings(g);
    expect(rows.map((r) => [r.player.name, r.rank])).toEqual([
      ['Sam', 1],
      ['Alex', 2],
    ]);
  });

  it('only lets the host do host things', () => {
    const g = newGame();
    expect(applyAction(g, { type: 'start' }, ctx(OTHER)).ok).toBe(false);
    expect(applyAction(g, { type: 'removePlayer', playerId: 'player01' }, ctx(OTHER)).ok).toBe(false);
    expect(applyAction(g, { type: 'addPlayer', id: 'player09', name: 'Guest' }, ctx(OTHER)).ok).toBe(false);
    expect(applyAction(g, { type: 'addPlayer', id: 'player09', name: 'Me', claim: true }, ctx(OTHER)).ok).toBe(true);
  });

  it('closes new sign-ups once the first hole is done', () => {
    let g = run(newGame(['Sam'], [4, 4]), { type: 'start' });
    g = run(g, { type: 'addPlayer', id: 'player05', name: 'Late', claim: true }, ctx(OTHER));
    g = playHole(g, 0, [4, 4]);
    expect(applyAction(g, { type: 'addPlayer', id: 'player06', name: 'Later', claim: true }, ctx(OTHER)).ok).toBe(false);
  });

  it('builds a recap with both leaderboards', () => {
    let g = run(newGame(['Sam', 'Alex'], [4, 4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'I09');
    g = giveCard(g, 'player01', 0, 'S02');
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 6, outcome: 'missed' });
    g = run(g, { type: 'score', playerId: 'player01', hole: 0, strokes: 4, outcome: 'made' });
    g = run(g, { type: 'nextHole', from: 0 });
    g = giveCard(g, 'player00', 1, 'I01');
    g = giveCard(g, 'player01', 1, 'S02');
    g = run(g, { type: 'score', playerId: 'player00', hole: 1, strokes: 3 });
    g = run(g, { type: 'score', playerId: 'player01', hole: 1, strokes: 5, outcome: 'missed' });
    g = run(g, { type: 'nextHole', from: 1 });
    const r = recap(g);
    expect(r.holesPlayed).toBe(2);
    // Sam: (6+3) + (3-6) = 6. Alex: (4-2) + (5+1) = 8.
    expect(r.winners.map((w) => w.player.name)).toEqual(['Sam']);
    expect(r.byReal[0].player.name).toBe('Sam');
    expect(r.awards.map((a) => a.id)).toContain('comeback');
    expect(r.highlights).toHaveLength(1);
  });
});

describe('online safety', () => {
  it("hides other devices' picks until everyone has picked", () => {
    let g = run(newGame(['Sam', 'Alex'], [4]), { type: 'start' });
    g = run(g, { type: 'claimPlayer', playerId: 'player01' }, ctx(OTHER));
    g = run(g, { type: 'pick', playerId: 'player00', hole: 0, tier: 'insane' });
    const otherView = redactForDevice(g, OTHER);
    expect(otherView.entries[entryKey('player00', 0)]).toEqual({ hidden: true });
    expect(otherView.decks).toBeUndefined();
    // Device ids work like passwords on the server, so other phones never see them.
    expect(JSON.stringify(otherView)).not.toContain(HOST);
    expect(otherView.players.map((p) => p.deviceId)).toEqual(['~host', OTHER]);
    expect(otherView.hostDeviceId).toBe('~host');
    expect(redactForDevice(g, HOST).entries[entryKey('player00', 0)].tier).toBe('insane');
    g = run(g, { type: 'pick', playerId: 'player01', hole: 0, tier: 'safe' }, ctx(OTHER));
    expect(redactForDevice(g, OTHER).entries[entryKey('player00', 0)].tier).toBe('insane');
  });

  it('rejects malformed actions', () => {
    expect(parseAction(null)).toBeNull();
    expect(parseAction({ type: 'score', playerId: 'player00', hole: 0, strokes: 0 })).toBeNull();
    expect(parseAction({ type: 'score', playerId: 'player00', hole: 0, strokes: 4.5 })).toBeNull();
    expect(parseAction({ type: 'pick', playerId: 'player00', hole: 0, tier: 'legendary' })).toBeNull();
    expect(parseAction({ type: 'setPar', hole: 0, par: 6 })).toBeNull();
    expect(parseAction({ type: 'hack' })).toBeNull();
    expect(parseAction({ type: 'pick', playerId: 'player00', hole: 0, tier: 'bold', extra: 1 })).toEqual({
      type: 'pick',
      playerId: 'player00',
      hole: 0,
      tier: 'bold',
    });
  });

  it('cleans an uploaded game and makes the uploader the host', () => {
    let g = run(newGame(['Sam', 'Alex'], [4, 4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'S02');
    const upload = structuredClone(g) as unknown as Record<string, unknown>;
    (upload.entries as Record<string, unknown>)['player01:0'] = { tier: 'safe', cardId: 'I01' }; // tier mismatch
    (upload.entries as Record<string, unknown>)['ghost:0'] = { tier: 'safe', cardId: 'S02' };
    const clean = sanitizeUpload(upload, OTHER, 5_000, seeded())!;
    expect(clean.hostDeviceId).toBe(OTHER);
    expect(Object.keys(clean.entries)).toEqual(['player00:0']);
    expect(clean.decks?.safe).not.toContain('S02');
    expect(sanitizeUpload({ holes: [], players: [] }, OTHER, 5_000, seeded())).toBeNull();
    expect(sanitizeUpload(upload, 'bad id!', 5_000, seeded())).toBeNull();
  });
});
