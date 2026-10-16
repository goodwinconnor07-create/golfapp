// Shot-by-shot amateur golf model, scaled by handicap. Distances in metres.
export type Lie = 'tee' | 'fw' | 'rough' | 'fbunker' | 'gbunker' | 'fringe' | 'green';
export type Rng = () => number;

export interface Shot {
  from: number;
  fromLie: Lie;
  to: number; // distance to the pin afterwards (0 = holed)
  toLie: Lie;
  kind: 'full' | 'short' | 'putt';
  approach: boolean; // a full shot at the green
  dist: number; // distance the ball travelled
  penalty: number;
  pType?: 'ob' | 'lost' | 'water';
  holed: boolean;
}

export interface HoleLog {
  par: number;
  length: number;
  hasBunker: boolean;
  shots: Shot[];
  strokes: number;
  mulligan: boolean;
  drive: number; // player's driver distance, for club checks
}

export interface Skill {
  h: number;
  drive: number;
  fw: number;
  pen: number;
  duff: number;
}

/** Real handicap index → the model's skill scale, calibrated so average scores ≈ par + handicap + 2 to 3. */
export function skill(handicap: number): Skill {
  const h = 0.74 * handicap;
  return { h, drive: 230 - 2.5 * h, fw: 0.6 - 0.009 * h, pen: 0.015 + 0.0032 * h, duff: 0.01 + 0.0042 * h };
}

export interface Tune {
  approach: number; // sigma per metre per handicap point
  approachBase: number;
}
export const TUNE: Tune = { approach: 0.0034, approachBase: 0.066 };

const GREEN_R = 13;
const FRINGE_R = 16;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng: Rng): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
function rayleigh(rng: Rng, sigma: number): number {
  return sigma * Math.sqrt(-2 * Math.log(Math.max(rng(), 1e-12)));
}

// Tour make rates by feet, raised to a power that grows with handicap.
const PUTT_TABLE: [number, number][] = [
  [1, 1],
  [2, 0.99],
  [3, 0.96],
  [4, 0.88],
  [5, 0.77],
  [6, 0.66],
  [7, 0.58],
  [8, 0.5],
  [10, 0.4],
  [12, 0.31],
  [15, 0.23],
  [20, 0.15],
  [25, 0.1],
  [30, 0.07],
  [40, 0.045],
  [60, 0.02],
  [90, 0.01],
  [200, 0.003],
];
function tourMake(feet: number): number {
  if (feet <= 1) return 1;
  for (let i = 1; i < PUTT_TABLE.length; i++) {
    const [f1, p1] = PUTT_TABLE[i];
    if (feet <= f1) {
      const [f0, p0] = PUTT_TABLE[i - 1];
      return p0 + ((p1 - p0) * (feet - f0)) / (f1 - f0);
    }
  }
  return 0.002;
}
export function makeProb(h: number, metres: number): number {
  return Math.pow(tourMake(metres * 3.281), 1.1 + 0.025 * h);
}

function maxClub(s: Skill, lie: Lie): number {
  if (lie === 'tee') return s.drive * 0.95;
  if (lie === 'fw') return s.drive * 0.85;
  if (lie === 'rough') return s.drive * 0.7;
  if (lie === 'fbunker') return s.drive * 0.55;
  return 40;
}

interface Hole {
  par: number;
  length: number;
  hasBunker: boolean;
}

export function makeHole(par: number, rng: Rng): Hole {
  const length = par === 3 ? 110 + rng() * 55 : par === 4 ? 290 + rng() * 80 : 420 + rng() * 60;
  return { par, length, hasBunker: rng() < 0.75 };
}

/**
 * Play one hole. mulliganOk: player may erase one disaster shot (penalty or duff) this hole.
 */
