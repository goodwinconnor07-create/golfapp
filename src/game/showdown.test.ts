// Ruleset 2 (the Showdown update): hands, packs, Name It, streaks, friends, the Crown, win chances.
import { describe, expect, it } from 'vitest';
import {
  applyAction,
  CARDS,
  cardOutcome,
  createGame,
  crownBonus,
  crownHolder,
  DEFAULT_PACKS,
  entryKey,
  fitsHand,
  getCard,
  handFor,
  holeComplete,
  holeResult,
  judgeAuto,
  makeHoles,
  personalAverage,
  recap,
  sanitizeUpload,
  stakeFor,
  standings,
  TIER_ORDER,
  winChancesFor,
  type Action,
  type ActionContext,
  type Game,
  type Par,
  type Tier,
} from './index';

const HOST = 'host-device-1';

function ctx(deviceId = HOST): ActionContext {
  return { deviceId, now: 1_000, rng: () => 0.5 };
}

function run(game: Game, action: Action, c: ActionContext = ctx()): Game {
  const r = applyAction(game, action, c);
  if (!r.ok) throw new Error(r.error);
  return r.game;
}

/** A ruleset 2 game. Core pack only unless asked, so results in score tests don't hang on friends' cards. */
function v2Game(names = ['Sam', 'Alex'], pars: Par[] = [4, 4, 4, 4, 4, 4], seed = 7, start = true, allPacks = false): Game {
  const holes = makeHoles(pars.length).map((h, i) => ({ ...h, par: pars[i] }));
  const g = createGame({
    id: 'game000009',
    hostDeviceId: HOST,
    now: 0,
    players: names.map((name, i) => ({ id: `player0${i}`, name })),
    holes,
    rules: 2,
    seed,
    ...(allPacks ? {} : { settings: { packs: ['core'] } }),
  });
  return start ? run(g, { type: 'start' }) : g;
}

/** Puts a card on an entry directly, as if picked (for judging tests that need a particular card). */
function place(g: Game, playerId: string, hole: number, cardId: string, tier?: Tier, extra: Record<string, unknown> = {}): Game {
  const out = structuredClone(g);
  out.entries[entryKey(playerId, hole)] = { tier: tier ?? getCard(cardId)!.tier, cardId, pickedBy: HOST, ...extra };
  return out;
}

function score(g: Game, playerId: string, hole: number, strokes: number, outcome?: 'made' | 'missed'): Game {
  return run(g, { type: 'score', playerId, hole, strokes, ...(outcome ? { outcome } : {}) });
}

/** Plays a hole with the Safe card from each player's hand and the given strokes, then moves on. */
function playSafe(g: Game, strokes: number[]): Game {
  const h = g.current;
  g.players.forEach((p) => {
    const hand = handFor(g, p.id, h)!;
    g = run(g, { type: 'pick', playerId: p.id, hole: h, tier: 'safe', cardId: hand.safe });
  });
  g.players.forEach((p, i) => {
    const card = getCard(g.entries[entryKey(p.id, h)].cardId)!;
    g = score(g, p.id, h, strokes[i], judgeAuto(g, p.id, h, strokes[i]) ? undefined : 'made');
    void card;
  });
  return run(g, { type: 'nextHole', from: h });
}

describe('ruleset 2 games', () => {
  it('start with a seed, the default packs and the Crown', () => {
    const g = v2Game(undefined, undefined, 7, true, true);
    expect(g.rules).toBe(2);
    expect(g.seed).toBe(7);
    expect(g.settings.packs).toEqual([...DEFAULT_PACKS]);
    expect(g.settings.crown).toBe(true);
  });

  it('make Insane fails cost 4 (older games 3), everything else unchanged', () => {
    const g = v2Game();
    expect(stakeFor(g, 0, 'insane', 'missed')).toBe(4);
    expect(stakeFor(g, 0, 'insane', 'made')).toBe(-9);
    expect(stakeFor(g, 0, 'bold', 'missed')).toBe(2);
    expect(stakeFor({ ...g, rules: undefined }, 0, 'insane', 'missed')).toBe(3);
  });
});

