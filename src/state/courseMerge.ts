import type { CourseSummary } from '../game';

/** "Rosewood Golf & Country Club" and "Rosewood GC" both become "rosewood". */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(golf|country|club|course|links|gc|cc|g and cc|and|the)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}

/** Distance in km between two map points. */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

const words = (place: string) => new Set(place.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1));

/**
 * Same course? Names must match once "Golf Club" and the like are dropped. Then the map
 * decides (within 5 km); without map points, the places must share a word (town or state).
 */
export function sameCourse(a: CourseSummary, b: CourseSummary): boolean {
  const key = nameKey(a.name);
  if (!key || key !== nameKey(b.name)) return false;
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    return km({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) < 5;
  }
  if (!a.place || !b.place) return false;
  const bw = words(b.place);
  return [...words(a.place)].some((w) => bw.has(w));
}

/**
 * Joins both sources' results, showing each course once. The first list's entry wins
 * (it has the fuller place), filling in par and map point from the other.
 * alsoFrom maps a kept id to the dropped one, for loading hole pars if the first lacks them.
 */
export function mergeCourses(first: CourseSummary[], second: CourseSummary[]): { courses: CourseSummary[]; alsoFrom: Map<string, string> } {
  const courses = first.map((c) => ({ ...c }));
  const alsoFrom = new Map<string, string>();
  for (const c of second) {
    const match = courses.find((k) => !alsoFrom.has(k.id) && k.id !== c.id && sameCourse(k, c));
    if (!match) {
      courses.push(c);
      continue;
    }
    alsoFrom.set(match.id, c.id);
    match.par ??= c.par;
    if (!match.place) match.place = c.place;
    if (match.lat == null && c.lat != null) {
      match.lat = c.lat;
      match.lng = c.lng;
    }
  }
  return { courses, alsoFrom };
}