export function playHole(s: Skill, hole: Hole, rng: Rng, mulliganOk: boolean): HoleLog {
  const shots: Shot[] = [];
  let pos = hole.length;
  let lie: Lie = 'tee';
  let strokes = 0;
  let mulligan = false;
  const cap = 10; // casual max: 10 strokes a hole
  const bunkerOr = (l: Lie): Lie => (hole.hasBunker ? l : 'rough');

  while (strokes < cap) {
    let shot: Shot;
    if (lie === 'green') {
      shot = putt(s, pos, rng);
    } else if (pos <= 40 && lie !== 'tee') {
      shot = shortGame(s, pos, lie, rng, bunkerOr);
    } else {
      shot = fullShot(s, pos, lie, hole, rng, bunkerOr);
    }
    const disaster = shot.penalty > 0 || (shot.kind === 'full' && shot.dist < 0.5 * Math.min(pos, maxClub(s, lie)) && !shot.holed);
    if (disaster && mulliganOk && !mulligan) {
      mulligan = true;
      continue; // re-hit, the first one doesn't count
    }
    shots.push(shot);
    strokes += 1 + shot.penalty;
    if (shot.holed) break;
    if (shot.pType === 'ob' || shot.pType === 'lost') {
      // stroke and distance: play again from the same spot
      continue;
    }
    pos = shot.to;
    lie = shot.toLie;
  }
  // Picked up at the cap (casual groups do)
  return {
    par: hole.par,
    length: hole.length,
    hasBunker: hole.hasBunker,
    shots,
    strokes: Math.min(strokes, cap),
    mulligan,
    drive: s.drive,
  };
}

function putt(s: Skill, d: number, rng: Rng): Shot {
  if (rng() < makeProb(s.h, d))
    return { from: d, fromLie: 'green', to: 0, toLie: 'green', kind: 'putt', approach: false, dist: d, penalty: 0, holed: true };
  const median = d * (0.05 + 0.0022 * s.h) + 0.3;
  const leave = Math.max(0.2, median * Math.exp(0.5 * normal(rng)));
  return { from: d, fromLie: 'green', to: leave, toLie: 'green', kind: 'putt', approach: false, dist: d, penalty: 0, holed: false };
}

function shortGame(s: Skill, d: number, lie: Lie, rng: Rng, bunkerOr: (l: Lie) => Lie): Shot {
  const base = { from: d, fromLie: lie, kind: 'short' as const, approach: false, penalty: 0 };
  if (lie === 'gbunker' || lie === 'fbunker') {
    if (rng() < 0.05 + 0.009 * s.h) return { ...base, to: d, toLie: lie, dist: 0, holed: false };
    if (rng() < 0.02 * Math.max(0, 1 - s.h / 40)) return { ...base, to: 0, toLie: 'green', dist: d, holed: true };
    const r = rayleigh(rng, 2.5 + 0.2 * s.h);
    return { ...base, to: r, toLie: r <= GREEN_R ? 'green' : 'rough', dist: d, holed: false };
  }
  const holeOut = (lie === 'fringe' ? 0.06 : 0.035 - 0.0008 * s.h) * Math.min(1, 12 / d);
  if (rng() < Math.max(0.003, holeOut)) return { ...base, to: 0, toLie: 'green', dist: d, holed: true };
  const flub = (0.03 + 0.0055 * s.h) * (lie === 'fringe' ? 0.4 : 1);
  if (rng() < flub) {
    if (rng() < 0.5) return { ...base, to: d * 0.7, toLie: 'rough', dist: d * 0.3, holed: false };
    return { ...base, to: 22, toLie: bunkerOr(rng() < 0.2 ? 'gbunker' : 'rough'), dist: d + 22, holed: false };
  }
  const r = rayleigh(rng, d * (0.09 + 0.005 * s.h) + 0.5);
  return { ...base, to: r, toLie: r <= GREEN_R ? 'green' : r <= FRINGE_R ? 'fringe' : 'rough', dist: d, holed: false };
}

