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
  /** Group vote on an honour-system claim: voter's player id → true if they call it fair. */
  votes?: Record<string, boolean>;
}

export interface Settings {
  /** Cards that need a distance judged by eye or pacing (honour system). */
  distanceCards: boolean;
  /** Cards that only count if a situation happens (e.g. landing in a bunker). */
  situationCards: boolean;
  /** Break game-score ties on real strokes. Off = ties stay ties. */
  tiebreakOnStrokes: boolean;
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
  /** The player has finished playing the hole and is ready to score it. */
  | { type: 'holeDone'; playerId: string; hole: number }
  /** voterId calls playerId's honour-system claim on this hole fair (or not). */
  | { type: 'vote'; playerId: string; hole: number; voterId: string; fair: boolean }
  | { type: 'swap'; playerId: string; hole: number; cardId?: string }
  | { type: 'score'; playerId: string; hole: number; strokes: number; outcome?: Outcome }
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
  maxStrokes: 20,
} as const;
