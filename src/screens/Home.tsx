import { useState } from 'react';
import { loadHistory, type GameRecord } from '../state/persist';
import { appHome } from '../state/platform';
import { navigate, openSheet, startNewGame, useApp } from '../state/store';
import { Avatar } from '../ui/components';
import { colourWipe } from '../ui/effects';
import { joinNames } from '../ui/format';
import { ArrowIcon, ClockIcon } from '../ui/Icons';
import { Join } from './Join';
import { NEWS } from './sheets/NewsSheet';

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
      <div className="home-head">
        <h1>CardShot</h1>
        <button type="button" className="icon-btn press" aria-label="Past games" onClick={() => navigate({ name: 'history' })}>
          <ClockIcon width={24} height={24} />
        </button>
      </div>
      <div className="screen-body home-body">
        <section className="home-news" aria-label="News">
          <p className="section-title">News</p>
          <button type="button" className="news-card press" onClick={() => openSheet({ name: 'news' })}>
            <span className="news-art" aria-hidden>
              <i className="news-card-safe" />
              <i className="news-card-insane" />
              <i className="news-card-bold" />
            </span>
            <span className="news-text">
              <span className="news-tag">{NEWS.tag}</span>
              <b>{NEWS.title}</b>
              <small>{NEWS.text}</small>
            </span>
          </button>
        </section>
        <div className="home-spacer" />
        {active && (
          <button type="button" className="home-row press" onClick={() => navigate({ name: 'game' })}>
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
      <div className="screen-foot home-foot">
        <button type="button" className="btn btn-xl btn-dark" onClick={(e) => colourWipe(e, () => startNewGame())}>
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
