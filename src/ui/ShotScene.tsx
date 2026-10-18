import { useEffect, useId, useState, type ReactNode } from 'react';
import { haptic, reducedMotion } from './effects';
import { Golfer } from './Golfer';
import { impactAt, type Swing, type View } from './golferPose';
import { PuttScene } from './PuttScene';
import type { ShotArt } from './shotArt';
import { simulate, tracks, type Leg, type Spot } from './shotPhysics';

// Illustration colours (grass, sand, water, ball, flag, paper) are part of the drawings, not UI tokens.

const FONT = '-apple-system, system-ui, sans-serif';
const HAND = "'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive";

/**
 * The short scene at the top of a card. Plays once after the card flips (tap to replay), then
 * settles on a still that explains the card, with its tag. Reduce Motion shows the still.
 */
export function ShotScene({ art, par = 4, delay = 0.35, vs }: { art: ShotArt; par?: number; delay?: number; vs?: VsLast }) {
  if (art.kind === 'putt') return <PuttScene feet={art.feet} two={art.two} ring={art.ring} tag={art.tag} delay={delay} />;
  return <Scene art={art} par={par} delay={delay} vs={vs} />;
}

/**
 * For cards judged against the player's last hole: the card's rule and that hole (null on the first
 * hole, or when they have no score for it), so the scorecard can show what this hole needs.
 */
export interface VsLast {
  by: number;
  first: number;
  last: { strokes: number; par: number } | null;
}

