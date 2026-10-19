// The little golfer in the card scenes, posed ahead of time like the ball (see shotPhysics), so
// the browser only plays back keyframes.
//
// He's a simple jointed figure in his own units: about 40 tall, with the ball at x = 0 on the
// ground at y = 0 (face-on he stands just behind it). Each moment of the swing is a pose (where the arms and club point, how far he leans,
// where his hips are); poses are eased between and turned into SVG path data for every frame.
//
// Angles are degrees on screen, 0 pointing straight down and turning clockwise: 90 points left,
// 180 up, -90 right.

export type View = 'face' | 'side';
export type Swing = 'full' | 'chip' | 'splash' | 'putt';

interface Pt {
  x: number;
  y: number;
}

interface Pose {
  /** Direction from the shoulders to the hands. */
  a: number;
  /** Direction of the club from the hands. null: pointing at the ball (address and impact). */
  c: number | null;
  /** Spine angle from upright; positive leans to the right. */
  lean: number;
  hipX: number;
  hipY: number;
  /** How square the shoulders are to us (face-on): 1 square, lower turned. */
  span: number;
  /** Trail heel off the ground, 0 to 1. */
  heel: number;
  /** Head turned to watch the ball go, 0 to 1. */
  look: number;
}

type Ease = 'hold' | 'inOut' | 'in' | 'out';

interface Key {
  t: number;
  pose: Pose;
  /** How the swing moves into this key from the one before. */
  ease: Ease;
}

const FACE_ADDRESS: Pose = { a: 0, c: null, lean: -5, hipX: 0, hipY: -21, span: 1, heel: 0, look: 0 };
const FACE_IMPACT: Pose = { a: -5, c: null, lean: -9, hipX: 1.4, hipY: -21, span: 0.9, heel: 0.15, look: 0 };
const SIDE_ADDRESS: Pose = { a: -20, c: null, lean: 42, hipX: -22.5, hipY: -16.8, span: 1, heel: 0, look: 0 };
const SIDE_IMPACT: Pose = { a: -23, c: null, lean: 38, hipX: -21.6, hipY: -17.2, span: 1, heel: 0.2, look: 0 };

/** Seconds from the start of the swing: backswing starts, top, impact, finish. */
// Brisk, so the ball is in the air soon after the flip; still about the 3:1 backswing-to-downswing
// tempo of a real swing.
const TIMES: Record<Swing, [number, number, number, number]> = {
  full: [0.04, 0.4, 0.6, 1.0],
  splash: [0.04, 0.36, 0.54, 0.9],
  chip: [0.04, 0.3, 0.46, 0.75],
  putt: [0.04, 0.32, 0.48, 0.75],
};

const TOP: Record<View, Record<Swing, Partial<Pose>>> = {
  face: {
    full: { a: 120, c: 212, lean: -8, hipX: -1, span: 0.55 },
    splash: { a: 98, c: 190, lean: -7, hipX: -0.6, span: 0.65 },
    chip: { a: 40, c: 62, lean: -6, span: 0.9 },
    putt: { a: 14, c: 14, span: 1 },
  },
  side: {
    full: { a: 155, c: 252, lean: 40, hipX: -23 },
    splash: { a: 140, c: 230, lean: 41 },
    chip: { a: 40, c: 60 },
    putt: { a: 14, c: 14 },
  },
};

const FINISH: Record<View, Record<Swing, Partial<Pose>>> = {
  face: {
    full: { a: -128, c: -232, lean: 4, hipX: 3, hipY: -21.6, span: 0.5, heel: 1, look: 1 },
    splash: { a: -108, c: -200, lean: 2, hipX: 2.2, span: 0.55, heel: 0.8, look: 0.9 },
    chip: { a: -42, c: -52, lean: -6, hipX: 0.8, span: 0.85, heel: 0.25, look: 0.5 },
    putt: { a: -12, c: -12, lean: -5, look: 0.3 },
  },
  side: {
    full: { a: -172, c: -282, lean: 8, hipX: -20.2, hipY: -18.6, heel: 1, look: 1 },
    splash: { a: -150, c: -250, lean: 14, hipX: -20.6, hipY: -18.2, heel: 0.8, look: 0.9 },
    chip: { a: -60, c: -80, lean: 34, heel: 0.2, look: 0.5 },
    putt: { a: -12, c: -12, look: 0.3 },
  },
};

/** When the club meets the ball, in seconds from the start of the swing. */
export const impactAt = (swing: Swing) => TIMES[swing][2];
/** When he's holding the finish, in seconds from the start of the swing. */
export const swingLength = (swing: Swing) => TIMES[swing][3];

