import { getCard } from './cards';
import { drawCard, returnCard, takeCard } from './deck';
import { anyPicked, canAddPlayers, entryKey, holeComplete, isVoteable, judgeFromStrokes, outcomeChoices, redrawUsed } from './rules';
import { freePassAvailable } from './selectors';
import { isTier } from './tiers';
import { LIMITS, type Action, type ActionContext, type Entry, type Game, type Hole, type Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  distanceCards: true,
  situationCards: false,
  tiebreakOnStrokes: false,
};

export const PLAYER_COLORS = 8;

export function cleanName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, LIMITS.maxNameLength);
}

export function cleanCourse(course: string): string {
  return course.replace(/\s+/g, ' ').trim().slice(0, LIMITS.maxCourseLength);
}

/** Hole list for a round: `count` holes starting at course hole `start`, wrapping after 18. */
export function makeHoles(count: number, start = 1): Hole[] {
  return Array.from({ length: count }, (_, i) => ({ number: ((start - 1 + i) % 18) + 1, par: null }));
}

export interface NewGameInput {
  id: string;
  hostDeviceId: string;
  now: number;
  players: { id: string; name: string }[];
  holes: Hole[];
  course?: string;
  settings?: Partial<Settings>;
}

/** A new game in the lobby. The first player belongs to the host's device. */
export function createGame(input: NewGameInput): Game {
  return {
    v: 1,
    id: input.id,
    code: null,
    hostDeviceId: input.hostDeviceId,
    createdAt: input.now,
    updatedAt: input.now,
    course: cleanCourse(input.course ?? ''),
    status: 'lobby',
    holes: input.holes.map((h) => ({ number: h.number, par: h.par })),
    current: 0,
    players: input.players.map((p, i) => ({
      id: p.id,
      name: cleanName(p.name),
      color: i % PLAYER_COLORS,
      deviceId: i === 0 ? input.hostDeviceId : null,
    })),
    entries: {},
    settings: { ...DEFAULT_SETTINGS, ...input.settings },
    decks: {},
    seq: 0,
  };
}

export type ApplyResult = { ok: true; game: Game; changed: boolean } | { ok: false; error: string };

const fail = (error: string): ApplyResult => ({ ok: false, error });

/**
 * Applies one action. Never mutates the game passed in.
 * Repeating an action that already happened (e.g. after a reconnect) is a harmless no-op.
 */
