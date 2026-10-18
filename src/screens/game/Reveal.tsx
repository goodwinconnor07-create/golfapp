import { useEffect } from 'react';
import { cardStakes, getCard, getEntry, hasPicked, redrawUsed, type Game, type Player } from '../../game';
import { doneReveal, redrawCard, swapCard } from '../../state/store';
import { ChallengeCard, flipDelay, FLIP_MS } from '../../ui/ChallengeCard';
import { Avatar } from '../../ui/components';
import { haptic } from '../../ui/effects';
import { SwapIcon } from '../../ui/Icons';

export function Reveal({ game, playerId, pickers }: { game: Game; playerId: string; pickers: Player[] }) {
  const entry = getEntry(game, playerId, game.current);
  const player = game.players.find((p) => p.id === playerId);
  const card = getCard(entry?.cardId);
  const tier = entry?.tier;
  const next = pickers.find((p) => p.id !== playerId && !hasPicked(getEntry(game, p.id, game.current)));

  // A buzz as the card lands. No confetti here: drawing a card isn't a win yet, and the
  // card face (and any shot animation on it) should have the screen to itself.
  useEffect(() => {
    if (!card || !tier) return;
    const timer = setTimeout(() => haptic('success'), flipDelay(tier) + FLIP_MS - 90);
    return () => clearTimeout(timer);
  }, [card, tier]);

  if (!player || !tier) return null;

  return (
    <>
      <div className="screen-body">
        <div className="who">
          <Avatar player={player} size={46} />
          <h1 className="h2">{player.name}'s card</h1>
        </div>
        {entry?.freePass && <div className="free-note">🛟 Free shot: failing this one costs nothing</div>}
        <ChallengeCard
          key={entry?.cardId ?? 'drawing'}
          tier={tier}
          cardId={entry?.cardId}
          flip
          stakes={cardStakes(game, game.current, tier, entry?.freePass)}
          par={game.holes[game.current]?.par ?? undefined}
        />
        {card?.needsBunker && (
          <button type="button" className="btn btn-ghost" onClick={() => swapCard(playerId)}>
            <SwapIcon width={24} height={24} /> No bunker in play? Swap card
          </button>
        )}
      </div>
      <div className="screen-foot">
        {/* In the footer, so a long card or a small phone never hides it. */}
        {card && !redrawUsed(game, playerId) && (
          <button type="button" className="btn btn-sm btn-outline" onClick={() => redrawCard(playerId)}>
            <SwapIcon width={22} height={22} /> Redraw · once a round
          </button>
        )}
        <button type="button" className="btn btn-xl btn-green" disabled={!card} onClick={doneReveal}>
          {next ? `Got it · pass to ${next.name}` : 'Got it'}
        </button>
      </div>
    </>
  );
}
