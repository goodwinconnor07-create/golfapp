import { useEffect, useState } from 'react';
import { completedHoles, isDoubleHole, standings, type Game } from '../../game';
import { useApp } from '../../state/store';
import { haptic } from '../../ui/effects';

const SEEN_KEY = 'sendit.moment';

/**
 * A full-screen beat between holes, only when it matters: a tie for the lead, halfway through 18,
 * or the double-stakes holes coming up. (A new leader gets its line under the results heading.) Once per hole, after the standings
 * have slid into place. It never blocks: taps go straight through, and it fades on its own.
 */
export function Moment({ game, hole = game.current, delay = 800 }: { game: Game; hole?: number; delay?: number }) {
  const h = hole;
  const key = `${game.id}:${h}`;
  const [show, setShow] = useState(false);
  // Wait until the score splash is out of the way.
  const flash = useApp((st) => st.flash);
  const moment = pick(game, h);

  useEffect(() => {
    if (!moment || flash || seen(key)) return;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(() => {
      hide = setTimeout(() => setShow(false), 2600);
      setShow(true);
      markSeen(key);
      haptic('medium');
    }, delay);
    return () => {
      clearTimeout(t);
      clearTimeout(hide);
    };
  }, [key, moment?.kind, flash]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show || !moment) return null;
  return (
    <div className={`moment moment-${moment.kind}`} role="status" aria-live="polite">
      <div className="moment-card pop">
        <span className="moment-emoji">{moment.emoji}</span>
        <h2 className="moment-title">{moment.title}</h2>
        {moment.sub && <p className="moment-sub">{moment.sub}</p>}
      </div>
    </div>
  );
}

type Pick = { kind: 'tie' | 'half' | 'double'; title: string; sub?: string; emoji: string };

function pick(game: Game, h: number): Pick | null {
  if (game.players.length < 2 || game.status !== 'playing') return null;
  const rows = standings(
    game,
    'game',
    completedHoles(game).filter((x) => x <= h),
  );
  const top = rows.filter((r) => r.rank === 1);
  const lead = rows.length > 1 && top.length === 1 ? rows[0].totals.toPar - rows[1].totals.toPar : 0;
  const by = lead ? ` by ${Math.abs(lead)}` : '';
  const last = h >= game.holes.length - 1;
  if (last) return null;
  const doubleNext = isDoubleHole(game, h + 1) && !isDoubleHole(game, h);
  // A new leader already gets its line (and confetti) under the results heading, so no second moment for it.
  if (top.length > 1 && h > 0)
    return { kind: 'tie', emoji: '🤝', title: 'All square!', sub: `${top.map((r) => r.player.name).join(' and ')} share the lead.` };
  if (doubleNext)
    return { kind: 'double', emoji: '2×', title: 'Final 3 holes', sub: `Every card counts double. ${rows[0].player.name} leads${by}.` };
  if (game.holes.length >= 18 && h === 8)
    return { kind: 'half', emoji: '⛳', title: 'Halfway!', sub: `${rows[0].player.name} leads${by}.` };
  return null;
}

function seen(key: string): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === key;
  } catch {
    return false;
  }
}

function markSeen(key: string): void {
  try {
    localStorage.setItem(SEEN_KEY, key);
  } catch {
    // Private mode: it may show again after a reload. Harmless.
  }
}
