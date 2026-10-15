// Golf course lookup for the setup screen. The app only ever talks to this Worker,
// which calls the course data sources and saves their answers (see CourseStore), so the
// same course or search only costs one GolfCourseAPI lookup.
//
// Two sources go through here, searched together:
//  - GolfCore (https://www.golfcore.org/developers/, ~35,000 courses with hole-by-hole
//    scorecards, strong in Australia). Its key is the GOLFCORE_API_KEY secret. Until
//    4 Dec 2026 it also answers without a key; after that it needs one.
//  - GolfCourseAPI (https://golfcourseapi.com, ~30,000 courses worldwide). Off until the
//    GOLFCOURSE_API_KEY secret is set (npx wrangler secret put GOLFCOURSE_API_KEY).
// Both keys are sent as "Authorization: Bearer <key>" and never reach the app.
// OpenGolfAPI is called straight from the app instead (src/state/courses.ts): it refuses
// requests from Cloudflare Workers but allows browsers.

import type { CourseDetail, CourseSummary } from '../src/game';
import { mergeCourses } from '../src/state/courseMerge';

type CourseEnv = Env & { GOLFCOURSE_API_KEY?: string; GOLFCORE_API_KEY?: string };
type Par = 3 | 4 | 5;

const GC = 'https://api.golfcourseapi.com/v1';
const CACHE_SECONDS = 24 * 60 * 60;
const GC_CREDIT = 'Course data from GolfCourseAPI';
const CORE = 'https://api.golfcore.org/v1';
const CORE_CREDIT = 'Course data from GolfCore';

export const isPar = (n: unknown): n is Par => n === 3 || n === 4 || n === 5;
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const place = (...parts: unknown[]) => [...new Set(parts.map(text).filter(Boolean))].join(', ');

