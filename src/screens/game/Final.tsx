import { useEffect, useMemo } from 'react';
import { formatDelta, getCard, recap, type Game, type Recap, formatToPar, toParWords } from '../../game';
import { navigate, startNewGame, toast } from '../../state/store';
import { BoardRow } from '../../ui/BoardRow';
import { confetti, CONFETTI } from '../../ui/effects';
import { joinNames, plural } from '../../ui/format';
import { BoltIcon, ShareIcon, TrophyIcon } from '../../ui/Icons';

function names(game: Game, ids: string[]): string {
  return joinNames(ids.map((id) => game.players.find((p) => p.id === id)?.name ?? '?'));
}

function shareText(game: Game, rc: Recap): string {
  const lines = [`⛳ Send It${game.course ? ` · ${game.course}` : ''} · ${plural(rc.holesPlayed, 'hole')}`];
  if (rc.winners.length) {
    const who = joinNames(rc.winners.map((w) => w.player.name));
    lines.push(`🏆 ${who} ${rc.winners.length > 1 ? 'tie' : 'wins'} at ${toParWords(rc.winners[0].totals.toPar)}`);
  }
  lines.push('', 'Against par (lowest wins):');
  for (const r of rc.byGame) lines.push(`${r.tied ? '=' : ''}${r.rank}. ${r.player.name}: ${formatToPar(r.totals.toPar)}`);
  const extras = rc.awards.filter((a) => a.id !== 'real');
  if (extras.length) lines.push('');
  for (const a of extras) lines.push(`${a.emoji} ${a.title}: ${names(game, a.playerIds)} (${a.detail})`);
  return lines.join('\n');
}

async function share(game: Game, rc: Recap) {
  const text = shareText(game, rc);
  const url = location.origin;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Send It results', text, url });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n\n${url}`);
    toast('Results copied. Paste them in your group chat.', 'success');
  } catch {
    toast("This browser can't share. Try a screenshot instead.", 'error');
  }
}

export function Final({ game }: { game: Game }) {
  const rc = useMemo(() => recap(game), [game]);
  const played = rc.holesPlayed > 0;

  useEffect(() => {
    if (played) confetti(CONFETTI.party, { x: innerWidth / 2, y: innerHeight * 0.22 }, 150);
  }, [played]);

  const winnerNames = joinNames(rc.winners.map((w) => w.player.name));

  return (
    <>
      <div className="screen-body">
        {played ? (
          <div className="winner center pop">
            <div className="trophy">
              <TrophyIcon />
            </div>
            <h1 className="hero" style={{ fontSize: 46, marginTop: 10 }}>
              {rc.winners.length > 1 ? `${winnerNames} tie!` : `${winnerNames} wins!`}
            </h1>
            <p className="h3 muted" style={{ margin: 0 }}>
              {toParWords(rc.winners[0].totals.toPar)} after {plural(rc.holesPlayed, 'hole')}
            </p>
          </div>
        ) : (
          <div className="tile-flat center">
            <p className="h3" style={{ margin: 0 }}>
              No holes were finished, so there's no winner this time.
            </p>
          </div>
        )}

        <p className="section-title">Against par · lowest wins</p>
        <div className="board">
          {rc.byGame.map((row, i) => (
            <BoardRow
              key={row.player.id}
              row={row}
              delay={i * 70}
              sub={
                <>
                  {row.totals.made}/{row.totals.holes} completed · {row.totals.real} strokes
                </>
              }
            />
          ))}
        </div>

        {rc.awards.length > 0 && (
          <>
            <p className="section-title">Awards</p>
            <div className="awards">
              {rc.awards.map((a, i) => (
                <div key={a.id} className="award rise" style={{ animationDelay: `${200 + i * 80}ms` }}>
                  <span className="award-emoji" aria-hidden>
                    {a.emoji}
                  </span>
                  <span className="award-title">{a.title}</span>
                  <span className="award-who">{names(game, a.playerIds)}</span>
                  <span className="award-detail">{a.detail}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {rc.highlights.length > 0 && (
          <>
            <p className="section-title">Insane challenges completed</p>
            {rc.highlights.map((h) => (
              <div key={`${h.playerId}-${h.hole}`} className="highlight">
                <BoltIcon width={24} height={24} style={{ color: 'var(--insane)', flex: 'none' }} />
                <span>
                  <b>{names(game, [h.playerId])}</b> · hole {game.holes[h.hole].number} · {getCard(h.cardId)?.title} (
                  {formatDelta(h.adjustment)})
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="screen-foot">
        <button type="button" className="btn btn-xl btn-brand" onClick={() => void share(game, rc)}>
          <ShareIcon width={26} height={26} /> Share results
        </button>
        <div className="made-missed">
          <button type="button" className="btn btn-ghost" onClick={() => navigate({ name: 'scorecard' })}>
            Scorecard
          </button>
          <button type="button" className="btn btn-green" onClick={startNewGame}>
            New game
          </button>
        </div>
      </div>
    </>
  );
}
