// A tiny golf-ball physics model for the card scenes, worked out ahead of time so the browser
// only plays back keyframes (smooth on any phone).
//
// A shot is a list of legs over the ground. Each leg goes from where the ball is to a screen
// point with a perspective scale (how big the ball looks there: 1 near, smaller far away):
//   - with a height: a flight or a bounce. Gravity gives a true parabola; the ground speed is
//     constant in the world, so on screen it slows as the ball goes into the distance.
//   - without: a roll that slows to a stop under constant friction.
// The ball spins in step with how far it has actually rolled or flown.

export interface Spot {
  x: number;
  y: number;
  /** Perspective scale of the ball here (1 = full size). */
  s: number;
}

export interface Leg {
  to: Spot;
  /** Seconds. */
  t: number;
  /** Peak height in px at scale 1. 0 = rolling on the ground. */
  h?: number;
}

export interface Sample {
  /** Ground point under the ball (where the shadow is). */
  gx: number;
  gy: number;
  /** The ball itself (lifted by its height). */
  bx: number;
  by: number;
  s: number;
  /** Height above the ground at scale 1, for the shadow. */
  h: number;
  /** Spin in degrees. */
  spin: number;
}

const FPS = 40;

/** Where the ball is a world-fraction f of the way from a to b, with perspective. */
function along(a: Spot, b: Spot, f: number): Spot {
  // Depth is 1/scale. Equal steps in the world are equal steps in depth.
  const za = 1 / a.s;
  const zb = 1 / b.s;
  const z = za + (zb - za) * f;
  const s = 1 / z;
  // Screen position is linear in 1/depth (that is, in scale).
  const w = a.s === b.s ? f : (s - a.s) / (b.s - a.s);
  return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w, s };
}

export function simulate(start: Spot, legs: Leg[], ballR = 6.5): { samples: Sample[]; duration: number; legEnds: number[] } {
  const samples: Sample[] = [];
  const legEnds: number[] = [];
  let from = start;
  let spin = 0;
  let last = start;
  let elapsed = 0;
  for (const leg of legs) {
    const steps = Math.max(2, Math.round(leg.t * FPS));
    for (let i = samples.length ? 1 : 0; i <= steps; i++) {
      const u = i / steps;
      // Flights and bounces: constant ground speed. Rolls: constant deceleration to a stop.
      const f = leg.h ? u : 1 - (1 - u) * (1 - u);
      const g = along(from, leg.to, f);
      const h = leg.h ? 4 * leg.h * u * (1 - u) : 0;
      // Spin with distance travelled, measured at full size.
      const d = Math.hypot(g.x - last.x, g.y - last.y) / Math.max(0.2, g.s);
      // Rolling right (or straight away) turns it clockwise; coming back turns it the other way.
      const back = g.x < last.x - 0.01 ? -1 : 1;
      spin += back * (d / ballR) * (180 / Math.PI);
      last = g;
      samples.push({ gx: g.x, gy: g.y, bx: g.x, by: g.y - h * g.s, s: g.s, h, spin });
    }
    elapsed += leg.t;
    legEnds.push(elapsed);
    from = leg.to;
  }
  return { samples, duration: elapsed, legEnds };
}

/** 1 on the ground, fading towards 0.25 as the ball climbs. */
const lift = (p: Sample) => Math.max(0.25, 1 - p.h / 140);

const f1 = (n: number) => n.toFixed(1);

/** SMIL value lists for the ball, its shadow, the ball's size and spin. */
export function tracks(samples: Sample[]) {
  return {
    ball: samples.map((p) => `${f1(p.bx)} ${f1(p.by)}`).join(';'),
    ground: samples.map((p) => `${f1(p.gx)} ${f1(p.gy)}`).join(';'),
    scale: samples.map((p) => p.s.toFixed(3)).join(';'),
    // The shadow fades and shrinks as the ball climbs.
    shadow: samples.map((p) => lift(p).toFixed(3)).join(';'),
    shadowScale: samples.map((p) => (p.s * (0.55 + 0.45 * lift(p))).toFixed(3)).join(';'),
    spin: samples.map((p) => p.spin.toFixed(0)).join(';'),
  };
}
