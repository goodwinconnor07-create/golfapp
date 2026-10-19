// Ruleset 2 hands: before each hole a player sees one card from each level and picks one.
// A hand is worked out from the game's seed, the player and the hole, so every phone (and the server)
// deals the same cards with no extra messages, and play goes on with no signal. Nothing is stored
// until the player picks; the server checks the pick was in their hand.
import { CARDS, getCard, type CardDef } from './cards';
import { entryKey, fitsHand, isV2 } from './rules';
import { TIER_ORDER } from './tiers';
import type { Game, Tier } from './types';

export type Hand = Record<Tier, string>;

/** 32-bit FNV-1a hash of a string. */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whose hand it is: the player, or in 2v2 the team (partners share one hand, keyed on the first partner). */
function handOwner(game: Game, playerId: string): string {
  return game.teams?.find((t) => t.players.includes(playerId))?.players[0] ?? playerId;
}

/** A streak card isn't dealt while the owner picked one on either of the last two holes. */
function streakRecently(game: Game, owner: string, hole: number): boolean {
  for (let h = Math.max(0, hole - 2); h < hole; h++) {
    if (getCard(game.entries[entryKey(owner, h)]?.cardId)?.multi) return true;
  }
  return false;
}

const HANDS = new WeakMap<Game, Map<string, (Hand | null)[]>>();

/**
 * The hand for this player on this hole (ruleset 2 only), or null when the hole has no par yet.
 * No repeats: a card shown to a player earlier in the round isn't shown again until that level's
 * cards for the hole have all been seen.
 */
export function handFor(game: Game, playerId: string, hole: number): Hand | null {
  if (!isV2(game) || game.seed == null || hole < 0 || hole >= game.holes.length) return null;
  const owner = handOwner(game, playerId);
  let perGame = HANDS.get(game);
  if (!perGame) HANDS.set(game, (perGame = new Map()));
  let hands = perGame.get(owner);
  if (!hands) perGame.set(owner, (hands = []));
  if (hands.length > hole) return hands[hole];

  const seen = new Set<string>();
  for (const h of hands) if (h) for (const t of TIER_ORDER) seen.add(h[t]);
  for (let h = hands.length; h <= hole; h++) {
    const hand = dealHand(game, owner, h, seen);
    hands.push(hand);
    if (hand) for (const t of TIER_ORDER) seen.add(hand[t]);
  }
  return hands[hole];
}

function dealHand(game: Game, owner: string, hole: number, seen: Set<string>): Hand | null {
  if (game.holes[hole]?.par == null) return null;
  const rng = mulberry32(hash32(`${game.seed}|${owner}|${hole}`));
  const noStreak = streakRecently(game, owner, hole);
  const hand = {} as Hand;
  for (const tier of TIER_ORDER) {
    const pool = CARDS.filter((c: CardDef) => c.tier === tier && fitsHand(game, c, hole) && !(noStreak && c.multi)).map((c) => c.id);
    const fresh = pool.filter((id) => !seen.has(id));
    const from = fresh.length ? fresh : pool;
    // Core cards always fit, so a level is never empty.
    hand[tier] = from[Math.floor(rng() * from.length)];
  }
  return hand;
}

/** Can this player pick this card at this level from their hand? (Name It cards sit in the Bold slot.) */
export function inHand(hand: Hand | null, cardId: string, tier: Tier): boolean {
  if (!hand) return false;
  const card = getCard(cardId);
  if (!card) return false;
  if (card.nameIt) return hand.bold === cardId && Boolean(card.nameIt[tier]);
  return hand[tier] === cardId && card.tier === tier;
}
