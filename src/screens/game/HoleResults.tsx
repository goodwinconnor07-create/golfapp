import { useEffect } from 'react';
import { getCard, holeResult, standings, type Game } from '../../game';
import { navigate, nextHole } from '../../state/store';
import { BoardRow } from '../../ui/BoardRow';
import { TierChip } from '../../ui/components';
import { confetti, CONFETTI } from '../../ui/effects';
import { calcText } from '../../ui/format';
import { ArrowIcon, TrophyIcon } from '../../ui/Icons';

export function HoleResults({ game }: { game: Game }) {
  const h = game.current;
  const rows = standings(game);
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
        <div className="board">
          {rows.map((row, i) => {
            const r = holeResult(game, row.player.id, h);
            return (
              <BoardRow
                key={row.player.id}
                row={row}
                delay={i * 70}
                sub={
                  r && (
                    <>
                      <TierChip tier={r.tier} />
                      <span className={r.outcome === 'made' ? 'good' : r.outcome === 'missed' ? 'bad' : ''}>
                        {r.outcome === 'made' ? '✓' : r.outcome === 'missed' ? '✗' : '–'}{' '}
                        {calcText(r.strokes, r.adjustment, r.gameScore, r.par)}
                      </span>
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
