import { useEffect, useState } from 'react';
import { formatDelta, getCard, TIERS, type Tier } from '../game';
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
    const t = setTimeout(() => setShown(true), 90);
    return () => clearTimeout(t);
  }, [card, flip]);

  const t = TIERS[tier];
  const classes = ['ccard', `ccard-${tier}`, compact ? 'ccard-compact' : '', shown ? 'flipped' : ''].join(' ');

  return (
    <div className={classes}>
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
