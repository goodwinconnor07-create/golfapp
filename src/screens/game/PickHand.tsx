import { useState, type KeyboardEvent } from 'react';
import {
  cardStakes,
  completedHoles,
  crownHolder,
  formatDelta,
  gapText,
  getCard,
  handFor,
  isDoubleHole,
  lastHole,
  mateOf,
  nameItLabel,
  nameItTarget,
  TIER_ORDER,
  TIERS,
  unitOf,
  units,
  winChancesFor,
  type Game,
  type Tier,
} from '../../game';
import { pickCard } from '../../state/store';
import { ChallengeCard } from '../../ui/ChallengeCard';
import { Avatar, TierIcon } from '../../ui/components';
import { haptic } from '../../ui/effects';
import { winText } from '../../ui/format';
import { CheckIcon, CrossIcon } from '../../ui/Icons';

interface Choice {
  cardId: string;
  /** The card's level, or the level called for a Name It card. */
  tier: Tier;
}

/**
 * Ruleset 2: before the hole, a player sees one card from each level and picks one. A Name It card
 * offers its targets right on the card (the target sets the level). A card about a friend asks who.
 * The picked card opens up with its scene; Play locks it in.
 */
export function PickHand({ game, playerId }: { game: Game; playerId: string }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [friend, setFriend] = useState<string | null>(null);
  const player = game.players.find((p) => p.id === playerId);
  const h = game.current;
  const hand = handFor(game, playerId, h);
  if (!player || !hand) return null;

  const par = game.holes[h].par ?? 4;
  const doubled = isDoubleHole(game, h);
  const gap = gapText(game, playerId);
  const firstHole = completedHoles(game).filter((x) => x < h).length === 0;
  const mateId = mateOf(game, playerId);
  const mate = game.players.find((p) => p.id === mateId);
  const unit = unitOf(game, playerId);
  // Win chances once a hole is in (on the first tee they'd only say "about even").
  const chance = firstHole ? undefined : winChancesFor(game)?.[unit?.id ?? playerId];
  const holder = crownHolder(game, h);
  const holderName = holder ? units(game).find((u) => u.id === holder)?.name : null;
  const chosen = choice ? getCard(choice.cardId) : undefined;
  const needsFriend = chosen?.group === 'shadow' || chosen?.group === 'bodyguard';
  const friends = game.players.filter((p) => p.id !== playerId && p.id !== mateId);
  const ready = Boolean(choice && (!needsFriend || friend));

  const select = (next: Choice) => {
    setChoice(next);
    if (getCard(next.cardId)?.group !== getCard(choice?.cardId)?.group) setFriend(null);
    haptic('medium');
  };
  const onKey = (e: KeyboardEvent, next: Choice) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(next);
    }
  };

  return (
    <>
      <div className="screen-body">
        <div className="who">
          <Avatar player={player} size={72} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="h1">{player.name}</h1>
            <p className="h3 muted" style={{ margin: '2px 0 0' }}>
              {gap ?? (firstHole ? 'Pick a card. Lowest score wins.' : 'Pick a card')}
            </p>
            {chance != null && <p className="win-line">{winText(chance)}</p>}
          </div>
        </div>

        {mate && (
          <div className="tile-flat team-note" role="status">
            <Avatar player={mate} size={32} />
            <span>
              Your team's hand, shared with <b>{mate.name}</b>. Either of you completing the card counts.
            </span>
          </div>
        )}

        {doubled && (
          <div className="double-banner" role="status">
            <b>2×</b> Double stakes · last {Math.min(3, game.holes.length - h)} hole{game.holes.length - h === 1 ? '' : 's'}
          </div>
        )}

        {holder && holderName && (
          <div className="crown-line" role="status">
            <span aria-hidden>👑</span>
            <span>
              {holder === (unit?.id ?? playerId) ? (
                <>
                  <b>You wear the crown.</b> Anyone who beats your score this hole takes {doubled ? 2 : 1} off.
                </>
              ) : (
                <>
                  <b>{holderName}</b> wears the crown. Beat their score this hole: {formatDelta(doubled ? -2 : -1)}.
                </>
              )}
            </span>
          </div>
        )}

        <div className="hand-list" role="radiogroup" aria-label="Your hand">
          {TIER_ORDER.map((slot) => {
            const card = getCard(hand[slot]);
            if (!card) return null;
            if (card.nameIt) {
              // One card, a target for each level it offers.
              const options = TIER_ORDER.filter((t) => card.nameIt![t]);
              return (
                <div key={card.id} className="hand-nameit">
                  <div className="hand-nameit-head">
                    <span className="hand-nameit-kicker">Name It</span>
                    <h3 className="ccard-title">{card.title}</h3>
                    <p className="ccard-pass">{card.pass}</p>
                  </div>
                  <div className="hand-nameit-opts">
                    {options.map((t) => {
                      const target = nameItTarget(game, playerId, h, card, t);
                      const stakes = cardStakes(game, h, t);
                      const on = choice?.cardId === card.id && choice.tier === t;
                      const next = { cardId: card.id, tier: t };
                      return (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          className={`nameit-opt nameit-opt-${t} press${on ? ' on' : ''}`}
                          onClick={() => select(next)}
                        >
                          <span className={`nameit-opt-tier tier-ink-${t}`}>
                            <TierIcon tier={t} size={18} />
                            {TIERS[t].label}
                          </span>
                          <span className="nameit-opt-label">{target != null ? nameItLabel(card, t, target, par) : ''}</span>
                          <span className="nameit-opt-stakes num">
                            <CheckIcon width={14} height={14} aria-hidden /> {formatDelta(stakes.made)}{' '}
                            <CrossIcon width={14} height={14} aria-hidden /> {formatDelta(stakes.missed)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }
            const on = choice?.cardId === card.id;
            const next = { cardId: card.id, tier: slot };
            return (
              <div
                key={card.id}
                role="radio"
                aria-checked={on}
                aria-label={`${TIERS[slot].label}: ${card.title}`}
                tabIndex={0}
                className={`hand-card press${on ? ' on' : choice ? ' dim' : ''}`}
                onClick={() => select(next)}
                onKeyDown={(e) => onKey(e, next)}
              >
                <ChallengeCard
                  compact={!on}
                  tier={slot}
                  cardId={card.id}
                  stakes={cardStakes(game, h, slot)}
                  par={par}
                  last={lastHole(game, playerId, h)}
                />
              </div>
            );
          })}
        </div>

        {needsFriend && (
          <div className="friend-pick">
            <p className="h3" style={{ margin: 0 }}>
              {chosen?.group === 'shadow' ? 'Who are you shadowing?' : 'Who are you guarding?'}
            </p>
            <div className="friend-chips" role="radiogroup" aria-label="Pick a friend">
              {friends.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={friend === p.id}
                  className={`friend-chip press${friend === p.id ? ' on' : ''}`}
                  onClick={() => {
                    setFriend(p.id);
                    haptic('light');
                  }}
                >
                  <Avatar player={p} size={32} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="screen-foot">
        <button
          type="button"
          className={`btn btn-xl ${choice ? `btn-${choice.tier}` : 'btn-dark'}`}
          disabled={!ready}
          onClick={() => choice && pickCard(playerId, choice.tier, choice.cardId, needsFriend ? (friend ?? undefined) : undefined)}
        >
          {!choice ? 'Tap a card' : needsFriend && !friend ? 'Pick a friend' : `Play ${chosen?.title ?? 'this card'}`}
        </button>
      </div>
    </>
  );
}
