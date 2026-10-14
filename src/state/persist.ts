// Everything the app keeps on the phone between visits.

import { isAvatarEmoji, isDeviceId, newId, PLAYER_COLORS, type Action, type Game } from '../game';

const KEYS = {
  device: 'sendit.device',
  name: 'sendit.name',
  look: 'sendit.look',
  session: 'sendit.session',
  history: 'sendit.history',
} as const;

export interface PendingAction {
  id: string;
  action: Action;
}

export interface Session {
  /** local = this phone only. online = the server holds the game. */
  mode: 'local' | 'online';
  code: string | null;
  /** Local: the game itself. Online: the last state the server sent (null until it arrives). */
  game: Game | null;
  /** Online actions the server hasn't confirmed yet. */
  pending: PendingAction[];
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is full or blocked (some private modes). The app still works for this visit.
  }
}

/** A random id for this phone, created on first use. Online games use it to know who's who. */
export function loadDeviceId(): string {
  const saved = read<string>(KEYS.device);
  if (isDeviceId(saved)) return saved;
  const id = `d${newId(20)}`;
  write(KEYS.device, id);
  return id;
}

export function loadName(): string {
  const name = read<string>(KEYS.name);
  return typeof name === 'string' ? name : '';
}

export function saveName(name: string): void {
  write(KEYS.name, name);
}

/** The picture this phone's player last picked: an emoji (or null for their letter) and a colour. */
export interface Look {
  emoji: string | null;
  color: number;
}

export function loadLook(): Look {
  const l = read<Look>(KEYS.look);
  return {
    emoji: isAvatarEmoji(l?.emoji) ? l.emoji : null,
    color: typeof l?.color === 'number' && Number.isInteger(l.color) && l.color >= 0 && l.color < PLAYER_COLORS ? l.color : 0,
  };
}

export function saveLook(look: Look): void {
  write(KEYS.look, look);
}

export function loadSession(): Session | null {
  const s = read<Session>(KEYS.session);
  if (!s || (s.mode !== 'local' && s.mode !== 'online')) return null;
  if (s.mode === 'local' && !s.game) return null;
  return { mode: s.mode, code: s.code ?? null, game: s.game ?? null, pending: Array.isArray(s.pending) ? s.pending : [] };
}

export function saveSession(session: Session | null): void {
  write(KEYS.session, session);
}

/** A finished round, kept small so many fit in storage. */
export interface GameRecord {
  /** The game's id, so a round re-saved after a score fix replaces itself. */
  id: string;
  finishedAt: number;
  course: string;
  holes: number;
  /** In finishing order. */
  players: { name: string; color: number; rank: number; toPar: number; strokes: number }[];
}

const MAX_RECORDS = 50;

export function loadHistory(): GameRecord[] {
  const list = read<GameRecord[]>(KEYS.history);
  return Array.isArray(list) ? list.filter((r) => r && typeof r.id === 'string' && Array.isArray(r.players)) : [];
}

/** Adds or updates a round, newest first. */
export function saveRecord(record: GameRecord): GameRecord[] {
  const list = [record, ...loadHistory().filter((r) => r.id !== record.id)].slice(0, MAX_RECORDS);
  write(KEYS.history, list);
  return list;
}

export function clearHistory(): void {
  write(KEYS.history, null);
}
