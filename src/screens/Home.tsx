import { useState, type CSSProperties } from 'react';
import { completedHoles, gapText, getCard, TIER_ORDER, TIERS, type Game, type Tier } from '../game';
import { homeInsights, lastGroup, type Insights, type LastGroup } from '../state/insights';
import { loadHistory } from '../state/persist';
import { appHome } from '../state/platform';
import { navigate, startNewGame, useApp } from '../state/store';
import { Avatar } from '../ui/components';
import { colourWipe } from '../ui/effects';
import { joinNames, plural } from '../ui/format';
import { GameDemo } from '../ui/GameDemo';
import { ClockIcon, UsersIcon } from '../ui/Icons';
import { Join } from './Join';

/** The iPhone app opens on the host's Home; the website opens straight on the join screen. */
export function Home() {
  return appHome ? <HostHome /> : <Join home />;
}

function HostHome() {
  const game = useApp((s) => s.game);
  const joining = useApp((s) => s.session?.mode === 'online' && !s.session.game);
  const active = (game && game.status !== 'finished') || joining;
  // Saved rounds only change when a round ends, which happens away from Home.
  const [records] = useState(loadHistory);

  // Until a first round is finished, Home shows how the game works.
  if (records.length === 0 && !active) return <FirstHome />;

  const insights = homeInsights(records);
  const group = lastGroup(records);

  return (
    <div className="screen home">
      <span className="home-sky" aria-hidden />
      <HomeHeader />
      <div className="screen-body home-body">
        {active && <LiveCard game={game} />}
        {insights ? (
          <HowYouPlay insights={insights} />
        ) : (
          <p className="home-empty">Finish a round you host to see how you play here.</p>
        )}
        {group && <PlayAgain group={group} />}
      </div>
      <div className="screen-foot home-foot">
        <button type="button" className="btn btn-xl btn-pine" onClick={(e) => colourWipe(e, () => startNewGame())}>
          New game
        </button>
        <button type="button" className="btn btn-link home-join" onClick={() => navigate({ name: 'join' })}>
          Join a friend's game
        </button>
      </div>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
}

function HomeHeader() {
  const name = useApp((s) => s.profileName.trim());
  return (
    <div className="home-head">
      <img className="home-icon" src="/icons/icon.svg" alt="" width={52} height={52} />
      <div className="home-title">
        <span>{name ? `${greeting()}, ${name}` : greeting()}</span>
        <h1>CardShot</h1>
      </div>
      <button type="button" className="home-round-btn press" aria-label="Past games" onClick={() => navigate({ name: 'history' })}>
        <ClockIcon width={24} height={24} />
      </button>
    </div>
  );
}

/** The round in progress, or the one being joined. Tapping it goes back in. */
function LiveCard({ game }: { game: Game | null }) {
  const deviceId = useApp((s) => s.deviceId);
  const online = useApp((s) => s.session?.mode === 'online');
  if (!game) {
    return (
      <button type="button" className="live-card press" onClick={() => navigate({ name: 'game' })}>
        <span className="live-label">Joining…</span>
      </button>
    );
  }
  const lobby = game.status === 'lobby';
  const played = completedHoles(game).length;
  const me = game.players.find((p) => p.deviceId === deviceId);
  const line = lobby
    ? `${plural(game.players.length, 'player')} in`
    : ((me && gapText(game, me.id)) ?? (played === 0 ? 'First hole' : `${plural(played, 'hole')} played`));
  const progress = lobby ? 0 : played / game.holes.length;
  // Hole 13 on the back nine is the 4th of 9.
  const number = game.holes[game.current].number;
  const nth = game.current + 1;
  const holeText = number === nth ? `Hole ${number} of ${game.holes.length}` : `Hole ${number} · ${nth} of ${game.holes.length}`;
  return (
    <button type="button" className="live-card press" onClick={() => navigate({ name: 'game' })}>
      <span className="live-top">
        <span className="live-label">
          <i aria-hidden />
          {lobby ? 'Lobby' : 'Game on'}
          {online && game.code ? ` · ${game.code}` : ''}
        </span>
        <span className="live-resume">Resume ›</span>
      </span>
      <span className="live-main">
        <span className="live-ring" style={{ '--p': progress } as CSSProperties} aria-hidden>
          <b>{lobby ? <UsersIcon width={24} height={24} /> : number}</b>
        </span>
        <span className="live-text">
          <b>{lobby ? 'Waiting to start' : holeText}</b>
          <small>{line}</small>
        </span>
        <span className="live-faces" aria-hidden>
          {game.players.slice(0, 4).map((p) => (
            <Avatar key={p.id} player={p} size={30} />
          ))}
        </span>
      </span>
    </button>
  );
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

function HowYouPlay({ insights: i }: { insights: Insights }) {
  const total = TIER_ORDER.reduce((n, t) => n + i.picks[t], 0);
  const [insaneDrawn, insaneMade] = i.cards.insane;
  const allDrawn = TIER_ORDER.reduce((n, t) => n + i.cards[t][0], 0);
  const allMade = TIER_ORDER.reduce((n, t) => n + i.cards[t][1], 0);
  const best = i.best && getCard(i.best.cardId);
  return (
    <section className="home-section" aria-labelledby="how-you-play">
      <div className="home-section-head">
        <h2 id="how-you-play">How you play</h2>
        <span>{plural(i.rounds, 'round')}</span>
      </div>
      {total > 0 && (
        <div className="home-tile home-mix">
          <div className="home-mix-head">
            <b>{i.mostly ? `Mostly ${TIERS[i.mostly].label}` : 'A bit of everything'}</b>
            <small>your picks</small>
          </div>
          <div className="home-mix-bar" aria-hidden>
            {TIER_ORDER.filter((t) => i.picks[t] > 0).map((t) => (
              <i key={t} className={`home-mix-${t}`} style={{ flexGrow: i.picks[t] }} />
            ))}
          </div>
          <div className="home-mix-key">
            {TIER_ORDER.map((t: Tier) => (
              <span key={t} className={`home-ink-${t}`}>
                {TIERS[t].label} {pct(i.picks[t], total)}%
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="home-tiles">
        {insaneDrawn > 0 ? (
          <div className="home-tile">
            <b className="home-ink-insane">
              {insaneMade} of {insaneDrawn}
            </b>
            <small>Insane cards made</small>
          </div>
        ) : (
          <div className="home-tile">
            <b>
              {allMade} of {allDrawn}
            </b>
            <small>Cards made</small>
          </div>
        )}
        {best && i.best ? (
          <div className="home-tile">
            <b className="home-tile-card">{best.title}</b>
            <small>
              Your best card · {i.best.made} of {i.best.drawn}
            </small>
          </div>
        ) : (
          <div className="home-tile">
            <b>{i.wins}</b>
            <small>{i.wins === 1 ? 'Win' : 'Wins'}</small>
          </div>
        )}
      </div>
    </section>
  );
}

const dayText = (ms: number) => {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 7) return new Date(ms).toLocaleDateString(undefined, { weekday: 'long' });
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** Last round's group, already on the list for a new game. */
function PlayAgain({ group }: { group: LastGroup }) {
  const names = group.players.map((p) => p.name);
  return (
    <button type="button" className="home-tile play-again press" onClick={(e) => colourWipe(e, () => startNewGame(names))}>
      <span className="play-again-faces" aria-hidden>
        {group.players.slice(0, 3).map((p, i) => (
          <Avatar key={i} player={p} size={36} />
        ))}
      </span>
      <span className="play-again-text">
        <b>Play again with {joinNames(names.length > 3 ? [...names.slice(0, 2), `${names.length - 2} more`] : names)}</b>
        <small>
          {group.course ? `${group.course} · ` : ''}
          {dayText(group.finishedAt)}
        </small>
      </span>
      <span className="play-again-go" aria-hidden>
        ›
      </span>
    </button>
  );
}

/** Before a first round: the logo, the game playing itself, and a way in. */
function FirstHome() {
  return (
    <div className="screen first-home">
      <div className="screen-body first-home-body">
        <div className="first-home-logo">
          <img className="home-icon" src="/icons/icon.svg" alt="" width={56} height={56} />
          <h1 className="logo-word brand-text">CARDSHOT</h1>
        </div>
        <GameDemo />
        <p className="first-home-tag">Golf, but riskier.</p>
      </div>
      <div className="screen-foot clear first-home-foot">
        <button type="button" className="btn btn-xl btn-pine" onClick={(e) => colourWipe(e, () => startNewGame())}>
          Start your first game
        </button>
        <div className="first-home-links">
          <button type="button" className="btn btn-link" onClick={() => navigate({ name: 'howto' })}>
            How to play
          </button>
          <button type="button" className="btn btn-link quiet" onClick={() => navigate({ name: 'join' })}>
            Join with a code
          </button>
        </div>
      </div>
    </div>
  );
}
