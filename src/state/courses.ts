// Course search for setup. Two sources, searched together:
//  - OpenGolfAPI, called straight from the phone (free, no key, ODbL © OpenStreetMap
//    contributors). Strong on US hole pars; elsewhere it often has the course but no pars.
//  - GolfCourseAPI through our Worker, which holds its key. Off until the key is added.

import type { CourseDetail, CourseSummary } from '../game';
import { fetchCourse as fetchFromServer, searchCourses as searchServer } from './api';
import { mergeCourses } from './courseMerge';

const OG = 'https://api.opengolfapi.org/v1';
const OG_CREDIT = 'Course data © OpenStreetMap contributors (ODbL) via OpenGolfAPI';

type Obj = Record<string, unknown>;
type Par = 3 | 4 | 5;
const obj = (v: unknown): Obj => (typeof v === 'object' && v !== null ? (v as Obj) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const isPar = (n: unknown): n is Par => n === 3 || n === 4 || n === 5;
const place = (...parts: unknown[]) => [...new Set(parts.map(text).filter(Boolean))].join(', ');

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Course search returned ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchOpenGolf(q: string): Promise<CourseSummary[]> {
  const data = obj(await getJson(`${OG}/courses/search?q=${encodeURIComponent(q)}`));
  return list(data.courses).map((raw) => {
    const c = obj(raw);
    const lat = num(c.latitude);
    const lng = num(c.longitude);
    return {
      id: `og:${text(c.id)}`,
      name: text(c.name) || text(c.course_name),
      place: place(c.city, c.state),
      par: num(c.par),
      ...(lat != null && lng != null ? { lat, lng } : {}),
    };
  });
}

async function detailOpenGolf(id: string): Promise<CourseDetail> {
  const c = obj(await getJson(`${OG}/courses/${encodeURIComponent(id)}`));
  const holes = list(c.scorecard)
    .map(obj)
    .sort((a, b) => (num(a.hole) ?? 0) - (num(b.hole) ?? 0))
    .map((h) => h.par);
  return {
    id: `og:${id}`,
    name: text(c.name),
    place: place(c.city, c.state),
    par: num(c.par),
    pars: holes.every(isPar) ? (holes as Par[]) : [],
    attribution: OG_CREDIT,
  };
}

/** Searches every source at once. Worldwide results (when switched on) come first. */
export async function searchCourses(q: string): Promise<CourseSummary[]> {
  const results = await Promise.allSettled([searchServer(q), searchOpenGolf(q)]);
  const [server, open] = results.map((r) => (r.status === 'fulfilled' ? r.value : []).filter((c) => c.name && c.id.length > 3));
  // The same course often comes back from both sources: show it once.
  const { courses, alsoFrom } = mergeCourses(server, open);
  for (const [id, other] of alsoFrom) backup.set(id, other);
  if (results.every((r) => r.status === 'rejected')) {
    throw new Error("Couldn't reach course search. You can still play and enter pars on each tee.");
  }
  return courses.slice(0, 20);
}

/** For a merged course, the other source's id: tried when the first has no hole pars. */
const backup = new Map<string, string>();

export async function fetchCourse(id: string): Promise<CourseDetail> {
  const other = backup.get(id);
  if (other) {
    const first = await loadCourse(id).catch(() => null);
    if (first?.pars.length) return first;
    const second = await loadCourse(other).catch(() => null);
    if (second?.pars.length) return { ...second, name: first?.name ?? second.name, place: first?.place || second.place };
    if (first) return first;
    return loadCourse(other);
  }
  return loadCourse(id);
}

async function loadCourse(id: string): Promise<CourseDetail> {
  if (id.startsWith('og:')) {
    try {
      return await detailOpenGolf(id.slice(3));
    } catch {
      throw new Error("Couldn't load that course. Check your signal and try again.");
    }
  }
  return fetchFromServer(id);
}
