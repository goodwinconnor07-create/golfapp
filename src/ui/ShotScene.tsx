import { useEffect, useId, useState, type ReactNode } from 'react';
import { haptic, reducedMotion } from './effects';
import { PuttScene } from './PuttScene';
import type { ShotArt } from './shotArt';

// Illustration colours (grass, sand, water, ball, flag, paper) are part of the drawings, not UI tokens.

const FONT = '-apple-system, system-ui, sans-serif';
const HAND = "'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive";

/**
 * The short scene at the top of a card. Plays once after the card flips (tap to replay), then
 * settles on a still that explains the card, with its tag. Reduce Motion shows the still.
 */
export function ShotScene({ art, par = 4, delay = 0.35 }: { art: ShotArt; par?: number; delay?: number }) {
  if (art.kind === 'putt') return <PuttScene feet={art.feet} two={art.two} tag={art.tag} delay={delay} />;
  return <Scene art={art} par={par} delay={delay} />;
}

function Scene({ art, par, delay }: { art: ShotArt; par: number; delay: number }) {
  const uid = useId().replace(/:/g, '');
  const [run, setRun] = useState(0);
  const still = reducedMotion();
  const id = (n: string) => `${n}-${uid}`;
  const plan = PLANS[art.kind as Exclude<ShotArt['kind'], 'putt'>](art, par);
  const done = delay + plan.duration;

  // A light tap on the phone as the ball lands (or the score is circled).
  useEffect(() => {
    if (still) return;
    const timer = setTimeout(() => haptic('light'), (delay + plan.landAt) * 1000);
    return () => clearTimeout(timer);
  }, [run, still, delay, plan.landAt]);

  const ctx: Ctx = { id, still, delay, done, art, par };
  return (
    <button
      type="button"
      className="putt-scene"
      aria-label={`Animation: ${plan.label}${art.tag ? `, ${art.tag}` : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        setRun((n) => n + 1);
      }}
    >
      <svg key={run} viewBox="0 0 340 144" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <Defs id={id} />
        {plan.draw(ctx)}
        {art.tag && <Pill ctx={ctx} x={12} y={10} text={art.tag} at={plan.duration + 0.2} />}
      </svg>
    </button>
  );
}

interface Ctx {
  id: (n: string) => string;
  still: boolean;
  delay: number;
  /** Seconds from mount until the scene has settled. */
  done: number;
  art: ShotArt;
  par: number;
}

interface Plan {
  label: string;
  /** Seconds of motion after the delay. */
  duration: number;
  /** When the ball lands or the mark is made, for the haptic. */
  landAt: number;
  draw: (c: Ctx) => ReactNode;
}

// ── Timing helpers ───────────────────────────────────────────────────────────

/** SMIL attributes for a move that waits for the delay, then runs: the object sits at the start meanwhile. */
function held(c: Ctx, start: number, dur: number, spline = '0.25 0.1 0.25 1') {
  const total = c.delay + start + dur;
  const at = ((c.delay + start) / total).toFixed(3);
  return {
    begin: '0s',
    dur: `${total}s`,
    keyPoints: '0;0;1',
    keyTimes: `0;${at};1`,
    calcMode: 'spline' as const,
    keySplines: `0 0 1 1;${spline}`,
    fill: 'freeze' as const,
  };
}

const at = (c: Ctx, s: number) => `${(c.delay + s).toFixed(2)}s`;

/** Fades something in at a moment in the scene (or shows it straight away in a still). */
function FadeIn({ c, s, children, dur = 0.25 }: { c: Ctx; s: number; children: ReactNode; dur?: number }) {
  return (
    <g opacity={c.still ? 1 : 0}>
      {!c.still && <animate attributeName="opacity" to="1" begin={at(c, s)} dur={`${dur}s`} fill="freeze" />}
      {children}
    </g>
  );
}

// ── Shared pieces ────────────────────────────────────────────────────────────

function Defs({ id }: { id: (n: string) => string }) {
  return (
    <defs>
      <linearGradient id={id('rough')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2a6a2c" />
        <stop offset="1" stopColor="#3b8a39" />
      </linearGradient>
      <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#9fd6f5" />
        <stop offset="1" stopColor="#e4f5fc" />
      </linearGradient>
      <linearGradient id={id('ground')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7fb873" />
        <stop offset="0.35" stopColor="#4b9443" />
        <stop offset="1" stopColor="#2c752e" />
      </linearGradient>
      <linearGradient id={id('haze')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#eef8f2" stopOpacity="0.55" />
        <stop offset="1" stopColor="#eef8f2" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={id('fairway')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5fae4c" />
        <stop offset="1" stopColor="#74c45c" />
      </linearGradient>
      <radialGradient id={id('green')} cx="55%" cy="40%" r="70%">
        <stop offset="0" stopColor="#8adb72" />
        <stop offset="0.6" stopColor="#5cb84f" />
        <stop offset="1" stopColor="#3f9a40" />
      </radialGradient>
      <pattern id={id('stripes')} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
        <rect width="20" height="40" fill="#ffffff" opacity="0.07" />
      </pattern>
      <pattern id={id('bands')} width="340" height="22" patternUnits="userSpaceOnUse">
        <rect width="340" height="11" fill="#ffffff" opacity="0.07" />
      </pattern>
      <filter id={id('grain')} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="5" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.25  0 0 0 0 0.08  0 0 0 0.32 0" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <radialGradient id={id('sand')} cx="45%" cy="40%" r="70%">
        <stop offset="0" stopColor="#fbefc9" />
        <stop offset="0.7" stopColor="#ecd59a" />
        <stop offset="1" stopColor="#cdb06c" />
      </radialGradient>
      <linearGradient id={id('water')} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#5ec3f0" />
        <stop offset="1" stopColor="#1f6fb8" />
      </linearGradient>
      <radialGradient id={id('cup')} cx="50%" cy="35%" r="65%">
        <stop offset="0" stopColor="#050806" />
        <stop offset="0.7" stopColor="#13201a" />
        <stop offset="1" stopColor="#2a3b2f" />
      </radialGradient>
      <radialGradient id={id('ball')} cx="34%" cy="30%" r="75%">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.55" stopColor="#f1f3f6" />
        <stop offset="1" stopColor="#b9c0cb" />
      </radialGradient>
      <linearGradient id={id('pin')} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#9aa3ad" />
        <stop offset="0.5" stopColor="#ffffff" />
        <stop offset="1" stopColor="#7d8692" />
      </linearGradient>
      <linearGradient id={id('flag')} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ff5a6e" />
        <stop offset="1" stopColor="#c8102e" />
      </linearGradient>
      <radialGradient id={id('tree')} cx="35%" cy="30%" r="70%">
        <stop offset="0" stopColor="#3f8f3b" />
        <stop offset="1" stopColor="#1b4d22" />
      </radialGradient>
      <linearGradient id={id('paper')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fffdf7" />
        <stop offset="1" stopColor="#f6efdc" />
      </linearGradient>
      <linearGradient id={id('pencil')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffd84d" />
        <stop offset="0.5" stopColor="#f5b800" />
        <stop offset="1" stopColor="#c98f00" />
      </linearGradient>
      <filter id={id('soft')} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
      <filter id={id('shadow')} x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#1b2a12" floodOpacity="0.35" />
      </filter>
    </defs>
  );
}

/** spin: the dimples turn (the light stays put), easing out like the ball does. Negative = backspin. */
function Ball({ c, r = 6.5, spin }: { c: Ctx; r?: number; spin?: { begin: string; dur: number; turns: number } }) {
  const k = r / 7;
  return (
    <g transform={`scale(${k})`}>
      <circle r="7" fill={`url(#${c.id('ball')})`} />
      <g>
        {spin && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0"
            to={spin.turns * 360}
            calcMode="spline"
            keyTimes="0;1"
            keySplines="0.2 0.6 0.35 1"
            begin={spin.begin}
            dur={`${spin.dur}s`}
            fill="freeze"
          />
        )}
        <circle cx="-1.6" cy="1.4" r="0.8" fill="#9aa3ad" opacity="0.5" />
        <circle cx="1.8" cy="2.6" r="0.7" fill="#9aa3ad" opacity="0.45" />
        <circle cx="3.2" cy="-0.6" r="0.7" fill="#9aa3ad" opacity="0.4" />
        <circle cx="0.6" cy="-3.6" r="0.7" fill="#9aa3ad" opacity="0.4" />
        <circle cx="-3.6" cy="-0.4" r="0.6" fill="#9aa3ad" opacity="0.35" />
        <path d="M-5 2.6 A 5.6 5.6 0 0 0 4.6 3.4" fill="none" stroke="#9aa3ad" strokeOpacity="0.35" strokeWidth="0.8" />
      </g>
      <circle cx="-2.6" cy="-2.4" r="1.6" fill="#ffffff" opacity="0.9" />
    </g>
  );
}

function BallShadow({ c, r = 6.5 }: { c: Ctx; r?: number }) {
  return <ellipse cx="1.5" cy="2" rx={r * 1.05} ry={r * 0.38} fill="#0d3a15" fillOpacity="0.38" filter={`url(#${c.id('soft')})`} />;
}

function Flag({ c, x, y, h = 46 }: { c: Ctx; x: number; y: number; h?: number }) {
  const top = y - h;
  const f = (dx: number, dy: number) => `${x + 1.2 + dx} ${top + 2 + dy}`;
  const a = `M${f(0, 0)} C ${f(11, 2)}, ${f(20, -1)}, ${f(30, 5)} C ${f(21, 10)}, ${f(11, 10)}, ${f(0, 16)} Z`;
  const b = `M${f(0, 0)} C ${f(10, -3)}, ${f(21, 3)}, ${f(30, 3)} C ${f(22, 9)}, ${f(10, 12)}, ${f(0, 16)} Z`;
  return (
    <g>
      <path
        d={`M${x} ${y} L ${x + 48} ${y + 14}`}
        stroke="#0d3a15"
        strokeOpacity="0.22"
        strokeWidth="3"
        strokeLinecap="round"
        filter={`url(#${c.id('soft')})`}
      />
      <rect x={x - 1} y={top} width="2.2" height={h} rx="1.1" fill={`url(#${c.id('pin')})`} />
      <circle cx={x + 0.1} cy={top} r="1.8" fill="#ffffff" />
      <path d={a} fill={`url(#${c.id('flag')})`}>
        {!c.still && <animate attributeName="d" dur="1.6s" values={`${a};${b};${a}`} repeatDur={`${(c.done + 1).toFixed(2)}s`} />}
      </path>
    </g>
  );
}

function Cup({ c, x, y }: { c: Ctx; x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx="9" ry="4" fill={`url(#${c.id('cup')})`} />
      <ellipse cx={x} cy={y - 1} rx="9" ry="3.3" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="0.9" />
    </g>
  );
}

/** A dark pill with white text, for tags and distances. */
function Pill({
  ctx,
  x,
  y,
  text,
  at: s,
  anchor = 'start',
}: {
  ctx: Ctx;
  x: number;
  y: number;
  text: string;
  at: number;
  anchor?: 'start' | 'middle';
}) {
  const w = text.length * 7.1 + 20;
  const left = anchor === 'middle' ? x - w / 2 : x;
  return (
    <FadeIn c={ctx} s={s}>
      <rect x={left} y={y} width={w} height="24" rx="12" fill="#0b0b12" fillOpacity="0.74" />
      <text x={left + w / 2} y={y + 16.5} textAnchor="middle" fontSize="13" fontWeight="800" fill="#ffffff" fontFamily={FONT}>
        {text}
      </text>
    </FadeIn>
  );
}

function Trees({ c, spots }: { c: Ctx; spots: [number, number, number][] }) {
  return (
    <g>
      {spots.map(([x, y, r], i) => (
        <g key={i}>
          <ellipse
            cx={x + r * 0.5}
            cy={y + r * 0.8}
            rx={r * 1.1}
            ry={r * 0.45}
            fill="#0d2a10"
            fillOpacity="0.35"
            filter={`url(#${c.id('soft')})`}
          />
          <circle cx={x - r * 0.45} cy={y + r * 0.1} r={r * 0.7} fill={`url(#${c.id('tree')})`} />
          <circle cx={x + r * 0.45} cy={y + r * 0.15} r={r * 0.68} fill={`url(#${c.id('tree')})`} />
          <circle cx={x} cy={y - r * 0.3} r={r * 0.78} fill={`url(#${c.id('tree')})`} />
          <circle cx={x - r * 0.25} cy={y - r * 0.55} r={r * 0.3} fill="#5aa94f" opacity="0.45" />
        </g>
      ))}
    </g>
  );
}

/**
 * A ball in flight: it follows `air` (an arc above the ground) while its shadow follows `ground`,
 * then both roll along `roll` (relative). Grows a little at the top of the arc and shrinks with distance.
 */
function Flight({
  c,
  air,
  ground,
  roll,
  start,
  fly,
  rollFor,
  scale,
  r = 6.5,
  sinkAt,
  turns = 3,
}: {
  c: Ctx;
  air: string;
  ground: string;
  roll: string;
  start: number;
  fly: number;
  rollFor: number;
  scale: [number, number, number];
  r?: number;
  /** Hand over to the cup drop at this moment (relative to the scene start). */
  sinkAt?: number;
  /** Turns of the ball over the flight and roll; negative for backspin. */
  turns?: number;
}) {
  if (c.still) return null;
  const total = c.delay + start + fly;
  const a = ((c.delay + start) / total).toFixed(3);
  const mid = ((c.delay + start + fly * 0.45) / total).toFixed(3);
  const sc = { begin: '0s', dur: `${total}s`, fill: 'freeze' as const };
  const rollMove = {
    begin: at(c, start + fly),
    dur: `${rollFor}s`,
    fill: 'freeze' as const,
    calcMode: 'spline' as const,
    keyPoints: '0;1',
    keyTimes: '0;1',
    keySplines: '0.2 0.6 0.35 1',
  };
  // At the cup the dropping ball (CupDrop) takes over, so this one just goes.
  const sink = sinkAt != null && <animate attributeName="opacity" to="0" begin={at(c, sinkAt)} dur="0.01s" fill="freeze" />;
  return (
    <g>
      <g>
        <animateMotion path={ground} {...held(c, start, fly, '0.3 0.2 0.5 1')} />
        <g>
          <animateMotion path={roll} {...rollMove} />
          <g>
            {sink}
            <g>
              <animateTransform
                attributeName="transform"
                type="scale"
                values={`${scale[0]};${scale[0]};${scale[2]}`}
                keyTimes={`0;${a};1`}
                {...sc}
              />
              <BallShadow c={c} r={r} />
            </g>
          </g>
        </g>
      </g>
      <g>
        <animateMotion path={air} {...held(c, start, fly, '0.3 0.2 0.5 1')} />
        <g>
          <animateMotion path={roll} {...rollMove} />
          <g>
            {sink}
            <g>
              <animateTransform
                attributeName="transform"
                type="scale"
                values={`${scale[0]};${scale[0]};${scale[1]};${scale[2]}`}
                keyTimes={`0;${a};${mid};1`}
                {...sc}
              />
              <Ball c={c} r={r} spin={{ begin: at(c, start), dur: fly + rollFor, turns }} />
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

/** Where a ball rests in the still (and after the motion, for scenes that don't animate it there). */
function RestingBall({ c, x, y, r = 6.5, s }: { c: Ctx; x: number; y: number; r?: number; s: number }) {
  // With motion the moving ball stays where it stopped; only the still needs one drawn.
  if (!c.still) return null;
  void s;
  return (
    <g transform={`translate(${x} ${y})`}>
      <BallShadow c={c} r={r} />
      <Ball c={c} r={r} />
    </g>
  );
}

/**
 * The ball dropping into the hole. The clip is everything above the cup's middle plus the inside of
 * its front half, so the front lip hides the ball as it falls instead of the ball sliding across it.
 * It comes to rest with just its top showing.
 */
function CupDrop({ c, x, y, s, r = 5 }: { c: Ctx; x: number; y: number; s: number; r?: number }) {
  const rx = 9;
  const ry = 4;
  return (
    <g>
      <clipPath id={c.id('in-cup')}>
        <path d={`M${x - rx} 0 H ${x + rx} V ${y} A ${rx} ${ry} 0 0 1 ${x - rx} ${y} Z`} />
      </clipPath>
      <g clipPath={`url(#${c.id('in-cup')})`} opacity={c.still ? 1 : 0}>
        {!c.still && <animate attributeName="opacity" to="1" begin={at(c, s)} dur="0.01s" fill="freeze" />}
        <g transform={c.still ? `translate(0 ${r * 0.9})` : undefined}>
          {!c.still && (
            <>
              <animateTransform
                attributeName="transform"
                type="translate"
                values={`0 -1;0.6 ${r * 0.4};0 ${r * 0.9}`}
                keyTimes="0;0.5;1"
                calcMode="spline"
                keySplines="0.5 0 1 1;0.2 0 0.4 1"
                begin={at(c, s)}
                dur="0.24s"
                fill="freeze"
              />
            </>
          )}
          <circle cx={x} cy={y} r={r} fill={`url(#${c.id('ball')})`} />
          <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.22} fill="#ffffff" opacity="0.9" />
        </g>
      </g>
      {/* Front lip, drawn over the ball. */}
      <path d={`M${x - rx} ${y} A ${rx} ${ry} 0 0 0 ${x + rx} ${y}`} fill="none" stroke="#7fcf6c" strokeWidth="1.2" />
    </g>
  );
}

function Ripple({ c, x, y, s }: { c: Ctx; x: number; y: number; s: number }) {
  if (c.still) return null;
  return (
    <ellipse cx={x} cy={y} rx="9" ry="4" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0">
      <animate attributeName="opacity" values="0.8;0" begin={at(c, s)} dur="0.7s" fill="freeze" />
      <animate attributeName="rx" values="9;30" begin={at(c, s)} dur="0.7s" fill="freeze" />
      <animate attributeName="ry" values="4;12" begin={at(c, s)} dur="0.7s" fill="freeze" />
    </ellipse>
  );
}

// ── Terrain: down the fairway from the tee ───────────────────────────────────

// Looking down the hole from the tee: sky and a hazy tree line at the horizon, a fairway that
// narrows hard into the distance with mowing stripes that tighten as they go, smaller trees further
// back and big ones framing the near corners.
const HORIZON = 34;
const FAIRWAY = `M96 150 C 150 110, 192 64, 206 ${HORIZON} L 230 ${HORIZON} C 236 64, 246 110, 276 150 Z`;

/** A point on the left edge of the fairway, t = 0 at the tee and 1 at the horizon. */
function leftEdge(t: number): [number, number] {
  const u = 1 - t;
  const x = u ** 3 * 96 + 3 * u * u * t * 150 + 3 * u * t * t * 192 + t ** 3 * 206;
  const y = u ** 3 * 150 + 3 * u * u * t * 110 + 3 * u * t * t * 64 + t ** 3 * HORIZON;
  return [x, y];
}

function TeeView({ c, hazard }: { c: Ctx; hazard?: ShotArt['hazard'] }) {
  const stakes = hazard === 'stakes' || hazard === 'both';
  const water = hazard === 'water' || hazard === 'both';
  // Mowing stripes: bands that get thinner toward the horizon.
  const bands = Array.from({ length: 10 }, (_, k) => {
    const y0 = HORIZON + 116 * (k / 10) ** 1.9;
    const y1 = HORIZON + 116 * ((k + 1) / 10) ** 1.9;
    return { y0, y1, on: k % 2 === 0 };
  });
  return (
    <g>
      {/* Sky. */}
      <rect width="340" height={HORIZON + 2} fill={`url(#${c.id('sky')})`} />
      {/* Distant hills and a tree line, softened by haze. */}
      <path
        d={`M0 ${HORIZON} C 40 20, 84 24, 124 29 C 168 18, 222 16, 262 26 C 292 20, 322 22, 340 28 L 340 ${HORIZON + 2} L 0 ${HORIZON + 2} Z`}
        fill="#8dbf9d"
        opacity="0.75"
      />
      {Array.from({ length: 34 }, (_, i) => (
        <ellipse
          key={i}
          cx={i * 10.4 + ((i * 7) % 5)}
          cy={HORIZON - 2 - ((i * 13) % 4)}
          rx={6 + ((i * 5) % 4)}
          ry={4 + ((i * 3) % 3)}
          fill="#4f8a57"
          opacity="0.85"
        />
      ))}
      {/* Ground: hazy at the horizon, rich up close. */}
      <rect y={HORIZON} width="340" height={144 - HORIZON} fill={`url(#${c.id('ground')})`} />
      <rect y={HORIZON} width="340" height={144 - HORIZON} fill="#000" filter={`url(#${c.id('grain')})`} />
      {/* Fairway with stripes. */}
      <path d={FAIRWAY} fill={`url(#${c.id('fairway')})`} />
      <clipPath id={c.id('fw')}>
        <path d={FAIRWAY} />
      </clipPath>
      <g clipPath={`url(#${c.id('fw')})`}>
        {bands.map((b, k) => b.on && <rect key={k} y={b.y0} width="340" height={b.y1 - b.y0} fill="#ffffff" opacity="0.09" />)}
        <path d={FAIRWAY} fill="#000" filter={`url(#${c.id('grain')})`} />
      </g>
      {/* The green at the end, with its flag. */}
      <ellipse cx="218" cy={HORIZON + 1.5} rx="15" ry="3.4" fill="#8ede76" />
      <rect x="220.2" y={HORIZON - 8} width="0.9" height="9" fill="#ffffff" />
      <path d={`M221.1 ${HORIZON - 8} l 5 1.4 l -5 1.4 Z`} fill="#e11d48" />
      {/* Trees: small and pale far away, big and dark up close. */}
      <Trees
        c={c}
        spots={[
          [150, 44, 6],
          [127, 58, 9],
          [92, 82, 14],
          [266, 44, 6],
          [292, 60, 10],
          [326, 86, 15],
        ]}
      />
      {/* Haze over the distance. */}
      <rect y={HORIZON} width="340" height="60" fill={`url(#${c.id('haze')})`} />
      <Trees
        c={c}
        spots={[
          [-4, 126, 40],
          [348, 122, 38],
        ]}
      />
      {water && (
        <g>
          <path
            d="M262 74 C 280 64, 334 64, 346 76 L 346 98 C 320 104, 280 100, 262 88 C 254 84, 254 78, 262 74 Z"
            fill={`url(#${c.id('water')})`}
          />
          <path d="M262 74 C 280 64, 334 64, 346 76" fill="none" stroke="#c9eeff" strokeOpacity="0.6" strokeWidth="1.2" />
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${278 + i * 18} ${80 + i * 5} q 7 -2 14 0`}
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.5"
              strokeWidth="1"
              strokeLinecap="round"
            >
              {!c.still && (
                <animate
                  attributeName="stroke-opacity"
                  values="0.5;0.1;0.5"
                  dur={`${2 + i * 0.4}s`}
                  repeatDur={`${(c.done + 1).toFixed(2)}s`}
                />
              )}
            </path>
          ))}
        </g>
      )}
      {stakes &&
        [0.04, 0.2, 0.36, 0.52, 0.68, 0.84].map((t, i) => {
          // White stakes down the left, shrinking with distance.
          const [ex, ey] = leftEdge(t);
          const x = ex - 12 * (1 - t) - 2;
          const h = 20 * (1 - t) ** 1.3 + 3;
          const w = 3.4 * (1 - t) + 1;
          return (
            <g key={i}>
              <ellipse cx={x + w} cy={ey} rx={w * 1.2} ry={w * 0.35} fill="#0d2a10" opacity="0.35" />
              <rect x={x - w / 2} y={ey - h} width={w} height={h} rx={w * 0.3} fill="#ffffff" />
            </g>
          );
        })}
      {/* Tee box and markers. */}
      <path d="M150 128 L 222 128 L 230 146 L 142 146 Z" fill="#8ad472" opacity="0.65" />
      <circle cx="156" cy="133" r="3.4" fill="#e11d48" />
      <circle cx="216" cy="133" r="3.4" fill="#e11d48" />
    </g>
  );
}

// ── Terrain: the green, from the approach ────────────────────────────────────

const CUP = { x: 252, y: 58 };
const GREEN = { cx: 240, cy: 64, rx: 86, ry: 32 };
const BUNKER = 'M128 100 C 120 88, 142 78, 166 81 C 186 84, 190 96, 176 103 C 158 110, 136 108, 128 100 Z';

function GreenView({ c, bunker = true }: { c: Ctx; bunker?: boolean }) {
  return (
    <g>
      <rect width="340" height="144" fill={`url(#${c.id('rough')})`} />
      <rect width="340" height="144" fill="#000" filter={`url(#${c.id('grain')})`} />
      <Trees
        c={c}
        spots={[
          [30, 20, 22],
          [76, 6, 14],
          [330, 120, 22],
        ]}
      />
      {/* Fairway running up to the front of the green. */}
      <path d="M-10 150 L 118 150 C 148 128, 172 104, 196 86 L 168 78 C 120 92, 60 116, -10 126 Z" fill={`url(#${c.id('fairway')})`} />
      <path d="M-10 150 L 118 150 C 148 128, 172 104, 196 86 L 168 78 C 120 92, 60 116, -10 126 Z" fill={`url(#${c.id('stripes')})`} />
      {/* Fringe, then the green. */}
      <ellipse cx={GREEN.cx} cy={GREEN.cy} rx={GREEN.rx + 7} ry={GREEN.ry + 5} fill="#4c9f43" />
      <ellipse {...GREEN} fill={`url(#${c.id('green')})`} />
      <ellipse {...GREEN} fill={`url(#${c.id('stripes')})`} />
      <ellipse {...GREEN} fill="#000" filter={`url(#${c.id('grain')})`} />
      {bunker && (
        <g>
          <path d={BUNKER} fill={`url(#${c.id('sand')})`} />
          {/* The lip: a shadow along the top edge. */}
          <path
            d="M128 100 C 120 88, 142 78, 166 81 C 186 84, 190 96, 176 103"
            fill="none"
            stroke="#8b7a3e"
            strokeOpacity="0.45"
            strokeWidth="2.4"
          />
          <path d={BUNKER} fill="#000" opacity="0.06" filter={`url(#${c.id('grain')})`} />
        </g>
      )}
      <Cup c={c} x={CUP.x} y={CUP.y} />
    </g>
  );
}

/** A ring around the flag showing how close the ball has to finish. */
function Ring({ c, feet }: { c: Ctx; feet: number }) {
  const rx = 10 + feet * 1.25;
  const ry = rx * 0.42;
  return (
    <g>
      <ellipse
        cx={CUP.x}
        cy={CUP.y}
        rx={rx}
        ry={ry}
        fill="#ffffff"
        fillOpacity="0.1"
        stroke="#ffffff"
        strokeOpacity="0.85"
        strokeWidth="1.6"
        strokeDasharray="3 4"
      />
      <Pill ctx={c} x={CUP.x - rx - 4} y={CUP.y + ry + 2} text={`${feet} ft`} at={0} anchor="middle" />
    </g>
  );
}

// ── Scenes ───────────────────────────────────────────────────────────────────

const PLANS: Record<Exclude<ShotArt['kind'], 'putt'>, (art: ShotArt, par: number) => Plan> = {
  drive: (art) => ({
    label: art.metres ? `a ${art.metres} metre drive down the fairway` : 'a drive landing in the fairway',
    duration: 2.1,
    landAt: 1.5,
    draw: (c) => (
      <>
        <TeeView c={c} />
        {art.metres && <Pill ctx={c} x={262} y={48} text={`${art.metres} m`} at={1.6} anchor="middle" />}
        <Flight
          c={c}
          air="M186 136 Q 174 -40 216 64"
          ground="M186 136 L 216 64"
          roll="M0 0 L 2 -7"
          start={0}
          fly={1.5}
          rollFor={0.6}
          scale={[1.05, 1.15, 0.4]}
        />
        <RestingBall c={c} x={218} y={57} r={6.5 * 0.4} s={0} />
        {c.still && (
          <path
            d="M186 136 Q 174 -40 216 64"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.7"
            strokeWidth="1.6"
            strokeDasharray="1 6"
            strokeLinecap="round"
          />
        )}
      </>
    ),
  }),

  trouble: (art) => ({
    label:
      art.hazard === 'water'
        ? 'a drive staying clear of the water'
        : art.hazard === 'stakes'
          ? 'a drive staying inside the white stakes'
          : 'a drive staying clear of trouble',
    duration: 2.1,
    landAt: 1.5,
    draw: (c) => (
      <>
        <TeeView c={c} hazard={art.hazard} />
        <Flight
          c={c}
          air="M186 136 Q 192 -30 218 66"
          ground="M186 136 L 218 66"
          roll="M0 0 L 1 -7"
          start={0}
          fly={1.5}
          rollFor={0.6}
          scale={[1.05, 1.15, 0.42]}
        />
        <RestingBall c={c} x={219} y={59} r={6.5 * 0.42} s={0} />
        {c.still && (
          <path
            d="M186 136 Q 192 -30 218 66"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.7"
            strokeWidth="1.6"
            strokeDasharray="1 6"
            strokeLinecap="round"
          />
        )}
      </>
    ),
  }),

  approach: (art) => {
    // Finish inside the ring (or just on the green when there's no distance).
    const stop = art.feet ? { x: CUP.x - 4 - art.feet * 0.35, y: CUP.y + 3 } : { x: 226, y: 70 };
    return {
      label: art.feet ? `an approach finishing within ${art.feet} feet of the hole` : 'an approach landing on the green',
      duration: 2.2,
      landAt: 1.3,
      draw: (c) => (
        <>
          <GreenView c={c} />
          {art.feet && <Ring c={c} feet={art.feet} />}
          <Flag c={c} x={CUP.x} y={CUP.y} />
          <Flight
            c={c}
            air={`M20 160 Q 110 -40 ${stop.x - 14} ${stop.y + 6}`}
            ground={`M20 160 L ${stop.x - 14} ${stop.y + 6}`}
            // Backspin: it lands, skips on past the target, then checks back.
            roll="M0 0 L 24 -10 L 14 -6"
            start={0}
            fly={1.3}
            rollFor={0.8}
            scale={[1.4, 1.6, 0.75]}
            turns={-2}
          />
          <RestingBall c={c} x={stop.x} y={stop.y} r={6.5 * 0.75} s={0} />
        </>
      ),
    };
  },

  bunker: (art) => {
    if (art.miss) {
      return {
        label: 'an approach carrying the bunker onto the green',
        duration: 2,
        landAt: 1.3,
        draw: (c) => (
          <>
            <GreenView c={c} />
            <Flag c={c} x={CUP.x} y={CUP.y} />
            <Flight
              c={c}
              air="M60 160 Q 130 -30 214 72"
              ground="M60 160 L 214 72"
              roll="M0 0 L 16 -6"
              start={0}
              fly={1.3}
              rollFor={0.6}
              scale={[1.3, 1.55, 0.75]}
            />
            <RestingBall c={c} x={230} y={66} r={6.5 * 0.75} s={0} />
          </>
        ),
      };
    }
    return {
      label: 'a splash out of the bunker onto the green',
      duration: 2.1,
      landAt: 1.1,
      draw: (c) => (
        <>
          <GreenView c={c} />
          <Flag c={c} x={CUP.x} y={CUP.y} />
          <Spray c={c} x={154} y={96} s={0} />
          {/* Sits in the sand until the splash, then flies. */}
          {c.still ? (
            <RestingBall c={c} x={240} y={62} r={6.5 * 0.75} s={0} />
          ) : (
            <Flight
              c={c}
              air="M154 96 Q 190 6 226 66"
              ground="M154 96 L 226 66"
              roll="M0 0 L 14 -4"
              start={0.05}
              fly={1.05}
              rollFor={0.7}
              scale={[1, 1.25, 0.75]}
            />
          )}
        </>
      ),
    };
  },

  chip: (art) => ({
    label: art.holeOut ? 'a chip from off the green rolling into the hole' : 'a chip from off the green onto it',
    duration: art.holeOut ? 2.2 : 1.9,
    landAt: art.holeOut ? 2.0 : 0.7,
    draw: (c) => {
      const end = art.holeOut ? { x: CUP.x, y: CUP.y } : { x: 230, y: 66 };
      return (
        <>
          <GreenView c={c} bunker={false} />
          <Flag c={c} x={CUP.x} y={CUP.y} />
          {c.still ? (
            art.holeOut ? null : (
              <RestingBall c={c} x={end.x} y={end.y} r={5} s={0} />
            )
          ) : (
            <Flight
              c={c}
              air="M150 108 Q 172 66 194 80"
              ground="M150 108 L 194 80"
              roll={`M0 0 L ${end.x - 194} ${end.y - 80}`}
              start={0}
              fly={0.7}
              rollFor={art.holeOut ? 1.3 : 1.0}
              scale={[1, 1.15, 0.8]}
              sinkAt={art.holeOut ? 2.0 : undefined}
              turns={5}
            />
          )}
          {art.holeOut && (
            <>
              <CupDrop c={c} x={CUP.x} y={CUP.y} s={2.0} r={5.2} />
              <Ripple c={c} x={CUP.x} y={CUP.y} s={2.0} />
            </>
          )}
        </>
      );
    },
  }),

  score: (art, par) => ({
    label: `a scorecard marked ${scoreName(art.toPar ?? 0)}`,
    duration: 1.9,
    landAt: 1.5,
    draw: (c) => <Scorecard c={c} par={par} toPar={art.toPar ?? 0} />,
  }),
};

/** Sand thrown up as the ball splashes out. */
function Spray({ c, x, y, s }: { c: Ctx; x: number; y: number; s: number }) {
  const bits = [
    [-26, -22, 3],
    [-14, -34, 2.4],
    [0, -40, 3.2],
    [14, -32, 2.6],
    [26, -18, 2.2],
    [-6, -26, 2],
    [8, -20, 2.4],
  ];
  return (
    <g>
      {/* The splash mark left in the sand. */}
      <ellipse cx={x} cy={y + 1} rx="9" ry="3.2" fill="#b89a55" opacity={c.still ? 0.6 : 0}>
        {!c.still && <animate attributeName="opacity" to="0.6" begin={at(c, s)} dur="0.2s" fill="freeze" />}
      </ellipse>
      {!c.still &&
        bits.map(([dx, dy, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#f1dfa6" opacity="0">
            <animate attributeName="cx" values={`${x};${x + dx}`} begin={at(c, s)} dur="0.6s" fill="freeze" />
            <animate attributeName="cy" values={`${y};${y + dy};${y + dy * 0.4}`} begin={at(c, s)} dur="0.6s" fill="freeze" />
            <animate attributeName="opacity" values="0;1;0" begin={at(c, s)} dur="0.6s" fill="freeze" />
          </circle>
        ))}
    </g>
  );
}

function scoreName(toPar: number): string {
  return { [-2]: 'eagle', [-1]: 'birdie', 0: 'par', 1: 'bogey', 2: 'double bogey', 3: 'triple bogey' }[toPar] ?? `${toPar} over`;
}

/** A pencilled scorecard: the target score is written in, then marked the way golfers do. */
function Scorecard({ c, par, toPar }: { c: Ctx; par: number; toPar: number }) {
  const score = par + toPar;
  // Birdie: circled. Par: no mark. Bogey and worse: one square per stroke over (up to three).
  const box = (x: number, y: number, w: number, h: number, i: number) => {
    const p = `M${x - 29} ${y + 16} h ${w} v ${h} h ${-w} Z`;
    return <Stroke key={i} c={c} d={p} s={0.9 + i * 0.25} dur={0.35} />;
  };
  return (
    <g>
      <rect width="340" height="144" fill={`url(#${c.id('rough')})`} />
      <rect width="340" height="144" fill="#000" filter={`url(#${c.id('grain')})`} />
      <g transform="translate(22 6) scale(0.88) rotate(-3 170 84)" filter={`url(#${c.id('shadow')})`}>
        <rect x="76" y="36" width="188" height="102" rx="8" fill={`url(#${c.id('paper')})`} />
        {/* Header row and grid. */}
        <rect x="76" y="36" width="188" height="24" rx="8" fill="#1f6b3a" />
        <rect x="76" y="52" width="188" height="8" fill="#1f6b3a" />
        {['PAR', 'SCORE'].map((t, i) => (
          <text
            key={t}
            x={123 + i * 94}
            y="52.5"
            textAnchor="middle"
            fontSize="12"
            fontWeight="800"
            letterSpacing="1"
            fill="#ffffff"
            fontFamily={FONT}
          >
            {t}
          </text>
        ))}
        <path d="M170 60 V 138" stroke="#d9cfb4" strokeWidth="1.2" />
        <text x="123" y="114" textAnchor="middle" fontSize="36" fontWeight="800" fill="#2c3a2f" fontFamily={FONT}>
          {par}
        </text>
        {/* The score, written in pencil from left to right. */}
        <clipPath id={c.id('write')}>
          <rect x="187" y="66" width={c.still ? 60 : 0} height="70">
            {!c.still && <animate attributeName="width" to="60" begin={at(c, 0.2)} dur="0.55s" fill="freeze" />}
          </rect>
        </clipPath>
        <text x="217" y="118" textAnchor="middle" fontSize="44" fill="#2b2f3a" fontFamily={HAND} clipPath={`url(#${c.id('write')})`}>
          {score}
        </text>
        {toPar < 0 && <Stroke c={c} d="M217 74 C 239 74, 241 120, 217 122 C 195 122, 193 76, 219 76" s={0.9} dur={0.55} />}
        {toPar > 0 && [0, 1, 2].slice(0, Math.min(3, toPar)).map((i) => box(226 - i * 4, 62 - i * 4, 40 + i * 8, 44 + i * 8, i))}
      </g>
    </g>
  );
}

/** A pencil line that draws itself. */
function Stroke({ c, d, s, dur }: { c: Ctx; d: string; s: number; dur: number }) {
  return (
    <path
      d={d}
      fill="none"
      stroke="#2b2f3a"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength="1"
      strokeDasharray="1 1"
      strokeDashoffset={c.still ? 0 : 1}
      opacity="0.85"
    >
      {!c.still && <animate attributeName="stroke-dashoffset" to="0" begin={at(c, s)} dur={`${dur}s`} fill="freeze" />}
    </path>
  );
}
