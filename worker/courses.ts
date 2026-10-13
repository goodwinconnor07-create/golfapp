// Golf course lookup for the setup screen. The app only ever talks to this Worker,
// which calls the course data sources and caches their answers for a day.
//
// Sources:
//  - OpenGolfAPI (https://opengolfapi.org): free, no key, ODbL (© OpenStreetMap contributors).
//    Hole pars are good for US courses; elsewhere it often has the course but no pars.
//  - GolfCourseAPI (https://golfcourseapi.com): ~30,000 courses worldwide, needs a key.
//    Switched on by setting the GOLFCOURSE_API_KEY secret (wrangler secret put GOLFCOURSE_API_KEY).

import type { CourseDetail, CourseSummary } from '../src/game';

type CourseEnv = Env & { GOLFCOURSE_API_KEY?: string };
type Par = 3 | 4 | 5;

const OG = 'https://api.opengolfapi.org/v1';
const GC = 'https://api.golfcourseapi.com/v1';
const CACHE_SECONDS = 24 * 60 * 60;
const OG_CREDIT = 'Course data © OpenStreetMap contributors (ODbL) via OpenGolfAPI';
const GC_CREDIT = 'Course data from GolfCourseAPI';

const isPar = (n: unknown): n is Par => n === 3 || n === 4 || n === 5;
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const place = (...parts: unknown[]) => [...new Set(parts.map(text).filter(Boolean))].join(', ');

/** GET a JSON URL through the Workers cache, so repeat lookups don't hit the source. */
async function cachedJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const cache = caches.default;
  const key = new Request(url);
  const hit = await cache.match(key);
  if (hit) return hit.json();
  const res = await fetch(url, { headers: { accept: 'application/json', ...headers } });
  if (!res.ok) throw new Error(`Course source returned ${res.status}`);
  const body = await res.text();
  await cache.put(
    key,
    new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${CACHE_SECONDS}` } }),
  );
  return JSON.parse(body);
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (typeof v === 'object' && v !== null ? (v as Obj) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

async function searchOpenGolf(q: string): Promise<CourseSummary[]> {
  const data = obj(await cachedJson(`${OG}/courses/search?q=${encodeURIComponent(q)}`));
  return list(data.courses).map((raw) => {
    const c = obj(raw);
    return { id: `og:${text(c.id)}`, name: text(c.name) || text(c.course_name), place: place(c.city, c.state), par: num(c.par) };
  });
}

async function detailOpenGolf(id: string): Promise<CourseDetail> {
  const c = obj(await cachedJson(`${OG}/courses/${encodeURIComponent(id)}`));
  const holes = list(c.scorecard)
    .map(obj)
    .sort((a, b) => (num(a.hole) ?? 0) - (num(b.hole) ?? 0))
    .map((h) => h.par);
  const pars = holes.every(isPar) ? (holes as Par[]) : [];
  return { id: `og:${id}`, name: text(c.name), place: place(c.city, c.state), par: num(c.par), pars, attribution: OG_CREDIT };
}

async function searchGolfCourse(q: string, key: string): Promise<CourseSummary[]> {
  const data = obj(await cachedJson(`${GC}/search?search_query=${encodeURIComponent(q)}`, { authorization: `Key ${key}` }));
  return list(data.courses).map((raw) => {
    const c = obj(raw);
    const loc = obj(c.location);
    const name = [text(c.club_name), text(c.course_name)].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ');
    return { id: `gc:${String(c.id)}`, name, place: place(loc.city, loc.state, loc.country), par: null };
  });
}

async function detailGolfCourse(id: string, key: string): Promise<CourseDetail> {
  const data = obj(await cachedJson(`${GC}/courses/${encodeURIComponent(id)}`, { authorization: `Key ${key}` }));
  // The course may come wrapped as { course: {...} } or bare.
  const course = data.course ? obj(data.course) : data;
  const tees = obj(course.tees);
  const firstTee = obj([...list(tees.male), ...list(tees.female)][0]);
  const holes = list(firstTee.holes).map((h) => obj(h).par);
  const pars = holes.every(isPar) ? (holes as Par[]) : [];
  const loc = obj(course.location);
  return {
    id: `gc:${id}`,
    name: [text(course.club_name), text(course.course_name)].filter((v, i, a) => v && a.indexOf(v) === i).join(' · '),
    place: place(loc.city, loc.state, loc.country),
    par: num(firstTee.par_total) ?? (pars.length ? pars.reduce((a, b) => a + b, 0) : null),
    pars,
    attribution: GC_CREDIT,
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** GET /api/courses?q=…  and  GET /api/courses/:id */
export async function handleCourses(request: Request, env: CourseEnv, pathname: string): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405);
  const key = env.GOLFCOURSE_API_KEY;
  try {
    if (pathname === '/api/courses') {
      const q = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, 60);
      if (q.length < 3) return json({ courses: [] });
      const results = await Promise.allSettled([key ? searchGolfCourse(q, key) : Promise.resolve([]), searchOpenGolf(q)]);
      const courses = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).filter((c) => c.name);
      if (courses.length === 0 && results.every((r) => r.status === 'rejected'))
        return json({ error: "Course search isn't answering right now." }, 502);
      return json({ courses: courses.slice(0, 20) });
    }
    const m = pathname.match(/^\/api\/courses\/(og|gc):([A-Za-z0-9-]{1,64})$/);
    if (!m) return json({ error: 'Not found.' }, 404);
    if (m[1] === 'gc') {
      if (!key) return json({ error: 'That course source is switched off.' }, 404);
      return json(await detailGolfCourse(m[2], key));
    }
    return json(await detailOpenGolf(m[2]));
  } catch {
    return json({ error: "Couldn't load that course right now." }, 502);
  }
}
