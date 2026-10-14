import { completedHoles, getEntry, holeResult, playerTotals, formatToPar, scoreAccess } from '../game';
import { EditList } from './game/EditList';
import { openSheet, useApp } from '../state/store';
import { isHost } from '../state/view';
import { Avatar, BackBar, TIER_LOOK } from '../ui/components';

export function Scorecard() {
  const game = useApp((s) => s.game);
  const deviceId = useApp((s) => s.deviceId);
  if (!game) return null;

  const host = isHost(game, deviceId);
  const holes = completedHoles(game);
  const totals = game.players.map((p) => playerTotals(game, p.id, holes));
  const lastPlayed = game.status === 'finished' ? game.holes.length - 1 : game.current;

  return (
    <div className="screen">
      <BackBar title="Scorecard" />
      <div className="screen-body">
        <p className="note">{game.code && !host ? 'Tap a score to fix it, or ask to change a locked-in one.' : 'Tap a score to fix it.'}</p>

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
                      i <= lastPlayed && Boolean(entry?.cardId) && game.status !== 'lobby' && scoreAccess(game, deviceId, p.id, i) !== 'none';
                    const edited = game.edits?.some((e) => e.playerId === p.id && e.hole === i);
                    const value = r ? formatToPar(r.toPar) : '·';
                    const cls = `${r ? r.outcome : 'empty'}${edited ? ' edited' : ''}`;
                    const inner = (
                      <>
                        {r && <span className="dot" style={{ background: TIER_LOOK[r.tier].color }} />}
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
                    <span className="sc-cell">{formatToPar(t.toPar)}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="note">Green = challenge completed, red = failed. The dot shows the level. Lowest score wins.</p>
        <EditList game={game} />
        <p className="note">
          <b>Strokes taken:</b> {game.players.map((p, j) => `${p.name} ${totals[j].real}`).join(' · ')}
        </p>
      </div>
    </div>
  );
}
