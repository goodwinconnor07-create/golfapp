import { describe, expect, it } from 'vitest';
import {
  applyAction,
  CARDS,
  freePassAvailable,
  gapText,
  newLeader,
  overtakes,
  skins,
  playerScored,
  mateOf,
  teamOf,
  units,
  cardStakes,
  halves,
  rankMoves,
  createGame,
  eligibleCards,
  entryKey,
  getEntry,
  mulliganAllowance,
  mulligansLeft,
  getCard,
  holeResult,
  holeStatus,
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
  it('has unique stable ids and the deck v2 sizes (docs/GAME_BALANCE.md)', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
    const live = (tier: Tier) => CARDS.filter((c) => c.tier === tier && c.enabled).length;
    expect([live('safe'), live('bold'), live('insane')]).toEqual([8, 5, 7]);
    for (const c of CARDS) {
      expect(c.title.trim()).not.toBe('');
      expect(c.pass.trim()).not.toBe('');
      expect(c.pars.length).toBeGreaterThan(0);
    }
  });

  it('always has at least two cards for every tier, par and option combination', () => {
    for (const distanceCards of [true, false]) {
      for (const situationCards of [true, false]) {
        const settings: Settings = { distanceCards, situationCards, tiebreakOnStrokes: false, mulligans: true };
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
    ['safe', 'made', 4],
    ['safe', 'missed', 6],
    ['bold', 'made', 3],
    ['bold', 'missed', 7],
    ['insane', 'made', -4],
    ['insane', 'missed', 8],
  ];
  // Cards the player has to call (not judged from strokes), one per tier.
  const manualCard: Record<Tier, string> = { safe: 'S02', bold: 'B18', insane: 'I20' };

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

  it('scores against par: +3 then -10 is 7 under', () => {
    let g = run(newGame(['Sam'], [5, 4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'S02'); // Safe
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 9, outcome: 'made' }); // 9 - 1 = 8 on a par 5
    expect(holeResult(g, 'player00', 0)!.toPar).toBe(3);
    g = run(g, { type: 'nextHole', from: 0 });
    g = giveCard(g, 'player00', 1, 'I20'); // Insane: One and Done
    g = run(g, { type: 'score', playerId: 'player00', hole: 1, strokes: 3, outcome: 'made' }); // 3 - 9 = -6 on a par 4
    expect(holeResult(g, 'player00', 1)!.toPar).toBe(-10);
    expect(standings(g)[0].totals.toPar).toBe(-7);
    expect(formatToPar(-7)).toBe('\u22127');
    expect(toParWords(-7)).toBe('7 under');
    expect(formatToPar(0)).toBe('E');
  });

  it('does not clamp negative game scores', () => {
    let g = run(newGame(['Sam'], [3]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'I01'); // Birdie Time
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 2 });
    expect(holeResult(g, 'player00', 0)!.gameScore).toBe(-7);
  });

  it('recalculates totals when strokes are corrected', () => {
    let g = run(newGame(['Sam'], [4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'B05');
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome: 'made' });
    expect(standings(g)[0].totals).toMatchObject({ real: 5, game: 3 });
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 6, outcome: 'made' });
    expect(standings(g)[0].totals).toMatchObject({ real: 6, game: 4 });
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

describe('cards judged against your own last hole', () => {
  // B16 Hold the Line: match or beat last hole. I18 Bounce Back: beat it. I21 Big Improvement: beat it by 2.
  function twoHoles(card: string, first: number, second: number): Game {
    let g = run(newGame(['Sam'], [4, 4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'S02');
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: first, outcome: 'made' });
    g = run(g, { type: 'nextHole', from: 0 });
    g = giveCard(g, 'player00', 1, card);
    return run(g, { type: 'score', playerId: 'player00', hole: 1, strokes: second });
  }

  it('settles from strokes against the last hole, with no buttons to tap', () => {
    expect(holeResult(twoHoles('B16', 6, 6), 'player00', 1)?.outcome).toBe('made');
    expect(holeResult(twoHoles('B16', 5, 6), 'player00', 1)?.outcome).toBe('missed');
    expect(holeResult(twoHoles('I18', 6, 5), 'player00', 1)?.outcome).toBe('made');
    expect(holeResult(twoHoles('I18', 6, 6), 'player00', 1)?.outcome).toBe('missed');
    expect(holeResult(twoHoles('I21', 7, 5), 'player00', 1)?.outcome).toBe('made');
    expect(holeResult(twoHoles('I21', 7, 6), 'player00', 1)).toMatchObject({ outcome: 'missed', adjustment: 3 });
  });

  it('uses the first-hole target when there is no last hole', () => {
    let g = run(newGame(['Sam'], [4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'I18'); // first hole: bogey or better
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 5 });
    expect(holeResult(g, 'player00', 0)).toMatchObject({ outcome: 'made', adjustment: -9 });
  });

  it('re-judges when the last hole is corrected', () => {
    let g = twoHoles('I18', 6, 5);
    expect(holeResult(g, 'player00', 1)?.outcome).toBe('made');
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome: 'made' });
    expect(holeResult(g, 'player00', 1)?.outcome).toBe('missed');
  });

  it('caps a hole at 10 strokes, but saved games with more still load', () => {
    let g = run(newGame(['Sam'], [4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'S02');
    expect(applyAction(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 11, outcome: 'made' }, ctx()).ok).toBe(false);
    g.entries[entryKey('player00', 0)].strokes = 12;
    expect(sanitizeUpload(g, HOST, 5, seeded())!.entries[entryKey('player00', 0)].strokes).toBe(12);
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
    expect(off).toEqual(expect.arrayContaining(['S14', 'B15', 'S03', 'S15', 'B01', 'I01']));
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
    // Bold has 4 cards that fit a par 4 in deck v2.
    const names = ['A', 'B', 'C', 'D'];
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

  it('keeps a card the phone dealt offline when it fits', () => {
    let g = run(newGame(['Sam'], [4]), { type: 'start' });
    const pick: Action = { type: 'pick', playerId: 'player00', hole: 0, tier: 'bold', cardId: 'B16' };
    // The phone's own guess and the server agree on the card.
    const predicted = run(g, pick, { ...ctx(), predict: true });
    expect(predicted.entries[entryKey('player00', 0)].cardId).toBe('B16');
    g = run(g, pick);
    expect(g.entries[entryKey('player00', 0)].cardId).toBe('B16');
    expect(g.decks?.bold ?? []).not.toContain('B16');
  });

  it('deals another card when the offline card is taken or the wrong tier', () => {
    let g = run(newGame(['Sam', 'Alex'], [4]), { type: 'start' });
    g = run(g, { type: 'pick', playerId: 'player00', hole: 0, tier: 'bold', cardId: 'B16' });
    g = run(g, { type: 'pick', playerId: 'player01', hole: 0, tier: 'bold', cardId: 'B16' });
    const alex = getCard(g.entries[entryKey('player01', 0)].cardId)!;
    expect(alex.id).not.toBe('B16');
    expect(alex.tier).toBe('bold');

    let h = run(newGame(['Sam'], [4]), { type: 'start' });
    h = run(h, { type: 'pick', playerId: 'player00', hole: 0, tier: 'safe', cardId: 'B16' });
    expect(getCard(h.entries[entryKey('player00', 0)].cardId)!.tier).toBe('safe');
  });

  it('lets an offline swap bring its own card, but not another bunker card', () => {
    let g = run(newGame(['Sam'], [4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'S10');
    const bunker = CARDS.find((c) => c.tier === 'safe' && c.needsBunker && c.id !== 'S10');
    if (bunker) {
      const h = run(g, { type: 'swap', playerId: 'player00', hole: 0, cardId: bunker.id });
      expect(h.entries[entryKey('player00', 0)].cardId).not.toBe(bunker.id);
    }
    g = run(g, { type: 'swap', playerId: 'player00', hole: 0, cardId: 'S01' }, { ...ctx(), predict: true });
    expect(g.entries[entryKey('player00', 0)].cardId).toBe('S01');
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
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome: 'made' }); // 5 - 1 = 4
    g = run(g, { type: 'score', playerId: 'player01', hole: 0, strokes: 6, outcome: 'made' }); // 6 - 2 = 4
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

describe('double stakes, free shot, redraw and votes', () => {
  /** Sam and Alex on a round of `pars`, already on hole `at`, with earlier holes played. */
  function midRound(pars: Par[], at: number): Game {
    let g = run(newGame(['Sam', 'Alex'], pars), { type: 'start' });
    g = structuredClone(g);
    g.current = at;
    return g;
  }
  // B01 Par Hunter: par or better, settled by strokes alone.
  const parHunter = (g: Game, playerId: string, hole: number, strokes: number) =>
    run(giveCard(g, playerId, hole, 'B01'), { type: 'score', playerId, hole, strokes });

  it('doubles the stakes on the last 3 holes of a round of 6 or more', () => {
    let g = midRound([4, 4, 4, 4, 4, 4], 5);
    g = parHunter(g, 'player00', 5, 4);
    expect(holeResult(g, 'player00', 5)).toMatchObject({ adjustment: -4, doubled: true, toPar: -4 });
    g = parHunter(g, 'player01', 5, 5);
    expect(holeResult(g, 'player01', 5)).toMatchObject({ adjustment: 4, doubled: true });

    let early = midRound([4, 4, 4, 4, 4, 4], 2);
    early = parHunter(early, 'player00', 2, 4);
    expect(holeResult(early, 'player00', 2)).toMatchObject({ adjustment: -2, doubled: false });

    // Short rounds stay at normal stakes.
    let short = midRound([4, 4, 4], 2);
    short = parHunter(short, 'player00', 2, 4);
    expect(holeResult(short, 'player00', 2)?.adjustment).toBe(-2);
  });

  it('offers no free shot (same rules for everyone), but old free shots still score', () => {
    let g = midRound([4, 4, 4], 0);
    g = parHunter(g, 'player00', 0, 4); // Sam makes it
    g = parHunter(g, 'player01', 0, 5); // Alex fails, so is last
    g = run(g, { type: 'nextHole', from: 0 });
    expect(freePassAvailable(g, 'player01')).toBe(false);
    expect(applyAction(g, { type: 'pick', playerId: 'player01', hole: 1, tier: 'insane', freePass: true }, ctx()).ok).toBe(false);

    // A saved game from before the change: the failed free shot still costs nothing.
    g = structuredClone(g);
    g.entries[entryKey('player01', 1)] = { tier: 'insane', cardId: 'I01', pickedBy: HOST, freePass: true };
    g = run(g, { type: 'score', playerId: 'player01', hole: 1, strokes: 6, outcome: 'missed' });
    expect(holeResult(g, 'player01', 1)).toMatchObject({ outcome: 'missed', adjustment: 0, freePass: true });
  });

  it('allows one redraw per player per round, from the same tier', () => {
    let g = run(newGame(['Sam'], [4, 4]), { type: 'start' });
    g = run(g, { type: 'pick', playerId: 'player00', hole: 0, tier: 'bold' });
    const first = g.entries[entryKey('player00', 0)].cardId;
    g = run(g, { type: 'redraw', playerId: 'player00', hole: 0 });
    const second = getCard(g.entries[entryKey('player00', 0)].cardId)!;
    expect(second.id).not.toBe(first);
    expect(second.tier).toBe('bold');
    expect(applyAction(g, { type: 'redraw', playerId: 'player00', hole: 0 }, ctx()).ok).toBe(false);
  });

  it('lets the group vote down an honour-system claim', () => {
    let g = midRound([4, 4, 4], 0);
    g = run(g, { type: 'claimPlayer', playerId: 'player01' }, ctx(OTHER));
    g = giveCard(g, 'player01', 0, 'B02'); // Pin Pointer, judged by eye
    g = run(g, { type: 'score', playerId: 'player01', hole: 0, strokes: 4, outcome: 'made' }, ctx(OTHER));
    expect(holeResult(g, 'player01', 0)?.outcome).toBe('made');

    // Alex can't vote on their own claim, and Sam can't vote as Alex.
    expect(applyAction(g, { type: 'vote', playerId: 'player01', hole: 0, voterId: 'player01', fair: true }, ctx(OTHER)).ok).toBe(false);
    expect(applyAction(g, { type: 'vote', playerId: 'player01', hole: 0, voterId: 'player01', fair: true }, ctx(HOST)).ok).toBe(false);

    g = run(g, { type: 'vote', playerId: 'player01', hole: 0, voterId: 'player00', fair: false });
    const r = holeResult(g, 'player01', 0)!;
    expect(r.outcome).toBe('missed');
    expect(r.adjustment).toBe(2);
    // Strokes are never touched.
    expect(r.strokes).toBe(4);

    // Changing your mind puts it back.
    g = run(g, { type: 'vote', playerId: 'player01', hole: 0, voterId: 'player00', fair: true });
    expect(holeResult(g, 'player01', 0)?.outcome).toBe('made');
  });

  it('parses the new actions and keeps their fields on upload', () => {
    expect(parseAction({ type: 'pick', playerId: 'player00', hole: 0, tier: 'bold', freePass: true })).toMatchObject({ freePass: true });
    expect(parseAction({ type: 'redraw', playerId: 'player00', hole: 0 })).toEqual({ type: 'redraw', playerId: 'player00', hole: 0 });
    expect(parseAction({ type: 'vote', playerId: 'player00', hole: 0, voterId: 'player01', fair: 'yes' })).toBeNull();
    const g = giveCard(newGame(), 'player01', 0, 'B02');
    g.entries[entryKey('player01', 0)].votes = { player00: false, nobody99: true };
    g.entries[entryKey('player01', 0)].redrawn = true;
    const up = sanitizeUpload(g, HOST, 5, seeded())!;
    expect(up.entries[entryKey('player01', 0)]).toMatchObject({ votes: { player00: false }, redrawn: true });
  });

  it('tracks rank moves, lead changes and the gap to the leader', () => {
    let g = midRound([4, 4, 4], 0);
    g = parHunter(g, 'player00', 0, 4);
    g = parHunter(g, 'player01', 0, 5);
    g = run(g, { type: 'nextHole', from: 0 });
    expect(gapText(g, 'player01')).toBe("You're 5 strokes behind Sam");
    expect(gapText(g, 'player00')).toBe('You lead Alex by 5 strokes');
    // Alex makes an Insane card, Sam fails: Alex takes the lead.
    g = structuredClone(g);
    g.entries[entryKey('player01', 1)] = { tier: 'insane', cardId: 'I01', pickedBy: HOST };
    g = run(g, { type: 'score', playerId: 'player01', hole: 1, strokes: 3, outcome: 'made' });
    g = parHunter(g, 'player00', 1, 6);
    expect(rankMoves(g)).toEqual({ player00: -1, player01: 1 });
    expect(newLeader(g, 1)?.name).toBe('Alex');
  });
});

describe('hole done', () => {
  it('tracks each player from playing to done to scored', () => {
    let g = run(newGame(['Sam', 'Alex'], [4, 4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'B01');
    g = giveCard(g, 'player01', 0, 'B01');
    expect(holeStatus(g, 'player00', 0)).toBe('playing');
    g = run(g, { type: 'holeDone', playerId: 'player00', hole: 0 });
    expect(holeStatus(g, 'player00', 0)).toBe('done');
    expect(applyAction(g, { type: 'holeDone', playerId: 'player00', hole: 0 }, ctx())).toMatchObject({ ok: true, changed: false });
    g = run(g, { type: 'score', playerId: 'player01', hole: 0, strokes: 4 });
    // Scoring counts as done too.
    expect(holeStatus(g, 'player01', 0)).toBe('scored');
    expect(g.entries[entryKey('player01', 0)].done).toBe(true);
    expect(parseAction({ type: 'holeDone', playerId: 'player00', hole: 0 })).toEqual({ type: 'holeDone', playerId: 'player00', hole: 0 });
  });
  it('takes back "Hole done" until a score is in', () => {
    let g = run(newGame(['Sam', 'Alex'], [4, 4]), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'B01');
    g = run(g, { type: 'holeDone', playerId: 'player00', hole: 0 });
    g = run(g, { type: 'holeDone', playerId: 'player00', hole: 0, undo: true });
    expect(holeStatus(g, 'player00', 0)).toBe('playing');
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 4 });
    expect(applyAction(g, { type: 'holeDone', playerId: 'player00', hole: 0, undo: true }, ctx()).ok).toBe(false);
    expect(parseAction({ type: 'holeDone', playerId: 'player00', hole: 0, undo: true })).toEqual({
      type: 'holeDone',
      playerId: 'player00',
      hole: 0,
      undo: true,
    });
    expect(parseAction({ type: 'holeDone', playerId: 'player00', hole: 0, undo: 'yes' })).toBeNull();
  });
});

describe('acting for other players (online)', () => {
  // Sam is the host; Alex and Jo are on their own phones.
  const JO = 'jo-device-3';
  function online(): Game {
    let g = newGame(['Sam', 'Alex', 'Jo']);
    const devices = [HOST, OTHER, JO];
    g = { ...g, code: 'ABCDE', players: g.players.map((p, i) => ({ ...p, deviceId: devices[i] })) };
    return run(g, { type: 'start' });
  }

  it("lets only the host pick a friend's level", () => {
    const g = online();
    const guest = applyAction(g, { type: 'pick', playerId: 'player02', hole: 0, tier: 'insane' }, ctx(OTHER));
    expect(guest.ok).toBe(false);
    expect(applyAction(g, { type: 'pick', playerId: 'player01', hole: 0, tier: 'safe' }, ctx(OTHER)).ok).toBe(true);
    expect(applyAction(g, { type: 'pick', playerId: 'player02', hole: 0, tier: 'safe' }, ctx()).ok).toBe(true);
  });

  it("doesn't let a guest redraw, swap or finish someone else's hole", () => {
    let g = giveCard(online(), 'player02', 0, 'S02');
    expect(applyAction(g, { type: 'redraw', playerId: 'player02', hole: 0 }, ctx(OTHER)).ok).toBe(false);
    expect(applyAction(g, { type: 'holeDone', playerId: 'player02', hole: 0 }, ctx(OTHER)).ok).toBe(false);
    g = run(g, { type: 'holeDone', playerId: 'player02', hole: 0 }, ctx(JO));
    expect(applyAction(g, { type: 'holeDone', playerId: 'player02', hole: 0, undo: true }, ctx(OTHER)).ok).toBe(false);
  });
});

describe('player pictures', () => {
  const base = () =>
    createGame({
      id: 'g1',
      hostDeviceId: 'dhost',
      now: 0,
      players: [{ id: 'p1aaaa', name: 'Sam', emoji: '🦈', color: 3 }],
      holes: [{ number: 1, par: 4 }],
    });
  const host = { deviceId: 'dhost', now: 1, rng: Math.random };

  it('keeps a picked emoji and colour, and gives a later player a free colour', () => {
    const g = base();
    expect(g.players[0]).toMatchObject({ emoji: '🦈', color: 3 });
    const r = applyAction(g, { type: 'addPlayer', id: 'p2bbbb', name: 'Alex', color: 3, emoji: '🐐' }, host);
    if (!r.ok) throw new Error(r.error);
    expect(r.game.players[1].color).not.toBe(3);
    expect(r.game.players[1].emoji).toBe('🐐');
  });

  it('changes a picture, refuses a taken colour, and drops emojis not on the list', () => {
    const g = base();
    const ok = applyAction(g, { type: 'setLook', playerId: 'p1aaaa', emoji: null, color: 5 }, host);
    expect(ok.ok && ok.game.players[0]).toMatchObject({ color: 5 });
    expect(ok.ok && ok.game.players[0].emoji).toBeUndefined();
    const two = applyAction(g, { type: 'addPlayer', id: 'p2bbbb', name: 'Alex' }, host);
    if (!two.ok) throw new Error(two.error);
    expect(applyAction(two.game, { type: 'setLook', playerId: 'p2bbbb', emoji: '⛳', color: 3 }, host).ok).toBe(false);
    expect(parseAction({ type: 'setLook', playerId: 'p1aaaa', emoji: '💩', color: 1 })).toBeNull();
    expect(parseAction({ type: 'addPlayer', id: 'p2bbbb', name: 'Alex', emoji: '<b>' })).toEqual({
      type: 'addPlayer',
      id: 'p2bbbb',
      name: 'Alex',
      claim: false,
    });
  });

  it('only lets a guest change their own picture', () => {
    const r = applyAction(
      base(),
      { type: 'setLook', playerId: 'p1aaaa', emoji: '⛳', color: 1 },
      { deviceId: 'dother', now: 1, rng: Math.random },
    );
    expect(r.ok).toBe(false);
  });
});

describe('who can change a score (online)', () => {
  // Sam is the host; Alex is on their own phone.
  function online(): Game {
    let g = newGame();
    g = { ...g, code: 'ABCDE', players: g.players.map((p, i) => (i === 1 ? { ...p, deviceId: OTHER } : p)) };
    g = run(g, { type: 'start' });
    g = giveCard(g, 'player00', 0, 'S02');
    g = giveCard(g, 'player01', 0, 'S02');
    return g;
  }
  const alex = ctx(OTHER);

  it('lets you enter and fix your own score until the group moves on', () => {
    let g = run(online(), { type: 'score', playerId: 'player01', hole: 0, strokes: 5, outcome: 'made' }, alex);
    g = run(g, { type: 'score', playerId: 'player01', hole: 0, strokes: 4, outcome: 'made' }, alex);
    expect(getEntry(g, 'player01', 0)?.strokes).toBe(4);
    expect(g.edits).toBeUndefined();
  });

  it("doesn't let a guest enter or change someone else's score", () => {
    let g = online();
    expect(applyAction(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 3, outcome: 'made' }, alex).ok).toBe(false);
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome: 'made' });
    expect(applyAction(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 9, outcome: 'missed' }, alex).ok).toBe(false);
  });

  it('locks a hole once the group moves on: your own fix becomes a request the host approves', () => {
    let g = run(online(), { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome: 'made' });
    g = run(g, { type: 'score', playerId: 'player01', hole: 0, strokes: 6, outcome: 'missed' }, alex);
    g = run(g, { type: 'nextHole', from: 0 });
    expect(applyAction(g, { type: 'score', playerId: 'player01', hole: 0, strokes: 5, outcome: 'missed' }, alex).ok).toBe(false);

    g = run(g, { type: 'requestFix', id: 'fix001', playerId: 'player01', hole: 0, strokes: 5, outcome: 'missed' }, alex);
    expect(getEntry(g, 'player01', 0)?.strokes).toBe(6);
    // Alex can't approve their own request; the host can.
    expect(applyAction(g, { type: 'answerFix', id: 'fix001', accept: true }, alex).ok).toBe(false);
    g = run(g, { type: 'answerFix', id: 'fix001', accept: true });
    expect(getEntry(g, 'player01', 0)?.strokes).toBe(5);
    expect(g.fixes).toBeUndefined();
    expect(g.edits).toEqual([
      expect.objectContaining({
        playerId: 'player01',
        hole: 0,
        from: expect.objectContaining({ strokes: 6 }),
        to: expect.objectContaining({ strokes: 5 }),
      }),
    ]);
  });

  it('asks the player to approve a change to their score, and a no leaves it alone', () => {
    let g = run(online(), { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome: 'made' });
    g = run(g, { type: 'score', playerId: 'player01', hole: 0, strokes: 6, outcome: 'missed' }, alex);
    g = run(g, { type: 'nextHole', from: 0 });
    g = run(g, { type: 'requestFix', id: 'fix002', playerId: 'player00', hole: 0, strokes: 6, outcome: 'made' }, alex);
    // The host owns Sam, so the host answers. No = nothing changes.
    g = run(g, { type: 'answerFix', id: 'fix002', accept: false });
    expect(getEntry(g, 'player00', 0)?.strokes).toBe(5);
    expect(g.edits).toBeUndefined();
  });

  it('lets the host fix anything, and shows the change to everyone', () => {
    let g = run(online(), { type: 'score', playerId: 'player01', hole: 0, strokes: 6, outcome: 'missed' }, alex);
    g = run(g, { type: 'score', playerId: 'player01', hole: 0, strokes: 7, outcome: 'missed' });
    expect(g.edits?.[0]).toMatchObject({ playerId: 'player01', how: 'Host', from: { strokes: 6 }, to: { strokes: 7 } });
  });

  it('turns away fix requests in a one-phone game', () => {
    let g = run(newGame(), { type: 'start' });
    g = giveCard(g, 'player00', 0, 'S02');
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome: 'made' });
    expect(applyAction(g, { type: 'requestFix', id: 'fix003', playerId: 'player00', hole: 0, strokes: 4 }, ctx()).ok).toBe(false);
  });
});

describe('mulligans', () => {
  function round(holes: number): Game {
    let g = newGame(['Sam'], Array(holes).fill(4) as Par[]);
    g = run(g, { type: 'start' });
    for (let h = 0; h < holes; h++) g = giveCard(g, 'player00', h, 'S02');
    return g;
  }

  it('gives 2 for 9 holes or fewer, 4 for longer rounds, none when switched off', () => {
    expect(mulliganAllowance(round(9))).toBe(2);
    expect(mulliganAllowance(round(6))).toBe(2);
    expect(mulliganAllowance(round(12))).toBe(4);
    expect(mulliganAllowance(round(18))).toBe(4);
    const off = run(newGame(), { type: 'setSettings', settings: { mulligans: false } });
    expect(mulliganAllowance(off)).toBe(0);
  });

  it('counts them down, one per hole, and turns one away when none are left', () => {
    let g = round(9);
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome: 'made', mulligan: true });
    expect(mulligansLeft(g, 'player00')).toBe(1);
    // Re-saving the same hole doesn't use another.
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 4, outcome: 'made', mulligan: true });
    expect(mulligansLeft(g, 'player00')).toBe(1);
    expect(holeResult(g, 'player00', 0)).toMatchObject({ strokes: 4, mulligan: true });
    g = run(g, { type: 'nextHole', from: 0 });
    g = run(g, { type: 'score', playerId: 'player00', hole: 1, strokes: 5, outcome: 'made', mulligan: true });
    g = run(g, { type: 'nextHole', from: 1 });
    expect(mulligansLeft(g, 'player00')).toBe(0);
    expect(applyAction(g, { type: 'score', playerId: 'player00', hole: 2, strokes: 5, outcome: 'made', mulligan: true }, ctx()).ok).toBe(
      false,
    );
    // Taking one back gives it back.
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 5, outcome: 'made', mulligan: false });
    expect(mulligansLeft(g, 'player00')).toBe(1);
  });

  it('is set before the round and locked once it starts', () => {
    const g = round(9);
    expect(applyAction(g, { type: 'setSettings', settings: { mulligans: false } }, ctx()).ok).toBe(false);
    expect(parseAction({ type: 'score', playerId: 'player00', hole: 0, strokes: 4, mulligan: 'yes' })).toBeNull();
  });
});

