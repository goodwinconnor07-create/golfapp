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
  extraScore: string[];
  /** The everyone-at-once tier reveal has been shown for this hole. */
  groupShown: boolean;
}

export function freshUi(game: Game | null): HoleUi {
  return {
    gameId: game?.id ?? '',
    hole: game?.current ?? 0,
    scoring: false,
    reveal: null,
    extraPick: [],
    extraScore: [],
    groupShown: false,
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
  | { kind: 'waitScores' }
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
  if (holeComplete(game, hole)) return { kind: 'results' };
  // Everyone's in: flip all the tiers over at once, before anyone tees off.
  const scoringStarted = game.players.some((p) => getEntry(game, p.id, hole)?.strokes != null);
  if (game.players.length >= 2 && !ui.groupShown && !scoringStarted && !groupSeen(game.id, hole)) return { kind: 'groupReveal' };
  if (!ui.scoring) return { kind: 'play' };

  const scorers = [...mine, ...game.players.filter((p) => ui.extraScore.includes(p.id) && !mine.includes(p))];
  const toScore = scorers.find((p) => !holeResult(game, p.id, hole));
  if (toScore) return { kind: 'score', playerId: toScore.id };
  return { kind: 'waitScores' };
}
