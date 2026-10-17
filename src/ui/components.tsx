import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SVGProps,
} from 'react';
import {
  AVATAR_EMOJIS,
  CODE_LENGTH,
  formatDelta,
  formatToPar,
  isNameBlocked,
  LIMITS,
  NAME_BLOCKED,
  toParWords,
  TIERS,
  type Outcome,
  type Par,
  type Player,
  type Tier,
} from '../game';
import { haptic, reducedMotion } from './effects';
import { avatarInk, BLOB_COLORS, PLAYER_COLORS } from './theme';
import { back, closeSheet, useApp } from '../state/store';
import { BackIcon, BoltIcon, CheckIcon, CloseIcon, CrossIcon, FlameIcon, MinusIcon, PencilIcon, PlusIcon, ShieldIcon } from './Icons';
import { plural } from './format';

// ── Tiers ───────────────────────────────────────────────────────────────────

export const TIER_LOOK: Record<Tier, { Icon: ComponentType<SVGProps<SVGSVGElement>>; color: string }> = {
  safe: { Icon: ShieldIcon, color: 'var(--safe)' },
  bold: { Icon: FlameIcon, color: 'var(--bold)' },
  insane: { Icon: BoltIcon, color: 'var(--insane)' },
};

export function TierIcon({ tier, size = 24 }: { tier: Tier; size?: number }) {
  const { Icon } = TIER_LOOK[tier];
  return <Icon width={size} height={size} />;
}

/**
 * Soft moving shapes behind a tier's colour, so the screen feels live: light glancing off
 * Safe's shields, flames flickering up behind Bold, lightning flashing behind Insane.
 * Decoration only. They sit on the right, behind the text, and stop with Reduce Motion.
 */
export function TierFx({ tier }: { tier: Tier }) {
  const { Icon } = TIER_LOOK[tier];
  return (
    <span className={`tier-fx tier-fx-${tier}`} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`tier-fx-i tier-fx-i${i}`}>
          <Icon width="100%" height="100%" />
        </span>
      ))}
    </span>
  );
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
      style={{
        width: size,
        height: size,
        fontSize: size * (player.emoji ? 0.56 : 0.46),
        background: playerColor(player.color),
        color: avatarInk(playerColor(player.color)),
      }}
      aria-hidden
    >
      {player.emoji ?? initial}
    </span>
  );
}

/**
 * The name step (new game and joining): a big picture of you that opens the picture picker, and a
 * plain name box under it. The picture pops when the look changes, then floats.
 */
export function NameAndPicture({
  name,
  look,
  onName,
  onPicture,
  onDone,
}: {
  name: string;
  look: { emoji: string | null; color: number };
  onName: (name: string) => void;
  onPicture: () => void;
  /** Return on the keyboard. */
  onDone?: () => void;
}) {
  const initial = [...name.trim()][0]?.toUpperCase() ?? '?';
  return (
    <div className="hero-pic">
      <button type="button" className="avatar-button hero-button" aria-label="Change your picture" onClick={onPicture}>
        <span key={`${look.emoji ?? initial}-${look.color}`} className="hero-pop">
          <span className="hero-float">
            <Avatar player={{ name: name || '?', color: look.color, emoji: look.emoji ?? undefined }} size={140} />
            {/* A pencil on the picture says it can be changed. */}
            <span className="hero-edit-badge" aria-hidden>
              <PencilIcon width={20} height={20} />
            </span>
          </span>
        </span>
      </button>
      <div className="name-box">
        <input
          className="field name-field"
          value={name}
          placeholder="Your name"
          aria-label="Your name"
          maxLength={LIMITS.maxNameLength}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint="done"
          autoFocus={!name.trim()}
          onChange={(e) => onName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.currentTarget.blur();
            onDone?.();
          }}
        />
        {isNameBlocked(name) && (
          <p className="field-error" role="alert">
            {NAME_BLOCKED}
          </p>
        )}
      </div>
    </div>
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
        {/* "1 over" in plain words, for anyone who doesn't speak golf. */}
        {strokes !== 1 && strokes !== par && <small className="score-over">{toParWords(strokes - par)}</small>}
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

// ── Loading skeletons ───────────────────────────────────────────────────────
// Grey shapes of what's about to appear. Each card rocks gently side to side (a deck
// being shuffled) so it's clear something is on its way. role="status" + label for screen readers.

/** Rows shaped like course or player rows. */
export function SkeletonRows({ count = 3, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <div className="stack skeleton-deck" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="player-row course-row skeleton-card" style={{ animationDelay: `${i * 120}ms` }}>
          <span className="skeleton skeleton-icon" />
          <span className="course-text">
            <span className="skeleton skeleton-line" />
            <span className="skeleton skeleton-line short" />
          </span>
        </div>
      ))}
    </div>
  );
}

/** The invite code tiles and a button, while a code is on its way. */
export function SkeletonInvite({ label, qr = false }: { label: string; qr?: boolean }) {
  return (
    <div className="stack skeleton-deck" role="status" aria-label={label} style={{ gap: 16 }}>
      <p className="muted skeleton-caption">{label}</p>
      <div className="code-tiles">
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span key={i} className="skeleton skeleton-card skeleton-tile" style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
      {qr && <span className="skeleton skeleton-card skeleton-qr" />}
      <span className="skeleton skeleton-card skeleton-button" />
    </div>
  );
}

