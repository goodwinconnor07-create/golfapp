import { navigate, startNewGame, useApp } from '../state/store';
import { Blobs, TierChip } from '../ui/components';
import { ArrowIcon, BallIcon, ClockIcon, TrophyIcon } from '../ui/Icons';

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
      <div className="screen-body">
        <div className="home-hero center">
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

        {active && (
          <button type="button" className="resume press" onClick={() => navigate({ name: 'game' })}>
            <span className="resume-badge">
              <ArrowIcon />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="h3" style={{ display: 'block' }}>
                Back to your game
              </span>
              <span className="muted small" style={{ display: 'block' }}>
                {game
                  ? `${game.status === 'lobby' ? 'In the lobby' : `Hole ${game.holes[game.current].number}`} · ${game.players.length} player${game.players.length === 1 ? '' : 's'}${online ? ` · ${game.code}` : ''}`
                  : 'Joining…'}
              </span>
            </span>
          </button>
        )}
        {game?.status === 'finished' && (
          <button type="button" className="resume press" onClick={() => navigate({ name: 'game' })}>
            <span className="resume-badge" style={{ background: 'linear-gradient(150deg,#fbbf24,#f59e0b)' }}>
              <TrophyIcon />
            </span>
            <span style={{ flex: 1 }}>
              <span className="h3" style={{ display: 'block' }}>
                Last round's results
              </span>
              <span className="muted small">{game.players.map((p) => p.name).join(', ')}</span>
            </span>
          </button>
        )}
      </div>

      <div className="screen-foot clear">
        <button type="button" className="btn btn-xl btn-green" onClick={startNewGame}>
          New game
        </button>
        <button type="button" className="btn btn-xl btn-blue" onClick={() => navigate({ name: 'join' })}>
          Join a game
        </button>
        <button type="button" className="btn btn-link" onClick={() => navigate({ name: 'howto' })}>
          How to play
        </button>
      </div>
    </div>
  );
}
