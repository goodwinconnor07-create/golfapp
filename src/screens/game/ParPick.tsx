import type { Game, Par } from '../../game';
import { dispatch } from '../../state/store';

const PARS: { par: Par; className: string }[] = [
  { par: 3, className: 'btn-blue' },
  { par: 4, className: 'btn-green' },
  { par: 5, className: 'btn-brand' },
];

export function ParPick({ game }: { game: Game }) {
  const hole = game.holes[game.current];
  return (
    <div className="screen-body center" style={{ justifyContent: 'center', paddingBottom: '12vh' }}>
      <p className="eyebrow">Hole {hole.number}</p>
      <h1 className="hero" style={{ marginTop: 8 }}>
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
      <p className="muted" style={{ marginTop: 18 }}>
        It's on the sign at the tee.
      </p>
    </div>
  );
}
