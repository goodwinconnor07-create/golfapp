import { getCard } from './cards';
import { isNameBlocked, NAME_BLOCKED } from './names';
import { drawCard, returnCard, takeCard } from './deck';
import {
  anyPicked,
  canAddPlayers,
  mulligansLeft,
  canApproveFix,
  entryKey,
  getEntry,
  holeComplete,
  isLocked,
  isVoteable,
  judgeFromStrokes,
  lastHoleToPar,
  outcomeChoices,
  ownsPlayer,
  redrawUsed,
  scoreAccess,
} from './rules';
import { freePassAvailable } from './selectors';
import { isTier } from './tiers';
import {
  LIMITS,
  type Action,
  type ActionContext,
  type Entry,
  type FixRequest,
  type Game,
  type Hole,
  type Outcome,
  type Player,
  type ScoreEdit,
  type Settings,
} from './types';

export const DEFAULT_SETTINGS: Settings = {
  distanceCards: true,
  situationCards: false,
  tiebreakOnStrokes: false,
  mulligans: true,
};

export const PLAYER_COLORS = 8;

/** The avatar emojis players can pick from. Anything else from the network is dropped. */
export const AVATAR_EMOJIS = ['⛳️', '🏌️‍♂️', '🏌️‍♀️', '😈', '⭐️', '😀', '😤', '🥱', '🤫', '🫪', '🐐', '👑', '🍀'] as const;
/** The earlier set. No longer offered, but players who already picked one keep it. */
const RETIRED_AVATAR_EMOJIS = ['⛳', '🏌️', '🐦', '🦅', '🔥', '😎', '🦈', '🍺', '🎯', '🌵'];
/** One-tap reactions and heckles on someone's hole result. */
export const REACTIONS = ['🔥', '👏', '😂', '🫣', '🤡'] as const;
export const isReaction = (v: unknown): v is string => typeof v === 'string' && (REACTIONS as readonly string[]).includes(v);

export const isAvatarEmoji = (v: unknown): v is string => typeof v === 'string' && ((AVATAR_EMOJIS as readonly string[]).includes(v) || RETIRED_AVATAR_EMOJIS.includes(v));

/** The wanted colour if nobody else has it, else the first free one. */
function freeColor(players: Player[], want?: number, exceptId?: string): number {
  const used = new Set(players.filter((p) => p.id !== exceptId).map((p) => p.color));
  if (want != null && want >= 0 && want < PLAYER_COLORS && !used.has(want)) return want;
  let color = 0;
  while (used.has(color) && color < PLAYER_COLORS - 1) color++;
  return color;
}

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
  players: { id: string; name: string; emoji?: string; color?: number }[];
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
    players: input.players.reduce<Player[]>((list, p, i) => {
      list.push({
        id: p.id,
        name: cleanName(p.name),
        color: freeColor(list, p.color ?? i % PLAYER_COLORS),
        ...(isAvatarEmoji(p.emoji) ? { emoji: p.emoji } : {}),
        deviceId: i === 0 ? input.hostDeviceId : null,
      });
      return list;
    }, []),
    entries: {},
    settings: { ...DEFAULT_SETTINGS, ...input.settings },
    decks: {},
    seq: 0,
  };
}

/** Saves strokes (and the tapped result) for a played hole. Returns an error, or null. Mutates g. */
function writeScore(
  g: Game,
  playerId: string,
  holeIdx: number,
  strokesIn: number,
  tapped: Outcome | undefined,
  mulligan?: boolean,
): string | null {
  const hole = g.holes[holeIdx];
  if (!hole || holeIdx > g.current) return "That hole hasn't been played yet.";
  const strokes = strokesIn;
  if (!Number.isInteger(strokes) || strokes < LIMITS.minStrokes || strokes > LIMITS.maxStrokes) {
    return `Strokes must be between ${LIMITS.minStrokes} and ${LIMITS.maxStrokes}.`;
  }
  const key = entryKey(playerId, holeIdx);
  const entry = g.entries[key];
  const card = getCard(entry?.cardId);
  if (!entry || !card || hole.par == null) return 'Draw a card for this hole first.';
  if (tapped !== undefined) {
    const choices = outcomeChoices(card);
    if (choices.length > 0 && !choices.includes(tapped)) return "That result doesn't fit this card.";
  }
  if (mulligan === true && !entry.mulligan && mulligansLeft(g, playerId) <= 0) return 'No mulligans left.';
  // A changed claim starts a fresh vote.
  if (entry.strokes !== strokes || (tapped !== undefined && tapped !== entry.outcome)) delete entry.votes;
  entry.strokes = strokes;
  entry.done = true;
  if (mulligan === true) entry.mulligan = true;
  else if (mulligan === false) delete entry.mulligan;
  // Store the result the strokes settle too, so it survives a later par correction.
  // "Didn't happen" on a situational card stands even if the strokes would rule it out.
  const requested = tapped ?? entry.outcome;
  const auto = judgeFromStrokes(card, hole.par, strokes, lastHoleToPar(g, playerId, holeIdx));
  const outcome = card.situational && requested === 'na' ? 'na' : (auto ?? requested);
  if (outcome) entry.outcome = outcome;
  else delete entry.outcome;
  return null;
}

