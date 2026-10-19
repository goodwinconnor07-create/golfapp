import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatDelta, TIER_ORDER, TIERS, TIERS_V2, type Player, type Tier } from '../game';
import { markHowToSeen } from '../state/persist';
import { publicOrigin } from '../state/platform';
import { back } from '../state/store';
import { ChallengeCard } from '../ui/ChallengeCard';
import { BackBar, Receipt, TierIcon, Working } from '../ui/components';
import { PlayerRow } from '../ui/BoardRow';
import { reducedMotion } from '../ui/effects';
import { CheckIcon } from '../ui/Icons';
import { SHOT_ART } from '../ui/shotArt';
import { ShotScene } from '../ui/ShotScene';

/**
 * How to play, one idea per slide: swipe (or tap Next) through them. Each slide has a small
 * example built from the real pieces of the game, and it plays again whenever you land on it.
 */
const SLIDES: { title: string; text: string; demo: () => ReactNode }[] = [
  {
    title: 'Pick your card',
    text: "Before each hole you get three cards: one Safe, one Bold, one Insane. Pick one. The harder it is, the more it's worth.",
    demo: () => <PickDemo />,
  },
  {
    title: 'Your hand',
    text: 'Everyone gets their own hand, and it changes every hole. Some cards let you name your own target.',
    demo: () => <ChallengeCard tier="bold" cardId="B17" flip compact />,
  },
  {
    title: 'Play the hole',
    text: 'Play normal golf. Your phone can stay in your pocket until the hole is done.',
    demo: () => (
      <div className="howto-scene">
        <ShotScene art={SHOT_ART.B19} par={4} delay={0.2} />
      </div>
    ),
  },
  {
    title: 'Score it',
    text: 'Enter your strokes. Complete the card and strokes come off your score. Fail it and they go on. Your real strokes are kept too.',
    demo: () => <ScoreDemo />,
  },
  {
    title: 'Lowest score wins',
    text: 'Scores count against par, like golf: −2 is 2 under, E is even. One good card can flip the lead.',
    demo: () => <LeadDemo />,
  },
  {
    title: 'Extras',
    text: 'Small things that change a round.',
    demo: () => <TwistsDemo />,
  },
];

