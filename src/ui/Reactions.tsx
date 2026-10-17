import { useState } from 'react';
import { getEntry, REACTIONS, type Game } from '../game';
import { reactTo, useApp } from '../state/store';
import { reactionTarget, reactorFor } from '../state/view';

/**
 * Reactions on someone's hole result (or the other team's, in 2v2). Everyone sees the tallies;
 * online, other players get one React button that opens the five emojis. Your own pick shows
 * once, as the outlined tally; tap it to take it back. Closes when the group moves on.
 */
export function Reactions({ game, playerId, hole }: { game: Game; playerId: string; hole: number }) {
  const deviceId = useApp((s) => s.deviceId);
  const [open, setOpen] = useState(false);
  const reactions = getEntry(game, reactionTarget(game, playerId), hole)?.reactions ?? {};
  const me = hole === game.current && game.status === 'playing' ? reactorFor(game, deviceId, playerId) : null;
  const mine = me ? reactions[me] : undefined;
  const tally = REACTIONS.map((e) => [e, Object.values(reactions).filter((x) => x === e).length] as const).filter(([, n]) => n > 0);
  if (!me && tally.length === 0) return null;
  const pick = (e: string) => {
    reactTo(playerId, e);
    setOpen(false);
  };
  return (
    <span className="react-line" onClick={(ev) => ev.stopPropagation()}>
      {tally.map(([e, n]) =>
        me && mine === e ? (
          <button key={`${e}${n}`} type="button" className="react-tally mine press" aria-label={`${n} ${e}, yours. Take it back`} onClick={() => pick(e)}>
            {e}
            {n > 1 && n}
          </button>
        ) : (
          <span key={`${e}${n}`} className="react-tally" aria-label={`${n} ${e}`}>
            {e}
            {n > 1 && n}
          </span>
        ),
      )}
      {me && !open && (
        <button type="button" className="react-open press" aria-expanded={false} onClick={() => setOpen(true)}>
          {mine ? 'Change' : 'React'}
        </button>
      )}
      {me && open && (
        <span className="react-picker" role="group" aria-label="Pick a reaction">
          {REACTIONS.map((e) => (
            <button key={e} type="button" className={`react-btn press ${mine === e ? 'on' : ''}`} aria-label={`React ${e}`} aria-pressed={mine === e} onClick={() => pick(e)}>
              {e}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
