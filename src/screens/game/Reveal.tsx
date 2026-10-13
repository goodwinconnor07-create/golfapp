import { useEffect } from 'react';
import { getCard, getEntry, hasPicked, type Game, type Player } from '../../game';
import { doneReveal, swapCard } from '../../state/store';
import { ChallengeCard } from '../../ui/ChallengeCard';
import { Avatar } from '../../ui/components';
import { confetti, CONFETTI, haptic } from '../../ui/effects';
import { SwapIcon } from '../../ui/Icons';

export function Reveal({ game, playerId, pickers }: { game: Game; playerId: string; pickers: Player[] }) {
  const entry = getEntry(game, playerId, game.current);
  const player = game.players.find((p) => p.id === playerId);
  const card = getCard(entry?.cardId);
  const tier = entry?.tier;
  const next = pickers.find((p) => p.id !== playerId && !hasPicked(getEntry(game, p.id, game.current)));

  useEffect(() => {
    if (!card || !tier) return;
    const timer = setTimeout(() => {
      confetti(CONFETTI[tier], { x: innerWidth / 2, y: innerHeight * 0.4 }, tier === 'insane' ? 110 : 70);
      haptic('success');
    }, 420);
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
        <ChallengeCard key={entry?.cardId ?? 'drawing'} tier={tier} cardId={entry?.cardId} flip />
        {card?.needsBunker && (
          <button type="button" className="btn btn-ghost" onClick={() => swapCard(playerId)}>
            <SwapIcon width={24} height={24} /> No bunker in play? Swap card
          </button>
        )}
      </div>
      <div className="screen-foot">
        <button type="button" className="btn btn-xl btn-dark" disabled={!card} onClick={doneReveal}>
          {next ? `Got it · pass to ${next.name}` : 'Got it'}
        </button>
      </div>
    </>
  );
}
