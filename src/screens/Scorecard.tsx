import { useState } from 'react';
import { completedHoles, getEntry, holeResult, playerTotals, formatToPar, scoreAccess, skins } from '../game';
import { EditList } from './game/EditList';
import { openSheet, useApp } from '../state/store';
import { isHost } from '../state/view';
import { Avatar, BackBar, playerColor, TierIcon } from '../ui/components';
import { avatarInk } from '../ui/theme';

/**
 * Hole by hole. Game score (strokes plus cards, against par) by default; Strokes shows the real
 * strokes a golfer would write on a paper card. Tap a cell to fix it.
 */
export function Scorecard() {
  const game = useApp((s) => s.game);
  const deviceId = useApp((s) => s.deviceId);
  const [view, setView] = useState<'game' | 'strokes'>('game');
  if (!game) return null;
  const strokesView = view === 'strokes';

  const host = isHost(game, deviceId);
  const holes = completedHoles(game);
  const totals = game.players.map((p) => playerTotals(game, p.id, holes));
  const won = skins(game);
  const lastPlayed = game.status === 'finished' ? game.holes.length - 1 : game.current;

  return (
    <div className="screen">
      <BackBar title="Scorecard" />
      <div className="screen-body">
        <div className="seg sc-view" role="radiogroup" aria-label="Show">
          {(['game', 'strokes'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              className={`seg-option neutral${view === v ? ' on' : ''}`}
              onClick={() => setView(v)}
            >
              {v === 'game' ? 'Game score' : 'Strokes'}
            </button>
          ))}
        </div>

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
                    const editable =
                      i <= lastPlayed &&
                      Boolean(entry?.cardId) &&
                      game.status !== 'lobby' &&
                      scoreAccess(game, deviceId, p.id, i) !== 'none';
                    const edited = game.edits?.some((e) => e.playerId === p.id && e.hole === i);
                    const value = r ? (strokesView ? String(r.strokes) : formatToPar(r.toPar)) : '·';
                    // Skins are won on game score, so they only show in that view.
                    const skin = !strokesView && won[i]?.playerId === p.id ? won[i] : null;
                    const cls = `${r ? (strokesView ? 'plain' : r.outcome) : 'empty'}${edited ? ' edited' : ''}${r?.mulligan ? ' mulligan' : ''}${skin ? ' skin' : ''}`;
                    const skinStyle = skin
                      ? ({ '--skin': playerColor(p.color), '--skin-ink': avatarInk(playerColor(p.color)) } as React.CSSProperties)
                      : undefined;
                    const inner = (
                      <>
                        {r && !strokesView && (
                          <span className={`sc-tier tier-ink-${r.tier}`}>
                            <TierIcon tier={r.tier} size={12} />
                          </span>
                        )}
                        {value}
                        {r?.mulligan && (
                          <span className="sc-mulligan" aria-label="mulligan used">
                            🔁
                          </span>
                        )}
                        {skin && (
                          <span className="sc-skin" aria-label={skin.worth > 1 ? `won the skin, worth ${skin.worth}` : 'won the skin'}>
                            Skin{skin.worth > 1 && <small> ×{skin.worth}</small>}
                          </span>
                        )}
                      </>
                    );
                    return (
                      <td key={p.id}>
                        {editable ? (
                          <button
                            type="button"
                            className={`sc-cell press ${cls}`}
                            style={skinStyle}
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
                          <span className={`sc-cell ${cls}`} style={skinStyle}>
                            {inner}
                          </span>
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
                    <span className="sc-cell">{strokesView ? t.real : formatToPar(t.toPar)}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note sc-key">
          {strokesView ? (
            'Real strokes on each hole, without the cards.'
          ) : (
            <>
              <b className="good">Green</b>: card completed. <b className="bad">Red</b>: failed.
              {game.players.length > 1 && ' Skin: best score on the hole (a tie carries it to the next).'}
            </>
          )}
        </p>
        <p className="note sc-key">
          {game.code && !host ? 'Tap a score to fix it, or ask to change a locked-in one.' : 'Tap a score to fix it.'}
        </p>
        <EditList game={game} />
      </div>
    </div>
  );
}
