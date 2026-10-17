import { useEffect, useState, type CSSProperties } from 'react';
import { formatDelta, getCard, TIERS, type Player } from '../game';
import { Avatar, TierChip } from './components';
import { CheckIcon } from './Icons';

// A looping picture of a whole round for first-time hosts: everyone picks a level, draws a card,
// plays the hole, scores it, and the lowest game score wins. Player bubbles stand in for people.
// Each scene plays once as it comes up; with Reduce Motion it's a slideshow of finished scenes.

type Bubble = Pick<Player, 'name' | 'color' | 'emoji'>;
const SAM: Bubble = { name: 'Sam', color: 2, emoji: '🐐' };
const JO: Bubble = { name: 'Jo', color: 0, emoji: '😈' };
const ALEX: Bubble = { name: 'Alex', color: 6, emoji: '👑' };

const CARD = getCard('B17');
const STROKES = 5;

const SCENES = ['Everyone picks a level', 'Draw a card', 'Play the hole for real', 'Make the card, drop strokes', 'Lowest game score wins'];

/** 5 scenes × 3.4s: a 17 second loop. */
const STEP_MS = 3400;

const at = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });

export function GameDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % SCENES.length), STEP_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="demo-wrap">
      <div className="demo" role="img" aria-label="How a round works: everyone picks a level, draws a card, plays the hole for real, makes the card to take strokes off, and the lowest game score wins.">
        <span className="demo-sun" aria-hidden />
        <span className="demo-cloud" aria-hidden />
        <span className="demo-turf" aria-hidden />
        <div key={step} className="demo-scene" aria-hidden>
          <p className="demo-caption">{SCENES[step]}</p>
          {step === 0 && <PickScene />}
          {step === 1 && <DrawScene />}
          {step === 2 && <PlayScene />}
          {step === 3 && <ScoreScene />}
          {step === 4 && <WinScene />}
        </div>
      </div>
      <div className="demo-dots" aria-hidden>
        {SCENES.map((s, i) => (
          <span key={s} className={i === step ? 'on' : undefined} />
        ))}
      </div>
    </div>
  );
}

function PickScene() {
  const picks = [
    { who: SAM, tier: 'safe' as const },
    { who: JO, tier: 'bold' as const },
    { who: ALEX, tier: 'insane' as const },
  ];
  return (
    <div className="demo-picks">
      {picks.map((p, i) => (
        <div key={p.tier} className="demo-pick">
          <span className="demo-bubble">
            <Avatar player={p.who} size={64} />
          </span>
          <span className="demo-pop" style={at(0.5 + i * 0.5)}>
            <TierChip tier={p.tier} />
          </span>
        </div>
      ))}
    </div>
  );
}

function DrawScene() {
  return (
    <>
      <span className="demo-bubble demo-drawer">
        <Avatar player={JO} size={56} />
      </span>
      <div className="demo-card-spot">
        <div className="demo-card demo-card-back">
          <img src="/icons/icon.svg" alt="" width={56} height={56} />
        </div>
        <div className="demo-card demo-card-front" style={at(1.3)}>
          <span className="demo-card-tier">{TIERS.bold.label}</span>
          <span className="demo-card-title">{CARD?.title}</span>
          <span className="demo-card-stakes">
            Make it {formatDelta(TIERS.bold.made)} · Miss it {formatDelta(TIERS.bold.missed)}
          </span>
        </div>
      </div>
    </>
  );
}

function PlayScene() {
  return (
    <>
      <span className="demo-green" />
      <span className="demo-pole" />
      <span className="demo-flag" />
      <span className="demo-bubble demo-waiting demo-waiting-1">
        <Avatar player={ALEX} size={40} />
      </span>
      <span className="demo-bubble demo-waiting demo-waiting-2">
        <Avatar player={JO} size={44} />
      </span>
      <span className="demo-bubble demo-swing" style={at(0.4)}>
        <Avatar player={SAM} size={60} />
      </span>
      <div className="demo-flight">
        <div className="demo-mover" style={at(0.8)}>
          <span className="demo-ball" style={at(0.8)} />
        </div>
      </div>
      <span className="demo-shout demo-pop" style={at(2.1)}>
        3 feet!
      </span>
    </>
  );
}

function ScoreScene() {
  return (
    <div className="demo-score">
      <div className="demo-score-who">
        <Avatar player={SAM} size={40} />
        <b>Sam · Hole 4</b>
      </div>
      <div className="demo-score-row demo-up" style={at(0.4)}>
        <span>Real strokes</span>
        <b>{STROKES}</b>
      </div>
      <div className="demo-score-row demo-score-card demo-up" style={at(1)}>
        <span>
          <span className="demo-tick">
            <CheckIcon width={14} height={14} />
          </span>
          {CARD?.title}
        </span>
        <b>{formatDelta(TIERS.bold.made)}</b>
      </div>
      <div className="demo-score-total demo-pop" style={at(1.7)}>
        <span>Game score</span>
        <b>{STROKES + TIERS.bold.made}</b>
      </div>
    </div>
  );
}

function WinScene() {
  const podium = [
    { who: JO, place: 2, delay: 0.6 },
    { who: SAM, place: 1, delay: 0.9 },
    { who: ALEX, place: 3, delay: 0.3 },
  ];
  return (
    <>
      <div className="demo-podium">
        {podium.map((p) => (
          <div key={p.place} className={`demo-step demo-step-${p.place}`}>
            <span className="demo-bubble demo-pop" style={at(p.delay + 0.3)}>
              <Avatar player={p.who} size={p.place === 1 ? 60 : 50} />
            </span>
            <span className="demo-block demo-grow" style={at(p.delay)}>
              {p.place}
            </span>
          </div>
        ))}
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`demo-confetti demo-confetti-${i}`} style={at(1.3 + (i % 3) * 0.15)} />
      ))}
    </>
  );
}
