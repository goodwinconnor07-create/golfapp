import { useEffect } from 'react';
import { getCard, getEntry, holeResult, isVoteable, rankMoves, standings, voteTally, type Game } from '../../game';
import { navigate, nextHole } from '../../state/store';
import { BoardRow } from '../../ui/BoardRow';
import { HoleMeta, Working } from '../../ui/components';
import { confetti, CONFETTI } from '../../ui/effects';
import { ArrowIcon, TrophyIcon } from '../../ui/Icons';
import { Moment } from './Moment';
import { Overtakes } from './Overtakes';
import { Reactions } from '../../ui/Reactions';

export function HoleResults({ game }: { game: Game }) {
  const h = game.current;
  const rows = standings(game);
  const moves = rankMoves(game);
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
        {/* Each row: this hole's working, then the running total. */}
        <div className="reveal-head">
          <h1 className="h1">Hole {game.holes[h].number} done!</h1>
          <span className="col-label" aria-hidden>
            Total
          </span>
        </div>
        <Overtakes game={game} />
        <div className="board">
          {rows.map((row, i) => {
            const r = holeResult(game, row.player.id, h);
            return (
              <BoardRow
                key={row.player.id}
                row={row}
                delay={i * 70}
                move={moves[row.player.id]}
                scoreLabel={null}
                sub={
                  r && (
                    <>
                      <Working
                        strokes={r.strokes}
                        par={r.par}
                        adjustment={r.adjustment}
                        outcome={r.outcome}
                        tier={r.tier}
                        doubled={r.doubled}
                      />
                      <HoleMeta mulligan={r.mulligan} freePass={r.freePass} />
                      <VoteTag game={game} playerId={row.player.id} hole={h} />
                      <Reactions game={game} playerId={row.player.id} hole={h} />
                      <span className="sr-only">{getCard(r.cardId)?.title}</span>
                    </>
                  )
                }
              />
            );
          })}
        </div>
        <Moment game={game} />
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
    <span className={`vote-note${unfair > fair ? ' meta-bad' : ''}`}>
      👍{fair} 👎{unfair}
      {unfair > fair ? ' · overturned' : ''}
    </span>
  );
}
