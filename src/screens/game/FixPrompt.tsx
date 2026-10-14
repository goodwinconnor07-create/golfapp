import { fixesToAnswer, getEntry, type FixRequest, type Game } from '../../game';
import { dispatch, useApp } from '../../state/store';
import { Avatar } from '../../ui/components';

const RESULT: Record<string, string> = { made: 'completed', missed: 'failed', na: "didn't happen" };

function describe(game: Game, f: FixRequest): string {
  const now = getEntry(game, f.playerId, f.hole);
  const strokes = now?.strokes != null && now.strokes !== f.strokes ? `${now.strokes} → ${f.strokes} strokes` : `${f.strokes} strokes`;
  const result = f.outcome && f.outcome !== now?.outcome ? ` · ${RESULT[f.outcome]}` : '';
  return strokes + result;
}

/** Someone wants to change a locked-in score: the player it belongs to (or the host) says yes or no. */
export function FixPrompt({ game }: { game: Game }) {
  const deviceId = useApp((s) => s.deviceId);
  const asks = fixesToAnswer(game, deviceId);
  if (asks.length === 0) return null;

  return (
    <div className="stack" style={{ gap: 10, marginBottom: 12 }}>
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
              <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'answerFix', id: f.id, accept: false })}>
                Keep it
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
