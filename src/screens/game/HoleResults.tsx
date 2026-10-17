import { useEffect } from 'react';
import { getCard, getEntry, holeResult, unitHoleResult, isVoteable, rankMoves, standings, voteTally, type Game } from '../../game';
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
        {/* The hole number is in the top bar already. Each row: this hole, then the running total. */}
        <h1 className="h1">Results</h1>
        <Overtakes game={game} />
        <div className="board-cols" aria-hidden>
          <span>This hole</span>
          <span>Total</span>
        </div>
        <div className="board">
          {rows.map((row, i) => {
            const r = unitHoleResult(game, row.player.id, h);
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
                        cardTitle={getCard(r.cardId)?.title}
                        doubled={r.doubled}
                      />
                      <HoleMeta mulligan={r.mulligan} freePass={r.freePass}>
                        <VoteTag game={game} playerId={row.player.id} hole={h} />
                      </HoleMeta>
                      <Reactions game={game} playerId={row.player.id} hole={h} />
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
      {unfair > fair ? 'Voted down' : 'Vote'} 👍 {fair} · 👎 {unfair}
    </span>
  );
}
