import { useEffect, useMemo, useRef, useState } from 'react';
import { completedHoles, formatToPar, getCard, ownsPlayer, rankMoves, standings, unitHoleResult, units, type Game } from '../../game';
import { leaveResults, markResultsRevealed, navigate, resultsRevealSeen, useApp } from '../../state/store';
import { myPlayers } from '../../state/view';
import { Move, RankedAvatar, rankLabel } from '../../ui/BoardRow';
import { CountUp, HoleMeta, TierIcon, Working } from '../../ui/components';
import { Reactions } from '../../ui/Reactions';
import { confetti, CONFETTI, haptic, reducedMotion } from '../../ui/effects';
import { ArrowIcon, TrophyIcon } from '../../ui/Icons';
import { VoteTag } from './HoleResults';
import { Moment } from './Moment';
import { Overtakes } from './Overtakes';

/** Gap between rows flipping over. */
const GAP_MS = 420;
/** A beat before the hole's best score lands. */
const HOLD_MS = 700;
/** After the last flip, before the rows re-sort into the new standings. */
const SORT_MS = 450;

/**
 * Online, once everyone has scored: one list. The rows start in the old order; each player's hole
 * flips over (worst first, best last) and its score ticks into their total. Then the rows re-sort
 * into the new standings, with ▲/▼ for anyone who moved and a line for each overtake. Any tap
 * skips to the end. Then friends on other phones can react to each other's holes.
 *
 * Every phone plays it once, even if someone else has already moved the group on (see view.ts).
 */
