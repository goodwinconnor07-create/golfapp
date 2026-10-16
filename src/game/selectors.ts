import { getCard } from './cards';
import { allPicked, entryKey, freePassUsed, holeComplete, holeResult } from './rules';
import { formatDelta } from './tiers';
import type { Game, Player, Tier } from './types';

/** Holes where every player has a result. Only these count towards totals. */
export function completedHoles(game: Game): number[] {
  const out: number[] = [];
  for (let i = 0; i < game.holes.length; i++) if (holeComplete(game, i)) out.push(i);
  return out;
}

export interface PlayerTotals {
  /** Real strokes taken. */
  real: number;
  /** Total par of the holes counted. */
  par: number;
  /** Score against par, golf style (negative = under). Lowest wins. */
  toPar: number;
  /** Challenge-adjusted game score. Lower is better; can be negative. */
  game: number;
  holes: number;
  made: number;
  missed: number;
  na: number;
  picks: Record<Tier, number>;
  madeByTier: Record<Tier, number>;
  /** Strokes added by missed cards. */
  addedByMisses: number;
}

const zeroByTier = (): Record<Tier, number> => ({ safe: 0, bold: 0, insane: 0 });

export function playerTotals(game: Game, playerId: string, holes: readonly number[] = completedHoles(game)): PlayerTotals {
  const t: PlayerTotals = {
    real: 0,
    par: 0,
    toPar: 0,
    game: 0,
    holes: 0,
    made: 0,
    missed: 0,
    na: 0,
    picks: zeroByTier(),
    madeByTier: zeroByTier(),
    addedByMisses: 0,
  };
  for (const h of holes) {
    const r = holeResult(game, playerId, h);
    if (!r) continue;
    t.real += r.strokes;
    t.par += r.par;
    t.toPar += r.gameScore - r.par;
    t.game += r.gameScore;
    t.holes += 1;
    t.picks[r.tier] += 1;
    if (r.outcome === 'made') {
      t.made += 1;
      t.madeByTier[r.tier] += 1;
    } else if (r.outcome === 'missed') {
      t.missed += 1;
      t.addedByMisses += r.adjustment;
    } else {
      t.na += 1;
    }
  }
  return t;
}

export interface StandingRow {
  player: Player;
  /** 1-based. Tied players share a rank (1, 1, 3). */
  rank: number;
  tied: boolean;
  totals: PlayerTotals;
}

/**
 * Leaderboard. 'game' ranks by game score (lowest wins), 'real' by real strokes.
 * Game-score ties only fall back to real strokes if the group switched that on.
 */
export function standings(game: Game, by: 'game' | 'real' = 'game', holes: readonly number[] = completedHoles(game)): StandingRow[] {
  const useTiebreak = by === 'game' && game.settings.tiebreakOnStrokes;
  const key = (t: PlayerTotals): [number, number] => (by === 'game' ? [t.toPar, useTiebreak ? t.real : 0] : [t.real, 0]);

  const rows = game.players.map((player, order) => ({ player, order, totals: playerTotals(game, player.id, holes) }));
  rows.sort((a, b) => {
    const [a1, a2] = key(a.totals);
    const [b1, b2] = key(b.totals);
    return a1 - b1 || a2 - b2 || a.order - b.order;
  });

  const out: StandingRow[] = [];
  rows.forEach((row, i) => {
    const prev = out[i - 1];
    const same = prev && key(prev.totals).every((v, k) => v === key(row.totals)[k]);
    out.push({ player: row.player, totals: row.totals, rank: same ? prev.rank : i + 1, tied: false });
  });
  for (const row of out) row.tied = out.some((o) => o !== row && o.rank === row.rank);
  return out;
}

/**
 * The free shot is switched off (Oct 2026): the same rules apply to the leader and to whoever
 * is behind (docs/GAME_BALANCE.md). Old games that used one still score it (fail = 0).
 */
export const FREE_SHOT_ON = false;

/**
 * Free shot: the player in last place (not a tie shared by everyone) can play one card
 * a round where failing costs nothing. Needs at least one finished hole to know who's last.
 */
export function freePassAvailable(game: Game, playerId: string): boolean {
  if (!FREE_SHOT_ON) return false;
  if (game.players.length < 2 || freePassUsed(game, playerId)) return false;
  const holes = completedHoles(game).filter((h) => h < game.current);
  if (holes.length === 0) return false;
  const rows = standings(game, 'game', holes);
  const worst = Math.max(...rows.map((r) => r.rank));
  if (worst === 1) return false;
  return rows.some((r) => r.player.id === playerId && r.rank === worst);
}

