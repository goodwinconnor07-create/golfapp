// Checks for anything arriving over the network. Every field is rebuilt from
// scratch, so unknown or oversized data never reaches stored game state.

import { CARDS, getCard } from './cards';
import { shuffle } from './deck';
import { isDeviceId } from './ids';
import { isNameBlocked } from './names';
import { cleanCourse, cleanName, DEFAULT_SETTINGS, isAvatarEmoji, PLAYER_COLORS } from './reducer';
import { isTier, TIER_ORDER } from './tiers';
import { LIMITS, type Action, type Entry, type Game, type Hole, type Outcome, type Par, type Player, type Settings } from './types';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isPar = (v: unknown): v is Par => v === 3 || v === 4 || v === 5;
const isOutcome = (v: unknown): v is Outcome => v === 'made' || v === 'missed' || v === 'na';

export const isPlayerId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9]{6,24}$/.test(v);

const maxHole = LIMITS.maxHoles - 1;

/** Returns a clean Action, or null if the input isn't a valid one. */
export function parseAction(input: unknown): Action | null {
  if (!isObj(input) || typeof input.type !== 'string') return null;
  const a = input;
  switch (a.type) {
    case 'addPlayer':
      if (!isPlayerId(a.id) || !isStr(a.name, 60)) return null;
      if (a.claim !== undefined && typeof a.claim !== 'boolean') return null;
      return {
        type: 'addPlayer',
        id: a.id,
        name: a.name,
        claim: a.claim === true,
        ...(isAvatarEmoji(a.emoji) ? { emoji: a.emoji } : {}),
        ...(isInt(a.color, 0, PLAYER_COLORS - 1) ? { color: a.color } : {}),
      };
    case 'setLook':
      if (!isPlayerId(a.playerId) || !(a.emoji === null || isAvatarEmoji(a.emoji)) || !isInt(a.color, 0, PLAYER_COLORS - 1)) return null;
      return { type: 'setLook', playerId: a.playerId, emoji: a.emoji, color: a.color };
    case 'renamePlayer':
      if (!isPlayerId(a.playerId) || !isStr(a.name, 60)) return null;
      return { type: 'renamePlayer', playerId: a.playerId, name: a.name };
    case 'removePlayer':
    case 'claimPlayer':
    case 'releasePlayer':
      if (!isPlayerId(a.playerId)) return null;
      return { type: a.type, playerId: a.playerId };
    case 'setPar':
      if (!isInt(a.hole, 0, maxHole) || !isPar(a.par)) return null;
      return { type: 'setPar', hole: a.hole, par: a.par };
    case 'setCourse':
      if (!isStr(a.course, 100)) return null;
      return { type: 'setCourse', course: a.course };
    case 'setSettings': {
      if (!isObj(a.settings)) return null;
      const settings: Partial<Settings> = {};
      for (const key of ['distanceCards', 'situationCards', 'tiebreakOnStrokes', 'mulligans'] as const) {
        const v = a.settings[key];
        if (v === undefined) continue;
        if (typeof v !== 'boolean') return null;
        settings[key] = v;
      }
      return { type: 'setSettings', settings };
    }
    case 'start':
    case 'finish':
      return { type: a.type };
    case 'pick':
      if (!isPlayerId(a.playerId) || !isInt(a.hole, 0, maxHole) || !isTier(a.tier)) return null;
      if (a.cardId !== undefined && !getCard(typeof a.cardId === 'string' ? a.cardId : undefined)) return null;
      if (a.freePass !== undefined && typeof a.freePass !== 'boolean') return null;
      return {
        type: 'pick',
        playerId: a.playerId,
        hole: a.hole,
        tier: a.tier,
        ...(a.cardId === undefined ? {} : { cardId: a.cardId as string }),
        ...(a.freePass ? { freePass: true } : {}),
      };
    case 'holeDone':
      if (!isPlayerId(a.playerId) || !isInt(a.hole, 0, maxHole)) return null;
      return { type: 'holeDone', playerId: a.playerId, hole: a.hole };
    case 'redraw':
      if (!isPlayerId(a.playerId) || !isInt(a.hole, 0, maxHole)) return null;
      if (a.cardId !== undefined && !getCard(typeof a.cardId === 'string' ? a.cardId : undefined)) return null;
      return a.cardId === undefined
        ? { type: 'redraw', playerId: a.playerId, hole: a.hole }
        : { type: 'redraw', playerId: a.playerId, hole: a.hole, cardId: a.cardId as string };
    case 'vote':
      if (!isPlayerId(a.playerId) || !isPlayerId(a.voterId) || !isInt(a.hole, 0, maxHole) || typeof a.fair !== 'boolean') return null;
      return { type: 'vote', playerId: a.playerId, hole: a.hole, voterId: a.voterId, fair: a.fair };
    case 'swap':
      if (!isPlayerId(a.playerId) || !isInt(a.hole, 0, maxHole)) return null;
      if (a.cardId !== undefined && !getCard(typeof a.cardId === 'string' ? a.cardId : undefined)) return null;
      return a.cardId === undefined
        ? { type: 'swap', playerId: a.playerId, hole: a.hole }
        : { type: 'swap', playerId: a.playerId, hole: a.hole, cardId: a.cardId as string };
    case 'score':
      if (!isPlayerId(a.playerId) || !isInt(a.hole, 0, maxHole)) return null;
      if (!isInt(a.strokes, LIMITS.minStrokes, LIMITS.maxStrokes)) return null;
      if (a.outcome !== undefined && !isOutcome(a.outcome)) return null;
      if (a.mulligan !== undefined && typeof a.mulligan !== 'boolean') return null;
      return {
        type: 'score',
        playerId: a.playerId,
        hole: a.hole,
        strokes: a.strokes,
        ...(a.outcome !== undefined ? { outcome: a.outcome } : {}),
        ...(a.mulligan !== undefined ? { mulligan: a.mulligan } : {}),
      };
    case 'mulligan':
      if (!isPlayerId(a.playerId) || !isInt(a.hole, 0, maxHole) || typeof a.on !== 'boolean') return null;
      return { type: 'mulligan', playerId: a.playerId, hole: a.hole, on: a.on };
    case 'requestFix':
      if (!isStr(a.id, 24) || !/^[a-z0-9]{6,24}$/.test(a.id) || !isPlayerId(a.playerId) || !isInt(a.hole, 0, maxHole)) return null;
      if (!isInt(a.strokes, LIMITS.minStrokes, LIMITS.maxStrokes)) return null;
      if (a.outcome !== undefined && !isOutcome(a.outcome)) return null;
      return {
        type: 'requestFix',
        id: a.id,
        playerId: a.playerId,
        hole: a.hole,
        strokes: a.strokes,
        ...(a.outcome !== undefined ? { outcome: a.outcome } : {}),
      };
    case 'answerFix':
      if (!isStr(a.id, 24) || !/^[a-z0-9]{6,24}$/.test(a.id) || typeof a.accept !== 'boolean') return null;
      return { type: 'answerFix', id: a.id, accept: a.accept };
    case 'nextHole':
      if (!isInt(a.from, 0, maxHole)) return null;
      return { type: 'nextHole', from: a.from };
    default:
      return null;
  }
}

