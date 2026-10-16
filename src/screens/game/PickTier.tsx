import { useState } from 'react';
import { cardStakes, completedHoles, formatDelta, formatToPar, standings, freePassAvailable, gapText, isDoubleHole, TIER_ORDER, TIERS, type Game, type Tier } from '../../game';
import { pickTier } from '../../state/store';
import { haptic } from '../../ui/effects';
import { Pips, TierFx, TierIcon, TIER_LOOK } from '../../ui/components';
import { CheckIcon } from '../../ui/Icons';
import { RankedAvatar, rankLabel } from '../../ui/BoardRow';

export function PickTier({ game, playerId }: { game: Game; playerId: string }) {
  const [tier, setTier] = useState<Tier | null>(null);
  const [free, setFree] = useState(false);
  const player = game.players.find((p) => p.id === playerId);
  if (!player) return null;
  const h = game.current;
  const doubled = isDoubleHole(game, h);
  const gap = gapText(game, playerId);
  const canFree = freePassAvailable(game, playerId);
  // Where you stand going into this hole. Only shown once a hole is in.
  const played = completedHoles(game).filter((x) => x < h);
  const me = played.length ? standings(game, 'game', played).find((r) => r.player.id === playerId) : undefined;
  const ranked = me && game.players.length > 1;

  return (
    <>
      <div className="screen-body">
        <div className="who">
          <RankedAvatar player={player} size={72} rank={ranked ? rankLabel(me.rank, me.tied) : undefined} first={me?.rank === 1} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="h1">{player.name}</h1>
            <p className="h3 muted" style={{ margin: '2px 0 0' }}>
              {gap ?? 'Pick your risk'}
            </p>
          </div>
          {me && (
            <div className="who-score">
              <b>{formatToPar(me.totals.toPar)}</b>
              <small>Score</small>
            </div>
          )}
        </div>

        {doubled && (
          <div className="double-banner" role="status">
            <b>2×</b> Double stakes · last {Math.min(3, game.holes.length - h)} hole{game.holes.length - h === 1 ? '' : 's'}
          </div>
        )}

        <div className="tier-list" role="radiogroup" aria-label="Risk level">
          {TIER_ORDER.map((t) => {
            const stakes = cardStakes(game, h, t, free);
            const state = tier === t ? 'selected' : tier ? 'dim' : '';
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tier === t}
                className={`tier-btn tier-btn-${t} press ${state}`}
                onClick={() => {
                  setTier(t);
                  haptic('medium');
                }}
              >
                <TierFx tier={t} />
                <span className="tier-btn-icon">
                  <TierIcon tier={t} size={38} />
                </span>
                <span>
                  <span className="tier-btn-label">
                    {TIERS[t].label}
                    <Pips n={TIER_LOOK[t].pips} />
                  </span>
                  <span className="tier-btn-stakes">
                    Complete {formatDelta(stakes.made)} · Fail {formatDelta(stakes.missed)}
                  </span>
                </span>
                {tier === t && (
                  <span className="tier-btn-check" aria-hidden>
                    <CheckIcon />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {canFree && (
          <button
            type="button"
            role="switch"
            aria-checked={free}
            className={`free-shot press ${free ? 'on' : ''}`}
            onClick={() => {
              setFree((f) => !f);
              haptic('medium');
            }}
          >
            <span className="free-shot-icon" aria-hidden>
              🛟
            </span>
            <span className="free-shot-text">
              <b>{free ? 'Free shot on!' : 'Use your free shot?'}</b>
              <small>You're in last place: fail this card and it costs nothing. Once a round.</small>
            </span>
            <span className="free-shot-toggle" aria-hidden />
          </button>
        )}
      </div>

      <div className="screen-foot">
        <button
          type="button"
          className={`btn btn-xl ${tier ? `btn-${tier}` : 'btn-dark'}`}
          disabled={!tier}
          onClick={() => tier && pickTier(playerId, tier, free)}
        >
          {tier ? `Draw my ${TIERS[tier].label} card` : 'Tap a level'}
        </button>
      </div>
    </>
  );
}