function keys(view: View, swing: Swing): Key[] {
  const address = view === 'face' ? FACE_ADDRESS : SIDE_ADDRESS;
  const impact = view === 'face' ? FACE_IMPACT : SIDE_IMPACT;
  // A putt is all shoulders: no hip slide, no lean change, nothing coming off the ground.
  const strike = swing === 'putt' ? { ...address, a: address.a - 3 } : impact;
  const [back, top, hit, end] = TIMES[swing];
  return [
    { t: 0, pose: address, ease: 'hold' },
    { t: back, pose: address, ease: 'hold' },
    { t: top, pose: { ...address, ...TOP[view][swing] }, ease: 'inOut' },
    { t: hit, pose: strike, ease: 'in' },
    { t: end, pose: { ...strike, ...FINISH[view][swing] }, ease: 'out' },
  ];
}

// ── Geometry ─────────────────────────────────────────────────────────────────

const rad = (d: number) => (d * Math.PI) / 180;
/** Unit vector for an angle (0 down, clockwise). */
const dir = (d: number): Pt => ({ x: -Math.sin(rad(d)), y: Math.cos(rad(d)) });
/** Unit vector for a lean from upright (positive to the right). */
const up = (d: number): Pt => ({ x: Math.sin(rad(d)), y: -Math.cos(rad(d)) });
const add = (p: Pt, v: Pt, k = 1): Pt => ({ x: p.x + v.x * k, y: p.y + v.y * k });
const mix = (a: Pt, b: Pt, u: number): Pt => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
const angleTo = (from: Pt, to: Pt) => (Math.atan2(-(to.x - from.x), to.y - from.y) * 180) / Math.PI;

/** The middle joint (knee or elbow) of a limb from a to b, bent to the side `pick` prefers. */
function joint(a: Pt, b: Pt, l1: number, l2: number, pick: (p: Pt, q: Pt) => Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.001) || 0.001;
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const out = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const ux = dx / d;
  const uy = dy / d;
  const base = { x: a.x + ux * along, y: a.y + uy * along };
  return pick({ x: base.x - uy * out, y: base.y + ux * out }, { x: base.x + uy * out, y: base.y - ux * out });
}
const lower = (p: Pt, q: Pt) => (p.y > q.y ? p : q);
const further = (p: Pt, q: Pt) => (p.x > q.x ? p : q);

const ARM = 13;
const SIDE_ARM = 12.5;

