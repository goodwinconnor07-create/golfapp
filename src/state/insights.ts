// "How you play" and "Play again" on Home, worked out from the rounds saved on this phone.
// Only rounds this phone hosted count, and only the host's own player in them.

import { TIER_ORDER, type Tier } from '../game';
import type { GameRecord } from './persist';

export interface Insights {
  rounds: number;
  wins: number;
  picks: Record<Tier, number>;
  /** The level picked most, or null when no level has a clear lead. */
  mostly: Tier | null;
  /** [drawn, made] per level. */
  cards: Record<Tier, [number, number]>;
  /** The card made most often (drawn at least twice), with [drawn, made]. */
  best: { cardId: string; drawn: number; made: number } | null;
}

/** A level counts as "mostly" once it's at least this share of picks. */
const MOSTLY_SHARE = 0.45;

export function homeInsights(records: readonly GameRecord[]): Insights | null {
  const mine = records.flatMap((r) => (r.mine ? [r.mine] : []));
  if (mine.length === 0) return null;
  const picks: Record<Tier, number> = { safe: 0, bold: 0, insane: 0 };
  const made: Record<Tier, number> = { safe: 0, bold: 0, insane: 0 };
  const byCard = new Map<string, [number, number]>();
  for (const m of mine) {
    for (const t of TIER_ORDER) {
      picks[t] += m.picks[t] ?? 0;
      made[t] += m.made[t] ?? 0;
    }
    for (const [id, [d, k]] of Object.entries(m.cards ?? {})) {
      const [d0, k0] = byCard.get(id) ?? [0, 0];
      byCard.set(id, [d0 + d, k0 + k]);
    }
  }
  const total = TIER_ORDER.reduce((n, t) => n + picks[t], 0);
  const top = TIER_ORDER.reduce((a, b) => (picks[b] > picks[a] ? b : a));
  let best: Insights['best'] = null;
  for (const [cardId, [drawn, k]] of byCard) {
    if (drawn < 2 || k === 0) continue;
    if (!best || k > best.made || (k === best.made && k / drawn > best.made / best.drawn)) best = { cardId, drawn, made: k };
  }
  return {
    rounds: mine.length,
    wins: mine.filter((m) => m.rank === 1).length,
    picks,
    mostly: total > 0 && picks[top] / total >= MOSTLY_SHARE ? top : null,
    cards: { safe: [picks.safe, made.safe], bold: [picks.bold, made.bold], insane: [picks.insane, made.insane] },
    best,
  };
}

export interface LastGroup {
  players: GameRecord['players'];
  course: string;
  finishedAt: number;
}

/** Everyone else from the newest round this phone hosted with other people in it. */
export function lastGroup(records: readonly GameRecord[]): LastGroup | null {
  for (const r of records) {
    if (!r.mine || r.players.length < 2) continue;
    const me = r.players.findIndex((p) => p.name === r.mine?.name);
    const players = r.players.filter((_, i) => i !== me);
    return { players, course: r.course, finishedAt: r.finishedAt };
  }
  return null;
}