describe('taking a mulligan during the hole', () => {
  function online(): Game {
    let g = newGame();
    g = { ...g, code: 'ABCDE', players: g.players.map((p, i) => (i === 1 ? { ...p, deviceId: OTHER } : p)) };
    g = run(g, { type: 'start' });
    g = giveCard(g, 'player00', 0, 'S02');
    g = giveCard(g, 'player01', 0, 'S02');
    return g;
  }

  it('takes one, undoes it, and keeps to your own players online', () => {
    let g = run(online(), { type: 'mulligan', playerId: 'player01', hole: 0, on: true }, ctx(OTHER));
    expect(getEntry(g, 'player01', 0)?.mulligan).toBe(true);
    expect(mulligansLeft(g, 'player01')).toBe(1);
    expect(applyAction(g, { type: 'mulligan', playerId: 'player00', hole: 0, on: true }, ctx(OTHER)).ok).toBe(false);
    g = run(g, { type: 'mulligan', playerId: 'player01', hole: 0, on: false }, ctx(OTHER));
    expect(mulligansLeft(g, 'player01')).toBe(2);
    // Only on the hole being played.
    expect(applyAction(g, { type: 'mulligan', playerId: 'player01', hole: 1, on: true }, ctx(OTHER)).ok).toBe(false);
  });
});

