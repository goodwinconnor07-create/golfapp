import { DurableObject } from 'cloudflare:workers';
import {
  applyAction,
  canAddPlayers,
  cryptoRng,
  isDeviceId,
  isPushToken,
  LIMITS,
  notesFor,
  parseAction,
  PING,
  PONG,
  redactForDevice,
  type Game,
  type GameInfo,
  type ServerMessage,
} from '../src/game';
import { sendPush, type ApnsEnv } from './apns';

/** Games are deleted this long after the last change. */
const KEEP_FOR_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_MESSAGE_CHARS = 8 * 1024;
/** Per connection: at most this many actions in each window. */
const RATE_LIMIT = { count: 40, windowMs: 10_000 };

interface SocketMeta {
  deviceId: string;
}

/**
 * One online game, addressed by its join code. Holds the only true copy of the
 * game, applies actions with the same reducer the app uses, and sends each phone
 * the view it's allowed to see. Uses WebSocket hibernation, so an idle round costs nothing.
 */
export class GameRoom extends DurableObject<Env> {
  private game: Game | null | undefined;
  /** Push notification tokens by device id (iPhone app only). Deleted with the game. */
  private push: Record<string, string> | undefined;
  private rate = new WeakMap<WebSocket, { start: number; count: number }>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Heartbeats are answered by the runtime without waking the object.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  /** RPC: store a brand-new game. Returns false if this code is already in use. */
  async create(game: Game): Promise<boolean> {
    if (await this.load()) return false;
    await this.save(game);
    return true;
  }

  /** RPC: public details for the join screen, or null if there's no game here. */
  async info(): Promise<GameInfo | null> {
    const game = await this.load();
    if (!game) return null;
    const host = game.players.find((p) => p.deviceId === game.hostDeviceId);
    return {
      code: game.code ?? '',
      status: game.status,
      course: game.course,
      holes: game.holes.length,
      current: game.current,
      hostName: host?.name ?? '',
      players: game.players.map((p) => ({ id: p.id, name: p.name, color: p.color, emoji: p.emoji, claimed: p.deviceId !== null })),
      canJoinAsNew: canAddPlayers(game) && game.players.length < LIMITS.maxPlayers,
    };
  }

  /** WebSocket upgrade, forwarded by the Worker from /api/games/:code/ws?device=… */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const deviceId = new URL(request.url).searchParams.get('device');
    if (!isDeviceId(deviceId)) return new Response('Missing device id', { status: 400 });
    const game = await this.load();
    if (!game) return new Response('Game not found', { status: 404 });

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [deviceId]);
    server.serializeAttachment({ deviceId } satisfies SocketMeta);
    this.send(server, { t: 'state', game: redactForDevice(game, deviceId) });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_CHARS) return;
    let msg: unknown;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (typeof msg !== 'object' || msg === null) return;
    const { t, id: rawId, a } = msg as { t?: unknown; id?: unknown; a?: unknown };
    const { deviceId } = ws.deserializeAttachment() as SocketMeta;

    if (t === 'ping') return this.send(ws, { t: 'pong' });

    const game = await this.load();
    if (!game) {
      ws.close(4404, 'Game not found');
      return;
    }
    if (t === 'sync') return this.send(ws, { t: 'state', game: redactForDevice(game, deviceId) });
    if (t === 'push') return this.setPushToken(game, deviceId, (msg as { token?: unknown }).token);
    if (t !== 'act') return;

    const id = typeof rawId === 'string' && rawId.length <= 40 ? rawId : undefined;
    if (this.overLimit(ws)) return this.send(ws, { t: 'reject', id, error: 'Easy there. Try again in a moment.' });

    const action = parseAction(a);
    if (!action) return this.send(ws, { t: 'reject', id, error: "The server didn't understand that." });

    const result = applyAction(game, action, { deviceId, now: Date.now(), rng: cryptoRng });
    if (!result.ok) return this.send(ws, { t: 'reject', id, error: result.error });
    if (!result.changed) return this.send(ws, { t: 'state', game: redactForDevice(game, deviceId), ack: id });

    await this.save(result.game);
    for (const socket of this.ctx.getWebSockets()) {
      const meta = socket.deserializeAttachment() as SocketMeta | null;
      if (!meta) continue;
      this.send(socket, {
        t: 'state',
        game: redactForDevice(result.game, meta.deviceId),
        ack: socket === ws ? id : undefined,
      });
    }
    // Buzz the other phones for the moments that matter (round started, results in, a vote…).
    const notes = notesFor(game, result.game, action, deviceId);
    if (notes.length) this.ctx.waitUntil(this.notify(notes));
  }

  /** Remembers (or forgets) this phone's push token. Only phones in the game can register. */
  private async setPushToken(game: Game, deviceId: string, token: unknown): Promise<void> {
    const inGame = deviceId === game.hostDeviceId || game.players.some((p) => p.deviceId === deviceId);
    if (!inGame || !(token === null || isPushToken(token))) return;
    const push = await this.loadPush();
    if (token === null) delete push[deviceId];
    else if (push[deviceId] === token) return;
    else push[deviceId] = token;
    await this.ctx.storage.put('push', push);
  }

  private async notify(notes: ReturnType<typeof notesFor>): Promise<void> {
    const push = await this.loadPush();
    let changed = false;
    for (const note of notes) {
      const tokens = note.devices.map((d) => push[d]).filter((t): t is string => Boolean(t));
      const results = await sendPush(this.env as Env & ApnsEnv, tokens, { title: note.title, body: note.body });
      for (const r of results) {
        if (!r.gone) continue;
        for (const [d, t] of Object.entries(push)) if (t === r.token) delete push[d];
        changed = true;
      }
    }
    if (changed) await this.ctx.storage.put('push', push);
  }

  private async loadPush(): Promise<Record<string, string>> {
    this.push ??= (await this.ctx.storage.get<Record<string, string>>('push')) ?? {};
    return this.push;
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason);
    } catch {
      // Already closed.
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close(1011, 'Error');
    } catch {
      // Already closed.
    }
  }

  /** Clean-up: the game hasn't changed for KEEP_FOR_MS, so forget it. */
  async alarm(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(4410, 'Game expired');
      } catch {
        // Already closed.
      }
    }
    await this.ctx.storage.deleteAll();
    this.game = null;
    this.push = undefined;
  }

  private async load(): Promise<Game | null> {
    if (this.game === undefined) this.game = (await this.ctx.storage.get<Game>('game')) ?? null;
    return this.game;
  }

  private async save(game: Game): Promise<void> {
    this.game = game;
    await this.ctx.storage.put('game', game);
    await this.ctx.storage.setAlarm(Date.now() + KEEP_FOR_MS);
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // The socket closed while we were working. It will resync when it reconnects.
    }
  }

  private overLimit(ws: WebSocket): boolean {
    const now = Date.now();
    const r = this.rate.get(ws);
    if (!r || now - r.start > RATE_LIMIT.windowMs) {
      this.rate.set(ws, { start: now, count: 1 });
      return false;
    }
    r.count += 1;
    return r.count > RATE_LIMIT.count;
  }
}
