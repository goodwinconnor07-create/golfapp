import type { ReactNode } from 'react';
import { formatToPar, type Player, type StandingRow } from '../game';
import { Avatar, CountUp } from './components';

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
  scoreLabel = 'To par',
  className = '',
  style,
  hidden,
}: {
  player: Player;
  /** "1", "=2"… shown as a badge on the avatar. */
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
      <span className="prow-avatar">
        <Avatar player={player} size={44} />
        {rank && <span className="prow-rank">{rank}</span>}
      </span>
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

/** One standings line. move: places gained (+) or lost (−) since the hole before. Ties show as "=2". */
export function BoardRow({ row, sub, delay, move = 0 }: { row: StandingRow; sub?: ReactNode; delay?: number; move?: number }) {
  return (
    <PlayerRow
      player={row.player}
      rank={row.tied ? `=${row.rank}` : String(row.rank)}
      className={`board-row ${row.rank === 1 ? 'first' : ''} ${delay != null ? 'rise' : ''}`}
      style={delay != null ? { animationDelay: `${delay}ms` } : undefined}
      detail={
        (sub || move !== 0) && (
          <>
            {sub}
            {move !== 0 && (
              <span className={`rank-move ${move > 0 ? 'up' : 'down'}`} aria-label={move > 0 ? `up ${move}` : `down ${-move}`}>
                {move > 0 ? '▲' : '▼'}
                {Math.abs(move)}
              </span>
            )}
          </>
        )
      }
      score={
        <span aria-label={formatToPar(row.totals.toPar)}>
          <CountUp value={row.totals.toPar} format={formatToPar} />
        </span>
      }
    />
  );
}
