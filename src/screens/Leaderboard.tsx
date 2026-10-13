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
                  {row.totals.made}/{row.totals.holes} ✓ · {row.totals.real} strokes
                </>
              }
            />
          ))}
        </div>
        <p className="note">
          {holes.length === 0
            ? 'Scores show up here after the first hole.'
            : 'Each hole: strokes ± your challenge, compared to par. Lowest total wins, like golf.'}
        </p>
      </div>
    </div>
  );
}