export function applyAction(game: Game, action: Action, ctx: ActionContext): ApplyResult {
  const g: Game = structuredClone(game);
  const isHost = ctx.deviceId === g.hostDeviceId;
  const unchanged: ApplyResult = { ok: true, game, changed: false };
  const findPlayer = (id: string) => g.players.find((p) => p.id === id);

  switch (action.type) {
    case 'addPlayer': {
      if (findPlayer(action.id)) return unchanged;
      if (!canAddPlayers(g)) return fail('Too late to add players to this round.');
      if (g.players.length >= LIMITS.maxPlayers) return fail(`A game can have up to ${LIMITS.maxPlayers} players.`);
      if (!isHost && !action.claim) return fail('Only the host can add guests.');
      const name = cleanName(action.name);
      if (!name) return fail('Add a name.');
      const used = new Set(g.players.map((p) => p.color));
      let color = 0;
      while (used.has(color) && color < PLAYER_COLORS - 1) color++;
      g.players.push({ id: action.id, name, color, deviceId: action.claim ? ctx.deviceId : null });
      break;
    }

    case 'renamePlayer': {
      const player = findPlayer(action.playerId);
      if (!player) return fail('Player not found.');
      if (!isHost && player.deviceId !== ctx.deviceId) return fail('You can only rename yourself.');
      const name = cleanName(action.name);
      if (!name) return fail('Add a name.');
      if (name === player.name) return unchanged;
      player.name = name;
      break;
    }

    case 'removePlayer': {
      if (!isHost) return fail('Only the host can remove players.');
      if (!findPlayer(action.playerId)) return unchanged;
      if (g.players.length <= 1) return fail('A game needs at least one player.');
      g.players = g.players.filter((p) => p.id !== action.playerId);
      for (const key of Object.keys(g.entries)) {
        if (key.startsWith(`${action.playerId}:`)) delete g.entries[key];
      }
      break;
    }

    case 'claimPlayer': {
      const player = findPlayer(action.playerId);
      if (!player) return fail('Player not found.');
      if (player.deviceId === ctx.deviceId) return unchanged;
      player.deviceId = ctx.deviceId;
      break;
    }

    case 'releasePlayer': {
      const player = findPlayer(action.playerId);
      if (!player) return fail('Player not found.');
      if (!isHost && player.deviceId !== ctx.deviceId) return fail("That's not your player.");
      if (player.deviceId === null) return unchanged;
      player.deviceId = null;
      break;
    }

    case 'setPar': {
      const hole = g.holes[action.hole];
      if (!hole) return fail('Hole not found.');
      if (hole.par === action.par) return unchanged;
      if (!isHost && anyPicked(g, action.hole)) return fail('Cards are already out. Ask the host to fix the par.');
      hole.par = action.par;
      break;
    }

    case 'setCourse': {
      if (!isHost) return fail('Only the host can change the course.');
      g.course = cleanCourse(action.course);
      break;
    }

    case 'setSettings': {
      if (!isHost) return fail('Only the host can change game options.');
      for (const key of ['distanceCards', 'situationCards', 'tiebreakOnStrokes'] as const) {
        const value = action.settings[key];
        if (typeof value === 'boolean') g.settings[key] = value;
      }
      break;
    }

    case 'start': {
      if (g.status !== 'lobby') return unchanged;
      if (!isHost) return fail('Only the host can start the game.');
      if (g.players.length === 0) return fail('Add at least one player.');
      g.status = 'playing';
      g.current = 0;
      break;
    }

    case 'pick': {
      if (g.status !== 'playing') return fail("The game isn't running.");
      if (action.hole !== g.current) return fail("That hole isn't being played.");
      if (!isTier(action.tier)) return fail('Pick Safe, Bold or Insane.');
      if (!findPlayer(action.playerId)) return fail('Player not found.');
      if (g.holes[action.hole].par == null) return fail('Set the par first.');
      const key = entryKey(action.playerId, action.hole);
      const entry: Entry = g.entries[key] ?? {};
      // Picks are locked in: a second pick for the same hole changes nothing.
      if (entry.tier) return unchanged;
      if (action.freePass) {
        if (!freePassAvailable(g, action.playerId)) return fail('The free shot is for whoever is in last place, once a round.');
        entry.freePass = true;
      }
      entry.tier = action.tier;
      entry.pickedBy = ctx.deviceId;
      g.entries[key] = entry;
      const own = action.cardId ? takeCard(g, action.tier, action.hole, action.cardId) : null;
      if (own) entry.cardId = own;
      else if (!ctx.predict) entry.cardId = drawCard(g, action.tier, action.hole, ctx.rng);
      break;
    }

    case 'swap': {
      if (g.status !== 'playing' || action.hole !== g.current) return fail("That hole isn't being played.");
      const key = entryKey(action.playerId, action.hole);
      const entry = g.entries[key];
      const card = getCard(entry?.cardId);
      if (!entry || !entry.tier || !card) return unchanged;
      if (!card.needsBunker) return fail('Only bunker cards can be swapped.');
      if (entry.strokes != null) return fail('This hole is already scored.');
      const oldId = card.id;
      const opts = { exclude: [oldId], noBunker: true };
      const own = action.cardId ? takeCard(g, entry.tier, action.hole, action.cardId, opts) : null;
      if (own) {
        entry.cardId = own;
        returnCard(g, oldId);
      } else if (ctx.predict) {
        delete entry.cardId;
      } else {
        entry.cardId = drawCard(g, entry.tier, action.hole, ctx.rng, opts);
        returnCard(g, oldId);
      }
      break;
    }

    case 'redraw': {
      if (g.status !== 'playing' || action.hole !== g.current) return fail("That hole isn't being played.");
      const key = entryKey(action.playerId, action.hole);
      const entry = g.entries[key];
      const card = getCard(entry?.cardId);
      if (!entry || !entry.tier || !card) return unchanged;
      if (entry.strokes != null) return fail('This hole is already scored.');
      if (redrawUsed(g, action.playerId)) return fail("You've used your redraw this round.");
      const oldId = card.id;
      const opts = { exclude: [oldId] };
      entry.redrawn = true;
      const own = action.cardId ? takeCard(g, entry.tier, action.hole, action.cardId, opts) : null;
      if (own) {
        entry.cardId = own;
        returnCard(g, oldId);
      } else if (ctx.predict) {
        delete entry.cardId;
      } else {
        entry.cardId = drawCard(g, entry.tier, action.hole, ctx.rng, opts);
        returnCard(g, oldId);
      }
      break;
    }

    case 'holeDone': {
      if (g.status !== 'playing' || action.hole !== g.current) return fail("That hole isn't being played.");
      const entry = g.entries[entryKey(action.playerId, action.hole)];
      if (!entry?.tier) return fail('Draw a card for this hole first.');
      if (entry.done) return unchanged;
      entry.done = true;
      break;
    }

    case 'vote': {
      if (g.status !== 'playing' || action.hole !== g.current) return fail('Voting has closed on that hole.');
      const voter = findPlayer(action.voterId);
      if (!voter || voter.deviceId !== ctx.deviceId) return fail('You can only vote for yourself.');
      if (action.voterId === action.playerId) return fail("You can't vote on your own claim.");
      if (!isVoteable(g, action.playerId, action.hole)) return fail('Nothing to vote on.');
      const entry = g.entries[entryKey(action.playerId, action.hole)];
      if (entry.votes?.[action.voterId] === action.fair) return unchanged;
      entry.votes = { ...entry.votes, [action.voterId]: action.fair };
      break;
    }

    case 'score': {
      if (g.status === 'lobby') return fail("The game hasn't started.");
      const hole = g.holes[action.hole];
      if (!hole || action.hole > g.current) return fail("That hole hasn't been played yet.");
      if (!findPlayer(action.playerId)) return fail('Player not found.');
      const strokes = action.strokes;
      if (!Number.isInteger(strokes) || strokes < LIMITS.minStrokes || strokes > LIMITS.maxStrokes) {
        return fail(`Strokes must be between ${LIMITS.minStrokes} and ${LIMITS.maxStrokes}.`);
      }
      const key = entryKey(action.playerId, action.hole);
      const entry = g.entries[key];
      const card = getCard(entry?.cardId);
      if (!entry || !card || hole.par == null) return fail('Draw a card for this hole first.');
      if (action.outcome !== undefined) {
        const choices = outcomeChoices(card);
        if (choices.length > 0 && !choices.includes(action.outcome)) return fail("That result doesn't fit this card.");
      }
      // A changed claim starts a fresh vote.
      if (entry.strokes !== strokes || (action.outcome !== undefined && action.outcome !== entry.outcome)) delete entry.votes;
      entry.strokes = strokes;
      entry.done = true;
      // Store the result the strokes settle too, so it survives a later par correction.
      // "Didn't happen" on a situational card stands even if the strokes would rule it out.
      const requested = action.outcome ?? entry.outcome;
      const auto = judgeFromStrokes(card, hole.par, strokes);
      const outcome = card.situational && requested === 'na' ? 'na' : (auto ?? requested);
      if (outcome) entry.outcome = outcome;
      else delete entry.outcome;
      break;
    }

    case 'nextHole': {
      if (g.status !== 'playing' || action.from !== g.current) return unchanged;
      if (!holeComplete(g, g.current)) return fail('Waiting for everyone to finish the hole.');
      if (g.current >= g.holes.length - 1) g.status = 'finished';
      else g.current += 1;
      break;
    }

    case 'finish': {
      if (g.status === 'finished') return unchanged;
      if (!isHost) return fail('Only the host can end the round.');
      g.status = 'finished';
      break;
    }

    default:
      return fail('Unknown action.');
  }

  g.seq += 1;
  g.updatedAt = ctx.now;
  return { ok: true, game: g, changed: true };
}
