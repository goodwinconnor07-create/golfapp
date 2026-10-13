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