function Scene({ art, par, delay, vs }: { art: ShotArt; par: number; delay: number; vs?: VsLast }) {
  const uid = useId().replace(/:/g, '');
  const [run, setRun] = useState(0);
  const still = reducedMotion();
  const id = (n: string) => `${n}-${uid}`;
  const plan = PLANS[art.kind as Exclude<ShotArt['kind'], 'putt'>](art, par, vs);
  const tag = plan.tag ?? art.tag;
  // With a golfer in the scene, the ball waits for his swing: everything else runs from impact.
  const start = delay + (plan.lead ?? 0);
  const done = start + plan.duration;

  // A light tap on the phone as the ball lands (or the score is circled).
  useEffect(() => {
    if (still) return;
    const timer = setTimeout(() => haptic('light'), (start + plan.landAt) * 1000);
    return () => clearTimeout(timer);
  }, [run, still, start, plan.landAt]);

  const ctx: Ctx = { id, still, delay: start, done, art, par };
  return (
    <button
      type="button"
      className="putt-scene"
      aria-label={`Animation: ${plan.label}${tag ? `, ${tag}` : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        setRun((n) => n + 1);
      }}
    >
      <svg key={run} viewBox="0 0 340 144" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <Defs id={id} />
        {plan.draw(ctx)}
      </svg>
      {/* The tag arrives with the ball, so the card is explained the moment it lands. */}
      {tag && <SceneTag key={`tag-${run}`} text={tag} at={still ? 0 : start + plan.landAt} />}
    </button>
  );
}

/**
 * The card's tag ("par 3 tee shot"), pinned to the strip's top-left corner. It's outside the
 * drawing so it never gets cropped when the strip is shorter (small phones) or wider than the
 * picture. at: seconds from mount when it fades in.
 */
export function SceneTag({ text, at }: { text: string; at: number }) {
  return (
    <span className="scene-tag" style={{ animationDelay: `${at.toFixed(2)}s` }}>
      {text}
    </span>
  );
}

interface Ctx {
  id: (n: string) => string;
  still: boolean;
  /** When the ball is struck (seconds from mount); scene times count from here. */
  delay: number;
  /** Seconds from mount until the scene has settled. */
  done: number;
  art: ShotArt;
  par: number;
}

interface Plan {
  label: string;
  /** Overrides the card's tag (the last-hole cards work theirs out from the game). */
  tag?: string;
  /** Seconds the golfer swings before the club meets the ball (scene times count from impact). */
  lead?: number;
  /** Seconds of motion after the delay. */
  duration: number;
  /** When the ball lands or the mark is made, for the haptic. */
  landAt: number;
  draw: (c: Ctx) => ReactNode;
}

// ── Timing helpers ───────────────────────────────────────────────────────────

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
      <pattern id={id('grain')} width="7" height="5" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.5" fill="#103a10" opacity="0.2" />
        <circle cx="4.5" cy="3.4" r="0.45" fill="#103a10" opacity="0.16" />
        <circle cx="5.6" cy="0.9" r="0.4" fill="#ffffff" opacity="0.1" />
      </pattern>
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
      <linearGradient id={id('cut')} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4f9a45" />
        <stop offset="1" stopColor="#5aa84b" />
      </linearGradient>
      <radialGradient id={id('shade')}>
        <stop offset="0" stopColor="#0d3a15" />
        <stop offset="0.55" stopColor="#0d3a15" stopOpacity="0.7" />
        <stop offset="1" stopColor="#0d3a15" stopOpacity="0" />
      </radialGradient>
      <filter id={id('shadow')} x="-20%" y="-20%" width="140%" height="160%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#1b2a12" floodOpacity="0.35" />
      </filter>
    </defs>
  );
}

const BALL_R = 6.5;

/**
 * How big the ball is drawn at a perspective scale: squeezed towards the middle, so up close it's
 * no bigger than the golfer's head and far away it's still easy to see.
 */
const ballSize = (s: number) => 0.55 * (s / 0.75) ** 0.35;

/** spin: rotation keyframes for the dimples (the light stays put), in step with the ball's travel. */
function Ball({ c, r = 6.5, spin }: { c: Ctx; r?: number; spin?: { begin: string; dur: string; values: string } }) {
  const k = r / 7;
  return (
    <g transform={`scale(${k})`}>
      <circle r="7" fill={`url(#${c.id('ball')})`} />
      {/* A thin dark edge, so it still shows against pale grass and sky in sunlight. */}
      <circle r="7" fill="none" stroke="#1b2a12" strokeOpacity="0.4" strokeWidth="1" />
      <g>
        {spin && <animateTransform attributeName="transform" type="rotate" values={spin.values} begin={spin.begin} dur={spin.dur} fill="freeze" />}
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
  return <ellipse cx="1.5" cy="2" rx={r * 1.35} ry={r * 0.5} fill={`url(#${c.id('shade')})`} fillOpacity="0.55" />;
}

function Flag({ c, x, y, h = 38 }: { c: Ctx; x: number; y: number; h?: number }) {
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
            fill={`url(#${c.id('shade')})`} fillOpacity="0.56"
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
 * A ball played along physical legs (see shotPhysics): the ball and its shadow are keyframed at
 * 40fps, so flights are true parabolas, rolls slow under friction and spin follows the distance.
 */
function Flight({ c, from, legs, start = 0, r = 6.5, sink }: { c: Ctx; from: Spot; legs: Leg[]; start?: number; r?: number; sink?: boolean }) {
  if (c.still) return null;
  const { samples: path, duration } = simulate(from, legs, r);
  const samples = path.map((p) => ({ ...p, s: ballSize(p.s) }));
  const t = tracks(samples);
  const first = samples[0];
  const run = { begin: at(c, start), dur: `${duration.toFixed(3)}s`, fill: 'freeze' as const };
  // At the cup the dropping ball (CupDrop) takes over, so this one just goes.
  const gone = sink && <animate attributeName="opacity" to="0" begin={at(c, start + duration)} dur="0.01s" fill="freeze" />;
  return (
    <g>
      {gone}
      {/* Two faint copies a moment behind, so the eye can follow a small ball across the sky.
          They fade once it has stopped. */}
      {[0.05, 0.1].map((lag, i) => (
        <g key={lag} opacity={i ? 0.22 : 0.4}>
          <animate attributeName="opacity" to="0" begin={at(c, start + duration)} dur="0.2s" fill="freeze" />
          <g transform={`translate(${first.bx} ${first.by})`}>
            <animateTransform attributeName="transform" type="translate" values={t.ball} {...run} begin={at(c, start + lag)} />
            <g transform={`scale(${first.s})`}>
              <animateTransform attributeName="transform" type="scale" values={t.scale} {...run} begin={at(c, start + lag)} />
              <circle r={r * 0.8} fill="#ffffff" />
            </g>
          </g>
        </g>
      ))}
      <g transform={`translate(${first.gx} ${first.gy})`}>
        <animateTransform attributeName="transform" type="translate" values={t.ground} {...run} />
        <g transform={`scale(${first.s})`} opacity="1">
          <animateTransform attributeName="transform" type="scale" values={t.shadowScale} {...run} />
          <animate attributeName="opacity" values={t.shadow} {...run} />
          <BallShadow c={c} r={r} />
        </g>
      </g>
      <g transform={`translate(${first.bx} ${first.by})`}>
        <animateTransform attributeName="transform" type="translate" values={t.ball} {...run} />
        <g transform={`scale(${first.s})`}>
          <animateTransform attributeName="transform" type="scale" values={t.scale} {...run} />
          <Ball c={c} r={r} spin={{ ...run, values: t.spin }} />
        </g>
      </g>
    </g>
  );
}

/** The flight as a dotted line, for stills. */
function Trail({ from, legs }: { from: Spot; legs: Leg[] }) {
  const { samples } = simulate(from, legs);
  return (
    <path
      d={'M' + samples.map((p) => `${p.bx.toFixed(1)} ${p.by.toFixed(1)}`).join(' L ')}
      fill="none"
      stroke="#ffffff"
      strokeOpacity="0.7"
      strokeWidth="1.6"
      strokeDasharray="1 6"
      strokeLinecap="round"
    />
  );
}

/** Where a ball rests in the still (and after the motion, for scenes that don't animate it there). */
function RestingBall({ c, x, y, s }: { c: Ctx; x: number; y: number; s: number }) {
  // With motion the moving ball stays where it stopped; only the still needs one drawn.
  if (!c.still) return null;
  const r = BALL_R * ballSize(s);
  return (
    <g transform={`translate(${x} ${y})`}>
      <BallShadow c={c} r={r} />
      <Ball c={c} r={r} />
    </g>
  );
}

/**
 * The golfer standing over the ball at `ball`, sized to its place in the scene. He starts his
 * swing early enough to strike it at the scene's time 0. peg: the ball sits on a tee this high.
 */
function Player({ c, ball, view, swing, peg = 0, driver }: { c: Ctx; ball: Spot; view: View; swing: Swing; peg?: number; driver?: boolean }) {
  const lift = BALL_R * ballSize(ball.s) + peg;
  return (
    <>
      <Golfer
        x={ball.x}
        y={ball.y + lift}
        scale={ball.s}
        ballY={lift}
        view={view}
        swing={swing}
        begin={at(c, -impactAt(swing))}
        still={c.still}
        driver={driver}
      />
      {peg > 0 && <rect x={ball.x - 0.7} y={ball.y + lift - peg - 0.5} width="1.4" height={peg + 0.5} rx="0.5" fill="#ffffff" />}
    </>
  );
}

/**
 * The ball dropping into the hole once it's over it: it drops and settles halfway in, the same as the
 * still, so the last frame shows it holed. The clip is the cup opening plus everything above it, so
 * the front lip swallows the ball as it falls (the rolling ball crosses over the lip on its way in).
 */
function CupDrop({ c, x, y, s, r = 5 }: { c: Ctx; x: number; y: number; s: number; r?: number }) {
  const rx = 9;
  const ry = 4;
  return (
    <g opacity={c.still ? 1 : 0}>
      {!c.still && <set attributeName="opacity" to="1" begin={at(c, s)} />}
      <clipPath id={c.id('in-cup')}>
        <path d={`M${x - rx} 0 H ${x + rx} V ${y} A ${rx} ${ry} 0 0 1 ${x - rx} ${y} Z`} />
      </clipPath>
      <g clipPath={`url(#${c.id('in-cup')})`}>
        <g transform={c.still ? `translate(0 ${r * 0.8})` : undefined}>
          {!c.still && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values={`0 0;0.5 ${r * 0.6};0 ${r * 0.8}`}
              keyTimes="0;0.5;1"
              calcMode="spline"
              keySplines="0.5 0 1 1;0.2 0 0.4 1"
              begin={at(c, s)}
              dur="0.25s"
              fill="freeze"
            />
          )}
          <circle cx={x} cy={y} r={r} fill={`url(#${c.id('ball')})`} />
          <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.22} fill="#ffffff" opacity="0.9" />
        </g>
      </g>
      {/* While it drops, the front lip sits over it. */}
      <path d={`M${x - rx} ${y} A ${rx} ${ry} 0 0 0 ${x + rx} ${y}`} fill="none" stroke="#7fcf6c" strokeWidth="1.2" />
    </g>
  );
}

/**
 * Lights up where the ball has to finish as it gets there (at s), then settles to a soft glow that
 * the still keeps, so the final picture shows the target.
 */
function Glow({ c, s, children }: { c: Ctx; s: number; children: ReactNode }) {
  return (
    <g opacity={c.still ? 0.6 : 0}>
      {!c.still && <animate attributeName="opacity" values="0;1;0.6" keyTimes="0;0.3;1" begin={at(c, s)} dur="0.9s" fill="freeze" />}
      {children}
    </g>
  );
}

/** A target area for Glow: a light wash with a bright edge. */
const lit = { fill: '#ffffff', fillOpacity: 0.2, stroke: '#ffffff', strokeOpacity: 0.9, strokeWidth: 1.6 } as const;

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
/** The first cut of rough either side of the fairway, for cards where it counts too. */
const FIRST_CUT = `M70 150 C 132 110, 182 64, 200 ${HORIZON} L 236 ${HORIZON} C 246 64, 262 110, 302 150 Z`;

/** A point on the left edge of the fairway, t = 0 at the tee and 1 at the horizon. */
function leftEdge(t: number): [number, number] {
  const u = 1 - t;
  const x = u ** 3 * 96 + 3 * u * u * t * 150 + 3 * u * t * t * 192 + t ** 3 * 206;
  const y = u ** 3 * 150 + 3 * u * u * t * 110 + 3 * u * t * t * 64 + t ** 3 * HORIZON;
  return [x, y];
}

/**
 * tee: the tee box and its markers (off for a second shot, played from the fairway).
 * rough: draws the first cut beside the fairway.
 */
function TeeView({ c, hazard, tee = true, rough = false }: { c: Ctx; hazard?: ShotArt['hazard']; tee?: boolean; rough?: boolean }) {
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
      <rect y={HORIZON} width="340" height={144 - HORIZON} fill={`url(#${c.id('grain')})`} />
      {rough && <path d={FIRST_CUT} fill={`url(#${c.id('cut')})`} />}
      {/* Fairway with stripes. */}
      <path d={FAIRWAY} fill={`url(#${c.id('fairway')})`} />
      <clipPath id={c.id('fw')}>
        <path d={FAIRWAY} />
      </clipPath>
      <g clipPath={`url(#${c.id('fw')})`}>
        {bands.map((b, k) => b.on && <rect key={k} y={b.y0} width="340" height={b.y1 - b.y0} fill="#ffffff" opacity="0.09" />)}
        <path d={FAIRWAY} fill={`url(#${c.id('grain')})`} />
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
            d="M248 74 C 266 64, 320 64, 332 76 L 332 96 C 306 102, 266 100, 248 88 C 240 84, 240 78, 248 74 Z"
            fill={`url(#${c.id('water')})`}
          />
          <path d="M248 74 C 266 64, 320 64, 332 76" fill="none" stroke="#c9eeff" strokeOpacity="0.6" strokeWidth="1.2" />
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${264 + i * 18} ${80 + i * 4} q 7 -2 14 0`}
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
        [0.04, 0.2, 0.68, 0.84].map((t, i) => {
          // White stakes down the left, shrinking with distance (none where the golfer stands).
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
      {/* Tee box and its markers (yellow: the everyday tees). */}
      {tee && (
        <g>
          <path d="M120 110 L 236 110 L 248 150 L 108 150 Z" fill="#8ad472" opacity="0.65" />
          {[124, 230].map((x) => (
            <g key={x}>
              <ellipse cx={x + 1.5} cy="117.5" rx="4.6" ry="1.6" fill="#0d2a10" opacity="0.3" />
              <circle cx={x} cy="114" r="3.8" fill="#f5c518" stroke="#8a6d00" strokeOpacity="0.5" strokeWidth="0.8" />
            </g>
          ))}
        </g>
      )}
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
      <rect width="340" height="144" fill={`url(#${c.id('grain')})`} />
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
      <ellipse {...GREEN} fill={`url(#${c.id('grain')})`} />
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
          <path d={BUNKER} fill={`url(#${c.id('grain')})`} opacity="0.5" />
        </g>
      )}
      <Cup c={c} x={CUP.x} y={CUP.y} />
    </g>
  );
}

