import { useState } from 'react';
import {
  cardStakes,
  getCard,
  getEntry,
  judgeFromStrokes,
  mulliganAllowance,
  mulligansLeft,
  outcomeChoices,
  type Game,
  type Outcome,
} from '../../game';
import { submitScore } from '../../state/store';
import { ChallengeCard } from '../../ui/ChallengeCard';
import { Avatar, StrokePicker, Toggle } from '../../ui/components';
import { CheckIcon, CrossIcon } from '../../ui/Icons';

export function ScoreEntry({ game, playerId }: { game: Game; playerId: string }) {
  const h = game.current;
  const par = game.holes[h].par ?? 4;
  const entry = getEntry(game, playerId, h);
  const card = getCard(entry?.cardId);
  const player = game.players.find((p) => p.id === playerId);
  const [strokes, setStrokes] = useState(entry?.strokes ?? par);
  const [mulligan, setMulligan] = useState(Boolean(entry?.mulligan));

  if (!player || !card || !entry?.tier) return null;

  const auto = judgeFromStrokes(card, par, strokes);
  const choices = outcomeChoices(card);
  // The strokes settle it either way (e.g. par on "Par Hunter" can only be completed), so there's nothing to tap.
  const settled = auto !== null;
  const allowance = mulliganAllowance(game);
  // Left besides this hole's, so switching it on here shows what you'd have after.
  const left = mulligansLeft(game, playerId) + (entry?.mulligan ? 1 : 0);
  const send = (outcome?: Outcome) => submitScore(playerId, h, strokes, outcome, true, allowance > 0 ? mulligan : undefined);

  return (
    <>
      <div className="screen-body">
        <div className="who">
          <Avatar player={player} size={52} />
          <h1 className="h2" style={{ minWidth: 0 }}>
            {player.name}
          </h1>
        </div>

        <div className="tile score-tile">
          <StrokePicker strokes={strokes} par={par} onChange={setStrokes} label="Strokes taken" />
        </div>

        {allowance > 0 && (
          <Toggle
            on={mulligan}
            disabled={!mulligan && left <= 0}
            title="Used a mulligan"
            detail={
              mulligan
                ? `Don't count the re-hit in your strokes. ${left - 1} left after this.`
                : left > 0
                  ? `${left} of ${allowance} left. Re-hit one bad shot and leave it out of your strokes.`
                  : `All ${allowance} used.`
            }
            onChange={setMulligan}
          />
        )}

        <ChallengeCard compact tier={entry.tier} cardId={entry.cardId} stakes={cardStakes(game, h, entry.tier, entry.freePass)} />
      </div>

      <div className="screen-foot">
        {settled ? (
          <>
            <div className={`auto-result ${auto} pop`} key={auto}>
              {auto === 'made' ? <CheckIcon width={28} height={28} /> : <CrossIcon width={28} height={28} />}
              {auto === 'made' ? 'Completed' : 'Failed'}
              <small>{auto === 'made' ? '· your strokes prove it' : '· not possible with that many strokes'}</small>
            </div>
            <button type="button" className="btn btn-xl btn-green" onClick={() => send()}>
              Save score
            </button>
            {card.situational && (
              <button type="button" className="btn btn-ghost" onClick={() => send('na')}>
                It didn't happen (no change)
              </button>
            )}
          </>
        ) : (
          <>
            <p className="label" style={{ textAlign: 'center' }}>
              Did {player.name} make the card?
            </p>
            <div className="made-missed">
              <button type="button" className="btn btn-xl btn-green" onClick={() => send('made')}>
                <CheckIcon /> Completed
              </button>
              <button type="button" className="btn btn-xl btn-red" onClick={() => send('missed')}>
                <CrossIcon /> Failed
              </button>
            </div>
            {choices.includes('na') && (
              <button type="button" className="btn btn-ghost" onClick={() => send('na')}>
                It didn't happen (no change)
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
