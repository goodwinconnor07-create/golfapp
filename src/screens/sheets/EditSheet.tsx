import { useState } from 'react';
import { cardStakes, getCard, stakeFor, getEntry, judgeFromStrokes, outcomeChoices, type Outcome } from '../../game';
import { closeSheet, submitScore, toast, useApp } from '../../state/store';
import { ChallengeCard } from '../../ui/ChallengeCard';
import { Sheet, StrokePicker } from '../../ui/components';
import { calcText } from '../../ui/format';

/** Fix a score after the fact. Totals recalculate from the corrected strokes and result. */
export function EditSheet({ playerId, hole }: { playerId: string; hole: number }) {
  const game = useApp((s) => s.game);
  const entry = game ? getEntry(game, playerId, hole) : undefined;
  const par = game?.holes[hole]?.par ?? null;
  const [strokes, setStrokes] = useState(entry?.strokes ?? par ?? 4);
  const [outcome, setOutcome] = useState<Outcome | undefined>(entry?.outcome);
  const card = getCard(entry?.cardId);
  const player = game?.players.find((p) => p.id === playerId);
  if (!game || !entry?.tier || !card || !player || par == null) return null;

  const auto = judgeFromStrokes(card, par, strokes);
  const choices = outcomeChoices(card);
  const effective: Outcome | undefined = card.situational && outcome === 'na' ? 'na' : (auto ?? outcome);
  const adjustment = effective ? stakeFor(game, hole, entry.tier, effective, entry.freePass) : null;
  const showChoices = choices.length > 0 && auto === null;

  const save = () => {
    if (submitScore(playerId, hole, strokes, outcome, false)) {
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
          <div className={`auto-result ${auto}`}>
            {auto === 'made' ? 'Completed (your strokes prove it)' : 'Failed (not possible with that many strokes)'}
          </div>
        )}
        <p className="h2 center num" style={{ margin: '4px 0' }}>
          {adjustment != null ? `${calcText(strokes, adjustment, strokes + adjustment, par)}` : 'Completed or failed?'}
        </p>
        <button type="button" className="btn btn-xl btn-dark" disabled={!effective} onClick={save}>
          Save
        </button>
      </div>
    </Sheet>
  );
}
