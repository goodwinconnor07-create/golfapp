import { LIMITS, type Game } from '../../game';
import { confirm, dispatch, goOnline, openSheet, useApp } from '../../state/store';
import { isHost } from '../../state/view';
import { Avatar, SkeletonInvite } from '../../ui/components';
import { colourWipe } from '../../ui/effects';
import { GearIcon, ShareIcon } from '../../ui/Icons';
import { CodeTiles, shareInvite } from '../sheets/InviteSheet';

export function Lobby({ game }: { game: Game }) {
  const deviceId = useApp((s) => s.deviceId);
  const online = useApp((s) => s.session?.mode === 'online');
  const host = isHost(game, deviceId);
  const hostName = game.players.find((p) => p.deviceId === game.hostDeviceId)?.name ?? 'the host';
  const busy = useApp((s) => s.busy);
  const server = useApp((s) => s.server);
  const alone = game.players.length === 1;

  const start = () => dispatch({ type: 'start' });
  const startClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!alone) return colourWipe(e, start);
    confirm({
      title: 'Start on your own?',
      body: 'Nobody has joined yet. Send the code to your group first so everyone picks their own cards.',
      confirm: 'Start anyway',
      onConfirm: start,
    });
  };

  return (
    <>
      <div className="screen-body">
        <div>
          <h1 className="h1">{host ? 'Ready to tee off?' : "You're in!"}</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {game.holes.length} hole{game.holes.length === 1 ? '' : 's'} · starting on hole {game.holes[0].number}
            {game.course ? ` · ${game.course}` : ''}
          </p>
        </div>

        {/* Invite first: the code and a share button are the main thing on the host's lobby. */}
        {host && (
          <div className="invite-panel">
            {online && game.code ? (
              <>
                <p className="label">Friends join with this code</p>
                <CodeTiles code={game.code} />
                <button type="button" className="btn btn-xl btn-blue" onClick={() => void shareInvite(game.code!)}>
                  <ShareIcon width={26} height={26} /> Share invite
                </button>
                <button type="button" className="btn btn-link" onClick={() => openSheet({ name: 'invite' })}>
                  Show QR code
                </button>
              </>
            ) : busy ? (
              <SkeletonInvite label={busy} />
            ) : (
              <>
                <p style={{ margin: 0 }}>
                  {server === 'down'
                    ? "No signal right now. The code will appear as soon as you're back online."
                    : 'No code yet. Check your signal, then get one so friends can join.'}
                </p>
                <button type="button" className="btn btn-xl btn-blue" onClick={() => void goOnline()}>
                  Get invite code
                </button>
              </>
            )}
          </div>
        )}

        {!host && online && game.code && (
          <button type="button" className="code-banner press" onClick={() => openSheet({ name: 'invite' })}>
            <span>Game code</span>
            <span className="code-text">{game.code}</span>
          </button>
        )}

        <div className="section-row">
          <p className="section-title">Who's in · {game.players.length}</p>
          {host && game.players.length < LIMITS.maxPlayers && (
            // Kept small on purpose: everyone on their own phone is the way to play.
            <button type="button" className="btn-link-small" onClick={() => openSheet({ name: 'player', playerId: 'new' })}>
              No phone? Add them here
            </button>
          )}
        </div>
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
            return host || p.deviceId === deviceId ? (
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
          {host && alone && (
            <div className="waiting-line">
              <span className="dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              Waiting for friends to join
            </div>
          )}
        </div>

        {/* Guests get the one-line rules; the host's lobby stays focused on inviting. */}
        {!host && (
          <div className="tile-flat explainer">
            <span style={{ fontSize: 30 }} aria-hidden>
              ⛳
            </span>
            <span>
              <b>Each hole</b>: your strokes ± your challenge, scored over or under par. Lowest total wins.
            </span>
          </div>
        )}
      </div>

      <div className="screen-foot">
        {host ? (
          <>
            <button type="button" className="btn btn-xl btn-green" onClick={startClick}>
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
