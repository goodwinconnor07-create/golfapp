import { useEffect } from 'react';
import { TIERS, type Par } from '../../game';
import { clearFlash, type Flash } from '../../state/store';
import { Breakdown, TierIcon } from '../../ui/components';
import { confetti, CONFETTI, haptic, reducedMotion } from '../../ui/effects';
import { CheckIcon, CrossIcon, MinusIcon } from '../../ui/Icons';

/** Quick result splash after a score is saved. Tap to skip; it never holds up play. */
export function ScoreFlash({ flash }: { flash: Flash }) {
  const made = flash.outcome === 'made';
  const missed = flash.outcome === 'missed';

  const stamped = Boolean(flash.cardTitle) && (made || missed);

  useEffect(() => {
    // Buzz and confetti when the stamp lands (it drops in after a short beat).
    const land = setTimeout(
      () => {
        haptic(made ? 'success' : missed ? 'error' : 'light');
        if (made) confetti(CONFETTI[flash.tier], undefined, flash.tier === 'insane' ? 150 : 90);
      },
      stamped && !reducedMotion() ? 380 : 0,
    );
    const timer = setTimeout(clearFlash, made ? 1700 : 1400);
    return () => {
      clearTimeout(land);
      clearTimeout(timer);
    };
  }, [made, missed, stamped, flash.tier]);

  return (
    <div className="flash" onClick={clearFlash} role="alert">
      <div className={`flash-card ${flash.outcome} ${missed ? 'shake' : 'pop'}`}>
        {stamped ? (
          <div className={`ccard stamp-card ccard-${flash.tier}`}>
            <div className="ccard-band">
              <TierIcon tier={flash.tier} size={18} />
              <span>{TIERS[flash.tier].label}</span>
            </div>
            <p className="stamp-card-title">{flash.cardTitle}</p>
            <span className={`stamp ${flash.outcome}`}>{made ? 'Completed' : 'Failed'}</span>
          </div>
        ) : (
          <>
            <div className="flash-icon">{made ? <CheckIcon /> : missed ? <CrossIcon /> : <MinusIcon />}</div>
            <p className="flash-title">{made ? 'Completed!' : missed ? 'Failed' : 'No change'}</p>
          </>
        )}
        <p className="flash-calc">
          <Breakdown
            strokes={flash.strokes}
            par={flash.par as Par}
            adjustment={flash.delta}
            outcome={flash.outcome}
            doubled={flash.doubled}
            freePass={flash.freePass}
            total
            big
          />
        </p>
        <p className="flash-name">{flash.name}</p>
        <p className="flash-sub">{flash.strokes} strokes taken</p>
      </div>
    </div>
  );
}
