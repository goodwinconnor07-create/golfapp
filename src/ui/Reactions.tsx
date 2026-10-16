import { getEntry, REACTIONS, type Game } from '../game';
import { reactTo, useApp } from '../state/store';
import { reactorFor } from '../state/view';

/**
 * One-tap reactions and heckles on someone's hole result. Everyone sees the tallies; online,
 * other players get the five buttons (tap again to take yours back). Closes when the group moves on.
 */
export function Reactions({ game, playerId, hole }: { game: Game; playerId: string; hole: number }) {
  const deviceId = useApp((s) => s.deviceId);
  const reactions = getEntry(game, playerId, hole)?.reactions ?? {};
  const me = hole === game.current && game.status === 'playing' ? reactorFor(game, deviceId, playerId) : null;
  const mine = me ? reactions[me] : undefined;
  const tally = REACTIONS.map((e) => [e, Object.values(reactions).filter((x) => x === e).length] as const).filter(([, n]) => n > 0);
  if (!me && tally.length === 0) return null;
  return (
    <span className="react-line">
      {tally.map(([e, n]) => (
        <span key={`${e}${n}`} className="react-tally" aria-label={`${n} ${e}`}>
          {e}
          {n > 1 && n}
        </span>
      ))}
      {me &&
        REACTIONS.map((e) => (
          <button
            key={e}
            type="button"
            className={`react-btn press ${mine === e ? 'on' : ''}`}
            aria-label={`React ${e}`}
            aria-pressed={mine === e}
            onClick={(ev) => {
              ev.stopPropagation();
              reactTo(playerId, e);
            }}
          >
            {e}
          </button>
        ))}
    </span>
  );
}
