import { describe, expect, it } from 'vitest';
import { clubTip, impactAt, rig, swingTracks, type Swing, type View } from './golferPose';

const cases: [View, Swing][] = [
  ['side', 'full'],
  ['face', 'full'],
  ['face', 'splash'],
  ['face', 'chip'],
];

describe('golfer swing', () => {
  for (const [view, swing] of cases) {
    it(`${view} ${swing}: the club is at the ball at address and impact, and away from it at the finish`, () => {
      const r = rig(view, -3.6, swing === 'full' && view === 'side');
      const near = (t: number) => Math.hypot(clubTip(r, swing, t).x - r.ball.x, clubTip(r, swing, t).y - r.ball.y);
      expect(near(0)).toBeLessThan(1.5);
      expect(near(impactAt(swing))).toBeLessThan(1.5);
      expect(near(10)).toBeGreaterThan(10);
    });
  }

  it('keeps every frame of a part the same shape, so SMIL can tween between them', () => {
    const { values } = swingTracks(rig('face', -3.6), 'full');
    for (const list of Object.values(values)) {
      const shapes = new Set(list.split(';').map((d) => d.replace(/-?[\d.]+/g, '#')));
      expect(shapes.size).toBe(1);
    }
  });
});
