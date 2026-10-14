import { describe, expect, it } from 'vitest';
import { CARDS } from '../game';
import { SHOT_ART } from './shotArt';

describe('shot art', () => {
  it('gives every card in play a scene, with tags short enough to fit', () => {
    for (const card of CARDS.filter((c) => c.enabled)) {
      expect(SHOT_ART[card.id], card.id).toBeDefined();
      expect((SHOT_ART[card.id].tag ?? '').length, card.id).toBeLessThanOrEqual(28);
    }
  });
});
