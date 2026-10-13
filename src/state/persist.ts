// Everything the app keeps on the phone between visits.

import { isDeviceId, newId, type Action, type Game } from '../game';

const KEYS = {
  device: 'sendit.device',
  name: 'sendit.name',
  session: 'sendit.session',
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

export function loadSession(): Session | null {
  const s = read<Session>(KEYS.session);
  if (!s || (s.mode !== 'local' && s.mode !== 'online')) return null;
  if (s.mode === 'local' && !s.game) return null;
  return { mode: s.mode, code: s.code ?? null, game: s.game ?? null, pending: Array.isArray(s.pending) ? s.pending : [] };
}

export function saveSession(session: Session | null): void {
  write(KEYS.session, session);
}