/** A ring around the flag showing how close the ball has to finish. */
function Ring({ c, feet, s }: { c: Ctx; feet: number; s: number }) {
  const rx = 10 + feet * 1.25;
  const ry = rx * 0.42;
  return (
    <g>
      <Glow c={c} s={s}>
        <ellipse cx={CUP.x} cy={CUP.y} rx={rx} ry={ry} {...lit} />
      </Glow>
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
      <Pill ctx={c} x={CUP.x} y={CUP.y + ry + 4} text={`${feet} ft`} at={0} anchor="middle" />
    </g>
  );
}

// ── Scenes ───────────────────────────────────────────────────────────────────

// Each shot: where the ball starts, then its legs (flight with a height, bounces, rolls). Times in
// seconds; the scene's landAt and duration line up with the leg times.
const TEE: Spot = { x: 176, y: 122, s: 1.6 };
/** The tee peg under the ball on the tee. */
const PEG = 3;
const off = (x: number, y: number, s: number): Spot => ({ x, y, s });
/** A second shot: the ball sits on the fairway, a little right of where the tee would be. */
const FAIRWAY_LIE = off(184, 122, 1.6);
/** Where approaches are played from: on the fairway, near enough to see the golfer. */
const FAIRWAY_BALL = off(58, 120, 1.3);
// Flight heights keep the top of each arc inside the strip, even on a small phone.

