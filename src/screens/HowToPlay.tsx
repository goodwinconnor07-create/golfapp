import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatDelta, TIER_ORDER, TIERS, type Player, type Tier } from '../game';
import { publicOrigin } from '../state/platform';
import { back } from '../state/store';
import { ChallengeCard } from '../ui/ChallengeCard';
import { Breakdown, BackBar, Pips, TierIcon, TIER_LOOK } from '../ui/components';
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
    title: 'Pick your risk',
    text: 'Before each hole, everyone picks Safe, Bold or Insane. Bigger risk, bigger swing.',
    demo: () => <PickDemo />,
  },
  {
    title: 'Get a card',
    text: 'You draw a random challenge from that level. Everyone gets their own.',
    demo: () => <ChallengeCard tier="bold" cardId="B12" flip compact />,
  },
  {
    title: 'Play the hole',
    text: 'Play normal golf and keep up with the group. Then come back to score it.',
    demo: () => (
      <div className="howto-scene">
        <ShotScene art={SHOT_ART.B02} par={4} delay={0.2} />
      </div>
    ),
  },
  {
    title: 'Score it',
    text: 'Enter your strokes. Complete the card and strokes come off. Fail it and they go on.',
    demo: () => <ScoreDemo />,
  },
  {
    title: 'Lowest score wins',
    text: 'Everything counts over or under par, like golf. One good card can flip the lead.',
    demo: () => <LeadDemo />,
  },
  {
    title: 'Twists',
    text: 'A few extras keep it close right to the end.',
    demo: () => <TwistsDemo />,
  },
];

export function HowToPlay() {
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

  return (
    <div className="screen">
      <BackBar title="How to play" />
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
          <span>
            <span className="tier-btn-label">
              {TIERS[t].label}
              <Pips n={TIER_LOOK[t].pips} />
            </span>
            <span className="tier-btn-stakes">
              Complete {formatDelta(TIERS[t].made)} · Fail {formatDelta(TIERS[t].missed)}
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

/** 5 strokes on a par 4 with a Bold card completed: a bogey, minus 4, is 3 under. */
function ScoreDemo() {
  return (
    <div className="howto-score">
      <div className="howto-strokes">
        <small>Strokes · par 4</small>
        <b>5</b>
      </div>
      <div className="howto-sum">
        <Breakdown strokes={5} par={4} adjustment={TIERS.bold.made} outcome="made" total big />
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Your strokes are kept as they are. The card only changes your game score.
      </p>
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
        rank="1"
        className="board-row first reorder climbed"
        style={{ '--from': 1 } as React.CSSProperties}
        score="−4"
        detail="Insane card ✓ −6"
      />
      <PlayerRow
        player={ALEX}
        rank="2"
        className="board-row reorder dropped"
        style={{ '--from': -1 } as React.CSSProperties}
        score="−1"
        detail="Safe card ✗ +1"
      />
    </div>
  );
}

function TwistsDemo() {
  const items = [
    { icon: '2×', text: 'In longer rounds, the last 3 holes count double.' },
    { icon: '🛟', text: 'Last place gets one free shot a round: failing costs nothing.' },
    { icon: '⇄', text: "Don't like your card? Redraw once a round." },
    { icon: '👍', text: 'Cards judged by eye? The group votes on them.' },
    { icon: '🔁', text: 'Mulligans: a couple of re-hits a round that don’t count.' },
  ];
  return (
    <div className="stack" style={{ gap: 8 }}>
      {items.map((it, i) => (
        <div key={it.icon} className="howto-twist rise" style={{ animationDelay: `${i * 90}ms` }}>
          <span className="howto-twist-icon">{it.icon}</span>
          <span>{it.text}</span>
        </div>
      ))}
      <p className="muted small" style={{ margin: '4px 0 0' }}>
        It's a party score, not an official golf score or handicap.
      </p>
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
