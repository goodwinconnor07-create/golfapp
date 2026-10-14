import { useEffect, useMemo, useRef, useState } from 'react';
import { formatToPar, getCard, holeResult, newLeader, rankMoves, standings, type Game } from '../../game';
import { markResultsRevealed, navigate, nextHole, resultsRevealSeen } from '../../state/store';
import { BoardRow } from '../../ui/BoardRow';
import { Avatar, Breakdown, TierChip } from '../../ui/components';
import { confetti, CONFETTI, haptic, reducedMotion } from '../../ui/effects';
import { VoteTag } from './HoleResults';
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
              <div
                key={player.id}
                className={`reveal-row result-row ${open ? `open reveal-${r.tier}` : ''} ${top ? 'top' : ''}`}
                aria-hidden={!open}
              >
                <Avatar player={player} size={44} />
                <span className="reveal-name">
                  <span>
                    {top && '👑 '}
                    {player.name}
                  </span>
                  {open && <small className="result-card">{getCard(r.cardId)?.title}</small>}
                </span>
                {open ? (
                  <span className="result-right">
                    <TierChip tier={r.tier} />
                    <b className="result-topar">{formatToPar(r.toPar)}</b>
                  </span>
                ) : (
                  <span className="reveal-hidden" aria-hidden>
                    ?
                  </span>
                )}
                {open && (
                  // Its own line, so the working never squeezes the name.
                  <span className="result-sum">
                    <Breakdown
                      strokes={r.strokes}
                      par={r.par}
                      adjustment={r.adjustment}
                      outcome={r.outcome}
                      doubled={r.doubled}
                      freePass={r.freePass}
                    />
                    {r.mulligan && <span className="tag tag-mulligan">Mulligan</span>}
                  </span>
                )}
                {open && (
                  <span className="result-vote">
                    <VoteTag game={game} playerId={player.id} hole={h} />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {done && (
          <>
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
