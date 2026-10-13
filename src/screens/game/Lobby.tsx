import { LIMITS, type Game } from '../../game';
import { dispatch, openSheet, useApp } from '../../state/store';
import { isHost } from '../../state/view';
import { Avatar } from '../../ui/components';
import { GearIcon, PlusIcon, UsersIcon } from '../../ui/Icons';

export function Lobby({ game }: { game: Game }) {
  const deviceId = useApp((s) => s.deviceId);
  const online = useApp((s) => s.session?.mode === 'online');
  const host = isHost(game, deviceId);
  const hostName = game.players.find((p) => p.deviceId === game.hostDeviceId)?.name ?? 'the host';

  return (
    <>
      <div className="screen-body">
        <div>
          <h1 className="h1">{host ? 'Ready to send it?' : "You're in!"}</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {game.holes.length} hole{game.holes.length === 1 ? '' : 's'} · starting on hole {game.holes[0].number}
            {game.course ? ` · ${game.course}` : ''}
          </p>
        </div>

        {online && game.code && (
          <button type="button" className="code-banner press" onClick={() => openSheet({ name: 'invite' })}>
            <span>Game code</span>
            <span className="code-text">{game.code}</span>
          </button>
        )}

        <div className="stack">
          {game.players.map((p) => {
            const tag =
              p.deviceId === deviceId ? (
                <span className="tag tag-you">You</span>
              ) : p.deviceId ? (
                <span className="tag tag-joined">Joined</span>
              ) : online ? (
                <span className="tag tag-waiting">On host's phone</span>
              ) : null;
            return host ? (
              <button key={p.id} type="button" className="player-row press" onClick={() => openSheet({ name: 'player', playerId: p.id })}>
                <Avatar player={p} size={48} />
                <span className="name">{p.name}</span>
                {tag}
              </button>
            ) : (
              <div key={p.id} className="player-row">
                <Avatar player={p} size={48} />
                <span className="name">{p.name}</span>
                {tag}
              </div>
            );
          })}
          {host && game.players.length < LIMITS.maxPlayers && (
            <button type="button" className="btn btn-outline" onClick={() => openSheet({ name: 'player', playerId: 'new' })}>
              <PlusIcon width={24} height={24} /> Add player
            </button>
          )}
        </div>

        {host && (
          <button type="button" className="btn btn-blue" onClick={() => openSheet({ name: 'invite' })}>
            <UsersIcon width={26} height={26} /> {online ? 'Show invite' : 'Invite friends to join'}
          </button>
        )}

        <div className="tile-flat explainer">
          <span style={{ fontSize: 30 }} aria-hidden>
            ⛳
          </span>
          <span>
            <b>Game score</b> = real strokes, ± your card. Lowest wins. Your real strokes are kept too.
          </span>
        </div>
      </div>

      <div className="screen-foot">
        {host ? (
          <>
            <button type="button" className="btn btn-xl btn-green" onClick={() => dispatch({ type: 'start' })}>
              Let's go!
            </button>
            <button type="button" className="btn btn-link" onClick={() => openSheet({ name: 'options' })}>
              <GearIcon width={22} height={22} /> Game options
            </button>
          </>
        ) : (
          <div className="waiting-line">
            <span className="dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            Waiting for {hostName} to start
          </div>
        )}
      </div>
    </>
  );
}