const PLANS: Record<Exclude<ShotArt['kind'], 'putt'>, (art: ShotArt, par: number, vs?: VsLast) => Plan> = {
  drive: (art) => {
    // A second shot is played off the fairway with an iron; the first cut counts for some cards.
    const from = art.fairway ? FAIRWAY_LIE : TEE;
    const rest = art.rough ? off(181, 64, 0.44) : off(215, 57, 0.4);
    const legs: Leg[] = art.rough
      ? [
          { to: off(180, 70, 0.46), t: 0.95, h: 78 },
          { to: off(180.5, 66.5, 0.45), t: 0.2, h: 7 },
          { to: rest, t: 0.32 },
        ]
      : [
          { to: off(214, 66, 0.44), t: 0.95, h: art.fairway ? 76 : 78 },
          { to: off(214.5, 61, 0.42), t: 0.22, h: 8 },
          { to: rest, t: 0.35 },
        ];
    return {
      label: art.metres
        ? `a ${art.metres} metre drive down the fairway`
        : art.fairway
          ? 'a second shot from the fairway, finishing in the fairway'
          : art.rough
            ? 'a drive finishing in the first cut of rough'
            : 'a drive landing in the fairway',
      lead: impactAt('full'),
      duration: 1.52,
      landAt: 0.95,
      draw: (c) => (
        <>
          <TeeView c={c} tee={!art.fairway} rough={art.rough} />
          <Glow c={c} s={0.95}>
            {art.rough && <path d={FIRST_CUT} {...lit} fillOpacity={0.12} />}
            <path d={FAIRWAY} {...lit} />
          </Glow>
          {art.metres && <Pill ctx={c} x={266} y={46} text={`${art.metres} m`} at={1.05} anchor="middle" />}
          <Player c={c} ball={from} view="side" swing="full" peg={art.fairway ? 0 : PEG} driver={!art.fairway} />
          <Flight c={c} from={from} legs={legs} />
          <RestingBall c={c} x={rest.x} y={rest.y} s={rest.s} />
          {c.still && <Trail from={from} legs={legs.slice(0, 1)} />}
        </>
      ),
    };
  },

  trouble: (art) => {
    const legs: Leg[] = [
      { to: off(216, 68, 0.45), t: 0.95, h: 78 },
      { to: off(216.5, 63, 0.43), t: 0.22, h: 7 },
      { to: off(217, 59, 0.42), t: 0.35 },
    ];
    return {
      label:
        art.hazard === 'water'
          ? 'a drive staying clear of the water'
          : art.hazard === 'stakes'
            ? 'a drive staying inside the white stakes'
            : 'a drive staying clear of trouble',
      lead: impactAt('full'),
      duration: 1.52,
      landAt: 0.95,
      draw: (c) => (
        <>
          <TeeView c={c} hazard={art.hazard} />
          <Glow c={c} s={0.95}>
            <path d={FAIRWAY} {...lit} />
          </Glow>
          <Player c={c} ball={TEE} view="side" swing="full" peg={PEG} driver />
          <Flight c={c} from={TEE} legs={legs} />
          <RestingBall c={c} x={217} y={59} s={0.42} />
          {c.still && <Trail from={TEE} legs={legs.slice(0, 1)} />}
        </>
      ),
    };
  },

  approach: (art) => {
    // Finish inside the ring (or just on the green when there's no distance).
    const stop = art.feet ? { x: CUP.x - 4 - art.feet * 0.35, y: CUP.y + 3 } : { x: 226, y: 70 };
    // Backspin: it pitches just past the target, skips on, then checks back to stop.
    const legs: Leg[] = [
      { to: off(stop.x + 6, stop.y - 2, 0.76), t: 0.95, h: art.feet ? 58 : 62 },
      { to: off(stop.x + 13, stop.y - 4, 0.75), t: 0.2, h: 5 },
      { to: off(stop.x, stop.y, 0.75), t: 0.45 },
    ];
    return {
      label: art.feet ? `an approach finishing within ${art.feet} feet of the hole` : 'an approach landing on the green',
      lead: impactAt('full'),
      duration: 1.6,
      landAt: 0.95,
      draw: (c) => (
        <>
          <GreenView c={c} />
          {art.feet ? (
            <Ring c={c} feet={art.feet} s={0.95} />
          ) : (
            <Glow c={c} s={0.95}>
              <ellipse {...GREEN} {...lit} />
            </Glow>
          )}
          <Flag c={c} x={CUP.x} y={CUP.y - 2.5} />
          <Player c={c} ball={FAIRWAY_BALL} view="face" swing="full" />
          <Flight c={c} from={FAIRWAY_BALL} legs={legs} />
          <RestingBall c={c} x={stop.x} y={stop.y} s={0.75} />
        </>
      ),
    };
  },

  bunker: (art) => {
    if (art.miss) {
      // The bunker sits on the line in, marked as the thing to avoid; the ball carries it.
      const legs: Leg[] = [
        { to: off(218, 70, 0.76), t: 0.95, h: 64 },
        { to: off(225, 68, 0.75), t: 0.2, h: 5 },
        { to: off(230, 66, 0.75), t: 0.4 },
      ];
      return {
        label: 'an approach carrying the bunker onto the green',
        lead: impactAt('full'),
        duration: 1.55,
        landAt: 0.95,
        draw: (c) => (
          <>
            <GreenView c={c} />
            <path d={BUNKER} fill="none" stroke="#e11d48" strokeOpacity="0.9" strokeWidth="1.8" strokeDasharray="4 3" strokeLinecap="round" />
            <Glow c={c} s={0.95}>
              <ellipse {...GREEN} {...lit} />
            </Glow>
            <Flag c={c} x={CUP.x} y={CUP.y - 2.5} />
            <Player c={c} ball={FAIRWAY_BALL} view="face" swing="full" />
            <Flight c={c} from={FAIRWAY_BALL} legs={legs} />
            <RestingBall c={c} x={230} y={66} s={0.75} />
          </>
        ),
      };
    }
    // Popped up soft out of the sand, lands on the green and runs out.
    const legs: Leg[] = [
      { to: off(228, 66, 0.77), t: 0.8, h: 56 },
      { to: off(234, 64, 0.76), t: 0.2, h: 5 },
      { to: off(240, 62, 0.75), t: 0.4 },
    ];
    return {
      label: 'a splash out of the bunker onto the green',
      lead: impactAt('splash'),
      duration: 1.5,
      landAt: 0.85,
      draw: (c) => (
        <>
          <GreenView c={c} />
          <Glow c={c} s={0.85}>
            <ellipse {...GREEN} {...lit} />
          </Glow>
          <Flag c={c} x={CUP.x} y={CUP.y - 2.5} />
          <Player c={c} ball={off(154, 96, 1)} view="face" swing="splash" />
          <Spray c={c} x={154} y={96} s={0} />
          <Flight c={c} from={off(154, 96, 1)} legs={legs} start={0.05} />
          <RestingBall c={c} x={240} y={62} s={0.75} />
        </>
      ),
    };
  },

  chip: (art) => {
    // A low pitch that lands on the fringe edge, then rolls out (into the cup for a hole-out).
    const end = art.holeOut ? off(CUP.x, CUP.y, 0.8) : off(230, 66, 0.8);
    const roll = art.holeOut ? 0.85 : 0.6;
    const legs: Leg[] = [
      { to: off(192, 81, 0.86), t: 0.5, h: 34 },
      { to: off(199, 77, 0.85), t: 0.16, h: 4 },
      { to: end, t: roll },
    ];
    const sinkAt = 0.66 + roll;
    return {
      label: art.holeOut ? 'a chip from off the green rolling into the hole' : 'a chip from off the green onto it',
      lead: impactAt('chip'),
      duration: sinkAt + 0.3,
      landAt: art.holeOut ? sinkAt : 0.5,
      draw: (c) => (
        <>
          <GreenView c={c} bunker={false} />
          {!art.holeOut && (
            <Glow c={c} s={0.5}>
              <ellipse {...GREEN} {...lit} />
            </Glow>
          )}
          <Flag c={c} x={CUP.x} y={CUP.y - 2.5} />
          <Player c={c} ball={off(150, 108, 1)} view="face" swing="chip" />
          <Flight c={c} from={off(150, 108, 1)} legs={legs} r={6.5} sink={art.holeOut} />
          {!art.holeOut && <RestingBall c={c} x={end.x} y={end.y} s={0.8} />}
          {art.holeOut && (
            <>
              <CupDrop c={c} x={CUP.x} y={CUP.y} s={sinkAt} r={BALL_R * ballSize(0.8)} />
              <Ripple c={c} x={CUP.x} y={CUP.y} s={sinkAt} />
            </>
          )}
        </>
      ),
    };
  },

  score: (art, par, vs) => {
    if (art.vsLast) {
      // This hole needs the last hole's score against par, less the card's margin; with no last
      // hole, the card's first-hole target.
      const lastToPar = vs?.last ? vs.last.strokes - vs.last.par : null;
      const need = lastToPar == null ? (vs?.first ?? 0) : lastToPar - (vs?.by ?? 0);
      const strokes = Math.max(1, par + need);
      const name = scoreName(strokes - par);
      return {
        label: vs?.last
          ? `a scorecard: ${scoreName(lastToPar!)} on the last hole, so this hole needs ${name} or better`
          : `a scorecard: first hole, so this hole needs ${name} or better`,
        tag: `need ${name} or better`,
        duration: vsThisAt(lastToPar) + 0.45 + marksTime(strokes - par),
        landAt: vsThisAt(lastToPar) + 0.45 + marksTime(strokes - par),
        draw: (c) => <VsCard c={c} last={vs?.last ?? null} par={par} strokes={strokes} />,
      };
    }
    const toPar = art.toPar ?? 0;
    return {
      label: `a scorecard marked ${scoreName(toPar)}`,
      duration: 0.5 + marksTime(toPar),
      landAt: 0.5 + marksTime(toPar),
      draw: (c) => <Scorecard c={c} par={par} toPar={toPar} />,
    };
  },
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
  return (
    { [-3]: 'albatross', [-2]: 'eagle', [-1]: 'birdie', 0: 'par', 1: 'bogey', 2: 'double bogey', 3: 'triple bogey' }[toPar] ??
    (toPar < 0 ? `${-toPar} under` : `${toPar} over`)
  );
}