/** Places moved since the hole before the latest finished one: +2 = up two places. */
export function rankMoves(game: Game): Record<string, number> {
  const holes = completedHoles(game);
  if (holes.length < 2) return {};
  const before = new Map(standings(game, 'game', holes.slice(0, -1)).map((r) => [r.player.id, r.rank]));
  const out: Record<string, number> = {};
  for (const r of standings(game, 'game', holes)) out[r.player.id] = (before.get(r.player.id) ?? r.rank) - r.rank;
  return out;
}

/** The new outright leader if this hole changed who leads, else null. */
export function newLeader(game: Game, hole: number): Player | null {
  const holes = completedHoles(game).filter((h) => h <= hole);
  if (holes.length < 2 || holes[holes.length - 1] !== hole) return null;
  const sole = (rows: StandingRow[]) => (rows.filter((r) => r.rank === 1).length === 1 ? rows[0].player : null);
  const now = sole(standings(game, 'game', holes));
  const was = sole(standings(game, 'game', holes.slice(0, -1)));
  return now && now.id !== was?.id ? now : null;
}

/** How this player stands against the leader (or the chaser, if they lead). */
export function gapText(game: Game, playerId: string): string | null {
  if (game.players.length < 2) return null;
  const holes = completedHoles(game).filter((h) => h < game.current);
  if (holes.length === 0) return null;
  const rows = standings(game, 'game', holes);
  const me = rows.find((r) => r.player.id === playerId);
  if (!me) return null;
  const leaders = rows.filter((r) => r.rank === 1);
  const n = (v: number) => `${v} stroke${v === 1 ? '' : 's'}`;
  if (me.rank === 1) {
    if (leaders.length > 1) {
      const other = leaders.find((r) => r !== me)!;
      return `Tied for the lead with ${other.player.name}`;
    }
    const next = rows[1];
    return `You lead ${next.player.name} by ${n(next.totals.toPar - me.totals.toPar)}`;
  }
  return `You're ${n(me.totals.toPar - leaders[0].totals.toPar)} behind ${leaders[0].player.name}`;
}

export interface Award {
  id: string;
  emoji: string;
  title: string;
  detail: string;
  playerIds: string[];
}

export interface Highlight {
  hole: number;
  playerId: string;
  cardId: string;
  tier: Tier;
  adjustment: number;
}

