import { cryptoRng, isCode, isDeviceId, newCode, sanitizeUpload, type CreateGameResponse } from '../src/game';

import { handleCourses } from './courses';

export { GameRoom } from './room';
export { CourseStore } from './courseStore';

const MAX_BODY_CHARS = 64 * 1024;

/**
 * The iPhone app's pages come from capacitor://localhost, so its API calls are cross-origin.
 * Only that origin is allowed; the website is same-origin and needs nothing. (WebSockets aren't
 * covered by CORS, so the live game connection needs nothing either.)
 */
const APP_ORIGINS = new Set(['capacitor://localhost']);

function withCors(request: Request, response: Response): Response {
  const origin = request.headers.get('origin');
  if (!origin || !APP_ORIGINS.has(origin) || response.status === 101) return response;
  const res = new Response(response.body, response);
  res.headers.set('access-control-allow-origin', origin);
  res.headers.append('vary', 'Origin');
  return res;
}

/** Answers the browser's pre-flight check before the app POSTs JSON. */
function preflight(request: Request): Response {
  const origin = request.headers.get('origin');
  if (!origin || !APP_ORIGINS.has(origin)) return new Response(null, { status: 204 });
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
      vary: 'Origin',
    },
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_CHARS) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** POST /api/games: upload a game from a phone and give it a join code. */
async function createGame(request: Request, env: Env): Promise<Response> {
  const body = (await readJson(request)) as { deviceId?: unknown; game?: unknown } | null;
  if (!body || !isDeviceId(body.deviceId)) return json({ error: 'Missing device id.' }, 400);
  const game = sanitizeUpload(body.game, body.deviceId, Date.now(), cryptoRng);
  if (!game) return json({ error: "That game couldn't be set up online." }, 400);

  // Codes are random, so a clash is rare. Try a few before giving up.
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = newCode();
    const created = await env.GAME_ROOM.getByName(code).create({ ...game, code });
    if (created) return json({ code } satisfies CreateGameResponse, 201);
  }
  return json({ error: "Couldn't find a free code. Try again." }, 503);
}

export default {
  async fetch(request, env): Promise<Response> {
    if (request.method === 'OPTIONS') return preflight(request);
    return withCors(request, await route(request, env));
  },
} satisfies ExportedHandler<Env>;

/** The API routes. Everything else is a static file, served before the Worker runs. */
async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname === '/api/health') return json({ ok: true });
  if (pathname === '/api/courses' || pathname.startsWith('/api/courses/')) return handleCourses(request, env, pathname);
  if (pathname === '/api/games') {
    return request.method === 'POST' ? createGame(request, env) : json({ error: 'Use POST.' }, 405);
  }

  const match = pathname.match(/^\/api\/games\/([^/]+)(\/ws)?$/);
  if (match) {
    const code = match[1].toUpperCase();
    if (!isCode(code)) return json({ error: "That code doesn't look right." }, 400);
    const room = env.GAME_ROOM.getByName(code);
    if (match[2]) return room.fetch(request);
    if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405);
    const info = await room.info();
    return info ? json(info) : json({ error: 'No game with that code.' }, 404);
  }

  return json({ error: 'Not found.' }, 404);
}
