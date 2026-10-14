import { fixesToAnswer, getEntry, type FixRequest, type Game } from '../../game';
import { dispatch, useApp } from '../../state/store';
import { Avatar } from '../../ui/components';
import { BellIcon } from '../../ui/Icons';

const RESULT: Record<string, string> = { made: 'completed', missed: 'failed', na: "didn't happen" };

function describe(game: Game, f: FixRequest): string {
  const now = getEntry(game, f.playerId, f.hole);
  const strokes = now?.strokes != null && now.strokes !== f.strokes ? `${now.strokes} → ${f.strokes} strokes` : `${f.strokes} strokes`;
  const result = f.outcome && f.outcome !== now?.outcome ? ` · ${RESULT[f.outcome]}` : '';
  return strokes + result;
}

/** How many requests are waiting on this phone: the red badge on the bell. */
export function useFixCount(game: Game): number {
  const deviceId = useApp((s) => s.deviceId);
  return fixesToAnswer(game, deviceId).length;
}

/** Someone wants to change a locked-in score: the player it belongs to (or the host) approves or denies. */
export function FixList({ game }: { game: Game }) {
  const deviceId = useApp((s) => s.deviceId);
  const asks = fixesToAnswer(game, deviceId);
  if (asks.length === 0) {
    return (
      <div className="notif-empty">
        <BellIcon width={40} height={40} />
        <b>No new notifications</b>
        <span>Requests to change a score show up here.</span>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      {asks.map((f) => {
        const p = game.players.find((x) => x.id === f.playerId);
        if (!p) return null;
        const own = f.byName === p.name;
        return (
          <div key={f.id} className="vote-card fix-card rise" role="group" aria-label={`Change to ${p.name}'s score`}>
            <div className="row" style={{ gap: 10 }}>
              <Avatar player={p} size={36} />
              <b className="vote-title">
                {own ? `${p.name} wants to fix hole` : `${f.byName} wants to fix ${p.name}'s hole`} {game.holes[f.hole]?.number}
              </b>
            </div>
            <p className="vote-pass">{describe(game, f)}</p>
            <div className="made-missed">
              <button type="button" className="btn btn-green" onClick={() => dispatch({ type: 'answerFix', id: f.id, accept: true })}>
                Approve
              </button>
              <button type="button" className="btn btn-red" onClick={() => dispatch({ type: 'answerFix', id: f.id, accept: false })}>
                Deny
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
