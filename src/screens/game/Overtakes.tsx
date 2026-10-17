import { useEffect } from 'react';
import { newLeader, overtakes, type Game } from '../../game';
import { confetti, CONFETTI, haptic, reducedMotion } from '../../ui/effects';

/** Holes whose new leader has had their confetti, so coming back to the screen doesn't fire it again. */
const cheered = new Set<string>();

/**
 * "🏎️ Sam overtakes Alex" for each pass on the hole, led by "👑 Sam takes the lead" when the
 * lead changed. This line is the one place a new leader is announced; it brings the confetti.
 */
export function Overtakes({ game, hole = game.current }: { game: Game; hole?: number }) {
  const leader = newLeader(game, hole);
  const passes = overtakes(game, hole).filter((o) => o.by.id !== leader?.id);
  const key = `${game.id}:${hole}`;

  useEffect(() => {
    if (!leader || cheered.has(key)) return;
    cheered.add(key);
    const t = setTimeout(() => {
      haptic('success');
      if (!reducedMotion()) confetti(CONFETTI.party, { x: innerWidth / 2, y: innerHeight * 0.3 }, 90);
    }, 900);
    return () => clearTimeout(t);
  }, [leader?.id, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (passes.length === 0 && !leader) return null;
  const shown = passes.slice(0, leader ? 2 : 3);
  return (
    <div className="overtakes" role="status">
      {leader && (
        <div className="overtake lead" style={{ animationDelay: '900ms' }}>
          👑 <b>{leader.name}</b> takes the lead
        </div>
      )}
      {shown.map((o, i) => (
        <div key={`${o.by.id}-${o.passed.id}`} className="overtake" style={{ animationDelay: `${1100 + i * 160}ms` }}>
          🏎️ <b>{o.by.name}</b> overtakes {o.passed.name}
        </div>
      ))}
      {passes.length > shown.length && <div className="note">+{passes.length - shown.length} more</div>}
    </div>
  );
}
