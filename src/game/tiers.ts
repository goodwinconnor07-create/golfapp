import type { Outcome, Tier } from './types';

export interface TierDef {
  id: Tier;
  label: string;
  /** Strokes added to the game score when the card is made (negative = better). */
  made: number;
  /** Strokes added to the game score when the card is missed. */
  missed: number;
}

// The fixed stroke modifiers. Changing these is a product decision, not a tweak:
// they were tuned together with the deck in docs/GAME_BALANCE.md (Oct 2026). Re-run the
// balance checks there before touching them.
export const TIERS: Record<Tier, TierDef> = {
  safe: { id: 'safe', label: 'Safe', made: -1, missed: 1 },
  bold: { id: 'bold', label: 'Bold', made: -2, missed: 2 },
  insane: { id: 'insane', label: 'Insane', made: -9, missed: 3 },
};

export const TIER_ORDER: readonly Tier[] = ['safe', 'bold', 'insane'];

export function isTier(value: unknown): value is Tier {
  return value === 'safe' || value === 'bold' || value === 'insane';
}

/** Strokes added to (or taken off) the game score for this tier and outcome. */
export function adjustmentFor(tier: Tier, outcome: Outcome): number {
  if (outcome === 'made') return TIERS[tier].made;
  if (outcome === 'missed') return TIERS[tier].missed;
  return 0;
}

/** "−4" / "+2" / "0", using a real minus sign. */
export function formatDelta(n: number): string {
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/** Golf-style score against par: "E", "+2", "−5". */
export function formatToPar(n: number): string {
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `\u2212${Math.abs(n)}`;
}

/** The same in words: "even par", "2 over", "5 under". */
export function toParWords(n: number): string {
  if (n === 0) return 'even par';
  return n > 0 ? `${n} over` : `${Math.abs(n)} under`;
}

/** Signed number with a real minus sign, for scores that can go below zero. */
export function formatSigned(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : String(n);
}
