// Messages between the app and the online game server (a Cloudflare Durable Object).

import type { Action, Game, Status } from './types';

/** What the join screen needs to know about an online game. */
export interface GameInfo {
  code: string;
  status: Status;
  course: string;
  holes: number;
  current: number;
  hostName: string;
  players: { id: string; name: string; color: number; claimed: boolean }[];
  /** Whether someone new can still add themselves. */
  canJoinAsNew: boolean;
}

export type ClientMessage =
  /** An action to apply. `id` comes back as `ack` so the app knows it landed. */
  | { t: 'act'; id: string; a: Action }
  /** Ask for the latest state. */
  | { t: 'sync' }
  | { t: 'ping' };

export type ServerMessage = { t: 'state'; game: Game; ack?: string } | { t: 'reject'; id?: string; error: string } | { t: 'pong' };

/** Heartbeats are fixed strings so the server can answer without waking up. */
export const PING = '{"t":"ping"}';
export const PONG = '{"t":"pong"}';

export interface CreateGameResponse {
  code: string;
}