/** Fresh shuffled decks that leave out cards already dealt in this game. */
export function rebuildDecks(game: Game, rng: () => number): NonNullable<Game['decks']> {
  const dealt = new Set(Object.values(game.entries).map((e) => e.cardId));
  const decks: NonNullable<Game['decks']> = {};
  for (const tier of TIER_ORDER) {
    decks[tier] = shuffle(
      CARDS.filter((c) => c.tier === tier && c.enabled && !dealt.has(c.id)).map((c) => c.id),
      rng,
    );
  }
  return decks;
}

/**
 * Turns a game uploaded by a phone (when a one-phone game goes online) into a
 * clean server game owned by that phone. Returns null if it's unusable.
 */
export function sanitizeUpload(input: unknown, hostDeviceId: string, now: number, rng: () => number): Game | null {
  if (!isObj(input) || !isDeviceId(hostDeviceId)) return null;

  if (!Array.isArray(input.holes) || input.holes.length < 1 || input.holes.length > LIMITS.maxHoles) return null;
  const holes: Hole[] = [];
  for (const h of input.holes) {
    if (!isObj(h) || !isInt(h.number, 1, 18) || !(h.par === null || isPar(h.par))) return null;
    holes.push({ number: h.number, par: h.par });
  }

  if (!Array.isArray(input.players) || input.players.length < 1 || input.players.length > LIMITS.maxPlayers) return null;
  const players: Player[] = [];
  const ids = new Set<string>();
  for (const p of input.players) {
    if (!isObj(p) || !isPlayerId(p.id) || ids.has(p.id) || !isStr(p.name, 60)) return null;
    const name = cleanName(p.name);
    if (!name) return null;
    ids.add(p.id);
    players.push({
      id: p.id,
      // The phone checks names too; this catches anything that slips past it.
      name: isNameBlocked(name) ? `Player ${players.length + 1}` : name,
      color: isInt(p.color, 0, PLAYER_COLORS - 1) ? p.color : players.length % PLAYER_COLORS,
      ...(isAvatarEmoji(p.emoji) ? { emoji: p.emoji } : {}),
      deviceId: isDeviceId(p.deviceId) ? p.deviceId : null,
    });
  }

  const status = input.status === 'playing' || input.status === 'finished' ? input.status : 'lobby';
  const current = isInt(input.current, 0, holes.length - 1) ? input.current : 0;

  const settings: Settings = { ...DEFAULT_SETTINGS };
  if (isObj(input.settings)) {
    for (const key of ['distanceCards', 'situationCards', 'tiebreakOnStrokes', 'mulligans'] as const) {
      if (typeof input.settings[key] === 'boolean') settings[key] = input.settings[key] as boolean;
    }
  }

  const entries: Record<string, Entry> = {};
  if (isObj(input.entries)) {
    for (const [key, raw] of Object.entries(input.entries)) {
      const [pid, holeText] = key.split(':');
      const hole = Number(holeText);
      if (!ids.has(pid) || !isInt(hole, 0, current) || `${pid}:${hole}` !== key || !isObj(raw)) continue;
      if (!isTier(raw.tier)) continue;
      const card = getCard(typeof raw.cardId === 'string' ? raw.cardId : undefined);
      if (!card || card.tier !== raw.tier) continue;
      const entry: Entry = { tier: raw.tier, cardId: card.id };
      if (isDeviceId(raw.pickedBy)) entry.pickedBy = raw.pickedBy;
      if (isInt(raw.strokes, LIMITS.minStrokes, LIMITS.maxStrokes)) entry.strokes = raw.strokes;
      if (isOutcome(raw.outcome) && (raw.outcome !== 'na' || card.situational)) entry.outcome = raw.outcome;
      if (raw.freePass === true) entry.freePass = true;
      if (raw.mulligan === true) entry.mulligan = true;
      if (raw.redrawn === true) entry.redrawn = true;
      if (raw.done === true) entry.done = true;
      if (isObj(raw.votes)) {
        const votes: Record<string, boolean> = {};
        for (const [voter, fair] of Object.entries(raw.votes))
          if (ids.has(voter) && voter !== pid && typeof fair === 'boolean') votes[voter] = fair;
        if (Object.keys(votes).length) entry.votes = votes;
      }
      entries[key] = entry;
    }
  }

  const game: Game = {
    v: 1,
    id: isPlayerId(input.id) ? input.id : 'game' + now.toString(36),
    code: null,
    hostDeviceId,
    createdAt: isInt(input.createdAt, 0, now) ? input.createdAt : now,
    updatedAt: now,
    course: isStr(input.course, 100) ? cleanCourse(input.course) : '',
    status,
    holes,
    current,
    players,
    entries,
    settings,
    decks: {},
    seq: 0,
  };
  game.decks = rebuildDecks(game, rng);
  return game;
}
