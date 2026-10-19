import { useState } from 'react';
import {
  cardNote,
  cardStakes,
  formatDelta,
  getCard,
  getEntry,
  isV2,
  judgeAuto,
  judgeFromStrokes,
  lastHoleToPar,
  outcomeChoices,
  tapChoices,
  type Game,
  type Outcome,
} from '../../game';
import { dispatch, submitScore } from '../../state/store';
import { ChallengeCard } from '../../ui/ChallengeCard';
import { AutoNote, Avatar, StrokePicker } from '../../ui/components';
import { CheckIcon, CrossIcon } from '../../ui/Icons';

/**
 * Strokes first, then the card. Completed and Failed each carry what they're worth and save the
 * score in one tap. The footer keeps the same shape whatever the strokes: when the strokes settle
 * the card, the other button just greys out.
 */
export function ScoreEntry({ game, playerId, back }: { game: Game; playerId: string; back?: { label: string; run: () => void } }) {
  const h = game.current;
  const par = game.holes[h].par ?? 4;
  const entry = getEntry(game, playerId, h);
  const card = getCard(entry?.cardId);
  const player = game.players.find((p) => p.id === playerId);
  const [strokes, setStrokes] = useState(entry?.strokes ?? par);

  if (!player || !card || !entry?.tier) return null;

  const v2 = isV2(game);
  const auto = v2 ? judgeAuto(game, playerId, h, strokes) : judgeFromStrokes(card, par, strokes, lastHoleToPar(game, playerId, h));
  const choices = v2 ? tapChoices(game, card, entry.tier) : outcomeChoices(card);
  // Ruleset 2 cards about friends or streaks: the app works them out once the others (or later holes) are in.
  const workedOut = v2 && choices.length === 0 && auto === null;
  const stakes = cardStakes(game, h, entry.tier, entry.freePass);
  // The strokes settle it either way (e.g. par on "Par Hunter" can only be completed), so the other answer is off.
  const send = (outcome: Outcome) => submitScore(playerId, h, strokes, auto && outcome !== 'na' ? undefined : outcome);
  const canNa = choices.includes('na') || card.situational;

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
          <StrokePicker strokes={strokes} par={par} onChange={setStrokes} label={`Strokes taken · par ${par}`} />
        </div>

        {entry.mulligan && (
          // Taken on the Go play! screen; here it's just a reminder.
          <div className="mulligan-bar taken mulligan-note">
            <span className="mulligan-text">🔁 Mulligan used: leave the re-hit out</span>
            <button type="button" className="btn-link-small" onClick={() => dispatch({ type: 'mulligan', playerId, hole: h, on: false })}>
              Remove
            </button>
          </div>
        )}

        <ChallengeCard compact hideStakes tier={entry.tier} cardId={entry.cardId} note={cardNote(game, playerId, h)} />
        {auto && <AutoNote outcome={auto} />}
        {workedOut && (
          <p className="note">{card.multi ? 'The app keeps score of this streak.' : "The app works this one out once everyone's in."}</p>
        )}
      </div>

      <div className="screen-foot score-foot">
        {workedOut ? (
          <button type="button" className="btn btn-xl btn-green" onClick={() => submitScore(playerId, h, strokes, undefined)}>
            Save score
          </button>
        ) : (
          <div className="made-missed">
            <button type="button" className="btn btn-green btn-stake" disabled={auto === 'missed'} onClick={() => send('made')}>
              <span className="btn-stake-main">
                <CheckIcon /> Completed
              </span>
              <span className="btn-stake-delta num">{formatDelta(stakes.made)}</span>
            </button>
            <button type="button" className="btn btn-red btn-stake" disabled={auto === 'made'} onClick={() => send('missed')}>
              <span className="btn-stake-main">
                <CrossIcon /> Failed
              </span>
              <span className="btn-stake-delta num">{formatDelta(stakes.missed)}</span>
            </button>
          </div>
        )}
        {canNa && (
          <button type="button" className="btn btn-ghost" onClick={() => send('na')}>
            It didn't happen (no change)
          </button>
        )}
        {back && (
          <button type="button" className="btn btn-link" onClick={back.run}>
            {back.label}
          </button>
        )}
      </div>
    </>
  );
}
