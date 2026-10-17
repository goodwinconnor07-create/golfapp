import { useEffect, useState } from 'react';
import { getEntry, isDoubleHole, type Game } from '../../game';
import { doneGroupReveal } from '../../state/store';
import { Avatar, TierChip } from '../../ui/components';
import { confetti, CONFETTI, haptic, reducedMotion } from '../../ui/effects';

const COUNT_MS = 600;
const FLIP_GAP_MS = 260;

/** Everyone has picked: count down, then flip every player's risk level over at once. */
export function GroupReveal({ game }: { game: Game }) {
  const h = game.current;
  const [count, setCount] = useState(reducedMotion() ? 0 : 3);
  const [shown, setShown] = useState(reducedMotion() ? game.players.length : 0);
  const insane = game.players.filter((p) => getEntry(game, p.id, h)?.tier === 'insane').length;

  // 3, 2, 1…
  useEffect(() => {
    if (count <= 0) return;
    haptic('light');
    const t = setTimeout(() => setCount((c) => c - 1), COUNT_MS);
    return () => clearTimeout(t);
  }, [count]);

  // …then each player's tier flips over in turn.
  useEffect(() => {
    if (count > 0 || shown >= game.players.length) return;
    const t = setTimeout(
      () => {
        const tier = getEntry(game, game.players[shown].id, h)?.tier;
        haptic(tier === 'insane' ? 'heavy' : 'medium');
        setShown((s) => s + 1);
      },
      shown === 0 ? 120 : FLIP_GAP_MS,
    );
    return () => clearTimeout(t);
  }, [count, shown, game, h]);

  const done = count === 0 && shown >= game.players.length;
  useEffect(() => {
    if (done && insane > 0) confetti(CONFETTI.insane, { x: innerWidth / 2, y: innerHeight * 0.35 }, 50 + insane * 30);
  }, [done, insane]);

  const skip = () => {
    setCount(0);
    setShown(game.players.length);
  };

  return (
    <>
      <div className="screen-body" onClick={done ? undefined : skip}>
        <div>
          <h1 className="h1">Everyone's in!</h1>
          {isDoubleHole(game, h) && (
            <p className="muted" style={{ margin: '6px 0 0' }}>
              Double stakes on this hole.
            </p>
          )}
        </div>
        {count > 0 ? (
          <div className="reveal-count" key={count} aria-live="polite">
            {count}
          </div>
        ) : (
          <div className="stack">
            {game.players.map((p, i) => {
              const e = getEntry(game, p.id, h);
              const open = i < shown;
              return (
                <div key={p.id} className={`reveal-row ${open ? 'open' : ''} ${open && e?.tier ? `reveal-${e.tier}` : ''}`}>
                  <Avatar player={p} size={44} />
                  <span className="reveal-name">
                    {p.name}
                    {open && e?.freePass && <small className="reveal-free">🛟 Free shot</small>}
                  </span>
                  {open && e?.tier ? (
                    <TierChip tier={e.tier} big />
                  ) : (
                    <span className="reveal-hidden" aria-hidden>
                      ?
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="screen-foot">
        {/* Never greyed out: during the countdown the first tap skips to the end. */}
        <button type="button" className="btn btn-xl btn-green" onClick={done ? doneGroupReveal : skip}>
          Go play!
        </button>
      </div>
    </>
  );
}