export function ResultsReveal({ game, hole }: { game: Game; hole: number }) {
  const deviceId = useApp((s) => s.deviceId);
  const holes = useMemo(() => completedHoles(game).filter((h) => h <= hole), [game, hole]);
  const before = useMemo(() => standings(game, 'game', holes.slice(0, -1)), [game, holes]);
  const after = useMemo(() => standings(game, 'game', holes), [game, holes]);
  const moves = rankMoves(game, holes);
  // One row per standings unit: a player, or a team in 2v2.
  const results = new Map(units(game).map((u) => [u.id, unitHoleResult(game, u.id, hole)]));
  // Flip order: worst first, so the hole's best score lands last.
  const flipOrder = useMemo(
    () =>
      units(game)
        .filter((u) => unitHoleResult(game, u.id, hole))
        .sort((a, b) => unitHoleResult(game, b.id, hole)!.toPar - unitHoleResult(game, a.id, hole)!.toPar)
        .map((u) => u.id),
    [game, hole],
  );
  const best = Math.min(...[...results.values()].map((r) => r?.toPar ?? Infinity));

  // Already watched (say, after a reload)? Show it settled straight away.
  const [instant] = useState(() => reducedMotion() || resultsRevealSeen(game.id, hole));
  const [flipped, setFlipped] = useState(instant ? flipOrder.length : 0);
  const [settled, setSettled] = useState(instant);
  const skip = () => {
    setFlipped(flipOrder.length);
    setSettled(true);
  };

  // Timing only depends on how far the reveal has got, so votes or reactions arriving mid-reveal don't restart it.
  const orderRef = useRef(flipOrder);
  orderRef.current = flipOrder;
  useEffect(() => {
    if (settled) return;
    const n = orderRef.current.length;
    if (flipped >= n) {
      const t = setTimeout(() => setSettled(true), SORT_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => {
        const id = orderRef.current[flipped];
        const r = unitHoleResult(game, id, hole);
        const unit = units(game).find((u) => u.id === id);
        // A buzz for your own row only, so the phone doesn't rattle through everyone's.
        if (r && (unit?.members ?? [{ id }]).some((m) => ownsPlayer(game, deviceId, m.id))) haptic(r.outcome === 'made' ? (r.tier === 'insane' ? 'heavy' : 'medium') : 'light');
        setFlipped((x) => x + 1);
      },
      flipped === 0 ? 300 : flipped === n - 1 ? HOLD_MS : GAP_MS,
    );
    return () => clearTimeout(t);
  }, [flipped, settled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!settled || instant) return;
    markResultsRevealed(hole);
    const top = flipOrder[flipOrder.length - 1];
    const r = top ? unitHoleResult(game, top, hole) : null;
    if (r) confetti(r.outcome === 'made' ? CONFETTI[r.tier] : CONFETTI.party, { x: innerWidth / 2, y: innerHeight * 0.3 }, 60);
    haptic('success');
  }, [settled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rows show in the old order until the reveal settles, then in the new standings.
  const rows = settled ? after : before.length ? before : after;
  const oldIndex = new Map(before.map((r, i) => [r.player.id, i]));
  const flippedIds = new Set(flipOrder.slice(0, flipped));
  const last = hole === game.holes.length - 1 || game.status === 'finished';
  const mine = myPlayers(game, deviceId, true);

  return (
    <>
      <div className="screen-body" onClick={settled ? undefined : skip}>
        <div className="reveal-head">
          <h1 className="h1">Results</h1>
          <span className="col-label" aria-hidden>
            Total
          </span>
        </div>
        {settled && <Overtakes game={game} hole={hole} />}
        {/* Screen readers get the settled standings once, not the shuffle. */}
        {settled && (
          <p className="sr-only" role="status">
            {`Hole ${game.holes[hole].number} results. ` +
              after.map((r) => `${r.tied ? 'tied ' : ''}${r.rank}: ${r.player.name}, ${formatToPar(r.totals.toPar)}`).join('. ')}
          </p>
        )}
        <div className="stack reveal-list" aria-hidden={!settled}>
          {rows.map((row, i) => {
            const p = row.player;
            const r = results.get(p.id);
            const open = settled || flippedIds.has(p.id);
            const now = after.find((x) => x.player.id === p.id)!;
            const was = before.find((x) => x.player.id === p.id);
            const total = settled ? now : (was ?? now);
            const from = (oldIndex.get(p.id) ?? i) - i;
            const isMine = mine.some((m) => m.id === p.id || p.members?.some((x) => x.id === m.id));
            return (
              <div
                key={p.id}
                className={[
                  'prow board-row result-row',
                  settled && now.rank === 1 ? 'first' : '',
                  isMine && mine.length === 1 ? 'mine' : '',
                  settled && !instant && from !== 0 ? 'reorder' : '',
                ].join(' ')}
                style={settled && !instant && from !== 0 ? ({ '--from': from } as React.CSSProperties) : undefined}
              >
                <RankedAvatar player={p} rank={rankLabel(total.rank, total.tied)} size={56} />
                <span className="prow-main">
                  <span className="prow-name">
                    {p.name}
                    {settled && <Move n={moves[p.id]} />}
                  </span>
                  <span className="prow-detail">
                    {r && open ? (
                      <>
                        <Working
                          strokes={r.strokes}
                          par={r.par}
                          adjustment={r.adjustment}
                          outcome={r.outcome}
                          tier={r.tier}
                          doubled={r.doubled}
                        />
                        {settled && r.toPar === best && <span className="best-tag">Best hole</span>}
                        <HoleMeta mulligan={r.mulligan} freePass={r.freePass} />
                        <VoteTag game={game} playerId={p.id} hole={hole} />
                        <span className="sr-only">{getCard(r.cardId)?.title}</span>
                      </>
                    ) : (
                      r && (
                        <span className="hidden-pill">
                          <TierIcon tier={r.tier} size={14} /> ? ? ?
                        </span>
                      )
                    )}
                  </span>
                  {settled && <Reactions game={game} playerId={p.id} hole={hole} />}
                </span>
                <span className="prow-score">
                  <b>
                    {open ? (
                      <CountUp value={now.totals.toPar} from={was?.totals.toPar ?? 0} format={formatToPar} />
                    ) : (
                      formatToPar(total.totals.toPar)
                    )}
                  </b>
                  {r && open && !settled && <em className="tick pop">{formatToPar(r.toPar)} this hole</em>}
                </span>
              </div>
            );
          })}
        </div>
        {settled && <Moment game={game} hole={hole} delay={600} />}
      </div>
      <div className="screen-foot">
        {/* While the reveal plays, the first tap only skips to the end. */}
        <button type="button" className="btn btn-xl btn-green" onClick={settled ? () => leaveResults(hole) : skip}>
          {last ? (
            <>
              <TrophyIcon width={28} height={28} /> Final results
            </>
          ) : (
            <>
              Next hole <ArrowIcon width={28} height={28} />
            </>
          )}
        </button>
        {settled && game.status === 'playing' && (
          <button type="button" className="btn btn-link" onClick={() => navigate({ name: 'scorecard' })}>
            Fix a score
          </button>
        )}
      </div>
    </>
  );
}
