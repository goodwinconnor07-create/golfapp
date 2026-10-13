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

/** A course in search results. Ids carry their source, e.g. "og:…" (OpenGolfAPI) or "gc:…" (GolfCourseAPI). */
export interface CourseSummary {
  id: string;
  name: string;
  /** Town, region or country, whatever the source knows. */
  place: string;
  /** Total par if known. */
  par: number | null;
}

/** A course with its hole-by-hole pars (empty when the source doesn't have them). */
export interface CourseDetail extends CourseSummary {
  /** pars[0] is hole 1. */
  pars: (3 | 4 | 5)[];
  /** Credit line the data's licence asks for. */
  attribution: string;
}
