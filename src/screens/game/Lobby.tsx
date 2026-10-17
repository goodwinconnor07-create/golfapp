import { LIMITS, type Game } from '../../game';
import { confirm, dispatch, goOnline, navigate, openSheet, useApp } from '../../state/store';
import { isHost } from '../../state/view';
import { Avatar, SkeletonInvite, TierIcon } from '../../ui/components';
import { colourWipe } from '../../ui/effects';
import { CopyIcon, QrIcon, ShareIcon } from '../../ui/Icons';
import { joinLink, joinLinkLabel, SHORT_HOST } from '../../state/platform';
import { CodeTiles, copy, shareInvite } from '../sheets/InviteSheet';
import { TeamPicker } from './TeamPicker';

export function Lobby({ game }: { game: Game }) {
  const deviceId = useApp((s) => s.deviceId);
  const online = useApp((s) => s.session?.mode === 'online');
  const host = isHost(game, deviceId);
  const hostName = game.players.find((p) => p.deviceId === game.hostDeviceId)?.name ?? 'the host';
  const busy = useApp((s) => s.busy);
  const server = useApp((s) => s.server);
  const alone = game.players.length === 1;
  const canTeam = game.players.length === 4;
  const setTeams = (on: boolean) => {
    const [a, b, c, d] = game.players;
    dispatch({ type: 'setTeams', teams: on ? [[a.id, b.id], [c.id, d.id]] : null });
  };

  const start = () => dispatch({ type: 'start' });
  const startClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!alone) return colourWipe(e, start);
    confirm({
      title: 'Start on your own?',
      body: "Nobody's joined yet. Share the code so friends can play on their own phones.",
      confirm: 'Start anyway',
      onConfirm: start,
    });
  };

  return (
    <>
      <div className="screen-body">
        <div>
          <h1 className={host && !alone ? 'h1 h1-sm' : 'h1'}>
            {host ? (alone ? 'Ready to tee off?' : `${game.players.length} players ready`) : "You're in!"}
          </h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {game.holes.length} hole{game.holes.length === 1 ? '' : 's'} · starting on hole {game.holes[0].number}
            {game.course ? ` · ${game.course}` : ''}
          </p>
        </div>

        {/* Invite first: the code is the main thing on the host's lobby, with the list of friends right under it. */}
        {host && (
          <div className="invite-panel">
            {online && game.code ? (
              <>
                <CodeTiles code={game.code} />
                <button
                  type="button"
                  className="link-chip press"
                  aria-label={`Copy link ${joinLinkLabel(game.code)}`}
                  onClick={() => void copy(joinLink(game.code!))}
                >
                  <span className="link-host">{SHORT_HOST}/</span>
                  <b>{game.code}</b>
                  <CopyIcon width={20} height={20} />
                </button>
                <div className="invite-actions">
                  <button type="button" className="btn btn-blue" onClick={() => void shareInvite(game.code!)}>
                    <ShareIcon width={24} height={24} /> Share invite
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost icon-only"
                    aria-label="Show QR code"
                    onClick={() => openSheet({ name: 'invite' })}
                  >
                    <QrIcon width={26} height={26} />
                  </button>
                </div>
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
        {/* Each player's picture pops in when they join, then floats gently. Tap yours (or anyone's, as host) to change it. */}
        {game.teams && <TeamPicker game={game} editable={host} />}
        <div className="roster" hidden={!!game.teams}>
          {!game.teams && game.players.map((p, i) => {
            const you = p.deviceId === deviceId;
            const isHostPlayer = p.deviceId === game.hostDeviceId;
            const inner = (
              <>
                <span className="roster-pic" style={{ animationDelay: `${i * 0.12}s`, ['--float-delay' as string]: `${0.6 + i * 0.4}s` }}>
                  {/* The float (and the shadow and glow) move together, so nothing is left behind. */}
                  <span className={`roster-float${isHostPlayer ? ' is-host' : ''}`}>
                    <Avatar player={p} size={72} />
                    {you && <span className="tag tag-you">You</span>}
                  </span>
                </span>
                <span className="roster-name">{p.name}</span>
              </>
            );
            return host || you ? (
              <button
                key={p.id}
                type="button"
                className="roster-item"
                aria-label={`${p.name}${you ? ', you' : ''}${isHostPlayer ? ', host' : ''}`}
                onClick={() => openSheet({ name: 'player', playerId: p.id })}
              >
                {inner}
              </button>
            ) : (
              <div key={p.id} className="roster-item" aria-label={p.name}>
                {inner}
              </div>
            );
          })}
        </div>
        {host && canTeam && (
          <button
            type="button"
            className={`btn ${game.teams ? 'btn-blue' : 'btn-ghost'}`}
            aria-pressed={!!game.teams}
            onClick={() => setTeams(!game.teams)}
          >
            {game.teams ? '2v2 teams on' : 'Play as 2v2 teams'}
          </button>
        )}
        {host && alone && (
          <div className="waiting-line slim">
            <span className="dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            Waiting for friends to join
          </div>
        )}

        {/* Guests skip How to play to keep joining quick, so the lobby wait teaches the game. The host's lobby stays on inviting. */}
        {!host && (
          <div className="how-steps">
            <p className="section-title">How it works</p>
            <ol>
              <li>
                <span className="how-step-icons" aria-hidden>
                  <TierIcon tier="safe" size={18} />
                  <TierIcon tier="bold" size={18} />
                  <TierIcon tier="insane" size={18} />
                </span>
                Before each hole, pick Safe, Bold or Insane.
              </li>
              <li>Get a card from that level, then play the hole.</li>
              <li>Complete it and strokes come off your score. Fail it and they go on. Lowest score wins.</li>
            </ol>
            <button type="button" className="btn-link-small" onClick={() => navigate({ name: 'howto' })}>
              How to play
            </button>
          </div>
        )}
      </div>

      <div className="screen-foot">
        {host ? (
          <button type="button" className="btn btn-xl btn-green" onClick={startClick}>
            Let's go!
          </button>
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
