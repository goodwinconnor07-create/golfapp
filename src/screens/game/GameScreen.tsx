import { getEntry, ordinal, ownsPlayer, standings, type Game } from '../../game';
import type { ConnStatus } from '../../state/connection';
import { cancelScoreFor, groupRevealSeen, notDoneYet, openSheet, resultsDone, shownHoles, useApp } from '../../state/store';
import { gameView, isHost, myPlayers, type GameView } from '../../state/view';
import { BackBar, SkeletonGame } from '../../ui/components';
import { BackIcon, BellIcon, GearIcon, MenuIcon, TrophyIcon } from '../../ui/Icons';
import { Final } from './Final';
import { GroupReveal } from './GroupReveal';
import { HoleResults } from './HoleResults';
import { Lobby } from './Lobby';
import { ParPick } from './ParPick';
import { PickTier } from './PickTier';
import { PlayHole } from './PlayHole';
import { Reveal } from './Reveal';
import { ResultsReveal } from './ResultsReveal';
import { ScoreRoom } from './ScoreRoom';
import { useFixCount } from './FixPrompt';
import { VotePrompt } from './VotePrompt';
import { ScoreEntry } from './ScoreEntry';
import { WaitPicks } from './Waiting';

export function GameScreen() {
  const game = useApp((s) => s.game);
  const deviceId = useApp((s) => s.deviceId);
  const online = useApp((s) => s.session?.mode === 'online');
  const ui = useApp((s) => s.ui);
  const conn = useApp((s) => s.conn);
  // Re-render when this phone moves on from a hole's results.
  useApp((s) => s.results);

  if (!game) {
    return (
      <div className="screen">
        <BackBar title="Joining" />
        <div className="screen-body">
          <SkeletonGame label="Joining the game…" />
          {conn === 'offline' && <p className="muted">Waiting for signal…</p>}
        </div>
      </div>
    );
  }

  const view = gameView(game, deviceId, online, ui, groupRevealSeen, resultsDone);
  const mine = myPlayers(game, deviceId, online);
  const helpers = game.players.filter((p) => ui.extraPick.includes(p.id) && !mine.includes(p));
  // The hole on screen: a phone still showing the last hole's results stays on that hole.
  const holeIdx = view.kind === 'resultsReveal' ? view.hole : game.current;
  const key = `${view.kind}-${'playerId' in view ? view.playerId : ''}-${holeIdx}`;
  // Scoring: a back button by the par. The host scoring for someone on another phone cancels;
  // anyone else goes back to playing ("Not done yet") until a score is saved.
  let back: { label: string; run: () => void } | undefined;
  if (view.kind === 'score') {
    if (game.code && !ownsPlayer(game, deviceId, view.playerId)) back = { label: 'Cancel', run: cancelScoreFor };
    else if (getEntry(game, view.playerId, game.current)?.strokes == null) back = { label: 'Not done yet', run: notDoneYet };
  }

  return (
    <div className="screen">
      <GameTopBar game={game} online={online} conn={conn} holeIdx={holeIdx} final={view.kind === 'final'} back={back} />
      {view.kind !== 'groupReveal' && view.kind !== 'reveal' && <VotePrompt game={game} />}
      <Phase key={key} game={game} view={view} pickers={[...mine, ...helpers]} />
    </div>
  );
}

function Phase({ game, view, pickers }: { game: Game; view: GameView; pickers: Game['players'] }) {
  switch (view.kind) {
    case 'lobby':
      return <Lobby game={game} />;
    case 'final':
      return <Final game={game} />;
    case 'par':
      return <ParPick game={game} />;
    case 'pick':
      return <PickTier game={game} playerId={view.playerId} />;
    case 'scoreRoom':
      return <ScoreRoom game={game} />;
    case 'resultsReveal':
      return <ResultsReveal game={game} hole={view.hole} />;
    case 'groupReveal':
      return <GroupReveal game={game} />;
    case 'reveal':
      return <Reveal game={game} playerId={view.playerId} pickers={pickers} />;
    case 'waitPicks':
      return <WaitPicks game={game} />;
    case 'play':
      return <PlayHole game={game} />;
    case 'score':
      return <ScoreEntry game={game} playerId={view.playerId} />;
    case 'results':
      return <HoleResults game={game} />;
  }
}