/** A game screen: title, the big challenge card and a couple of player rows. */
export function SkeletonGame({ label }: { label: string }) {
  return (
    <div className="stack skeleton-deck" role="status" aria-label={label} style={{ gap: 16, width: '100%' }}>
      <span className="skeleton skeleton-title" />
      <span className="skeleton skeleton-card skeleton-hero" />
      <SkeletonRows count={2} label={label} />
      <p className="muted skeleton-caption">{label}</p>
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

/** The golf half of a hole: "Bogey +1", "Double bogey +2", plain "Par" (never "Par 0"). */
export function golfPart(strokes: number, par: Par): string {
  const diff = strokes - par;
  const name = scoreName(strokes, par);
  // scoreName falls back to "+5" for big numbers; don't print it twice.
  if (/^[+−-]?\d/.test(name)) return formatDelta(diff);
  return diff === 0 ? name : `${name} ${formatDelta(diff)}`;
}

/** ✓ or ✗ as an icon (a typed ✗ reads as "times"), or a dash when the card didn't happen. */
export function OutcomeMark({ outcome, size = 14 }: { outcome: Outcome; size?: number }) {
  if (outcome === 'made') return <CheckIcon width={size} height={size} aria-hidden />;
  if (outcome === 'missed') return <CrossIcon width={size} height={size} aria-hidden />;
  return <span aria-hidden>–</span>;
}

const OUTCOME_WORD: Record<Outcome, string> = { made: 'completed', missed: 'failed', na: "didn't happen" };

/**
 * A hole in two short lines, for result rows: "Bogey +1", then "[level icon] Lag It Close ✓ −2". The
 * golf half, then the card by name with what it was worth: green with ✓ when completed, red with ✗ when failed.
 */
export function Working({
  strokes,
  par,
  adjustment,
  outcome,
  tier,
  cardTitle,
  doubled,
}: {
  strokes: number;
  par: Par;
  adjustment: number;
  outcome: Outcome;
  tier: Tier;
  cardTitle?: string;
  doubled?: boolean;
}) {
  const golf = golfPart(strokes, par);
  const card = cardTitle ?? `${TIERS[tier].label} card`;
  const label = `${golf}, ${card} ${OUTCOME_WORD[outcome]} ${formatDelta(adjustment)}${doubled ? ', doubled' : ''}`;
  return (
    <span className="working" aria-label={label}>
      <span className="working-golf">{golf}</span>
      <span className="working-card">
        <span className={`working-tier tier-ink-${tier}`}>
          <TierIcon tier={tier} size={14} />
        </span>
        <span className="working-title">{card}</span>
        <span className={`working-delta ${outcome}`}>
          <OutcomeMark outcome={outcome} size={13} />
          {formatDelta(adjustment)}
          {doubled && adjustment !== 0 && <span className="working-x">2×</span>}
        </span>
      </span>
    </span>
  );
}

/**
 * A hole's sum written out like a receipt, numbers lined up on the right:
 *   Bogey · 5 strokes      +1
 *   ✓ Card completed       −2
 *   This hole              −1
 * Used wherever the sum is the point: the score splash, Fix a score and How to play.
 */
export function Receipt({
  strokes,
  par,
  adjustment,
  outcome,
  doubled,
  freePass,
  className = '',
}: { strokes: number; par: Par; adjustment: number; outcome: Outcome; className?: string } & SumOpts) {
  const diff = strokes - par;
  let card = `Card ${OUTCOME_WORD[outcome]}`;
  if (freePass && adjustment === 0) card += ' · free shot';
  else if (doubled && adjustment !== 0) card += ' (2×)';
  return (
    <SumTable
      className={className}
      lines={[
        { label: `${scoreName(strokes, par)} · ${plural(strokes, 'stroke')}`, value: formatDelta(diff) },
        { label: card, value: formatDelta(adjustment), tone: outcome, mark: outcome },
      ]}
      total={{ label: 'This hole', value: formatToPar(diff + adjustment) }}
    />
  );
}

export interface SumLine {
  label: string;
  value: string;
  tone?: Outcome;
  mark?: Outcome;
}

/** Lines that add up, with the total under a rule. The one layout for every sum in the app. */
export function SumTable({ lines, total, className = '' }: { lines: SumLine[]; total: SumLine; className?: string }) {
  const spoken = `${lines.map((l) => `${l.label} ${l.value}`).join(', plus ')}, equals ${total.value}`;
  return (
    <div className={`sum-table ${className}`} role="img" aria-label={spoken}>
      {lines.map((l) => (
        <div key={l.label} className={`sum-row${l.tone ? ` ${l.tone}` : ''}`}>
          <span className="sum-label">
            {l.mark && <OutcomeMark outcome={l.mark} size={16} />}
            {l.label}
          </span>
          <b className="num">{l.value}</b>
        </div>
      ))}
      <div className="sum-row sum-total">
        <span className="sum-label">{total.label}</span>
        <b className="num">{total.value}</b>
      </div>
    </div>
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
      // Halves, because a team's average can land on one.
      const n = Math.round((start + (value - start) * (1 - (1 - p) ** 3)) * 2) / 2;
      current.current = n;
      setShown(n);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
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

/**
 * When the strokes alone settle a card (par on "Par Hunter", a double on "Bogey Buffer"…), one slim
 * line says so. Same look on the score screen and in Fix a score.
 */
export function AutoNote({ outcome }: { outcome: 'made' | 'missed' }) {
  return (
    <div className={`auto-result ${outcome} pop`} key={outcome} role="status">
      <OutcomeMark outcome={outcome} size={18} />
      {outcome === 'made' ? 'Your strokes complete this card' : 'Too many strokes to complete this card'}
    </div>
  );
}
