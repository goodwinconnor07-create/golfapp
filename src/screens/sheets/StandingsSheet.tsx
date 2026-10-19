import { useState } from 'react';
import {
  completedHoles,
  crownHolder,
  winChancesFor,
  formatToPar,
  getEntry,
  holeStatus,
  isDoubleHole,
  ordinal,
  rankMoves,
  standings,
  unitHoleResult,
  type Game,
  type Player,
  type StandingRow,
} from '../../game';
import { navigate, shownHoles, useApp } from '../../state/store';
import { myPlayers } from '../../state/view';
import { Move, rankLabel } from '../../ui/BoardRow';
import { Avatar, OutcomeMark, Sheet, SumTable, TierIcon } from '../../ui/components';
import { plural, roundLine, winText } from '../../ui/format';

const NOW = { playing: 'Playing', done: 'Scoring', scored: 'Scored' } as const;

/**
 * The standings, from the rank pill (or the menu) on any screen. One line per player; tap a row
 * for their round hole by hole, and how golf and cards add up to their total. Holes only count
 * here once this phone has seen their results, so the sheet never spoils a reveal.
 */
export function StandingsSheet() {
  const game = useApp((s) => s.game);
  const deviceId = useApp((s) => s.deviceId);
  const online = useApp((s) => s.session?.mode === 'online');
  useApp((s) => s.results);
  const [open, setOpen] = useState<string | null>(null);
  if (!game) return null;

  const holes = shownHoles(game);
  const rows = standings(game, 'game', holes);
  const moves = rankMoves(game, holes);
  const mine = online ? myPlayers(game, deviceId, true) : [];
  // "You" only means something when this phone has one player; with friends on other phones, show where everyone is now.
  const me = mine.length === 1 ? mine[0] : null;
  // In 2v2 your row is your team's.
  const meId = me ? (rows.find((r) => r.player.id === me.id || r.player.members?.some((m) => m.id === me.id))?.player.id ?? me.id) : null;
  const live = online && game.status === 'playing' && game.players.some((p) => !mine.includes(p));
  const doubles = game.holes.map((h, i) => (isDoubleHole(game, i) ? h.number : null)).filter((n) => n != null);
  // Win chances and the crown follow the holes this phone has seen, so the sheet never spoils a reveal.
  const upToDate = holes.length === completedHoles(game).length;
  const chances = upToDate && holes.length > 0 ? winChancesFor(game) : null;
  const crown = upToDate && game.status === 'playing' ? crownHolder(game, game.current) : null;

  return (
    <Sheet title="Standings">
      <p className="muted standings-sub">
        {holes.length === 0 ? 'Scores show up here after the first hole.' : `After ${holes.length} of ${game.holes.length} holes`}
        {doubles.length > 0 && game.status === 'playing' && ` · holes ${doubles[0]}–${doubles[doubles.length - 1]} count 2×`}
      </p>
      {me && holes.length > 0 && <p className="you-line">{gapLine(rows, meId!)}</p>}
      <div className="stack standings-rows">
        {rows.map((row) => {
          const p = row.player;
          const isOpen = open === p.id;
          const move = moves[p.id] ?? 0;
          // A team shares its card, so the first partner speaks for both.
          const lead = p.members?.[0].id ?? p.id;
          const status = holeStatus(game, lead, game.current);
          const tier = getEntry(game, lead, game.current)?.tier;
          return (
            <div
              key={p.id}
              className={[
                'board-row standings-row',
                row.rank === 1 && holes.length > 0 ? 'first' : '',
                meId === p.id ? 'mine' : '',
                move > 0 ? 'climbed' : move < 0 ? 'dropped' : '',
              ].join(' ')}
            >
              <button type="button" className="standings-line" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)}>
                <span className={`standings-rank num p${row.rank}`}>{rankLabel(row.rank, row.tied)}</span>
                <Avatar player={p} size={40} />
                <span className="standings-main">
                  <span className="standings-name">
                    <span className="group-name-text">{p.name}</span>
                    {crown === p.id && (
                      <span className="crown-mark" role="img" aria-label="wears the crown">
                        👑
                      </span>
                    )}
                    {meId === p.id && <span className="you-tag">{p.members ? 'Your team' : 'You'}</span>}
                    <Move n={move} />
                  </span>
                  <span className="standings-detail">
                    {live ? (
                      <>
                        Now: {tier && <TierIcon tier={tier} size={14} />} {NOW[status]}
                      </>
                    ) : (
                      roundLine(row.totals)
                    )}
                  </span>
                </span>
                <span className="standings-score">
                  <b className="standings-total num">{formatToPar(row.totals.toPar)}</b>
                  {chances && <small className="win-chance">{winText(chances[p.id] ?? 0)}</small>}
                </span>
              </button>
              {isOpen && (
                <RowDetail
                  game={game}
                  player={p}
                  total={row.totals.toPar}
                  strokes={p.members ? undefined : row.totals.real}
                  holes={holes}
                />
              )}
            </div>
          );
        })}
      </div>
      <button type="button" className="btn btn-link" onClick={() => navigate({ name: 'scorecard' })}>
        Scorecard & fixes
      </button>
    </Sheet>
  );
}

