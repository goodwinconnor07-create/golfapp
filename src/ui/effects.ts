// Instant feedback: haptics, tap ripples and confetti. All of it is skipped
// when the phone asks for reduced motion, and none of it blocks the game.

type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'error';

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 24,
  success: [14, 50, 22],
  error: [32, 40, 32],
};

export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Vibrates where the phone supports it (Android). iPhones ignore this quietly. */
export function haptic(kind: HapticKind = 'light'): void {
  try {
    navigator.vibrate?.(PATTERNS[kind]);
  } catch {
    // Not supported.
  }
}

/** One listener for the whole app: every .btn gets a ripple from the touch point and a tiny buzz. */
export function installPressEffects(): void {
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>('.btn, .press');
      if (!target || target.hasAttribute('disabled')) return;
      haptic('light');
      if (reducedMotion()) return;
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      target.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    },
    { passive: true },
  );
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  spin: number;
  angle: number;
  shape: 0 | 1;
}

export const CONFETTI = {
  party: ['#f97316', '#ec4899', '#8b5cf6', '#14b8a6', '#facc15', '#3b82f6'],
  safe: ['#14b8a6', '#0d9488', '#5eead4', '#facc15'],
  bold: ['#fb923c', '#ea580c', '#fdba74', '#facc15'],
  insane: ['#a855f7', '#7c3aed', '#d946ef', '#f0abfc', '#facc15'],
};

/** Short confetti burst from a point (defaults to the middle of the screen). */
export function confetti(colors: string[] = CONFETTI.party, origin?: { x: number; y: number }, amount = 90): void {
  if (reducedMotion() || typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const ox = origin?.x ?? innerWidth / 2;
  const oy = origin?.y ?? innerHeight * 0.4;
  const pieces: Piece[] = Array.from({ length: amount }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6 + Math.random() * 10;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 7,
      size: 7 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      spin: (Math.random() - 0.5) * 0.4,
      angle: Math.random() * Math.PI,
      shape: Math.random() < 0.5 ? 0 : 1,
    };
  });

  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of pieces) {
      p.vy += 0.38;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 1600);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (t < 1600) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
