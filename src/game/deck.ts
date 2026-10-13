import { CARDS, getCard } from './cards';
import { entryKey, isEligible } from './rules';
import type { Game, Tier } from './types';

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function freshDeck(tier: Tier, rng: () => number): string[] {
  return shuffle(
    CARDS.filter((c) => c.tier === tier && c.enabled).map((c) => c.id),
    rng,
  );
}

interface DrawOptions {
  /** Card ids that must not be dealt (e.g. the card being swapped away). */
  exclude?: readonly string[];
  /** Skip cards that need a bunker (used when swapping one of those away). */
  noBunker?: boolean;
}

/**
 * Deals a card from the tier's shared deck for this hole. Mutates game.decks.
 *
 * Every tier has one shuffled deck for the whole game, so cards don't repeat until
 * the deck runs out, and players on the same hole get different cards. Cards that
 * don't fit this hole's par stay in the deck for a later hole.
 */
export function drawCard(game: Game, tier: Tier, hole: number, rng: () => number, opts: DrawOptions = {}): string {
  const par = game.holes[hole]?.par;
  if (par == null) throw new Error('Hole has no par yet');

  const held = new Set<string>();
  for (const p of game.players) {
    const id = game.entries[entryKey(p.id, hole)]?.cardId;
    if (id) held.add(id);
  }
  const excluded = new Set(opts.exclude ?? []);

  const fits = (id: string) => {
    const card = getCard(id);
    if (!card || card.tier !== tier || !isEligible(card, par, game.settings)) return false;
    return !(opts.noBunker && card.needsBunker) && !excluded.has(id);
  };

  game.decks ??= {};
  let deck = game.decks[tier] ?? [];
  let index = deck.findIndex((id) => fits(id) && !held.has(id));

  if (index === -1) {
    // Deck has nothing left for this hole: reshuffle the whole tier.
    deck = freshDeck(tier, rng);
    index = deck.findIndex((id) => fits(id) && !held.has(id));
  }

  if (index === -1) {
    // More players on this tier than cards that fit the hole, so a repeat is unavoidable.
    const pool = CARDS.filter((c) => fits(c.id)).map((c) => c.id);
    if (pool.length === 0) throw new Error(`No ${tier} card fits this hole`);
    game.decks[tier] = deck;
    return pool[Math.floor(rng() * pool.length)];
  }

  const [id] = deck.splice(index, 1);
  game.decks[tier] = deck;
  return id;
}

/**
 * Uses a card the phone dealt itself while offline, if it's allowed here: right tier,
 * fits the hole and settings, and no one else on this hole holds it. Takes it out of
 * the deck too. Returns null when it isn't allowed, so the caller deals another.
 */
export function takeCard(game: Game, tier: Tier, hole: number, cardId: string, opts: DrawOptions = {}): string | null {
  const par = game.holes[hole]?.par;
  const card = getCard(cardId);
  if (par == null || !card || card.tier !== tier || !isEligible(card, par, game.settings)) return null;
  if ((opts.noBunker && card.needsBunker) || opts.exclude?.includes(cardId)) return null;
  if (game.players.some((p) => game.entries[entryKey(p.id, hole)]?.cardId === cardId)) return null;
  const deck = game.decks?.[tier];
  if (deck) {
    const i = deck.indexOf(cardId);
    if (i !== -1) deck.splice(i, 1);
  }
  return cardId;
}

/** Puts a swapped-away card back at the bottom of its deck. */
export function returnCard(game: Game, cardId: string): void {
  const card = getCard(cardId);
  if (!card) return;
  game.decks ??= {};
  const deck = game.decks[card.tier] ?? [];
  if (!deck.includes(cardId)) deck.push(cardId);
  game.decks[card.tier] = deck;
}
