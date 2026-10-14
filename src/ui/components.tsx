import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SVGProps,
} from 'react';
import { AVATAR_EMOJIS, formatDelta, formatToPar, LIMITS, TIERS, type Outcome, type Par, type Player, type Tier } from '../game';
import { haptic, reducedMotion } from './effects';
import { BLOB_COLORS, PLAYER_COLORS } from './theme';
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
    <span className={`chip tier-chip tier-${tier}${big ? ' chip-big' : ''}`} aria-label={t.label}>
      <TierIcon tier={tier} size={big ? 20 : 17} />
      <span className="chip-label">{t.label}</span>
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

export { PLAYER_COLORS } from './theme';

export function playerColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

export function Avatar({ player, size = 44 }: { player: Pick<Player, 'name' | 'color' | 'emoji'>; size?: number }) {
  const initial = [...player.name.trim()][0] ?? '?';
  return (
    <span
      className={`avatar${player.emoji ? ' avatar-emoji' : ''}`}
      style={{ width: size, height: size, fontSize: size * (player.emoji ? 0.56 : 0.46), background: playerColor(player.color) }}
      aria-hidden
    >
      {player.emoji ?? initial}
    </span>
  );
}

/** Pick a picture: an emoji (or your letter) and a background colour. Colours others have are greyed out. */
export function LookPicker({
  name,
  emoji,
  color,
  taken = [],
  onChange,
}: {
  name: string;
  emoji: string | null;
  color: number;
  taken?: number[];
  onChange: (look: { emoji: string | null; color: number }) => void;
}) {
  const initial = [...name.trim()][0]?.toUpperCase() ?? 'A';
  return (
    <div className="look-picker">
      <p className="section-title">Picture</p>
      <div className="look-grid" role="radiogroup" aria-label="Picture">
        {[null, ...AVATAR_EMOJIS].map((e) => (
          <button
            key={e ?? 'letter'}
            type="button"
            role="radio"
            aria-checked={emoji === e}
            aria-label={e ?? 'Your letter'}
            className={`look-option press${emoji === e ? ' on' : ''}`}
            onClick={() => {
              haptic('light');
              onChange({ emoji: e, color });
            }}
          >
            {e ?? <span className="look-letter">{initial}</span>}
          </button>
        ))}
      </div>
      <p className="section-title">Colour</p>
      <div className="look-colors" role="radiogroup" aria-label="Colour">
        {PLAYER_COLORS.map((c, i) => {
          const isTaken = taken.includes(i) && i !== color;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === i}
              aria-label={`Colour ${i + 1}${isTaken ? ', taken' : ''}`}
              disabled={isTaken}
              className={`look-color press${color === i ? ' on' : ''}`}
              style={{ background: c }}
              onClick={() => {
                haptic('light');
                onChange({ emoji, color: i });
              }}
            />
          );
        })}
      </div>
    </div>
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
      <Stepper value={strokes} min={LIMITS.minStrokes} max={LIMITS.maxStrokes} onChange={set} label="strokes" />
      <p key={look.tone} className="score-name pop" aria-live="polite">
        <span className="score-emoji" aria-hidden>
          {look.emoji}
        </span>
        {scoreName(strokes, par)}
      </p>
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
  // Latest value for the hold-to-repeat timer, which outlives a render.
  const latest = useRef(value);
  latest.current = value;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const change = (dir: 1 | -1) => {
    const v = latest.current + dir;
    if (v < min || v > max) return false;
    latest.current = v;
    onChange(v);
    setBump((b) => b + 1);
    return true;
  };
  // Press: one step now; keep holding and it keeps counting.
  const press = (dir: 1 | -1) => {
    stop();
    if (!change(dir)) return;
    const repeat = (delay: number) => {
      timer.current = setTimeout(() => {
        if (change(dir)) repeat(110);
      }, delay);
    };
    repeat(420);
  };
  const stop = () => clearTimeout(timer.current);
  useEffect(() => stop, []);

  const button = (dir: 1 | -1) => (
    <button
      type="button"
      className="stepper-btn press"
      aria-label={`${dir < 0 ? 'Fewer' : 'More'} ${label}`}
      disabled={dir < 0 ? value <= min : value >= max}
      onPointerDown={(e) => {
        e.preventDefault();
        press(dir);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      // Keyboard and screen readers click without a pointer.
      onClick={(e) => {
        if (e.detail === 0) change(dir);
      }}
    >
      {dir < 0 ? <MinusIcon /> : <PlusIcon />}
    </button>
  );

  return (
    <div className="stepper" role="group" aria-label={label}>
      {button(-1)}
      <span key={bump} className={`stepper-value ${bump ? 'bump' : ''}`} aria-live="polite">
        {value}
      </span>
      {button(1)}
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
  const leaving = useApp((s) => s.sheetLeaving);
  const drag = useRef<{ startY: number; dy: number } | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Swipe down on the grip or title to close. Past 90px (or a quick flick) it closes; otherwise it springs back.
  const onDown = (e: ReactPointerEvent) => {
    // Leave taps on the close button alone.
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { startY: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ref.current?.classList.add('dragging');
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drag.current || !ref.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.startY);
    ref.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    const el = ref.current;
    if (!d || !el) return;
    el.classList.remove('dragging');
    if (d.dy > 90) {
      // Carry on down from where the finger let go.
      el.style.setProperty('--drag', `${d.dy}px`);
      onClose();
    }
    el.style.transform = '';
  };
  const dragProps = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp };

  return (
    <div className={`sheet-backdrop${leaving ? ' leaving' : ''}`} onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-grip-zone" {...dragProps}>
          <div className="sheet-grip" />
        </div>
        {title && (
          <div className="sheet-head" {...dragProps}>
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
export function Blobs({ colors = BLOB_COLORS }: { colors?: string[] }) {
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

// ── How a hole adds up ──────────────────────────────────────────────────────

type SumOpts = { doubled?: boolean; freePass?: boolean };

/**
 * A hole's working, all against par so it adds up to the big number:
 * golf "Bogey +1", card "Card −4". Real strokes stay visible elsewhere (stroke picker, scorecard).
 */
export function breakdownParts(strokes: number, par: Par, adjustment: number, opts: SumOpts = {}): { golf: string; card: string } {
  const diff = strokes - par;
  const name = scoreName(strokes, par);
  // scoreName falls back to "+5" for big numbers; don't print it twice. Plain "Par", never "Par 0".
  const golf = /^[+−-]?\d/.test(name) ? formatDelta(diff) : diff === 0 ? name : `${name} ${formatDelta(diff)}`;
  let card = `Card ${formatDelta(adjustment)}`;
  if (opts.freePass && adjustment === 0) card = 'Card 0 · free shot';
  else if (opts.doubled && adjustment !== 0) card += ' (2×)';
  return { golf, card };
}

/**
 * The working as pills: [Bogey +1] + [✓ Card −4], plus "= −3" when total is set.
 * The card pill is green when made and red when missed, with ✓/✗ so colour isn't the only cue.
 */
export function Breakdown({
  strokes,
  par,
  adjustment,
  outcome,
  total,
  big,
  ...opts
}: { strokes: number; par: Par; adjustment: number; outcome: Outcome; total?: boolean; big?: boolean } & SumOpts) {
  const { golf, card } = breakdownParts(strokes, par, adjustment, opts);
  const mark = outcome === 'made' ? '✓ ' : outcome === 'missed' ? '✗ ' : '';
  return (
    <span className={`breakdown${big ? ' big' : ''}`} aria-label={`${golf} plus ${card}`}>
      <span className="pill pill-golf">{golf}</span>
      <span className="pill-op">+</span>
      {/* The card pill and the total wrap together, so "= −3" never sits alone. */}
      <span className="pill-group">
        <span className={`pill pill-${outcome}`}>
          {mark}
          {card}
        </span>
        {total && (
          <>
            <span className="pill-op">=</span>
            <b className="pill-total">{formatToPar(strokes - par + adjustment)}</b>
          </>
        )}
      </span>
    </span>
  );
}

/**
 * A number that ticks to its value instead of jumping: from `from` on first show, then from
 * wherever it was when the value changes. ~450ms, ease-out. Reduced motion shows it straight away.
 */
export function CountUp({ value, from = 0, format = String }: { value: number; from?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(reducedMotion() ? value : from);
  const current = useRef(shown);
  useEffect(() => {
    const start = current.current;
    if (start === value || reducedMotion()) {
      current.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 450);
      const n = Math.round(start + (value - start) * (1 - (1 - p) ** 3));
      current.current = n;
      setShown(n);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}

/**
 * A hole's working as one pill in two halves: the golf score, then the card (its level's icon,
 * ✓ or ✗, and what it was worth). Together they add up to the big number. Doubled holes show 2×.
 */
export function Working({
  strokes,
  par,
  adjustment,
  outcome,
  tier,
  doubled,
}: {
  strokes: number;
  par: Par;
  adjustment: number;
  outcome: Outcome;
  tier: Tier;
  doubled?: boolean;
}) {
  // Golfers just say "a double": shorter names keep the pill on one line in a narrow row.
  const golf = breakdownParts(strokes, par, adjustment).golf.replace(/^(Double|Triple) bogey/, '$1');
  const label = `${golf}, ${TIERS[tier].label} card ${outcome === 'made' ? 'completed' : outcome === 'missed' ? 'failed' : 'no change'} ${formatDelta(adjustment)}${doubled ? ', doubled' : ''}`;
  return (
    <span className="working" aria-label={label}>
      <span className="working-golf">{golf}</span>
      <span className={`working-card ${outcome}`}>
        <span className={`working-tier tier-ink-${tier}`}>
          <TierIcon tier={tier} size={14} />
        </span>
        {/* Colour says completed or failed; the label says it for screen readers. */}
        {formatDelta(adjustment)}
        {doubled && adjustment !== 0 && <span className="working-x">2×</span>}
      </span>
    </span>
  );
}

/** Small grey notes beside a name: mulligan, free shot. Kept quiet so the score reads first. */
export function HoleMeta({ mulligan, freePass, children }: { mulligan?: boolean; freePass?: boolean; children?: ReactNode }) {
  if (!mulligan && !freePass && !children) return null;
  return (
    <span className="hole-meta">
      {mulligan && <span>🔁 Mulligan</span>}
      {freePass && <span>🛟 Free shot</span>}
      {children}
    </span>
  );
}
