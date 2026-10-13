import { useState } from 'react';
import { getCard, getEntry, judgeFromStrokes, LIMITS, outcomeChoices, type Game } from '../../game';
import { submitScore } from '../../state/store';
import { Avatar, scoreName, Stepper, TierChip } from '../../ui/components';
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

  return (
    <>
      <div className="screen-body">
        <div className="who">
          <Avatar player={player} size={52} />
          <div style={{ minWidth: 0 }}>
            <h1 className="h2">{player.name}</h1>
            <div className="row" style={{ marginTop: 4, gap: 8 }}>
              <TierChip tier={entry.tier} />
              <span className="h3" style={{ fontSize: 19 }}>
                {card.title}
              </span>
            </div>
          </div>
        </div>

        <div className="tile score-tile">
          <p className="label">Strokes taken</p>
          <Stepper value={strokes} min={LIMITS.minStrokes} max={LIMITS.maxStrokes} onChange={setStrokes} label="strokes" />
          <p className="score-name">{scoreName(strokes, par)}</p>
        </div>

        <div className="recall">
          <span className="label">The card</span>
          <p>{card.pass}</p>
        </div>
      </div>

      <div className="screen-foot">
        {settled ? (
          <>
            <div className={`auto-result ${auto} pop`} key={auto}>
              {auto === 'made' ? <CheckIcon width={28} height={28} /> : <CrossIcon width={28} height={28} />}
              {auto === 'made' ? 'Completed' : 'Failed'}
              <small>{auto === 'made' ? '· your strokes prove it' : '· not possible with that many strokes'}</small>
            </div>
            <button type="button" className="btn btn-xl btn-dark" onClick={() => submitScore(playerId, h, strokes)}>
              Save score
            </button>
            {card.situational && (
              <button type="button" className="btn btn-ghost" onClick={() => submitScore(playerId, h, strokes, 'na')}>
                It didn't happen (no change)
              </button>
            )}
          </>
        ) : (
          <>
            <p className="label" style={{ textAlign: 'center' }}>
              Did {player.name} complete the challenge?
            </p>
            <div className="made-missed">
              <button type="button" className="btn btn-xl btn-green" onClick={() => submitScore(playerId, h, strokes, 'made')}>
                <CheckIcon /> Completed
              </button>
              <button type="button" className="btn btn-xl btn-red" onClick={() => submitScore(playerId, h, strokes, 'missed')}>
                <CrossIcon /> Failed
              </button>
            </div>
            {choices.includes('na') && (
              <button type="button" className="btn btn-ghost" onClick={() => submitScore(playerId, h, strokes, 'na')}>
                It didn't happen (no change)
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