describe('hands', () => {
  it('are the same on every phone, one card per level, all fitting the hole', () => {
    const g = v2Game();
    const a = handFor(g, 'player00', 0)!;
    const again = handFor(structuredClone(g), 'player00', 0)!;
    expect(again).toEqual(a);
    for (const t of TIER_ORDER) {
      const card = getCard(a[t])!;
      expect(fitsHand(g, card, 0)).toBe(true);
      expect(card.tier).toBe(t);
    }
  });

  it('never deal older-game cards, Hard Mode (off by default) or cards from packs that are off', () => {
    for (let seed = 1; seed < 60; seed++) {
      const g = v2Game(['Sam', 'Alex'], [3, 4, 5, 4, 3, 5], seed, true, true);
      for (let h = 0; h < 6; h++)
        for (const t of TIER_ORDER) {
          const card = getCard(handFor(g, 'player00', h)![t])!;
          expect(card.legacyOnly).toBeFalsy();
          expect(card.pack).not.toBe('hard');
        }
    }
    const coreOnly = run(v2Game(undefined, undefined, 3, false, true), { type: 'setSettings', settings: { packs: ['core'] } });
    const started = run(coreOnly, { type: 'start' });
    for (let h = 0; h < 6; h++)
      for (const t of TIER_ORDER) expect(getCard(handFor(started, 'player00', h)![t])!.pack ?? 'core').toBe('core');
  });

  it("don't repeat a card for a player while a fresh one fits", () => {
    const pars: Par[] = [4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 3, 4, 5, 4, 4, 3, 4, 5];
    const g = v2Game(['Sam', 'Alex'], pars, 11, true, true);
    const seen = new Set<string>();
    for (let h = 0; h < pars.length; h++) {
      const hand = handFor(g, 'player00', h)!;
      // Safe never holds streak cards, so every fitting Safe card is a candidate.
      const fitting = CARDS.filter((c) => c.tier === 'safe' && fitsHand(g, c, h)).map((c) => c.id);
      if (seen.has(hand.safe)) expect(fitting.every((id) => seen.has(id))).toBe(true);
      for (const t of TIER_ORDER) seen.add(hand[t]);
    }
  });

  it("don't offer a streak card right after you picked one, or near the end of the round", () => {
    const g = v2Game(['Sam', 'Alex'], [4, 4, 4, 4, 4, 4], 5, true, true);
    const streak = CARDS.find((c) => c.id === 'I25')!;
    expect(fitsHand(g, streak, 3)).toBe(true);
    expect(fitsHand(g, streak, 4)).toBe(false); // only 2 holes left
    const after = place(g, 'player00', 0, 'I25');
    for (let seed = 0; seed < 30; seed++) {
      const gg = { ...after, seed };
      for (const h of [1, 2]) expect(getCard(handFor(gg, 'player00', h)!.insane)!.multi).toBeUndefined();
    }
  });

  it('are shared by 2v2 partners and never hold cards about one player', () => {
    let g = v2Game(['Sam', 'Alex', 'Jay', 'Kim'], [4, 4, 4, 4, 4, 4], 9, false, true);
    g = run(g, {
      type: 'setTeams',
      teams: [
        ['player00', 'player01'],
        ['player02', 'player03'],
      ],
    });
    g = run(g, { type: 'start' });
    for (let h = 0; h < 4; h++) {
      expect(handFor(g, 'player01', h)).toEqual(handFor(g, 'player00', h));
      for (const t of TIER_ORDER) expect(getCard(handFor(g, 'player00', h)![t])!.noTeams).toBeFalsy();
    }
  });
});

