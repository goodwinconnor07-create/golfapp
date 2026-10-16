import type { ReactNode } from 'react';
import { formatToPar, type Player, type StandingRow } from '../game';
import { Avatar, CountUp } from './components';

/**
 * The one row layout for standings and hole results, on a three-column grid:
 *   [avatar with a rank badge] [name, then one detail line] [big score]
 * The name gets the full middle width; everything else (the working, mulligans, votes,
 * movement) sits on the detail line underneath, so nothing squeezes the name.
 */
export function PlayerRow({
  player,
  rank,
  place,
  name,
  detail,
  score,
  scoreLabel = 'To par',
  className = '',
  style,
  hidden,
}: {
  player: Player;
  /** "1", "=2"… shown as a badge on the avatar. */
  rank?: string;
  /** Race-style place in front of the avatar (standings): 1st, 2nd, =3rd… Replaces the avatar badge. */
  place?: { n: number; tied: boolean };
  /** What to show as the name (defaults to the player's name), e.g. with a 👑. */
  name?: ReactNode;
  detail?: ReactNode;
  score: ReactNode;
  scoreLabel?: string | null;
  className?: string;
  style?: React.CSSProperties;
  hidden?: boolean;
}) {
  return (
    <div className={`prow ${place ? 'race' : ''} ${className}`} style={style} aria-hidden={hidden}>
      {place && (
        <span className={`race-place p${place.n}`} aria-label={`${place.tied ? 'tied ' : ''}${ordinal(place.n)}`}>
          {place.tied ? '=' : ''}
          {place.n}
          <sup>{suffix(place.n)}</sup>
        </span>
      )}
      <span className="prow-avatar">
        <Avatar player={player} size={place ? 40 : 44} />
        {rank && !place && <span className="prow-rank">{rank}</span>}
      </span>
      <span className="prow-main">
        <span className="prow-name">{name ?? player.name}</span>
        {detail && <span className="prow-detail">{detail}</span>}
      </span>
      <span className="prow-score">
        <b>{score}</b>
        {scoreLabel && <small>{scoreLabel}</small>}
      </span>
    </div>
  );
}

const suffix = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'));
const ordinal = (n: number) => `${n}${suffix(n)}`;

/**
 * One standings line, race style: a big place (gold, silver, bronze), the row sliding from its old
 * spot to the new one, and a ▲/▼ chip for places gained or lost on the last hole. Ties show as "=2nd".
 * move: places gained (+) or lost (−) since the hole before.
 */
export function BoardRow({ row, sub, delay, move = 0 }: { row: StandingRow; sub?: ReactNode; delay?: number; move?: number }) {
  return (
    <PlayerRow
      player={row.player}
      place={{ n: row.rank, tied: row.tied }}
      name={
        <>
          {row.player.name}
          {move !== 0 && (
            <span className={`move-chip ${move > 0 ? 'up' : 'down'}`} aria-label={move > 0 ? `up ${move}` : `down ${-move}`}>
              {move > 0 ? '▲' : '▼'}
              {Math.abs(move)}
            </span>
          )}
        </>
      }
      // Rows that changed place slide from where they were (move places away) into their new spot.
      className={`board-row ${row.rank === 1 ? 'first' : ''} ${move !== 0 ? `reorder ${move > 0 ? 'climbed' : 'dropped'}` : delay != null ? 'rise' : ''}`}
      style={{
        ...(delay != null ? { animationDelay: `${delay}ms` } : {}),
        ...(move !== 0 ? ({ '--from': move } as React.CSSProperties) : {}),
      }}
      detail={sub}
      score={
        <span aria-label={formatToPar(row.totals.toPar)}>
          <CountUp value={row.totals.toPar} format={formatToPar} />
        </span>
      }
    />
  );
}
