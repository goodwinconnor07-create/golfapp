import { useEffect, useState } from 'react';
import { formatToPar, getCard, holeResult, type Game } from '../../game';
import { doneResultsReveal } from '../../state/store';
import { Avatar, TierChip } from '../../ui/components';
import { confetti, CONFETTI, haptic, reducedMotion } from '../../ui/effects';
import { calcText } from '../../ui/format';

const GAP_MS = 520;

/** Everyone has scored: flip each player's hole result over in turn, saving the best for last. */
export function ResultsReveal({ game }: { game: Game }) {
  const h = game.current;
  // Worst first, so the hole's best score lands last.
  const rows = game.players
    .map((p) => ({ player: p, r: holeResult(game, p.id, h)! }))
    .filter((x) => x.r)
    .sort((a, b) => b.r.toPar - a.r.toPar);
  const [shown, setShown] = useState(reducedMotion() ? rows.length : 0);
  const done = shown >= rows.length;
  const best = rows[rows.length - 1];

  useEffect(() => {
    if (done) return;
    const t = setTimeout(
      () => {
        const next = rows[shown];
        haptic(next.r.outcome === 'made' ? (next.r.tier === 'insane' ? 'heavy' : 'medium') : 'light');
        setShown((s) => s + 1);
      },
      shown === 0 ? 250 : GAP_MS,
    );
    return () => clearTimeout(t);
  }, [shown, done, rows]);

  useEffect(() => {
    if (done && best)
      confetti(best.r.outcome === 'made' ? CONFETTI[best.r.tier] : CONFETTI.party, { x: innerWidth / 2, y: innerHeight * 0.3 }, 70);
  }, [done, best]);

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
                    <span className="result-calc">
                      <TierChip tier={r.tier} />
                      <b className={r.outcome === 'made' ? 'good' : r.outcome === 'missed' ? 'bad' : ''}>
                        {r.outcome === 'made' ? '✓' : r.outcome === 'missed' ? '✗' : '–'} {calcText(r.strokes, r.adjustment, r.gameScore)}
                      </b>
                    </span>
                    <b className="result-topar">{formatToPar(r.toPar)}</b>
                  </span>
                ) : (
                  <span className="reveal-hidden" aria-hidden>
                    ?
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="screen-foot">
        <button type="button" className="btn btn-xl btn-green" disabled={!done} onClick={doneResultsReveal}>
          See standings
        </button>
      </div>
    </>
  );
}