describe('picking from a hand', () => {
  it('takes a card from the hand and refuses anything else', () => {
    const g = v2Game();
    const hand = handFor(g, 'player00', 0)!;
    const notInHand = CARDS.find((c) => c.tier === 'safe' && c.enabled && !c.legacyOnly && c.id !== hand.safe)!;
    expect(applyAction(g, { type: 'pick', playerId: 'player00', hole: 0, tier: 'safe', cardId: notInHand.id }, ctx()).ok).toBe(false);
    expect(applyAction(g, { type: 'pick', playerId: 'player00', hole: 0, tier: 'safe' }, ctx()).ok).toBe(false);
    const after = run(g, { type: 'pick', playerId: 'player00', hole: 0, tier: 'safe', cardId: hand.safe });
    expect(after.entries[entryKey('player00', 0)]).toMatchObject({ tier: 'safe', cardId: hand.safe });
  });

  it('has no redraws or swaps', () => {
    let g = v2Game();
    const hand = handFor(g, 'player00', 0)!;
    g = run(g, { type: 'pick', playerId: 'player00', hole: 0, tier: 'bold', cardId: hand.bold });
    expect(applyAction(g, { type: 'redraw', playerId: 'player00', hole: 0 }, ctx()).ok).toBe(false);
    expect(applyAction(g, { type: 'swap', playerId: 'player00', hole: 0 }, ctx()).ok).toBe(false);
  });

  it('lets a Name It card be called at any of its levels and locks in the number', () => {
    // Find a game whose first hand holds Name Your Number.
    let g: Game | null = null;
    for (let seed = 1; seed < 2000 && !g; seed++) {
      const t = v2Game(['Sam', 'Alex'], [4, 4, 4, 4, 4, 4], seed, true, true);
      if (handFor(t, 'player00', 0)!.bold === 'N01') g = t;
    }
    expect(g).not.toBeNull();
    const pick = (tier: Tier) => run(g!, { type: 'pick', playerId: 'player00', hole: 0, tier, cardId: 'N01' });
    // First hole: your average is bogey (1), so Safe asks for double bogey (2), Bold bogey, Insane par.
    expect(pick('safe').entries[entryKey('player00', 0)]).toMatchObject({ tier: 'safe', target: 2 });
    expect(pick('bold').entries[entryKey('player00', 0)].target).toBe(1);
    const insane = pick('insane');
    expect(insane.entries[entryKey('player00', 0)].target).toBe(0);
    // Make it or better: par makes it, bogey doesn't.
    expect(judgeAuto(insane, 'player00', 0, 4)).toBe('made');
    expect(judgeAuto(insane, 'player00', 0, 5)).toBe('missed');
  });

  it('needs a friend (not yourself) for Shadow and Bodyguard', () => {
    let g: Game | null = null;
    for (let seed = 1; seed < 3000 && !g; seed++) {
      const t = v2Game(['Sam', 'Alex', 'Jay'], [4, 4, 4, 4, 4, 4], seed, true, true);
      if (handFor(t, 'player00', 0)!.bold === 'B28') g = t;
    }
    expect(g).not.toBeNull();
    const base = { type: 'pick' as const, playerId: 'player00', hole: 0, tier: 'bold' as const, cardId: 'B28' };
    expect(applyAction(g!, base, ctx()).ok).toBe(false);
    expect(applyAction(g!, { ...base, friend: 'player00' }, ctx()).ok).toBe(false);
    expect(run(g!, { ...base, friend: 'player02' }).entries[entryKey('player00', 0)].friend).toBe('player02');
  });
});

