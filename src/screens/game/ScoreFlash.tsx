import { useEffect } from 'react';
import { toParWords } from '../../game';
import { clearFlash, type Flash } from '../../state/store';
import { confetti, CONFETTI } from '../../ui/effects';
import { calcText } from '../../ui/format';
import { CheckIcon, CrossIcon, MinusIcon } from '../../ui/Icons';

/** Quick result splash after a score is saved. Tap to skip; it never holds up play. */
export function ScoreFlash({ flash }: { flash: Flash }) {
  const made = flash.outcome === 'made';
  const missed = flash.outcome === 'missed';

  useEffect(() => {
    if (made) confetti(CONFETTI[flash.tier], undefined, flash.tier === 'insane' ? 150 : 90);
    const timer = setTimeout(clearFlash, made ? 1500 : 1200);
    return () => clearTimeout(timer);
  }, [made, flash.tier]);

  return (
    <div className="flash" onClick={clearFlash} role="alert">
      <div className={`flash-card ${flash.outcome} ${missed ? 'shake' : 'pop'}`}>
        <div className="flash-icon">{made ? <CheckIcon /> : missed ? <CrossIcon /> : <MinusIcon />}</div>
        <p className="flash-title">{made ? 'Completed!' : missed ? 'Failed' : 'No change'}</p>
        <p className="flash-calc">{calcText(flash.strokes, flash.delta, flash.gameScore)}</p>
        <p className="flash-name">{flash.name}</p>
        <p className="flash-sub">
          {toParWords(flash.gameScore - flash.par)} on this hole · {flash.strokes} strokes taken
        </p>
      </div>
    </div>
  );
}