/** GET a JSON URL through the Workers cache, so repeat lookups don't hit the source. */
async function cachedJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const cache = caches.default;
  const key = new Request(url);
  const hit = await cache.match(key);
  if (hit) return hit.json();
  const res = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'SendItGolf/1.0 (+https://send-it.kavishahtemu11.workers.dev)', ...headers },
  });
  if (!res.ok) throw new Error(`Course source returned ${res.status}`);
  const body = await res.text();
  await cache.put(
    key,
    new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${CACHE_SECONDS}` } }),
  );
  return JSON.parse(body);
}

type Obj = Record<string, unknown>;

/** "Royal Melbourne Gc" + "Royal Melbourne Gc - East Course" reads better as just the course name. */
function courseName(c: Obj): string {
  const tidy = (v: unknown) => text(v).replace(/\b(Gc|Cc|G&cc)\b/g, (m) => m.toUpperCase());
  const club = tidy(c.club_name);
  const course = tidy(c.course_name);
  if (!course || course === club) return club;
  if (!club || course.toLowerCase().includes(club.toLowerCase())) return course;
  // "Rosewood Golf Club" and "Rosewood GC" are the same place: keep just the club name.
  const short = (v: string) =>
    v
      .toLowerCase()
      .replace(/golf club/g, 'gc')
      .replace(/country club/g, 'cc')
      .replace(/[^a-z0-9]/g, '');
  if (short(club).includes(short(course)) || short(course).includes(short(club))) return club;
  return `${club} · ${course}`;
}
const coords = (lat: unknown, lng: unknown) =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {};
const obj = (v: unknown): Obj => (typeof v === 'object' && v !== null ? (v as Obj) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

async function searchGolfCourse(q: string, key: string): Promise<CourseSummary[]> {
  const data = obj(await cachedJson(`${GC}/search?search_query=${encodeURIComponent(q)}`, { authorization: `Bearer ${key}` }));
  return list(data.courses).map((raw) => {
    const c = obj(raw);
    const loc = obj(c.location);
    return { id: `gc:${String(c.id)}`, name: courseName(c), place: place(loc.city, loc.state, loc.country), par: null, ...coords(loc.latitude, loc.longitude) };
  });
}

async function detailGolfCourse(id: string, key: string): Promise<CourseDetail> {
  const data = obj(await cachedJson(`${GC}/courses/${encodeURIComponent(id)}`, { authorization: `Bearer ${key}` }));
  // The course may come wrapped as { course: {...} } or bare.
  const course = data.course ? obj(data.course) : data;
  const tees = obj(course.tees);
  // Use the first tee (men's tees come first) that lists a sensible par for every hole.
  const allTees = [...list(tees.male), ...list(tees.female)].map(obj);
  const parsOf = (tee: Obj) => list(tee.holes).map((h) => obj(h).par);
  const tee = allTees.find((t) => {
    const p = parsOf(t);
    return p.length > 0 && p.every(isPar);
  });
  const pars = tee ? (parsOf(tee) as Par[]) : [];
  const loc = obj(course.location);
  return {
    id: `gc:${id}`,
    name: courseName(course),
    place: place(loc.city, loc.state, loc.country),
    par: pars.length ? pars.reduce((a, b) => a + b, 0) : num(obj(allTees[0]).par_total),
    pars,
    attribution: GC_CREDIT,
  };
}

/** "au" → "Australia". */
function countryName(code: unknown): string {
  const c = text(code).toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(c) ?? c;
  } catch {
    return c;
  }
}

const coreHeaders = (key?: string): Record<string, string> => (key ? { authorization: `Bearer ${key}` } : {});

type CoreResult = CourseSummary & { scorecard: boolean };

async function searchGolfCore(q: string, key?: string): Promise<CoreResult[]> {
  const data = obj(await cachedJson(`${CORE}/courses?q=${encodeURIComponent(q)}&limit=20`, coreHeaders(key)));
  return list(data.courses).map((raw) => {
    const c = obj(raw);
    return {
      id: `core:${text(c.slug)}`,
      name: text(c.name),
      place: place(c.city, c.region, countryName(c.country)),
      par: num(c.par_total),
      ...coords(c.lat, c.lng),
      scorecard: obj(c.coverage).scorecard === true,
    };
  });
}

async function detailGolfCore(slug: string, key?: string): Promise<CourseDetail> {
  const c = obj(await cachedJson(`${CORE}/courses/${encodeURIComponent(slug)}`, coreHeaders(key)));
  // Each layout lists its holes, then its tees (which can differ, e.g. a ladies' par 5).
  // Use the layout's own holes first, then the first tee, whichever has a sensible par for every hole.
  const layouts = list(c.layouts).map(obj);
  const options = layouts.flatMap((l) => [l, ...list(l.tees).map(obj)]);
  const parsOf = (o: Obj) =>
    list(o.holes)
      .map(obj)
      .sort((a, b) => (num(a.position) ?? 0) - (num(b.position) ?? 0))
      .map((h) => h.par);
  const best = options.find((o) => {
    const p = parsOf(o);
    return p.length > 0 && p.every(isPar);
  });
  const pars = best ? (parsOf(best) as Par[]) : [];
  return {
    id: `core:${slug}`,
    name: text(c.name),
    place: place(c.city, c.region, countryName(c.country)),
    par: pars.length ? pars.reduce((a, b) => a + b, 0) : num(c.par_total),
    pars,
    attribution: CORE_CREDIT,
  };
}

/**
 * GolfCore entries with a scorecard come first, then GolfCourseAPI, then GolfCore entries
 * without one. A course both sources know is shown once.
 */
export function joinSources(core: CoreResult[], gc: CourseSummary[]): CourseSummary[] {
  const strip = ({ scorecard: _, ...c }: CoreResult): CourseSummary => c;
  const withCard = core.filter((c) => c.scorecard).map(strip);
  const without = core.filter((c) => !c.scorecard).map(strip);
  return mergeCourses(mergeCourses(withCard, gc).courses, without).courses;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Hole pars rarely change, so a saved course is reused for six months. */
const COURSE_KEEP_MS = 180 * DAY_MS;
/** Searches are refreshed sooner so newly added courses turn up. */
const SEARCH_KEEP_MS = 30 * DAY_MS;

/** Returns the saved answer for key, or runs load() once and saves what it returns. */
async function saved<T>(env: CourseEnv, key: string, keepMs: number, load: () => Promise<T>): Promise<T> {
  const store = env.COURSE_STORE.getByName('courses');
  try {
    const hit = await store.get(key, keepMs);
    if (hit) return JSON.parse(hit) as T;
  } catch (e) {
    console.warn('course store read failed', String(e));
  }
  const value = await load();
  try {
    await store.put(key, JSON.stringify(value));
  } catch (e) {
    console.warn('course store write failed', String(e));
  }
  return value;
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
      const qKey = q.toLowerCase().replace(/\s+/g, ' ');
      const [core, gc] = await Promise.allSettled([
        saved(env, `v1:core-search:${qKey}`, SEARCH_KEEP_MS, () => searchGolfCore(q, env.GOLFCORE_API_KEY)),
        key ? saved(env, `v3:search:${qKey}`, SEARCH_KEEP_MS, () => searchGolfCourse(q, key)) : Promise.resolve([]),
      ]);
      for (const r of [core, gc]) if (r.status === 'rejected') console.warn('course search failed', String(r.reason));
      if (core.status === 'rejected' && gc.status === 'rejected') return json({ error: "Course search isn't answering right now." }, 502);
      const courses = joinSources(core.status === 'fulfilled' ? core.value : [], gc.status === 'fulfilled' ? gc.value : []).filter((c) => c.name);
      return json({ courses: courses.slice(0, 20) });
    }
    // The app encodes the id, so "gc:abc" arrives as "gc%3Aabc".
    let path = pathname;
    try {
      path = decodeURIComponent(pathname);
    } catch {
      return json({ error: 'Not found.' }, 404);
    }
    const core = path.match(/^\/api\/courses\/core:([a-z0-9-]{1,100})$/);
    if (core) return json(await saved(env, `v1:core-course:${core[1]}`, COURSE_KEEP_MS, () => detailGolfCore(core[1], env.GOLFCORE_API_KEY)));
    const m = path.match(/^\/api\/courses\/gc:([A-Za-z0-9-]{1,64})$/);
    if (!m) return json({ error: 'Not found.' }, 404);
    if (!key) return json({ error: 'That course source is switched off.' }, 404);
    return json(await saved(env, `v2:course:${m[1]}`, COURSE_KEEP_MS, () => detailGolfCourse(m[1], key)));
  } catch (e) {
    console.warn('course lookup failed', String(e));
    return json({ error: "Couldn't load that course right now." }, 502);
  }
}