/** Where the hands are in a pose. */
function hands(view: View, p: Pose): Pt {
  const hip = { x: p.hipX, y: p.hipY };
  if (view === 'face') return add(add(hip, up(p.lean), 12), dir(p.a), ARM + 1.2);
  return add(add(hip, up(p.lean), 11.5), dir(p.a), SIDE_ARM);
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();
const line = (...pts: Pt[]) => 'M' + pts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ');
const shape = (...pts: Pt[]) => line(...pts) + ' Z';
const circle = (c: Pt, r: number) => `M${f(c.x - r)} ${f(c.y)} a ${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0 a ${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
/** The crown of a cap: a half circle over a head at c, tipped by `tilt` degrees. */
function crown(c: Pt, r: number, tilt: number) {
  const a = add(c, rot({ x: -r, y: -0.3 }, tilt));
  const b = add(c, rot({ x: r, y: -0.3 }, tilt));
  return `M${f(a.x)} ${f(a.y)} A ${f(r)} ${f(r * 1.04)} ${f(tilt)} 0 1 ${f(b.x)} ${f(b.y)} Z`;
}
function rot(v: Pt, d: number): Pt {
  const c = Math.cos(rad(d));
  const s = Math.sin(rad(d));
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/** Every part of the figure, as path data, in drawing order (back to front). */
export type Parts = Record<PartName, string>;
export type PartName =
  | 'farLeg'
  | 'nearLeg'
  | 'farShoe'
  | 'nearShoe'
  | 'seat'
  | 'torso'
  | 'farArm'
  | 'farSleeve'
  | 'shaft'
  | 'clubHead'
  | 'nearArm'
  | 'nearSleeve'
  | 'grip'
  | 'head'
  | 'cap'
  | 'brim';

export interface Rig {
  view: View;
  /** The ball's centre in the golfer's units (x is 0). */
  ball: Pt;
  /** Club length, set so it reaches the ball at address. */
  club: number;
  /** Clubhead size: a driver is bigger than an iron. */
  headSize: number;
}

export function rig(view: View, ballY: number, driver = false): Rig {
  const ball = { x: 0, y: ballY };
  const h = hands(view, view === 'face' ? FACE_ADDRESS : SIDE_ADDRESS);
  // The clubhead sits just behind the ball rather than on its centre.
  const club = Math.hypot(ball.x - h.x, ball.y - h.y) - (view === 'side' ? 1 : 0.6);
  return { view, ball, club, headSize: driver ? 1.6 : 1 };
}

/** The figure in one pose. */
function draw(r: Rig, p: Pose): Parts {
  return r.view === 'face' ? drawFace(r, p) : drawSide(r, p);
}

function clubAngle(r: Rig, p: Pose, h: Pt) {
  return p.c ?? angleTo(h, r.ball);
}

function drawFace(r: Rig, p: Pose): Parts {
  const hip = { x: p.hipX, y: p.hipY };
  // Trail foot on the left (away from the target), rolling onto its toe through the finish.
  const trailFoot = mix({ x: -5.5, y: -4.5 }, { x: -3.6, y: -5.4 }, p.heel);
  const leadFoot = { x: 5.5, y: -4.5 };
  const trailHip = add(hip, { x: -2.7, y: 0 });
  const leadHip = add(hip, { x: 2.7, y: 0 });
  const inward = (q: Pt, s: Pt) => (Math.abs(q.x - hip.x) < Math.abs(s.x - hip.x) ? q : s);
  const trailKnee = joint(trailFoot, trailHip, 8.8, 8.8, inward);
  const leadKnee = joint(leadFoot, leadHip, 8.8, 8.8, inward);
  const neck = add(hip, up(p.lean), 12);
  const w = 4.4 * p.span;
  const trailShoulder = add(neck, { x: -w, y: 1.2 });
  const leadShoulder = add(neck, { x: w, y: 1.2 });
  const h = hands('face', p);
  const trailElbow = joint(trailShoulder, h, 6.8, 6.8, lower);
  const leadElbow = joint(leadShoulder, h, 6.8, 6.8, lower);
  const c = clubAngle(r, p, h);
  const tip = add(h, dir(c), r.club);
  const head = add(neck, up(p.lean * 0.5), 3.9);
  const look = { x: p.look * 1.5, y: 0 };
  const shoe = (q: Pt, lift: number) => line(add(q, { x: -1.6 + lift * 1.2, y: 0.4 }), add(q, { x: 1.6 - lift * 0.4, y: 0.4 + lift * 0.2 }));
  return {
    farLeg: line(leadFoot, leadKnee, leadHip),
    nearLeg: line(trailFoot, trailKnee, trailHip),
    farShoe: shoe(leadFoot, 0),
    nearShoe: shoe(trailFoot, p.heel),
    seat: line(trailHip, leadHip),
    torso: shape(add(hip, { x: -3.4, y: 0.4 }), trailShoulder, leadShoulder, add(hip, { x: 3.4, y: 0.4 })),
    farArm: line(trailShoulder, trailElbow, h),
    farSleeve: line(trailShoulder, mix(trailShoulder, trailElbow, 0.5)),
    shaft: line(h, tip),
    clubHead: line(tip, add(tip, dir(c - 90), 1.8 * r.headSize)),
    nearArm: line(leadShoulder, leadElbow, h),
    nearSleeve: line(leadShoulder, mix(leadShoulder, leadElbow, 0.5)),
    grip: line(h, add(h, dir(c), 2.4)),
    head: circle(add(head, look), 3.3),
    cap: crown(add(head, look), 3.5, 0),
    brim: line(add(head, { x: -2.3 + p.look * 2.6, y: -0.7 }), add(head, { x: 2.3 + p.look * 2.9, y: -0.7 })),
  };
}

function drawSide(r: Rig, p: Pose): Parts {
  const hip = { x: p.hipX, y: p.hipY };
  // The far foot is the lead foot; the near (trail) foot rolls up onto its toe.
  const farFoot = { x: -18.4, y: -0.8 };
  const toe = { x: -16.4, y: 0.4 };
  const nearFoot = mix({ x: -19, y: 0.4 }, add(toe, { x: -1.2, y: -2.4 }), p.heel);
  const farKnee = joint(farFoot, add(hip, { x: 0.6, y: -0.4 }), 9.6, 9.6, further);
  const nearKnee = joint(nearFoot, hip, 9.6, 9.6, further);
  const neck = add(hip, up(p.lean), 13);
  const shoulder = add(hip, up(p.lean), 11.5);
  const h = hands('side', p);
  const farShoulder = add(shoulder, { x: 0.9, y: -0.5 });
  const nearElbow = joint(shoulder, h, 6.4, 6.4, lower);
  const farElbow = joint(farShoulder, h, 6.4, 6.4, lower);
  const c = clubAngle(r, p, h);
  const tip = add(h, dir(c), r.club);
  // Looking down at the ball, then up the fairway after it.
  const tilt = 34 * (1 - p.look) - 10 * p.look;
  const head = add(neck, up(p.lean + tilt * 0.6), 3.7);
  const heel = add(toe, rot({ x: -4.2, y: 0 }, 55 * p.heel));
  return {
    farLeg: line(farFoot, farKnee, add(hip, { x: 0.6, y: -0.4 })),
    nearLeg: line(nearFoot, nearKnee, hip),
    farShoe: line(add(farFoot, { x: -1.6, y: 0 }), add(farFoot, { x: 2.6, y: 0 })),
    nearShoe: line(heel, toe),
    seat: line(hip, add(hip, up(p.lean), 0.1)),
    torso: line(add(hip, up(p.lean), 1.2), neck),
    farArm: line(farShoulder, farElbow, h),
    farSleeve: line(farShoulder, mix(farShoulder, farElbow, 0.5)),
    shaft: line(h, tip),
    clubHead: line(tip, add(tip, dir(c - 72), 1.8 * r.headSize)),
    nearArm: line(shoulder, nearElbow, h),
    nearSleeve: line(shoulder, mix(shoulder, nearElbow, 0.5)),
    grip: line(h, add(h, dir(c), 2.4)),
    head: circle(head, 3.3),
    cap: crown(head, 3.5, tilt),
    brim: line(add(head, rot({ x: 2, y: -0.6 }, tilt)), add(head, rot({ x: 6, y: 0 }, tilt))),
  };
}

// ── Timeline ─────────────────────────────────────────────────────────────────

const FPS = 40;

function ease(e: Ease, u: number, club: boolean) {
  if (e === 'hold') return 0;
  if (e === 'in') return club ? u * u * u : u * u;
  if (e === 'out') return 1 - (1 - u) * (1 - u);
  return u * u * (3 - 2 * u);
}

/** The pose at time t (seconds from the start of the swing). */
function poseAt(r: Rig, ks: Key[], t: number): Pose {
  const i = ks.findIndex((k) => k.t >= t);
  if (i <= 0) return resolve(r, ks[i === 0 ? 0 : ks.length - 1].pose);
  const a = resolve(r, ks[i - 1].pose);
  const b = resolve(r, ks[i].pose);
  const u = (t - ks[i - 1].t) / (ks[i].t - ks[i - 1].t);
  const body = ease(ks[i].ease, u, false);
  // The club lags the arms coming down, then releases through the ball.
  const club = ease(ks[i].ease, u, true);
  const m = (x: number, y: number, k = body) => x + (y - x) * k;
  return {
    a: m(a.a, b.a),
    c: m(a.c!, b.c!, club),
    lean: m(a.lean, b.lean),
    hipX: m(a.hipX, b.hipX),
    hipY: m(a.hipY, b.hipY),
    span: m(a.span, b.span),
    heel: m(a.heel, b.heel),
    look: m(a.look, b.look),
  };
}

/** Fills in the club angle for poses that point it at the ball. */
function resolve(r: Rig, p: Pose): Pose {
  return p.c == null ? { ...p, c: angleTo(hands(r.view, p), r.ball) } : p;
}

/** The figure at address, at impact and holding the finish (for stills and tests). */
export function pose(r: Rig, swing: Swing, at: 'address' | 'impact' | 'finish'): Parts {
  const ks = keys(r.view, swing);
  return draw(r, poseAt(r, ks, at === 'address' ? 0 : at === 'impact' ? impactAt(swing) : swingLength(swing)));
}

/** Where the clubhead is at a moment (for tests). */
export function clubTip(r: Rig, swing: Swing, t: number): Pt {
  const p = poseAt(r, keys(r.view, swing), t);
  const h = hands(r.view, p);
  return add(h, dir(p.c!), r.club);
}

/** Path data for every part, frame by frame, as SMIL value lists. */
export function swingTracks(r: Rig, swing: Swing): { values: Parts; duration: number } {
  const ks = keys(r.view, swing);
  const duration = swingLength(swing);
  const steps = Math.round(duration * FPS);
  const frames = Array.from({ length: steps + 1 }, (_, i) => draw(r, poseAt(r, ks, (i / steps) * duration)));
  const values = {} as Parts;
  for (const k of Object.keys(frames[0]) as PartName[]) values[k] = frames.map((fr) => fr[k]).join(';');
  return { values, duration };
}
