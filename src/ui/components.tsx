import { useEffect, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from 'react';
import { formatDelta, LIMITS, TIERS, type Par, type Player, type Tier } from '../game';
import { haptic } from './effects';
import { back, closeSheet, useApp } from '../state/store';
import { BackIcon, BoltIcon, CloseIcon, FlameIcon, MinusIcon, PlusIcon, ShieldIcon } from './Icons';

// ── Tiers ───────────────────────────────────────────────────────────────────

export const TIER_LOOK: Record<Tier, { Icon: ComponentType<SVGProps<SVGSVGElement>>; pips: number; color: string }> = {
  safe: { Icon: ShieldIcon, pips: 1, color: 'var(--safe)' },
  bold: { Icon: FlameIcon, pips: 2, color: 'var(--bold)' },
  insane: { Icon: BoltIcon, pips: 3, color: 'var(--insane)' },
};

export function Pips({ n, of = 3 }: { n: number; of?: number }) {
  return (
    <span className="pips" aria-hidden>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={i < n ? 'on' : ''} />
      ))}
    </span>
  );
}

export function TierIcon({ tier, size = 24 }: { tier: Tier; size?: number }) {
  const { Icon } = TIER_LOOK[tier];
  return <Icon width={size} height={size} />;
}

/** Coloured tier label, e.g. [⚡ INSANE]. Optional stakes: "−6 / +3". */
export function TierChip({ tier, stakes = false, big = false }: { tier: Tier; stakes?: boolean; big?: boolean }) {
  const t = TIERS[tier];
  return (
    <span className={`chip tier-chip tier-${tier}`} style={big ? { fontSize: 19, padding: '8px 14px' } : undefined}>
      <TierIcon tier={tier} size={big ? 20 : 17} />
      {t.label}
      {stakes && (
        <span style={{ opacity: 0.9, fontWeight: 800 }}>
          {' '}
          {formatDelta(t.made)} / {formatDelta(t.missed)}
        </span>
      )}
    </span>
  );
}

// ── Players ─────────────────────────────────────────────────────────────────

export const PLAYER_COLORS = ['#2563eb', '#db2777', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626', '#4f46e5'];

export function playerColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

export function Avatar({ player, size = 44 }: { player: Pick<Player, 'name' | 'color'>; size?: number }) {
  const initial = [...player.name.trim()][0] ?? '?';
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.46, background: playerColor(player.color) }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

// ── Golf words ──────────────────────────────────────────────────────────────

/** Name for a real score relative to par: Birdie, Bogey, Double bogey… */
export function scoreName(strokes: number, par: Par): string {
  if (strokes === 1) return 'Hole in one';
  const diff = strokes - par;
  const names: Record<number, string> = {
    [-3]: 'Albatross',
    [-2]: 'Eagle',
    [-1]: 'Birdie',
    0: 'Par',
    1: 'Bogey',
    2: 'Double bogey',
    3: 'Triple bogey',
  };
  return names[diff] ?? (diff > 0 ? `+${diff}` : `${diff}`);
}

export type ScoreTone = 'ace' | 'eagle' | 'birdie' | 'par' | 'bogey' | 'double' | 'worse';

/** Look and feel for a stroke count against par: colour tone plus an emoji. */
export function scoreLook(strokes: number, par: Par): { tone: ScoreTone; emoji: string } {
  if (strokes === 1) return { tone: 'ace', emoji: '🎯' };
  const diff = strokes - par;
  if (diff <= -2) return { tone: 'eagle', emoji: diff <= -3 ? '🕊️' : '🦅' };
  if (diff === -1) return { tone: 'birdie', emoji: '🐦' };
  if (diff === 0) return { tone: 'par', emoji: '👌' };
  if (diff === 1) return { tone: 'bogey', emoji: '😬' };
  if (diff === 2) return { tone: 'double', emoji: '😩' };
  return { tone: 'worse', emoji: '💀' };
}

/**
 * Stroke picker with instant feedback: the number and panel change colour with the
 * score, and the name pops in with an emoji (🐦 birdie, 🦅 eagle…). Good scores buzz.
 */
export function StrokePicker({
  strokes,
  par,
  onChange,
  label,
}: {
  strokes: number;
  par: Par;
  onChange: (v: number) => void;
  label?: string;
}) {
  const look = scoreLook(strokes, par);
  const set = (v: number) => {
    const next = scoreLook(v, par).tone;
    if (next !== look.tone && (next === 'ace' || next === 'eagle' || next === 'birdie')) haptic('success');
    onChange(v);
  };
  return (
    <div className={`stroke-picker tone-${look.tone}`}>
      {label && <p className="label">{label}</p>}
      <StrokeDial value={strokes} min={LIMITS.minStrokes} max={LIMITS.maxStrokes} par={par} onChange={set} />
      <p key={look.tone} className="score-name pop" aria-live="polite">
        <span className="score-emoji" aria-hidden>
          {look.emoji}
        </span>
        {scoreName(strokes, par)}
      </p>
    </div>
  );
}

const DIAL_STEP = 30; // degrees per stroke: 12 notches a lap, like a clock
const DIAL_SIZE = 260;
const DIAL_R = 104; // ring radius
const DIAL_C = DIAL_SIZE / 2;

/** Point on the ring at an angle (0° = 12 o'clock, clockwise). */
function ringPoint(deg: number, r = DIAL_R): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [DIAL_C + r * Math.cos(rad), DIAL_C + r * Math.sin(rad)];
}

