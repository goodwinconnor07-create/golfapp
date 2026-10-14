import { useEffect, useMemo, useRef, useState } from 'react';
import { formatToPar, getCard, holeResult, newLeader, rankMoves, standings, type Game } from '../../game';
import { markResultsRevealed, navigate, nextHole, resultsRevealSeen } from '../../state/store';
import { BoardRow, PlayerRow } from '../../ui/BoardRow';
import { HoleMeta, Working } from '../../ui/components';
import { confetti, CONFETTI, haptic, reducedMotion } from '../../ui/effects';
import { VoteTag } from './HoleResults';
import { Moment } from './Moment';
import { ArrowIcon, TrophyIcon } from '../../ui/Icons';

const GAP_MS = 520;

/**
 * Online, once everyone has scored: each player's hole flips over in turn (best last),
 * then the standings appear underneath with Next hole. One screen for the whole moment.
 */
export function ResultsReveal({ game }: { game: Game }) {
  const h = game.current;
  // Worst first, so the hole's best score lands last.
  const rows = useMemo(
    () =>
      game.players
        .map((p) => ({ player: p, r: holeResult(game, p.id, h)! }))
        .filter((x) => x.r)
        .sort((a, b) => b.r.toPar - a.r.toPar),
    [game, h],
  );
  // Already watched (say, after a reload)? Show it all straight away.
  const [shown, setShown] = useState(() => (reducedMotion() || resultsRevealSeen(game.id, h) ? rows.length : 0));
  const done = shown >= rows.length;
  const best = rows[rows.length - 1];
  const last = h === game.holes.length - 1;
  const leader = newLeader(game, h);
  const moves = rankMoves(game);
  const board = standings(game);

  // Timing only depends on how many rows have flipped, so votes or other updates
  // arriving mid-reveal don't restart it.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useEffect(() => {
    if (done) return;
    const t = setTimeout(
      () => {
        const next = rowsRef.current[shown];
        if (next) haptic(next.r.outcome === 'made' ? (next.r.tier === 'insane' ? 'heavy' : 'medium') : 'light');
        setShown((n) => n + 1);
      },
      shown === 0 ? 250 : GAP_MS,
    );
    return () => clearTimeout(t);
  }, [shown, done]);

  useEffect(() => {
    if (!done || !best) return;
    if (!resultsRevealSeen(game.id, h)) {
      confetti(best.r.outcome === 'made' ? CONFETTI[best.r.tier] : CONFETTI.party, { x: innerWidth / 2, y: innerHeight * 0.3 }, 70);
      markResultsRevealed();
    }
  }, [done, best, game.id, h]);

  return (
    <>
      <div className="screen-body" onClick={done ? undefined : () => setShown(rows.length)}>
        <h1 className="h1">Hole {game.holes[h].number} results</h1>
        <div className="stack">
          {rows.map(({ player, r }, i) => {
            const open = i < shown;
            const top = open && done && r.toPar === best.r.toPar;
            return (
              <PlayerRow
                key={player.id}
                player={player}
                className={`reveal-row result-row ${open ? 'open' : ''} ${top ? 'top' : ''}`}
                hidden={!open}
                name={
                  <>
                    {top && '👑 '}
                    {player.name}
                  </>
                }
                detail={
                  open && (
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
                      <VoteTag game={game} playerId={player.id} hole={h} />
                      <span className="sr-only">{getCard(r.cardId)?.title}</span>
                    </>
                  )
                }
                score={open ? formatToPar(r.toPar) : <span className="reveal-hidden">?</span>}
                scoreLabel={open ? 'To par' : null}
              />
            );
          })}
        </div>

        {done && (
          <>
            <Moment game={game} />
            {leader && (
              <div className="lead-banner pop" role="status">
                👑 {leader.name} takes the lead!
              </div>
            )}
            <p className="section-title" style={{ margin: '6px 0 0' }}>
              Standings
            </p>
            <div className="board">
              {board.map((row, i) => (
                <BoardRow key={row.player.id} row={row} delay={150 + i * 70} move={moves[row.player.id]} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="screen-foot">
        <button type="button" className="btn btn-xl btn-green" disabled={!done} onClick={nextHole}>
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
        {done && (
          <button type="button" className="btn btn-link" onClick={() => navigate({ name: 'scorecard' })}>
            Fix a score
          </button>
        )}
      </div>
    </>
  );
}
