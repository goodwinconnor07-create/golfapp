import { useEffect } from 'react';
import { getCard, getEntry, holeResult, isVoteable, newLeader, rankMoves, standings, voteTally, type Game } from '../../game';
import { navigate, nextHole } from '../../state/store';
import { BoardRow } from '../../ui/BoardRow';
import { TierChip } from '../../ui/components';
import { confetti, CONFETTI } from '../../ui/effects';
import { calcText } from '../../ui/format';
import { ArrowIcon, TrophyIcon } from '../../ui/Icons';

export function HoleResults({ game }: { game: Game }) {
  const h = game.current;
  const rows = standings(game);
  const moves = rankMoves(game);
  const leader = newLeader(game, h);
  const last = h === game.holes.length - 1;
  const insaneMade = game.players.some((p) => {
    const r = holeResult(game, p.id, h);
    return r?.tier === 'insane' && r.outcome === 'made';
  });

  useEffect(() => {
    if (insaneMade) confetti(CONFETTI.insane, { x: innerWidth / 2, y: innerHeight * 0.3 }, 80);
  }, [insaneMade]);

  return (
    <>
      <div className="screen-body">
        <h1 className="h1">Hole {game.holes[h].number} done!</h1>
        {leader && (
          <div className="lead-banner pop" role="status">
            👑 {leader.name} takes the lead!
          </div>
        )}
        <div className="board">
          {rows.map((row, i) => {
            const r = holeResult(game, row.player.id, h);
            return (
              <BoardRow
                key={row.player.id}
                row={row}
                delay={i * 70}
                move={moves[row.player.id]}
                sub={
                  r && (
                    <>
                      <TierChip tier={r.tier} />
                      <span className={r.outcome === 'made' ? 'good' : r.outcome === 'missed' ? 'bad' : ''}>
                        {r.outcome === 'made' ? '✓' : r.outcome === 'missed' ? '✗' : '–'} {calcText(r.strokes, r.adjustment, r.gameScore)}
                      </span>
                      {r.doubled && <span className="tag tag-double">2×</span>}
                      {r.freePass && <span className="tag tag-free">Free shot</span>}
                      <VoteTag game={game} playerId={row.player.id} hole={h} />
                      <span className="sr-only">{getCard(r.cardId)?.title}</span>
                    </>
                  )
                }
              />
            );
          })}
        </div>
        <p className="note">Big number = total over or under par. Lowest wins, like golf.</p>
      </div>
      <div className="screen-foot">
        <button type="button" className="btn btn-xl btn-green" onClick={nextHole}>
          {last ? (
            <>
              <TrophyIcon width={28} height={28} /> Final results
            </>
          ) : (
            <>
              Next hole <ArrowIcon width={28} height={28} />
            </>
          )}
        </button>
        <button type="button" className="btn btn-link" onClick={() => navigate({ name: 'scorecard' })}>
          Fix a score
        </button>
      </div>
    </>
  );
}

/** Shows how the group voted on a judged-by-eye claim, and whether it was overturned. */
export function VoteTag({ game, playerId, hole }: { game: Game; playerId: string; hole: number }) {
  if (!isVoteable(game, playerId, hole)) return null;
  const { fair, unfair } = voteTally(getEntry(game, playerId, hole));
  if (fair + unfair === 0) return null;
  return (
    <span className={`tag ${unfair > fair ? 'tag-overturned' : 'tag-upheld'}`}>
      👍{fair} 👎{unfair}
      {unfair > fair ? ' · overturned' : ''}
    </span>
  );
}
