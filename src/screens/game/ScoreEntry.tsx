import { useState } from 'react';
import { cardStakes, getCard, getEntry, judgeFromStrokes, outcomeChoices, type Game, type Outcome } from '../../game';
import { dispatch, submitScore } from '../../state/store';
import { ChallengeCard } from '../../ui/ChallengeCard';
import { Avatar, StrokePicker } from '../../ui/components';
import { CheckIcon, CrossIcon } from '../../ui/Icons';

export function ScoreEntry({ game, playerId }: { game: Game; playerId: string }) {
  const h = game.current;
  const par = game.holes[h].par ?? 4;
  const entry = getEntry(game, playerId, h);
  const card = getCard(entry?.cardId);
  const player = game.players.find((p) => p.id === playerId);
  const [strokes, setStrokes] = useState(entry?.strokes ?? par);

  if (!player || !card || !entry?.tier) return null;

  const auto = judgeFromStrokes(card, par, strokes);
  const choices = outcomeChoices(card);
  // The strokes settle it either way (e.g. par on "Par Hunter" can only be completed), so there's nothing to tap.
  const settled = auto !== null;
  const send = (outcome?: Outcome) => submitScore(playerId, h, strokes, outcome);

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

        {entry.mulligan && (
          // Taken on the Go play! screen; here it's just a reminder.
          <div className="mulligan-bar taken mulligan-note">
            <span className="mulligan-text">🔁 Mulligan used: don't count the re-hit in your strokes.</span>
            <button type="button" className="btn-link-small" onClick={() => dispatch({ type: 'mulligan', playerId, hole: h, on: false })}>
              Remove
            </button>
          </div>
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
