import { useState } from 'react';
import { formatDelta, TIER_ORDER, TIERS, type Game, type Tier } from '../../game';
import { pickTier } from '../../state/store';
import { haptic } from '../../ui/effects';
import { Avatar, Pips, TierIcon, TIER_LOOK } from '../../ui/components';
import { CheckIcon } from '../../ui/Icons';

export function PickTier({ game, playerId }: { game: Game; playerId: string }) {
  const [tier, setTier] = useState<Tier | null>(null);
  const player = game.players.find((p) => p.id === playerId);
  if (!player) return null;

  return (
    <>
      <div className="screen-body">
        <div className="who">
          <Avatar player={player} size={58} />
          <div style={{ minWidth: 0 }}>
            <h1 className="h1">{player.name}</h1>
            <p className="h3 muted" style={{ margin: '2px 0 0' }}>
              Pick your risk
            </p>
          </div>
        </div>

        <div className="tier-list" role="radiogroup" aria-label="Risk level">
          {TIER_ORDER.map((t) => {
            const def = TIERS[t];
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
                <span className="tier-btn-icon">
                  <TierIcon tier={t} size={38} />
                </span>
                <span>
                  <span className="tier-btn-label">
                    {def.label}
                    <Pips n={TIER_LOOK[t].pips} />
                  </span>
                  <span className="tier-btn-stakes">
                    Complete {formatDelta(def.made)} · Fail {formatDelta(def.missed)}
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
      </div>

      <div className="screen-foot">
        <button
          type="button"
          className={`btn btn-xl ${tier ? `btn-${tier}` : 'btn-dark'}`}
          disabled={!tier}
          onClick={() => tier && pickTier(playerId, tier)}
        >
          {tier ? `Draw my ${TIERS[tier].label} card` : 'Tap a level'}
        </button>
      </div>
    </>
  );
}
