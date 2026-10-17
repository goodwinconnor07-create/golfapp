import { useEffect, useState } from 'react';
import { APP_STORE_URL, canHost } from '../state/platform';
import { navigate, startNewGame, useApp } from '../state/store';
import { Blobs, TierChip } from '../ui/components';
import { colourWipe } from '../ui/effects';
import { ArrowIcon, ClockIcon } from '../ui/Icons';

/** The intro plays once per visit, not every time you come back Home. */
let introPlayed = false;

export function Home() {
  const [intro] = useState(() => !introPlayed);
  useEffect(() => {
    introPlayed = true;
  }, []);
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
        <div className={`home-hero center${active ? ' with-strip' : ''}${intro ? ' intro' : ''}`}>
          <img className="home-icon" src="/icons/icon.svg" alt="" width={112} height={112} />
          <h1 className="hero brand-text logo-word">CARDSHOT</h1>
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
        {canHost ? (
          <>
            <button type="button" className="btn btn-xl btn-brand" onClick={(e) => colourWipe(e, startNewGame)}>
              New game
            </button>
            <button type="button" className="btn btn-xl btn-red" onClick={(e) => colourWipe(e, () => navigate({ name: 'join' }))}>
              Join a game
            </button>
          </>
        ) : (
          // The host pays for the iPhone app; joining stays free here on the website.
          <>
            <button type="button" className="btn btn-xl btn-brand" onClick={(e) => colourWipe(e, () => navigate({ name: 'join' }))}>
              Join a game
            </button>
            <a className="btn btn-xl btn-red" href={APP_STORE_URL}>
              Host · get the app
            </a>
          </>
        )}
        <button type="button" className="btn btn-link" onClick={() => navigate({ name: 'howto' })}>
          How to play
        </button>
      </div>
    </div>
  );
}
