import { cardStakes, getEntry, hasPicked, holeResult, type Game } from '../../game';
import { stepIn, useApp } from '../../state/store';
import { ChallengeCard } from '../../ui/ChallengeCard';
import { Avatar } from '../../ui/components';
import { calcText } from '../../ui/format';
import { CheckIcon } from '../../ui/Icons';

/** Online: this phone has picked, others haven't yet. */
export function WaitPicks({ game }: { game: Game }) {
  const deviceId = useApp((s) => s.deviceId);
  const h = game.current;
  const mineWithCards = game.players.filter((p) => {
    const e = getEntry(game, p.id, h);
    return e?.cardId && e.pickedBy === deviceId;
  });

  return (
    <div className="screen-body">
      <div>
        <h1 className="h1">Locked in!</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Everyone's cards show once the whole group has picked.
        </p>
      </div>
      <div className="stack">
        {game.players.map((p) => {
          const picked = hasPicked(getEntry(game, p.id, h));
          return (
            <div key={p.id} className="player-row">
              <Avatar player={p} size={46} />
              <span className="name">{p.name}</span>
              {picked ? (
                <span className="tag tag-done">
                  <CheckIcon width={14} height={14} style={{ verticalAlign: -2 }} /> Locked in
                </span>
              ) : (
                <button type="button" className="btn btn-sm btn-ghost btn-auto step-in" onClick={() => stepIn('pick', p.id)}>
                  Pick for them
                </button>
              )}
            </div>
          );
        })}
      </div>
      {mineWithCards.map((p) => {
        const e = getEntry(game, p.id, h)!;
        return (
          <div key={p.id} className="stack" style={{ gap: 8 }}>
            <p className="section-title">{mineWithCards.length > 1 ? `${p.name}'s card` : 'Your card'}</p>
            <ChallengeCard compact tier={e.tier!} cardId={e.cardId} stakes={cardStakes(game, h, e.tier!, e.freePass)} />
          </div>
        );
      })}
    </div>
  );
}

/** This phone has entered its scores; waiting on the rest. */
export function WaitScores({ game }: { game: Game }) {
  const h = game.current;
  return (
    <div className="screen-body">
      <div>
        <h1 className="h1">Nearly there</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Waiting for everyone's scores.
        </p>
      </div>
      <div className="stack">
        {game.players.map((p) => {
          const r = holeResult(game, p.id, h);
          return (
            <div key={p.id} className="player-row">
              <Avatar player={p} size={46} />
              <span className="name">{p.name}</span>
              {r ? (
                <span className={`tag ${r.outcome === 'missed' ? 'tag-waiting' : 'tag-done'}`}>
                  {calcText(r.strokes, r.adjustment, r.gameScore, r.par)}
                </span>
              ) : (
                <button type="button" className="btn btn-sm btn-ghost btn-auto step-in" onClick={() => stepIn('score', p.id)}>
                  Enter for them
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