function GameTopBar({
  game,
  online,
  conn,
  holeIdx,
  final,
  back,
}: {
  game: Game;
  online: boolean;
  conn: ConnStatus | 'none';
  holeIdx: number;
  final: boolean;
  back?: { label: string; run: () => void };
}) {
  // Changes made with no signal, saved on this phone until they reach the server.
  const waiting = useApp((s) => (s.session?.mode === 'online' ? s.session.pending.length : 0));
  const hole = game.holes[holeIdx];
  const asks = useFixCount(game);
  const host = isHost(
    game,
    useApp((s) => s.deviceId),
  );
  return (
    <div className="topbar">
      <div className="topbar-title">
        {game.status === 'lobby' && <span className="h2">Lobby</span>}
        {final && <span className="h2">Final results</span>}
        {game.status !== 'lobby' && !final && (
          <div className="hole-tag">
            <b>Hole {hole.number}</b>
          </div>
        )}
      </div>
      {back && (
        <button type="button" className="icon-btn press" aria-label={back.label} onClick={back.run}>
          <BackIcon />
        </button>
      )}
      {game.status !== 'lobby' && !final && hole.par && (
        <div className="par-tile" role="img" aria-label={`Par ${hole.par}`}>
          <small>PAR</small>
          <b>{hole.par}</b>
        </div>
      )}
      {/* While scoring, the back button takes the trophy's place so the hole number keeps its room. */}
      {game.status === 'playing' && !back && <RankPill game={game} online={online} />}
      {game.status === 'lobby' && host && (
        <button type="button" className="icon-btn press" aria-label="Game options" onClick={() => openSheet({ name: 'options' })}>
          <GearIcon />
        </button>
      )}
      {online && game.status !== 'lobby' && (
        <button
          type="button"
          className="icon-btn press bell-btn"
          aria-label={asks ? `Notifications, ${asks} new` : 'Notifications'}
          onClick={() => openSheet({ name: 'notifications' })}
        >
          <BellIcon />
          {asks > 0 && (
            <span key={asks} className="badge pop" aria-hidden>
              {asks > 9 ? '9+' : asks}
            </span>
          )}
        </button>
      )}
      <button type="button" className="icon-btn press" aria-label="Menu" onClick={() => openSheet({ name: 'menu' })}>
        <MenuIcon />
      </button>
      {game.status === 'playing' && (
        // How far through the round: a thin line that fills hole by hole, with the count.
        <div
          className="hole-progress"
          role="progressbar"
          aria-label="Round progress"
          aria-valuemin={1}
          aria-valuemax={game.holes.length}
          aria-valuenow={game.current + 1}
        >
          <span className="hole-progress-track">
            <i style={{ width: `${((game.current + 1) / game.holes.length) * 100}%` }} />
          </span>
          <span className="hole-progress-count num">
            {game.current + 1}/{game.holes.length}
          </span>
        </div>
      )}
      {online && conn !== 'open' && (
        // Its own line under the header, so it never squashes the hole and par.
        <span className="conn-pill" role="status">
          <i />
          {conn === 'connecting' ? 'Connecting…' : 'No signal · keep playing'}
          {waiting > 0 && <b className="num"> · {waiting} to send</b>}
        </span>
      )}
    </div>
  );
}

/**
 * Your place, always on screen: "2nd" under a trophy (gold when you lead). Opens the standings.
 * It only moves once this phone has seen the hole's results. With everyone on one phone there's
 * no "you", so it's just the trophy.
 */
function RankPill({ game, online }: { game: Game; online: boolean }) {
  const deviceId = useApp((s) => s.deviceId);
  const holes = shownHoles(game);
  const mine = online ? myPlayers(game, deviceId, true) : game.players.length === 1 ? game.players : [];
  const row = mine.length === 1 && holes.length > 0 ? standings(game, 'game', holes).find((r) => r.player.id === mine[0].id) : undefined;
  const place = row ? `${row.tied ? '=' : ''}${ordinal(row.rank)}` : null;
  return (
    <button
      type="button"
      className={`icon-btn press rank-pill${row?.rank === 1 && game.players.length > 1 ? ' lead' : ''}`}
      aria-label={place ? `Standings, you're ${place}` : 'Standings'}
      onClick={() => openSheet({ name: 'standings' })}
    >
      <TrophyIcon width={place ? 20 : 26} height={place ? 20 : 26} />
      {place && (
        <b key={place} className="pop">
          {place}
        </b>
      )}
    </button>
  );
}
