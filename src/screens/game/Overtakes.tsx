import { newLeader, overtakes, type Game } from '../../game';

/**
 * "🏎️ Sam overtakes Alex" for each pass on the hole, led by "👑 Sam takes the lead" when the
 * lead changed (one line for it here; the big moment between holes is the only other mention).
 */
export function Overtakes({ game, hole = game.current }: { game: Game; hole?: number }) {
  const leader = newLeader(game, hole);
  const passes = overtakes(game, hole).filter((o) => o.by.id !== leader?.id);
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
