import { useState } from 'react';
import { cardStakes, getCard, getEntry, mulliganAllowance, mulligansLeft, ownsPlayer, playerScored, type Game } from '../../game';
import { dispatch, startScoring, useApp } from '../../state/store';
import { myPlayers } from '../../state/view';
import { ChallengeCard } from '../../ui/ChallengeCard';
import { Avatar, TierChip } from '../../ui/components';
import { colourWipe, haptic } from '../../ui/effects';
import { GroupList } from '../../ui/GroupList';
import { BackIcon, FlagIcon } from '../../ui/Icons';

/** Everyone has a card: put the phone away and play. */
export function PlayHole({ game }: { game: Game }) {
  const deviceId = useApp((s) => s.deviceId);
  const online = useApp((s) => s.session?.mode === 'online');
  const mine = myPlayers(game, deviceId, online);
  // Friends on their own phones: your card, then the group live.
  if (online && game.players.some((p) => !mine.includes(p))) return <LiveHole game={game} mine={mine} />;
  return <SharedPhoneHole game={game} />;
}

/**
 * Online: your card (the thing you need on the course), then everyone in the group with their
 * level and whether they're still playing or have scored. The same list becomes the waiting room.
 */
function LiveHole({ game, mine }: { game: Game; mine: Game['players'] }) {
  const h = game.current;
  const deviceId = useApp((s) => s.deviceId);
  return (
    <>
      <div className="screen-body">
        <h1 className="sr-only">Go play!</h1>
        {mine.map((p) => {
          const e = getEntry(game, p.id, h);
          if (!e?.tier) return null;
          return (
            <div key={p.id} className="stack rise" style={{ gap: 8 }}>
              {mine.length > 1 && (
                <span className="row play-who-static">
                  <Avatar player={p} size={28} />
                  <span className="h3">{p.name}</span>
                </span>
              )}
              <ChallengeCard compact tier={e.tier} cardId={e.cardId} stakes={cardStakes(game, h, e.tier, e.freePass)} />
              {mulliganAllowance(game) > 0 && (
                <MulliganBar game={game} playerId={p.id} canTake={ownsPlayer(game, deviceId, p.id) || deviceId === game.hostDeviceId} />
              )}
            </div>
          );
        })}
        <GroupList game={game} mineIds={new Set(mine.map((p) => p.id))} />
      </div>
      <div className="screen-foot">
        <button type="button" className="btn btn-xl btn-green" onClick={(e) => colourWipe(e, startScoring)}>
          <FlagIcon width={28} height={28} /> Hole done
        </button>
      </div>
    </>
  );
}

/** Everyone on this phone: each player's card, one open at a time. */
function SharedPhoneHole({ game }: { game: Game }) {
  const h = game.current;
  const deviceId = useApp((s) => s.deviceId);
  // One card is open (your own, or the first on a shared phone); the rest are one-line rows that
  // open on a tap, so the list fits above Hole done.
  const [open, setOpen] = useState<Set<string>>(() => {
    const mine = game.code ? game.players.find((p) => ownsPlayer(game, deviceId, p.id)) : undefined;
    const first = mine ?? game.players[0];
    return new Set(first ? [first.id] : []);
  });
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
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
          const shown = open.has(p.id) || !e?.tier;
          return (
            <div key={p.id} className="stack rise" style={{ gap: 8, animationDelay: `${i * 60}ms` }}>
              <button
                type="button"
                className="row play-who"
                aria-expanded={shown}
                aria-label={`${p.name}${e?.tier ? `: ${getCard(e.cardId)?.title ?? ''}` : ''}${shown ? '' : ', show card'}`}
                onClick={() => e?.tier && toggle(p.id)}
              >
                <Avatar player={p} size={36} />
                <span className="play-name">
                  <span className="h3">{p.name}</span>
                  {!shown && <small className="play-card-title">{getCard(e?.cardId)?.title}</small>}
                </span>
                {playerScored(game, p.id, h) && <span className="tag tag-done">Scored</span>}
                {!shown && e?.tier && <TierChip tier={e.tier} />}
                {e?.tier && <BackIcon width={20} height={20} className={`play-chevron${shown ? ' open' : ''}`} aria-hidden />}
              </button>
              {shown && e?.tier && (
                <ChallengeCard compact tier={e.tier} cardId={e.cardId} stakes={cardStakes(game, h, e.tier, e.freePass)} />
              )}
              {shown && e?.tier && mulliganAllowance(game) > 0 && (
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