describe('skins, overtakes and reactions', () => {
  function scored(pars: Par[], strokes: number[][]): Game {
    // strokes[hole][player]; every card is S02 (Penalty-Free) and completed, so scores differ only by strokes.
    let g = run(newGame(['Sam', 'Alex', 'Kim'], pars), { type: 'start' });
    strokes.forEach((row, h) => {
      row.forEach((s, i) => {
        g = giveCard(g, `player0${i}`, h, 'S02');
        g = run(g, { type: 'score', playerId: `player0${i}`, hole: h, strokes: s, outcome: 'made' });
      });
      if (h < pars.length - 1) g = run(g, { type: 'nextHole', from: h });
    });
    return g;
  }

  it('gives each hole to its single best score, rolling ties over', () => {
    const g = scored(
      [4, 4, 4, 4],
      [
        [4, 5, 6], // Sam wins hole 1
        [5, 5, 6], // tie: rolls over
        [6, 6, 4], // Kim wins hole 3, worth 2
        [5, 5, 5], // tie on the last hole: nobody wins it
      ],
    );
    expect(skins(g)).toEqual({ 0: { playerId: 'player00', worth: 1 }, 2: { playerId: 'player02', worth: 2 } });
  });

  it('names who passed whom on the last hole', () => {
    const g = scored(
      [4, 4],
      [
        [4, 5, 6],
        [7, 4, 4], // Alex and Kim both pass Sam
      ],
    );
    const names = overtakes(g).map((o) => `${o.by.name}>${o.passed.name}`);
    expect(names).toEqual(expect.arrayContaining(['Alex>Sam', 'Kim>Sam']));
    expect(names).toHaveLength(2);
  });

  it('lets other players react once each, and closes when the group moves on', () => {
    let g = newGame(['Sam', 'Alex'], [4, 4]);
    g = { ...g, code: 'BCDFG' };
    g = run(g, { type: 'start' });
    g = run(g, { type: 'claimPlayer', playerId: 'player01' }, ctx(OTHER));
    g = giveCard(g, 'player00', 0, 'S02');
    g = run(g, { type: 'score', playerId: 'player00', hole: 0, strokes: 7, outcome: 'missed' });
    const react = (emoji: string | null, from = 'player01', dev = OTHER) =>
      applyAction(g, { type: 'react', playerId: 'player00', hole: 0, fromId: from, emoji }, ctx(dev));

    // Not as someone else, not to yourself.
    expect(react('🤡', 'player01', HOST).ok).toBe(false);
    expect(applyAction(g, { type: 'react', playerId: 'player01', hole: 0, fromId: 'player01', emoji: '🔥' }, ctx(OTHER)).ok).toBe(false);

    let r = react('🤡');
    expect(r.ok).toBe(true);
    g = (r as { game: Game }).game;
    expect(getEntry(g, 'player00', 0)?.reactions).toEqual({ player01: '🤡' });
    r = react(null);
    g = (r as { game: Game }).game;
    expect(getEntry(g, 'player00', 0)?.reactions).toBeUndefined();

    // Only emojis from the list get through the network.
    expect(parseAction({ type: 'react', playerId: 'player00', hole: 0, fromId: 'player01', emoji: '💩' })).toBeNull();
    expect(parseAction({ type: 'react', playerId: 'player00', hole: 0, fromId: 'player01', emoji: '🔥' })).toMatchObject({ emoji: '🔥' });

    // Kept on upload, minus anything not on the list.
    g.entries[entryKey('player00', 0)].reactions = { player01: '😂', nobody99: '🔥' };
    expect(sanitizeUpload(g, HOST, 5, seeded())!.entries[entryKey('player00', 0)].reactions).toEqual({ player01: '😂' });
  });
});