/** Seconds to draw the marks for a score: one circle a birdie, two for an eagle or better, a box per stroke over (up to three). */
const marksTime = (toPar: number) => (toPar === 0 ? 0 : 0.1 + 0.2 * Math.min(toPar < 0 ? 2 : 3, Math.abs(toPar)) + 0.1);

/**
 * The way golfers mark a scorecard, around a number centred on (x, y), drawn from s seconds:
 * birdie circled, eagle or better circled twice, bogey and worse one box per stroke over (up to three).
 */
function Marks({ c, x, y, toPar, s }: { c: Ctx; x: number; y: number; toPar: number; s: number }) {
  if (toPar < 0) {
    const ring = (k: number) =>
      `M${x} ${y - 24 * k} C ${x + 22 * k} ${y - 24 * k}, ${x + 24 * k} ${y + 22 * k}, ${x} ${y + 24 * k} C ${x - 22 * k} ${y + 24 * k}, ${x - 24 * k} ${y - 22 * k}, ${x + 2} ${y - 22 * k}`;
    return (
      <>
        {[1, 1.2].slice(0, toPar <= -2 ? 2 : 1).map((k, i) => (
          <Stroke key={k} c={c} d={ring(k)} s={s + i * 0.2} dur={0.3} />
        ))}
      </>
    );
  }
  return (
    <>
      {[0, 1, 2].slice(0, Math.min(3, toPar)).map((i) => {
        const w = 40 + i * 8;
        const h = 44 + i * 8;
        return <Stroke key={i} c={c} d={`M${x - w / 2} ${y - h / 2} h ${w} v ${h} h ${-w} Z`} s={s + i * 0.2} dur={0.25} />;
      })}
    </>
  );
}

