import { getCard, getEntry, isVoteable, type Game } from '../../game';
import { castVote, useApp } from '../../state/store';
import { Avatar } from '../../ui/components';

/**
 * Honour-system cards (judged by eye) go to the group: when someone says they made one,
 * everyone else gets a thumbs up or down on their own phone. More downs than ups = failed.
 */
export function VotePrompt({ game }: { game: Game }) {
  const deviceId = useApp((s) => s.deviceId);
  const online = useApp((s) => s.session?.mode === 'online');
  if (!online || game.status !== 'playing') return null;
  const me = game.players.find((p) => p.deviceId === deviceId);
  if (!me) return null;
  const h = game.current;

  const claims = game.players.filter(
    (p) => p.id !== me.id && isVoteable(game, p.id, h) && getEntry(game, p.id, h)?.votes?.[me.id] === undefined,
  );
  if (claims.length === 0) return null;

  return (
    <div className="stack" style={{ gap: 10, marginBottom: 12 }}>
      {claims.map((p) => {
        const card = getCard(getEntry(game, p.id, h)?.cardId)!;
        return (
          <div key={p.id} className="vote-card rise" role="group" aria-label={`Vote on ${p.name}'s claim`}>
            <div className="row" style={{ gap: 10 }}>
              <Avatar player={p} size={36} />
              <b className="vote-title">
                {p.name} says they made <span className="vote-card-name">{card.title}</span>
              </b>
            </div>
            <p className="vote-pass">{card.pass}</p>
            <div className="made-missed">
              <button type="button" className="btn btn-green" onClick={() => castVote(p.id, me.id, true)}>
                👍 Fair
              </button>
              <button type="button" className="btn btn-red" onClick={() => castVote(p.id, me.id, false)}>
                👎 No way
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
