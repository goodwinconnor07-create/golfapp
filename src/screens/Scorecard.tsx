import { useState } from 'react';
import { completedHoles, formatSigned, getEntry, holeResult, playerTotals } from '../game';
import { openSheet, useApp } from '../state/store';
import { isHost } from '../state/view';
import { Avatar, BackBar, TIER_LOOK } from '../ui/components';

export function Scorecard() {
  const game = useApp((s) => s.game);
  const deviceId = useApp((s) => s.deviceId);
  const [tab, setTab] = useState<'real' | 'game'>('real');
  if (!game) return null;

  const host = isHost(game, deviceId);
  const holes = completedHoles(game);
  const totals = game.players.map((p) => playerTotals(game, p.id, holes));
  const lastPlayed = game.status === 'finished' ? game.holes.length - 1 : game.current;

  return (
    <div className="screen">
      <BackBar title="Scorecard" />
      <div className="screen-body">
        <div className="segmented" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'real'}
            className={tab === 'real' ? 'on' : ''}
            onClick={() => setTab('real')}
          >
            Real strokes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'game'}
            className={tab === 'game' ? 'on' : ''}
            onClick={() => setTab('game')}
          >
            Game score
          </button>
        </div>
        <p className="note">Tap a score to fix it.</p>

        <div className="sc-wrap">
          <table className="sc">
            <thead>
              <tr>
                <th>Hole</th>
                <th>Par</th>
                {game.players.map((p) => (
                  <th key={p.id}>
                    <span className="sc-head">
                      {host ? (
                        <button
                          type="button"
                          className="press"
                          style={{ border: 0, background: 'none', padding: 0 }}
                          aria-label={`Edit ${p.name}`}
                          onClick={() => openSheet({ name: 'player', playerId: p.id })}
                        >
                          <Avatar player={p} size={32} />
                        </button>
                      ) : (
                        <Avatar player={p} size={32} />
                      )}
                      {p.name.length > 7 ? `${p.name.slice(0, 6)}…` : p.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {game.holes.map((hole, i) => (
                <tr key={i}>
                  <td className="sc-hole">{hole.number}</td>
                  <td>
                    {host && i <= lastPlayed ? (
                      <button
                        type="button"
                        className="sc-par press"
                        aria-label={`Par for hole ${hole.number}`}
                        onClick={() => openSheet({ name: 'pars' })}
                      >
                        {hole.par ?? '–'}
                      </button>
                    ) : (
                      <span className="sc-par" style={{ display: 'inline-grid', placeItems: 'center' }}>
                        {hole.par ?? '–'}
                      </span>
                    )}
                  </td>
                  {game.players.map((p) => {
                    const entry = getEntry(game, p.id, i);
                    const r = holeResult(game, p.id, i);
                    const editable = i <= lastPlayed && Boolean(entry?.cardId) && game.status !== 'lobby';
                    const value = r ? (tab === 'real' ? r.strokes : formatSigned(r.gameScore)) : (entry?.strokes ?? '·');
                    const cls = r ? (tab === 'game' ? r.outcome : '') : 'empty';
                    const inner = (
                      <>
                        {tab === 'game' && r && <span className="dot" style={{ background: TIER_LOOK[r.tier].color }} />}
                        {value}
                      </>
                    );
                    return (
                      <td key={p.id}>
                        {editable ? (
                          <button
                            type="button"
                            className={`sc-cell press ${cls}`}
                            aria-label={`${p.name}, hole ${hole.number}`}
                            onClick={() =>
                              openSheet({
                                name: 'edit',
                                playerId: p.id,
                                hole: i,
                              })
                            }
                          >
                            {inner}
                          </button>
                        ) : (
                          <span className={`sc-cell ${cls}`}>{inner}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="sc-total">
                <td className="sc-hole">Total</td>
                <td />
                {totals.map((t, j) => (
                  <td key={game.players[j].id}>
                    <span className="sc-cell">{tab === 'real' ? t.real : formatSigned(t.game)}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {tab === 'game' && <p className="note">Green = card made, red = missed. The dot shows the level.</p>}
      </div>
    </div>
  );
}
