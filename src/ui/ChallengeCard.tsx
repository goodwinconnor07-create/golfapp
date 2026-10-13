import { useEffect, useState } from 'react';
import { formatDelta, getCard, TIERS, type Tier } from '../game';
import { haptic, reducedMotion } from './effects';
import { CheckIcon, CrossIcon } from './Icons';
import { TierIcon, TIER_LOOK, Pips } from './components';

interface Props {
  tier: Tier;
  /** Undefined while the server is still drawing it. */
  cardId?: string;
  /** Play the flip when the card face first becomes available. */
  flip?: boolean;
  compact?: boolean;
}

/** How long the card back waits before flipping. Insane winds up with a shake first. */
export function flipDelay(tier: Tier): number {
  if (reducedMotion()) return 0;
  return tier === 'insane' ? 460 : tier === 'bold' ? 160 : 90;
}

/** About when the card face is showing, for timing confetti on the reveal screen. */
export const FLIP_MS = 420;

/** A challenge card: tier band on top, title and exact pass condition below. */
export function ChallengeCard({ tier, cardId, flip = false, compact = false }: Props) {
  const card = getCard(cardId);
  const [shown, setShown] = useState(!flip && Boolean(card));

  useEffect(() => {
    if (!card) return;
    if (!flip) {
      setShown(true);
      return;
    }
    if (tier === 'insane' && !reducedMotion()) haptic('heavy');
    const t = setTimeout(() => setShown(true), flipDelay(tier));
    return () => clearTimeout(t);
  }, [card, flip, tier]);

  const t = TIERS[tier];
  const classes = [
    'ccard',
    `ccard-${tier}`,
    compact ? 'ccard-compact' : '',
    shown ? 'flipped' : '',
    flip && card && !shown ? 'winding' : '',
  ].join(' ');

  return (
    // Tapping the back skips the wind-up.
    <div className={classes} onClick={() => card && setShown(true)}>
      <div className="ccard-inner">
        <div className="ccard-face ccard-back" aria-hidden={shown}>
          <div className="ccard-back-art">
            <TierIcon tier={tier} size={compact ? 40 : 84} />
            <span className="ccard-back-label">{t.label}</span>
            {!card && <span className="ccard-drawing">Drawing your card…</span>}
          </div>
        </div>
        <div className="ccard-face ccard-front" aria-hidden={!shown}>
          <div className="ccard-band">
            <TierIcon tier={tier} size={compact ? 20 : 26} />
            <span className="ccard-tier">{t.label}</span>
            <Pips n={TIER_LOOK[tier].pips} />
            <span className="spacer" />
            <span className="ccard-stake">
              <CheckIcon width={18} height={18} /> {formatDelta(t.made)}
            </span>
            <span className="ccard-stake">
              <CrossIcon width={18} height={18} /> {formatDelta(t.missed)}
            </span>
          </div>
          {card && (
            <div className="ccard-body">
              <h3 className="ccard-title">{card.title}</h3>
              <p className="ccard-pass">{card.pass}</p>
              {card.hint && <p className="ccard-hint">{card.hint}</p>}
              {card.distance && !compact && <p className="ccard-tag">Honour system: judge it as a group.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
