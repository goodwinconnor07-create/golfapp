import { useEffect, useState } from 'react';
import { formatDelta, getCard, TIERS, type Tier } from '../game';
import { haptic, reducedMotion } from './effects';
import { CheckIcon, CrossIcon } from './Icons';
import { SHOT_ART } from './shotArt';
import { ShotScene } from './ShotScene';
import { TierIcon, TIER_LOOK, Pips } from './components';

interface Props {
  tier: Tier;
  /** Undefined while the server is still drawing it. */
  cardId?: string;
  /** Play the flip when the card face first becomes available. */
  flip?: boolean;
  compact?: boolean;
  /** What completing / failing is worth on this hole (doubled holes, free shot). Defaults to the tier's values. */
  stakes?: { made: number; missed: number };
  /** The hole's par, for scenes that show a score. */
  par?: number;
}

/** How long the card back waits before flipping. Insane winds up with a shake first. */
export function flipDelay(tier: Tier): number {
  if (reducedMotion()) return 0;
  return tier === 'insane' ? 420 : tier === 'bold' ? 360 : 300;
}

/** About when the card face is showing, for timing confetti on the reveal screen. */
export const FLIP_MS = 400;

/** A challenge card: tier band on top, title and exact pass condition below. */
export function ChallengeCard({ tier, cardId, flip = false, compact = false, stakes, par }: Props) {
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
              <CheckIcon width={18} height={18} /> {formatDelta(stakes?.made ?? t.made)}
            </span>
            <span className="ccard-stake">
              <CrossIcon width={18} height={18} /> {formatDelta(stakes?.missed ?? t.missed)}
            </span>
          </div>
          {card && !compact && shown && SHOT_ART[card.id] && (
            // Starts once the flip has landed and the text has settled, so only one thing moves at a time.
            <ShotScene art={SHOT_ART[card.id]} par={par} delay={flip ? (FLIP_MS + 120) / 1000 : 0.3} />
          )}
          {card && (
            <div className="ccard-body">
              <h3 className="ccard-title">{card.title}</h3>
              <p className="ccard-pass">{card.pass}</p>
              {card.hint && <p className="ccard-hint">{card.hint}</p>}
              {card.distance && !compact && <p className="ccard-tag">Judged by eye: the group decides.</p>}
            </div>
          )}
        </div>
      </div>
      {/* The wind-up: a glint for Safe, flames for Bold, lightning for Insane. Kept outside the 3D flip: inside it, Safari shows the back through the front. */}
      <span className="ccard-fx" aria-hidden>
        {tier === 'safe' && <span className="ccard-glint" />}
        {tier === 'bold' && [0, 1, 2, 3, 4].map((i) => <span key={i} className={`ccard-flame ccard-flame${i}`} />)}
        {tier === 'insane' && (
          <>
            <span className="ccard-flash" />
            <svg className="ccard-bolt" viewBox="0 0 100 300" preserveAspectRatio="none">
              <polyline points="55,0 35,90 62,110 30,200 58,215 40,300" />
            </svg>
          </>
        )}
      </span>
    </div>
  );
}
