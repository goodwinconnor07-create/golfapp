import { CARDS, getCard, type CardDef } from './cards';
import { adjustmentFor } from './tiers';
import type { Entry, FixRequest, Game, Outcome, Par, Settings, Tier } from './types';

/** The last few holes of a round count double, so whoever's behind still has a shot. */
export const DOUBLE_STAKES_HOLES = 3;
/** Rounds shorter than this play at normal stakes throughout. */
export const DOUBLE_STAKES_MIN_ROUND = 6;

export function isDoubleHole(game: Pick<Game, 'holes'>, hole: number): boolean {
  const n = game.holes.length;
  return n >= DOUBLE_STAKES_MIN_ROUND && hole >= n - DOUBLE_STAKES_HOLES;
}

/**
 * Strokes a card adds or takes off on this hole: the tier's modifier, doubled on the
 * last holes, and nothing for a failed free shot. The tier values themselves never change.
 */
export function stakeFor(game: Pick<Game, 'holes'>, hole: number, tier: Tier, outcome: Outcome, freePass = false): number {
  if (outcome === 'missed' && freePass) return 0;
  return adjustmentFor(tier, outcome) * (isDoubleHole(game, hole) ? 2 : 1);
}

/** What completing and failing a card is worth on this hole, for showing on cards and buttons. */
export function cardStakes(game: Pick<Game, 'holes'>, hole: number, tier: Tier, freePass = false): { made: number; missed: number } {
  return { made: stakeFor(game, hole, tier, 'made'), missed: stakeFor(game, hole, tier, 'missed', freePass) };
}

/** Honour-system cards (judged by eye) go to a group vote when someone says they made it. */
export function needsVote(card: CardDef | undefined): boolean {
  return Boolean(card?.distance);
}

export function voteTally(entry: Entry | undefined): { fair: number; unfair: number } {
  const votes = Object.values(entry?.votes ?? {});
  return { fair: votes.filter(Boolean).length, unfair: votes.filter((v) => !v).length };
}

export function entryKey(playerId: string, hole: number): string {
  return `${playerId}:${hole}`;
}

export function getEntry(game: Game, playerId: string, hole: number): Entry | undefined {
  return game.entries[entryKey(playerId, hole)];
}

/** Can this card be dealt on a hole with this par, under these game settings? */
export function isEligible(card: CardDef, par: Par, settings: Settings): boolean {
  if (!card.enabled) return false;
  if (!card.pars.includes(par)) return false;
  if (card.distance && !settings.distanceCards) return false;
  if (card.situational && !settings.situationCards) return false;
  return true;
}

export function eligibleCards(tier: Tier, par: Par, settings: Settings): CardDef[] {
  return CARDS.filter((c) => c.tier === tier && isEligible(c, par, settings));
}

/**
 * What the strokes alone say about this card.
 * 'made' / 'missed' when the strokes settle it, null when a player has to call it.
 */
export function judgeFromStrokes(card: CardDef, par: Par, strokes: number): 'made' | 'missed' | null {
  if (card.score && strokes - par > card.score.maxToPar) return 'missed';
  const within = card.doneWithin;
  if (within && ((within.strokes != null && strokes <= within.strokes) || (within.toPar != null && strokes - par <= within.toPar))) {
    return 'made';
  }
  return card.score?.decides ? 'made' : null;
}

/** Outcomes a player can tap for this card. Empty when the strokes decide it. */
export function outcomeChoices(card: CardDef): Outcome[] {
  if (card.score?.decides) return [];
  return card.situational ? ['made', 'missed', 'na'] : ['made', 'missed'];
}

/**
 * The challenge result, worked out from the source fields every time
 * (so correcting strokes or par re-judges cards checked from strokes).
 */
export function resolveOutcome(entry: Entry | undefined, par: Par | null): Outcome | null {
  if (!entry || entry.strokes == null || par == null) return null;
  const card = getCard(entry.cardId);
  if (!card) return null;
  // "Didn't happen" beats a strokes check: the condition never applied.
  if (card.situational && entry.outcome === 'na') return 'na';
  const auto = judgeFromStrokes(card, par, entry.strokes);
  if (auto) return auto;
  const claimed = entry.outcome ?? null;
  // A claim the group votes down (more "no way" than "fair") counts as failed.
  if (claimed === 'made' && needsVote(card)) {
    const { fair, unfair } = voteTally(entry);
    if (unfair > fair) return 'missed';
  }
  return claimed;
}

/** Is this player's claim on the hole open to a group vote? */
export function isVoteable(game: Game, playerId: string, hole: number): boolean {
  const entry = getEntry(game, playerId, hole);
  const par = game.holes[hole]?.par;
  const card = getCard(entry?.cardId);
  if (!entry || !card || entry.strokes == null || par == null || !needsVote(card)) return false;
  return entry.outcome === 'made' && !judgeFromStrokes(card, par, entry.strokes);
}

