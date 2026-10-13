import { CARDS, getCard, type CardDef } from './cards';
import { adjustmentFor } from './tiers';
import type { Entry, Game, Outcome, Par, Settings, Tier } from './types';

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
  return entry.outcome ?? null;
}

export interface HoleResult {
  tier: Tier;
  cardId: string;
  strokes: number;
  outcome: Outcome;
  adjustment: number;
  /** strokes + adjustment. May go below zero; never clamped. */
  gameScore: number;
}

/** Full result for one player on one hole, or null if it isn't finished yet. */
export function holeResult(game: Game, playerId: string, hole: number): HoleResult | null {
  const entry = getEntry(game, playerId, hole);
  const par = game.holes[hole]?.par ?? null;
  const outcome = resolveOutcome(entry, par);
  if (!entry || !entry.tier || !entry.cardId || entry.strokes == null || outcome == null) return null;
  const adjustment = adjustmentFor(entry.tier, outcome);
  return {
    tier: entry.tier,
    cardId: entry.cardId,
    strokes: entry.strokes,
    outcome,
    adjustment,
    gameScore: entry.strokes + adjustment,
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
