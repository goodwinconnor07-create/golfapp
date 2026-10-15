import { completedHoles, rankMoves, standings } from '../game';
import { useApp } from '../state/store';
import { BoardRow } from '../ui/BoardRow';
import { BackBar } from '../ui/components';

/** One leaderboard, golf style: lowest score wins. */
export function Leaderboard() {
  const game = useApp((s) => s.game);
  if (!game) return null;

  const holes = completedHoles(game);
  const rows = standings(game, 'game', holes);
  const moves = rankMoves(game);

  return (
    <div className="screen">
      <BackBar title="Leaderboard" />
      <div className="screen-body">
        <div className="board">
          {rows.map((row, i) => (
            <BoardRow
              key={row.player.id}
              row={row}
              delay={i * 50}
              move={moves[row.player.id]}
              sub={
                <>
                  <span className="board-detail">
                    <span>
                      {row.totals.made} of {row.totals.holes} cards made
                    </span>{' '}
                    · <span>{row.totals.real} strokes</span>
                  </span>
                </>
              }
            />
          ))}
        </div>
        <p className="note">
          {holes.length === 0
            ? 'Scores show up here after the first hole.'
            : 'Each hole: your golf score plus your card. Lowest total wins, like golf.'}
        </p>
      </div>
    </div>
  );
}
