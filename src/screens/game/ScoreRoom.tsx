import { formatToPar, getEntry, holeResult, holeStatus, ownsPlayer, type Game, type Player } from '../../game';
import { confirm, enterScoreFor, notDoneYet, openSheet, useApp } from '../../state/store';
import { myPlayers } from '../../state/view';
import { Avatar, Working } from '../../ui/components';
import { joinNames } from '../../ui/format';
import { GroupList } from '../../ui/GroupList';

/**
 * Online, after "Hole done": the same group list as while playing, plus your own result (other
 * people's numbers stay hidden until everyone has scored) and where the group goes next.
 * The host can score for anyone whose phone has died, played out or not.
 */
export function ScoreRoom({ game }: { game: Game }) {
  const deviceId = useApp((s) => s.deviceId);
  const h = game.current;
  const mine = myPlayers(game, deviceId, true);
  const mineIds = new Set(mine.map((p) => p.id));
  const stillPlaying = game.players.filter((p) => holeStatus(game, p.id, h) === 'playing');
  const myNext = mine.find((p) => holeStatus(game, p.id, h) !== 'scored');
  const host = deviceId === game.hostDeviceId;
  const next = game.holes[h + 1];

  const title = stillPlaying.length > 0 ? `Waiting for ${joinNames(stillPlaying.map((p) => p.name))}` : 'Nearly there';

  // The host steps in for a phone that's died. Still playing? Check first: they may just be slow.
  const enterFor = (p: Player) => {
    if (holeStatus(game, p.id, h) === 'done') return enterScoreFor(p.id);
    confirm({
      title: `Enter ${p.name}'s score?`,
      body: `Only if ${p.name}'s phone can't. They'll see that you did.`,
      confirm: 'Enter score',
      onConfirm: () => enterScoreFor(p.id),
    });
  };

  // Things that happened on this hole that the status list doesn't show.
  const mulligans = game.players.filter((p) => !mineIds.has(p.id) && getEntry(game, p.id, h)?.mulligan);

  return (
    <>
      <div className="screen-body">
        <div>
          <h1 className="h1">{title}</h1>
          {next?.par && (
            <p className="muted" style={{ margin: '8px 0 0' }}>
              Next: Hole {next.number} · Par {next.par}
            </p>
          )}
        </div>

        {mine.map((p) => {
          const r = holeResult(game, p.id, h);
          if (!r) return null;
          return (
            <div key={p.id} className={`my-result ${r.outcome}`}>
              <span className="my-result-head">
                {mine.length > 1 ? (
                  <span className="row" style={{ gap: 8 }}>
                    <Avatar player={p} size={24} /> {p.name}
                  </span>
                ) : (
                  'Your hole'
                )}
                <button type="button" className="btn-link-small" onClick={() => openSheet({ name: 'edit', playerId: p.id, hole: h })}>
                  Change
                </button>
              </span>
              <span className="my-result-row stamp-in">
                <Working strokes={r.strokes} par={r.par} adjustment={r.adjustment} outcome={r.outcome} tier={r.tier} doubled={r.doubled} />
                <b className="num">{formatToPar(r.toPar)}</b>
              </span>
            </div>
          );
        })}

        <GroupList
          game={game}
          mineIds={mineIds}
          action={(p) => {
            const s = holeStatus(game, p.id, h);
            if (s === 'scored') return null;
            if (mineIds.has(p.id) && mine.length > 1)
              return (
                <button type="button" className="btn btn-sm btn-blue btn-auto" onClick={() => enterScoreFor(p.id)}>
                  Enter score
                </button>
              );
            if (host && !ownsPlayer(game, deviceId, p.id))
              return (
                <button type="button" className="btn-link-small group-act" onClick={() => enterFor(p)}>
                  Enter for them
                </button>
              );
            return null;
          }}
        />

        {mulligans.length > 0 && <p className="room-note rise">{mulligans.map((p) => p.name).join(' and ')} took a mulligan 🔁</p>}
      </div>
      {myNext && (
        <div className="screen-foot">
          <button type="button" className="btn btn-xl btn-blue" onClick={() => enterScoreFor(myNext.id)}>
            {mine.length > 1 ? `Enter ${myNext.name}'s score` : 'Enter my score'}
          </button>
          {holeStatus(game, myNext.id, h) === 'done' && mine.every((p) => holeResult(game, p.id, h) == null) && (
            <button type="button" className="btn btn-link" onClick={notDoneYet}>
              Not done yet
            </button>
          )}
        </div>
      )}
    </>
  );
}
