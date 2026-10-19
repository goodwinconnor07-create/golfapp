import type { ReactNode } from 'react';
import { formatToPar, ordinal, type Player, type StandingRow } from '../game';
import { Avatar, CountUp } from './components';

/** "1st", or "=2nd" for a tie. */
export function rankLabel(rank: number, tied = false): string {
  return `${tied ? '=' : ''}${ordinal(rank)}`;
}

/** A player's picture with their place as a badge on the top-left corner. */
export function RankedAvatar({ player, rank, size = 56, first }: { player: Player; rank?: string; size?: number; first?: boolean }) {
  return (
    <span className={`prow-avatar${first ? ' first' : ''}`}>
      <Avatar player={player} size={size} />
      {rank && <span className="prow-rank">{rank}</span>}
    </span>
  );
}

/**
 * The one row layout for standings and hole results, on a three-column grid:
 *   [avatar with a rank badge] [name, then one detail line] [big score]
 * The name gets the full middle width; everything else (the working, mulligans, votes,
 * movement) sits on the detail line underneath, so nothing squeezes the name.
 */
export function PlayerRow({
  player,
  rank,
  name,
  detail,
  score,
  scoreLabel = 'Total',
  className = '',
  style,
  hidden,
}: {
  player: Player;
  /** "1st", "=2nd"… shown as a badge on the avatar's top corner. */
  rank?: string;
  /** What to show as the name (defaults to the player's name), e.g. with a 👑. */
  name?: ReactNode;
  detail?: ReactNode;
  score: ReactNode;
  scoreLabel?: string | null;
  className?: string;
  style?: React.CSSProperties;
  hidden?: boolean;
}) {
  return (
    <div className={`prow ${className}`} style={style} aria-hidden={hidden}>
      <RankedAvatar player={player} rank={rank} size={56} />
      <span className="prow-main">
        <span className="prow-name">{name ?? player.name}</span>
        {detail && <span className="prow-detail">{detail}</span>}
      </span>
      <span className="prow-score">
        <b>{score}</b>
        {scoreLabel && <small>{scoreLabel}</small>}
      </span>
    </div>
  );
}

/** Places gained or lost on the last hole, as a lasting ▲2 / ▼1 chip (not colour or motion alone). */
export function Move({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className={`move-chip ${n > 0 ? 'up' : 'down'}`} role="img" aria-label={n > 0 ? `up ${n}` : `down ${-n}`}>
      {n > 0 ? '▲' : '▼'}
      {Math.abs(n)}
    </span>
  );
}

/**
 * One standings line: the place as a badge on the picture, the row sliding from its old
 * spot to the new one, and a ▲/▼ chip for places gained or lost on the last hole. Ties show as "=2nd".
 * move: places gained (+) or lost (−) since the hole before.
 */
export function BoardRow({
  row,
  sub,
  delay,
  move = 0,
  scoreLabel,
  crown = false,
}: {
  row: StandingRow;
  sub?: ReactNode;
  delay?: number;
  move?: number;
  /** Label under the big number; null when the list has one column heading instead. */
  scoreLabel?: string | null;
  /** Wears the crown on the next hole (ruleset 2). */
  crown?: boolean;
}) {
  return (
    <PlayerRow
      scoreLabel={scoreLabel}
      player={row.player}
      rank={rankLabel(row.rank, row.tied)}
      name={
        <>
          {row.player.name}
          {crown && (
            <span className="crown-mark" role="img" aria-label="wears the crown">
              👑
            </span>
          )}
          <Move n={move} />
        </>
      }
      // Rows that changed place slide from where they were (move places away) into their new spot.
      className={`board-row ${row.rank === 1 ? 'first' : ''} ${move !== 0 ? `reorder ${move > 0 ? 'climbed' : 'dropped'}` : delay != null ? 'rise' : ''}`}
      style={{
        ...(delay != null ? { animationDelay: `${delay}ms` } : {}),
        ...(move !== 0 ? ({ '--from': move } as React.CSSProperties) : {}),
      }}
      detail={sub}
      score={
        <span aria-label={formatToPar(row.totals.toPar)}>
          <CountUp value={row.totals.toPar} format={formatToPar} />
        </span>
      }
    />
  );
}
