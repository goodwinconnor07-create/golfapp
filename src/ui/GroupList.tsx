import type { ReactNode } from 'react';
import { getCard, getEntry, holeStatus, TIERS, type Game, type Player } from '../game';
import { Avatar, TierIcon } from './components';
import { CheckIcon } from './Icons';

const STATUS = {
  playing: 'Playing',
  done: 'Scoring',
  scored: 'Scored',
} as const;

/**
 * Online, while a hole is played: everyone in the group on one card. Each row is the player,
 * their level (revealed once everyone picked) and where they are: Playing, Scoring or Scored.
 * Scores themselves stay hidden until the results reveal.
 */
export function GroupList({
  game,
  hole = game.current,
  mineIds,
  action,
}: {
  game: Game;
  hole?: number;
  mineIds: Set<string>;
  /** Something to do on a row instead of its status, e.g. the host's "Enter for them". */
  action?: (p: Player) => ReactNode;
}) {
  return (
    <ul className="group-list" aria-label="Your group">
      {game.players.map((p) => {
        const s = holeStatus(game, p.id, hole);
        const entry = getEntry(game, p.id, hole);
        const tier = entry?.tier;
        const extra = action?.(p);
        // Friends' card titles: what they're going for. Yours is on screen already.
        const title = !mineIds.has(p.id) && !entry?.hidden ? getCard(entry?.cardId)?.title : undefined;
        return (
          <li key={p.id} className={`group-row st-${s}`}>
            <Avatar player={p} size={40} />
            <span className="group-who">
              <span className="group-name">
                <span className="group-name-text">{p.name}</span>
                {mineIds.has(p.id) && <span className="you-tag">You</span>}
              </span>
              {(title || (entry?.mulligan && !mineIds.has(p.id))) && (
                <small className="group-card">
                  {title}
                  {entry?.mulligan && !mineIds.has(p.id) && `${title ? ' · ' : ''}🔁 Mulligan`}
                </small>
              )}
            </span>
            {tier ? (
              <span className={`tier-dot tier-dot-${tier}`} role="img" aria-label={TIERS[tier].label}>
                <TierIcon tier={tier} size={16} />
              </span>
            ) : (
              <span />
            )}
            {extra ?? (
              <span key={s} className={`group-st st-${s} pop`}>
                {s === 'playing' && (
                  <span className="dots" aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                )}
                {s === 'scored' && <CheckIcon width={16} height={16} aria-hidden />}
                {STATUS[s]}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
