import { getCard } from './cards';
import { hash32 } from './hand';
import {
  allPicked,
  crownBonus,
  crownOn,
  entryKey,
  freePassUsed,
  getEntry,
  holeComplete,
  holeResult,
  isDoubleHole,
  isV2,
  ownsPlayer,
  stakeFor,
  streakResult,
  teamOf,
  type HoleResult,
} from './rules';
import { formatDelta, halves, tiersFor } from './tiers';
import type { Game, Player, Tier } from './types';
import { winChances, type WinUnit } from './winChance';

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

/**
 * What the leaderboard ranks: a player, or in a team game a team. A team stands in as a
 * Player named "Sam & Alex" (with `members`), so screens can show it like anyone else.
 */
export type Unit = Player & { members?: [Player, Player] };

export function units(game: Game): Unit[] {
  if (!game.teams) return game.players;
  return game.teams.flatMap((t) => {
    const a = game.players.find((p) => p.id === t.players[0]);
    const b = game.players.find((p) => p.id === t.players[1]);
    return a && b ? [{ id: t.id, name: `${a.name} & ${b.name}`, color: a.color, deviceId: null, members: [a, b] as [Player, Player] }] : [];
  });
}

/**
 * A standings row's result on one hole: the player's own, or for a team both partners' golf
 * averaged with the shared card counted once (so it can land on a half). Null until both are in.
 */
export function unitHoleResult(game: Game, unitId: string, hole: number): HoleResult | null {
  const team = game.teams?.find((t) => t.id === unitId);
  if (!team) return holeResult(game, unitId, hole);
  const a = holeResult(game, team.players[0], hole);
  const b = holeResult(game, team.players[1], hole);
  if (!a || !b) return null;
  // The Crown goes on the team as a whole.
  const crown = crownBonus(game, team.id, hole);
  return {
    ...a,
    strokes: (a.strokes + b.strokes) / 2,
    gameScore: (a.gameScore + b.gameScore) / 2 + crown,
    toPar: (a.toPar + b.toPar) / 2 + crown,
    mulligan: a.mulligan || b.mulligan,
    ownOutcome: a.outcome,
    extras: crown ? [{ kind: 'crown', amount: crown }] : [],
  };
}

/** The unit a player is ranked in (their team, or themselves). */
export function unitOf(game: Game, playerId: string): Unit | undefined {
  return units(game).find((u) => u.id === playerId || u.members?.some((m) => m.id === playerId));
}

/** A team's totals: strokes added up, scores averaged over both partners, the card counted once, plus the team's Crown. */
function teamTotals(game: Game, teamId: string, members: [Player, Player], holes: readonly number[]): PlayerTotals {
  const a = playerTotals(game, members[0].id, holes);
  const b = playerTotals(game, members[1].id, holes);
  const crown = holes.reduce((sum, h) => sum + crownBonus(game, teamId, h), 0);
  return { ...a, real: a.real + b.real, par: (a.par + b.par) / 2, toPar: (a.toPar + b.toPar) / 2 + crown, game: (a.game + b.game) / 2 + crown };
}

export interface StandingRow {
  player: Unit;
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

