import { useState } from 'react';
import { getEntry, REACTIONS, type Game } from '../game';
import { reactTo, useApp } from '../state/store';
import { reactorFor } from '../state/view';

/**
 * One-tap reactions and heckles on someone's hole result. Everyone sees the tallies ("🔥 2"); online,
 * friends on other phones get one small "React" button that opens the five choices (tap yours again
 * to take it back). Closed by default so a row isn't a strip of emoji. Closes when the group moves on.
 */
export function Reactions({ game, playerId, hole }: { game: Game; playerId: string; hole: number }) {
  const deviceId = useApp((s) => s.deviceId);
  const [open, setOpen] = useState(false);
  const reactions = getEntry(game, playerId, hole)?.reactions ?? {};
  const me = hole === game.current && game.status === 'playing' ? reactorFor(game, deviceId, playerId) : null;
  const mine = me ? reactions[me] : undefined;
  const tally = REACTIONS.map((e) => [e, Object.values(reactions).filter((x) => x === e).length] as const).filter(([, n]) => n > 0);
  if (!me && tally.length === 0) return null;
  const pick = (e: string) => {
    reactTo(playerId, e);
    setOpen(false);
  };
  return (
    <span className="react-line">
      {!open &&
        tally.map(([e, n]) => (
          <span key={`${e}${n}`} className={`react-tally${mine === e ? ' mine' : ''}`} aria-label={`${n} ${e}`}>
            {e} {n}
          </span>
        ))}
      {me && !open && (
        <button
          type="button"
          className="react-open press"
          onClick={(ev) => {
            ev.stopPropagation();
            setOpen(true);
          }}
        >
          {mine ? 'Change' : 'React'}
        </button>
      )}
      {me &&
        open &&
        REACTIONS.map((e) => (
          <button
            key={e}
            type="button"
            className={`react-btn press ${mine === e ? 'on' : ''}`}
            aria-label={`React ${e}`}
            aria-pressed={mine === e}
            onClick={(ev) => {
              ev.stopPropagation();
              pick(e);
            }}
          >
            {e}
          </button>
        ))}
    </span>
  );
}
