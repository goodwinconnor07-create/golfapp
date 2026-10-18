import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDelta, getCard, recap, units, type Game, type Recap, type StandingRow, formatToPar, toParWords } from '../../game';
import { nativeShare } from '../../state/native';
import { APP_STORE_URL, canHost, isNative, publicOrigin } from '../../state/platform';
import { navigate, startNewGame, toast } from '../../state/store';
import { BoardRow } from '../../ui/BoardRow';
import { Avatar } from '../../ui/components';
import { colourWipe, confetti, CONFETTI, haptic, reducedMotion } from '../../ui/effects';
import { joinNames, plural, roundLine } from '../../ui/format';
import { BoltIcon, ShareIcon, TrophyIcon } from '../../ui/Icons';
import { resultsImage } from '../../ui/resultsImage';
import { EditList } from './EditList';

function names(game: Game, ids: string[]): string {
  // Awards can name a team in 2v2 (the strokes award ranks teams).
  return joinNames(ids.map((id) => (game.players.find((p) => p.id === id) ?? units(game).find((u) => u.id === id))?.name ?? '?'));
}

function shareText(game: Game, rc: Recap): string {
  const lines = [`⛳ CardShot${game.course ? ` · ${game.course}` : ''} · ${plural(rc.holesPlayed, 'hole')}`];
  if (rc.winners.length) {
    const who = game.teams ? rc.winners.map((w) => w.player.name).join(' and ') : joinNames(rc.winners.map((w) => w.player.name));
    lines.push(`🏆 ${who} ${rc.winners.length > 1 ? 'tie' : 'wins'} at ${toParWords(rc.winners[0].totals.toPar)}`);
  }
  lines.push('', 'Against par (lowest wins):');
  for (const r of rc.byGame) lines.push(`${r.tied ? '=' : ''}${r.rank}. ${r.player.name}: ${formatToPar(r.totals.toPar)}`);
  const extras = rc.awards.filter((a) => a.id !== 'real');
  if (extras.length) lines.push('');
  for (const a of extras) lines.push(`${a.emoji} ${a.title}: ${names(game, a.playerIds)} (${a.detail})`);
  return lines.join('\n');
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function download(file: File) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

/** Shares the results picture with the text as its caption; falls back to text only. */
async function share(game: Game, rc: Recap, image: File | null) {
  const text = shareText(game, rc);
  const url = publicOrigin();
  if (isNative) {
    await nativeShare({ title: 'CardShot results', text: `${text}\n\n${url}`, image });
    return;
  }
  if (image && navigator.canShare?.({ files: [image] })) {
    try {
      await navigator.share({ files: [image], text: `${text}\n\n${url}` });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  if (image && !navigator.share) {
    // A computer: save the picture and copy the text.
    download(image);
    try {
      await navigator.clipboard.writeText(`${text}\n\n${url}`);
    } catch {
      // The picture is enough.
    }
    toast('Picture saved, and the results are copied.', 'success');
    return;
  }
  if (navigator.share) {
    try {
      await navigator.share({ title: 'CardShot results', text, url });
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
  // Draw the picture now, so tapping Share opens the share sheet straight away
  // (iPhones refuse to share if there's a wait after the tap).
  const image = useRef<File | null>(null);
  useEffect(() => {
    if (!played) return;
    let live = true;
    resultsImage(game, rc)
      .then((blob) => {
        if (live && blob) image.current = new File([blob], 'cardshot-results.png', { type: 'image/png' });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [game, rc, played]);

  // With two or more players the podium builds up: 3rd, then 2nd, then 1st. Once per game; a tap skips it.
  const podium = played && rc.byGame.length >= 2;
  const first = rc.byGame.length >= 3 ? 0 : 1;
  const [step, setStep] = useState(() => (!podium || reducedMotion() || finalSeen(game.id) ? 3 : first));
  useEffect(() => {
    if (step >= 3) return;
    const t = setTimeout(
      () => {
        haptic(step === 2 ? 'heavy' : 'medium');
        setStep((x) => x + 1);
      },
      step === 0 ? 500 : step === 2 ? 1300 : 1000,
    );
    return () => clearTimeout(t);
  }, [step]);
  useEffect(() => {
    if (!played || step < 3) return;
    markFinalSeen(game.id);
    confetti(CONFETTI.party, { x: innerWidth / 2, y: innerHeight * 0.22 }, 150);
  }, [played, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const winnerNames = game.teams ? rc.winners.map((w) => w.player.name).join(' and ') : joinNames(rc.winners.map((w) => w.player.name));
  const headline = rc.winners.length > 1 ? `${winnerNames} tie!` : `${winnerNames} wins!`;
  // The podium already shows each score, so the line under the headline gives the margin instead.
  const runnerUp = rc.byGame.find((r) => r.rank > 1);
  const margin = rc.winners.length > 1 || !runnerUp ? 0 : runnerUp.totals.toPar - rc.winners[0].totals.toPar;
  const subline = margin
    ? `Won by ${margin} after ${plural(rc.holesPlayed, 'hole')}`
    : `${rc.winners.length > 1 ? 'Level' : capitalise(toParWords(rc.winners[0]?.totals.toPar ?? 0))} after ${plural(rc.holesPlayed, 'hole')}`;

  return (
    <>
      <div className="screen-body final-body" onClick={step < 3 ? () => setStep(3) : undefined}>
        {podium ? (
          <>
            <h1 className="h1 center" aria-live="polite">
              {step >= 3 ? headline : step === 2 ? 'In 2nd…' : 'And in 3rd…'}
            </h1>
            {step >= 3 && (
              <p className="h3 muted center" style={{ margin: '-8px 0 0' }}>
                {subline}
              </p>
            )}
            {/* Read in place order; laid out 2-1-3 like a real podium. */}
            <ol className="podium">
              {rc.byGame.slice(0, 3).map((row, i) => (
                <PodiumStep key={row.player.id} row={row} pos={i} shown={step >= 3 - i} />
              ))}
            </ol>
            {rc.byGame.slice(3).map((row) => (
              <BoardRow key={row.player.id} row={row} sub={detail(row)} />
            ))}
          </>
        ) : (
          <>
            {played ? (
              <div className="winner center pop">
                <div className="trophy">
                  <TrophyIcon />
                </div>
                <h1 className="hero" style={{ fontSize: 46, marginTop: 10 }}>
                  {headline}
                </h1>
                <p className="h3 muted" style={{ margin: 0 }}>
                  {capitalise(toParWords(rc.winners[0].totals.toPar))} after {plural(rc.holesPlayed, 'hole')}
                </p>
              </div>
            ) : (
              <div className="tile-flat center">
                <p className="h3" style={{ margin: 0 }}>
                  No holes were finished, so there's no winner this time.
                </p>
              </div>
            )}

            <p className="section-title">Lowest score wins</p>
            <div className="board">
              {rc.byGame.map((row, i) => (
                <BoardRow key={row.player.id} row={row} delay={i * 70} sub={detail(row)} />
              ))}
            </div>
          </>
        )}

        {step >= 3 && rc.awards.length > 0 && (
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
            <p className="section-title">Insane cards completed</p>
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
        <EditList game={game} />
        {/* Below everything, so the footer stays one button and never covers the awards. */}
        <div className="made-missed">
          <button type="button" className="btn btn-ghost" onClick={() => navigate({ name: 'scorecard' })}>
            Scorecard
          </button>
          {canHost ? (
            <button type="button" className="btn btn-green" onClick={(e) => colourWipe(e, startNewGame)}>
              New game
            </button>
          ) : (
            <a className="btn btn-green" href={APP_STORE_URL}>
              Host your own
            </a>
          )}
        </div>
      </div>

      <div className="screen-foot">
        <button type="button" className="btn btn-xl btn-blue" onClick={() => void share(game, rc, image.current)}>
          <ShareIcon width={26} height={26} /> Share results
        </button>
      </div>
    </>
  );
}

function detail(row: StandingRow) {
  return <span className="board-detail">{roundLine(row.totals)}</span>;
}

/** One podium step. pos 0 is 1st. Hidden steps show a "?" until their turn. */
function PodiumStep({ row, pos, shown }: { row: StandingRow; pos: number; shown: boolean }) {
  const place = `${row.tied ? '=' : ''}${row.rank}`;
  return (
    <li className={`pod pod-${pos + 1}${shown ? ' shown' : ''}`} aria-hidden={!shown}>
      {shown ? (
        <>
          {pos === 0 && (
            <span className="pod-crown" aria-hidden>
              👑
            </span>
          )}
          <Avatar player={row.player} size={pos === 0 ? 72 : 56} />
          <b className="pod-name">{row.player.name}</b>
          {/* "Even" in words: a bare "E" meant nothing to players who don't follow golf. */}
          <span className="pod-score num">{row.totals.toPar === 0 ? 'Even' : formatToPar(row.totals.toPar)}</span>
          <span className="sr-only">
            {place}: {row.player.name}, {formatToPar(row.totals.toPar)}
          </span>
        </>
      ) : (
        <span className="pod-q">?</span>
      )}
      <span className="pod-block" aria-hidden>
        {place}
      </span>
    </li>
  );
}

const FINAL_KEY = 'sendit.finalShown';

function finalSeen(gameId: string): boolean {
  try {
    return localStorage.getItem(FINAL_KEY) === gameId;
  } catch {
    return false;
  }
}

function markFinalSeen(gameId: string): void {
  try {
    localStorage.setItem(FINAL_KEY, gameId);
  } catch {
    // Storage blocked: the podium may play again after a reload. Harmless.
  }
}