/** SVG arc from 12 o'clock round to `deg` (up to a full circle). */
function arcPath(deg: number): string {
  const d = Math.max(0, Math.min(359.99, deg));
  if (d <= 0) return '';
  const [x0, y0] = ringPoint(0);
  const [x1, y1] = ringPoint(d);
  return `M ${x0} ${y0} A ${DIAL_R} ${DIAL_R} 0 ${d > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/**
 * Combination-lock style dial: the stroke count sits in the middle and you drag the knob
 * round the ring to change it. Each notch (30°, 12 a lap like a clock) clicks with a buzz.
 * Going past 12 carries on round to 13+. The ring fills in the score's colour.
 */
export function StrokeDial({
  value,
  min,
  max,
  par,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  par: number;
  onChange: (v: number) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ startValue: number; lastAngle: number; turned: number } | null>(null);
  const [live, setLive] = useState<number | null>(null); // knob angle while dragging
  const [bump, setBump] = useState(0);

  const angleAt = (e: { clientX: number; clientY: number }) => {
    const box = svg.current!.getBoundingClientRect();
    const x = e.clientX - (box.left + box.width / 2);
    const y = e.clientY - (box.top + box.height / 2);
    return ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360;
  };

  const set = (v: number) => {
    const next = Math.min(max, Math.max(min, v));
    if (next === value) return;
    haptic('light');
    setBump((b) => b + 1);
    onChange(next);
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    svg.current?.setPointerCapture(e.pointerId);
    drag.current = { startValue: value, lastAngle: angleAt(e), turned: 0 };
    setLive(value * DIAL_STEP);
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const a = angleAt(e);
    let delta = a - d.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    d.lastAngle = a;
    // Stop the knob at the ends instead of letting it wind past them.
    const lo = (min - d.startValue) * DIAL_STEP;
    const hi = (max - d.startValue) * DIAL_STEP;
    d.turned = Math.min(hi, Math.max(lo, d.turned + delta));
    setLive(d.startValue * DIAL_STEP + d.turned);
    set(d.startValue + Math.round(d.turned / DIAL_STEP));
  };

  const onUp = () => {
    drag.current = null;
    setLive(null); // the knob snaps to the notch
  };

  const knobDeg = live ?? value * DIAL_STEP;
  const [kx, ky] = ringPoint(knobDeg);
  const fill = live ?? value * DIAL_STEP;
  const lapped = value > 12;
  const [px, py] = ringPoint(par * DIAL_STEP, DIAL_R + 26);

  return (
    <div className="dial">
      <svg
        ref={svg}
        className={`dial-svg ${live !== null ? 'turning' : ''}`}
        viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
        role="slider"
        aria-label="Strokes taken"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') set(value + 1);
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') set(value - 1);
        }}
      >
        <circle className={`dial-track ${lapped ? 'lapped' : ''}`} cx={DIAL_C} cy={DIAL_C} r={DIAL_R} />
        <path className="dial-fill" d={arcPath(lapped ? fill - 360 : fill)} />
        {Array.from({ length: 12 }, (_, i) => {
          const [x0, y0] = ringPoint(i * DIAL_STEP, DIAL_R - 20);
          const [x1, y1] = ringPoint(i * DIAL_STEP, DIAL_R - 13);
          return <line key={i} className="dial-tick" x1={x0} y1={y0} x2={x1} y2={y1} />;
        })}
        <text className="dial-par" x={px} y={py} textAnchor="middle" dominantBaseline="central">
          ⛳
        </text>
        <circle className="dial-knob" cx={kx} cy={ky} r={21} />
        <circle className="dial-knob-dot" cx={kx} cy={ky} r={6} />
      </svg>
      <div className="dial-centre" aria-hidden>
        <span key={bump} className={`stepper-value dial-value ${bump ? 'bump' : ''}`}>
          {value}
        </span>
      </div>
      <div className="dial-steps">
        <button type="button" className="dial-step press" aria-label="Fewer strokes" disabled={value <= min} onClick={() => set(value - 1)}>
          <MinusIcon />
        </button>
        <button type="button" className="dial-step press" aria-label="More strokes" disabled={value >= max} onClick={() => set(value + 1)}>
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [bump, setBump] = useState(0);
  const change = (v: number) => {
    if (v < min || v > max) return;
    onChange(v);
    setBump((b) => b + 1);
  };
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper-btn press"
        aria-label={`Fewer ${label}`}
        disabled={value <= min}
        onClick={() => change(value - 1)}
      >
        <MinusIcon />
      </button>
      <span key={bump} className={`stepper-value ${bump ? 'bump' : ''}`} aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="stepper-btn press"
        aria-label={`More ${label}`}
        disabled={value >= max}
        onClick={() => change(value + 1)}
      >
        <PlusIcon />
      </button>
    </div>
  );
}

export function Toggle({
  on,
  title,
  detail,
  onChange,
  disabled,
}: {
  on: boolean;
  title: string;
  detail?: string;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="toggle-row press" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}>
      <span style={{ flex: 1 }}>
        <span className="h3" style={{ display: 'block', fontSize: 21 }}>
          {title}
        </span>
        {detail && (
          <span className="muted small" style={{ display: 'block', marginTop: 3, fontWeight: 700 }}>
            {detail}
          </span>
        )}
      </span>
      <span className={`toggle ${on ? 'on' : ''}`} aria-hidden />
    </button>
  );
}

// ── Chrome ──────────────────────────────────────────────────────────────────

/** Simple top bar with a back button. */
export function BackBar({ title, right, onBack = back }: { title?: ReactNode; right?: ReactNode; onBack?: () => void }) {
  return (
    <div className="topbar">
      <button type="button" className="icon-btn press" aria-label="Back" onClick={onBack}>
        <BackIcon />
      </button>
      <div className="topbar-title h3">{title}</div>
      {right}
    </div>
  );
}

export function Sheet({ title, children, onClose = closeSheet }: { title?: ReactNode; children: ReactNode; onClose?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip" />
        {title && (
          <div className="sheet-head">
            <h2 className="h2" style={{ flex: 1 }}>
              {title}
            </h2>
            <button type="button" className="icon-btn press" aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** Soft colour blobs behind a screen. */
export function Blobs({ colors = ['#14b8a6', '#f97316', '#8b5cf6'] }: { colors?: string[] }) {
  const spots = [
    { left: '-18%', top: '-8%', size: 300 },
    { right: '-22%', top: '30%', size: 280 },
    { left: '10%', bottom: '-12%', size: 320 },
  ];
  return (
    <div className="blobs" aria-hidden>
      {spots.map((s, i) => (
        <i
          key={i}
          style={{
            left: s.left,
            right: s.right,
            top: s.top,
            bottom: s.bottom,
            width: s.size,
            height: s.size,
            background: colors[i % colors.length],
            animationDelay: `${i * -4}s`,
          }}
        />
      ))}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="center" style={{ gap: 14, padding: 24 }}>
      <span className="spinner" style={{ color: 'var(--blue)' }} aria-hidden />
      {label && <span className="h3">{label}</span>}
    </div>
  );
}
