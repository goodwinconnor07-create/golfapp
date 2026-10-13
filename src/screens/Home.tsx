import { navigate, startNewGame, useApp } from '../state/store';
import { Blobs, TierChip } from '../ui/components';
import { colourWipe } from '../ui/effects';
import { ArrowIcon, BallIcon, ClockIcon } from '../ui/Icons';

export function Home() {
  const game = useApp((s) => s.game);
  const online = useApp((s) => s.session?.mode === 'online');
  const joining = useApp((s) => s.session?.mode === 'online' && !s.session.game);
  const active = (game && game.status !== 'finished') || joining;

  return (
    <div className="screen">
      <Blobs />
      <button type="button" className="icon-btn press home-corner" aria-label="Past games" onClick={() => navigate({ name: 'history' })}>
        <ClockIcon width={24} height={24} />
      </button>
      {/* A slim strip at the top, so it never crowds the big buttons at the bottom. */}
      {active && (
        <button type="button" className="resume-strip press" onClick={() => navigate({ name: 'game' })}>
          <ArrowIcon width={20} height={20} />
          <span className="resume-strip-text">
            <b>Back to your game</b>
            <small>
              {game
                ? `${game.status === 'lobby' ? 'Lobby' : `Hole ${game.holes[game.current].number}`}${online ? ` · ${game.code}` : ''}`
                : 'Joining…'}
            </small>
          </span>
        </button>
      )}
      <div className="screen-body">
        <div className={`home-hero center${active ? ' with-strip' : ''}`}>
          <div className="home-icon" aria-hidden>
            <div className="row" style={{ gap: 4 }}>
              <span className="lines">
                <i style={{ width: 26 }} />
                <i style={{ width: 34 }} />
                <i style={{ width: 22 }} />
              </span>
              <BallIcon width={54} height={54} />
            </div>
          </div>
          <h1 className="hero brand-text logo-word">SEND IT</h1>
          <p className="h3 muted" style={{ margin: 0 }}>
            Golf, but riskier.
          </p>
          <div className="tier-row">
            <TierChip tier="safe" />
            <TierChip tier="bold" />
            <TierChip tier="insane" />
          </div>
        </div>
      </div>

      <div className="screen-foot clear">
        <button type="button" className="btn btn-xl btn-green" onClick={(e) => colourWipe(e, startNewGame)}>
          New game
        </button>
        <button type="button" className="btn btn-xl btn-blue" onClick={(e) => colourWipe(e, () => navigate({ name: 'join' }))}>
          Join a game
        </button>
        <button type="button" className="btn btn-link" onClick={() => navigate({ name: 'howto' })}>
          How to play
        </button>
      </div>
    </div>
  );
}
