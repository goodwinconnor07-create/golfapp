import { cardStakes, getEntry, hasPicked, type Game } from '../../game';
import { stepIn, useApp } from '../../state/store';
import { ChallengeCard } from '../../ui/ChallengeCard';
import { Avatar } from '../../ui/components';
import { CheckIcon } from '../../ui/Icons';

/** Online: this phone has picked, others haven't yet. */
export function WaitPicks({ game }: { game: Game }) {
  const deviceId = useApp((s) => s.deviceId);
  const h = game.current;
  // Stepping in for a dead phone is the host's job; guests can't pick a friend's level.
  const host = deviceId === game.hostDeviceId;
  const mineWithCards = game.players.filter((p) => {
    const e = getEntry(game, p.id, h);
    return e?.cardId && e.pickedBy === deviceId;
  });

  return (
    <div className="screen-body">
      <div>
        <h1 className="h1">Locked in!</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Cards show when everyone has picked.
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
              ) : host ? (
                <button type="button" className="btn btn-sm btn-ghost btn-auto step-in" onClick={() => stepIn(p.id)}>
                  Pick for them
                </button>
              ) : (
                <span className="tag tag-waiting">Picking…</span>
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
