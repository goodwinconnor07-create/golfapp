import { formatDelta, TIER_ORDER, TIERS } from '../game';
import { BackBar, TierChip } from '../ui/components';

const STEPS = [
  {
    color: '#2563eb',
    title: 'Pick your risk',
    text: 'Everyone joins on their own phone with the game code. Before each hole, choose Safe, Bold or Insane.',
  },
  { color: '#db2777', title: 'Get a card', text: 'You get a random challenge for that level. Everyone gets a different one.' },
  { color: '#16a34a', title: 'Play the hole', text: 'Play normal golf. No extra shots, nothing unsafe, and keep up with the group.' },
  {
    color: '#ea580c',
    title: 'Score it',
    text: "Enter the strokes you took. If they don't settle the card, tap Completed or Failed. Results show when everyone's in.",
  },
  {
    color: '#7c3aed',
    title: 'Lowest score wins',
    text: 'Each hole: take your strokes, minus strokes if you complete your challenge, plus strokes if you fail it. That is scored over or under par, like golf. Lowest total wins.',
  },
];

export function HowToPlay() {
  return (
    <div className="screen">
      <BackBar title="How to play" />
      <div className="screen-body" style={{ gap: 20 }}>
        {STEPS.map((s, i) => (
          <div className="step rise" key={s.title} style={{ animationDelay: `${i * 50}ms` }}>
            <span className="step-num" style={{ background: s.color }}>
              {i + 1}
            </span>
            <div>
              <h2 className="h3">{s.title}</h2>
              <p>{s.text}</p>
            </div>
          </div>
        ))}

        <div className="stakes-table">
          <div className="row small muted" style={{ padding: '0 12px', fontWeight: 900 }}>
            <span className="spacer" />
            <span style={{ minWidth: 52, textAlign: 'right' }}>Completed</span>
            <span style={{ minWidth: 52, textAlign: 'right' }}>Failed</span>
          </div>
          {TIER_ORDER.map((t) => (
            <div className="stakes-row" key={t}>
              <TierChip tier={t} big />
              <span className="spacer" />
              <span className="delta good">{formatDelta(TIERS[t].made)}</span>
              <span className="delta bad">{formatDelta(TIERS[t].missed)}</span>
            </div>
          ))}
        </div>

        <div className="tile-flat">
          <p style={{ margin: 0 }}>
            <b>Example:</b> 9 strokes on a par 5 with a Safe challenge completed: 9 − 2 = 7, which is <b>2 over</b>. Next, 3 strokes on a
            par 4 with an Insane challenge completed: 3 − 6 = −3, which is <b>7 under</b>. Your total is <b>5 under</b>.
          </p>
        </div>
        <p className="section-title" style={{ margin: 0 }}>
          Twists
        </p>
        <div className="tile-flat stack" style={{ gap: 10 }}>
          <p style={{ margin: 0 }}>
            <b>2× finish:</b> in rounds of 6 holes or more, the last 3 holes count double. Insane is −12 or +6.
          </p>
          <p style={{ margin: 0 }}>
            <b>🛟 Free shot:</b> whoever is in last place can play one card a round where failing costs nothing.
          </p>
          <p style={{ margin: 0 }}>
            <b>Redraw:</b> don't like your card? Swap it for another from the same level, once a round.
          </p>
          <p style={{ margin: 0 }}>
            <b>👍 👎 Group vote:</b> say you made a card judged by eye, and everyone else votes on their phone. More 👎 than 👍 and it
            counts as failed.
          </p>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Your score is a party score, not an official golf score or handicap. Distance cards are judged by eye: one big step is about 3
          feet, or use the course markers.
        </p>
      </div>
    </div>
  );
}
