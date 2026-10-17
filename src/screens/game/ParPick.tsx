import type { Game, Par } from '../../game';
import { dispatch } from '../../state/store';

// One colour for all three: par 3, 4 and 5 aren't better or worse than each other.
const PARS: Par[] = [3, 4, 5];

export function ParPick({ game }: { game: Game }) {
  return (
    <div className="screen-body center" style={{ justifyContent: 'center', paddingBottom: '12vh' }}>
      {/* The hole number is in the top bar already. */}
      <h1 className="hero">
        What's the par?
      </h1>
      <div className="par-buttons">
        {PARS.map((par) => (
          <button
            key={par}
            type="button"
            className="btn par-btn btn-dark"
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
