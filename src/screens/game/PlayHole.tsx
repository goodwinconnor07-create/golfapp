import { cardStakes, getEntry, holeResult, type Game } from '../../game';
import { startScoring } from '../../state/store';
import { ChallengeCard } from '../../ui/ChallengeCard';
import { Avatar } from '../../ui/components';
import { colourWipe } from '../../ui/effects';
import { FlagIcon } from '../../ui/Icons';

/** Everyone has a card: put the phone away and play. */
export function PlayHole({ game }: { game: Game }) {
  const h = game.current;
  return (
    <>
      <div className="screen-body">
        <div>
          <h1 className="h1">Go play!</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Play the hole for real, then come back to score it.
          </p>
        </div>
        {game.players.map((p, i) => {
          const e = getEntry(game, p.id, h);
          return (
            <div key={p.id} className="stack rise" style={{ gap: 8, animationDelay: `${i * 60}ms` }}>
              <div className="row">
                <Avatar player={p} size={36} />
                <span className="h3" style={{ flex: 1 }}>
                  {p.name}
                </span>
                {holeResult(game, p.id, h) && <span className="tag tag-done">Scored</span>}
              </div>
              {e?.tier && <ChallengeCard compact tier={e.tier} cardId={e.cardId} stakes={cardStakes(game, h, e.tier, e.freePass)} />}
            </div>
          );
        })}
      </div>
      <div className="screen-foot">
        <button type="button" className="btn btn-xl btn-green" onClick={(e) => colourWipe(e, startScoring)}>
          <FlagIcon width={28} height={28} /> Hole done
        </button>
      </div>
    </>
  );
}
