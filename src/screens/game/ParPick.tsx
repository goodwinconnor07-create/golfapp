import type { Game, Par } from '../../game';
import { dispatch } from '../../state/store';

// Colour for fun, not meaning (product owner): blue, green and purple.
const PARS: { par: Par; className: string }[] = [
  { par: 3, className: 'btn-blue' },
  { par: 4, className: 'btn-green' },
  { par: 5, className: 'btn-insane' },
];

export function ParPick({ game }: { game: Game }) {
  return (
    <div className="screen-body center" style={{ justifyContent: 'center', paddingBottom: '12vh' }}>
      {/* The hole number is in the top bar already. */}
      <h1 className="hero">
        What's the par?
      </h1>
      <div className="par-buttons">
        {PARS.map(({ par, className }) => (
          <button
            key={par}
            type="button"
            className={`btn par-btn ${className}`}
            onClick={() => dispatch({ type: 'setPar', hole: game.current, par })}
          >
            <small>PAR</small>
            {par}
          </button>
        ))}
      </div>
    </div>
  );
}
