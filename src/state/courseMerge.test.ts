import { describe, expect, it } from 'vitest';
import { mergeCourses, nameKey } from './courseMerge';

const gc = (id: string, name: string, place: string, lat?: number, lng?: number) => ({ id: `gc:${id}`, name, place, par: null, lat, lng });
const og = (id: string, name: string, place: string, par: number, lat?: number, lng?: number) => ({ id: `og:${id}`, name, place, par, lat, lng });

describe('mergeCourses', () => {
  it('drops "Golf Club" style words when comparing names', () => {
    expect(nameKey('Rosewood Golf & Country Club')).toBe(nameKey('Rosewood Golf Club'));
    expect(nameKey('Rosewood GC')).toBe('rosewood');
  });

  it('shows the Rosewood courses once each, with par filled in', () => {
    const { courses, alsoFrom } = mergeCourses(
      [gc('qld', 'Rosewood Golf Club', 'Rosewood, QLD, Australia', -27.63, 152.6), gc('ky', 'Rosewood Golf Club', 'Lebanon, KY, United States', 37.6, -85.26)],
      [og('a', 'Rosewood Golf Club', '', 72, -27.6328, 152.6075), og('b', 'Rosewood Golf & Country Club', 'Lebanon, KY', 72, 37.5992, -85.2622)],
    );
    expect(courses.map((c) => [c.id, c.place, c.par])).toEqual([
      ['gc:qld', 'Rosewood, QLD, Australia', 72],
      ['gc:ky', 'Lebanon, KY, United States', 72],
    ]);
    expect(alsoFrom.get('gc:qld')).toBe('og:a');
  });

  it('falls back to a shared town or state when there are no map points', () => {
    const { courses } = mergeCourses([gc('ky', 'Rosewood Golf Club', 'Lebanon, KY, United States')], [og('b', 'Rosewood Golf & Country Club', 'Lebanon, KY', 72)]);
    expect(courses).toHaveLength(1);
  });

  it("keeps same-named courses that are far apart, or that it can't place", () => {
    const { courses } = mergeCourses(
      [gc('ky', 'Rosewood Golf Club', 'Lebanon, KY, United States', 37.6, -85.26)],
      [og('a', 'Rosewood Golf Club', '', 72, -27.63, 152.6), og('c', 'Rosewood Golf Club', '', 70)],
    );
    expect(courses).toHaveLength(3);
  });
});
