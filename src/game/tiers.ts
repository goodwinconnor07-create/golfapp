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

/**
 * Team games (2v2, partners share one card and the team completes it if either partner does) are
 * valued separately: a pair finishes a card far more often than one player, so the numbers differ.
 * Tuned in the Oct 2026 team simulation; see docs/GAME_BALANCE.md before changing.
 */
export const TEAM_TIERS: Record<Tier, TierDef> = {
  safe: { id: 'safe', label: 'Safe', made: -3, missed: 2 },
  bold: { id: 'bold', label: 'Bold', made: -4, missed: 3 },
  insane: { id: 'insane', label: 'Insane', made: -12, missed: 4 },
};

/**
 * Ruleset 2 (players pick from a hand of three): players take the good Insane cards, so Insane lands
 * more often (about 30–40% instead of 28%) and its fail costs one more. Simulated in scripts/concepts.
 */
export const TIERS_V2: Record<Tier, TierDef> = {
  safe: TIERS.safe,
  bold: TIERS.bold,
  insane: { id: 'insane', label: 'Insane', made: -9, missed: 4 },
};

/** The values in play: solo or team, older games or ruleset 2. Team values are the same in both. */
export const tiersFor = (teams: boolean, rules?: 2): Record<Tier, TierDef> => (teams ? TEAM_TIERS : rules === 2 ? TIERS_V2 : TIERS);

export const TIER_ORDER: readonly Tier[] = ['safe', 'bold', 'insane'];

export function isTier(value: unknown): value is Tier {
  return value === 'safe' || value === 'bold' || value === 'insane';
}

/** Strokes added to (or taken off) the game score for this tier and outcome. */
export function adjustmentFor(tier: Tier, outcome: Outcome, teams = false, rules?: 2): number {
  const t = tiersFor(teams, rules)[tier];
  if (outcome === 'made') return t.made;
  if (outcome === 'missed') return t.missed;
  return 0;
}

/**
 * A number with halves for team averages: 3 → "3", 2.5 → "2½", 0.5 → "½". (A team's score is the
 * average of two players', so it lands on whole numbers or halves.)
 */
export function halves(n: number): string {
  const abs = Math.abs(n);
  const whole = Math.floor(abs + 1e-9);
  const half = abs - whole > 0.25;
  return half ? (whole === 0 ? '½' : `${whole}½`) : String(whole);
}

/** "−4" / "+2" / "0", using a real minus sign. */
export function formatDelta(n: number): string {
  if (n === 0) return '0';
  return n > 0 ? `+${halves(n)}` : `\u2212${halves(n)}`;
}

/** Golf-style score against par: "E", "+2", "−5". */
export function formatToPar(n: number): string {
  if (n === 0) return 'E';
  return n > 0 ? `+${halves(n)}` : `\u2212${halves(n)}`;
}

/** The same in words: "even par", "2 over", "5 under". */
export function toParWords(n: number): string {
  if (n === 0) return 'even par';
  return n > 0 ? `${halves(n)} over` : `${halves(n)} under`;
}

/** Signed number with a real minus sign, for scores that can go below zero. */
export function formatSigned(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : String(n);
}
