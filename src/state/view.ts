// Works out which in-game screen this phone should show, from the game itself.
// Nothing here is stored: the screen always follows the data, so every phone in an
// online game lands in the right place after a reconnect.

import { allPicked, getEntry, hasPicked, holeComplete, holeResult, type Game, type Player } from '../game';

export interface HoleUi {
  gameId: string;
  hole: number;
  /** This phone tapped "Hole done" and is entering scores. */
  scoring: boolean;
  /** Player whose freshly drawn card is on screen. */
  reveal: string | null;
  /** Players this phone has stepped in for this hole ("Pick for Alex"). */
  extraPick: string[];
  /** The everyone-at-once tier reveal has been shown for this hole. */
  groupShown: boolean;
  /** Online: the player whose score this phone is entering from the waiting room. */
  scoreFor: string | null;
}

export function freshUi(game: Game | null): HoleUi {
  return {
    gameId: game?.id ?? '',
    hole: game?.current ?? 0,
    scoring: false,
    reveal: null,
    extraPick: [],
    groupShown: false,
    scoreFor: null,
  };
}

export type GameView =
  | { kind: 'lobby' }
  | { kind: 'final' }
  | { kind: 'par' }
  | { kind: 'pick'; playerId: string }
  | { kind: 'reveal'; playerId: string }
  | { kind: 'waitPicks' }
  | { kind: 'groupReveal' }
  | { kind: 'play' }
  | { kind: 'score'; playerId: string }
  | { kind: 'scoreRoom' }
  | { kind: 'resultsReveal' }
  | { kind: 'results' };

export function isHost(game: Game, deviceId: string): boolean {
  return game.hostDeviceId === deviceId;
}

/** Players this phone looks after: everyone on a one-phone game; online, your own plus (for the host) guests. */
export function myPlayers(game: Game, deviceId: string, online: boolean): Player[] {
  if (!online) return game.players;
  const host = isHost(game, deviceId);
  return game.players.filter((p) => p.deviceId === deviceId || (host && p.deviceId === null));
}

export function gameView(
  game: Game,
  deviceId: string,
  online: boolean,
  ui: HoleUi,
  groupSeen: (gameId: string, hole: number) => boolean = () => false,
): GameView {
  if (game.status === 'lobby') return { kind: 'lobby' };
  if (game.status === 'finished') return { kind: 'final' };

  const hole = game.current;
  if (ui.reveal && getEntry(game, ui.reveal, hole)?.tier) return { kind: 'reveal', playerId: ui.reveal };
  if (game.holes[hole]?.par == null) return { kind: 'par' };

  const mine = myPlayers(game, deviceId, online);
  const pickers = [...mine, ...game.players.filter((p) => ui.extraPick.includes(p.id) && !mine.includes(p))];
  const toPick = pickers.find((p) => !hasPicked(getEntry(game, p.id, hole)));
  if (toPick) return { kind: 'pick', playerId: toPick.id };
  if (!allPicked(game, hole)) return { kind: 'waitPicks' };
  // Online with friends on other phones: everyone waits in a room after "Hole done",
  // then results are revealed together. (With everyone on this phone there's no one to wait for.)
  const room = online && game.players.some((p) => !mine.includes(p));
  if (holeComplete(game, hole)) {
    return room ? { kind: 'resultsReveal' } : { kind: 'results' };
  }
  // Everyone's in: flip all the tiers over at once, before anyone tees off.
  const scoringStarted = game.players.some((p) => getEntry(game, p.id, hole)?.strokes != null);
  if (game.players.length >= 2 && !ui.groupShown && !scoringStarted && !groupSeen(game.id, hole)) return { kind: 'groupReveal' };
  if (room) {
    const mineDone = mine.length > 0 && mine.every((p) => getEntry(game, p.id, hole)?.done);
    if (!ui.scoring && !mineDone) return { kind: 'play' };
    if (ui.scoreFor && !holeResult(game, ui.scoreFor, hole)) return { kind: 'score', playerId: ui.scoreFor };
    return { kind: 'scoreRoom' };
  }
  if (!ui.scoring) return { kind: 'play' };

  // Everyone is on this phone here, so once all are scored the hole is complete (handled above).
  const toScore = mine.find((p) => !holeResult(game, p.id, hole));
  return toScore ? { kind: 'score', playerId: toScore.id } : { kind: 'results' };
}
