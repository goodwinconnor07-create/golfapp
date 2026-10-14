import { type Game, type ScoreEdit } from '../../game';
import { Avatar } from '../../ui/components';

const RESULT: Record<string, string> = { made: 'completed', missed: 'failed', na: "didn't happen" };

function change(e: ScoreEdit): string {
  const strokes = e.from.strokes !== e.to.strokes ? `${e.from.strokes} → ${e.to.strokes} strokes` : `${e.to.strokes} strokes`;
  const result = e.from.outcome !== e.to.outcome && e.to.outcome ? ` · now ${RESULT[e.to.outcome]}` : '';
  return strokes + result;
}

/** Every score changed after it was locked in, so nobody can quietly rewrite the card. */
export function EditList({ game, title = 'Score changes' }: { game: Game; title?: string }) {
  if (!game.edits?.length) return null;
  return (
    <div className="edit-list">
      <p className="section-title">{title}</p>
      {game.edits.map((e, i) => {
        const p = game.players.find((x) => x.id === e.playerId);
        if (!p) return null;
        return (
          <div key={i} className="edit-row">
            <Avatar player={p} size={30} />
            <span>
              <b>
                {p.name} · hole {game.holes[e.hole]?.number}
              </b>{' '}
              {change(e)}
              <small>{e.how === 'Host' ? 'Changed by the host' : e.how}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}