export interface Recap {
  holesPlayed: number;
  byGame: StandingRow[];
  byReal: StandingRow[];
  winners: StandingRow[];
  awards: Award[];
  highlights: Highlight[];
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function leaders(rows: { id: string; value: number }[], min: number): { ids: string[]; value: number } | null {
  const best = Math.max(...rows.map((r) => r.value));
  if (!Number.isFinite(best) || best < min) return null;
  return { ids: rows.filter((r) => r.value === best).map((r) => r.id), value: best };
}

/** End-of-round summary: both leaderboards plus a few fun awards. */
export function recap(game: Game): Recap {
  const holes = completedHoles(game);
  const byGame = standings(game, 'game', holes);
  const byReal = standings(game, 'real', holes);
  const awards: Award[] = [];
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  if (holes.length > 0) {
    const realBest = byReal.filter((r) => r.rank === 1);
    awards.push({
      id: 'real',
      emoji: '⛳',
      title: 'Fewest strokes',
      detail: `${plural(realBest[0].totals.real, 'stroke')} taken`,
      playerIds: realBest.map((r) => r.player.id),
    });

    const totals = byGame.map((r) => ({ id: r.player.id, t: r.totals }));

    const sent = leaders(
      totals.map((x) => ({ id: x.id, value: x.t.madeByTier.insane })),
      1,
    );
    if (sent)
      awards.push({
        id: 'sent',
        emoji: '🔥',
        title: 'Sent it',
        detail: `Completed ${plural(sent.value, 'Insane challenge')}`,
        playerIds: sent.ids,
      });

    // Comeback: biggest climb from a player's worst position to where they finished.
    if (holes.length >= 2 && game.players.length >= 2) {
      const worst = new Map<string, number>();
      holes.forEach((_, i) => {
        for (const row of standings(game, 'game', holes.slice(0, i + 1))) {
          worst.set(row.player.id, Math.max(worst.get(row.player.id) ?? 0, row.rank));
        }
      });
      const climbs = byGame.map((r) => ({
        id: r.player.id,
        value: (worst.get(r.player.id) ?? r.rank) - r.rank,
        from: worst.get(r.player.id) ?? r.rank,
        to: r.rank,
      }));
      const best = leaders(climbs, 1);
      if (best) {
        const c = climbs.find((x) => x.id === best.ids[0])!;
        awards.push({
          id: 'comeback',
          emoji: '📈',
          title: 'Comeback',
          detail: `From ${ordinal(c.from)} to ${ordinal(c.to)}`,
          playerIds: best.ids,
        });
      }
    }

    // Biggest swing: the single best card made in the round (earliest wins a tie).
    let swing: { playerId: string; hole: number; adjustment: number; cardId: string } | null = null;
    for (const h of holes) {
      for (const p of game.players) {
        const r = holeResult(game, p.id, h);
        if (r && r.outcome === 'made' && (!swing || r.adjustment < swing.adjustment)) {
          swing = { playerId: p.id, hole: h, adjustment: r.adjustment, cardId: r.cardId };
        }
      }
    }
    if (swing) {
      const title = getCard(swing.cardId)?.title ?? 'A card';
      awards.push({
        id: 'swing',
        emoji: '💥',
        title: 'Biggest swing',
        detail: `${title} on hole ${game.holes[swing.hole].number} (${formatDelta(swing.adjustment)})`,
        playerIds: [swing.playerId],
      });
    }

    const shark = leaders(
      totals.map((x) => ({ id: x.id, value: x.t.made })),
      1,
    );
    if (shark)
      awards.push({
        id: 'shark',
        emoji: '🎯',
        title: 'Card shark',
        detail: `Completed ${shark.value} of ${plural(holes.length, 'challenge')}`,
        playerIds: shark.ids,
      });

    const devil = leaders(
      totals.map((x) => ({ id: x.id, value: x.t.picks.insane })),
      2,
    );
    if (devil)
      awards.push({ id: 'daredevil', emoji: '😈', title: 'Daredevil', detail: `Picked Insane ${devil.value} times`, playerIds: devil.ids });

    const ouch = leaders(
      totals.map((x) => ({ id: x.id, value: x.t.addedByMisses })),
      3,
    );
    if (ouch)
      awards.push({
        id: 'ouch',
        emoji: '😬',
        title: 'Ouch',
        detail: `${formatDelta(ouch.value)} from failed challenges`,
        playerIds: ouch.ids,
      });

    const safeOnly = totals.filter((x) => x.t.holes >= 3 && x.t.picks.safe === x.t.holes).map((x) => x.id);
    if (safeOnly.length)
      awards.push({ id: 'safe', emoji: '🛡️', title: 'Safety first', detail: 'Picked Safe every hole', playerIds: safeOnly });
  }

  const highlights: Highlight[] = [];
  for (const h of holes) {
    for (const p of game.players) {
      const r = holeResult(game, p.id, h);
      if (r && r.outcome === 'made' && r.tier === 'insane') {
        highlights.push({ hole: h, playerId: p.id, cardId: r.cardId, tier: r.tier, adjustment: r.adjustment });
      }
    }
  }

  return {
    holesPlayed: holes.length,
    byGame,
    byReal,
    winners: byGame.filter((r) => r.rank === 1),
    awards: awards.slice(0, 6),
    highlights,
  };
}

/** Stand-ins for other phones' ids, which act as passwords on the server and must never be shared. */
export const MASKED_HOST = '~host';
export const MASKED_PLAYER = '~player';

/**
 * What one device is allowed to see of an online game: no deck order, no other
 * phones' ids, and until everyone has picked on the current hole, only the picks
 * this device drew.
 */
export function redactForDevice(game: Game, deviceId: string): Game {
  const view = structuredClone(game);
  delete view.decks;
  const mask = (id: string) => (id === deviceId ? id : id === game.hostDeviceId ? MASKED_HOST : MASKED_PLAYER);
  view.hostDeviceId = mask(view.hostDeviceId);
  for (const p of view.players) if (p.deviceId) p.deviceId = mask(p.deviceId);
  for (const e of Object.values(view.entries)) if (e.pickedBy) e.pickedBy = mask(e.pickedBy);
  if (view.status === 'playing' && !allPicked(game, game.current)) {
    for (const p of view.players) {
      const key = entryKey(p.id, view.current);
      const e = game.entries[key];
      if (e?.tier && e.pickedBy !== deviceId) view.entries[key] = { hidden: true };
    }
  }
  return view;
}