/** `intro`: shown once to a first-time host before they start, so it offers a Skip. */
export function HowToPlay({ intro = false }: { intro?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  // Each slide's example remounts (and replays) every time you arrive on it.
  const [visits, setVisits] = useState<number[]>(() => SLIDES.map(() => 0));
  const last = index === SLIDES.length - 1;

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    setVisits((v) => v.map((n, i) => (i === index ? n + 1 : n)));
  }, [index]);

  // Opening it once is enough: it won't be offered again.
  useEffect(markHowToSeen, []);

  return (
    <div className="screen">
      <BackBar
        title="How to play"
        right={
          intro && !last ? (
            <button type="button" className="btn-link-small" onClick={back}>
              Skip
            </button>
          ) : undefined
        }
      />
      <div
        ref={track}
        className="howto-track"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (i !== index) setIndex(Math.min(SLIDES.length - 1, Math.max(0, i)));
        }}
      >
        {SLIDES.map((s, i) => (
          <section
            key={s.title}
            className="howto-slide"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${SLIDES.length}: ${s.title}`}
            aria-hidden={i !== index}
          >
            <span className="howto-num">{i + 1}</span>
            <h1 className="h1" style={{ margin: 0 }}>
              {s.title}
            </h1>
            <p className="howto-text">{s.text}</p>
            <div className="howto-demo" key={visits[i]}>
              {Math.abs(i - index) <= 1 && s.demo()}
            </div>
          </section>
        ))}
      </div>
      <div className="screen-foot">
        <div className="howto-dots" role="tablist" aria-label="Slides">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={s.title}
              className={i === index ? 'on' : ''}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button type="button" className="btn btn-xl btn-green" onClick={() => (last ? back() : go(index + 1))}>
          {last ? "Let's play" : 'Next'}
        </button>
      </div>
    </div>
  );
}

// ── Examples ─────────────────────────────────────────────────────────────────

/** The three level buttons from the pick screen; Bold gets picked after a beat. */
function PickDemo() {
  const [picked, setPicked] = useState<Tier | null>(reducedMotion() ? 'bold' : null);
  useEffect(() => {
    if (picked) return;
    const t = setTimeout(() => setPicked('bold'), 900);
    return () => clearTimeout(t);
  }, [picked]);
  return (
    <div className="stack howto-tiers" aria-hidden>
      {TIER_ORDER.map((t) => (
        <div key={t} className={`tier-btn tier-btn-${t} ${picked === t ? 'selected' : picked ? 'dim' : ''}`}>
          <span className="tier-btn-icon">
            <TierIcon tier={t} size={30} />
          </span>
          <span className="tier-btn-text">
            <span className="tier-btn-label">{TIERS_V2[t].label}</span>
            <span className="tier-btn-stakes">
              Complete {formatDelta(TIERS_V2[t].made)} · Fail {formatDelta(TIERS_V2[t].missed)}
            </span>
          </span>
          {picked === t && (
            <span className="tier-btn-check">
              <CheckIcon />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** 5 strokes on a par 4 with a Bold card completed: a bogey, minus 2, is 1 under. */
function ScoreDemo() {
  return (
    <div className="howto-score">
      <Receipt strokes={5} par={4} adjustment={TIERS.bold.made} outcome="made" />
    </div>
  );
}

const ALEX = { id: 'demo-alex', name: 'Alex', color: 1 } as Player;
const SAM = { id: 'demo-sam', name: 'Sam', color: 0 } as Player;

/** Sam trails, completes an Insane card, and slides into the lead. */
function LeadDemo() {
  return (
    <div className="howto-lead" aria-hidden>
      {/* The leaderboard's own reorder: Sam starts a place lower and climbs past Alex. */}
      <PlayerRow
        player={SAM}
        rank="1st"
        className="board-row first reorder climbed"
        style={{ '--from': 1 } as React.CSSProperties}
        score="−4"
        detail={<Working strokes={5} par={4} adjustment={TIERS.insane.made} outcome="made" tier="insane" cardTitle="One and Done" />}
      />
      <PlayerRow
        player={ALEX}
        rank="2nd"
        className="board-row reorder dropped"
        style={{ '--from': -1 } as React.CSSProperties}
        score="−1"
        detail={<Working strokes={4} par={4} adjustment={TIERS.safe.missed} outcome="missed" tier="safe" cardTitle="Two-Putt Limit" />}
      />
    </div>
  );
}

function TwistsDemo() {
  const items = [
    { icon: '2×', text: 'In longer rounds, the last 3 holes count double.' },
    { icon: '👑', text: "The Crown: beat the leader's score on a hole and take a stroke off." },
    { icon: '📈', text: 'After every hole, everyone sees their chance of winning.' },
    { icon: '🔁', text: 'Mulligans: re-hit a bad shot and leave it off your strokes. Two a round.' },
    { icon: '👍', text: 'Cards judged by eye go to a group vote.' },
    { icon: '🏅', text: 'Skins: the best score on a hole wins it. Ties carry over to the next hole.' },
  ];
  return (
    <div className="stack" style={{ gap: 8 }}>
      {items.map((it, i) => (
        <div key={it.icon} className="howto-twist rise" style={{ animationDelay: `${i * 90}ms` }}>
          <span className="howto-twist-icon">{it.icon}</span>
          <span>{it.text}</span>
        </div>
      ))}
      <p className="howto-links">
        <a href={`${publicOrigin()}/privacy`} target="_blank" rel="noreferrer">
          Privacy
        </a>
        {' · '}
        <a href={`${publicOrigin()}/support`} target="_blank" rel="noreferrer">
          Support
        </a>
      </p>
    </div>
  );
}
