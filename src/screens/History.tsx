import { useState } from 'react';
import { formatToPar } from '../game';
import { loadHistory, type GameRecord } from '../state/persist';
import { clearHistory, navigate, useApp } from '../state/store';
import { Avatar, BackBar } from '../ui/components';
import { TrophyIcon } from '../ui/Icons';

const dateText = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Past rounds saved on this phone. Tap one to see everyone's score. */
export function History() {
  const [records, setRecords] = useState<GameRecord[]>(loadHistory);
  const [open, setOpen] = useState<string | null>(null);
  // The last finished round is still on this phone, so its full results can be opened.
  const lastId = useApp((s) => (s.game?.status === 'finished' ? s.game.id : null));

  return (
    <div className="screen">
      <BackBar title="Past games" />
      <div className="screen-body">
        {records.length === 0 && <p className="note">Finished rounds will show up here.</p>}
        <div className="stack">
          {records.map((r) => {
            const winners = r.players.filter((p) => p.rank === 1);
            const expanded = open === r.id;
            return (
              <div key={r.id} className="history-row">
                <button
                  type="button"
                  className="history-head press"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : r.id)}
                >
                  <span className="history-trophy" aria-hidden>
                    <TrophyIcon width={22} height={22} />
                  </span>
                  {/* The round on top, who won underneath; the full order opens below. */}
                  <span className="history-text">
                    <b>{r.course || dateText(r.finishedAt)}</b>
                    <small>
                      {r.course ? `${dateText(r.finishedAt)} · ` : ''}
                      {r.holes} {r.holes === 1 ? 'hole' : 'holes'}
                      {winners.length > 0 && ` · ${winners.map((p) => p.name).join(' & ')} ${winners.length > 1 ? 'tied' : 'won'}`}
                    </small>
                  </span>
                </button>
                {expanded && (
                  <span className="history-players">
                    {r.players.map((p, i) => (
                      <span key={i} className="history-player">
                        <span className="history-rank">{p.rank}</span>
                        <Avatar player={p} size={32} />
                        <span className="history-name">{p.name}</span>
                        <span className="muted small">{p.strokes} strokes</span>
                        <b>{formatToPar(p.toPar)}</b>
                      </span>
                    ))}
                    {r.id === lastId && (
                      <button type="button" className="btn btn-link history-more" onClick={() => navigate({ name: 'game' })}>
                        See full results
                      </button>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {records.length > 0 && (
        <div className="screen-foot">
          <button type="button" className="btn btn-link danger" onClick={() => clearHistory(() => setRecords([]))}>
            Clear past games
          </button>
        </div>
      )}
    </div>
  );
}