/** "2nd · 3 behind Jay": the gap to the player just ahead, the one you can catch. */
function gapLine(rows: StandingRow[], id: string): string {
  const mine = rows.find((r) => r.player.id === id);
  if (!mine) return '';
  const place = `${mine.tied ? '=' : ''}${ordinal(mine.rank)}`;
  if (mine.rank === 1) {
    const next = rows.find((r) => r.player.id !== id && r.rank > 1);
    const tiedWith = rows.filter((r) => r.player.id !== id && r.rank === 1);
    if (tiedWith.length) return `Tied for the lead with ${tiedWith.map((r) => r.player.name).join(' and ')}`;
    return next ? `1st · ${next.totals.toPar - mine.totals.toPar} ahead of ${next.player.name}` : '1st';
  }
  const ahead = [...rows].reverse().find((r) => r.rank < mine.rank)!;
  return `${place} · ${mine.totals.toPar - ahead.totals.toPar} behind ${ahead.player.name}`;
}

/** One player's round: each hole against par with its card, then golf + cards = total. */
function RowDetail({
  game,
  player,
  total,
  strokes,
  holes,
}: {
  game: Game;
  player: Player;
  total: number;
  /** Real strokes, for a player (a team's golf is averaged, so a stroke count would confuse). */
  strokes?: number;
  holes: number[];
}) {
  const results = holes.map((i) => unitHoleResult(game, player.id, i));
  const cards = results.reduce((a, r) => a + (r?.adjustment ?? 0), 0);
  const golf = total - cards;
  const shown = new Set(holes);
  return (
    <div className="row-detail">
      <div className="hbh" role="list" aria-label={`${player.name}, hole by hole`}>
        {game.holes.map((hole, i) => {
          const r = shown.has(i) ? unitHoleResult(game, player.id, i) : null;
          const dbl = isDoubleHole(game, i);
          return (
            <span
              key={i}
              role="listitem"
              className={`hbh-cell${r ? ` ${r.outcome}` : ''}${i === game.current && game.status === 'playing' ? ' now' : ''}`}
              aria-label={
                r
                  ? `Hole ${hole.number}: ${formatToPar(r.toPar)}, card ${r.outcome === 'made' ? 'completed' : r.outcome === 'missed' ? 'failed' : 'no change'}${dbl ? ', doubled' : ''}`
                  : `Hole ${hole.number}: not played`
              }
            >
              <small className={dbl ? 'dbl' : undefined}>
                {hole.number}
                {dbl && '·2×'}
              </small>
              {r ? (
                <>
                  {/* Team halves ("−2½") need a smaller size to fit nine cells across. */}
                  <b className={`num${formatToPar(r.toPar).length > 2 ? ' tight' : ''}`}>{formatToPar(r.toPar)}</b>
                  <span className={`hbh-card tier-ink-${r.tier}`}>
                    <TierIcon tier={r.tier} size={12} />
                    <OutcomeMark outcome={r.outcome} size={11} />
                  </span>
                </>
              ) : (
                <b className="hbh-empty">·</b>
              )}
            </span>
          );
        })}
      </div>
      {holes.length > 0 && (
        <SumTable
          className="row-sum"
          lines={[
            { label: strokes == null ? 'Golf' : `Golf · ${plural(strokes, 'stroke')}`, value: formatToPar(golf) },
            { label: 'Cards', value: formatToPar(cards) },
          ]}
          total={{ label: 'Total', value: formatToPar(total) }}
        />
      )}
    </div>
  );
}
