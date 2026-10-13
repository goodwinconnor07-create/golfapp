import type { ReactNode } from 'react';
import { formatSigned, type StandingRow } from '../game';
import { Avatar } from './components';

/** One leaderboard line: rank, player, big total. Ties show as "=2". */
export function BoardRow({ row, metric, sub, delay }: { row: StandingRow; metric: 'game' | 'real'; sub?: ReactNode; delay?: number }) {
  return (
    <div
      className={`board-row ${row.rank === 1 ? 'first' : ''} ${delay != null ? 'rise' : ''}`}
      style={delay != null ? { animationDelay: `${delay}ms` } : undefined}
    >
      <span className="rank">{row.tied ? `=${row.rank}` : row.rank}</span>
      <Avatar player={row.player} size={44} />
      <div className="board-main">
        <span className="board-name">{row.player.name}</span>
        {sub && <span className="board-sub">{sub}</span>}
      </div>
      <div className="board-total">
        <b>{metric === 'game' ? formatSigned(row.totals.game) : row.totals.real}</b>
        <span>{metric === 'game' ? 'Game' : 'Real'}</span>
      </div>
    </div>
  );
}
