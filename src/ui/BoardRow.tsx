import type { ReactNode } from 'react';
import { formatToPar, type StandingRow } from '../game';
import { Avatar, CountUp } from './components';

/** One leaderboard line: rank, player, big score (lowest wins). Ties show as "=2". */
/** move: places gained (+) or lost (−) since the hole before. */
export function BoardRow({
  row,
  sub,
  meta,
  delay,
  move = 0,
}: {
  row: StandingRow;
  sub?: ReactNode;
  /** Small notes after the name (mulligan, free shot, vote). */
  meta?: ReactNode;
  delay?: number;
  move?: number;
}) {
  return (
    <div
      className={`board-row ${row.rank === 1 ? 'first' : ''} ${delay != null ? 'rise' : ''}`}
      style={delay != null ? { animationDelay: `${delay}ms` } : undefined}
    >
      <span className="rank">
        {row.tied ? `=${row.rank}` : row.rank}
        {move !== 0 && (
          <span className={`rank-move ${move > 0 ? 'up' : 'down'}`} aria-label={move > 0 ? `up ${move}` : `down ${-move}`}>
            {move > 0 ? '▲' : '▼'}
            {Math.abs(move)}
          </span>
        )}
      </span>
      <Avatar player={row.player} size={44} />
      <div className="board-main">
        <span className="board-name">
          <span className="board-name-text">{row.player.name}</span>
          {meta}
        </span>
      </div>
      <div className="board-total">
        <b aria-label={formatToPar(row.totals.toPar)}>
          <CountUp value={row.totals.toPar} format={formatToPar} />
        </b>
        <span>To par</span>
      </div>
      {/* The working gets its own line under the name, so the big score never squeezes it. */}
      {sub && <span className="board-sub board-sub-line">{sub}</span>}
    </div>
  );
}
