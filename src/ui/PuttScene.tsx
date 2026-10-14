import { useEffect, useId, useState } from 'react';
import { haptic, reducedMotion } from './effects';

// Illustration colours (grass, cup, ball, flag) are part of the drawing, not UI tokens.

/**
 * A short putting scene for putting cards: a mown green with grain, a cup with depth, a flag
 * that moves in the breeze, and a lit ball that rolls on a slight break and drops in.
 * Plays once when it appears (and again on tap), then settles on a still that explains the
 * card: the ball in the cup, the aim line and distance, and the card's tag. With Reduce
 * Motion it shows that still straight away.
 *
 * two: a lag putt that stops short, then a tap-in (for "two putts or fewer").
 * feet: shows the distance on the aim line.
 * tag: the card's extra condition ("for par", "2 putts max"), shown by the flag.
 */
export function PuttScene({ feet, two = false, tag, delay = 0.35 }: { feet?: number; two?: boolean; tag?: string; delay?: number }) {
  const uid = useId().replace(/:/g, '');
  const [run, setRun] = useState(0);
  const still = reducedMotion();
  const id = (n: string) => `${n}-${uid}`;

  // The line from the ball to the cup, breaking left to right as it slows.
  const line = 'M54 116 C 118 124, 204 104, 262 66';
  const roll = two ? 2.1 : 1.7;
  const begin = (s: number) => `${(delay + s).toFixed(2)}s`;
  const sunk = begin(roll);
  // Two putts: the first stops ~85% of the way, a beat, then the tap-in.
  const motion = two
    ? { keyPoints: '0;0.84;0.84;1', keyTimes: '0;0.62;0.78;1', keySplines: '0.15 0.6 0.3 1;0 0 1 1;0.3 0 0.4 1' }
    : { keyPoints: '0;1', keyTimes: '0;1', keySplines: '0.18 0.55 0.32 1' };
  // The ball sits at the start from the first frame: the wait before the roll is a held segment.
  const total = delay + roll;
  const t = (x: number) => ((delay + x * roll) / total).toFixed(3);
  const held = two
    ? { keyPoints: '0;0;0.84;0.84;1', keyTimes: `0;${t(0)};${t(0.62)};${t(0.78)};1`, keySplines: `0 0 1 1;${motion.keySplines}` }
    : { keyPoints: '0;0;1', keyTimes: `0;${t(0)};1`, keySplines: `0 0 1 1;${motion.keySplines}` };

  // A light tap on the phone as the ball drops.
  useEffect(() => {
    if (still) return;
    const timer = setTimeout(() => haptic('light'), total * 1000);
    return () => clearTimeout(timer);
  }, [run, still, total]);

  return (
    <button
      type="button"
      className="putt-scene"
      aria-label={`${two ? 'Animation: a lag putt and a tap-in' : `Animation: a ${feet ? `${feet} foot ` : ''}putt dropping in`}${tag ? `, ${tag}` : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        setRun((n) => n + 1);
      }}
    >
      <svg key={run} viewBox="0 0 340 144" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          {/* Green: lighter where the light hits, darker at the edges. */}
          <radialGradient id={id('green')} cx="58%" cy="40%" r="75%">
            <stop offset="0" stopColor="#7fd36a" />
            <stop offset="0.55" stopColor="#4fae47" />
            <stop offset="1" stopColor="#2c7d35" />
          </radialGradient>
          <linearGradient id={id('fringe')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2b6f2f" />
            <stop offset="1" stopColor="#3e8f3c" />
          </linearGradient>
          {/* Mower stripes. */}
          <pattern id={id('stripes')} width="44" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
            <rect width="22" height="44" fill="#ffffff" opacity="0.07" />
          </pattern>
          {/* Grass grain: fine noise, kept faint. */}
          <filter id={id('grain')} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="7" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.25  0 0 0 0 0.08  0 0 0 0.35 0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          {/* Cup: dark inside, a soft lip. */}
          <radialGradient id={id('cup')} cx="50%" cy="35%" r="65%">
            <stop offset="0" stopColor="#050806" />
            <stop offset="0.7" stopColor="#13201a" />
            <stop offset="1" stopColor="#2a3b2f" />
          </radialGradient>
          {/* Ball: lit from the top left. */}
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
          <filter id={id('soft')} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
        </defs>

        {/* Fringe, then the putting surface with stripes and grain. */}
        <rect width="340" height="144" fill={`url(#${id('fringe')})`} />
        <ellipse cx="176" cy="92" rx="214" ry="86" fill={`url(#${id('green')})`} />
        <ellipse cx="176" cy="92" rx="214" ry="86" fill={`url(#${id('stripes')})`} />
        <ellipse cx="176" cy="92" rx="214" ry="86" fill="#000" filter={`url(#${id('grain')})`} />

        {/* Aim line and distance: they dim while the ball rolls and come back once it drops. */}
        <g>
          <path d={line} fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" />
          {feet != null && (
            <g transform="translate(150 98)">
              <rect x="-24" y="-13" width="48" height="24" rx="12" fill="#0b0b12" fillOpacity="0.72" />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fontSize="13"
                fontWeight="800"
                fill="#ffffff"
                fontFamily="-apple-system, system-ui, sans-serif"
              >
                {feet} ft
              </text>
            </g>
          )}
          {!still && (
            <animate
              attributeName="opacity"
              values="1;0.2;0.2;1"
              keyTimes={`0;${(0.5 / (roll + 0.9)).toFixed(3)};${((roll + 0.3) / (roll + 0.9)).toFixed(3)};1`}
              begin={begin(0.15)}
              dur={`${roll + 0.9}s`}
              fill="freeze"
            />
          )}
        </g>

        {/* The track the ball leaves in the dew. */}
        {!still && (
          <path
            d={line}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.28"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1 1"
            strokeDashoffset="1"
          >
            <animate
              attributeName="stroke-dashoffset"
              values={two ? '1;0.16;0.16;0' : '1;0'}
              keyTimes={motion.keyTimes}
              calcMode="spline"
              keySplines={motion.keySplines}
              begin={begin(0)}
              dur={`${roll}s`}
              fill="freeze"
            />
            <animate attributeName="stroke-opacity" to="0" begin={sunk} dur="0.6s" fill="freeze" />
          </path>
        )}

        {/* Flag shadow on the green. */}
        <path
          d="M262 66 L 318 84"
          stroke="#0d3a15"
          strokeOpacity="0.28"
          strokeWidth="3"
          strokeLinecap="round"
          filter={`url(#${id('soft')})`}
        />
        <path d="M300 78 L 330 96 L 314 99 Z" fill="#0d3a15" fillOpacity="0.2" filter={`url(#${id('soft')})`} />

        {/* Cup and its rim, drawn under the rolling ball so the ball crosses over the front lip. */}
        <ellipse cx="262" cy="66" rx="12.5" ry="5.6" fill={`url(#${id('cup')})`} />
        <ellipse cx="262" cy="64.6" rx="12.5" ry="4.6" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" />
        <path d="M249.5 66 A 12.5 5.6 0 0 0 274.5 66" fill="none" stroke="#7fcf6c" strokeWidth="1.6" />

        {/* Pin and flag, standing at the back of the cup and drawn behind the ball, so the ball
            passes in front of the pole instead of through it. */}
        <rect x="261" y="6" width="2.4" height="56.5" rx="1.2" fill={`url(#${id('pin')})`} />
        <circle cx="262.2" cy="6" r="2" fill="#ffffff" />
        <path d="M263.4 8 C 276 10, 286 7, 298 13 C 287 19, 276 18, 263.4 26 Z" fill={`url(#${id('flag')})`}>
          {!still && (
            <animate
              attributeName="d"
              dur="1.6s"
              repeatDur={`${(total + 1.2).toFixed(2)}s`}
              values="M263.4 8 C 276 10, 286 7, 298 13 C 287 19, 276 18, 263.4 26 Z;M263.4 8 C 275 5, 287 11, 298 11 C 288 17, 275 20, 263.4 26 Z;M263.4 8 C 276 10, 286 7, 298 13 C 287 19, 276 18, 263.4 26 Z"
            />
          )}
        </path>
        <path d="M263.4 8 C 276 10, 286 7, 298 13" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" />

        {/* Ball and its shadow, rolling on the line. */}
        <g>
          {still ? null : (
            <g>
              <animateMotion path={line} begin="0s" dur={`${total}s`} fill="freeze" calcMode="spline" {...held} />
              {/* Over the hole the dropping ball (below) takes over. */}
              <g>
                <animate attributeName="opacity" to="0" begin={sunk} dur="0.01s" fill="freeze" />
                <g>
                  {/* A touch smaller as it rolls away from us. */}
                  <animateTransform
                    attributeName="transform"
                    type="scale"
                    values="1.12;1.12;0.86"
                    keyTimes={`0;${t(0)};1`}
                    begin="0s"
                    dur={`${total}s`}
                    fill="freeze"
                  />
                  <Ball id={id} spin={{ dur: total, at: t(0), turns: two ? 5 : 4 }} />
                </g>
              </g>
            </g>
          )}
        </g>

        {/* The drop: once it's over the hole the ball falls straight down and is gone. The clip
            is the cup opening plus everything above it, so the front lip swallows the ball as it
            falls. The still shows it halfway in. */}
        <clipPath id={id('in-cup')}>
          <path d="M249.5 0 H 274.5 V 66 A 12.5 5.6 0 0 1 249.5 66 Z" />
        </clipPath>
        <g opacity={still ? 1 : 0}>
          {!still && <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.95;1" begin={sunk} dur="0.3s" fill="freeze" />}
          <g clipPath={`url(#${id('in-cup')})`}>
            <g transform={still ? 'translate(0 5)' : undefined}>
              {!still && (
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0 0;0.6 4;0 15"
                  keyTimes="0;0.35;1"
                  calcMode="spline"
                  keySplines="0.5 0 1 1;0.6 0 1 1"
                  begin={sunk}
                  dur="0.3s"
                  fill="freeze"
                />
              )}
              <circle cx="262" cy="66" r="6.4" fill={`url(#${id('ball')})`} />
              <circle cx="259.8" cy="63.8" r="1.4" fill="#ffffff" opacity="0.9" />
            </g>
          </g>
          {/* While it drops, the front lip sits over it. */}
          <path d="M249.5 66 A 12.5 5.6 0 0 0 274.5 66" fill="none" stroke="#7fcf6c" strokeWidth="1.6" />
        </g>

        {/* Ripple when it drops. */}
        {!still && (
          <ellipse cx="262" cy="66" rx="12" ry="5" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0">
            <animate attributeName="opacity" values="0.8;0" begin={sunk} dur="0.7s" fill="freeze" />
            <animate attributeName="rx" values="12;34" begin={sunk} dur="0.7s" fill="freeze" />
            <animate attributeName="ry" values="5;14" begin={sunk} dur="0.7s" fill="freeze" />
          </ellipse>
        )}

        {/* The card's extra condition, by the flag once the ball is in. */}
        {tag && (
          <g opacity={still ? 1 : 0}>
            <rect
              x={254 - (tag.length * 7.4 + 20)}
              y="9"
              width={tag.length * 7.4 + 20}
              height="24"
              rx="12"
              fill="#0b0b12"
              fillOpacity="0.72"
            />
            <text
              x={254 - (tag.length * 7.4 + 20) / 2}
              y="25.5"
              textAnchor="middle"
              fontSize="13"
              fontWeight="800"
              fill="#ffffff"
              fontFamily="-apple-system, system-ui, sans-serif"
            >
              {tag}
            </text>
            {!still && <animate attributeName="opacity" to="1" begin={begin(roll + 0.35)} dur="0.25s" fill="freeze" />}
          </g>
        )}
      </svg>
    </button>
  );
}

/** spin: the dimples turn as it rolls (the light stays put), slowing with the ball. */
function Ball({ id, spin }: { id: (n: string) => string; spin?: { dur: number; at: string; turns: number } }) {
  return (
    <>
      <ellipse cx="2.4" cy="5.2" rx="7.6" ry="2.6" fill="#0d3a15" fillOpacity="0.4" filter={`url(#${id('soft')})`} />
      <circle r="7.5" fill={`url(#${id('ball')})`} />
      <g>
        {spin && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={`0;0;${spin.turns * 360}`}
            keyTimes={`0;${spin.at};1`}
            calcMode="spline"
            keySplines="0 0 1 1;0.18 0.55 0.32 1"
            begin="0s"
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
    </>
  );
}