function logEdit(g: Game, playerId: string, hole: number, from: ScoreEdit['from'], how: string, at: number): void {
  const e = getEntry(g, playerId, hole);
  if (!e || e.strokes == null) return;
  if (e.strokes === from.strokes && e.outcome === from.outcome) return;
  g.edits = [...(g.edits ?? []), { playerId, hole, from, to: { strokes: e.strokes, outcome: e.outcome }, how, at }].slice(-100);
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
  // Online, a player's own phone (or the host, stepping in for a dead phone) acts for them.
  const actsFor = (id: string) => !g.code || isHost || ownsPlayer(g, ctx.deviceId, id);

  switch (action.type) {
    case 'addPlayer': {
      if (findPlayer(action.id)) return unchanged;
      if (!canAddPlayers(g)) return fail('Too late to add players to this round.');
      if (g.players.length >= LIMITS.maxPlayers) return fail(`A game can have up to ${LIMITS.maxPlayers} players.`);
      if (!isHost && !action.claim) return fail('Only the host can add guests.');
      const name = cleanName(action.name);
      if (!name) return fail('Add a name.');
      if (isNameBlocked(name)) return fail(NAME_BLOCKED);
      g.players.push({
        id: action.id,
        name,
        color: freeColor(g.players, action.color),
        ...(isAvatarEmoji(action.emoji) ? { emoji: action.emoji } : {}),
        deviceId: action.claim ? ctx.deviceId : null,
      });
      break;
    }

    case 'setLook': {
      const player = findPlayer(action.playerId);
      if (!player) return fail('Player not found.');
      if (!isHost && player.deviceId !== ctx.deviceId) return fail('You can only change your own picture.');
      if (action.emoji !== null && !isAvatarEmoji(action.emoji)) return fail('Pick one of the pictures.');
      if (action.color < 0 || action.color >= PLAYER_COLORS) return fail('Pick one of the colours.');
      if (g.players.some((p) => p.id !== player.id && p.color === action.color)) return fail('Someone else has that colour.');
      if (player.color === action.color && (player.emoji ?? null) === action.emoji) return unchanged;
      player.color = action.color;
      if (action.emoji) player.emoji = action.emoji;
      else delete player.emoji;
      break;
    }

    case 'renamePlayer': {
      const player = findPlayer(action.playerId);
      if (!player) return fail('Player not found.');
      if (!isHost && player.deviceId !== ctx.deviceId) return fail('You can only rename yourself.');
      const name = cleanName(action.name);
      if (!name) return fail('Add a name.');
      if (name === player.name) return unchanged;
      if (isNameBlocked(name)) return fail(NAME_BLOCKED);
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
      for (const key of ['distanceCards', 'situationCards', 'tiebreakOnStrokes', 'mulligans'] as const) {
        const value = action.settings[key];
        if (typeof value !== 'boolean') continue;
        // Mulligans are set before the round and stay fixed once it starts.
        if (key === 'mulligans' && g.status !== 'lobby' && value !== g.settings.mulligans)
          return fail('Mulligans are set before the round starts.');
        g.settings[key] = value;
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
      if (!actsFor(action.playerId)) return fail('Only the host can pick for someone else.');
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
      if (!actsFor(action.playerId)) return fail("That's not your card.");
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
      if (!actsFor(action.playerId)) return fail("That's not your card.");
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

    case 'mulligan': {
      if (g.status !== 'playing' || action.hole !== g.current) return fail("That hole isn't being played.");
      if (!findPlayer(action.playerId)) return fail('Player not found.');
      if (g.code && !isHost && !ownsPlayer(g, ctx.deviceId, action.playerId)) return fail('You can only take your own mulligans.');
      const entry = g.entries[entryKey(action.playerId, action.hole)];
      if (!entry?.tier) return fail('Draw a card for this hole first.');
      if (Boolean(entry.mulligan) === action.on) return unchanged;
      if (action.on && mulligansLeft(g, action.playerId) <= 0) return fail('No mulligans left.');
      if (action.on) entry.mulligan = true;
      else delete entry.mulligan;
      break;
    }

    case 'holeDone': {
      if (g.status !== 'playing' || action.hole !== g.current) return fail("That hole isn't being played.");
      const entry = g.entries[entryKey(action.playerId, action.hole)];
      if (!entry?.tier) return fail('Draw a card for this hole first.');
      if (!actsFor(action.playerId)) return fail("That's not your hole to finish.");
      // "Not done yet": back to playing, as long as no score is in.
      if (action.undo) {
        if (entry.strokes != null) return fail('This hole is already scored.');
        if (!entry.done) return unchanged;
        delete entry.done;
        break;
      }
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

    case 'react': {
      // Open while the hole is on screen, closed once the group moves on (like votes).
      if (g.status !== 'playing' || action.hole !== g.current) return fail('Reactions have closed on that hole.');
      if (!findPlayer(action.playerId) || !ownsPlayer(g, ctx.deviceId, action.fromId)) return fail('You can only react as yourself.');
      if (action.fromId === action.playerId) return fail("You can't react to your own hole.");
      const entry = g.entries[entryKey(action.playerId, action.hole)];
      if (entry?.strokes == null) return fail('Nothing to react to yet.');
      if ((entry.reactions?.[action.fromId] ?? null) === action.emoji) return unchanged;
      const next = { ...entry.reactions };
      if (action.emoji) next[action.fromId] = action.emoji;
      else delete next[action.fromId];
      if (Object.keys(next).length) entry.reactions = next;
      else delete entry.reactions;
      break;
    }

    case 'score': {
      if (g.status === 'lobby') return fail("The game hasn't started.");
      if (!findPlayer(action.playerId)) return fail('Player not found.');
      const access = scoreAccess(g, ctx.deviceId, action.playerId, action.hole);
      if (access === 'none') return fail("Only the host can enter someone else's score.");
      if (access === 'request') return fail('That hole is locked in. Ask to change it instead.');
      const before = getEntry(g, action.playerId, action.hole);
      const from = before?.strokes != null ? { strokes: before.strokes, outcome: before.outcome } : null;
      const err = writeScore(g, action.playerId, action.hole, action.strokes, action.outcome, action.mulligan);
      if (err) return fail(err);
      // Online, a change to a score after the hole is locked in (or to someone else's) is shown to everyone.
      if (from && g.code && (isLocked(g, action.hole) || !ownsPlayer(g, ctx.deviceId, action.playerId))) {
        logEdit(g, action.playerId, action.hole, from, 'Host', ctx.now);
      }
      break;
    }

    case 'requestFix': {
      if (!g.code) return fail('Just fix it: everyone is on this phone.');
      const player = findPlayer(action.playerId);
      const entry = getEntry(g, action.playerId, action.hole);
      if (!player || entry?.strokes == null) return fail('There is no score to change yet.');
      if (scoreAccess(g, ctx.deviceId, action.playerId, action.hole) !== 'request') return fail('You can change this score yourself.');
      if (g.fixes?.some((f) => f.id === action.id)) return unchanged;
      const asker = g.players.find((p) => p.deviceId === ctx.deviceId);
      const fix: FixRequest = {
        id: action.id,
        playerId: action.playerId,
        hole: action.hole,
        strokes: action.strokes,
        ...(action.outcome ? { outcome: action.outcome } : {}),
        by: ctx.deviceId,
        byName: asker?.name ?? 'Someone',
      };
      // One open request per score: a new one replaces the old.
      g.fixes = [...(g.fixes ?? []).filter((f) => !(f.playerId === fix.playerId && f.hole === fix.hole)), fix];
      break;
    }

    case 'answerFix': {
      const fix = g.fixes?.find((f) => f.id === action.id);
      if (!fix) return unchanged;
      const withdraw = fix.by === ctx.deviceId && !action.accept;
      if (!withdraw && !canApproveFix(g, ctx.deviceId, fix)) return fail("It's not yours to approve.");
      g.fixes = g.fixes!.filter((f) => f.id !== fix.id);
      if (!g.fixes.length) delete g.fixes;
      if (!action.accept) break;
      const before = getEntry(g, fix.playerId, fix.hole);
      const from = before?.strokes != null ? { strokes: before.strokes, outcome: before.outcome } : null;
      const err = writeScore(g, fix.playerId, fix.hole, fix.strokes, fix.outcome);
      if (err) return fail(err);
      const approver = isHost ? 'the host' : (g.players.find((p) => p.deviceId === ctx.deviceId)?.name ?? 'the player');
      if (from) logEdit(g, fix.playerId, fix.hole, from, `${fix.byName} asked · approved by ${approver}`, ctx.now);
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
