import { useEffect, useMemo } from 'react';
import { clearFlood } from '../state/store';
import { reducedMotion } from './effects';

const COUNT = 26;

/** Someone reacted to your hole: their emoji pours up the screen for a moment. Never blocks taps. */
export function Flood({ emoji, name }: { emoji: string; name: string }) {
  const still = reducedMotion();
  const drops = useMemo(
    () =>
      Array.from({ length: still ? 0 : COUNT }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 700,
        size: 28 + Math.random() * 36,
        drift: (Math.random() - 0.5) * 80,
        spin: (Math.random() - 0.5) * 60,
      })),
    [still],
  );
  useEffect(() => {
    const t = setTimeout(clearFlood, 2600);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flood" aria-live="polite">
      <span className="sr-only">{`${name} reacted ${emoji}`}</span>
      {drops.map((d, i) => (
        <span
          key={i}
          className="flood-drop"
          aria-hidden
          style={{
            left: `${d.left}%`,
            fontSize: d.size,
            animationDelay: `${d.delay}ms`,
            ['--drift' as string]: `${d.drift}px`,
            ['--spin' as string]: `${d.spin}deg`,
          }}
        >
          {emoji}
        </span>
      ))}
      <span className="flood-tag" aria-hidden>
        {name} {emoji}
      </span>
    </div>
  );
}