/** Where a player is on the current hole: still out there, finished, or scored. */
export function holeStatus(game: Game, playerId: string, hole: number): 'playing' | 'done' | 'scored' {
  if (holeResult(game, playerId, hole)) return 'scored';
  return getEntry(game, playerId, hole)?.done ? 'done' : 'playing';
}

/** Has this player used their redraw this round? */
export function redrawUsed(game: Game, playerId: string): boolean {
  return game.holes.some((_, h) => getEntry(game, playerId, h)?.redrawn);
}

/** Has this player used their free shot this round? */
export function freePassUsed(game: Game, playerId: string): boolean {
  return game.holes.some((_, h) => getEntry(game, playerId, h)?.freePass);
}

export interface HoleResult {
  tier: Tier;
  cardId: string;
  strokes: number;
  outcome: Outcome;
  adjustment: number;
  /** strokes + adjustment. May go below zero; never clamped. */
  gameScore: number;
  par: Par;
  /** gameScore against par: negative = under. */
  toPar: number;
  /** Played on a double-stakes hole. */
  doubled: boolean;
  /** Played with the free shot. */
  freePass: boolean;
}

/** Full result for one player on one hole, or null if it isn't finished yet. */
export function holeResult(game: Game, playerId: string, hole: number): HoleResult | null {
  const entry = getEntry(game, playerId, hole);
  const par = game.holes[hole]?.par ?? null;
  const outcome = resolveOutcome(entry, par);
  if (!entry || !entry.tier || !entry.cardId || entry.strokes == null || outcome == null) return null;
  const adjustment = stakeFor(game, hole, entry.tier, outcome, entry.freePass);
  return {
    tier: entry.tier,
    cardId: entry.cardId,
    strokes: entry.strokes,
    outcome,
    adjustment,
    gameScore: entry.strokes + adjustment,
    par: par!,
    toPar: entry.strokes + adjustment - par!,
    doubled: isDoubleHole(game, hole),
    freePass: Boolean(entry.freePass),
  };
}

/** Has this player got a card (or a hidden pick) for the hole? */
export function hasPicked(entry: Entry | undefined): boolean {
  return Boolean(entry && (entry.tier || entry.hidden));
}

export function holeComplete(game: Game, hole: number): boolean {
  return game.players.length > 0 && game.players.every((p) => holeResult(game, p.id, hole) !== null);
}

export function allPicked(game: Game, hole: number): boolean {
  return game.players.every((p) => {
    const e = getEntry(game, p.id, hole);
    return Boolean(e && (e.cardId || e.hidden));
  });
}

/** Has any card been drawn on this hole? */
export function anyPicked(game: Game, hole: number): boolean {
  return game.players.some((p) => hasPicked(getEntry(game, p.id, hole)));
}

/** New players can join until the first hole is finished. */
export function canAddPlayers(game: Game): boolean {
  if (game.status === 'lobby') return true;
  return game.status === 'playing' && game.current === 0 && !holeComplete(game, 0);
}

// ── Who can change a score ──────────────────────────────────────────────────

/** This device runs that player: it claimed them, or they're a guest on the host's phone. */
export function ownsPlayer(game: Game, deviceId: string, playerId: string): boolean {
  const p = game.players.find((x) => x.id === playerId);
  if (!p) return false;
  return p.deviceId === deviceId || (p.deviceId === null && deviceId === game.hostDeviceId);
}

/** A hole is locked in once the group has moved past it, or the round is over. */
export function isLocked(game: Game, hole: number): boolean {
  return hole < game.current || game.status === 'finished';
}

/**
 * direct: save it now. request: ask the player (or host) to approve. none: not yours to touch.
 * One-phone games and the host are always direct. Online, you can enter and fix your own
 * score until the group moves on; after that, or for anyone else's score, you ask.
 */
export function scoreAccess(game: Game, deviceId: string, playerId: string, hole: number): 'direct' | 'request' | 'none' {
  if (!game.code || deviceId === game.hostDeviceId) return 'direct';
  const mine = ownsPlayer(game, deviceId, playerId);
  if (mine && !isLocked(game, hole)) return 'direct';
  return getEntry(game, playerId, hole)?.strokes != null ? 'request' : 'none';
}

/** The player whose score it is approves; if they asked themselves, the host does. The host can always. */
export function canApproveFix(game: Game, deviceId: string, fix: FixRequest): boolean {
  if (deviceId === game.hostDeviceId) return true;
  if (fix.by === deviceId) return false;
  return ownsPlayer(game, deviceId, fix.playerId);
}

/** Requests waiting on this phone's answer. */
export function fixesToAnswer(game: Game, deviceId: string): FixRequest[] {
  return (game.fixes ?? []).filter((f) => f.by !== deviceId && canApproveFix(game, deviceId, f));
}