describe('judging ruleset 2 cards', () => {
  it('judges average cards against your own round (starting from bogey)', () => {
    let g = v2Game();
    g = playSafe(g, [6, 5]); // Sam +2
    expect(personalAverage(g, 'player00', 1)).toBeCloseTo((2 + 2) / 3);
    const pp = place(g, 'player00', 1, 'B21');
    expect(judgeAuto(pp, 'player00', 1, 5)).toBe('made'); // +1 ≤ 1.33
    expect(judgeAuto(pp, 'player00', 1, 6)).toBe('missed');
    const beat = place(g, 'player00', 1, 'I23');
    expect(judgeAuto(beat, 'player00', 1, 4)).toBe('made'); // 0 ≤ 0.33
    expect(judgeAuto(beat, 'player00', 1, 5)).toBe('missed');
    const best = place(g, 'player00', 1, 'I24');
    expect(judgeAuto(best, 'player00', 1, 6)).toBe('made'); // matches the +2 best
    expect(judgeAuto(best, 'player00', 1, 7)).toBe('missed');
  });

  it('never completes a card judged from strokes by taking more strokes', () => {
    let g = v2Game(['Sam', 'Alex'], [4, 3, 5, 4, 4, 4]);
    g = playSafe(g, [5, 4]);
    g = playSafe(g, [4, 3]);
    for (const card of CARDS.filter((c) => c.enabled && !c.legacyOnly)) {
      for (const hole of [2]) {
        const par = g.holes[hole].par!;
        if (!card.pars.includes(par)) continue;
        const tiers = card.nameIt ? (Object.keys(card.nameIt) as Tier[]) : [card.tier];
        for (const tier of tiers) {
          const target = card.nameIt ? (tier === 'safe' ? 2 : 1) : undefined;
          const gg = place(g, 'player00', hole, card.id, tier, target != null ? { target } : {});
          let sawMissed = false;
          for (let strokes = 1; strokes <= 10; strokes++) {
            const v = judgeAuto(gg, 'player00', hole, strokes);
            if (v === 'missed') sawMissed = true;
            if (sawMissed) expect(v, `${card.id} at ${strokes}`).not.toBe('made');
          }
        }
      }
    }
  });

  it('pays a streak on the hole that settles it', () => {
    let g = v2Game();
    g = place(g, 'player00', 0, 'I25');
    g = place(g, 'player01', 0, getCard('S01')!.id);
    g = score(g, 'player00', 0, 5);
    g = score(g, 'player01', 0, 4);
    expect(holeComplete(g, 0)).toBe(true);
    expect(holeResult(g, 'player00', 0)).toMatchObject({ adjustment: 0, streak: { outcome: 'running' } });
    g = run(g, { type: 'nextHole', from: 0 });
    g = playSafe(g, [5, 4]); // hole 1: bogey
    expect(cardOutcome(g, 'player00', 0)).toBe('running');
    g = playSafe(g, [5, 4]); // hole 2: bogey, three holes with no double
    expect(holeResult(g, 'player00', 0)!.streak).toEqual({ outcome: 'made', at: 2 });
    const settled = holeResult(g, 'player00', 2)!;
    expect(settled.extras).toContainEqual({ kind: 'streak', amount: -9, cardId: 'I25', from: 0 });
  });

  it('fails a streak as soon as it breaks', () => {
    let g = v2Game();
    g = place(g, 'player00', 0, 'I25');
    g = place(g, 'player01', 0, 'S01');
    g = score(g, 'player00', 0, 5);
    g = score(g, 'player01', 0, 4);
    g = run(g, { type: 'nextHole', from: 0 });
    g = playSafe(g, [6, 4]); // double bogey on hole 1
    expect(holeResult(g, 'player00', 0)!.streak).toEqual({ outcome: 'missed', at: 1 });
    expect(holeResult(g, 'player00', 1)!.extras).toContainEqual({ kind: 'streak', amount: 4, cardId: 'I25', from: 0 });
  });

  it('judges Shadow, Underdog and Bodyguard from the friends', () => {
    let g = v2Game(['Sam', 'Alex', 'Jay']);
    g = playSafe(g, [4, 6, 5]); // Sam leads, Alex last
    g = place(g, 'player00', 1, 'B28', 'bold', { friend: 'player01' });
    g = place(g, 'player01', 1, 'B29'); // Underdog: Alex needs fewer strokes than Sam or Jay
    g = place(g, 'player02', 1, 'S19', 'safe', { friend: 'player00' }); // Bodyguard on Sam
    g = score(g, 'player00', 1, 5);
    expect(cardOutcome(g, 'player00', 1)).toBeNull(); // waiting on Alex
    g = score(g, 'player01', 1, 4);
    g = score(g, 'player02', 1, 5);
    expect(cardOutcome(g, 'player00', 1)).toBe('missed'); // 5 vs Alex's 4
    expect(cardOutcome(g, 'player01', 1)).toBe('made');
    expect(cardOutcome(g, 'player02', 1)).toBe('missed'); // Sam failed his card
  });
});

