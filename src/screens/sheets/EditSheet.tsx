import { useState } from 'react';
import {
  cardStakes,
  getCard,
  stakeFor,
  isDoubleHole,
  getEntry,
  judgeFromStrokes,
  mulliganAllowance,
  mulligansLeft,
  newId,
  outcomeChoices,
  ownsPlayer,
  scoreAccess,
  type Outcome,
} from '../../game';
import { closeSheet, dispatch, submitScore, toast, useApp } from '../../state/store';
import { ChallengeCard } from '../../ui/ChallengeCard';
import { Breakdown, Sheet, StrokePicker, Toggle } from '../../ui/components';
import { CheckIcon, CrossIcon } from '../../ui/Icons';

/**
 * Fix a score after the fact. Totals recalculate from the corrected strokes and result.
 * Online, a locked-in score (or someone else's) can't be changed directly: you send a request instead.
 */
export function EditSheet({ playerId, hole }: { playerId: string; hole: number }) {
  const game = useApp((s) => s.game);
  const deviceId = useApp((s) => s.deviceId);
  const entry = game ? getEntry(game, playerId, hole) : undefined;
  const par = game?.holes[hole]?.par ?? null;
  const [strokes, setStrokes] = useState(entry?.strokes ?? par ?? 4);
  const [outcome, setOutcome] = useState<Outcome | undefined>(entry?.outcome);
  const [mulligan, setMulligan] = useState(Boolean(entry?.mulligan));
  const card = getCard(entry?.cardId);
  const player = game?.players.find((p) => p.id === playerId);
  if (!game || !entry?.tier || !card || !player || par == null) return null;

  const auto = judgeFromStrokes(card, par, strokes);
  const choices = outcomeChoices(card);
  const effective: Outcome | undefined = card.situational && outcome === 'na' ? 'na' : (auto ?? outcome);
  const adjustment = effective ? stakeFor(game, hole, entry.tier, effective, entry.freePass) : null;
  const showChoices = choices.length > 0 && auto === null;

  const access = scoreAccess(game, deviceId, playerId, hole);
  const pending = game.fixes?.find((f) => f.playerId === playerId && f.hole === hole);
  const approver = ownsPlayer(game, deviceId, playerId) ? 'the host' : player.name;
  const unchanged = strokes === entry.strokes && effective === entry.outcome && mulligan === Boolean(entry.mulligan);

  const save = () => {
    if (access === 'request') {
      const sent = dispatch({ type: 'requestFix', id: newId(10), playerId, hole, strokes, ...(outcome ? { outcome } : {}) });
      if (sent) {
        closeSheet();
        toast(`Sent. Waiting for ${approver} to approve.`, 'success');
      }
      return;
    }
    if (submitScore(playerId, hole, strokes, outcome, false, mulliganAllowance(game) > 0 ? mulligan : undefined)) {
      closeSheet();
      toast('Score updated', 'success');
    }
  };

  return (
    <Sheet title={`${player.name} · hole ${game.holes[hole].number}`}>
      <div className="stack" style={{ gap: 14 }}>
        <ChallengeCard compact tier={entry.tier} cardId={entry.cardId} stakes={cardStakes(game, hole, entry.tier, entry.freePass)} />
        <StrokePicker strokes={strokes} par={par} onChange={setStrokes} label={`Strokes taken · par ${par}`} />
        {showChoices ? (
          <>
            <div className="made-missed">
              <button
                type="button"
                className={`btn ${effective === 'made' ? 'btn-green' : 'btn-ghost'}`}
                aria-pressed={effective === 'made'}
                onClick={() => setOutcome('made')}
              >
                Completed
              </button>
              <button
                type="button"
                className={`btn ${effective === 'missed' ? 'btn-red' : 'btn-ghost'}`}
                aria-pressed={effective === 'missed'}
                onClick={() => setOutcome('missed')}
              >
                Failed
              </button>
            </div>
            {choices.includes('na') && (
              <button
                type="button"
                className={`btn ${effective === 'na' ? 'btn-dark' : 'btn-ghost'}`}
                aria-pressed={effective === 'na'}
                onClick={() => setOutcome('na')}
              >
                It didn't happen
              </button>
            )}
          </>
        ) : (
          // Same look as the score screen.
          <div className={`auto-result ${auto} pop`} key={auto}>
            {auto === 'made' ? <CheckIcon width={28} height={28} /> : <CrossIcon width={28} height={28} />}
            {auto === 'made' ? 'Completed' : 'Failed'}
            <small>{auto === 'made' ? '· your strokes prove it' : '· not possible with that many strokes'}</small>
          </div>
        )}
        <p className="h2 center num" style={{ margin: '4px 0' }}>
          {adjustment != null ? (
            <Breakdown
              strokes={strokes}
              par={par}
              adjustment={adjustment}
              outcome={effective!}
              doubled={isDoubleHole(game, hole)}
              freePass={entry.freePass}
              total
              big
            />
          ) : (
            'Completed or failed?'
          )}
        </p>
        {access === 'direct' && mulliganAllowance(game) > 0 && (
          <Toggle
            on={mulligan}
            disabled={!mulligan && mulligansLeft(game, playerId) + (entry.mulligan ? 1 : 0) <= 0}
            title="Used a mulligan"
            detail={`${mulligansLeft(game, playerId) + (entry.mulligan ? 1 : 0)} of ${mulliganAllowance(game)} left before this hole.`}
            onChange={setMulligan}
          />
        )}
        {access === 'request' && (
          <p className="note" style={{ margin: 0 }}>
            {pending
              ? `${pending.byName} has asked to change this to ${pending.strokes}. Sending again replaces that request.`
              : `This hole is locked in. ${approver === 'the host' ? 'The host' : approver} gets asked to approve the change.`}
          </p>
        )}
        <button type="button" className="btn btn-xl btn-dark" disabled={!effective || (access === 'request' && unchanged)} onClick={save}>
          {access === 'request' ? 'Ask to change' : 'Save score'}
        </button>
        {pending && pending.by === deviceId && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => dispatch({ type: 'answerFix', id: pending.id, accept: false }) && closeSheet()}
          >
            Cancel my request
          </button>
        )}
      </div>
    </Sheet>
  );
}
