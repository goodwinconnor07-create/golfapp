import { newLeader, overtakes, type Game } from '../../game';

/** "🏎️ Sam overtakes Alex" for each pass on the last hole (the lead change has its own banner). */
export function Overtakes({ game }: { game: Game }) {
  const leader = newLeader(game, game.current);
  const passes = overtakes(game).filter((o) => o.by.id !== leader?.id);
  if (passes.length === 0) return null;
  const shown = passes.slice(0, 3);
  return (
    <div className="overtakes" role="status">
      {shown.map((o, i) => (
        <div key={`${o.by.id}-${o.passed.id}`} className="overtake" style={{ animationDelay: `${1100 + i * 160}ms` }}>
          🏎️ <b>{o.by.name}</b> overtakes {o.passed.name}
        </div>
      ))}
      {passes.length > shown.length && <div className="note">+{passes.length - shown.length} more</div>}
    </div>
  );
}