function fullShot(s: Skill, d: number, lie: Lie, hole: Hole, rng: Rng, bunkerOr: (l: Lie) => Lie): Shot {
  const max = maxClub(s, lie);
  const isTeeLong = lie === 'tee' && hole.par > 3;
  const goForGreen = !isTeeLong && d <= max + 25;
  const base = { from: d, fromLie: lie, kind: 'full' as const, approach: goForGreen };
  const lieMult = lie === 'rough' ? 1.3 : lie === 'fbunker' ? 1.6 : lie === 'tee' ? 0.95 : 1;

  // Penalty (water / OB / lost)
  const pen = isTeeLong ? s.pen : s.pen * 0.45 * lieMult;
  if (rng() < pen) {
    const r = rng();
    const pType = r < 0.4 ? 'ob' : r < 0.65 ? 'lost' : 'water';
    const travel = Math.min(d, (goForGreen ? d : max) * (0.7 + 0.3 * rng()));
    if (pType === 'water') {
      const to = Math.max(goForGreen ? 25 : d - travel * 0.8, 20);
      return { ...base, to, toLie: 'rough', dist: travel, penalty: 1, pType, holed: false };
    }
    return { ...base, to: d, toLie: lie, dist: travel, penalty: 1, pType, holed: false };
  }
  // Duff / top
  if (rng() < s.duff * lieMult) {
    const travel = Math.min(d, max) * (0.25 + 0.25 * rng());
    return { ...base, to: d - travel, toLie: 'rough', dist: travel, penalty: 0, holed: false };
  }

  if (!goForGreen) {
    // Advance the ball (tee shot on a par 4/5, or out of range)
    const want = isTeeLong ? s.drive : Math.min(max, d - 60);
    const travel = Math.max(20, Math.min(d - 5, want * (1 + (0.06 + 0.002 * s.h) * normal(rng))));
    const to = d - travel;
    const fw = isTeeLong ? s.fw / (1 - s.pen) : Math.min(0.85, s.fw + 0.15);
    const r = rng();
    const toLie: Lie = r < fw ? 'fw' : r < fw + 0.07 ? bunkerOr('fbunker') : 'rough';
    return { ...base, to, toLie, dist: travel, penalty: 0, holed: false };
  }

  // At the green
  const sigma = d * (TUNE.approachBase + TUNE.approach * s.h) * lieMult + 1.5;
  let r = rayleigh(rng, sigma) + Math.max(0, d - max);
  if (rng() < 0.0004 * Math.max(0, 1 - s.h / 40) && d < 200) r = 0; // hole out / ace
  let toLie: Lie;
  if (r === 0) toLie = 'green';
  else if (r <= GREEN_R) toLie = 'green';
  else if (r <= FRINGE_R) toLie = 'fringe';
  else toLie = r < 30 && rng() < 0.3 ? bunkerOr('gbunker') : 'rough';
  if (toLie === 'rough' && r > 40 && rng() < 0.12) {
    return { ...base, to: 25, toLie: 'rough', dist: d, penalty: 1, pType: 'water', holed: false };
  }
  return { ...base, to: r, toLie, dist: d, penalty: 0, holed: r === 0 };
}

// ── Derived facts for the cards ──────────────────────────────────────────

export function strokesToGreen(log: HoleLog): number | null {
  let n = 0;
  for (const sh of log.shots) {
    if (sh.fromLie === 'green') return n;
    n += 1 + sh.penalty;
    if (sh.toLie === 'green' || sh.holed) return n;
  }
  return null;
}

export function facts(log: HoleLog) {
  const shots = log.shots;
  const penalties = shots.reduce((a, s) => a + s.penalty, 0);
  const tee = shots[0];
  const last = shots[shots.length - 1];
  const holed = last?.holed ?? false;
  return {
    penalties,
    ob: shots.some((s) => s.pType === 'ob'),
    lost: shots.some((s) => s.pType === 'lost'),
    bunker: shots.some((s) => s.toLie === 'gbunker' || s.toLie === 'fbunker'),
    teeFairway: tee && tee.penalty === 0 && tee.toLie === 'fw',
    teeSafe: tee && tee.penalty === 0 && (tee.toLie === 'fw' || tee.toLie === 'rough'),
    teeDist: tee && tee.penalty === 0 && tee.pType !== 'ob' && tee.pType !== 'lost' ? tee.dist : 0,
    teeProx: tee && tee.penalty === 0 && (tee.toLie === 'green' || tee.holed) ? tee.to : Infinity,
    teeGreenOrFringe: tee && tee.penalty === 0 && (tee.toLie === 'green' || tee.toLie === 'fringe' || tee.holed),
    second: shots[1],
    green: strokesToGreen(log),
    putts: shots.filter((s) => s.kind === 'putt').length,
    holedPutt: holed && last.kind === 'putt' ? last.from : null,
    holedFromOff: holed && last.kind !== 'putt' ? last.from : null,
    shots,
  };
}