describe('the Crown', () => {
  it('takes a stroke off anyone who beats the outright leader on a hole', () => {
    let g = v2Game(['Sam', 'Alex', 'Jay']);
    g = playSafe(g, [4, 5, 5]); // Sam leads
    expect(crownHolder(g, 1)).toBe('player00');
    g = playSafe(g, [6, 5, 6]); // Alex beats Sam's 6; Jay ties it
    expect(crownBonus(g, 'player01', 1)).toBe(-1);
    expect(crownBonus(g, 'player02', 1)).toBe(0);
    expect(holeResult(g, 'player01', 1)!.extras).toContainEqual({ kind: 'crown', amount: -1 });
    const alex = standings(g).find((r) => r.player.id === 'player01')!;
    expect(alex.totals.toPar).toBe(1 - 1 + (1 - 1) - 1); // two bogeys, two Safe cards completed, the Crown
  });

  it("doesn't exist when the lead is shared, or when the host turns it off", () => {
    let g = v2Game();
    g = playSafe(g, [5, 5]);
    expect(crownHolder(g, 1)).toBeNull();
    let off = run(v2Game(undefined, undefined, 7, false), { type: 'setSettings', settings: { crown: false } });
    off = run(off, { type: 'start' });
    off = playSafe(off, [4, 5]);
    off = playSafe(off, [6, 5]);
    expect(crownBonus(off, 'player01', 1)).toBe(0);
  });

  it('counts double on the 2× holes and earns the Crown thief award', () => {
    let g = v2Game(['Sam', 'Alex', 'Jay'], [4, 4, 4, 4, 4, 4]);
    g = playSafe(g, [3, 6, 6]); // Sam well clear
    g = playSafe(g, [5, 4, 6]); // Alex beats Sam: −1, Sam still leads
    g = playSafe(g, [4, 4, 4]);
    g = playSafe(g, [6, 5, 6]); // hole 4 of 6 is a 2× hole: Alex beats Sam again, −2
    expect(crownHolder(g, 3)).toBe('player00');
    expect(crownBonus(g, 'player01', 3)).toBe(-2);
    for (let h = 4; h < 6; h++) g = playSafe(g, [4, 4, 4]);
    expect(recap(g).awards.find((a) => a.id === 'crown')?.playerIds).toEqual(['player01']);
  });
});

describe('settings and uploads', () => {
  it('lock packs and the Crown once the round starts, and always keep the core deck', () => {
    let g = v2Game(undefined, undefined, 7, false, true);
    g = run(g, { type: 'setSettings', settings: { packs: ['nameIt'] } });
    expect(g.settings.packs).toEqual(['core', 'nameIt']);
    g = run(g, { type: 'start' });
    expect(applyAction(g, { type: 'setSettings', settings: { packs: ['core'] } }, ctx()).ok).toBe(false);
    expect(applyAction(g, { type: 'setSettings', settings: { crown: false } }, ctx()).ok).toBe(false);
  });

  it('keep the ruleset, seed, called numbers and friends through an upload', () => {
    let g = v2Game(['Sam', 'Alex', 'Jay']);
    g = place(g, 'player00', 0, 'N01', 'insane', { target: 0 });
    g = place(g, 'player01', 0, 'B28', 'bold', { friend: 'player02' });
    const up = sanitizeUpload(JSON.parse(JSON.stringify(g)), HOST, 2_000, () => 0.5)!;
    expect(up.rules).toBe(2);
    expect(up.seed).toBe(7);
    expect(up.entries[entryKey('player00', 0)]).toMatchObject({ tier: 'insane', cardId: 'N01', target: 0 });
    expect(up.entries[entryKey('player01', 0)].friend).toBe('player02');
    // A new card in an older game is dropped.
    const old = { ...JSON.parse(JSON.stringify(g)), rules: undefined, seed: undefined };
    expect(sanitizeUpload(old, HOST, 2_000, () => 0.5)!.entries[entryKey('player00', 0)]).toBeUndefined();
  });
});

describe('live win chances', () => {
  it('add up to 1, favour the leader, and are the same every time', () => {
    let g = v2Game(['Sam', 'Alex', 'Jay'], [4, 4, 4, 4, 4, 4, 4, 4, 4]);
    g = playSafe(g, [4, 6, 6]);
    g = playSafe(g, [4, 6, 7]);
    const w = winChancesFor(g)!;
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
    expect(w.player00).toBeGreaterThan(w.player01);
    expect(w.player01).toBeGreaterThan(w.player02);
    expect(winChancesFor(structuredClone(g))).toEqual(w);
  });

  it("aren't shown for older games", () => {
    const g = v2Game();
    expect(winChancesFor({ ...g, rules: undefined })).toBeNull();
  });
});
