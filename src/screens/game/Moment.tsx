import { useEffect, useState } from 'react';
import { isDoubleHole, newLeader, standings, type Game } from '../../game';
import { useApp } from '../../state/store';
import { Avatar } from '../../ui/components';
import { confetti, CONFETTI, haptic, reducedMotion } from '../../ui/effects';

const SEEN_KEY = 'sendit.moment';

/**
 * A full-screen beat between holes, only when it matters: a new leader, a tie for the lead,
 * halfway through 18, or the double-stakes holes coming up. Once per hole, after the standings
 * have slid into place. It never blocks: taps go straight through, and it fades on its own.
 */
export function Moment({ game, delay = 800 }: { game: Game; delay?: number }) {
  const h = game.current;
  const key = `${game.id}:${h}`;
  const [show, setShow] = useState(false);
  // Wait until the score splash is out of the way.
  const flash = useApp((st) => st.flash);
  const moment = pick(game);

  useEffect(() => {
    if (!moment || flash || seen(key)) return;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(() => {
      hide = setTimeout(() => setShow(false), 2600);
      setShow(true);
      markSeen(key);
      haptic(moment.kind === 'lead' ? 'success' : 'medium');
      if (moment.kind === 'lead' && !reducedMotion()) confetti(CONFETTI.party, { x: innerWidth / 2, y: innerHeight * 0.4 }, 90);
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
        {moment.player ? (
          <span className="moment-avatar">
            <Avatar player={moment.player} size={96} />
            {moment.kind === 'lead' && <span className="moment-crown">👑</span>}
          </span>
        ) : (
          <span className="moment-emoji">{moment.emoji}</span>
        )}
        <h2 className="moment-title">{moment.title}</h2>
        {moment.sub && <p className="moment-sub">{moment.sub}</p>}
      </div>
    </div>
  );
}

type Pick = { kind: 'lead' | 'tie' | 'half' | 'double'; title: string; sub?: string; emoji?: string; player?: Game['players'][number] };

function pick(game: Game): Pick | null {
  const h = game.current;
  if (game.players.length < 2 || game.status !== 'playing') return null;
  const rows = standings(game);
  const top = rows.filter((r) => r.rank === 1);
  const lead = rows.length > 1 && top.length === 1 ? rows[0].totals.toPar - rows[1].totals.toPar : 0;
  const by = lead ? ` by ${Math.abs(lead)}` : '';
  const last = h >= game.holes.length - 1;
  if (last) return null;
  const doubleNext = isDoubleHole(game, h + 1) && !isDoubleHole(game, h);
  const leader = newLeader(game, h);
  if (leader)
    return {
      kind: 'lead',
      player: leader,
      title: `${leader.name} takes the lead!`,
      sub: doubleNext ? 'Final 3 holes next: every card counts double.' : `Up${by}.`,
    };
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
