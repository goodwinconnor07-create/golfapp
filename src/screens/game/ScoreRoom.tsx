import { holeStatus, type Game } from '../../game';
import { enterScoreFor, useApp } from '../../state/store';
import { myPlayers } from '../../state/view';
import { Avatar } from '../../ui/components';
import { joinNames } from '../../ui/format';
import { CheckIcon } from '../../ui/Icons';

const STATUS = {
  playing: { label: 'Still playing', className: 'status-playing' },
  done: { label: 'Done · scoring', className: 'status-done' },
  scored: { label: 'Scored', className: 'status-scored' },
} as const;

/**
 * Online, after "Hole done": everyone's status at a glance. Players can enter their own
 * score while they wait; other people's numbers stay hidden until everyone has scored.
 */
export function ScoreRoom({ game }: { game: Game }) {
  const deviceId = useApp((s) => s.deviceId);
  const h = game.current;
  const mine = myPlayers(game, deviceId, true);
  const mineIds = new Set(mine.map((p) => p.id));
  const status = new Map(game.players.map((p) => [p.id, holeStatus(game, p.id, h)]));
  const stillPlaying = game.players.filter((p) => status.get(p.id) === 'playing');
  const notScored = game.players.filter((p) => status.get(p.id) !== 'scored');
  const myNext = mine.find((p) => status.get(p.id) !== 'scored');

  const title =
    stillPlaying.length > 0
      ? `Waiting for ${joinNames(stillPlaying.map((p) => p.name))}`
      : notScored.length > 0
        ? "Everyone's done!"
        : 'All in!';

  return (
    <>
      <div className="screen-body">
        <div>
          <h1 className="h1">{title}</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {myNext ? 'Put your score in while you wait. ' : ''}Results show when everyone's scored.
          </p>
        </div>
        <div className="stack">
          {game.players.map((p) => {
            const s = status.get(p.id)!;
            const look = STATUS[s];
            return (
              <div key={p.id} className={`player-row room-row ${look.className}`}>
                <Avatar player={p} size={46} />
                <span className="name">{p.name}</span>
                {s !== 'scored' && mineIds.has(p.id) && mine.length > 1 ? (
                  <button type="button" className="btn btn-sm btn-blue btn-auto" onClick={() => enterScoreFor(p.id)}>
                    Enter score
                  </button>
                ) : s !== 'scored' && !mineIds.has(p.id) && s === 'done' ? (
                  <span className="room-tags">
                    <span key={s} className={`tag room-tag pop ${look.className}`}>
                      {look.label}
                    </span>
                    <button type="button" className="btn-link-small" onClick={() => enterScoreFor(p.id)}>
                      Enter for them
                    </button>
                  </span>
                ) : (
                  <span key={s} className={`tag room-tag pop ${look.className}`}>
                    {s === 'playing' && (
                      <span className="dots" aria-hidden>
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                    {s === 'scored' && <CheckIcon width={16} height={16} />}
                    {look.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Only when there's something to do: the heading already says who we're waiting for. */}
      {myNext && (
        <div className="screen-foot">
          <button type="button" className="btn btn-xl btn-blue" onClick={() => enterScoreFor(myNext.id)}>
            {mine.length > 1 ? `Enter ${myNext.name}'s score` : 'Enter my score'}
          </button>
        </div>
      )}
    </>
  );
}
