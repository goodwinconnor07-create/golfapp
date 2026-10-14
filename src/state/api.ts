// HTTP calls to the Send It server (the Cloudflare Worker in /worker).

import type { CourseDetail, CourseSummary, CreateGameResponse, Game, GameInfo } from '../game';

async function request(path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(path, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function errorText(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

/** True when the online server is reachable (it isn't until Cloudflare is set up). */
export async function checkServer(): Promise<boolean> {
  try {
    const res = await request('/api/health', {}, 4000);
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}

/** Uploads a game from this phone and returns its new join code. */
export async function createOnlineGame(deviceId: string, game: Game): Promise<string> {
  let res: Response;
  try {
    res = await request('/api/games', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId, game }),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check your signal and try again.");
  }
  if (!res.ok) throw new Error(await errorText(res, "Couldn't get a join code. Check your signal and try again."));
  const body = (await res.json()) as CreateGameResponse;
  return body.code;
}

/** Join-screen details for a code, or null if there's no such game. */
export async function fetchGameInfo(code: string): Promise<GameInfo | null> {
  let res: Response;
  try {
    res = await request(`/api/games/${encodeURIComponent(code)}`);
  } catch {
    throw new Error("Couldn't reach the server. Check your signal and try again.");
  }
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(await errorText(res, 'Something went wrong. Try again.'));
  return (await res.json()) as GameInfo;
}

/** Course search through our server. Throws a friendly message on failure. */
export async function searchCourses(q: string): Promise<CourseSummary[]> {
  let res: Response;
  try {
    res = await request(`/api/courses?q=${encodeURIComponent(q)}`);
  } catch {
    throw new Error("Couldn't reach course search. You can still play and enter pars on each tee.");
  }
  if (!res.ok) throw new Error(await errorText(res, "Course search isn't working right now."));
  return ((await res.json()) as { courses: CourseSummary[] }).courses;
}

export async function fetchCourse(id: string): Promise<CourseDetail> {
  let res: Response;
  try {
    res = await request(`/api/courses/${encodeURIComponent(id)}`);
  } catch {
    throw new Error("Couldn't load that course. Check your signal and try again.");
  }
  if (!res.ok) throw new Error(await errorText(res, "Couldn't load that course."));
  return (await res.json()) as CourseDetail;
}
