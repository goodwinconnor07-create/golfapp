// Core data model. Shared by the app (one-phone games) and the Cloudflare
// Durable Object (online games), so it must not use DOM or Node APIs.

export type Tier = 'safe' | 'bold' | 'insane';
export type Par = 3 | 4 | 5;

/** made = challenge completed, missed = failed, na = situational card whose situation never happened. */
export type Outcome = 'made' | 'missed' | 'na';

export type Status = 'lobby' | 'playing' | 'finished';

export interface Player {
  id: string;
  name: string;
  /** Index into the avatar colour palette. */
  color: number;
  /** Picked avatar emoji (one of AVATAR_EMOJIS). Absent = show the name's first letter. */
  emoji?: string;
  /** Device that controls this player online. null = a guest run from the host's phone. */
  deviceId: string | null;
}

export interface Hole {
  /** The number on the course (e.g. 10 when playing the back nine). */
  number: number;
  /** null until someone sets it (we ask at the tee if it wasn't set up front). */
  par: Par | null;
}

/** One player's record for one hole. Actual strokes are never overwritten by game score. */
export interface Entry {
  tier?: Tier;
  cardId?: string;
  /** Device that drew the card. Online, only that device sees it until everyone has picked. */
  pickedBy?: string;
  /** Real strokes taken on the hole. */
  strokes?: number;
  /** Result tapped by the player. Ignored when the card is judged from strokes alone. */
  outcome?: Outcome;
  /** Set by the server when this pick is hidden from the viewer until everyone has picked. */
  hidden?: boolean;
  /** The player has finished playing the hole (tapped "Hole done"), scored or not. */
  done?: boolean;
  /** Free shot (last place, once a round): failing this card costs nothing. */
  freePass?: boolean;
  /** This card replaced one the player redrew (one redraw per player per round). */
  redrawn?: boolean;
  /** The player used a mulligan on this hole (one per hole). The re-hit isn't in strokes. */
  mulligan?: boolean;
  /** Group vote on an honour-system claim: voter's player id → true if they call it fair. */
  votes?: Record<string, boolean>;
  /** One-tap reactions to this result: reacting player's id → emoji (one of REACTIONS). */
  reactions?: Record<string, string>;
}

export interface Settings {
  /** Cards that need a distance judged by eye or pacing (honour system). */
  distanceCards: boolean;
  /** Cards that only count if a situation happens (e.g. landing in a bunker). */
  situationCards: boolean;
  /** Break game-score ties on real strokes. Off = ties stay ties. */
  tiebreakOnStrokes: boolean;
  /** Mulligans: re-hit a bad shot and don't count it. 2 each for 9 holes or fewer, 4 for longer rounds. */
  mulligans: boolean;
}

export interface Game {
  v: 1;
  id: string;
  /** Online join code, or null for a game that only lives on this phone. */
  code: string | null;
  hostDeviceId: string;
  createdAt: number;
  updatedAt: number;
  course: string;
  status: Status;
  holes: Hole[];
  /** Index into holes of the hole being played. */
  current: number;
  players: Player[];
  /** Keyed by entryKey(playerId, holeIndex). */
  entries: Record<string, Entry>;
  settings: Settings;
  /** Remaining shuffled card ids per tier. Kept on the server for online games. */
  decks?: Partial<Record<Tier, string[]>>;
  /** Bumped on every applied action. */
  seq: number;
  /** Open requests to change a score that's already locked in (online). */
  fixes?: FixRequest[];
  /** Score changes made after a hole was locked in, shown to everyone (online). */
  edits?: ScoreEdit[];
}

/** "Change Sam's hole 3 to 6 strokes": waits for the player (or the host) to approve. */
export interface FixRequest {
  id: string;
  playerId: string;
  hole: number;
  strokes: number;
  outcome?: Outcome;
  /** Device that asked. */
  by: string;
  /** Name shown with the request: the asker's player on that device, or "The host". */
  byName: string;
}

export interface ScoreEdit {
  playerId: string;
  hole: number;
  from: { strokes: number; outcome?: Outcome };
  to: { strokes: number; outcome?: Outcome };
  /** Who changed it: "Host", or "Approved by Sam". */
  how: string;
  at: number;
}

export type Action =
  | { type: 'addPlayer'; id: string; name: string; claim?: boolean; emoji?: string; color?: number }
  | { type: 'setLook'; playerId: string; emoji: string | null; color: number }
  | { type: 'renamePlayer'; playerId: string; name: string }
  | { type: 'removePlayer'; playerId: string }
  | { type: 'claimPlayer'; playerId: string }
  | { type: 'releasePlayer'; playerId: string }
  | { type: 'setPar'; hole: number; par: Par }
  | { type: 'setCourse'; course: string }
  | { type: 'setSettings'; settings: Partial<Settings> }
  | { type: 'start' }
  /** cardId: a card the phone dealt itself while offline. The server keeps it if it fits, or deals another. */
  | { type: 'pick'; playerId: string; hole: number; tier: Tier; cardId?: string; freePass?: boolean }
  /** Swap this hole's card for another from the same tier. Once per player per round. */
  | { type: 'redraw'; playerId: string; hole: number; cardId?: string }
  /** Take (or undo) a mulligan on the hole being played. */
  | { type: 'mulligan'; playerId: string; hole: number; on: boolean }
  /** The player has finished playing the hole and is ready to score it. */
  | { type: 'holeDone'; playerId: string; hole: number }
  /** voterId calls playerId's honour-system claim on this hole fair (or not). */
  | { type: 'vote'; playerId: string; hole: number; voterId: string; fair: boolean }
  /** fromId reacts to playerId's result on this hole with an emoji (null takes it back). */
  | { type: 'react'; playerId: string; hole: number; fromId: string; emoji: string | null }
  | { type: 'swap'; playerId: string; hole: number; cardId?: string }
  | { type: 'score'; playerId: string; hole: number; strokes: number; outcome?: Outcome; mulligan?: boolean }
  /** Ask to change a locked-in score. The player whose score it is approves (the host, if you're asking about your own). */
  | { type: 'requestFix'; id: string; playerId: string; hole: number; strokes: number; outcome?: Outcome }
  /** Approve or turn down a fix request. The asker can withdraw theirs the same way. */
  | { type: 'answerFix'; id: string; accept: boolean }
  | { type: 'nextHole'; from: number }
  | { type: 'finish' };

export interface ActionContext {
  deviceId: string;
  now: number;
  /** Random number in [0, 1). */
  rng: () => number;
  /**
   * Prediction mode: the app applies its own action before the server confirms it.
   * Card draws are left to the server, so a predicted pick has a tier but no card yet.
   */
  predict?: boolean;
}

export const LIMITS = {
  maxPlayers: 8,
  maxHoles: 18,
  maxNameLength: 20,
  maxCourseLength: 40,
  minStrokes: 1,
  /** Casual pick-up: a hole counts no more than 10 strokes (product owner, Oct 2026). */
  maxStrokes: 10,
  /** Saved games from before the 10-stroke max may hold up to 20; they still load. */
  maxSavedStrokes: 20,
} as const;