describe('2v2 teams', () => {
  const NAMES = ['Sam', 'Alex', 'Kim', 'Lee'];
  const TEAMS: [string, string][] = [
    ['player00', 'player01'],
    ['player02', 'player03'],
  ];
  function teamGame(pars: Par[] = [4, 4, 4, 4, 4, 4]): Game {
    let g = newGame(NAMES, pars);
    g = run(g, { type: 'setTeams', teams: TEAMS });
    return run(g, { type: 'start' });
  }
  const score = (g: Game, id: string, hole: number, strokes: number, outcome?: 'made' | 'missed') =>
    run(g, { type: 'score', playerId: id, hole, strokes, ...(outcome ? { outcome } : {}) });

  it('lets a player react to the other team, never their own', () => {
    let g = teamGame();
    g = giveCard(g, TEAMS[0][0], 0, 'S02');
    g = score(g, TEAMS[0][0], 0, 4, 'made');
    // The host owns every player here, so react as the other team's first player, then as a teammate.
    const as = (fromId: string) => applyAction(g, { type: 'react', playerId: TEAMS[0][0], hole: 0, fromId, emoji: '🔥' }, ctx());
    expect(as(TEAMS[1][0]).ok).toBe(true);
    expect(as(TEAMS[0][1]).ok).toBe(false);
  });

  it('lets only the host set teams, in the lobby, for exactly four players', () => {
    const g = newGame(NAMES);
    expect(applyAction(g, { type: 'setTeams', teams: TEAMS }, ctx(OTHER)).ok).toBe(false);
    expect(applyAction(newGame(['Sam', 'Alex', 'Kim']), { type: 'setTeams', teams: TEAMS }, ctx()).ok).toBe(false);
    expect(applyAction(g, { type: 'setTeams', teams: [['player00', 'player01'], ['player01', 'player02']] }, ctx()).ok).toBe(false);
    const t = run(g, { type: 'setTeams', teams: TEAMS });
    expect(t.teams).toHaveLength(2);
    expect(mateOf(t, 'player00')).toBe('player01');
    expect(teamOf(t, 'player03')?.players).toEqual(['player02', 'player03']);
    expect(applyAction(run(t, { type: 'start' }), { type: 'setTeams', teams: null }, ctx()).ok).toBe(false);
    // Anyone joining or leaving in the lobby clears the teams.
    expect(run(t, { type: 'removePlayer', playerId: 'player03' }).teams).toBeUndefined();
    expect(run(t, { type: 'setTeams', teams: null }).teams).toBeUndefined();
  });

  it('gives both partners the same card as soon as one picks, first tap wins', () => {
    let g = teamGame();
    g = run(g, { type: 'pick', playerId: 'player01', hole: 0, tier: 'bold' });
    const a = g.entries[entryKey('player00', 0)], b = g.entries[entryKey('player01', 0)];
    expect(a.tier).toBe('bold');
    expect(a.cardId).toBeDefined();
    expect(a.cardId).toBe(b.cardId);
    const again = applyAction(g, { type: 'pick', playerId: 'player00', hole: 0, tier: 'insane' }, ctx());
    expect(again.ok && !again.changed).toBe(true);
    // The other team draws a different card.
    g = run(g, { type: 'pick', playerId: 'player02', hole: 0, tier: 'bold' });
    expect(g.entries[entryKey('player02', 0)].cardId).not.toBe(a.cardId);
  });

  it('uses the team values: Safe −3/+2, Bold −4/+3, Insane −12/+4, doubled on the last 3 holes', () => {
    const g = teamGame();
    expect(cardStakes(g, 0, 'safe')).toEqual({ made: -3, missed: 2 });
    expect(cardStakes(g, 0, 'bold')).toEqual({ made: -4, missed: 3 });
    expect(cardStakes(g, 0, 'insane')).toEqual({ made: -12, missed: 4 });
    expect(cardStakes(g, 5, 'insane')).toEqual({ made: -24, missed: 8 });
    // Solo games are unchanged.
    expect(cardStakes(run(newGame(NAMES), { type: 'start' }), 0, 'insane')).toEqual({ made: -9, missed: 3 });
  });

  it('completes the card for the team if either partner does', () => {
    let g = teamGame();
    g = giveCard(g, 'player00', 0, 'S02');
    g = giveCard(g, 'player01', 0, 'S02');
    // Sam fails: the team waits on Alex.
    g = score(g, 'player00', 0, 5, 'missed');
    expect(playerScored(g, 'player00', 0)).toBe(true);
    expect(holeResult(g, 'player00', 0)).toBeNull();
    // Alex completes it: both are credited, with their own golf scores.
    g = score(g, 'player01', 0, 4, 'made');
    expect(holeResult(g, 'player00', 0)).toMatchObject({ outcome: 'made', ownOutcome: 'missed', adjustment: -3, toPar: -2 });
    expect(holeResult(g, 'player01', 0)).toMatchObject({ outcome: 'made', ownOutcome: 'made', adjustment: -3, toPar: -3 });
  });

  it('fails the card for the team only when both partners fail it', () => {
    let g = teamGame();
    g = giveCard(g, 'player00', 0, 'S02');
    g = giveCard(g, 'player01', 0, 'S02');
    g = score(g, 'player00', 0, 4, 'missed');
    g = score(g, 'player01', 0, 4, 'missed');
    expect(holeResult(g, 'player00', 0)).toMatchObject({ outcome: 'missed', adjustment: 2 });
    expect(holeResult(g, 'player01', 0)).toMatchObject({ outcome: 'missed', adjustment: 2 });
  });

  it('ranks teams by the average of both partners, in halves', () => {
    let g = teamGame();
    for (const [id, strokes, outcome] of [['player00', 4, 'made'], ['player01', 5, 'made'], ['player02', 5, 'missed'], ['player03', 4, 'missed']] as const) {
      g = giveCard(g, id, 0, 'S02');
      g = score(g, id, 0, strokes, outcome);
    }
    // Team 1 completed Safe (−3): Sam −3, Alex −2, average −2½. Team 2 failed (+2): Kim +3, Lee +2, average +2½.
    const rows = standings(g);
    expect(units(g).map((u) => u.name)).toEqual(['Sam & Alex', 'Kim & Lee']);
    expect(rows.map((r) => [r.player.name, r.rank, r.totals.toPar])).toEqual([
      ['Sam & Alex', 1, -2.5],
      ['Kim & Lee', 2, 2.5],
    ]);
    expect(rows[0].totals.real).toBe(9);
    expect(formatToPar(-2.5)).toBe('\u22122½');
    expect(halves(0.5)).toBe('½');
    expect(gapText(run(g, { type: 'nextHole', from: 0 }), 'player02')).toBe("You're 5 strokes behind Sam & Alex");
  });

  it('shares one redraw between partners, and only before anyone scores', () => {
    let g = teamGame();
    g = run(g, { type: 'pick', playerId: 'player00', hole: 0, tier: 'bold' });
    const first = g.entries[entryKey('player00', 0)].cardId;
    g = run(g, { type: 'redraw', playerId: 'player01', hole: 0 });
    expect(g.entries[entryKey('player00', 0)].cardId).not.toBe(first);
    expect(g.entries[entryKey('player00', 0)].cardId).toBe(g.entries[entryKey('player01', 0)].cardId);
    expect(applyAction(g, { type: 'redraw', playerId: 'player00', hole: 0 }, ctx()).ok).toBe(false);
  });

  it("shows a teammate the team's card but keeps the other team's picks hidden", () => {
    let g = { ...teamGame(), code: 'BCDFG' } as Game;
    g.players[0].deviceId = HOST;
    g.players[1].deviceId = OTHER;
    g.players[2].deviceId = 'third-device-3';
    g.players[3].deviceId = 'fourth-device-4';
    g = run(g, { type: 'pick', playerId: 'player00', hole: 0, tier: 'insane' });
    const forAlex = redactForDevice(g, OTHER);
    expect(forAlex.entries[entryKey('player00', 0)].cardId).toBeDefined();
    expect(forAlex.entries[entryKey('player01', 0)].cardId).toBeDefined();
    const forKim = redactForDevice(g, 'third-device-3');
    expect(forKim.entries[entryKey('player00', 0)]).toEqual({ hidden: true });
    expect(forKim.entries[entryKey('player01', 0)]).toEqual({ hidden: true });
  });

  it('keeps teams on upload only when they are still two pairs of four players', () => {
    const g = newGame(NAMES);
    g.teams = [
      { id: 'team1', players: ['player00', 'player01'] },
      { id: 'team2', players: ['player02', 'player03'] },
    ];
    expect(sanitizeUpload(g, HOST, 5, seeded())!.teams).toHaveLength(2);
    g.teams[1].players = ['player02', 'player99'];
    expect(sanitizeUpload(g, HOST, 5, seeded())!.teams).toBeUndefined();
    expect(parseAction({ type: 'setTeams', teams: [['player00', 'player01'], ['player02']] })).toBeNull();
    expect(parseAction({ type: 'setTeams', teams: null })).toEqual({ type: 'setTeams', teams: null });
  });
});
