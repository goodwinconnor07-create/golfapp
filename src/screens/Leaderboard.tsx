import { useState } from 'react';
import { completedHoles, formatSigned, standings } from '../game';
import { useApp } from '../state/store';
import { BoardRow } from '../ui/BoardRow';
import { BackBar } from '../ui/components';
import { plural } from '../ui/format';

export function Leaderboard() {
  const game = useApp((s) => s.game);
  const [tab, setTab] = useState<'game' | 'real'>('game');
  if (!game) return null;

  const holes = completedHoles(game);
  const rows = standings(game, tab, holes);

  return (
    <div className="screen">
      <BackBar title="Leaderboard" />
      <div className="screen-body">
        <div className="segmented" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'game'}
            className={tab === 'game' ? 'on' : ''}
            onClick={() => setTab('game')}
          >
            Game score
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'real'}
            className={tab === 'real' ? 'on' : ''}
            onClick={() => setTab('real')}
          >
            Real strokes
          </button>
        </div>
        <div className="board" key={tab}>
          {rows.map((row, i) => (
            <BoardRow
              key={row.player.id}
              row={row}
              metric={tab}
              delay={i * 50}
              sub={
                tab === 'game' ? (
                  <>
                    Made {row.totals.made} of {plural(row.totals.holes, 'card')}
                  </>
                ) : (
                  <>
                    {plural(row.totals.holes, 'hole')} · game score {formatSigned(row.totals.game)}
                  </>
                )
              }
            />
          ))}
        </div>
        <p className="note">
          {holes.length === 0
            ? 'Totals show up here after the first hole.'
            : tab === 'game'
              ? 'Game score = real strokes ± cards. Lowest wins.'
              : 'Real strokes: how the round went in normal golf.'}
        </p>
      </div>
    </div>
  );
}
