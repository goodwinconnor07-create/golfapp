import { useState } from 'react';
import { loadHistory, type GameRecord } from '../state/persist';
import { appHome } from '../state/platform';
import { navigate, startNewGame, useApp } from '../state/store';
import { Avatar, TierChip } from '../ui/components';
import { colourWipe } from '../ui/effects';
import { joinNames } from '../ui/format';
import { ArrowIcon, ClockIcon } from '../ui/Icons';
import { Join } from './Join';

/** The iPhone app opens on the host's Home; the website opens straight on the join screen. */
export function Home() {
  return appHome ? <HostHome /> : <Join home />;
}

/** Everyone else from the newest round with company, for "Play again". */
function lastGroup(records: GameRecord[], me: string): GameRecord['players'] {
  for (const r of records) {
    const others = r.players.filter((p) => p.name !== me);
    if (others.length > 0 && others.length < r.players.length) return others;
  }
  return [];
}

function HostHome() {
  const game = useApp((s) => s.game);
  const online = useApp((s) => s.session?.mode === 'online');
  const joining = useApp((s) => s.session?.mode === 'online' && !s.session.game);
  const me = useApp((s) => s.profileName.trim());
  const active = (game && game.status !== 'finished') || joining;
  const [group] = useState(() => (me ? lastGroup(loadHistory(), me) : []));
  const names = group.map((p) => p.name);

  return (
    <div className="screen home">
      <button type="button" className="icon-btn press home-corner" aria-label="Past games" onClick={() => navigate({ name: 'history' })}>
        <ClockIcon width={24} height={24} />
      </button>
      <div className="screen-body home-body">
        <div className="home-hero">
          <img className="home-icon" src="/icons/icon.svg" alt="" width={104} height={104} />
          <h1 className="logo-word">CARDSHOT</h1>
          <p className="home-tag">Golf, but riskier.</p>
          <div className="tier-row">
            <TierChip tier="safe" />
            <TierChip tier="bold" />
            <TierChip tier="insane" />
          </div>
        </div>
        {active && (
          <button type="button" className="home-row home-live press" onClick={() => navigate({ name: 'game' })}>
            <ArrowIcon width={22} height={22} />
            <span className="home-row-text">
              <b>Back to your game</b>
              <small>
                {game
                  ? `${game.status === 'lobby' ? 'Lobby' : `Hole ${game.holes[game.current].number}`}${online && game.code ? ` · ${game.code}` : ''}`
                  : 'Joining…'}
              </small>
            </span>
          </button>
        )}
        {!active && group.length > 0 && (
          <button type="button" className="home-row press" onClick={(e) => colourWipe(e, () => startNewGame(names))}>
            <span className="home-faces" aria-hidden>
              {group.slice(0, 3).map((p, i) => (
                <Avatar key={i} player={p} size={36} />
              ))}
            </span>
            <span className="home-row-text">
              <b>Play again</b>
              <small>With {joinNames(names.length > 3 ? [...names.slice(0, 2), `${names.length - 2} more`] : names)}</small>
            </span>
          </button>
        )}
      </div>
      <div className="screen-foot clear home-foot">
        <button type="button" className="btn btn-xl btn-brand" onClick={(e) => colourWipe(e, () => startNewGame())}>
          New game
        </button>
        <div className="home-links">
          <button type="button" className="btn btn-link" onClick={() => navigate({ name: 'join' })}>
            Join a game
          </button>
          <button type="button" className="btn btn-link" onClick={() => navigate({ name: 'howto' })}>
            How to play
          </button>
        </div>
      </div>
    </div>
  );
}
