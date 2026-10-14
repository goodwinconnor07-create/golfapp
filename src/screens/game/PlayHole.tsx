import { cardStakes, getEntry, holeResult, mulliganAllowance, mulligansLeft, ownsPlayer, type Game } from '../../game';
import { dispatch, startScoring, useApp } from '../../state/store';
import { ChallengeCard } from '../../ui/ChallengeCard';
import { Avatar } from '../../ui/components';
import { colourWipe, haptic } from '../../ui/effects';
import { FlagIcon } from '../../ui/Icons';

/** Everyone has a card: put the phone away and play. */
export function PlayHole({ game }: { game: Game }) {
  const h = game.current;
  const deviceId = useApp((s) => s.deviceId);
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
              {e?.tier && mulliganAllowance(game) > 0 && (
                <MulliganBar
                  game={game}
                  playerId={p.id}
                  canTake={!game.code || deviceId === game.hostDeviceId || ownsPlayer(game, deviceId, p.id)}
                />
              )}
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

/**
 * Mulligans, right where they happen: tokens for what's left and a button to take one. Undo works
 * until the hole is locked in. Other players' phones just see that one was taken.
 */
function MulliganBar({ game, playerId, canTake }: { game: Game; playerId: string; canTake: boolean }) {
  const h = game.current;
  const taken = Boolean(getEntry(game, playerId, h)?.mulligan);
  const allowance = mulliganAllowance(game);
  const left = mulligansLeft(game, playerId);
  const take = (on: boolean) => {
    if (dispatch({ type: 'mulligan', playerId, hole: h, on })) haptic(on ? 'success' : 'light');
  };
  if (!canTake && !taken) return null;
  return (
    <div className={`mulligan-bar${taken ? ' taken' : ''}`}>
      <span className="mulligan-tokens" aria-label={`${left} of ${allowance} mulligans left`}>
        {Array.from({ length: allowance }, (_, i) => (
          // The token for this hole's mulligan pops when it's spent.
          <i key={i} className={i < left ? 'on' : taken && i === left ? 'spent pop' : ''} />
        ))}
      </span>
      {taken ? (
        <>
          <span className="mulligan-text">🔁 Mulligan taken</span>
          {canTake && (
            <button type="button" className="btn-link-small" onClick={() => take(false)}>
              Undo
            </button>
          )}
        </>
      ) : left > 0 ? (
        <button type="button" className="btn btn-sm btn-outline btn-auto mulligan-btn" onClick={() => take(true)}>
          🔁 Take a mulligan
        </button>
      ) : (
        <span className="mulligan-text muted">No mulligans left</span>
      )}
    </div>
  );
}
