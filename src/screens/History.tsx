import { useState } from 'react';
import { formatToPar } from '../game';
import { loadHistory, type GameRecord } from '../state/persist';
import { clearHistory } from '../state/store';
import { Avatar, BackBar } from '../ui/components';
import { TrophyIcon } from '../ui/Icons';

const dateText = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** Past rounds saved on this phone. Tap one to see everyone's score. */
export function History() {
  const [records, setRecords] = useState<GameRecord[]>(loadHistory);
  const [open, setOpen] = useState<string | null>(null);

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
              <button
                key={r.id}
                type="button"
                className="history-row press"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : r.id)}
              >
                <span className="history-head">
                  <span className="history-trophy" aria-hidden>
                    <TrophyIcon width={22} height={22} />
                  </span>
                  <span className="history-text">
                    <b>{winners.map((p) => p.name).join(' & ')}</b>
                    <small>
                      {dateText(r.finishedAt)} · {r.course ? `${r.course} · ` : ''}
                      {r.holes} {r.holes === 1 ? 'hole' : 'holes'}
                    </small>
                  </span>
                  <span className="history-score">{formatToPar(winners[0]?.toPar ?? 0)}</span>
                </span>
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
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {records.length > 0 && (
        <div className="screen-foot">
          <button type="button" className="btn btn-link" onClick={() => clearHistory(() => setRecords([]))}>
            Clear past games
          </button>
        </div>
      )}
    </div>
  );
}
