import { useState } from 'react';
import {
  cardStakes,
  formatDelta,
  getCard,
  stakeFor,
  isDoubleHole,
  getEntry,
  judgeFromStrokes,
  lastHoleToPar,
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
import { AutoNote, OutcomeMark, Receipt, Sheet, StrokePicker, Toggle } from '../../ui/components';

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

  const auto = judgeFromStrokes(card, par, strokes, lastHoleToPar(game, playerId, hole));
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

  const stakes = cardStakes(game, hole, entry.tier, entry.freePass);
  // A segmented choice, not two action buttons: picking one here doesn't save anything until Save score.
  const option = (value: 'made' | 'missed') => {
    const disabled = auto !== null && auto !== value;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={effective === value}
        disabled={disabled}
        className={`seg-option ${value}${effective === value ? ' on' : ''}`}
        onClick={() => setOutcome(value)}
      >
        <OutcomeMark outcome={value} size={20} />
        {value === 'made' ? 'Completed' : 'Failed'}
        <span className="seg-delta num">{formatDelta(value === 'made' ? stakes.made : stakes.missed)}</span>
      </button>
    );
  };

  return (
    <Sheet title={`Fix ${player.name}'s hole ${game.holes[hole].number}`}>
      <div className="stack" style={{ gap: 16 }}>
        <ChallengeCard compact hideStakes tier={entry.tier} cardId={entry.cardId} />
        <StrokePicker strokes={strokes} par={par} onChange={setStrokes} label={`Strokes taken · par ${par}`} />
        {auto && <AutoNote outcome={auto} />}
        {(showChoices || auto) && (
          <div className="seg" role="radiogroup" aria-label="The card">
            {option('made')}
            {option('missed')}
          </div>
        )}
        {showChoices && choices.includes('na') && (
          <button
            type="button"
            className={`btn ${effective === 'na' ? 'btn-dark' : 'btn-ghost'}`}
            aria-pressed={effective === 'na'}
            onClick={() => setOutcome('na')}
          >
            It didn't happen
          </button>
        )}
        {adjustment != null && effective && (
          <Receipt
            className="edit-sum"
            strokes={strokes}
            par={par}
            adjustment={adjustment}
            outcome={effective}
            doubled={isDoubleHole(game, hole)}
            freePass={entry.freePass}
          />
        )}
        {access === 'direct' && mulliganAllowance(game) > 0 && (
          <Toggle
            on={mulligan}
            disabled={!mulligan && mulligansLeft(game, playerId) + (entry.mulligan ? 1 : 0) <= 0}
            title="Used a mulligan"
            detail={`${mulligansLeft(game, playerId) + (entry.mulligan ? 1 : 0)} of ${mulliganAllowance(game)} left before this hole`}
            onChange={setMulligan}
          />
        )}
        {access === 'request' && (
          <p className="note" style={{ margin: 0 }}>
            {pending
              ? `${pending.byName} asked to change this to ${pending.strokes}. Asking again replaces that.`
              : `This hole is locked in, so ${approver} has to approve the change.`}
          </p>
        )}
        {/* Stuck to the bottom of the sheet, so it's on screen without scrolling. */}
        <div className="sheet-foot">
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
      </div>
    </Sheet>
  );
}