  const rows = units(game).map((player, order) => ({
    player,
    order,
    totals: player.members ? teamTotals(game, player.id, player.members, holes) : playerTotals(game, player.id, holes),
  }));
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
export function rankMoves(game: Game, holes: readonly number[] = completedHoles(game)): Record<string, number> {
  if (holes.length < 2) return {};
  const before = new Map(standings(game, 'game', holes.slice(0, -1)).map((r) => [r.player.id, r.rank]));
  const out: Record<string, number> = {};
  for (const r of standings(game, 'game', holes)) out[r.player.id] = (before.get(r.player.id) ?? r.rank) - r.rank;
  return out;
}

/**
 * Who passed whom on the last finished hole: `by` was behind `passed` before it and is
 * ahead now. Ties don't count as a pass. Biggest climbs first.
 */
export function overtakes(game: Game, hole?: number): { by: Unit; passed: Unit }[] {
  const holes = completedHoles(game).filter((h) => hole == null || h <= hole);
  if (holes.length < 2) return [];
  const before = new Map(standings(game, 'game', holes.slice(0, -1)).map((r) => [r.player.id, r.rank]));
  const now = new Map(standings(game, 'game', holes).map((r) => [r.player.id, r.rank]));
  const out: { by: Unit; passed: Unit; climb: number }[] = [];
  for (const a of units(game))
    for (const b of units(game))
      if (a.id !== b.id && before.get(a.id)! > before.get(b.id)! && now.get(a.id)! < now.get(b.id)!)
        out.push({ by: a, passed: b, climb: before.get(a.id)! - now.get(a.id)! });
  return out.sort((x, y) => y.climb - x.climb).map(({ by, passed }) => ({ by, passed }));
}

/** A skin: the hole's best game score, worth this hole plus any carried over from ties before it. */
export interface Skin {
  playerId: string;
  worth: number;
}

/**
 * Skins, a side game shown on the scorecard: the single best game score on a finished hole
 * wins it. Ties roll the skin over to the next finished hole. Needs two or more players.
 */
export function skins(game: Game): Record<number, Skin> {
  const out: Record<number, Skin> = {};
  if (game.players.length < 2) return out;
  let pot = 0;
  for (const h of completedHoles(game)) {
    pot++;
    const scores = game.players.map((p) => ({ id: p.id, toPar: holeResult(game, p.id, h)!.toPar }));
    const best = Math.min(...scores.map((s) => s.toPar));
    const winners = scores.filter((s) => s.toPar === best);
    if (winners.length === 1) {
      out[h] = { playerId: winners[0].id, worth: pot };
      pot = 0;
    }
  }
  return out;
}

/** The new outright leader if this hole changed who leads, else null. */
export function newLeader(game: Game, hole: number): Unit | null {
  const holes = completedHoles(game).filter((h) => h <= hole);
  if (holes.length < 2 || holes[holes.length - 1] !== hole) return null;
  const sole = (rows: StandingRow[]) => (rows.filter((r) => r.rank === 1).length === 1 ? rows[0].player : null);
  const now = sole(standings(game, 'game', holes));
  const was = sole(standings(game, 'game', holes.slice(0, -1)));
  return now && now.id !== was?.id ? now : null;
}

/** How this player stands against the leader (or the chaser, if they lead). */
export function gapText(game: Game, playerId: string): string | null {
  if (units(game).length < 2) return null;
  const holes = completedHoles(game).filter((h) => h < game.current);
  if (holes.length === 0) return null;
  const rows = standings(game, 'game', holes);
  const me = rows.find((r) => r.player.id === playerId || r.player.members?.some((m) => m.id === playerId));
  if (!me) return null;
  const leaders = rows.filter((r) => r.rank === 1);
  // No unit: the gap is game score (strokes plus cards), so "strokes" would be wrong. Halves for team averages.
  const n = (v: number) => halves(v);
  if (me.rank === 1) {
    if (leaders.length > 1) {
      const others = leaders.filter((r) => r !== me).map((r) => r.player.name);
      return `Tied for the lead with ${others.length > 1 ? `${others.slice(0, -1).join(', ')} and ${others.at(-1)}` : others[0]}`;
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
        detail: `Completed ${plural(sent.value, 'Insane card')}`,
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
        detail: `Completed ${shark.value} of ${plural(holes.length, 'card')}`,
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
        detail: `${formatDelta(ouch.value)} from failed cards`,
        playerIds: ouch.ids,
      });

    if (crownOn(game)) {
      const thief = leaders(
        units(game).map((u) => ({ id: u.id, value: holes.filter((h) => crownBonus(game, u.id, h) < 0).length })),
        2,
      );
      if (thief) awards.push({ id: 'crown', emoji: '👑', title: 'Crown thief', detail: `Beat the leader on ${plural(thief.value, 'hole')}`, playerIds: thief.ids });
    }

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

/** How often a streak still running comes off (simulated, ruleset 2). */
const STREAK_CHANCE = { noDouble: 0.45, hotHand: 0.4 } as const;

const WIN_CACHE = new WeakMap<Game, Record<string, number> | null>();

/**
 * Live win chances (ruleset 2): each ranked side's chance of winning from here, 0..1, after the holes
 * finished so far. The same on every phone. Null when there's nothing to show (one side, or not playing).
 */
export function winChancesFor(game: Game): Record<string, number> | null {
  if (WIN_CACHE.has(game)) return WIN_CACHE.get(game)!;
  let out: Record<string, number> | null = null;
  if (isV2(game) && game.status === 'playing' && units(game).length >= 2) {
    const holes = completedHoles(game);
    const values = tiersFor(Boolean(game.teams), game.rules);
    const winUnits: WinUnit[] = standings(game, 'game', holes).map((r) => {
      const pair = Boolean(r.player.members);
      const pending = pair
        ? []
        : holes.flatMap((h) => {
            const e = getEntry(game, r.player.id, h);
            const card = getCard(e?.cardId);
            const s = card?.multi && e?.tier ? streakResult(game, r.player.id, h) : null;
            if (!card?.multi || !e?.tier || s?.outcome !== 'running') return [];
            return [{ made: stakeFor(game, h, e.tier, 'made'), missed: stakeFor(game, h, e.tier, 'missed'), chance: STREAK_CHANCE[card.multi] }];
          });
      return {
        id: r.player.id,
        toPar: r.totals.toPar,
        golfToPar: r.totals.real - r.totals.par * (pair ? 2 : 1),
        holes: r.totals.holes,
        picks: r.totals.picks,
        pair,
        pending,
      };
    });
    out = winChances({
      units: winUnits,
      remaining: game.holes.flatMap((h, i) => (holes.includes(i) ? [] : [{ par: h.par ?? 4, mult: isDoubleHole(game, i) ? 2 : 1 }])),
      values: { safe: values.safe, bold: values.bold, insane: values.insane },
      crown: crownOn(game),
      wild: false,
      gold: false,
      seed: hash32(`${game.id}|${holes.length}`),
    });
  }
  WIN_CACHE.set(game, out);
  return out;
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
  // A teammate sees the team's shared card straight away; only other teams' picks stay hidden.
  const sameSide = (playerId: string) => {
    const t = teamOf(game, playerId);
    return ownsPlayer(game, deviceId, playerId) || Boolean(t?.players.some((id) => ownsPlayer(game, deviceId, id)));
  };
  const mask = (id: string) => (id === deviceId ? id : id === game.hostDeviceId ? MASKED_HOST : MASKED_PLAYER);
  view.hostDeviceId = mask(view.hostDeviceId);
  for (const p of view.players) if (p.deviceId) p.deviceId = mask(p.deviceId);
  for (const e of Object.values(view.entries)) if (e.pickedBy) e.pickedBy = mask(e.pickedBy);
  if (view.status === 'playing' && !allPicked(game, game.current)) {
    for (const p of view.players) {
      const key = entryKey(p.id, view.current);
      const e = game.entries[key];
      if (e?.tier && e.pickedBy !== deviceId && !sameSide(p.id)) view.entries[key] = { hidden: true };
    }
  }
  return view;
}