/** A number written in pencil from left to right, centred on x, from s seconds. */
function Written({ c, x, y, text, s, dur = 0.4 }: { c: Ctx; x: number; y: number; text: string; s: number; dur?: number }) {
  const clip = c.id(`write-${x}`);
  return (
    <>
      <clipPath id={clip}>
        <rect x={x - 30} y={y - 52} width={c.still ? 60 : 0} height="70">
          {!c.still && <animate attributeName="width" to="60" begin={at(c, s)} dur={`${dur}s`} fill="freeze" />}
        </rect>
      </clipPath>
      <text x={x} y={y} textAnchor="middle" fontSize="44" fill="#2b2f3a" fontFamily={HAND} clipPath={`url(#${clip})`}>
        {text}
      </text>
    </>
  );
}

/** The scorecard's paper, header and middle line, with a column label over each half. */
function Card({ c, heads, children }: { c: Ctx; heads: [string, string]; children: ReactNode }) {
  return (
    <g>
      <rect width="340" height="144" fill={`url(#${c.id('rough')})`} />
      <rect width="340" height="144" fill={`url(#${c.id('stripes')})`} />
      <rect width="340" height="144" fill={`url(#${c.id('grain')})`} />
      {/* Kept clear of the tag in the top-left corner and inside the strip on a small phone. */}
      <g transform="translate(44 12) scale(0.82) rotate(-3 170 84)" filter={`url(#${c.id('shadow')})`}>
        <rect x="76" y="36" width="188" height="102" rx="8" fill={`url(#${c.id('paper')})`} />
        <rect x="76" y="36" width="188" height="24" rx="8" fill="#1f6b3a" />
        <rect x="76" y="52" width="188" height="8" fill="#1f6b3a" />
        {heads.map((t, i) => (
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
        {children}
      </g>
    </g>
  );
}

/** A pencilled scorecard: the target score is written in, then marked the way golfers do. */
function Scorecard({ c, par, toPar }: { c: Ctx; par: number; toPar: number }) {
  return (
    <Card c={c} heads={['PAR', 'SCORE']}>
      <text x="123" y="114" textAnchor="middle" fontSize="36" fontWeight="800" fill="#2c3a2f" fontFamily={FONT}>
        {par}
      </text>
      <Written c={c} x={217} y={118} text={String(par + toPar)} s={0.05} />
      <Marks c={c} x={217} y={100} toPar={toPar} s={0.5} />
    </Card>
  );
}

/** When the last-hole card starts writing this hole's target: once the last hole is written and marked. */
const vsThisAt = (lastToPar: number | null) => (lastToPar == null ? 0.2 : 0.3 + marksTime(lastToPar));

/**
 * For cards judged against the last hole: the player's real last hole on the left (or "first hole"),
 * and the score this hole needs on the right, each marked, with its par printed underneath.
 */
function VsCard({ c, last, par, strokes }: { c: Ctx; last: { strokes: number; par: number } | null; par: number; strokes: number }) {
  const s = vsThisAt(last ? last.strokes - last.par : null);
  const small = { textAnchor: 'middle', fontSize: 11, fontWeight: 700, fill: '#8a8170', fontFamily: FONT } as const;
  return (
    <Card c={c} heads={['LAST HOLE', 'THIS HOLE']}>
      {last ? (
        <>
          <Written c={c} x={123} y={112} text={String(last.strokes)} s={0.05} dur={0.3} />
          <Marks c={c} x={123} y={94} toPar={last.strokes - last.par} s={0.3} />
          <text x="123" y="132" {...small}>
            par {last.par}
          </text>
        </>
      ) : (
        <text x="123" y="104" {...small} fontSize={14}>
          first hole
        </text>
      )}
      <Written c={c} x={217} y={112} text={String(strokes)} s={s} />
      <Marks c={c} x={217} y={94} toPar={strokes - par} s={s + 0.45} />
      <text x="217" y="132" {...small}>
        par {par} · or better
      </text>
    </Card>
  );
}

/** A pencil line that draws itself. It's hidden until it starts, so the pen's round tip doesn't leave a dot. */
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
      opacity={c.still ? 0.85 : 0}
    >
      {!c.still && <set attributeName="opacity" to="0.85" begin={at(c, s)} />}
      {!c.still && <animate attributeName="stroke-dashoffset" to="0" begin={at(c, s)} dur={`${dur}s`} fill="freeze" />}
    </path>
  );
}
